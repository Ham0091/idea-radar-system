# Idea Radar System

Ready-to-share package for collecting signals, scoring them, and generating ideas.

## Quick start (Windows, zipped folder)

1. Unzip the project.
2. Open the folder.
3. Double-click **`start_web.bat`**.

That script will automatically:
- create a local virtual environment (`.venv`)
- install required Python dependencies
- create `idea-radar\.env` from `idea-radar\.env.example` (first run only)
- start the web app on `http://127.0.0.1:5000`

## First-time configuration

Open `idea-radar\.env` and set at least:

```env
LLM_API_KEY=your_key_here
```

Optional fallback:

```env
OPENAI_API_KEY=your_key_here
```

## Useful one-click scripts

- `start_web.bat` → starts the web API/UI
- `run_pipeline_now.bat` → runs the pipeline immediately (manual trigger)
- `test_llm_now.bat` → sends a direct LLM test request using sample signals
