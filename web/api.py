"""
Idea Radar System — Web API Layer

Thin Flask API that reads from the same SQLite database
as the backend pipeline. Read-only by default; mutation
endpoints mirror the CLI commands.
"""

import json
import os
import sys
import subprocess
from pathlib import Path
from datetime import datetime, timezone

from flask import Flask, g, jsonify, request
from flask_cors import CORS

# Allow running from web/ dir or project root
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "idea-radar" / "src"))

import storage
import scorer
import config as pipeline_config

app = Flask(__name__, static_folder="static", static_url_path="/static")
CORS(app)

PROJECT_ROOT = Path(__file__).resolve().parents[1]
PIPELINE_DIR = PROJECT_ROOT / "idea-radar"
PIPELINE_MAIN = PIPELINE_DIR / "src" / "main.py"
DB_PATH = str(PIPELINE_DIR / "idea_radar.db")


def get_db():
    if "db" not in g:
        if not Path(DB_PATH).exists():
            storage.init_db(DB_PATH)
        g.db = storage.get_connection(DB_PATH)
    return g.db


@app.teardown_appcontext
def close_db(exc):
    db = g.pop("db", None)
    if db is not None:
        db.close()


# ─── Helpers ────────────────────────────────────────────────

def idea_to_dict(row) -> dict:
    """Convert a sqlite3.Row or IdeaRecord into a JSON-safe dict."""
    if hasattr(row, "__dict__"):
        # IdeaRecord dataclass
        d = {
            "id": row.id,
            "title": row.title,
            "description": row.description,
            "mvp_scope": row.mvp_scope,
            "tags": row.tags,
            "keywords": row.keywords,
            "why_now": row.why_now,
            "pain": row.pain,
            "novelty": row.novelty,
            "buildability": row.buildability,
            "saturation": row.saturation,
            "saturation_updated_at": row.saturation_updated_at,
            "computed_score": row.computed_score,
            "signal_count": row.signal_count,
            "recent_signal_count": row.recent_signal_count,
            "user_score": row.user_score,
            "user_status": row.user_status,
            "prompt_version": row.prompt_version,
            "created_at": row.created_at,
            "updated_at": row.updated_at,
            "last_signal_at": row.last_signal_at,
            "ranking_score": scorer.ranking_score(row),
        }
    else:
        # sqlite3.Row
        d = dict(row)
        d["ranking_score"] = d.get("user_score") if d.get("user_score") is not None else d.get("computed_score", 0)
        for key in ("tags", "keywords"):
            val = d.get(key)
            if isinstance(val, str):
                try:
                    d[key] = json.loads(val)
                except (json.JSONDecodeError, TypeError):
                    d[key] = []
    return d


def signal_to_dict(row) -> dict:
    d = dict(row)
    for key in ("keywords",):
        val = d.get(key)
        if isinstance(val, str):
            try:
                d[key] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                d[key] = []
    return d


# ─── API Routes ─────────────────────────────────────────────

@app.route("/api/ideas")
def list_ideas():
    conn = get_db()
    status = request.args.get("status", "active")
    if status == "all":
        rows = conn.execute("SELECT * FROM ideas ORDER BY computed_score DESC").fetchall()
    elif status in ("active", "building"):
        rows = conn.execute(
            "SELECT * FROM ideas WHERE user_status IN ('active', 'building') ORDER BY computed_score DESC"
        ).fetchall()
    elif status == "archived":
        rows = conn.execute(
            "SELECT * FROM ideas WHERE user_status = 'archived' ORDER BY computed_score DESC"
        ).fetchall()
    elif status == "dismissed":
        rows = conn.execute(
            "SELECT * FROM ideas WHERE user_status = 'dismissed' ORDER BY computed_score DESC"
        ).fetchall()
    else:
        rows = conn.execute(
            "SELECT * FROM ideas WHERE user_status IN ('active', 'building') ORDER BY computed_score DESC"
        ).fetchall()

    ideas = [idea_to_dict(r) for r in rows]
    return jsonify(ideas)


@app.route("/api/ideas/<idea_id>")
def get_idea(idea_id):
    conn = get_db()
    row = conn.execute("SELECT * FROM ideas WHERE id = ?", (idea_id,)).fetchone()
    if not row:
        return jsonify({"error": "not found"}), 404

    idea = idea_to_dict(row)
    signals = conn.execute(
        "SELECT * FROM signals WHERE idea_id = ? ORDER BY timestamp DESC LIMIT 50",
        (idea_id,),
    ).fetchall()
    idea["signals"] = [signal_to_dict(s) for s in signals]
    return jsonify(idea)


@app.route("/api/top10")
def top10():
    conn = get_db()
    ideas = storage.fetch_active_ideas(conn)
    ideas.sort(key=scorer.ranking_score, reverse=True)
    top = ideas[: pipeline_config.TOP10_SIZE]
    return jsonify([idea_to_dict(i) for i in top])


