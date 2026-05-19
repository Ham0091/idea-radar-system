import sys
sys.path.insert(0, "src")
from datetime import datetime, timedelta, timezone

from scorer import compute_scores, compute_signal_frequency_score, compute_timeliness, compute_openness
from models import IdeaRecord


def make_idea(id_: str, last_signal_days: int = 0) -> IdeaRecord:
    now = datetime.now(timezone.utc)
    last_signal = (now - timedelta(days=last_signal_days)).isoformat()
    return IdeaRecord(
        id=id_,
        title="t",
        description=None,
        mvp_scope=None,
        tags=["tag"],
        keywords=["k"],
        why_now=None,
        pain=5.0,
        novelty=4.0,
        buildability=3.0,
        saturation=5.0,
        saturation_updated_at=None,
        computed_score=0.0,
        signal_count=1,
        recent_signal_count=0,
        user_score=None,
        user_status="active",
        prompt_version=None,
        created_at=now.isoformat(),
        updated_at=now.isoformat(),
        last_signal_at=last_signal,
    )


def test_compute_signal_frequency_score():
    assert compute_signal_frequency_score(0) == 0
    assert compute_signal_frequency_score(5) == 5.0
    assert compute_signal_frequency_score(100) == 10.0


def test_compute_timeliness_and_scores():
    now = datetime.now(timezone.utc)
    idea = make_idea("i1", last_signal_days=1)
    scores = compute_scores([idea], {"i1": 3}, now)
    assert "i1" in scores
    data = scores["i1"]
    assert "computed_score" in data and isinstance(data["computed_score"], float)


def test_compute_openness():
    assert compute_openness(0) == 10.0
    assert compute_openness(10) == 0.0
