"""Flask API server for IRS frontend."""

import os
import sys
from pathlib import Path
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from werkzeug.middleware.proxy_fix import ProxyFix

sys.path.insert(0, str(Path(__file__).parent))

import config
import scorer
from telegram_scheduler import record_request_server_url, start_daily_scheduler
from storage import (
    get_connection, fetch_all_ideas, fetch_active_ideas, fetch_idea, fetch_run_logs,
    fetch_source_configs, set_user_status, set_user_score, set_field,
    enable_source, disable_source
)
from main import run_pipeline
from datetime import datetime, timezone

SERVE_FRONTEND = os.environ.get("SERVE_FRONTEND", "").lower() in ("1", "true", "yes")
STATIC_DIR = Path(__file__).resolve().parents[2] / "web" / "static"

if SERVE_FRONTEND and STATIC_DIR.exists():
    app = Flask(__name__, static_folder=str(STATIC_DIR), static_url_path="/static")
else:
    app = Flask(__name__)
CORS(app)
app.wsgi_app = ProxyFix(app.wsgi_app, x_proto=1, x_host=1)


@app.before_request
def capture_public_server_url():
    record_request_server_url(request, app.logger)

if SERVE_FRONTEND and STATIC_DIR.exists():
    @app.route("/", methods=["GET"])
    def serve_frontend():
        index_path = STATIC_DIR / "index.html"
        if not index_path.exists():
            return "index.html not found", 404
        return send_from_directory(STATIC_DIR, "index.html")

def get_db():
    """Get database connection using latest config.DB_PATH."""
    return get_connection(str(config.DB_PATH))


@app.route("/api/ideas", methods=["GET"])
def get_ideas():
    """Fetch ideas, optionally filtered by status (all|active|building|dismissed|archived)."""
    status = request.args.get("status", "all")
    conn = get_db()
    # Fetch all ideas then optionally filter by status
    ideas = fetch_all_ideas(conn)
    if status != "all":
        ideas = [i for i in ideas if i.user_status == status]
    conn.close()
    return jsonify([idea_to_dict(idea) for idea in ideas])


@app.route("/api/ideas/<idea_id>", methods=["GET"])
def get_idea(idea_id):
    """Fetch a single idea."""
    conn = get_db()
    idea = fetch_idea(conn, idea_id)
    conn.close()
    
    if not idea:
        return jsonify({"error": "Not found"}), 404
    
    return jsonify(idea_to_dict(idea))


@app.route("/api/top10", methods=["GET"])
def get_top10():
    """Fetch top 10 ideas."""
    conn = get_db()
    ideas = fetch_active_ideas(conn)
    conn.close()
    # Sort by computed/user ranking score descending and take top N
    sorted_ideas = sorted(ideas, key=lambda i: scorer.ranking_score(i), reverse=True)[: config.TOP10_SIZE]
    return jsonify([idea_to_dict(idea) for idea in sorted_ideas])


@app.route("/api/movers", methods=["GET"])
def get_movers():
    """Fetch ideas with highest momentum."""
    conn = get_db()
    ideas = fetch_active_ideas(conn)
    conn.close()
    # For now, return top N by ranking score as "movers"
    sorted_ideas = sorted(ideas, key=lambda i: scorer.ranking_score(i), reverse=True)[: 20]
    return jsonify([idea_to_dict(idea) for idea in sorted_ideas])


@app.route("/api/ideas/<idea_id>/dismiss", methods=["POST"])
def dismiss_idea(idea_id):
    """Mark idea as dismissed."""
    conn = get_db()
    idea = fetch_idea(conn, idea_id)
    if not idea:
        conn.close()
        return jsonify({"error": "Not found"}), 404
    set_user_status(conn, idea_id, "dismissed")
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/ideas/<idea_id>/restore", methods=["POST"])
def restore_idea(idea_id):
    """Restore dismissed idea."""
    conn = get_db()
    idea = fetch_idea(conn, idea_id)
    if not idea:
        conn.close()
        return jsonify({"error": "Not found"}), 404
    set_user_status(conn, idea_id, "active")
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/ideas/<idea_id>/building", methods=["POST"])
def mark_building(idea_id):
    """Mark idea as building."""
    conn = get_db()
    idea = fetch_idea(conn, idea_id)
    if not idea:
        conn.close()
        return jsonify({"error": "Not found"}), 404
    set_user_status(conn, idea_id, "building")
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/ideas/<idea_id>/score", methods=["POST"])
def set_score_endpoint(idea_id):
    """Update idea's user score."""
    data = request.get_json() or {}
    score = data.get("score")
    
    if score is None or not isinstance(score, (int, float)):
        return jsonify({"error": "Invalid score"}), 400
    
    conn = get_db()
    idea = fetch_idea(conn, idea_id)
    if not idea:
        conn.close()
        return jsonify({"error": "Not found"}), 404
    try:
        set_user_score(conn, idea_id, float(score))
        conn.commit()
    finally:
        conn.close()
    return jsonify({"ok": True})


