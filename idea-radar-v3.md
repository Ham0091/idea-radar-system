# PROJECT: Idea Radar System (IRS) — V3

## Core Purpose

A scheduled personal intelligence system that:

- Ingests external tech + problem signals from curated sources
- Deduplicates, pre-filters, and compresses them via batch LLM processing
- Matches signals against a persistent idea memory
- Scores and maintains a Top 10 ranked opportunity board
- Runs once daily via cron
- Delivers output to you where you actually check things

It is NOT a chatbot. It is NOT a generator.

It is a:

> personal opportunity discovery + ranking engine

---

# WHAT CHANGED FROM V2 AND WHY

| V2 Problem | V3 Fix |
|---|---|
| Scoring formula max was 7.0, not 10.0 | Formula restructured — max is exactly 10.0 |
| Pydantic batch validation: one bad signal drops entire batch | Per-element validation — failures skip that element only |
| Jaccard + separate LLM merge judge: overcomplicated and brittle | Replaced with single LLM matching call across all signals + ideas |
| `signal_frequency_score` caps at 10 forever, never decays | Switched to 90-day rolling window — decays naturally as signals age out |
| Saturation: 50+ GitHub API calls daily, semantically broken | Weekly refresh with 7-day TTL cache per idea |
| Timeliness half-life 14 days — too aggressive for slow-burn ideas | Changed to 30 days |
| Lockfile persists after crash → cron never runs again | PID-based lockfile with 2-hour auto-expiry |
| No signal quality pre-filter — garbage enters LLM | Pre-filter by length, upvote count, and noise patterns |
| No LLM API retry logic | Exponential backoff, 2 retries |
| Pain set once at creation, never updated | Rolling average update when signals merge in |
| Digest can fail silently after SQLite write | `digest_sent` flag in run_log with next-run retry |
| SQLite WAL mode not mentioned | Explicitly enabled on DB init |
| Source caps cut newest 25 — misses high-quality older posts | Sort by votes/score before capping |
| Per-source text artifacts (Edit:, long READMEs) enter LLM | Per-source `clean()` functions |
| Dismissed idea: what happens to new matching signals? | Defined explicitly — creates new independent idea |
| Idea keywords go stale after creation | Incoming signal keywords merged into idea on match |
| Failed source stays "flagged" forever with no action | Auto-disabled after 3 consecutive failures |
| `user_score` vs archive interaction unspecified | User-overridden ideas explicitly excluded from archive pass |
| Timezone handling unspecified | UTC storage, configurable display timezone |

---

# SYSTEM ARCHITECTURE

```
                +-----------------------------+
                |      External Sources       |
                | Reddit, HN, GitHub Issues,  |
                | Stack Overflow, IndieHackers,|
                | GitHub Trending, RSS feeds  |
                +-----------+-----------------+
                          |
                          v
              +----------------------+
              | Signal Collector     |
              | Sort by votes, cap   |
              | per source           |
              +---------+------------+
                          | raw signals (quality-sorted)
                          v
              +----------------------+
              | Dedup + Pre-Filter   |
              | Hash check + noise   |
              | removal              |
              +---------+------------+
                          | clean, new signals only
                          v
              +----------------------+
              | Batch LLM Processor  |
              | Compress + Match +   |
              | Create (3 calls max) |
              +---------+------------+
                          | structured insights + matched/new ideas
                          v
              +----------------------+
              | Scoring Engine       |
              | (deterministic,      |
              |  bounded 0–10)       |
              +---------+------------+
                          | ranked ideas
                          v
              +----------------------+
              | SQLite (WAL mode)    |
              | Atomic state store   |
              +---------+------------+
                          |
                          v
              +----------------------+
              | Output Digest        |
              | (Telegram / email,   |
              |  with sent flag)     |
              +----------------------+
```

---

# SOURCE SPECIFICATIONS

Each source has its own collector. They all share the same interface: `fetch(source_id) -> List[RawSignal]`. Failures raise exceptions caught by the outer per-source try/except in Step 3.

