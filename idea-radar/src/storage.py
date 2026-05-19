import json
import sqlite3
from datetime import timedelta
from typing import Any, Dict, Iterable, List, Optional

import config
from models import IdeaRecord
from utils import json_dumps, parse_iso, utc_now, utc_now_iso

SCHEMA_SQL = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS ideas (
  id                  TEXT PRIMARY KEY,
  title               TEXT NOT NULL,
  description         TEXT,
  mvp_scope           TEXT,
  tags                TEXT,
  keywords            TEXT,
  why_now             TEXT,

  pain                REAL DEFAULT 0,
  novelty             REAL DEFAULT 0,
  buildability        REAL DEFAULT 0,

  saturation          REAL DEFAULT 5,
  saturation_updated_at TEXT,
  computed_score      REAL DEFAULT 0,
  signal_count        INTEGER DEFAULT 0,
  recent_signal_count INTEGER DEFAULT 0,

  user_score          REAL,
  user_status         TEXT DEFAULT 'active',

  prompt_version      TEXT,

  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  last_signal_at      TEXT
);

CREATE TABLE IF NOT EXISTS signals (
  id          TEXT PRIMARY KEY,
  idea_id     TEXT REFERENCES ideas(id),
  hash        TEXT NOT NULL,
  source      TEXT NOT NULL,
  text        TEXT,
  url         TEXT,
  pain_level  REAL,
  domain      TEXT,
  keywords    TEXT,
  timestamp   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seen_hashes (
  hash        TEXT PRIMARY KEY,
  first_seen  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS source_config (
  source_id       TEXT PRIMARY KEY,
  enabled         INTEGER DEFAULT 1,
  consecutive_failures INTEGER DEFAULT 0,
  last_success    TEXT,
  disabled_at     TEXT
);

CREATE TABLE IF NOT EXISTS run_log (
  run_id              TEXT PRIMARY KEY,
  timestamp           TEXT NOT NULL,
  signals_fetched     INTEGER DEFAULT 0,
  signals_filtered    INTEGER DEFAULT 0,
  signals_deduped     INTEGER DEFAULT 0,
  signals_processed   INTEGER DEFAULT 0,
  ideas_created       INTEGER DEFAULT 0,
  ideas_archived      INTEGER DEFAULT 0,
  ideas_matched       INTEGER DEFAULT 0,
  tokens_used         INTEGER DEFAULT 0,
  estimated_cost_usd  REAL DEFAULT 0,
  llm_failures        TEXT,
  top10_changes       TEXT,
  digest_sent         INTEGER DEFAULT 0,
  digest_path         TEXT
);

CREATE TABLE IF NOT EXISTS runtime_state (
  key           TEXT PRIMARY KEY,
  value         TEXT NOT NULL,
  updated_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS scheduled_notifications (
  job_key        TEXT NOT NULL,
  scheduled_for   TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'pending',
  attempt_count  INTEGER DEFAULT 0,
  locked_at      TEXT,
  sent_at        TEXT,
  last_error     TEXT,
  message_text   TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  PRIMARY KEY (job_key, scheduled_for)
);
"""


def get_connection(db_path: str) -> sqlite3.Connection:
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db(db_path: str) -> None:
    with get_connection(db_path) as conn:
        conn.executescript(SCHEMA_SQL)


def _load_json_list(value: Optional[str]) -> List[str]:
    if not value:
        return []
    try:
        data = json.loads(value)
        if isinstance(data, list):
            return data
    except json.JSONDecodeError:
        return []
    return []


def _row_to_idea(row: sqlite3.Row) -> IdeaRecord:
    return IdeaRecord(
        id=row["id"],
        title=row["title"],
        description=row["description"],
        mvp_scope=row["mvp_scope"],
        tags=_load_json_list(row["tags"]),
        keywords=_load_json_list(row["keywords"]),
        why_now=row["why_now"],
        pain=row["pain"],
        novelty=row["novelty"],
        buildability=row["buildability"],
        saturation=row["saturation"],
        saturation_updated_at=row["saturation_updated_at"],
        computed_score=row["computed_score"],
        signal_count=row["signal_count"],
        recent_signal_count=row["recent_signal_count"],
        user_score=row["user_score"],
        user_status=row["user_status"],
        prompt_version=row["prompt_version"],
        created_at=row["created_at"],
        updated_at=row["updated_at"],
        last_signal_at=row["last_signal_at"],
    )


def fetch_active_ideas(conn: sqlite3.Connection) -> List[IdeaRecord]:
    rows = conn.execute(
        "SELECT * FROM ideas WHERE user_status IN ('active', 'building')"
    ).fetchall()
    return [_row_to_idea(row) for row in rows]


def fetch_all_ideas(conn: sqlite3.Connection) -> List[IdeaRecord]:
    rows = conn.execute("SELECT * FROM ideas").fetchall()
    return [_row_to_idea(row) for row in rows]


def fetch_idea(conn: sqlite3.Connection, idea_id: str) -> Optional[IdeaRecord]:
    row = conn.execute("SELECT * FROM ideas WHERE id = ?", (idea_id,)).fetchone()
    if not row:
        return None
    return _row_to_idea(row)


def fetch_signals_for_idea(conn: sqlite3.Connection, idea_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    rows = conn.execute(
        """
        SELECT * FROM signals
        WHERE idea_id = ?
        ORDER BY timestamp DESC
        LIMIT ?
        """,
        (idea_id, limit),
    ).fetchall()
    return [dict(row) for row in rows]


def fetch_seen_hashes(conn: sqlite3.Connection) -> List[str]:
    rows = conn.execute("SELECT hash FROM seen_hashes").fetchall()
    return [row["hash"] for row in rows]


def insert_seen_hashes(conn: sqlite3.Connection, hashes: Iterable[str], timestamp: str) -> None:
    conn.executemany(
        "INSERT OR IGNORE INTO seen_hashes (hash, first_seen) VALUES (?, ?)",
        [(value, timestamp) for value in hashes],
    )


def update_idea_on_merge(
    conn: sqlite3.Connection,
    idea_id: str,
    new_pain: float,
    new_keywords: List[str],
    last_signal_at: str,
) -> None:
    conn.execute(
        """
        UPDATE ideas
        SET pain = ?,
            keywords = ?,
            signal_count = signal_count + 1,
            last_signal_at = ?,
            updated_at = ?
        WHERE id = ?
        """,
        (new_pain, json_dumps(new_keywords), last_signal_at, utc_now_iso(), idea_id),
    )


def insert_signals(conn: sqlite3.Connection, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return
    conn.executemany(
        """
        INSERT INTO signals
          (id, idea_id, hash, source, text, url, pain_level, domain, keywords, timestamp)
        VALUES
          (:id, :idea_id, :hash, :source, :text, :url, :pain_level, :domain, :keywords, :timestamp)
        """,
        rows,
    )


def insert_ideas(conn: sqlite3.Connection, rows: List[Dict[str, Any]]) -> None:
    if not rows:
        return
    conn.executemany(
        """
        INSERT INTO ideas
          (id, title, description, mvp_scope, tags, keywords, why_now,
           pain, novelty, buildability,
           saturation, saturation_updated_at, computed_score, signal_count, recent_signal_count,
           user_score, user_status, prompt_version,
           created_at, updated_at, last_signal_at)
        VALUES
          (:id, :title, :description, :mvp_scope, :tags, :keywords, :why_now,
           :pain, :novelty, :buildability,
           :saturation, :saturation_updated_at, :computed_score, :signal_count, :recent_signal_count,
           :user_score, :user_status, :prompt_version,
           :created_at, :updated_at, :last_signal_at)
        """,
        rows,
    )


def update_scores(conn: sqlite3.Connection, updates: List[Dict[str, Any]]) -> None:
    if not updates:
        return
    conn.executemany(
        """
        UPDATE ideas
        SET computed_score = :computed_score,
            recent_signal_count = :recent_signal_count,
            saturation = :saturation,
            saturation_updated_at = :saturation_updated_at,
            updated_at = :updated_at
        WHERE id = :id
        """,
        updates,
    )


def archive_ideas(conn: sqlite3.Connection, idea_ids: List[str], updated_at: str) -> None:
    if not idea_ids:
        return
    conn.executemany(
        "UPDATE ideas SET user_status = 'archived', updated_at = ? WHERE id = ?",
        [(updated_at, idea_id) for idea_id in idea_ids],
    )


def fetch_recent_signal_counts(conn: sqlite3.Connection, since_iso: str) -> Dict[str, int]:
    rows = conn.execute(
        """
        SELECT idea_id, COUNT(*) as cnt
        FROM signals
        WHERE timestamp >= ?
        GROUP BY idea_id
        """,
        (since_iso,),
    ).fetchall()
    return {row["idea_id"]: row["cnt"] for row in rows}


def fetch_source_configs(conn: sqlite3.Connection) -> Dict[str, Dict[str, Any]]:
    rows = conn.execute("SELECT * FROM source_config").fetchall()
    return {row["source_id"]: dict(row) for row in rows}


def update_source_config(
    conn: sqlite3.Connection,
    source_id: str,
    success: bool,
    timestamp: str,
) -> None:
    row = conn.execute(
        "SELECT * FROM source_config WHERE source_id = ?", (source_id,)
    ).fetchone()

    if row is None:
        conn.execute(
            """
            INSERT INTO source_config (source_id, enabled, consecutive_failures, last_success, disabled_at)
            VALUES (?, 1, 0, NULL, NULL)
            """,
            (source_id,),
        )
        row = conn.execute(
            "SELECT * FROM source_config WHERE source_id = ?", (source_id,)
        ).fetchone()

    enabled = row["enabled"]
    consecutive_failures = row["consecutive_failures"]

    if success:
        conn.execute(
            """
            UPDATE source_config
            SET enabled = 1,
                consecutive_failures = 0,
                last_success = ?,
                disabled_at = NULL
            WHERE source_id = ?
            """,
            (timestamp, source_id),
        )
        return

    consecutive_failures += 1
    if consecutive_failures >= config.SOURCE_FAILURE_LIMIT:
        enabled = 0
        disabled_at = timestamp
    else:
        disabled_at = row["disabled_at"]

    conn.execute(
        """
        UPDATE source_config
        SET enabled = ?,
            consecutive_failures = ?,
            disabled_at = ?
        WHERE source_id = ?
        """,
        (enabled, consecutive_failures, disabled_at, source_id),
    )


def set_user_status(conn: sqlite3.Connection, idea_id: str, status: str) -> None:
    conn.execute(
        "UPDATE ideas SET user_status = ?, updated_at = ? WHERE id = ?",
        (status, utc_now_iso(), idea_id),
    )


def set_user_score(conn: sqlite3.Connection, idea_id: str, score: float) -> None:
    conn.execute(
        "UPDATE ideas SET user_score = ?, updated_at = ? WHERE id = ?",
        (score, utc_now_iso(), idea_id),
    )


def set_field(conn: sqlite3.Connection, idea_id: str, field: str, value: float) -> None:
    if field not in {"novelty", "buildability", "pain"}:
        raise ValueError("Unsupported field")
    conn.execute(
        f"UPDATE ideas SET {field} = ?, updated_at = ? WHERE id = ?",
        (value, utc_now_iso(), idea_id),
    )


def enable_source(conn: sqlite3.Connection, source_id: str) -> None:
    conn.execute(
        """
        UPDATE source_config
        SET enabled = 1,
            consecutive_failures = 0,
            disabled_at = NULL
        WHERE source_id = ?
        """,
        (source_id,),
    )


def disable_source(conn: sqlite3.Connection, source_id: str) -> None:
    conn.execute(
        """
        UPDATE source_config
        SET enabled = 0,
            disabled_at = ?,
            consecutive_failures = 0
        WHERE source_id = ?
        """,
        (utc_now_iso(), source_id),
    )


def insert_run_log(conn: sqlite3.Connection, payload: Dict[str, Any]) -> None:
    conn.execute(
        """
        INSERT INTO run_log (
          run_id, timestamp, signals_fetched, signals_filtered, signals_deduped,
          signals_processed, ideas_created, ideas_archived, ideas_matched,
          tokens_used, estimated_cost_usd, llm_failures, top10_changes,
          digest_sent, digest_path
        ) VALUES (
          :run_id, :timestamp, :signals_fetched, :signals_filtered, :signals_deduped,
          :signals_processed, :ideas_created, :ideas_archived, :ideas_matched,
          :tokens_used, :estimated_cost_usd, :llm_failures, :top10_changes,
          :digest_sent, :digest_path
        )
        """,
        payload,
    )


def fetch_last_run_log(conn: sqlite3.Connection) -> Optional[Dict[str, Any]]:
    row = conn.execute(
        "SELECT * FROM run_log ORDER BY timestamp DESC LIMIT 1"
    ).fetchone()
    if not row:
        return None
    return dict(row)


def update_run_log_digest(
    conn: sqlite3.Connection, run_id: str, digest_sent: int, digest_path: Optional[str]
) -> None:
    conn.execute(
        "UPDATE run_log SET digest_sent = ?, digest_path = ? WHERE run_id = ?",
        (digest_sent, digest_path, run_id),
    )


def fetch_run_logs(conn: sqlite3.Connection, limit: int = 10) -> List[Dict[str, Any]]:
    rows = conn.execute(
        "SELECT * FROM run_log ORDER BY timestamp DESC LIMIT ?", (limit,)
    ).fetchall()
    return [dict(row) for row in rows]


def fetch_runtime_state(conn: sqlite3.Connection, key: str) -> Optional[str]:
    row = conn.execute("SELECT value FROM runtime_state WHERE key = ?", (key,)).fetchone()
    if not row:
        return None
    return row["value"]


def upsert_runtime_state(conn: sqlite3.Connection, key: str, value: str, updated_at: str) -> None:
    conn.execute(
        """
        INSERT INTO runtime_state (key, value, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET
          value = excluded.value,
          updated_at = excluded.updated_at
        """,
        (key, value, updated_at),
    )


def claim_scheduled_notification(
    conn: sqlite3.Connection,
    job_key: str,
    scheduled_for: str,
    now_iso: str,
    stale_lock_seconds: int,
) -> bool:
    conn.execute("BEGIN IMMEDIATE")
    try:
        row = conn.execute(
            """
            SELECT status, locked_at
            FROM scheduled_notifications
            WHERE job_key = ? AND scheduled_for = ?
            """,
            (job_key, scheduled_for),
        ).fetchone()

        if row is None:
            conn.execute(
                """
                INSERT INTO scheduled_notifications (
                  job_key, scheduled_for, status, attempt_count, locked_at,
                  sent_at, last_error, message_text, created_at, updated_at
                )
                VALUES (?, ?, 'sending', 1, ?, NULL, NULL, NULL, ?, ?)
                """,
                (job_key, scheduled_for, now_iso, now_iso, now_iso),
            )
            conn.commit()
            return True

        if row["status"] == "sent":
            conn.rollback()
            return False

        locked_at = parse_iso(row["locked_at"])
        if row["status"] == "sending" and locked_at is not None:
            age = utc_now() - locked_at
            if age < timedelta(seconds=stale_lock_seconds):
                conn.rollback()
                return False

        conn.execute(
            """
            UPDATE scheduled_notifications
            SET status = 'sending',
                attempt_count = attempt_count + 1,
                locked_at = ?,
                updated_at = ?,
                last_error = NULL
            WHERE job_key = ? AND scheduled_for = ?
            """,
            (now_iso, now_iso, job_key, scheduled_for),
        )
        conn.commit()
        return True
    except Exception:
        conn.rollback()
        raise


def mark_scheduled_notification_sent(
    conn: sqlite3.Connection,
    job_key: str,
    scheduled_for: str,
    sent_at: str,
    message_text: str,
) -> None:
    conn.execute(
        """
        UPDATE scheduled_notifications
        SET status = 'sent',
            sent_at = ?,
            message_text = ?,
            locked_at = NULL,
            last_error = NULL,
            updated_at = ?
        WHERE job_key = ? AND scheduled_for = ?
        """,
        (sent_at, message_text, sent_at, job_key, scheduled_for),
    )


def mark_scheduled_notification_failed(
    conn: sqlite3.Connection,
    job_key: str,
    scheduled_for: str,
    failed_at: str,
    error_message: str,
) -> None:
    conn.execute(
        """
        UPDATE scheduled_notifications
        SET status = 'pending',
            last_error = ?,
            locked_at = NULL,
            updated_at = ?
        WHERE job_key = ? AND scheduled_for = ?
        """,
        (error_message, failed_at, job_key, scheduled_for),
    )
