from __future__ import annotations

from diagnostics import (
    build_scoring_breakdown,
    build_scoring_report,
    compare_domain_alignment,
    compare_task_alignment,
    detect_cv_domains,
    detect_cv_task_profile,
    detect_job_domains,
    detect_job_task_profile,
)
from evaluation import load_fixture_bundle


def test_build_scoring_breakdown_has_universal_domain_signals():
    bundle = load_fixture_bundle("insurance_claims_realistic")
    job = bundle["jobs"][0]

    breakdown = build_scoring_breakdown(job, bundle["cv_profile"])
    signals = {signal["name"]: signal for signal in breakdown["signals"]}

    assert set(signals) == {
        "domain_alignment",
        "task_alignment",
        "role_match",
        "keyword_match",
        "location_fit",
        "distance_fit",
        "sales_outbound_penalty",
        "generic_keyword_risk_penalty",
        "generic_task_risk_penalty",
        "low_domain_alignment_penalty",
        "avoid_task_overlap_penalty",
        "weak_detail_penalty",
    }
    assert "insurance" in breakdown["cv_domains"]["target_domains"]
    assert "insurance" in breakdown["job_domains"]["detected_domains"]
    assert "claims_handling" in breakdown["cv_tasks"]["target_tasks"]
    assert "claims_handling" in breakdown["cv_tasks"]["core_tasks"]
    assert "claims_handling" in breakdown["job_tasks"]["detected_tasks"]
    assert breakdown["domain_alignment"]["domain_alignment_score"] == 1.0
    assert breakdown["task_alignment"]["task_alignment_score"] == 1.0
    assert "claims_handling" in breakdown["task_alignment"]["core_task_overlap"]
    assert breakdown["task_alignment"]["task_importance_score"] > 0.85
    assert breakdown["task_alignment"]["generic_leakage_risk"] < 0.35
    assert breakdown["domain_alignment"]["alignment_type"] == "exact_domain_alignment"
    assert breakdown["weighted_total"] > 0


def test_domain_alignment_is_relative_to_cv_not_global_bias():
    banking_job = {
        "id": "banking_customer_advisor",
        "title": "Banking Customer Advisor",
        "company": "Example Bank",
        "location": "Zurich",
        "snippet": "Banking support for accounts, cards, payments and private clients.",
        "matchedKeywords": ["banking", "customer support", "payments"]
    }
    banking_cv = {
        "id": "banking_cv",
        "domains": ["banking"],
        "targetRoles": ["Banking Customer Advisor"],
        "strongKeywords": ["banking", "payments", "private clients"]
    }
    insurance_cv = {
        "id": "insurance_cv",
        "domains": ["insurance"],
        "targetRoles": ["Claims Specialist"],
        "strongKeywords": ["claims", "policy", "insurance"]
    }

    banking_alignment = compare_domain_alignment(
        detect_cv_domains(banking_cv),
        detect_job_domains(banking_job),
    )
    insurance_alignment = compare_domain_alignment(
        detect_cv_domains(insurance_cv),
        detect_job_domains(banking_job),
    )

    assert banking_alignment["domain_alignment_score"] == 1.0
    assert "banking" in banking_alignment["matching_domains"]
    assert banking_alignment["alignment_type"] == "exact_domain_alignment"
    assert insurance_alignment["domain_alignment_score"] < banking_alignment["domain_alignment_score"]
    assert insurance_alignment["alignment_type"] == "weak_adjacent_alignment"
    assert "banking" in insurance_alignment["adjacent_domains"]
    assert "banking" in insurance_alignment["mismatching_domains"]


def test_it_job_aligns_with_it_cv():
    it_cv = {
        "id": "it_cv",
        "targetDomains": ["IT"],
        "targetRoles": ["Backend Developer"],
        "skills": ["Python", "cloud", "SQL"]
    }
    it_job = {
        "id": "backend_python",
        "title": "Backend Python Developer",
        "company": "Cloud Systems AG",
        "location": "remote",
        "snippet": "Build backend services with Python, SQL and cloud infrastructure.",
        "matchedKeywords": ["Python", "SQL", "cloud"]
    }

    breakdown = build_scoring_breakdown(it_job, it_cv)

    assert "it" in breakdown["cv_domains"]["target_domains"]
    assert "it" in breakdown["job_domains"]["detected_domains"]
    assert breakdown["domain_alignment"]["domain_alignment_score"] == 1.0
    assert breakdown["domain_alignment"]["alignment_type"] == "exact_domain_alignment"


