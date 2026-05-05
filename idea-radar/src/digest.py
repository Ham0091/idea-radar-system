import os
import time
from typing import Dict, List, Optional, Tuple

import requests

import config
from models import IdeaRecord, SourceResult
from utils import format_display_date, utc_now_iso

TELEGRAM_LIMIT = 4096


def format_digest(
    run_date_iso: str,
    top10: List[Dict[str, object]],
    prev_failed: bool,
    new_ideas: List[IdeaRecord],
    movers: List[str],
    sources: List[SourceResult],
    run_stats: Dict[str, object],
) -> str:
    date_str = format_display_date(run_date_iso, config.DISPLAY_TZ)

    lines: List[str] = []
    lines.append(f"IRS Daily - {date_str}")
    if prev_failed:
        lines.append("NOTE: Yesterday's digest failed to send. Retrying.")
    lines.append("")
    lines.append("TOP 10")

    for item in top10:
        idea = item["idea"]
        rank = item["rank"]
        score = item["score"]
        prev_rank = item.get("prev_rank")
        score_delta = item.get("score_delta")

        rank_note = ""
        if prev_rank is not None and prev_rank != rank:
            direction = "UP" if rank < prev_rank else "DOWN"
            rank_note = f" ({direction})"
        if score_delta is not None:
            rank_note = f"{rank_note} {score_delta:+.1f}"

        lines.append(f"{rank}. {idea.title} - {score:.1f}{rank_note}")
        if idea.description:
            lines.append(f"   \"{idea.description[:140]}\"")
        lines.append(
            f"   Signals (90d): {idea.recent_signal_count} | Pain: {idea.pain:.1f} | Open market: {openness_label(idea.saturation)}"
        )
        lines.append("")

    if new_ideas:
        lines.append("NEW TODAY")
        for idea in new_ideas:
            domain = idea.keywords[0] if idea.keywords else "n/a"
            lines.append(f"- {idea.title} (pain: {idea.pain:.1f}, domain: {domain})")
        lines.append("")

    if movers:
        lines.append("MOVERS")
        lines.extend(movers)
        lines.append("")

    if sources:
        lines.append("SOURCES")
        lines.append(format_sources(sources))
        lines.append("")

    lines.append(
        "Run: {signals_fetched} fetched, {signals_filtered} filtered, {signals_processed} processed. ${estimated_cost_usd:.3f}.".format(
            **run_stats
        )
    )
    budget_note = run_stats.get("budget_note")
    if budget_note:
        lines.append(budget_note)

    return "\n".join(lines).strip()


def format_sources(sources: List[SourceResult]) -> str:
    parts = []
    for source in sources:
        if source.error == "disabled":
            parts.append(
                f"{source.source_id}: DISABLED (enable: --enable-source {source.source_id})"
            )
        elif source.success:
            parts.append(f"{source.source_id}: OK")
        else:
            parts.append(f"{source.source_id}: FAIL")
    return "  ".join(parts)


def openness_label(saturation: float) -> str:
    openness = max(0.0, 10.0 - saturation)
    if openness >= 7:
        return "high"
    if openness >= 4:
        return "medium"
    return "low"


def send_digest(text: str, logger) -> Tuple[bool, Optional[str]]:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        logger.warning("Missing Telegram credentials")
        return False, None

    chunks = split_message(text)
    url = f"https://api.telegram.org/bot{token}/sendMessage"

    for attempt in range(2):
        success = True
        for chunk in chunks:
            response = requests.post(
                url,
                data={"chat_id": chat_id, "text": chunk},
                timeout=10,
            )
            if response.status_code >= 400:
                success = False
                logger.warning("Telegram send failed: %s", response.text)
                break
        if success:
            return True, None
        if attempt == 0:
            time.sleep(30)

    return False, None


def split_message(text: str) -> List[str]:
    if len(text) <= TELEGRAM_LIMIT:
        return [text]
    parts = []
    remaining = text
    while len(remaining) > TELEGRAM_LIMIT:
        split_at = remaining.rfind("\n\n", 0, TELEGRAM_LIMIT)
        if split_at == -1:
            split_at = TELEGRAM_LIMIT
        parts.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    if remaining:
        parts.append(remaining)
    return parts


def write_digest_fallback(text: str, log_dir) -> str:
    date_str = utc_now_iso().split("T")[0].replace("-", "")
    path = log_dir / f"digest_{date_str}.txt"
    path.write_text(text, encoding="utf-8")
    return str(path)
