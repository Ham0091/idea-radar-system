import os
import re
import time
from typing import List, Tuple

import feedparser
import requests

import config
from models import RawSignal, SourceResult
from utils import collapse_whitespace, strip_html, struct_time_to_iso, unix_to_iso, utc_now_iso

USER_AGENT = "idea-radar/0.1"


def configured_source_ids() -> List[str]:
    ids: List[str] = []
    for subreddit in config.REDDIT_SUBREDDITS[: config.REDDIT_MAX_SUBREDDITS]:
        ids.append(f"reddit_r_{subreddit}")
    ids.append("hn")
    if config.ENABLE_GITHUB_TRENDING:
        ids.append("github_trending")
    ids.append("github_issues")
    ids.append("stack_overflow")
    ids.append("indiehackers")
    for idx, url in enumerate(config.RSS_FEEDS[: config.RSS_MAX_FEEDS]):
        ids.append(f"rss_{_rss_id_from_url(url, idx)}")
    return ids


def collect_all_sources(
    enabled_source_ids: set[str],
    logger,
) -> Tuple[List[RawSignal], List[SourceResult]]:
    results: List[SourceResult] = []
    signals: List[RawSignal] = []

    for subreddit in config.REDDIT_SUBREDDITS[: config.REDDIT_MAX_SUBREDDITS]:
        source_id = f"reddit_r_{subreddit}"
        if source_id not in enabled_source_ids:
            results.append(SourceResult(source_id, "reddit", False, "disabled"))
            continue
        results.append(_wrap_source(source_id, "reddit", logger, lambda: _fetch_reddit(subreddit)))

    if "hn" in enabled_source_ids:
        results.append(_wrap_source("hn", "hn", logger, _fetch_hn))
    else:
        results.append(SourceResult("hn", "hn", False, "disabled"))

    if config.ENABLE_GITHUB_TRENDING:
        if "github_trending" in enabled_source_ids:
            results.append(
                _wrap_source(
                    "github_trending",
                    "github_trending",
                    logger,
                    _fetch_github_trending,
                )
            )
        else:
            results.append(SourceResult("github_trending", "github_trending", False, "disabled"))

    if "github_issues" in enabled_source_ids:
        results.append(_wrap_source("github_issues", "github_issues", logger, _fetch_github_issues))
    else:
        results.append(SourceResult("github_issues", "github_issues", False, "disabled"))

    if "stack_overflow" in enabled_source_ids:
        results.append(_wrap_source("stack_overflow", "stack_overflow", logger, _fetch_stack_overflow))
    else:
        results.append(SourceResult("stack_overflow", "stack_overflow", False, "disabled"))

    if "indiehackers" in enabled_source_ids:
        results.append(_wrap_source("indiehackers", "indiehackers", logger, _fetch_indiehackers))
    else:
        results.append(SourceResult("indiehackers", "indiehackers", False, "disabled"))

    for idx, url in enumerate(config.RSS_FEEDS[: config.RSS_MAX_FEEDS]):
        source_id = f"rss_{_rss_id_from_url(url, idx)}"
        if source_id not in enabled_source_ids:
            results.append(SourceResult(source_id, "rss", False, "disabled"))
            continue
        results.append(
            _wrap_source(
                source_id,
                "rss",
                logger,
                lambda url=url, source_id=source_id: _fetch_rss(url, source_id),
            )
        )

    for result in results:
        if result.success:
            signals.extend(result.signals)

    return signals, results


def _wrap_source(source_id: str, source_type: str, logger, fn) -> SourceResult:
    try:
        signals = fn()
        logger.info("Fetched %s signals from %s", len(signals), source_id)
        return SourceResult(source_id, source_type, True, None, signals)
    except Exception as exc:
        logger.warning("Source %s failed: %s", source_id, exc)
        return SourceResult(source_id, source_type, False, str(exc), [])


