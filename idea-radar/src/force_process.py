import os
import sys
import sqlite3
import logging
from pathlib import Path

print("--- DEBUG: Script Started ---")

# Add the src path
src_path = os.path.abspath(r"H:\UIEX\idea-radar-system\idea-radar\src")
sys.path.insert(0, src_path)

try:
    import llm
    from models import RawSignal
    import storage # We will try to use this for saving
    print("--- DEBUG: Imports Successful ---")
except ImportError as e:
    print(f"--- DEBUG: Import Failed: {e} ---")
    sys.exit(1)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("FORCE_TEST")

def force():
    db_path = r"H:\UIEX\idea-radar-system\idea-radar\idea_radar.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    
    # 1. Fetch anything from signals to test the LLM
    print("--- DEBUG: Fetching any 5 signals... ---")
    rows = conn.execute("SELECT * FROM signals LIMIT 5").fetchall()
    
    if not rows:
        print("--- NOTICE: DB is empty. You MUST run main.py --run first to get raw data. ---")
        return

    # 2. Map signals manually
    signals = []
    for r in rows:
        # We find the 'text' column regardless of where it is
        text_content = r['text'] if 'text' in r.keys() else r[2] 
        signals.append(RawSignal(
            id=1, 
            source_id="test", 
            text=text_content, 
            timestamp=0
        ))

    print(f"--- DEBUG: Calling LLM with {len(signals)} signals... ---")

    # 3. Setup Client with your Mimo Key
    api_key = "tp-sur8z13i3bf9khvqci3v49qy13km7p5qv44jkrqjbdmn3ex3"
    client = llm.LLMClient(api_key, logger)
    
    try:
        compressed, invalid, usage = llm.compress_signals(client, signals)
        print(f"--- SUCCESS: LLM returned {len(compressed)} results! ---")
        
        # 4. Create Ideas (This is the function from your llm.py!)
        print("--- DEBUG: Creating Ideas from signals... ---")
        ideas, inv_ideas, idea_usage = llm.create_ideas(client, compressed)
        
        print(f"--- SUCCESS: Created {len(ideas)} Ideas! ---")
        
        # 5. Look at one idea to see if it's cool
        if ideas:
            print(f"Sample Idea: {ideas[0].title}")

        print("\n--- TEST FINISHED ---")
        print("If you see 'Sample Idea' above, your API and LLM are WORKING.")
        print("Now you just need to run 'python main.py --run' to do it for real.")

    except Exception as e:
        print(f"--- LLM FAILURE: {e} ---")

if __name__ == "__main__":
    force()