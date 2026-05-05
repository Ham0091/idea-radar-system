import json
import os

IDEAS_FILE = "data/ideas.json"

def load_ideas():
    if not os.path.exists(IDEAS_FILE):
        return []
    with open(IDEAS_FILE, "r") as f:
        return json.load(f)

def save_ideas(ideas):
    with open(IDEAS_FILE, "w") as f:
        json.dump(ideas, f, indent=2)