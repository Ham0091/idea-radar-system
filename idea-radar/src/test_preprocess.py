import sys
sys.path.insert(0, "src")

from preprocess import clean_signal, deduplicate_signals, pre_filter_signals
from models import RawSignal
from utils import utc_now_iso


def test_clean_and_dedup():
    now = utc_now_iso()
    s1 = RawSignal(text="Check this out https://example.com code ```print(1)```", url=None, timestamp=now, source_id="rss", source_type="rss", metrics={})
    cleaned = clean_signal(s1)
    assert "http" not in cleaned.text
    # deduplicate
    signals, new_hashes, deduped = deduplicate_signals([cleaned, cleaned], set())
    assert len(signals) == 1
    assert len(new_hashes) == 1
    assert deduped == 1


def test_pre_filter_noise():
    now = utc_now_iso()
    short = RawSignal(text="hi", url=None, timestamp=now, source_id="reddit", source_type="reddit", metrics={"upvotes":0})
    filtered, count = pre_filter_signals([short])
    assert len(filtered) == 0
    assert count == 1
