import logging
import sys
from datetime import datetime, timezone
from types import SimpleNamespace

sys.path.insert(0, "src")

import config
import storage
import telegram_scheduler


def test_build_daily_server_message_includes_status_and_link():
    now = datetime(2026, 5, 17, 0, 45, tzinfo=timezone.utc)
    message = telegram_scheduler.build_daily_server_message("https://example.com", now)

    assert "Server is online" in message
    assert "https://example.com" in message


def test_record_and_resolve_latest_server_url(tmp_path, monkeypatch):
    db_path = str(tmp_path / "scheduler.db")
    config.DB_PATH = db_path
    storage.init_db(db_path)
    monkeypatch.delenv("SERVER_URL", raising=False)
    monkeypatch.delenv("PUBLIC_SERVER_URL", raising=False)
    monkeypatch.delenv("APP_URL", raising=False)
    monkeypatch.delenv("RENDER_EXTERNAL_URL", raising=False)
    monkeypatch.delenv("RAILWAY_PUBLIC_DOMAIN", raising=False)
    monkeypatch.delenv("VERCEL_URL", raising=False)

    telegram_scheduler.record_request_server_url(
        SimpleNamespace(url_root="https://public.example.com/"),
        logging.getLogger("test"),
    )

    with storage.get_connection(db_path) as conn:
        assert storage.fetch_runtime_state(
            conn, telegram_scheduler.SERVER_URL_STATE_KEY
        ) == "https://public.example.com"
        assert telegram_scheduler.resolve_server_url(conn) == "https://public.example.com"


def test_daily_send_claims_once(tmp_path, monkeypatch):
    db_path = str(tmp_path / "scheduler.db")
    config.DB_PATH = db_path
    storage.init_db(db_path)

    captured = []
    monkeypatch.setattr(
        telegram_scheduler,
        "resolve_telegram_credentials",
        lambda: ("bot-token", "chat-id"),
    )
    monkeypatch.setattr(
        telegram_scheduler,
        "send_telegram_message",
        lambda text, logger, token=None, chat_id=None: captured.append(text) or True,
    )

    telegram_scheduler.record_request_server_url(
        SimpleNamespace(url_root="https://server.example.com/"),
        logging.getLogger("test"),
    )

    now = datetime(2026, 5, 17, 0, 45, tzinfo=timezone.utc)
    logger = logging.getLogger("test")

    assert telegram_scheduler.send_daily_server_message(logger, now=now) is True
    assert telegram_scheduler.send_daily_server_message(logger, now=now) is False
    assert len(captured) == 1
    assert "https://server.example.com" in captured[0]

    with storage.get_connection(db_path) as conn:
        row = conn.execute(
            "SELECT status, sent_at, message_text FROM scheduled_notifications WHERE job_key = ?",
            (telegram_scheduler.JOB_KEY,),
        ).fetchone()
        assert row["status"] == "sent"
        assert row["sent_at"] is not None
        assert row["message_text"] == captured[0]