def _fetch_reddit(subreddit: str) -> List[RawSignal]:
    signals: List[RawSignal] = []

    client = _get_praw_client()
    if client:
        submissions = client.subreddit(subreddit).top(
            time_filter=config.REDDIT_TIME_FILTER,
            limit=config.REDDIT_CAP_PER_SUBREDDIT * 2,
        )
        for submission in submissions:
            text = submission.title or ""
            if submission.selftext:
                text = f"{text} -- {submission.selftext}"
            signals.append(
                RawSignal(
                    source_id=f"reddit_r_{subreddit}",
                    source_type="reddit",
                    text=text,
                    url=submission.url,
                    timestamp=unix_to_iso(int(submission.created_utc)),
                    metrics={"upvotes": submission.score},
                )
            )
    else:
        url = f"https://www.reddit.com/r/{subreddit}/top.json"
        params = {
            "t": config.REDDIT_TIME_FILTER,
            "limit": config.REDDIT_CAP_PER_SUBREDDIT * 2,
        }
        headers = {"User-Agent": USER_AGENT}
        response = requests.get(
            url,
            params=params,
            headers=headers,
            timeout=config.SOURCE_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
        for child in data.get("data", {}).get("children", []):
            post = child.get("data", {})
            title = post.get("title", "")
            selftext = post.get("selftext", "") or ""
            text = title
            if selftext:
                text = f"{title} -- {selftext}"
            signals.append(
                RawSignal(
                    source_id=f"reddit_r_{subreddit}",
                    source_type="reddit",
                    text=text,
                    url=post.get("url"),
                    timestamp=unix_to_iso(post.get("created_utc")),
                    metrics={"upvotes": post.get("score", 0)},
                )
            )

    signals.sort(key=lambda s: s.metrics.get("upvotes", 0), reverse=True)
    return signals[: config.REDDIT_CAP_PER_SUBREDDIT]


def _get_praw_client():
    try:
        import praw
    except ImportError:
        return None

    client_id = os.environ.get("REDDIT_CLIENT_ID")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET")
    user_agent = os.environ.get("REDDIT_USER_AGENT", USER_AGENT)
    if not client_id or not client_secret:
        return None

    return praw.Reddit(
        client_id=client_id,
        client_secret=client_secret,
        user_agent=user_agent,
        check_for_async=False,
    )


def _fetch_hn() -> List[RawSignal]:
    url = "https://hn.algolia.com/api/v1/search"
    params = {"tags": "story", "hitsPerPage": 100}
    if config.HN_QUERY:
        params["query"] = config.HN_QUERY
    response = requests.get(url, params=params, timeout=config.SOURCE_TIMEOUT_SECONDS)
    response.raise_for_status()
    data = response.json()

    hits = data.get("hits", [])
    signals: List[RawSignal] = []
    for hit in hits:
        title = hit.get("title") or ""
        story_text = hit.get("story_text") or ""
        text = title
        if story_text:
            text = f"{title} -- {story_text}"
        signals.append(
            RawSignal(
                source_id="hn",
                source_type="hn",
                text=text,
                url=hit.get("url"),
                timestamp=hit.get("created_at") or utc_now_iso(),
                metrics={"points": hit.get("points", 0)},
            )
        )

    signals.sort(key=lambda s: s.metrics.get("points", 0), reverse=True)
    return signals[: config.HN_CAP]


def _fetch_github_issues() -> List[RawSignal]:
    url = "https://api.github.com/search/issues"
    token = os.environ.get("GITHUB_TOKEN")
    headers = {"Accept": "application/vnd.github+json"}
    if token:
        headers["Authorization"] = f"Bearer {token}"
    headers["Accept"] = "application/vnd.github.squirrel-girl-preview+json"

    issues_by_url: dict[str, dict] = {}

    for query in config.GH_ISSUE_QUERIES:
        params = {
            "q": query,
            "sort": "reactions",
            "order": "desc",
            "per_page": config.GH_ISSUE_CAP,
        }
        response = requests.get(
            url,
            params=params,
            headers=headers,
            timeout=config.SOURCE_TIMEOUT_SECONDS,
        )
        response.raise_for_status()
        data = response.json()
        for item in data.get("items", []):
            issue_url = item.get("html_url")
            if issue_url:
                issues_by_url[issue_url] = item
        time.sleep(config.GH_ISSUE_SLEEP_SECONDS)

    issues = list(issues_by_url.values())
    issues.sort(key=lambda i: (i.get("reactions", {}) or {}).get("total_count", 0), reverse=True)
    issues = issues[: config.GH_ISSUE_CAP]

    signals: List[RawSignal] = []
    for issue in issues:
        repo_url = issue.get("repository_url", "")
        repo_name = repo_url.split("/repos/")[-1] if "/repos/" in repo_url else ""
        title = issue.get("title", "")
        body = issue.get("body", "") or ""
        text = f"{repo_name}: {title} -- {body}" if repo_name else f"{title} -- {body}"
        reactions = (issue.get("reactions", {}) or {}).get("total_count", 0)
        signals.append(
            RawSignal(
                source_id="github_issues",
                source_type="github_issues",
                text=text,
                url=issue.get("html_url"),
                timestamp=issue.get("created_at") or utc_now_iso(),
                metrics={"reactions": reactions},
            )
        )

    return signals


def _fetch_stack_overflow() -> List[RawSignal]:
    url = "https://api.stackexchange.com/2.3/questions"
    params = {
        "site": "stackoverflow",
        "order": "desc",
        "sort": "votes",
        "answered": "false",
        "filter": "withbody",
        "pagesize": config.SO_CAP,
    }
    if config.SO_TAGS:
        params["tagged"] = ";".join(config.SO_TAGS)

    response = requests.get(url, params=params, timeout=config.SOURCE_TIMEOUT_SECONDS)
    response.raise_for_status()
    data = response.json()

    signals: List[RawSignal] = []
    for item in data.get("items", []):
        title = item.get("title", "")
        body = strip_html(item.get("body", "") or "")
        body = collapse_whitespace(body)[:250]
        text = f"{title} -- {body}" if body else title
        signals.append(
            RawSignal(
                source_id="stack_overflow",
                source_type="stack_overflow",
                text=text,
                url=item.get("link"),
                timestamp=unix_to_iso(item.get("creation_date")),
                metrics={
                    "votes": item.get("score", 0),
                    "accepted": bool(item.get("accepted_answer_id")),
                },
            )
        )

    return signals


def _fetch_indiehackers() -> List[RawSignal]:
    signals: List[RawSignal] = []
    for url in config.IH_FEEDS:
        feed = feedparser.parse(url)
        for entry in feed.entries[: config.IH_CAP]:
            title = entry.get("title", "")
            summary = strip_html(entry.get("summary", "") or "")
            summary = collapse_whitespace(summary)[:500]
            text = f"{title} -- {summary}" if summary else title
            signals.append(
                RawSignal(
                    source_id="indiehackers",
                    source_type="indiehackers",
                    text=text,
                    url=entry.get("link"),
                    timestamp=struct_time_to_iso(entry.get("published_parsed")),
                    metrics={},
                )
            )
    return signals


def _fetch_rss(url: str, source_id: str) -> List[RawSignal]:
    feed = feedparser.parse(url)
    signals: List[RawSignal] = []
    for entry in feed.entries[: config.RSS_CAP]:
        title = entry.get("title", "")
        summary = strip_html(entry.get("summary", "") or "")
        summary = collapse_whitespace(summary)[:500]
        text = f"{title} -- {summary}" if summary else title
        signals.append(
            RawSignal(
                source_id=source_id,
                source_type="rss",
                text=text,
                url=entry.get("link"),
                timestamp=struct_time_to_iso(entry.get("published_parsed")),
                metrics={},
            )
        )
    return signals


def _fetch_github_trending() -> List[RawSignal]:
    url = f"https://github.com/trending?since={config.GITHUB_TRENDING_SINCE}"
    response = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=config.SOURCE_TIMEOUT_SECONDS)
    response.raise_for_status()
    html = response.text

    articles = re.findall(r"<article class=\"Box-row\".*?</article>", html, re.DOTALL)
    signals: List[RawSignal] = []

    for article in articles:
        repo_match = re.search(r"href=\"/([^/]+)/([^\"]+)\"", article)
        if not repo_match:
            continue
        owner, repo = repo_match.group(1), repo_match.group(2)
        repo_name = f"{owner}/{repo}"

        desc_match = re.search(r"<p class=\"col-9[^\"]*\">(.*?)</p>", article, re.DOTALL)
        desc = strip_html(desc_match.group(1)) if desc_match else ""
        desc = collapse_whitespace(desc)

        star_match = re.search(
            r"href=\"/[^/]+/[^/]+/stargazers\"[^>]*>\s*([0-9,]+)\s*</a>",
            article,
            re.DOTALL,
        )
        stars = int(star_match.group(1).replace(",", "")) if star_match else 0

        text = f"{repo_name} -- {desc}" if desc else repo_name
        signals.append(
            RawSignal(
                source_id="github_trending",
                source_type="github_trending",
                text=text,
                url=f"https://github.com/{repo_name}",
                timestamp=utc_now_iso(),
                metrics={"stars": stars},
            )
        )

    signals.sort(key=lambda s: s.metrics.get("stars", 0), reverse=True)
    return signals[: config.GITHUB_TRENDING_CAP]


def _rss_id_from_url(url: str, idx: int) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", url).strip("_")
    return slug or str(idx)
