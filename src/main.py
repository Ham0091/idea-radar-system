from storage import load_ideas, save_ideas
from scorer import score_idea

def update_top10():
    ideas = load_ideas()

    for idea in ideas:
        idea["score"] = score_idea(idea)

    ideas.sort(key=lambda x: x["score"], reverse=True)

    top10 = ideas[:10]

    with open("data/top10.json", "w") as f:
        import json
        json.dump(top10, f, indent=2)

    return top10

def fetch_signals():
    return [
        {
            "text": "I wish there was a tool that converts API docs into usable code",
            "source": "reddit"
        }
    ]
#This is just a stub for fetching signals. Replace it with actual logic to fetch signals from various sources soon.

def generate_idea_from_signal(signal):
    return {
        "title": "API to Code Generator",
        "description": signal["text"],
        "pain_intensity": 8,
        "signal_frequency": 5,
        "novelty": 7,
        "saturation": 0.6,
        "buildability": 6
    }
#this is a stub for generating an idea from a signal. Replace it with actual logic to generate ideas based on the signal's content and metadata later.

from collector import fetch_signals
from storage import load_ideas, save_ideas
from main import update_top10

def run_pipeline():
    signals = fetch_signals()
    ideas = load_ideas()

    for s in signals:
        new_idea = generate_idea_from_signal(s)
        ideas.append(new_idea)

    save_ideas(ideas)
    update_top10()

if __name__ == "__main__":
    run_pipeline()