import argparse
import json
import os
import sys
import uuid
from datetime import datetime, timedelta, timezone

import config
import collector
import digest
import llm
import matcher
import preprocess
import scorer
import storage
from models import IdeaRecord
from utils import hash_text, json_dumps, load_env_file, setup_logger, utc_now, utc_now_iso


def main() -> int:
    load_env_file(config.BASE_DIR)
    config.DATA_DIR.mkdir(parents=True, exist_ok=True)
    config.LOG_DIR.mkdir(parents=True, exist_ok=True)

    logger = setup_logger(config.LOG_DIR)

    parser = argparse.ArgumentParser(description="Idea Radar System (V3)")
    parser.add_argument("--run", action="store_true")
    parser.add_argument("--top10", action="store_true")
    parser.add_argument("--idea", type=str)
    parser.add_argument("--dismiss", type=str)
    parser.add_argument("--restore", type=str)
    parser.add_argument("--set-score", nargs=2, metavar=("ID", "SCORE"))
    parser.add_argument("--building", type=str)
    parser.add_argument("--set-field", nargs=3, metavar=("ID", "FIELD", "VALUE"))
    parser.add_argument("--enable-source", type=str)
    parser.add_argument("--log", action="store_true")

    args = parser.parse_args()

    if args.run:
        return run_pipeline(logger)
    if args.top10:
        return show_top10(logger)
    if args.idea:
        return show_idea(args.idea)
    if args.dismiss:
        return set_status(args.dismiss, "dismissed")
    if args.restore:
        return set_status(args.restore, "active")
    if args.set_score:
        return set_score(args.set_score[0], float(args.set_score[1]))
    if args.building:
        return set_status(args.building, "building")
    if args.set_field:
        return set_field(args.set_field[0], args.set_field[1], float(args.set_field[2]))
    if args.enable_source:
        return enable_source(args.enable_source)
    if args.log:
        return show_logs()

    parser.print_help()
    return 1


