import re
from typing import List, Set, Tuple

import config
from models import RawSignal
from utils import (
    collapse_whitespace,
    hash_text,
    remove_code_blocks,
    strip_html,
    strip_urls,
    truncate_text,
)


def clean_signal(signal: RawSignal) -> RawSignal:
    text = signal.text or ""
    text = strip_urls(text)

    if signal.source_type in {"stack_overflow", "indiehackers", "rss"}:
        text = strip_html(text)

    if signal.source_type == "github_issues":
        text = remove_code_blocks(text)

    if signal.source_type == "hn":
        lines = [line for line in text.splitlines() if not line.strip().startswith(">")]
        text = "\n".join(lines)

    if signal.source_type == "reddit":
        text = re.sub(r"(?is)\b(edit|update):.*", " ", text)

    if signal.source_type == "stack_overflow":
        text = remove_code_blocks(text)

    text = collapse_whitespace(text)

    if signal.source_type == "github_trending":
        text = truncate_text(text, 200)
    else:
        text = truncate_text(text, config.MAX_SIGNAL_TEXT_LENGTH)

    return RawSignal(
        source_id=signal.source_id,
        source_type=signal.source_type,
        text=text,
        url=signal.url,
        timestamp=signal.timestamp,
        metrics=signal.metrics,
    )


def deduplicate_signals(
    signals: List[RawSignal],
    seen_hashes: Set[str],
) -> Tuple[List[RawSignal], List[str], int]:
    new_signals = []
    new_hashes = []
    deduped_count = 0

    for signal in signals:
        signal_hash = hash_text(signal.text)
        if signal_hash in seen_hashes:
            deduped_count += 1
            continue
        signal.metrics["hash"] = signal_hash
        new_signals.append(signal)
        new_hashes.append(signal_hash)
        seen_hashes.add(signal_hash)

    return new_signals, new_hashes, deduped_count


def _is_noise(text: str) -> bool:
    lowered = text.lower()
    word_count = len(lowered.split())
    for pattern in config.NOISE_PATTERNS:
        if pattern in lowered and word_count < config.NOISE_MIN_WORDS:
            return True
    return False


def pre_filter_signals(signals: List[RawSignal]) -> Tuple[List[RawSignal], int]:
    filtered = []
    filtered_count = 0

    for signal in signals:
        text = signal.text.strip()
        if len(text) < config.MIN_SIGNAL_TEXT_LENGTH:
            filtered_count += 1
            continue
        if _is_noise(text):
            filtered_count += 1
            continue

        metrics = signal.metrics
        source_type = signal.source_type

        if source_type == "reddit" and metrics.get("upvotes", 0) < config.REDDIT_MIN_UPVOTES:
            filtered_count += 1
            continue
        if source_type == "hn" and metrics.get("points", 0) < config.HN_MIN_SCORE:
            filtered_count += 1
            continue
        if source_type == "github_trending" and metrics.get("stars", 0) < config.GITHUB_TRENDING_MIN_STARS:
            filtered_count += 1
            continue
        if source_type == "github_issues" and metrics.get("reactions", 0) < config.GH_ISSUE_MIN_REACTIONS:
            filtered_count += 1
            continue
        if source_type == "stack_overflow":
            if metrics.get("votes", 0) < config.SO_MIN_VOTES:
                filtered_count += 1
                continue
            if metrics.get("accepted", False):
                filtered_count += 1
                continue
        if source_type == "indiehackers" and len(text) < config.IH_MIN_LENGTH:
            filtered_count += 1
            continue

        filtered.append(signal)

    return filtered, filtered_count
