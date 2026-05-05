import hashlib
import json
import logging
import os
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional
from zoneinfo import ZoneInfo


def load_env_file(base_dir: Path) -> None:
    env_path = base_dir / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def utc_now_iso() -> str:
    return utc_now().isoformat()


def parse_iso(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError:
        return None


def format_display_date(iso_value: Optional[str], tz_name: str) -> str:
    dt = parse_iso(iso_value) or utc_now()
    try:
        tz = ZoneInfo(tz_name)
    except Exception:
        tz = timezone.utc
    return dt.astimezone(tz).strftime("%Y-%m-%d")


def unix_to_iso(timestamp: Optional[int]) -> str:
    if timestamp is None:
        return utc_now_iso()
    return datetime.fromtimestamp(timestamp, tz=timezone.utc).isoformat()


def struct_time_to_iso(struct_time: Any) -> str:
    if not struct_time:
        return utc_now_iso()
    return datetime(*struct_time[:6], tzinfo=timezone.utc).isoformat()


def strip_html(text: str) -> str:
    return re.sub(r"<[^>]+>", " ", text)


def strip_urls(text: str) -> str:
    return re.sub(r"https?://\S+", " ", text)


def collapse_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def remove_code_blocks(text: str) -> str:
    return re.sub(r"```.*?```", " ", text, flags=re.DOTALL)


def truncate_text(text: str, max_len: int) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len]


def normalize_for_hash(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^\w\s]", "", text)
    text = collapse_whitespace(text)
    return text


def hash_text(text: str) -> str:
    normalized = normalize_for_hash(text)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def safe_json_loads(text: str) -> Any:
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        for left, right in [("[", "]"), ("{", "}")]:
            start = text.find(left)
            end = text.rfind(right)
            if start != -1 and end != -1 and end > start:
                snippet = text[start : end + 1]
                try:
                    return json.loads(snippet)
                except json.JSONDecodeError:
                    continue
        raise


def json_dumps(value: Any) -> str:
    return json.dumps(value, ensure_ascii=True)


def estimate_cost(tokens: int, cost_per_1k: float) -> float:
    if tokens <= 0 or cost_per_1k <= 0:
        return 0.0
    return (tokens / 1000.0) * cost_per_1k


def cleanup_old_logs(log_dir: Path, max_age_days: int = 30) -> None:
    if not log_dir.exists():
        return
    cutoff = utc_now().timestamp() - (max_age_days * 86400)
    for path in log_dir.glob("run_*.log"):
        if path.stat().st_mtime < cutoff:
            path.unlink(missing_ok=True)


def setup_logger(log_dir: Path, name: str = "irs") -> logging.Logger:
    log_dir.mkdir(parents=True, exist_ok=True)
    cleanup_old_logs(log_dir)

    logger = logging.getLogger(name)
    if logger.handlers:
        return logger

    logger.setLevel(logging.INFO)
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

    log_path = log_dir / f"run_{utc_now().strftime('%Y%m%d')}.log"
    file_handler = logging.FileHandler(log_path)
    file_handler.setFormatter(formatter)

    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(stream_handler)
    return logger