def test_retail_job_aligns_with_retail_cv():
    retail_cv = {
        "id": "retail_cv",
        "industries": ["retail"],
        "targetRoles": ["Store Manager"],
        "skills": ["merchandising", "store operations", "customer service"]
    }
    retail_job = {
        "id": "store_manager",
        "title": "Retail Store Manager",
        "company": "Example Shop",
        "location": "Lugano",
        "snippet": "Lead store operations, merchandising, stock planning and customer service.",
        "matchedKeywords": ["retail", "merchandising", "store operations"]
    }

    breakdown = build_scoring_breakdown(retail_job, retail_cv)

    assert "retail" in breakdown["cv_domains"]["target_domains"]
    assert "retail" in breakdown["job_domains"]["detected_domains"]
    assert breakdown["domain_alignment"]["domain_alignment_score"] == 1.0
    assert breakdown["domain_alignment"]["alignment_type"] == "exact_domain_alignment"


def test_generic_keyword_risk_detects_weak_domain_fit():
    bundle = load_fixture_bundle("insurance_claims_realistic")
    banking_job = next(job for job in bundle["jobs"] if job["id"] == "job_bank_customer_lugano")

    breakdown = build_scoring_breakdown(banking_job, bundle["cv_profile"])

    assert breakdown["domain_alignment"]["domain_alignment_score"] < 0.75
    assert breakdown["domain_alignment"]["alignment_type"] != "exact_domain_alignment"
    assert breakdown["domain_alignment"]["generic_overlap_ratio"] > 0
    assert breakdown["domain_alignment"]["generic_keyword_risk_boost"] > 0
    assert breakdown["generic_keyword_risk"]["risk_score"] > 0
    assert breakdown["weighted_contributions"]["generic_keyword_risk_penalty"] < 0
    assert breakdown["task_alignment"]["task_alignment_score"] < 0.75
    assert breakdown["task_alignment"]["generic_task_overlap_ratio"] > 0
    assert breakdown["task_alignment"]["core_task_overlap"] == []
    assert breakdown["task_alignment"]["generic_task_overlap"]
    assert breakdown["task_alignment"]["generic_leakage_risk"] > 0
    assert breakdown["task_alignment"]["generic_task_risk"]["risk_score"] > 0
    assert breakdown["weighted_contributions"]["generic_task_risk_penalty"] < 0


def test_generic_customer_support_task_is_valid_when_cv_targets_it():
    support_cv = {
        "id": "support_cv",
        "targetRoles": ["Customer Support Specialist"],
        "strongKeywords": ["customer support", "CRM", "ticketing", "communication"]
    }
    support_job = {
        "id": "support_job",
        "title": "Customer Support Specialist",
        "company": "Example Services",
        "snippet": "Customer support via CRM, ticketing, clear communication and case follow-up.",
        "matchedKeywords": ["customer support", "CRM", "ticketing", "communication"]
    }

    task_alignment = compare_task_alignment(
        detect_cv_task_profile(support_cv),
        detect_job_task_profile(support_job),
    )

    assert task_alignment["task_alignment_score"] == 1.0
    assert task_alignment["alignment_type"] == "exact_task_alignment"
    assert "customer_support" in task_alignment["core_task_overlap"]
    # Communication is intentionally still broad/supportive: a CV can target
    # customer support as core work while also sharing generic support skills.
    assert "communication" in task_alignment["generic_task_overlap"]
    assert task_alignment["generic_leakage_risk"] < 0.5
    assert task_alignment["generic_task_risk"]["risk_score"] == 0.0


def test_avoid_task_overlap_comes_from_cv_evidence():
    bundle = load_fixture_bundle("insurance_claims_realistic")
    sales_job = next(job for job in bundle["jobs"] if job["id"] == "job_sales_field_insurance")

    breakdown = build_scoring_breakdown(sales_job, bundle["cv_profile"])

    assert breakdown["task_alignment"]["avoid_task_overlap"]
    assert breakdown["task_alignment"]["generic_leakage_risk"] == 1.0
    assert breakdown["task_alignment"]["alignment_type"] == "avoid_task_overlap"
    assert breakdown["weighted_contributions"]["avoid_task_overlap_penalty"] < 0


def test_scoring_report_includes_leakage_and_weight_recommendations():
    bundle = load_fixture_bundle("insurance_claims_realistic")

    report = build_scoring_report(
        bundle["jobs"],
        bundle["cv_profile"],
        bundle["expected_ranking"],
    )

    assert report["top_comparison"][0]["actual_id"] == "job_ins_claims_lugano"
    assert len(report["weighted_contribution_report"]) == 12
    assert "leakage_report" in report
    assert "weight_recommendations" in report
    assert report["cv_domains"]["clear_target_domain"] is True
    assert report["cv_tasks"]["clear_target_tasks"] is True
    assert "jobs_ranking_high_despite_weak_task_alignment" in report["leakage_report"]
    assert "jobs_ranking_high_mainly_because_of_generic_tasks" in report["leakage_report"]
    assert "jobs_ranking_high_mostly_due_to_generic_tasks" in report["leakage_report"]
    assert "jobs_ranking_above_more_specific_core_task_jobs" in report["leakage_report"]
    assert "jobs_ranking_high_despite_avoid_task_overlap" in report["leakage_report"]
    assert "jobs_with_avoid_task_overlap_still_too_high" in report["leakage_report"]