def run_pipeline(logger) -> int:
    storage.init_db(str(config.DB_PATH))

    if not acquire_lock(logger):
        return 1

    run_id = str(uuid.uuid4())
    now = utc_now()
    now_iso = utc_now_iso()

    try:
        with storage.get_connection(str(config.DB_PATH)) as conn:
            last_run = storage.fetch_last_run_log(conn)
            active_ideas = storage.fetch_active_ideas(conn)
            seen_hashes = set(storage.fetch_seen_hashes(conn))
            source_configs = storage.fetch_source_configs(conn)

        prev_top10_ids, prev_scores = extract_prev_top10(last_run)
        enabled_source_ids = build_enabled_sources(source_configs)

        signals, source_results = collector.collect_all_sources(enabled_source_ids, logger)

        cleaned = [preprocess.clean_signal(signal) for signal in signals]
        deduped, new_hashes, deduped_count = preprocess.deduplicate_signals(
            cleaned, seen_hashes
        )
        filtered, filtered_count = preprocess.pre_filter_signals(deduped)

        llm_failures = []
        compressed_signals = []
        tokens_used = 0
        estimated_cost = 0.0

        ideas_by_id = {idea.id: idea for idea in active_ideas}
        new_ideas: list[IdeaRecord] = []
        signals_rows = []
        merge_updates = []
        ideas_created = 0
        ideas_matched = 0

        if filtered:
            try:
                api_key = resolve_llm_api_key()
                client = llm.LLMClient(api_key, logger)
                compressed_signals, invalid_count, usage = llm.compress_signals(
                    client, filtered
                )
                call_tokens = usage.get("total_tokens", 0)
                tokens_used += call_tokens
                estimated_cost += (call_tokens / 1000.0) * config.LLM_COST_PER_1K_TOKENS_USD
            except Exception as exc:
                logger.warning("LLM compression failed: %s", exc)
                llm_failures.append("compress_signals")
                compressed_signals = []

        if compressed_signals and "compress_signals" not in llm_failures:
            idea_summaries = [
                {"id": idea.id, "title": idea.title, "keywords": idea.keywords}
                for idea in active_ideas
            ]
            matches = []
            if idea_summaries:
                try:
                    api_key = resolve_llm_api_key()
                    client = llm.LLMClient(api_key, logger)
                    matches, invalid_count, usage = llm.match_signals_to_ideas(
                        client, compressed_signals, idea_summaries
                    )
                    call_tokens = usage.get("total_tokens", 0)
                    tokens_used += call_tokens
                    estimated_cost += (call_tokens / 1000.0) * config.LLM_COST_PER_1K_TOKENS_USD
                except Exception as exc:
                    logger.warning("LLM matching failed: %s", exc)
                    llm_failures.append("match_signals_to_ideas")

            matched, unmatched = matcher.split_matches(compressed_signals, matches, ideas_by_id)

            for idx, idea_id in matched:
                compressed = compressed_signals[idx]
                idea = ideas_by_id.get(idea_id)
                if not idea:
                    continue
                new_pain = (idea.pain * 0.7) + (compressed.pain_level * 0.3)
                keywords = list(dict.fromkeys(idea.keywords + compressed.keywords))[:15]
                idea.pain = new_pain
                idea.keywords = keywords
                idea.signal_count += 1
                idea.last_signal_at = now_iso
                merge_updates.append((idea_id, new_pain, keywords, now_iso))
                ideas_matched += 1

                signal_hash = compressed.raw.metrics.get("hash") or hash_text(
                    compressed.raw.text
                )
                signals_rows.append(
                    {
                        "id": str(uuid.uuid4()),
                        "idea_id": idea_id,
                        "hash": signal_hash,
                        "source": compressed.raw.source_id,
                        "text": compressed.raw.text,
                        "url": compressed.raw.url,
                        "pain_level": compressed.pain_level,
                        "domain": compressed.domain,
                        "keywords": json_dumps(compressed.keywords),
                        "timestamp": compressed.raw.timestamp,
                    }
                )

            if unmatched and "match_signals_to_ideas" not in llm_failures:
                try:
                    api_key = resolve_llm_api_key()
                    client = llm.LLMClient(api_key, logger)
                    new_idea_objs, invalid_count, usage = llm.create_ideas(
                        client, [compressed_signals[i] for i in unmatched]
                    )
                    call_tokens = usage.get("total_tokens", 0)
                    tokens_used += call_tokens
                    estimated_cost += (call_tokens / 1000.0) * config.LLM_COST_PER_1K_TOKENS_USD
                    for compressed, new_idea in zip(
                        [compressed_signals[i] for i in unmatched], new_idea_objs
                    ):
                        idea_id = str(uuid.uuid4())
                        idea = IdeaRecord(
                            id=idea_id,
                            title=new_idea.title,
                            description=new_idea.description,
                            mvp_scope=new_idea.mvp_scope,
                            tags=new_idea.tags,
                            keywords=new_idea.keywords,
                            why_now=new_idea.why_now,
                            pain=new_idea.initial_pain,
                            novelty=new_idea.initial_novelty,
                            buildability=new_idea.initial_buildability,
                            saturation=5.0,
                            saturation_updated_at=None,
                            computed_score=0.0,
                            signal_count=1,
                            recent_signal_count=1,
                            user_score=None,
                            user_status="active",
                            prompt_version=config.PROMPT_VERSION,
                            created_at=now_iso,
                            updated_at=now_iso,
                            last_signal_at=now_iso,
                        )
                        ideas_by_id[idea_id] = idea
                        new_ideas.append(idea)
                        ideas_created += 1
                        signal_hash = compressed.raw.metrics.get("hash") or hash_text(
                            compressed.raw.text
                        )
                        signals_rows.append(
                            {
                                "id": str(uuid.uuid4()),
                                "idea_id": idea_id,
                                "hash": signal_hash,
                                "source": compressed.raw.source_id,
                                "text": compressed.raw.text,
                                "url": compressed.raw.url,
                                "pain_level": compressed.pain_level,
                                "domain": compressed.domain,
                                "keywords": json_dumps(compressed.keywords),
                                "timestamp": compressed.raw.timestamp,
                            }
                        )
                except Exception as exc:
                    logger.warning("LLM idea creation failed: %s", exc)
                    llm_failures.append("create_ideas")

        all_ideas = list(ideas_by_id.values())

        skip_saturation = estimated_cost > config.DAILY_BUDGET_USD
        budget_note = None
        if skip_saturation:
            budget_note = (
                f"Budget exceeded: ${estimated_cost:.3f} > ${config.DAILY_BUDGET_USD:.2f}. "
                "Saturation skipped."
            )
        else:
            saturation_updates = scorer.refresh_saturation(all_ideas, logger)
            for idea in all_ideas:
                if idea.id in saturation_updates:
                    idea.saturation, idea.saturation_updated_at = saturation_updates[idea.id]

        with storage.get_connection(str(config.DB_PATH)) as conn:
            since_iso = (now - timedelta(days=config.SIGNAL_FREQUENCY_WINDOW_DAYS)).isoformat()
            recent_counts = storage.fetch_recent_signal_counts(conn, since_iso)

        for row in signals_rows:
            recent_counts[row["idea_id"]] = recent_counts.get(row["idea_id"], 0) + 1

        score_map = scorer.compute_scores(all_ideas, recent_counts, now)
        for idea in all_ideas:
            idea.computed_score = score_map.get(idea.id, {}).get("computed_score", 0.0)
            idea.recent_signal_count = score_map.get(idea.id, {}).get(
                "recent_signal_count", 0
            )

        top10 = scorer.build_top10(all_ideas, prev_top10_ids)
        top10_ids = [idea.id for idea in top10]
        archive_ids = scorer.select_archives(all_ideas, top10_ids, now)

        top10_changes = build_top10_changes(prev_top10_ids, top10_ids, top10)

        run_log_payload = {
            "run_id": run_id,
            "timestamp": now_iso,
            "signals_fetched": len(signals),
            "signals_filtered": filtered_count,
            "signals_deduped": deduped_count,
            "signals_processed": len(compressed_signals),
            "ideas_created": ideas_created,
            "ideas_archived": len(archive_ids),
            "ideas_matched": ideas_matched,
            "tokens_used": tokens_used,
            "estimated_cost_usd": estimated_cost,
            "llm_failures": json_dumps(llm_failures),
            "top10_changes": json_dumps(top10_changes),
            "digest_sent": 0,
            "digest_path": None,
        }

        digest_stats = {
            "signals_fetched": len(signals),
            "signals_filtered": filtered_count,
            "signals_processed": len(compressed_signals),
            "estimated_cost_usd": estimated_cost,
            "budget_note": budget_note,
        }

        with storage.get_connection(str(config.DB_PATH)) as conn:
            with conn:
                storage.insert_seen_hashes(conn, new_hashes, now_iso)
                for result in source_results:
                    if result.error == "disabled":
                        continue
                    storage.update_source_config(conn, result.source_id, result.success, now_iso)

                storage.insert_ideas(conn, [idea_to_row(idea) for idea in new_ideas])

                for idea_id, new_pain, keywords, last_signal_at in merge_updates:
                    storage.update_idea_on_merge(
                        conn,
                        idea_id,
                        new_pain,
                        keywords,
                        last_signal_at,
                    )

                storage.insert_signals(conn, signals_rows)

                updates = []
                for idea in all_ideas:
                    updates.append(
                        {
                            "id": idea.id,
                            "computed_score": idea.computed_score,
                            "recent_signal_count": idea.recent_signal_count,
                            "saturation": idea.saturation,
                            "saturation_updated_at": idea.saturation_updated_at,
                            "updated_at": now_iso,
                        }
                    )
                storage.update_scores(conn, updates)
                storage.archive_ideas(conn, archive_ids, now_iso)
                storage.insert_run_log(conn, run_log_payload)

        prev_failed = bool(last_run and last_run.get("digest_sent") == 0)
        digest_text = digest.format_digest(
            now_iso,
            build_top10_display(top10, prev_top10_ids, prev_scores),
            prev_failed,
            new_ideas,
            build_movers(prev_top10_ids, top10_ids, ideas_by_id),
            source_results,
            digest_stats,
        )

        sent, _ = digest.send_digest(digest_text, logger)
        digest_path = None
        if not sent:
            digest_path = digest.write_digest_fallback(digest_text, config.LOG_DIR)

        with storage.get_connection(str(config.DB_PATH)) as conn:
            with conn:
                storage.update_run_log_digest(conn, run_id, int(sent), digest_path)

        return 0
    finally:
        release_lock()