@app.route("/api/movers")
def movers():
    conn = get_db()
    last_run = storage.fetch_last_run_log(conn)
    if not last_run or not last_run.get("top10_changes"):
        return jsonify({"entries": [], "exits": []})
    try:
        data = json.loads(last_run["top10_changes"])
        return jsonify(data)
    except (json.JSONDecodeError, TypeError):
        return jsonify({"entries": [], "exits": []})


@app.route("/api/runs")
def run_logs():
    conn = get_db()
    limit = request.args.get("limit", 10, type=int)
    rows = storage.fetch_run_logs(conn, limit)
    return jsonify([dict(r) for r in rows])


@app.route("/api/sources")
def sources():
    conn = get_db()
    rows = conn.execute("SELECT * FROM source_config").fetchall()
    return jsonify([dict(r) for r in rows])


@app.route("/api/stats")
def stats():
    conn = get_db()
    last_run = storage.fetch_last_run_log(conn)
    ideas = storage.fetch_active_ideas(conn)
    source_rows = conn.execute("SELECT * FROM source_config").fetchall()

    active_count = len([i for i in ideas if i.user_status == "active"])
    building_count = len([i for i in ideas if i.user_status == "building"])

    return jsonify({
        "active_ideas": active_count,
        "building_ideas": building_count,
        "total_signals": conn.execute("SELECT COUNT(*) FROM signals").fetchone()[0],
        "last_run": dict(last_run) if last_run else None,
        "sources": {
            "healthy": len([s for s in source_rows if s["enabled"] == 1]),
            "disabled": len([s for s in source_rows if s["enabled"] == 0]),
        },
    })


# ─── Mutation Routes (mirror CLI commands) ──────────────────

@app.route("/api/run-now", methods=["POST"])
def run_now():
    """
    Temporary manual trigger for testing. Runs the same pipeline as daily cron.
    """
    try:
        completed = subprocess.run(
            [sys.executable, str(PIPELINE_MAIN), "--run"],
            cwd=str(PIPELINE_DIR),
            capture_output=True,
            text=True,
            timeout=900,
            check=False,
        )
    except subprocess.TimeoutExpired as exc:
        stdout = exc.stdout or ""
        stderr = exc.stderr or ""
        return jsonify(
            {
                "ok": False,
                "error": "Pipeline run timed out after 900 seconds",
                "stdout_tail": "\n".join(stdout.splitlines()[-120:]),
                "stderr_tail": "\n".join(stderr.splitlines()[-120:]),
            }
        ), 504

    payload = {
        "ok": completed.returncode == 0,
        "exit_code": completed.returncode,
        "stdout_tail": "\n".join((completed.stdout or "").splitlines()[-120:]),
        "stderr_tail": "\n".join((completed.stderr or "").splitlines()[-120:]),
    }
    status = 200 if completed.returncode == 0 else 500
    return jsonify(payload), status

@app.route("/api/ideas/<idea_id>/dismiss", methods=["POST"])
def dismiss_idea(idea_id):
    conn = get_db()
    with conn:
        storage.set_user_status(conn, idea_id, "dismissed")
    return jsonify({"ok": True})


@app.route("/api/ideas/<idea_id>/restore", methods=["POST"])
def restore_idea(idea_id):
    conn = get_db()
    with conn:
        storage.set_user_status(conn, idea_id, "active")
    return jsonify({"ok": True})


@app.route("/api/ideas/<idea_id>/building", methods=["POST"])
def mark_building(idea_id):
    conn = get_db()
    with conn:
        storage.set_user_status(conn, idea_id, "building")
    return jsonify({"ok": True})


@app.route("/api/ideas/<idea_id>/score", methods=["POST"])
def set_score(idea_id):
    data = request.get_json()
    score = data.get("score")
    if score is None:
        return jsonify({"error": "score required"}), 400
    conn = get_db()
    with conn:
        storage.set_user_score(conn, idea_id, float(score))
    return jsonify({"ok": True})


@app.route("/api/ideas/<idea_id>/field", methods=["POST"])
def set_field(idea_id):
    data = request.get_json()
    field_name = data.get("field")
    value = data.get("value")
    if not field_name or value is None:
        return jsonify({"error": "field and value required"}), 400
    conn = get_db()
    with conn:
        try:
            storage.set_field(conn, idea_id, field_name, float(value))
        except ValueError as e:
            return jsonify({"error": str(e)}), 400
    return jsonify({"ok": True})


@app.route("/api/sources/<source_id>/enable", methods=["POST"])
def enable_source(source_id):
    conn = get_db()
    with conn:
        storage.enable_source(conn, source_id)
    return jsonify({"ok": True})


@app.route("/api/sources/<source_id>/disable", methods=["POST"])
def disable_source(source_id):
    conn = get_db()
    with conn:
        storage.disable_source(conn, source_id)
    return jsonify({"ok": True})


# ─── Serve static frontend ──────────────────────────────────

@app.route("/")
def serve_index():
    return app.send_static_file("index.html")


if __name__ == "__main__":
    port = int(os.environ.get("IRS_WEB_PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
