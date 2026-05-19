import sys
import os
sys.path.insert(0, "src")

import json
import tempfile
from api import app
import storage
import config
from utils import utc_now_iso, json_dumps


def setup_db():
    tmp = tempfile.NamedTemporaryFile(delete=False)
    db_path = tmp.name
    tmp.close()
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
    conn.close()
    return db_path


def test_set_score_and_field_endpoints():
    db_path = setup_db()
    # point app to test DB
    config.DB_PATH = db_path
    client = app.test_client()

    # invalid score
    r = client.post('/api/ideas/test1/score', json={})
    assert r.status_code == 400

    # valid score
    r = client.post('/api/ideas/test1/score', json={'score': 7})
    assert r.status_code == 200
    data = r.get_json()
    assert data.get('ok') is True

    # invalid field
    r = client.post('/api/ideas/test1/field', json={'field': 'unknown', 'value': 3})
    assert r.status_code == 400

    # valid field
    r = client.post('/api/ideas/test1/field', json={'field': 'novelty', 'value': 4})
    assert r.status_code == 200

    # cleanup
    try:
        os.unlink(db_path)
    except Exception:
        pass