def build_enabled_sources(source_configs: dict) -> set[str]:
    enabled = set()
    for source_id in collector.configured_source_ids():
        config_row = source_configs.get(source_id)
        if config_row and config_row.get("enabled") == 0:
            continue
        enabled.add(source_id)
    return enabled


def extract_prev_top10(last_run: dict) -> tuple[list[str], dict[str, float]]:
    if not last_run or not last_run.get("top10_changes"):
        return [], {}
    try:
        data = json.loads(last_run.get("top10_changes"))
        top10_data = data.get("current_top10", [])
        if top10_data and isinstance(top10_data[0], dict):
            ids = [entry["id"] for entry in top10_data]
            scores = {entry["id"]: entry.get("score", 0.0) for entry in top10_data}
            return ids, scores
        # Backward compatibility: old format was a plain list of IDs
        return top10_data if isinstance(top10_data, list) else [], {}
    except Exception:
        return [], {}


def build_top10_changes(prev: list[str], current: list[str], top10: list[IdeaRecord]) -> dict:
    return {
        "entries": [idea_id for idea_id in current if idea_id not in prev],
        "exits": [idea_id for idea_id in prev if idea_id not in current],
        "current_top10": [
            {"id": idea.id, "score": round(scorer.ranking_score(idea), 2)}
            for idea in top10
        ],
    }


