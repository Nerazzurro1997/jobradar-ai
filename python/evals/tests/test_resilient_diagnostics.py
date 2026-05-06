from __future__ import annotations

from diagnostics import (
    build_scoring_breakdown,
    build_scoring_report,
    compare_domain_alignment,
    compare_task_alignment,
    normalize_optional_collection,
    safe_dict,
    safe_list,
    safe_set,
)
from filter_model import FILTER_NAMES, build_filter_strategy


def test_safe_normalization_helpers_tolerate_none_and_scalars():
    assert normalize_optional_collection(None) == []
    assert safe_list(None) == []
    assert safe_list("IT") == ["IT"]
    assert safe_set(None) == set()
    assert safe_set(["IT", None, ""]) == {"IT"}
    assert safe_dict(None) == {}
    assert safe_dict({"target_domains": None}) == {"target_domains": None}


def test_compare_domain_alignment_handles_missing_primary_target_domains():
    alignment = compare_domain_alignment(
        {
            "target_domains": None,
            "primary_target_domains": None,
            "acceptable_domains": None,
            "weak_fit_domains": None,
            "avoid_domains": None,
            "clear_target_domain": False,
        },
        {
            "detected_domains": ["banking"],
            "primary_domains": None,
            "primary_domain": "banking",
        },
    )

    assert alignment["domain_alignment_score"] == 0.45
    assert alignment["alignment_type"] == "soft_mismatch_unclear_cv_domain"
    assert alignment["matching_domains"] == []


def test_compare_task_alignment_handles_missing_task_profile():
    alignment = compare_task_alignment(
        {
            "target_tasks": None,
            "primary_target_tasks": None,
            "acceptable_tasks": None,
            "weak_fit_tasks": None,
            "avoid_tasks": None,
            "clear_target_tasks": False,
        },
        {
            "detected_tasks": ["marketing"],
            "primary_tasks": None,
            "task_specificity_score": None,
        },
    )

    assert alignment["task_alignment_score"] == 0.45
    assert alignment["alignment_type"] == "soft_task_mismatch_unclear_cv_tasks"
    assert alignment["matching_tasks"] == []


def test_scoring_breakdown_handles_incomplete_cv_and_partial_job_data():
    incomplete_cv = {
        "id": "partial_cv",
        "targetDomains": None,
        "targetRoles": None,
        "skills": None,
        "avoidKeywords": None,
    }
    partial_job = {
        "title": "Operations Assistant",
        "company": None,
        "snippet": None,
        "matchedKeywords": None,
    }

    breakdown = build_scoring_breakdown(partial_job, incomplete_cv)

    assert breakdown["job_id"] == "operations assistant"
    assert breakdown["cv_domains"]["target_domains"] == []
    assert breakdown["cv_tasks"]["target_tasks"] == []
    assert breakdown["domain_alignment"]["alignment_type"] in {
        "soft_mismatch_unclear_cv_domain",
        "unknown_job_domain",
        "generic_overlap_only",
    }
    assert "weighted_total" in breakdown


def test_filter_model_marks_empty_cv_filters_as_missing():
    strategy = build_filter_strategy({})
    filters = strategy["filters"]

    assert set(FILTER_NAMES) <= set(filters)
    assert filters["target_domains"]["value"] == []
    assert isinstance(filters["target_domains"]["value"], list)
    assert all(filters[name]["status"] == "missing" for name in FILTER_NAMES)
    assert set(strategy["missing_filter_information"]) == set(FILTER_NAMES)
    assert len(strategy["search_strategy"]) == 4
    assert strategy["search_strategy"][0]["filters"]["roles"] == ["missing"]


def test_filter_model_target_domains_value_is_list_for_incomplete_cv():
    strategy = build_filter_strategy({"id": "unknown", "targetDomains": None, "skills": None})

    assert strategy["filters"]["target_domains"]["value"] == []
    assert strategy["filters"]["target_domains"]["status"] == "missing"


def test_filter_model_detects_healthcare_from_cv_text_without_domain_defaults():
    strategy = build_filter_strategy(
        {
            "id": "healthcare_text_only",
            "profileSummary": "Pflege patient care medical coordination in a clinical team.",
            "targetRoles": ["Care Coordinator"],
        }
    )

    assert strategy["filters"]["target_domains"]["value"] == ["healthcare"]
    assert strategy["filters"]["target_domains"]["status"] == "detected"


def test_scoring_report_handles_missing_expected_ranking_and_partial_jobs():
    report = build_scoring_report(
        jobs=[
            {},
            {"title": "Customer Support", "matchedKeywords": None},
        ],
        cv_profile={
            "id": "partial_cv",
            "profileSummary": None,
            "matching": {"bestFitRoles": None},
        },
        expected_ranking={},
    )

    assert len(report["jobs"]) == 2
    assert report["jobs"][0]["job_id"] == "unknown_job"
    assert report["cv_domains"]["clear_target_domain"] is False
    assert report["cv_tasks"]["clear_target_tasks"] is False
