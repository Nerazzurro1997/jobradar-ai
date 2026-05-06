from __future__ import annotations

import json
from pathlib import Path

import pytest

from metrics import ndcg_at_k, mean_reciprocal_rank, precision_at_k, recall_at_k


FIXTURES_DIR = Path(__file__).resolve().parents[1] / "fixtures"


def load_json(path: Path):
    with path.open(encoding="utf-8") as fixture_file:
        return json.load(fixture_file)


@pytest.fixture
def insurance_fixture():
    profile = load_json(FIXTURES_DIR / "cv_profiles" / "insurance_claims_specialist.json")
    jobs = load_json(FIXTURES_DIR / "jobs" / "insurance_jobs_sample.json")
    expected = load_json(FIXTURES_DIR / "expected_rankings" / "insurance_claims_specialist.json")
    return profile, jobs, expected


def test_fixture_has_expected_shape(insurance_fixture):
    profile, jobs, expected = insurance_fixture

    job_ids = {job["id"] for job in jobs}

    assert profile["id"] == expected["profile_id"]
    assert len(jobs) == 8
    assert set(expected["ideal_ranking"]) == job_ids
    assert set(expected["relevant_job_ids"]).issubset(job_ids)
    assert set(expected["graded_relevance"]).issubset(job_ids)


def test_metrics_on_manual_ideal_ranking(insurance_fixture):
    _, _, expected = insurance_fixture

    ranking = expected["ideal_ranking"]
    relevant_ids = expected["relevant_job_ids"]
    graded_relevance = expected["graded_relevance"]

    assert precision_at_k(ranking, relevant_ids, k=3) == pytest.approx(1.0)
    assert recall_at_k(ranking, relevant_ids, k=3) == pytest.approx(0.6)
    assert ndcg_at_k(ranking, graded_relevance, k=5) == pytest.approx(1.0)
    assert mean_reciprocal_rank([ranking], [relevant_ids]) == pytest.approx(1.0)


def test_metrics_handle_weaker_ranking(insurance_fixture):
    _, _, expected = insurance_fixture

    weak_ranking = [
        "job_008",
        "job_007",
        "job_005",
        "job_004",
        "job_003",
        "job_002",
        "job_006",
        "job_001"
    ]

    assert precision_at_k(weak_ranking, expected["relevant_job_ids"], k=3) == pytest.approx(0.0)
    assert recall_at_k(weak_ranking, expected["relevant_job_ids"], k=5) == pytest.approx(0.4)
    assert 0.0 < ndcg_at_k(weak_ranking, expected["graded_relevance"], k=8) < 1.0
    assert mean_reciprocal_rank([weak_ranking], [expected["relevant_job_ids"]]) == pytest.approx(0.25)


def test_mean_reciprocal_rank_validates_input_lengths():
    with pytest.raises(ValueError):
        mean_reciprocal_rank([["job_001"]], [["job_001"], ["job_002"]])