def build_movers(prev: list[str], current: list[str], ideas_by_id: dict[str, IdeaRecord]) -> list[str]:
    prev_rank = {idea_id: idx + 1 for idx, idea_id in enumerate(prev)}
    movers = []
    for idx, idea_id in enumerate(current):
        rank = idx + 1
        if idea_id not in prev_rank:
            continue
        old_rank = prev_rank[idea_id]
        if old_rank == rank:
            continue
        direction = "UP" if rank < old_rank else "DOWN"
        title = ideas_by_id[idea_id].title if idea_id in ideas_by_id else idea_id
        movers.append(f"{direction} #{old_rank} -> #{rank}: {title}")
    return movers


def build_top10_display(
    top10: list[IdeaRecord], prev: list[str], prev_scores: dict[str, float]
) -> list[dict]:
    prev_rank = {idea_id: idx + 1 for idx, idea_id in enumerate(prev)}
    items = []
    for idx, idea in enumerate(top10):
        rank = idx + 1
        prev_rank_value = prev_rank.get(idea.id)
        score = scorer.ranking_score(idea)
        prev_score = prev_scores.get(idea.id)
        score_delta = round(score - prev_score, 1) if prev_score is not None else None
        items.append(
            {
                "idea": idea,
                "rank": rank,
                "prev_rank": prev_rank_value,
                "score": score,
                "score_delta": score_delta,
            }
        )
    return items


