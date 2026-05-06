from __future__ import annotations

import pytest

from evaluation import compare_rankings, load_fixture_bundle
from filter_model import FILTER_NAMES, build_filter_strategy
from diagnostics import build_scoring_breakdown, detect_cv_task_profile


MULTI_PROFILE_FIXTURES = [
    "it_backend_realistic",
    "retail_store_realistic",
    "marketing_content_realistic",
    "healthcare_care_realistic",
]


@pytest.mark.parametrize("fixture_name", MULTI_PROFILE_FIXTURES)
def test_multi_profile_rankings_meet_precision_thresholds(fixture_name: str):
    bundle = load_fixture_bundle(fixture_name)

    report = compare_rankings(
        bundle["jobs"],
        bundle["expected_ranking"],
        ks=(5, 10),
    )
    metrics = report["metrics"]
    thresholds = bundle["expected_ranking"]["minimum_precision_at_k"]

    assert metrics["precision_at_5"] >= thresholds["5"]
    assert metrics["precision_at_10"] >= thresholds["10"]
    assert 0.0 < metrics["ndcg_at_10"] <= 1.0


@pytest.mark.parametrize("fixture_name", MULTI_PROFILE_FIXTURES)
def test_multi_profile_sanity_checks_for_false_positives(fixture_name: str):
    bundle = load_fixture_bundle(fixture_name)
    report = compare_rankings(
        bundle["jobs"],
        bundle["expected_ranking"],
        ks=(5, 10),
    )
    actual_ranking = report["actual_ranking"]
    relevant_ids = set(bundle["expected_ranking"]["relevant_job_ids"])
    sanity_checks = bundle["expected_ranking"]["sanity_checks"]
    positions = {job_id: index for index, job_id in enumerate(actual_ranking, start=1)}

    assert actual_ranking[0] in relevant_ids
    assert sanity_checks["wrong_domain_job_id"] not in actual_ranking[:3]
    assert positions[sanity_checks["avoid_task_job_id"]] > positions[sanity_checks["task_domain_specific_job_id"]]
    assert positions[sanity_checks["generic_keyword_only_job_id"]] > positions[sanity_checks["task_domain_specific_job_id"]]


@pytest.mark.parametrize(
    ("fixture_name", "expected_domain", "expected_task"),
    [
        ("it_backend_realistic", "it", "software_development"),
        ("retail_store_realistic", "retail", "retail_sales"),
        ("marketing_content_realistic", "marketing", "marketing"),
        ("healthcare_care_realistic", "healthcare", "healthcare_care"),
    ],
)
def test_filter_strategy_detects_profile_specific_filters(
    fixture_name: str,
    expected_domain: str,
    expected_task: str,
):
    bundle = load_fixture_bundle(fixture_name)

    strategy = build_filter_strategy(bundle["cv_profile"])
    filters = strategy["filters"]

    assert set(FILTER_NAMES) <= set(filters)
    assert isinstance(filters["target_domains"]["value"], list)
    assert expected_domain in filters["target_domains"]["value"]
    assert filters["target_domains"]["status"] == "detected"
    assert expected_task in filters["target_task_groups"]["value"]
    assert filters["role_categories"]["status"] == "detected"
    assert filters["keyword_queries"]["status"] == "detected"
    assert filters["location_home_base"]["status"] == "detected"
    assert filters["salary_expectation"]["status"] == "missing"
    assert len(strategy["search_strategy"]) == 4
    assert [wave["wave"] for wave in strategy["search_strategy"]] == [1, 2, 3, 4]


@pytest.mark.parametrize("fixture_name", MULTI_PROFILE_FIXTURES)
def test_filter_strategy_marks_missing_information_without_fixed_defaults(fixture_name: str):
    bundle = load_fixture_bundle(fixture_name)

    strategy = build_filter_strategy(bundle["cv_profile"])
    filters = strategy["filters"]

    for filter_name in FILTER_NAMES:
        assert filters[filter_name]["status"] in {"detected", "missing"}
        if filters[filter_name]["status"] == "detected":
            assert filters[filter_name]["confidence"] > 0.0
            assert filters[filter_name]["evidence"]

    assert "salary_expectation" in strategy["missing_filter_information"]
    assert strategy["search_strategy"][0]["name"] == "strongest_roles_closest_locations"
    assert strategy["search_strategy"][3]["name"] == "exploratory_generic_only_if_needed"


