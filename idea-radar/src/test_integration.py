import os
import sys
import tempfile

sys.path.insert(0, "src")

import api
import config
import storage
from utils import json_dumps, utc_now_iso


def _setup_db():
    tmp = tempfile.NamedTemporaryFile(delete=False)
    db_path = tmp.name
    tmp.close()
    storage.init_db(db_path)
    conn = storage.get_connection(db_path)
    now = utc_now_iso()
    row = {
        "id": "idea-int-1",
        "title": "Integration Idea",
        "description": "A short description for the integration test.",
        "mvp_scope": "Ship the simplest flow.",
        "tags": json_dumps(["mobile"]),
        "keywords": json_dumps(["mobile", "scan"]),
        "why_now": "Users need faster mobile scanning.",
        "pain": 6.0,
        "novelty": 5.0,
        "buildability": 7.0,
        "saturation": 4.0,
        "saturation_updated_at": None,
        "computed_score": 7.0,
        "signal_count": 3,
        "recent_signal_count": 2,
        "user_score": None,
        "user_status": "active",
        "prompt_version": None,
        "created_at": now,
        "updated_at": now,
        "last_signal_at": now,
    }
    with conn:
        storage.insert_ideas(conn, [row])
    conn.close()
    return db_path


def test_dashboard_api_round_trip():
    db_path = _setup_db()
    original_db_path = config.DB_PATH
    config.DB_PATH = db_path
    client = api.app.test_client()

    try:
        ideas = client.get("/api/ideas")
        assert ideas.status_code == 200
        assert len(ideas.get_json()) == 1

        top10 = client.get("/api/top10")
        assert top10.status_code == 200
        assert len(top10.get_json()) == 1

        stats = client.get("/api/stats")
        assert stats.status_code == 200
        payload = stats.get_json()
        assert payload["active_ideas"] == 1
        assert payload["building_ideas"] == 0
    finally:
        config.DB_PATH = original_db_path
        try:
            os.unlink(db_path)
        except OSError:
            pass