---

## Stack Overflow — Unanswered Questions

**Why it's valuable:** A question with high votes and no accepted answer after months is a precisely stated unmet need. The person already did the work of articulating the problem clearly. It's the highest signal-to-noise source in this list.

**API:** Stack Exchange API — `https://api.stackexchange.com/2.3/questions`  
No authentication required. Unauthenticated quota: 10,000 requests/day. More than enough.

**Query parameters:**
```
site=stackoverflow
order=desc
sort=votes
tagged=<your_domain_tags>   # e.g. python;api;automation — semicolon-separated
answered=false
filter=withbody
pagesize=25
```

**Domain tags to configure** (set in `config.py`, not hardcoded):
```python
SO_TAGS = [
    "api",
    "automation",
    "devtools",
    "cli",
    "productivity",
    # add/remove based on your interests
]
```

Run one API call per tag group. With 5 tag groups at 25 questions each you'd get 125 questions — too many. Instead, combine tags with `;` to get questions tagged with ALL of them, or run a single broad call and let the pre-filter + dedup handle noise. Simpler: one call, no tags filter, sort by votes, take top 25. The vote-sort naturally surfaces widely-felt problems.

**Signal text:** `title + " — " + body_excerpt` (first 250 chars of cleaned body)

**Pre-filter additions:** Zero accepted answers is the key signal. The API `answered=false` parameter handles this — but double-check `accepted_answer_id` is null in the response, since the parameter sometimes returns questions with accepted answers in edge cases.

---

## IndieHackers — RSS Feed

**Why it's valuable:** IndieHackers is a community of people actively building businesses. Posts describe real problems founders hit and can't solve — often ideas that are VC-uninteresting but highly buildable by one person. The "problems I'm facing" and "what tools do you wish existed" posts are pure signal.

**API:** RSS feed — no auth, no rate limits worth worrying about.

**Feed URLs** (configure in `config.py`):
```python
IH_FEEDS = [
    "https://www.indiehackers.com/feed.rss",          # Main feed
    "https://www.indiehackers.com/group/show-ihs/feed.rss",  # Show IH posts
]
```

Parse with `feedparser`. Each entry gives you: `title`, `summary` (HTML), `published`, `link`.

**Signal text:** Strip HTML from `summary`, take first 500 chars. If `summary` is empty, use `title` only.

**Limitation:** IndieHackers RSS doesn't include vote counts or engagement metrics. You're relying on the length pre-filter (100 chars minimum) and the LLM's pain extraction to filter quality. This is the weakest signal source of the three — treat it as supplementary context, not a primary driver.

---

## GitHub Issues — Keyword Search

**Why it's valuable:** GitHub Issues are where developers go when they hit a wall. A feature request issue with 50 reactions means 50 developers independently wanted the same thing. Unlike GitHub Trending (which shows popular repos), this surfaces actual unsolved problems inside existing tools — gaps in the current landscape, not just what's being built.

**API:** GitHub Search API — `https://api.github.com/search/issues`  
Uses the **same auth token** as the saturation refresh step. Authenticated: 30 requests/minute.

**Query format:**
```
https://api.github.com/search/issues?q=<query>&sort=reactions&order=desc&per_page=25
```

**Search queries** (run multiple, deduplicate results by issue URL):
```python
GH_ISSUE_QUERIES = [
    'label:"feature request" is:open is:issue reactions:>2',
    'label:enhancement is:open is:issue reactions:>2',
    '"wish there was" is:open is:issue reactions:>2',
    '"would be great if" is:open is:issue reactions:>2',
    '"no way to" is:open is:issue reactions:>2',
]
```

Run each query, collect results, deduplicate by issue URL before any further processing. With 5 queries at 25 results each you could get up to 125 issues, but after dedup (same issue matching multiple queries) and pre-filtering (reactions >= 3), expect 30–50 unique issues.

**Rate limiting:** 5 queries at 30 req/min = no problem. Add a 2-second sleep between queries to be safe.

