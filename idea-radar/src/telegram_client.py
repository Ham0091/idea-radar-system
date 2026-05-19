import os
import time
from typing import List, Optional, Tuple

import requests

TELEGRAM_LIMIT = 4096


def resolve_telegram_credentials() -> Tuple[Optional[str], Optional[str]]:
    return (
        os.environ.get("TELEGRAM_BOT_TOKEN"),
        os.environ.get("TELEGRAM_CHAT_ID"),
    )


def split_message(text: str) -> List[str]:
    if len(text) <= TELEGRAM_LIMIT:
        return [text]

    parts: List[str] = []
    remaining = text
    while len(remaining) > TELEGRAM_LIMIT:
        split_at = remaining.rfind("\n\n", 0, TELEGRAM_LIMIT)
        if split_at == -1:
            split_at = TELEGRAM_LIMIT
        parts.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    if remaining:
        parts.append(remaining)
    return parts


def send_telegram_message(text: str, logger, token: Optional[str] = None, chat_id: Optional[str] = None) -> bool:
    token = token or os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = chat_id or os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        logger.warning("Missing Telegram credentials")
        return False

    chunks = split_message(text)
    url = f"https://api.telegram.org/bot{token}/sendMessage"

    for attempt in range(2):
        success = True
        for chunk in chunks:
            response = requests.post(
                url,
                data={"chat_id": chat_id, "text": chunk},
                timeout=10,
            )
            if response.status_code >= 400:
                success = False
                logger.warning("Telegram send failed: %s", response.text)
                break
        if success:
            return True
        if attempt == 0:
            time.sleep(30)

    return False
