import sys
sys.path.insert(0, "src")

import api
from models import IdeaRecord
from utils import utc_now_iso


def test_idea_to_dict_fields():
    now = utc_now_iso()
    idea = IdeaRecord(
        id='i1',
        title='t',
        description='d',
        mvp_scope=None,
        tags=['tag1'],
        keywords=['k'],
        why_now=None,
        pain=5.0,
        novelty=4.0,
        buildability=3.0,
        saturation=6.0,
        saturation_updated_at=None,
        computed_score=7.0,
        signal_count=1,
        recent_signal_count=1,
        user_score=None,
        user_status='active',
        prompt_version=None,
        created_at=now,
        updated_at=now,
        last_signal_at=now,
    )

    d = api.idea_to_dict(idea)
    assert d['id'] == 'i1'
    assert 'score' in d and isinstance(d['score'], (int, float))
    assert 'timeliness' in d and isinstance(d['timeliness'], (int, float))