**Signal text:** `repo_name + ": " + issue_title + " — " + body_excerpt` (first 300 chars, strip code blocks)

**Important:** The repo name adds context. "prisma: No way to do partial updates" is more useful to the LLM than "No way to do partial updates" alone.

**Pre-filter:** Minimum 3 reactions. Issues with 0–2 reactions may be valid bugs or fringe requests — not validated pain.

---

# EXECUTION PIPELINE

Runs **once daily** via cron. A second run per day is easy to add later if you want it — but start with one.

---

## Step 1: Boot + Lock Check

```bash
python main.py --run
```

Write a PID lockfile (`/tmp/irs.lock` containing the current PID). On startup:

1. If lockfile exists, read the PID inside it.
2. Check if that PID is still running (`os.kill(pid, 0)` — raises if not running).
3. If the process is dead OR the lockfile is older than 2 hours → delete it and continue.
4. If the process is genuinely running → abort (true overlap).

This survives crashes and power failures. A dead Pi no longer leaves the system permanently locked.

---

## Step 2: Load State from SQLite

```python
conn = sqlite3.connect("idea_radar.db")
conn.execute("PRAGMA journal_mode=WAL")   # WAL mode — always set on open
conn.execute("PRAGMA foreign_keys=ON")
```

Load:
- Active ideas (not archived, not dismissed)
- Seen signal hashes
- Source health records
- Last run's `digest_sent` flag (to handle retry)

---

## Step 3: Fetch + Sort + Cap Signals

For each source: **sequential fetch with 15s timeout, wrapped in individual try/except.**

Before applying caps, **sort by quality signal**:

| Source | Sort by | Hard Cap | Auth |
|---|---|---|---|
| Reddit | upvotes descending | 25 per subreddit, max 3 subreddits | OAuth (PRAW) |
| Hacker News | HN score descending | 25 items | None (Algolia API) |
| GitHub Trending | stars descending | 25 repos | Token (already needed for saturation) |
| GitHub Issues | reactions descending | 25 issues | Same token as above |
| Stack Overflow | vote count descending | 25 questions | None (unauthenticated: 10k req/day) |
| IndieHackers | publication date | 15 items | None (RSS) |
| RSS feeds | publication date | 15 items per feed, max 3 feeds | None |

Sorting before capping means you get the most-validated content, not just the most-recent. A single viral post with 500 upvotes enters the cap; zero-upvote noise doesn't.

**Total worst-case signals before dedup/filter: ~215.** After dedup and pre-filtering, expect 80–120 to reach the LLM. Still within one comfortable batch call.

**Source health tracking:** Each source logs success/failure to a `source_health` table. After **3 consecutive failures**, the source is automatically **disabled** (flagged in the config row in SQLite) until you manually re-enable it via CLI. The digest reports it. The source doesn't silently drain your runs.

---

## Step 4: Per-Source Text Cleaning

Before dedup, apply a `clean(source, text)` function:

