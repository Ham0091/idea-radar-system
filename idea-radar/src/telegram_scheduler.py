import logging
import os
import sys
import threading
from datetime import datetime, timedelta
from typing import Optional
from urllib.parse import urlparse
from zoneinfo import ZoneInfo

import config
import storage
from telegram_client import resolve_telegram_credentials, send_telegram_message
from utils import utc_now, utc_now_iso

JOB_KEY = "daily-server-link"
SERVER_URL_STATE_KEY = "latest_server_url"

_scheduler_lock = threading.Lock()
_scheduler_thread: Optional[threading.Thread] = None
_stop_event = threading.Event()


def _kl_tz() -> ZoneInfo:
    return ZoneInfo(config.TELEGRAM_DAILY_TZ)


def normalize_server_url(value: Optional[str]) -> Optional[str]:
    if not value:
        return None

    text = value.strip()
    if not text:
        return None
    if "://" not in text:
        text = f"https://{text}"

    parsed = urlparse(text)
    if not parsed.scheme or not parsed.netloc:
        return None

    return text.rstrip("/")


def resolve_server_url(conn=None) -> str:
    if conn is not None:
        stored = storage.fetch_runtime_state(conn, SERVER_URL_STATE_KEY)
        normalized = normalize_server_url(stored)
        if normalized:
            return normalized

    candidates = [
        os.environ.get("SERVER_URL"),
        os.environ.get("PUBLIC_SERVER_URL"),
        os.environ.get("APP_URL"),
        os.environ.get("RENDER_EXTERNAL_URL"),
        os.environ.get("RAILWAY_PUBLIC_DOMAIN"),
        os.environ.get("VERCEL_URL"),
    ]

    for candidate in candidates:
        normalized = normalize_server_url(candidate)
        if normalized:
            return normalized

    return "http://localhost:8000"


def record_request_server_url(request, logger: Optional[logging.Logger] = None) -> Optional[str]:
    if request is None:
        return None

    normalized = normalize_server_url(request.url_root)
    if not normalized:
        return None

    storage.init_db(str(config.DB_PATH))
    with storage.get_connection(str(config.DB_PATH)) as conn:
        with conn:
            storage.upsert_runtime_state(conn, SERVER_URL_STATE_KEY, normalized, utc_now_iso())

    if logger:
        logger.debug("Captured active server URL: %s", normalized)
    return normalized


def build_daily_server_message(server_url: str, now: Optional[datetime] = None) -> str:
    now = now or utc_now()
    local_now = now.astimezone(_kl_tz())
    lines = [
        f"Server update - {local_now.strftime('%Y-%m-%d %H:%M %Z')}",
        "Server is online",
        f"Direct link: {server_url}",
    ]
    return "\n".join(lines)


def _scheduled_for_day(now: datetime) -> str:
    local_now = now.astimezone(_kl_tz())
    scheduled_time = local_now.replace(
        hour=config.TELEGRAM_DAILY_HOUR,
        minute=config.TELEGRAM_DAILY_MINUTE,
        second=0,
        microsecond=0,
    )
    if local_now < scheduled_time:
        return ""
    return scheduled_time.date().isoformat()


def send_daily_server_message(logger: logging.Logger, now: Optional[datetime] = None) -> bool:
    now = now or utc_now()
    scheduled_for = _scheduled_for_day(now)
    if not scheduled_for:
        return False

    token, chat_id = resolve_telegram_credentials()
    if not token or not chat_id:
        logger.warning("Skipping daily Telegram message: missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID")
        return False

    storage.init_db(str(config.DB_PATH))
    with storage.get_connection(str(config.DB_PATH)) as conn:
        with conn:
            server_url = resolve_server_url(conn)
            if not storage.claim_scheduled_notification(
                conn,
                JOB_KEY,
                scheduled_for,
                utc_now_iso(),
                config.TELEGRAM_SCHEDULER_STALE_LOCK_SECONDS,
            ):
                return False

            message = build_daily_server_message(server_url, now)
            sent = send_telegram_message(message, logger, token=token, chat_id=chat_id)
            if sent:
                storage.mark_scheduled_notification_sent(
                    conn, JOB_KEY, scheduled_for, utc_now_iso(), message
                )
                logger.info("Sent daily Telegram server link for %s", scheduled_for)
                return True

            storage.mark_scheduled_notification_failed(
                conn,
                JOB_KEY,
                scheduled_for,
                utc_now_iso(),
                "Telegram send failed",
            )
            logger.warning("Failed to send daily Telegram server link for %s", scheduled_for)
            return False


def _scheduler_loop(app) -> None:
    logger = app.logger.getChild("telegram_scheduler")
    logger.info(
        "Daily Telegram scheduler started for %s at %02d:%02d",
        config.TELEGRAM_DAILY_TZ,
        config.TELEGRAM_DAILY_HOUR,
        config.TELEGRAM_DAILY_MINUTE,
    )

    while not _stop_event.is_set():
        try:
            send_daily_server_message(logger)
        except Exception:
            logger.exception("Daily Telegram scheduler tick failed")
        _stop_event.wait(config.TELEGRAM_SCHEDULER_POLL_SECONDS)


def should_start_scheduler() -> bool:
    if os.environ.get("DISABLE_DAILY_TELEGRAM_SCHEDULER") == "1":
        return False
    if "pytest" in sys.modules:
        return False
    if os.environ.get("FLASK_DEBUG") == "1" and os.environ.get("WERKZEUG_RUN_MAIN") != "true":
        return False
    return True


def start_daily_scheduler(app):
    global _scheduler_thread

    if not should_start_scheduler():
        return None

    with _scheduler_lock:
        if _scheduler_thread and _scheduler_thread.is_alive():
            return _scheduler_thread

        _stop_event.clear()
        _scheduler_thread = threading.Thread(
            target=_scheduler_loop,
            args=(app,),
            name="daily-telegram-scheduler",
            daemon=True,
        )
        _scheduler_thread.start()
        app.extensions["daily_telegram_scheduler"] = _scheduler_thread
        return _scheduler_thread
