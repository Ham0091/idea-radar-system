import sys
sys.path.insert(0, "src")

import storage
from utils import utc_now_iso, json_dumps


def test_insert_and_fetch_ideas(tmp_path):
    db_path = str(tmp_path / "test.db")
    storage.init_db(db_path)
    conn = storage.get_connection(db_path)
    now = utc_now_iso()

    row = {
        "id": "test1",
        "title": "Test Idea",
        "description": "desc",
        "mvp_scope": "mvp",
        "tags": json_dumps(["tag1"]),
        "keywords": json_dumps(["k1"]),
        "why_now": "now",
        "pain": 5.0,
        "novelty": 4.0,
        "buildability": 3.0,
        "saturation": 5.0,
        "saturation_updated_at": None,
        "computed_score": 0.0,
        "signal_count": 0,
        "recent_signal_count": 0,
        "user_score": None,
        "user_status": "active",
        "prompt_version": None,
        "created_at": now,
        "updated_at": now,
        "last_signal_at": None,
    }

    with conn:
        storage.insert_ideas(conn, [row])

    ideas = storage.fetch_all_ideas(conn)
    assert len(ideas) == 1
    assert ideas[0].id == "test1"