def acquire_lock(logger) -> bool:
    lock_path = config.LOCK_PATH
    if lock_path.exists():
        age = (utc_now() - datetime.fromtimestamp(lock_path.stat().st_mtime, tz=timezone.utc)).total_seconds()
        pid_text = lock_path.read_text(encoding="utf-8").strip()
        pid = int(pid_text) if pid_text.isdigit() else None
        if pid and _pid_running(pid) and age < config.LOCK_MAX_AGE_SECONDS:
            logger.warning("Lockfile exists and process is running (%s)", pid)
            return False
        lock_path.unlink(missing_ok=True)

    lock_path.write_text(str(os.getpid()), encoding="utf-8")
    return True


def release_lock() -> None:
    config.LOCK_PATH.unlink(missing_ok=True)


def _pid_running(pid: int) -> bool:
    try:
        os.kill(pid, 0)
    except OSError:
        return False
    return True


def show_top10(logger) -> int:
    with storage.get_connection(str(config.DB_PATH)) as conn:
        ideas = storage.fetch_active_ideas(conn)
    ideas.sort(key=scorer.ranking_score, reverse=True)
    for idx, idea in enumerate(ideas[: config.TOP10_SIZE], start=1):
        logger.info("%s. %s (%s)", idx, idea.title, scorer.ranking_score(idea))
    return 0


def show_idea(idea_id: str) -> int:
    with storage.get_connection(str(config.DB_PATH)) as conn:
        idea = storage.fetch_idea(conn, idea_id)
        if not idea:
            print("Idea not found")
            return 1
        signals = storage.fetch_signals_for_idea(conn, idea_id)
    print(idea)
    print("Signals:")
    for signal in signals:
        print(f"- {signal.get('timestamp')} {signal.get('text')}")
    return 0


def set_status(idea_id: str, status: str) -> int:
    with storage.get_connection(str(config.DB_PATH)) as conn:
        with conn:
            storage.set_user_status(conn, idea_id, status)
    return 0


def set_score(idea_id: str, score: float) -> int:
    with storage.get_connection(str(config.DB_PATH)) as conn:
        with conn:
            storage.set_user_score(conn, idea_id, score)
    return 0


def set_field(idea_id: str, field: str, value: float) -> int:
    with storage.get_connection(str(config.DB_PATH)) as conn:
        with conn:
            storage.set_field(conn, idea_id, field, value)
    return 0


def enable_source(source_id: str) -> int:
    with storage.get_connection(str(config.DB_PATH)) as conn:
        with conn:
            storage.enable_source(conn, source_id)
    return 0


def show_logs() -> int:
    with storage.get_connection(str(config.DB_PATH)) as conn:
        rows = storage.fetch_run_logs(conn, 10)
    for row in rows:
        print(row)
    return 0


def idea_to_row(idea: IdeaRecord) -> dict:
    return {
        "id": idea.id,
        "title": idea.title,
        "description": idea.description,
        "mvp_scope": idea.mvp_scope,
        "tags": json_dumps(idea.tags),
        "keywords": json_dumps(idea.keywords),
        "why_now": idea.why_now,
        "pain": idea.pain,
        "novelty": idea.novelty,
        "buildability": idea.buildability,
        "saturation": idea.saturation,
        "saturation_updated_at": idea.saturation_updated_at,
        "computed_score": idea.computed_score,
        "signal_count": idea.signal_count,
        "recent_signal_count": idea.recent_signal_count,
        "user_score": idea.user_score,
        "user_status": idea.user_status,
        "prompt_version": idea.prompt_version,
        "created_at": idea.created_at,
        "updated_at": idea.updated_at,
        "last_signal_at": idea.last_signal_at,
    }


def resolve_llm_api_key() -> str:
    return os.environ.get(config.LLM_API_KEY_ENV) or os.environ.get(
        config.LLM_API_KEY_FALLBACK_ENV, ""
    )


if __name__ == "__main__":
    sys.exit(main())