- **All sources:** Strip URLs, normalize whitespace, truncate to 500 chars max
- **Reddit:** Remove "Edit:", "EDIT:", "Update:" suffixes and everything after
- **GitHub Trending:** Take only the first 200 chars of README — headline only
- **GitHub Issues:** Take issue title + first 300 chars of body. Strip code blocks (between ``` fences) — code is not a pain signal, the surrounding text is.
- **HN:** Strip quoted reply context (lines starting with `>`)
- **Stack Overflow:** Strip HTML tags from body (SO returns HTML). Take question title + first 250 chars of cleaned body. Discard everything after the first code block.
- **IndieHackers:** Strip HTML tags, collapse whitespace. If post body is over 500 chars, take first 500 — IH posts can be long essays; the opening states the problem.
- **RSS:** Strip HTML tags, collapse whitespace

This prevents the LLM from seeing "I found a tool actually, never mind" as a valid pain signal.

---

## Step 5: Dedup + Pre-Filter

**Dedup:** SHA-256 hash of cleaned, lowercased, punctuation-stripped text. Reject hashes already in `seen_hashes`. Insert new ones.

**Pre-filter** (applied after dedup, before LLM — zero cost):

| Filter | Threshold |
|---|---|
| Minimum text length | 50 characters |
| Reddit | Minimum 3 upvotes |
| HN | Minimum HN score of 5 |
| GitHub Trending | Minimum 3 stars |
| GitHub Issues | Minimum 3 reactions (👍) — ensures community validation, not just one person's wish |
| Stack Overflow | Minimum 2 votes, zero accepted answers (if accepted answer exists, the problem is solved) |
| IndieHackers | Minimum 100 characters — short IH posts are usually just links or announcements |
| RSS | No vote threshold (no signal available) — rely on length filter only |
| Noise pattern match | Drop: "thanks", "same", "lol", strings under 5 words |

Anything that fails pre-filter is logged to `run_log.filtered_count` and skipped. You're not paying LLM tokens to process "lol same."

---

## Step 6: Batch Signal Compression (LLM Call 1)

**All signals in one call — but with per-element validation.**

Send all cleaned, filtered, new signals as a JSON array. Prompt:

```
You are a signal analyst. For each signal below, extract:
- problem: one sentence, what frustration or gap is expressed
- pain_level: integer 0–10
  (0 = minor annoyance, 5 = significant friction blocking work,
   10 = critical/costly problem complained about by many people)
- domain: one of [devtools, productivity, infra, data, consumer, b2b, other]
- implicit_need: one phrase — what someone would build to solve this
- keywords: 3–8 lowercase keywords, specific (not generic like "tool" or "app")

Return ONLY a JSON array, one object per signal, in the same order.
No preamble, no markdown, no extra fields.
```

**Validation:** Parse the returned array. For each element, validate individually:
- Required fields present
- `pain_level` is integer 0–10
- `keywords` is a non-empty list

If an element fails validation → log the failure with the raw text and skip that element. The remaining valid signals continue. You never lose the whole batch for one broken entry.

**LLM API retry:** If the API call itself fails (429, 500, network error):
- Wait 10 seconds, retry
- Wait 30 seconds, retry again
- If third attempt fails → log "LLM compression failed this run", proceed to digest in degraded mode (no new signals processed, Top 10 unchanged, digest reports the failure)

---

## Step 7: Signal Matching (LLM Call 2)

Replace the old Jaccard + separate LLM judge with a **single LLM call** that does both.

Send all compressed signals alongside a compact summary of all active ideas:

```json
{
  "signals": [
    {"idx": 0, "problem": "...", "implicit_need": "...", "keywords": [...]}
  ],
  "ideas": [
    {"id": "uuid", "title": "...", "keywords": [...]}
  ]
}
```

Prompt:
```
For each signal, find the best matching idea from the list, if any.
Return a JSON array: [{"signal_idx": 0, "match_id": "uuid-or-null"}]
Match if the signal and idea describe the same underlying problem.
When in doubt, return null — creating a new idea is safer than a bad merge.
```

Why this replaces Jaccard:
- No threshold tuning. Jaccard on "cybersecurity, scanner" vs "infosec, vulnerability-detection" is 0.0 — a miss. The LLM sees them as the same concept.
- No false positives from shared generic keywords. "API" appears everywhere; the LLM understands the problem description is what matters.
- Same cost: one LLM call instead of two. At 50 active ideas and 150 signals, this is well within context limits (~10k input tokens).

**Log all match decisions** to the run log (signal text → matched idea ID or null). This makes merge behavior auditable and correctable.

**Dismissed idea routing:** If a signal would match an idea with `user_status = "dismissed"`, treat it as no match → create a new idea. The dismissed idea stays dismissed. No resurrection.

---

## Step 8: Merge Signals into Existing Ideas

For each signal with a `match_id`:

1. Attach signal to idea (insert into `signals` table)
2. Increment `signal_count`
3. Update `last_signal_at` to now
4. **Update `pain`** as rolling average: `new_pain = (idea.pain * 0.7) + (signal.pain_level * 0.3)`
   - This means a single noisy signal doesn't wildly shift the stored pain, but consistent strong signals do move it over time.
5. **Merge keywords:** Add any new unique keywords from the signal into the idea's keyword list (cap at 15 total keywords per idea). This keeps matching relevant as terminology evolves.

---

## Step 9: New Idea Creation (LLM Call 3)

For all signals with `match_id = null`, create new ideas. Send them in one batch:

```
For each signal below, create an idea object. Seed from the signal's extracted fields 
but expand them into a full idea:
- title: 3–7 word name (not generic, not "AI-powered X")
- description: 2–3 sentences on the problem + solution space
- mvp_scope: what you'd build in 2 weeks
- tags: 2–4 domain tags
- why_now: one sentence on timing
- keywords: 3–8 specific lowercase keywords
- initial_pain: 0–10 (use the signal's pain_level as anchor)
- initial_novelty: 0–10 (how rare is this problem being solved well?)
- initial_buildability: 0–10 (can one person build the MVP with standard tools?)

Return a JSON array. No preamble. No markdown.
```

Validate per-element. Failed elements are logged and skipped. Successfully validated ideas are inserted into `ideas` table with `prompt_version` from config.

---

## Step 10: Scoring Engine

Every active idea is scored each run. All math. No LLM.

### Input Sources

| Input | Source | How Updated |
|---|---|---|
| `pain` | LLM (creation), then rolling avg on merge | Updated on each signal merge |
| `novelty` | LLM (creation) | Set once; user can override via CLI |
| `buildability` | LLM (creation) | Set once; user can override via CLI |
| `signal_frequency_score` | Deterministic (90-day window) | Computed fresh each run |
| `timeliness` | Deterministic (days since last signal) | Computed fresh each run |
| `openness` | GitHub API (weekly cache) | Refreshed weekly, cached in SQLite |

### Formula

```
signal_frequency_score = min(recent_90day_count / 10, 1) * 10

timeliness = 10 * e^(-days_since_last_signal / 30)

openness = 10 - saturation   (saturation from GitHub cache)

score = (pain             * 0.25)
      + (signal_freq_score * 0.20)
      + (novelty           * 0.20)
      + (timeliness        * 0.15)
      + (buildability      * 0.10)
      + (openness          * 0.10)
```

**Weights sum to exactly 1.00. Score range is exactly 0–10.**

### Why each change from V2:

**signal_frequency_score on 90-day rolling window:** An idea with 10 signals from 6 months ago and nothing since is not a hot opportunity. The window lets frequency decay naturally as signals age out, without a separate timeliness calculation fighting it.

**openness instead of subtracting saturation:** Converting saturation into a positive input (openness = 10 - saturation) lets the weights sum cleanly to 1.0 and produces a true 0–10 score. The math is identical in effect — a saturated market still hurts the score — but the formula is correct.

**Timeliness half-life of 30 days:** The original 14 days penalized any idea that didn't get a signal in two weeks. Many genuine problems appear in slow, steady patterns — weekly complaints, not viral explosions. 30 days gives slow-burn ideas fair representation while still decaying stale ones.

### Stability Threshold

```
Replace Top 10 entry only if:
new_score > current_min_top10_score + 0.5
```

On a true 0–10 scale, 0.5 is meaningful. Prevents daily reshuffling from near-identical scores while allowing real movement.

### User Score Override

If `user_score` is set, it replaces `score` in rankings. The `computed_score` is still calculated each run (for your records) but is not used for ranking that idea. Ideas with `user_score` set are excluded from the archive pass — you explicitly chose to keep them.

---

## Step 11: Saturation Refresh (Weekly, Cached)

Saturation does not run every day. It runs once per week.

Each idea stores `saturation` and `saturation_updated_at` in SQLite. At the start of the scoring step, check: if `saturation_updated_at` is older than 7 days, queue that idea for a refresh.

**GitHub Search query format:** Instead of bare keywords, search by description to reduce false positives:

```
{keyword1} {keyword2} in:description
```

This returns repos where the keywords appear in the repo description, not just the name or README. Dramatically reduces noise (educational repos, unrelated tools with common words in filenames).

**Rate limiting:** With 50 active ideas and weekly refreshes, worst case is 50 requests in one run — fine at 30 req/min (takes ~2 minutes). Requests are made with a 2-second sleep between each. If rate limited (429 response), skip remaining ideas for this run and use cached values.

**Saturation cap changed to 100 repos.** Any idea with common vocabulary (devtools, APIs, productivity) can easily have 50 unrelated repos. 100 is a more realistic ceiling.

---

## Step 12: Archive Pass

An idea is archived if ALL of:
- No new signal in 90 days (`last_signal_at < now - 90d`)
- Computed score below 4.0
- Not in Top 10
- `user_score` is null (not manually set)
- `user_status` is "active" (not "building")

Archived ideas are excluded from future scoring runs. They stay in SQLite and can be restored. The `--restore` CLI command sets `user_status` back to "active" and clears the archive flag.

---

## Step 13: Persist State

All writes happen in **one SQLite transaction**:

```python
with conn:
    # update idea scores
    # insert new signals
    # insert new ideas  
    # update source health
    # write run_log entry (digest_sent = False)
```

WAL mode ensures this is crash-safe. If the Pi loses power mid-transaction, the previous state is intact.

---

## Step 14: Output Digest

**This is not optional. Build it before anything else.**

At the start of every run, check the previous run's `digest_sent` flag. If `False`, include a "⚠️ Yesterday's digest failed to send — retrying" note in today's digest. This is your dead man's switch.

**Telegram message format** (stays under 4096 chars by design):

```
IRS Daily — 5 May 2026

TOP 10
1. Auto SDK Generator — 7.4 (↑ +0.8)
   "OpenAPI specs exist but nobody generates idiomatic clients"
   Signals (90d): 6  |  Pain: 8.2  |  Open market: high

2. ...

NEW TODAY
• Embedded config drift detector (pain: 7, domain: infra)

MOVERS
↑ #14 → #9: Real-time DB schema diffing tool
↓ #7 → #11: AI email summarizer (saturation updated: 94 repos)

SOURCES
✓ Reddit  ✓ HN  ✓ GitHub
✗ RSS (techcrunch.com) — DISABLED after 3 failures. Re-enable: --enable-source rss_techcrunch

Run: 43 new signals, 18 filtered, 25 processed. ~$0.009. 
```

**Message splitting:** If total length exceeds 4096 characters, send as 2 messages. Split at a natural boundary (after Top 10, before New Today).

**If Telegram send fails:**
- Retry once after 30 seconds
- If still failing: write the digest to `/idea-radar/logs/digest_YYYYMMDD.txt` as plaintext fallback
- Set `digest_sent = False` in run_log (triggers retry message on next run)
- **Do not crash the whole run** because Telegram is down

---

# DATA MODEL

## SQLite Schema

```sql
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE ideas (
  id                  TEXT PRIMARY KEY,   -- UUID
  title               TEXT NOT NULL,
  description         TEXT,
  mvp_scope           TEXT,
  tags                TEXT,               -- JSON array
  keywords            TEXT,               -- JSON array (updated on signal merge)
  why_now             TEXT,

  -- LLM-set at creation, pain updated on signal merge
  pain                REAL DEFAULT 0,
  novelty             REAL DEFAULT 0,
  buildability        REAL DEFAULT 0,

  -- Computed each run
  saturation          REAL DEFAULT 5,     -- Default mid-range until first refresh
  saturation_updated_at TEXT,
  computed_score      REAL DEFAULT 0,
  signal_count        INTEGER DEFAULT 0,
  recent_signal_count INTEGER DEFAULT 0,  -- Signals in last 90 days, updated each run

  -- User control
  user_score          REAL,               -- NULL = no override
  user_status         TEXT DEFAULT 'active',  -- active | dismissed | building | archived

  -- Versioning
  prompt_version      TEXT,

  created_at          TEXT NOT NULL,
  updated_at          TEXT NOT NULL,
  last_signal_at      TEXT
);

CREATE TABLE signals (
  id          TEXT PRIMARY KEY,
  idea_id     TEXT REFERENCES ideas(id),
  hash        TEXT NOT NULL,
  source      TEXT NOT NULL,
  text        TEXT,
  url         TEXT,
  pain_level  REAL,
  domain      TEXT,
  keywords    TEXT,   -- JSON array from compression step
  timestamp   TEXT NOT NULL
);

CREATE TABLE seen_hashes (
  hash        TEXT PRIMARY KEY,
  first_seen  TEXT NOT NULL
);

CREATE TABLE source_config (
  source_id       TEXT PRIMARY KEY,   -- e.g. "reddit_r_entrepreneur"
  enabled         INTEGER DEFAULT 1,  -- 0 = auto-disabled
  consecutive_failures INTEGER DEFAULT 0,
  last_success    TEXT,
  disabled_at     TEXT
);

CREATE TABLE run_log (
  run_id              TEXT PRIMARY KEY,
  timestamp           TEXT NOT NULL,
  signals_fetched     INTEGER DEFAULT 0,
  signals_filtered    INTEGER DEFAULT 0,
  signals_deduped     INTEGER DEFAULT 0,
  signals_processed   INTEGER DEFAULT 0,
  ideas_created       INTEGER DEFAULT 0,
  ideas_archived      INTEGER DEFAULT 0,
  ideas_matched       INTEGER DEFAULT 0,
  tokens_used         INTEGER DEFAULT 0,
  estimated_cost_usd  REAL DEFAULT 0,
  llm_failures        TEXT,           -- JSON: which calls failed
  top10_changes       TEXT,           -- JSON: entries/exits
  digest_sent         INTEGER DEFAULT 0,  -- 0 = not sent, 1 = sent
  digest_path         TEXT            -- set if fallback to local file
);
```

---

# STORAGE

```
/idea-radar/
  idea_radar.db          # SQLite — all state
  idea_radar.db.backup   # Daily copy (simple cp cron, not rsync)
  .env                   # API keys + Telegram token + chat ID
  config.py              # Weights, caps, budget, prompt version, display TZ
  main.py
  requirements.txt
  /logs/
    run_YYYYMMDD.log     # Plain text run logs (auto-delete after 30 days)
    digest_YYYYMMDD.txt  # Fallback digests when Telegram fails
```

**Backup:** A second daily cron entry:
```cron
0 10 * * * cp /idea-radar/idea_radar.db /idea-radar/idea_radar.db.backup
```

That's it. No rsync, no git. Simple copy, runs 2 hours after the main job.

**Timezone:** All timestamps stored as UTC. `config.py` has `DISPLAY_TZ = "Asia/Kuala_Lumpur"` (or wherever you are). Digest dates are formatted in display timezone.

---

# USER FEEDBACK (CLI)

```bash
# See current Top 10 with scores
python main.py --top10

# Dismiss an idea (signals that match it in future → create new idea)
python main.py --dismiss <idea_id>

# Override ranking score (removes idea from archive eligibility)
python main.py --set-score <idea_id> 9.5

# Mark as "I'm building this" (pins to Top 10, used as context in matching)
python main.py --building <idea_id>

# Restore an archived idea
python main.py --restore <idea_id>

# Manually override novelty or buildability (update LLM-set values)
python main.py --set-field <idea_id> novelty 8

# Re-enable a disabled source
python main.py --enable-source <source_id>

# View recent run logs
python main.py --log

# View full idea details
python main.py --idea <idea_id>
```

The `--review` interactive mode (suggested by Kimi) is a good future addition. For MVP, explicit commands are simpler to implement and debug.

---

# COST TRACKING

Per-run token counting is logged to `run_log`. The daily budget cap in V2 was set at $0.50, which is 50x the real cost and provides no useful constraint. Realistic approach:

```python
# config.py
DAILY_BUDGET_USD = 0.10   # Realistic for this system
ALERT_THRESHOLD_USD = 0.05  # If a single run exceeds this, include in digest
```

If `estimated_cost > DAILY_BUDGET_USD`:
- Skip the saturation refresh for this run (biggest optional cost)
- Log the overage to the digest

At typical usage (batch compression + matching + creation on ~50 new signals), a run costs $0.005–$0.015 with Claude Haiku or GPT-4o-mini.

---

# INTELLIGENCE DESIGN

## LLM call budget per run (maximum)

| Call | Purpose | When skipped |
|---|---|---|
| Call 1 | Batch signal compression | No new signals after dedup |
| Call 2 | Signal matching against ideas | No active ideas yet |
| Call 3 | New idea creation | All signals matched existing ideas |

Maximum 3 LLM calls per run. In practice, often 1–2.

## What is deterministic vs. LLM-generated

**Deterministic (never LLM):**
- Deduplication
- Pre-filtering
- Signal frequency score (rolling 90-day count)
- Timeliness (exponential decay formula)
- Saturation (GitHub Search API count)
- Final score calculation
- Archive logic
- Digest formatting

**LLM-generated (with validation):**
- Signal compression (problem, pain_level, keywords, domain)
- Signal-to-idea matching
- New idea creation (title, description, MVP scope, initial metrics)

## Memory is permanent

Ideas are never deleted — they move to `archived` status. Archived ideas stay in SQLite, remain queryable via CLI, and can be restored. The active idea pool stays bounded (target: under 100 active ideas) while all historical context is preserved.

---

# RASPBERRY PI ROLE (ACCURATE)

The Pi Zero W runs:
- A Python process that makes HTTP calls to 4–5 external APIs
- Reads/writes a single small SQLite file
- Triggers 2–3 LLM API calls (remote, not local)

What it does not do:
- Local LLM inference
- Local embedding models
- Parallel compute

**Realistic runtime:** 5–15 minutes per daily run (mostly waiting on API responses). SD card I/O for SQLite at this scale is not a bottleneck. The main risk is SD card wear over years — the daily backup cron mitigates data loss, not hardware failure. If the Pi Zero W dies, the database is in the backup and the system runs identically on any other hardware.

**Alternative with zero hardware:** GitHub Actions scheduled workflow (free tier). The codebase runs identically. You lose the "always on" local device but gain reliability.

---

# WHAT TO BUILD FIRST

In this exact order — each step proves the next one is worth building:

1. **SQLite schema + WAL init** — the foundation
2. **Telegram digest** (hardcode a fake Top 10) — proves you'll actually read it
3. **HN collector** — simplest API, no auth, get the full pipeline working end-to-end on one source
4. **Dedup + pre-filter** — before adding more sources
5. **Batch LLM compression** — with per-element validation
6. **New idea creation** — from unmatched signals
7. **Scoring engine** — deterministic math on existing fields
8. **CLI: `--top10` and `--dismiss`** — first feedback tools
9. **Add Reddit** — requires OAuth setup, second source
10. **Signal matching LLM call** — once you have ideas to match against
11. **Add Stack Overflow** — no auth, easy win, high signal quality
12. **Add IndieHackers RSS** — no auth, feedparser, low friction
13. **Add GitHub Issues keyword search** — same token as saturation, add last since it needs query tuning
14. **Add GitHub Trending + RSS feeds** — lowest priority, add if you want more volume
15. **Saturation: weekly GitHub refresh** — last; optional in MVP

---

# FINAL REALITY CHECK

The success of this system depends on two things, in order:

**1. You actually read the digest.** If the output doesn't reach you where you check things, the system does not exist. Build the Telegram bot first. Everything else is secondary.

**2. Signal quality > algorithm sophistication.** Curate your subreddits and feeds carefully. A precise scoring formula on low-quality signals produces precisely wrong rankings.
