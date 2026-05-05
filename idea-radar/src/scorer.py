import math
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Tuple

import requests

import config
from models import IdeaRecord
from utils import parse_datetime, utc_now_iso


def compute_signal_frequency_score(recent_count: int) -> float:
    return min(recent_count / 10.0, 1.0) * 10.0


def compute_timeliness(last_signal_at: str, now: datetime) -> float:
    if not last_signal_at:
        return 0.0
    last_dt = parse_datetime(last_signal_at)
    if not last_dt:
        return 0.0
    days = (now - last_dt).total_seconds() / 86400.0
    return 10.0 * math.exp(-days / config.TIMELINESS_HALF_LIFE_DAYS)


def compute_openness(saturation: float) -> float:
    saturation = max(0.0, min(10.0, saturation))
    return max(0.0, 10.0 - saturation)


def compute_scores(
    ideas: List[IdeaRecord],
    recent_counts: Dict[str, int],
    now: datetime,
) -> Dict[str, Dict[str, float]]:
    scores: Dict[str, Dict[str, float]] = {}

    for idea in ideas:
        recent_count = recent_counts.get(idea.id, 0)
        signal_freq = compute_signal_frequency_score(recent_count)
        timeliness = compute_timeliness(idea.last_signal_at, now)
        openness = compute_openness(idea.saturation)
        score = (
            (idea.pain * 0.25)
            + (signal_freq * 0.20)
            + (idea.novelty * 0.20)
            + (timeliness * 0.15)
            + (idea.buildability * 0.10)
            + (openness * 0.10)
        )
        scores[idea.id] = {
            "computed_score": score,
            "recent_signal_count": recent_count,
        }

    return scores


def ranking_score(idea: IdeaRecord) -> float:
    return idea.user_score if idea.user_score is not None else idea.computed_score


def build_top10(
    ideas: List[IdeaRecord],
    prev_top10_ids: List[str],
) -> List[IdeaRecord]:
    if not ideas:
        return []

    ideas_by_id = {idea.id: idea for idea in ideas}
    pinned = [idea for idea in ideas if idea.user_status == "building"]
    pinned.sort(key=ranking_score, reverse=True)

    remaining = max(0, config.TOP10_SIZE - len(pinned))
    if remaining == 0:
        return pinned[: config.TOP10_SIZE]

    candidates = [idea for idea in ideas if idea.id not in {i.id for i in pinned}]
    candidates.sort(key=ranking_score, reverse=True)

    if not prev_top10_ids:
        return pinned + candidates[:remaining]

    stable: List[IdeaRecord] = []
    for idea_id in prev_top10_ids:
        idea = ideas_by_id.get(idea_id)
        if idea and idea.user_status in {"active", "building"}:
            if idea.id not in {i.id for i in pinned}:
                stable.append(idea)

    for candidate in candidates:
        if len(stable) >= remaining:
            break
        if candidate.id not in {i.id for i in stable}:
            stable.append(candidate)

    if stable:
        min_score = min(ranking_score(idea) for idea in stable)
        for candidate in candidates:
            if candidate.id in {i.id for i in stable}:
                continue
            if ranking_score(candidate) > min_score + config.TOP10_STABILITY_THRESHOLD:
                stable.append(candidate)
                stable.sort(key=ranking_score, reverse=True)
                stable = stable[:remaining]
                min_score = min(ranking_score(idea) for idea in stable)

    return pinned + stable


def select_archives(
    ideas: List[IdeaRecord],
    top10_ids: List[str],
    now: datetime,
) -> List[str]:
    cutoff = now - timedelta(days=config.ARCHIVE_DAYS)
    archive_ids: List[str] = []

    for idea in ideas:
        if idea.user_status != "active":
            continue
        if idea.user_score is not None:
            continue
        if idea.id in top10_ids:
            continue
        last_signal_dt = parse_datetime(idea.last_signal_at) if idea.last_signal_at else None
        if last_signal_dt and last_signal_dt >= cutoff:
            continue
        if idea.computed_score >= config.ARCHIVE_SCORE_THRESHOLD:
            continue
        archive_ids.append(idea.id)

    return archive_ids


def refresh_saturation(
    ideas: List[IdeaRecord],
    logger,
) -> Dict[str, Tuple[float, str]]:
    token = os.environ.get("GITHUB_TOKEN")
    if not token:
        logger.info("Skipping saturation refresh: missing GITHUB_TOKEN")
        return {}

    headers = {"Authorization": f"Bearer {token}", "Accept": "application/vnd.github+json"}
    now_iso = utc_now_iso()
    updates: Dict[str, Tuple[float, str]] = {}

    for idea in ideas:
        updated_at = parse_datetime(idea.saturation_updated_at) if idea.saturation_updated_at else None
        if updated_at:
            age = datetime.now(timezone.utc) - updated_at
            if age.days < config.SATURATION_TTL_DAYS:
                continue

        keywords = [kw for kw in idea.keywords if kw][:2]
        if not keywords:
            keywords = idea.title.split()[:2]
        query = " ".join(keywords) + " in:description"

        response = requests.get(
            "https://api.github.com/search/repositories",
            params={"q": query},
            headers=headers,
            timeout=config.SOURCE_TIMEOUT_SECONDS,
        )

        if response.status_code in {403, 429}:
            logger.warning("Rate limit hit during saturation refresh")
            break

        response.raise_for_status()
        data = response.json()
        total = int(data.get("total_count", 0))
        saturation = min(total, config.SATURATION_CAP_REPOS) / 10.0
        updates[idea.id] = (saturation, now_iso)
        time.sleep(config.SATURATION_REQUEST_SLEEP_SECONDS)

    return updates