@pytest.mark.parametrize(
    ("fixture_name", "expected_core_task"),
    [
        ("it_backend_realistic", "software_development"),
        ("retail_store_realistic", "retail_sales"),
        ("marketing_content_realistic", "marketing"),
        ("healthcare_care_realistic", "healthcare_care"),
    ],
)
def test_each_fixture_exposes_task_importance_hierarchy(
    fixture_name: str,
    expected_core_task: str,
):
    bundle = load_fixture_bundle(fixture_name)

    cv_tasks = detect_cv_task_profile(bundle["cv_profile"])

    assert expected_core_task in cv_tasks["core_tasks"]
    assert isinstance(cv_tasks["adjacent_tasks"], list)
    assert isinstance(cv_tasks["generic_tasks"], list)
    assert isinstance(cv_tasks["avoid_tasks"], list)
    assert cv_tasks["task_importance_hierarchy"]["why"]


@pytest.mark.parametrize("fixture_name", MULTI_PROFILE_FIXTURES)
def test_generic_and_avoid_jobs_have_weaker_task_importance_than_core_job(fixture_name: str):
    bundle = load_fixture_bundle(fixture_name)
    sanity_checks = bundle["expected_ranking"]["sanity_checks"]
    jobs_by_id = {job["id"]: job for job in bundle["jobs"]}

    core_breakdown = build_scoring_breakdown(
        jobs_by_id[sanity_checks["task_domain_specific_job_id"]],
        bundle["cv_profile"],
    )
    generic_breakdown = build_scoring_breakdown(
        jobs_by_id[sanity_checks["generic_keyword_only_job_id"]],
        bundle["cv_profile"],
    )
    avoid_breakdown = build_scoring_breakdown(
        jobs_by_id[sanity_checks["avoid_task_job_id"]],
        bundle["cv_profile"],
    )

    assert core_breakdown["task_alignment"]["core_task_overlap"]
    # A generic keyword-only fixture job should show leakage even when it shares
    # a broad domain/task word with the CV, because the core task evidence is weak.
    assert generic_breakdown["task_alignment"]["generic_leakage_risk"] >= 0.35
    assert generic_breakdown["task_alignment"]["task_importance_score"] < core_breakdown["task_alignment"]["task_importance_score"]
    assert avoid_breakdown["task_alignment"]["avoid_task_overlap"]
    # Avoid penalties are CV-driven: the fixture marks this job through explicit
    # avoid/deal-breaker evidence, not through a global bad-task list.
    assert avoid_breakdown["task_alignment"]["task_importance_score"] < core_breakdown["task_alignment"]["task_importance_score"]


def test_core_task_specificity_beats_same_domain_generic_healthcare_support():
    bundle = load_fixture_bundle("healthcare_care_realistic")
    jobs_by_id = {job["id"]: job for job in bundle["jobs"]}

    core_breakdown = build_scoring_breakdown(
        jobs_by_id["job_healthcare_patient_coord_geneva"],
        bundle["cv_profile"],
    )
    generic_breakdown = build_scoring_breakdown(
        jobs_by_id["job_healthcare_customer_care_generic"],
        bundle["cv_profile"],
    )

    # Both jobs are healthcare-adjacent, but only the first has concrete patient
    # care/case-management depth; hotline/support overlap must not tie it.
    assert core_breakdown["task_alignment"]["task_specificity_score"] > generic_breakdown["task_alignment"]["task_specificity_score"]
    assert core_breakdown["task_alignment"]["task_importance_score"] > generic_breakdown["task_alignment"]["task_importance_score"]
    assert generic_breakdown["task_alignment"]["generic_leakage_risk"] >= 0.35


def test_healthcare_filter_strategy_reads_healthcare_cv_evidence():
    bundle = load_fixture_bundle("healthcare_care_realistic")

    strategy = build_filter_strategy(bundle["cv_profile"])
    target_domains = strategy["filters"]["target_domains"]

    assert target_domains["value"] == ["healthcare"]
    assert target_domains["status"] == "detected"
    assert target_domains["confidence"] > 0.0
    assert target_domains["evidence"]
