"""
Quick sanity test for LLM API compatibility.
Run from the idea-radar/ directory:
    python test_llm.py
"""

import os
import sys
sys.path.insert(0, "src")

import logging
from llm import LLMClient, compress_signals
from models import RawSignal
from utils import utc_now_iso

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("test")

api_key = os.environ.get("LLM_API_KEY")
if not api_key:
    print("ERROR: LLM_API_KEY not set in environment")
    sys.exit(1)

client = LLMClient(api_key=api_key, logger=logger)

# Test 1: raw JSON compliance
print("\n--- Test 1: Raw JSON response ---")
result, usage = client.call_json(
    "Return only this exact JSON array, nothing else, no markdown: [{\"test\": true}]",
    []
)
print("Result:", result)
print("Usage:", usage)
print("PASS" if result == [{"test": True}] else "FAIL — safe_json_loads may need fence stripping")

# Test 2: full compression pipeline
print("\n--- Test 2: Signal compression ---")
test_signals = [
    RawSignal(
        hash="abc123",
        source="test",
        text="I really wish there was a tool that automatically generated SDK clients from OpenAPI specs. I waste hours writing the same boilerplate every project.",
        url="https://example.com/1",
        timestamp=utc_now_iso(),
    ),
    RawSignal(
        hash="def456",
        source="test",
        text="No good way to monitor database schema drift across environments. We keep getting surprised by prod/staging mismatches.",
        url="https://example.com/2",
        timestamp=utc_now_iso(),
    ),
]

compressed, invalid, usage = compress_signals(client, test_signals)
print(f"Compressed: {len(compressed)}, Invalid: {invalid}")

for c in compressed:
    print(f"  - [{c.pain_level}/10] {c.problem}")
    print(f"    Keywords: {c.keywords}")

print("Usage:", usage)
print("PASS" if len(compressed) == 2 and invalid == 0 else f"FAIL — {invalid} invalid elements")
