from pathlib import Path
import os

BASE_DIR = Path(__file__).resolve().parents[1]
DATA_DIR = BASE_DIR / "data"
LOG_DIR = BASE_DIR / "logs"
DB_PATH = BASE_DIR / "idea_radar.db"

LOCK_PATH = Path("/tmp/irs.lock")
LOCK_MAX_AGE_SECONDS = 2 * 60 * 60

DISPLAY_TZ = os.environ.get("DISPLAY_TZ", "UTC")
PROMPT_VERSION = "v3"

SOURCE_TIMEOUT_SECONDS = 15
SOURCE_FAILURE_LIMIT = 3

LLM_BASE_URL = os.environ.get("LLM_BASE_URL", "https://token-plan-sgp.xiaomimimo.com/v1")
LLM_MODEL = os.environ.get("LLM_MODEL", "mimo-v2-5-pro")
LLM_API_KEY_ENV = "LLM_API_KEY"
LLM_TIMEOUT_SECONDS = 60
LLM_MAX_RETRIES = 2
LLM_RETRY_BACKOFF_SECONDS = [10, 30]
LLM_TEMPERATURE = 0.0

DAILY_BUDGET_USD = 0.10
ALERT_THRESHOLD_USD = 0.05
LLM_COST_PER_1K_TOKENS_USD = float(os.environ.get("LLM_COST_PER_1K_TOKENS_USD", "0.0"))

REDDIT_SUBREDDITS = ["entrepreneur", "startups", "programming"]
REDDIT_MAX_SUBREDDITS = 3
REDDIT_CAP_PER_SUBREDDIT = 25
REDDIT_MIN_UPVOTES = 3
REDDIT_TIME_FILTER = "day"

HN_CAP = 25
HN_MIN_SCORE = 5
HN_QUERY = ""

ENABLE_GITHUB_TRENDING = True
GITHUB_TRENDING_CAP = 25
GITHUB_TRENDING_MIN_STARS = 3
GITHUB_TRENDING_SINCE = "daily"

GH_ISSUE_QUERIES = [
    'label:"feature request" is:open is:issue reactions:>2',
    "label:enhancement is:open is:issue reactions:>2",
    '"wish there was" is:open is:issue reactions:>2',
    '"would be great if" is:open is:issue reactions:>2',
    '"no way to" is:open is:issue reactions:>2',
]
GH_ISSUE_CAP = 25
GH_ISSUE_MIN_REACTIONS = 3
GH_ISSUE_SLEEP_SECONDS = 2

SO_TAGS = [
    "api",
    "automation",
    "devtools",
    "cli",
    "productivity",
]
SO_CAP = 25
SO_MIN_VOTES = 2

IH_FEEDS = [
    "https://www.indiehackers.com/feed.rss",
    "https://www.indiehackers.com/group/show-ihs/feed.rss",
]
IH_CAP = 15
IH_MIN_LENGTH = 100

RSS_FEEDS = []
RSS_CAP = 15
RSS_MAX_FEEDS = 3

MIN_SIGNAL_TEXT_LENGTH = 50
MAX_SIGNAL_TEXT_LENGTH = 500
NOISE_PATTERNS = ["thanks", "same", "lol"]
NOISE_MIN_WORDS = 5

SIGNAL_FREQUENCY_WINDOW_DAYS = 90
TIMELINESS_HALF_LIFE_DAYS = 30
TOP10_STABILITY_THRESHOLD = 0.5
TOP10_SIZE = 10

ARCHIVE_DAYS = 90
ARCHIVE_SCORE_THRESHOLD = 4.0

SATURATION_TTL_DAYS = 7
SATURATION_CAP_REPOS = 100
SATURATION_REQUEST_SLEEP_SECONDS = 2
