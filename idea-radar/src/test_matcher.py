import sys
sys.path.insert(0, "src")

from matcher import split_matches
from models import CompressedSignal, MatchResult, IdeaRecord


def make_compressed(text):
    return CompressedSignal(raw=None, problem=text, pain_level=5, domain="other", implicit_need="x", keywords=["k"]) 


def make_idea(id_):
    return IdeaRecord(
        id=id_,
        title='t',
        description=None,
        mvp_scope=None,
        tags=['tag'],
        keywords=['k'],
        why_now=None,
        pain=5.0,
        novelty=4.0,
        buildability=3.0,
        saturation=5.0,
        saturation_updated_at=None,
        computed_score=0.0,
        signal_count=0,
        recent_signal_count=0,
        user_score=None,
        user_status='active',
        prompt_version=None,
        created_at='2020-01-01T00:00:00Z',
        updated_at='2020-01-01T00:00:00Z',
        last_signal_at=None,
    )


def test_split_matches():
    signals = [make_compressed('a'), make_compressed('b')]
    idea = make_idea('idea1')
    ideas_by_id = {'idea1': idea}
    matches = [MatchResult(signal_index=0, match_id='idea1'), MatchResult(signal_index=1, match_id=None)]
    matched, unmatched = split_matches(signals, matches, ideas_by_id)
    assert matched == [(0, 'idea1')]
    assert unmatched == [1]