@app.route("/api/ideas/<idea_id>/field", methods=["POST"])
def set_field_handler(idea_id):
    """Update idea field value."""
    data = request.get_json() or {}
    field = data.get("field")
    value = data.get("value")
    
    if field is None or value is None:
        return jsonify({"error": "Missing field or value"}), 400
    try:
        val = float(value)
    except Exception:
        return jsonify({"error": "Value must be numeric"}), 400
    conn = get_db()
    idea = fetch_idea(conn, idea_id)
    if not idea:
        conn.close()
        return jsonify({"error": "Not found"}), 404
    try:
        set_field(conn, idea_id, field, val)
        conn.commit()
    except ValueError as exc:
        conn.close()
        return jsonify({"error": str(exc)}), 400
    finally:
        conn.close()
    return jsonify({"ok": True})
@app.route("/api/sources", methods=["GET"])
def get_sources():
    """Fetch source configurations."""
    conn = get_db()
    sources = fetch_source_configs(conn)
    conn.close()
    
    return jsonify([
        {
            "source_id": source_id,
            **config_data
        }
        for source_id, config_data in sources.items()
    ])


@app.route("/api/sources/<source_id>/enable", methods=["POST"])
def enable_source_endpoint(source_id):
    """Enable a signal source."""
    conn = get_db()
    enable_source(conn, source_id)
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/sources/<source_id>/disable", methods=["POST"])
def disable_source_endpoint(source_id):
    """Disable a signal source."""
    conn = get_db()
    disable_source(conn, source_id)
    conn.commit()
    conn.close()
    return jsonify({"ok": True})


@app.route("/api/runs", methods=["GET"])
def get_runs():
    """Fetch recent pipeline run logs."""
    limit = request.args.get("limit", 24, type=int)
    conn = get_db()
    runs = fetch_run_logs(conn, limit=limit)
    conn.close()
    return jsonify(runs)


@app.route("/api/stats", methods=["GET"])
def get_stats():
    """Fetch system statistics."""
    conn = get_db()
    ideas = fetch_active_ideas(conn)
    conn.close()
    
    return jsonify({
        "active_ideas": len([i for i in ideas if i.user_status != "dismissed"]),
        "building_ideas": len([i for i in ideas if i.user_status == "building"]),
        "total_signals": sum(getattr(i, "signal_count", 0) for i in ideas),
    })


@app.route("/api/run-now", methods=["POST"])
def run_now():
    """Trigger pipeline run."""
    import logging
    logger = logging.getLogger("api")
    
    try:
        result = run_pipeline(logger)
        return jsonify({"ok": result == 0, "status": "Pipeline run completed"})
    except Exception as e:
        return jsonify({"ok": False, "error": str(e)}), 500


def idea_to_dict(idea):
    """Convert IdeaRecord to JSON-serializable dict."""
    now = datetime.now(timezone.utc)
    timeliness = scorer.compute_timeliness(idea.last_signal_at, now)
    openness = scorer.compute_openness(idea.saturation if idea.saturation is not None else 0.0)
    score = scorer.ranking_score(idea)
    domain = idea.tags[0] if getattr(idea, "tags", None) else None
    return {
        "id": idea.id,
        "title": idea.title,
        "description": idea.description,
        "pain": idea.pain,
        "buildability": idea.buildability,
        "novelty": idea.novelty,
        "timeliness": timeliness,
        "openness": openness,
        "saturation": idea.saturation,
        "score": score,
        "keywords": idea.keywords,
        "domain": domain,
        "created_at": idea.created_at,
        "updated_at": idea.updated_at,
        "user_status": idea.user_status,
        "user_score": idea.user_score,
        "signal_count": idea.signal_count,
        "recent_signal_count": idea.recent_signal_count,
    }


@app.errorhandler(404)
def not_found(e):
    return jsonify({"error": "Not found"}), 404


@app.errorhandler(500)
def server_error(e):
    return jsonify({"error": str(e)}), 500


start_daily_scheduler(app)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8000, debug=False)
