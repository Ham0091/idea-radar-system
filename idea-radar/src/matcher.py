from typing import Dict, List, Tuple

from models import CompressedSignal, MatchResult, IdeaRecord


def split_matches(
    signals: List[CompressedSignal],
    matches: List[MatchResult],
    ideas_by_id: Dict[str, IdeaRecord],
) -> Tuple[List[Tuple[int, str]], List[int]]:
    match_map = {match.signal_index: match.match_id for match in matches}

    matched: List[Tuple[int, str]] = []
    unmatched: List[int] = []

    for idx, signal in enumerate(signals):
        match_id = match_map.get(idx)
        if match_id and match_id in ideas_by_id:
            if ideas_by_id[match_id].user_status == "dismissed":
                unmatched.append(idx)
                continue
            matched.append((idx, match_id))
        else:
            unmatched.append(idx)

    return matched, unmatched
