from __future__ import annotations

from pathlib import Path

import pytest

from evaluation import (
    compare_rankings,
    load_fixture_bundle,
    load_search_results,
    normalize_job_ids,
    save_search_results,
)


def test_load_standard_fixture_bundle():
    bundle = load_fixture_bundle("insurance_claims_realistic")

    assert bundle["cv_profile"]["id"] == bundle["expected_ranking"]["profile_id"]
    assert len(bundle["jobs"]) == 18
    assert len(bundle["expected_ranking"]["expected_top_job_ids"]) == 10


def test_normalize_job_ids_handles_search_jobs_response_payload():
    payload = {
        "jobs": [
            {
                "id": 1,
                "title": "Claims Specialist",
                "company": "Example Insurance",
                "location": "Lugano",
                "url": "https://www.example.invalid/jobs/claims-specialist/"
            },
            {
                "id": "job_policy_admin",
                "title": "Policy Admin",
                "company": "Example Insurance",
                "location": "Zurigo"
            },
            {
                "eval_id": "manual_eval_id",
                "id": 3,
                "url": "https://www.example.invalid/jobs/manual/"
            }
        ]
    }

    assert normalize_job_ids(payload) == [
        "https://example.invalid/jobs/claims-specialist",
        "job_policy_admin",
        "manual_eval_id"
    ]


def test_normalize_job_ids_handles_nested_client_export_payload():
    payload = {
        "data": {
            "jobs": [
                {
                    "id": 1,
                    "title": "Claims Specialist",
                    "company": "Example Insurance",
                    "location": "Lugano",
                    "url": "https://www.example.invalid/jobs/claims-specialist/"
                }
            ]
        },
        "error": None
    }

    assert normalize_job_ids(payload) == ["https://example.invalid/jobs/claims-specialist"]


def test_compare_realistic_search_jobs_ranking_precision():
    bundle = load_fixture_bundle("insurance_claims_realistic")

    report = compare_rankings(
        bundle["jobs"],
        bundle["expected_ranking"],
        ks=(5, 10)
    )
    metrics = report["metrics"]

    assert metrics["precision_at_5"] == pytest.approx(0.8)
    assert metrics["precision_at_10"] == pytest.approx(0.7)
    assert metrics["precision_at_5"] >= bundle["expected_ranking"]["minimum_precision_at_k"]["5"]
    assert metrics["precision_at_10"] >= bundle["expected_ranking"]["minimum_precision_at_k"]["10"]
    assert 0.0 < metrics["ndcg_at_10"] <= 1.0


def test_save_and_load_search_results(tmp_path: Path):
    payload = {
        "jobs": [
            {
                "id": 1,
                "title": "Claims Specialist",
                "company": "Example Insurance",
                "location": "Lugano",
                "url": "https://example.invalid/jobs/claims-specialist"
            }
        ],
        "summary": "Fixture copied from a search-jobs response"
    }

    saved_path = save_search_results(payload, tmp_path)
    loaded_payload = load_search_results(tmp_path)

    assert saved_path == tmp_path / "jobs.json"
    assert loaded_payload == payload
    assert normalize_job_ids(loaded_payload) == ["https://example.invalid/jobs/claims-specialist"]
