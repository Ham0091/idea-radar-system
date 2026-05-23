import json
import os
import time
from typing import Any, Dict, List, Tuple

import requests

import config
from models import CompressedSignal, MatchResult, NewIdea, RawSignal
from utils import safe_json_loads

DOMAIN_CHOICES = {"devtools", "productivity", "infra", "data", "consumer", "b2b", "other"}


class LLMClient:
    def __init__(self, api_key: str, logger):
        if not api_key:
            raise ValueError("Missing LLM API key")
        self.api_key = api_key
        self.logger = logger
        self.base_url = config.LLM_BASE_URL
        self.model = config.LLM_MODEL

    def _post(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        url = f"{self.base_url.rstrip('/')}/chat/completions"
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        self.logger.info("LLM request → %s using model %s", self.base_url, self.model)
        response = requests.post(
            url,
            headers=headers,
            json=payload,
            timeout=config.LLM_TIMEOUT_SECONDS,
        )
        if response.status_code >= 400:
            raise RuntimeError(f"LLM request failed: {response.status_code} {response.text}")
        return response.json()

    def call_json(self, prompt: str, payload: Any) -> Tuple[Any, Dict[str, Any]]:
        message = f"{prompt}\n\nINPUT:\n{json.dumps(payload, ensure_ascii=True)}"
        messages = [{"role": "user", "content": message}]
        request_body = {
            "model": self.model,
            "messages": messages,
            "temperature": 0.2,
        }

        retries = config.LLM_MAX_RETRIES
        backoffs = config.LLM_RETRY_BACKOFF_SECONDS

        for attempt in range(retries + 1):
            try:
                response = self._post(request_body)
                message = response["choices"][0]["message"]
                content = message.get("content") or ""
                # Fallback to reasoning_content if content is empty (reasoning models)
                if not content.strip() and message.get("reasoning_content"):
                    content = message["reasoning_content"]
                self.logger.info("Raw LLM response: %s", content)
                return safe_json_loads(content), response.get("usage", {})
            except Exception as exc:
                if attempt >= retries:
                    raise
                wait = backoffs[min(attempt, len(backoffs) - 1)]
                self.logger.warning("LLM call failed, retrying in %ss: %s", wait, exc)
                time.sleep(wait)

        raise RuntimeError("LLM call failed after retries")


def compress_signals(
    client: LLMClient, signals: List[RawSignal], batch_size: int = 5
) -> Tuple[List[CompressedSignal], int, Dict[str, Any]]:
    if not signals:
        return [], 0, {}

    prompt = (
        "You are a signal analyst. For each signal below, extract:\n"
        "- problem: one sentence, what frustration or gap is expressed\n"
        "- pain_level: integer 0-10\n"
        " (0 = minor annoyance, 5 = significant friction blocking work,\n"
        " 10 = critical/costly problem complained about by many people)\n"
        "- domain: one of [devtools, productivity, infra, data, consumer, b2b, other]\n"
        "- implicit_need: one phrase -- what someone would build to solve this\n"
        "- keywords: 3-8 lowercase keywords, specific (not generic like \"tool\" or \"app\")\n"
        "Return ONLY a JSON array, one object per signal, in the same order.\n"
        "No preamble, no markdown, no extra fields."
    )

    all_compressed: List[CompressedSignal] = []
    total_invalid = 0
    total_usage: Dict[str, Any] = {}

    for batch_start in range(0, len(signals), batch_size):
        batch = signals[batch_start : batch_start + batch_size]
        payload = [signal.text for signal in batch]
        data, usage = client.call_json(prompt, payload)

        for k, v in usage.items():
            if isinstance(v, (int, float)):
                total_usage[k] = total_usage.get(k, 0) + v
            elif k not in total_usage:
                total_usage[k] = v

        if not isinstance(data, list):
            total_invalid += len(batch)
            continue

        for idx, item in enumerate(data[: len(batch)]):
            signal_idx = batch_start + idx
            if not isinstance(item, dict):
                total_invalid += 1
                continue
            problem = item.get("problem")
            pain_level = item.get("pain_level")
            domain = item.get("domain")
            implicit_need = item.get("implicit_need")
            keywords = item.get("keywords")
            if not problem or not implicit_need or not isinstance(keywords, list):
                total_invalid += 1
                continue
            if isinstance(pain_level, float) and pain_level.is_integer():
                pain_level = int(pain_level)
            if not isinstance(pain_level, int) or not (0 <= pain_level <= 10):
                total_invalid += 1
                continue
            if domain not in DOMAIN_CHOICES:
                domain = "other"
            cleaned_keywords = [str(k).lower() for k in keywords if str(k).strip()]
            if not cleaned_keywords:
                total_invalid += 1
                continue
            all_compressed.append(
                CompressedSignal(
                    raw=signals[signal_idx],
                    problem=str(problem).strip(),
                    pain_level=pain_level,
                    domain=str(domain).strip(),
                    implicit_need=str(implicit_need).strip(),
                    keywords=cleaned_keywords,
                )
            )

    return all_compressed, total_invalid, total_usage


def match_signals_to_ideas(
    client: LLMClient,
    signals: List[CompressedSignal],
    ideas: List[Dict[str, Any]],
    batch_size: int = 10,
) -> Tuple[List[MatchResult], int, Dict[str, Any]]:
    if not signals or not ideas:
        return [], 0, {}

    prompt = (
        "For each signal, find the best matching idea from the list, if any.\n"
        "Return a JSON array: [{\"signal_idx\": 0, \"match_id\": \"uuid-or-null\"}]\n"
        "Match if the signal and idea describe the same underlying problem.\n"
        "When in doubt, return null -- creating a new idea is safer than a bad merge."
    )

    all_results: List[MatchResult] = []
    total_invalid = 0
    total_usage: Dict[str, Any] = {}

    for batch_start in range(0, len(signals), batch_size):
        batch = signals[batch_start : batch_start + batch_size]
        payload = {
            "signals": [
                {
                    "idx": batch_start + idx,
                    "problem": signal.problem,
                    "implicit_need": signal.implicit_need,
                    "keywords": signal.keywords,
                }
                for idx, signal in enumerate(batch)
            ],
            "ideas": ideas,
        }

        try:
            data, usage = client.call_json(prompt, payload)
        except Exception as exc:
            client.logger.warning("LLM matching batch %d-%d failed: %s", batch_start, batch_start + len(batch) - 1, exc)
            total_invalid += len(batch)
            continue

        for k, v in usage.items():
            if isinstance(v, (int, float)):
                total_usage[k] = total_usage.get(k, 0) + v
            elif k not in total_usage:
                total_usage[k] = v

        if not isinstance(data, list):
            total_invalid += len(batch)
            continue

        for item in data:
            if not isinstance(item, dict):
                total_invalid += 1
                continue
            signal_idx = item.get("signal_idx")
            match_id = item.get("match_id")
            if not isinstance(signal_idx, int):
                total_invalid += 1
                continue
            if match_id is not None and not isinstance(match_id, str):
                total_invalid += 1
                continue
            all_results.append(MatchResult(signal_index=signal_idx, match_id=match_id))

    return all_results, total_invalid, total_usage


def create_ideas(
    client: LLMClient,
    signals: List[CompressedSignal],
    batch_size: int = 5,
) -> Tuple[List[NewIdea], int, Dict[str, Any]]:
    if not signals:
        return [], 0, {}

    prompt = (
        "For each signal below, create an idea object. Seed from the signal's extracted fields\n"
        "but expand them into a full idea:\n"
        "- title: 3-7 word name (not generic, not \"AI-powered X\")\n"
        "- description: 2-3 sentences on the problem + solution space\n"
        "- mvp_scope: what you'd build in 2 weeks\n"
        "- tags: 2-4 domain tags\n"
        "- why_now: one sentence on timing\n"
        "- keywords: 3-8 specific lowercase keywords\n"
        "- initial_pain: 0-10 (use the signal's pain_level as anchor)\n"
        "- initial_novelty: 0-10 (how rare is this problem being solved well?)\n"
        "- initial_buildability: 0-10 (can one person build the MVP with standard tools?)\n"
        "Return a JSON array. No preamble. No markdown."
    )

    all_ideas: List[NewIdea] = []
    total_invalid = 0
    total_usage: Dict[str, Any] = {}

    for batch_start in range(0, len(signals), batch_size):
        batch = signals[batch_start : batch_start + batch_size]
        payload = [
            {
                "problem": signal.problem,
                "implicit_need": signal.implicit_need,
                "keywords": signal.keywords,
                "domain": signal.domain,
                "pain_level": signal.pain_level,
            }
            for signal in batch
        ]

        try:
            data, usage = client.call_json(prompt, payload)
        except Exception as exc:
            client.logger.warning("LLM idea creation batch %d-%d failed: %s", batch_start, batch_start + len(batch) - 1, exc)
            total_invalid += len(batch)
            continue

        for k, v in usage.items():
            if isinstance(v, (int, float)):
                total_usage[k] = total_usage.get(k, 0) + v
            elif k not in total_usage:
                total_usage[k] = v

        if not isinstance(data, list):
            total_invalid += len(batch)
            continue

        for item in data[: len(batch)]:
            if not isinstance(item, dict):
                total_invalid += 1
                continue
            title = item.get("title")
            description = item.get("description")
            mvp_scope = item.get("mvp_scope")
            tags = item.get("tags")
            why_now = item.get("why_now")
            keywords = item.get("keywords")
            initial_pain = item.get("initial_pain")
            initial_novelty = item.get("initial_novelty")
            initial_buildability = item.get("initial_buildability")
            if not title or not description or not mvp_scope or not why_now:
                total_invalid += 1
                continue
            if not isinstance(tags, list) or not isinstance(keywords, list):
                total_invalid += 1
                continue
            if not isinstance(initial_pain, (int, float)):
                total_invalid += 1
                continue
            if not isinstance(initial_novelty, (int, float)):
                total_invalid += 1
                continue
            if not isinstance(initial_buildability, (int, float)):
                total_invalid += 1
                continue

            all_ideas.append(
                NewIdea(
                    title=str(title).strip(),
                    description=str(description).strip(),
                    mvp_scope=str(mvp_scope).strip(),
                    tags=[str(tag).lower() for tag in tags if str(tag).strip()],
                    why_now=str(why_now).strip(),
                    keywords=[str(k).lower() for k in keywords if str(k).strip()],
                    initial_pain=float(max(0.0, min(10.0, initial_pain))),
                    initial_novelty=float(max(0.0, min(10.0, initial_novelty))),
                    initial_buildability=float(max(0.0, min(10.0, initial_buildability))),
                )
            )

    return all_ideas, total_invalid, total_usage
