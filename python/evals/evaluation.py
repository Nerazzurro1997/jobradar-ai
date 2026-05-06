"""Helpers for comparing saved JobRadar AI rankings with expected rankings."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import Any

from metrics import mean_reciprocal_rank, ndcg_at_k, precision_at_k, recall_at_k


EVALS_DIR = Path(__file__).resolve().parent
FIXTURES_DIR = EVALS_DIR / "fixtures"


def load_fixture_bundle(bundle_name_or_path: str | Path) -> dict[str, Any]:
    """Load a standard eval bundle with cv_profile, jobs, and expected_ranking."""
    bundle_path = Path(bundle_name_or_path)
    if not bundle_path.is_absolute():
        bundle_path = FIXTURES_DIR / bundle_path

    cv_profile = _load_json(bundle_path / "cv_profile.json")
    jobs_payload = load_search_results(bundle_path)
    expected_ranking = _load_json(bundle_path / "expected_ranking.json")

    return {
        "name": bundle_path.name,
        "path": bundle_path,
        "cv_profile": cv_profile,
        "jobs": _extract_jobs(jobs_payload),
        "jobs_payload": jobs_payload,
        "expected_ranking": expected_ranking,
    }


def load_search_results(bundle_name_or_path: str | Path) -> Any:
    """Load saved search-jobs JSON from a fixture bundle or direct JSON file path."""
    path = Path(bundle_name_or_path)
    if not path.is_absolute() and not path.exists() and path.suffix != ".json":
        path = FIXTURES_DIR / path
    if path.is_dir():
        path = path / "jobs.json"
    return _load_json(path)


def save_search_results(
    search_results: Any,
    bundle_name_or_path: str | Path,
    filename: str = "jobs.json",
) -> Path:
    """Save a real search-jobs JSON payload into a fixture bundle."""
    bundle_path = Path(bundle_name_or_path)
    if not bundle_path.is_absolute():
        bundle_path = FIXTURES_DIR / bundle_path

    bundle_path.mkdir(parents=True, exist_ok=True)
    output_path = bundle_path / filename
    with output_path.open("w", encoding="utf-8") as json_file:
        json.dump(search_results, json_file, ensure_ascii=True, indent=2)
        json_file.write("\n")

    return output_path


def normalize_job_ids(jobs_or_ids: Sequence[Any] | Mapping[str, Any]) -> list[str]:
    """Normalize a ranked jobs payload into comparable stable string ids."""
    jobs = _extract_jobs(jobs_or_ids)
    return [_normalize_job_id(job) for job in jobs]


def compare_rankings(
    actual_jobs_or_ids: Sequence[Any] | Mapping[str, Any],
    expected_ranking: Mapping[str, Any],
    ks: Sequence[int] = (5, 10),
) -> dict[str, Any]:
    """Compare an actual ranking against the expected relevant job ids."""
    actual_ranking = normalize_job_ids(actual_jobs_or_ids)
    relevant_ids = normalize_job_ids(
        expected_ranking.get("relevant_job_ids")
        or expected_ranking.get("expected_top_job_ids")
        or expected_ranking.get("ideal_ranking")
        or []
    )
    expected_top_ranking = normalize_job_ids(
        expected_ranking.get("expected_top_job_ids")
        or expected_ranking.get("ideal_ranking")
        or expected_ranking.get("relevant_job_ids")
        or []
    )
    graded_relevance = _normalize_relevance_mapping(expected_ranking.get("graded_relevance", {}))

    metrics: dict[str, float] = {}
    for k in ks:
        metrics[f"precision_at_{k}"] = precision_at_k(actual_ranking, relevant_ids, k)
        metrics[f"recall_at_{k}"] = recall_at_k(actual_ranking, relevant_ids, k)
        if graded_relevance:
            metrics[f"ndcg_at_{k}"] = ndcg_at_k(actual_ranking, graded_relevance, k)

    metrics["mean_reciprocal_rank"] = mean_reciprocal_rank([actual_ranking], [relevant_ids])

    return {
        "actual_ranking": actual_ranking,
        "expected_top_ranking": expected_top_ranking,
        "expected_relevant_ids": relevant_ids,
        "metrics": metrics,
    }


def _load_json(path: Path) -> Any:
    if not path.exists():
        raise FileNotFoundError(f"Missing fixture file: {path}")
    with path.open(encoding="utf-8") as json_file:
        return json.load(json_file)


def _extract_jobs(payload: Sequence[Any] | Mapping[str, Any]) -> Sequence[Any]:
    if isinstance(payload, Mapping):
        for key in ("jobs", "results", "data"):
            value = payload.get(key)
            if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
                return value
            if isinstance(value, Mapping):
                return _extract_jobs(value)
        raise ValueError("Expected a jobs array or an object with jobs/results/data")
    return payload


def _normalize_job_id(job_or_id: Any) -> str:
    if isinstance(job_or_id, Mapping):
        explicit_id = job_or_id.get("eval_id") or job_or_id.get("job_id") or job_or_id.get("jobId")
        if explicit_id:
            return str(explicit_id).strip()

        raw_id = job_or_id.get("id")
        if raw_id and not str(raw_id).isdigit():
            return str(raw_id).strip()

        url = job_or_id.get("url")
        if url:
            return _normalize_url(str(url))

        if raw_id:
            return str(raw_id).strip()

        parts = [job_or_id.get("title"), job_or_id.get("company"), job_or_id.get("location")]
        fallback = "|".join(str(part or "").strip().lower() for part in parts)
        if fallback.strip("|"):
            return fallback
        raise ValueError(f"Cannot normalize job id from item: {job_or_id}")

    normalized = str(job_or_id).strip()
    if not normalized:
        raise ValueError("Job id cannot be empty")
    if normalized.startswith(("http://", "https://")):
        return _normalize_url(normalized)
    return normalized


def _normalize_url(url: str) -> str:
    return url.strip().rstrip("/").replace("https://www.", "https://")


def _normalize_relevance_mapping(relevance: Mapping[str, Any]) -> dict[str, float]:
    return {normalize_job_ids([job_id])[0]: float(score) for job_id, score in relevance.items()}
