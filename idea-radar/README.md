# Idea Radar System (IRS) - V3

This is a scheduled personal intelligence system that ingests signals, compresses them via an LLM, matches them to a persistent idea memory, and maintains a ranked Top 10 opportunity board.

## Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Create a `.env` file in the project root with your credentials:

```
LLM_API_KEY=your_key_here
# Optional fallback if LLM_API_KEY is not set:
# OPENAI_API_KEY=your_key_here
GITHUB_TOKEN=your_github_token
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_telegram_chat_id
SERVER_URL=https://your-public-server.example.com
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
REDDIT_USER_AGENT=idea-radar/0.1
TELEGRAM_DAILY_TZ=Asia/Kuala_Lumpur
TELEGRAM_DAILY_HOUR=8
TELEGRAM_DAILY_MINUTE=45
```

## Telegram Setup

1. Create a bot with `@BotFather` and copy the token.
2. Send a message to the bot, then retrieve your chat ID with `@userinfobot` or the Telegram Bot API `getUpdates` endpoint.
3. Add `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` to your `.env`.
4. Set `SERVER_URL` if you want to pin a public URL.
5. The Flask API starts the daily scheduler automatically and sends one message per day at 8:45 AM `Asia/Kuala_Lumpur`.

## Run

Run the daily batch pipeline:

```bash
python src/main.py --run
```

Manually force a run now (for testing):

```bash
python src/main.py --run
```

Other CLI commands:

```bash
python src/main.py --top10
python src/main.py --idea <idea_id>
python src/main.py --dismiss <idea_id>
python src/main.py --restore <idea_id>
python src/main.py --set-score <idea_id> 9.5
python src/main.py --building <idea_id>
python src/main.py --set-field <idea_id> novelty 8
python src/main.py --enable-source <source_id>
python src/main.py --log
```

## Cron

Example daily cron entry (runs at 9:00):

```cron
0 9 * * * cd /idea-radar && /usr/bin/python3 src/main.py --run
```

The built-in Telegram scheduler does not require cron; it starts with the Flask API server.

## Notes

- The LLM integration uses an OpenAI-compatible Chat Completions endpoint. Override the base URL and model with `LLM_BASE_URL` and `LLM_MODEL` environment variables if needed.
- You can trigger the same run from the web app via `POST /api/run-now` (temporary manual testing endpoint).
- GitHub Trending is parsed from HTML and may break if the page layout changes.
- Reddit OAuth via `praw` is optional. If you want it, install `praw` and set `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`, and `REDDIT_USER_AGENT`.
- Saturation is mapped from GitHub repo count to a 0-10 score using `min(count, 100) / 10`.
