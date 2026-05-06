"""Universal explainable diagnostics for local JobRadar AI evaluations."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Iterable, Mapping, Sequence
from typing import Any

from evaluation import normalize_job_ids


SIGNAL_WEIGHTS = {
    "domain_alignment": 28.0,
    "task_alignment": 24.0,
    "role_match": 20.0,
    "keyword_match": 14.0,
    "location_fit": 10.0,
    "distance_fit": 8.0,
    "sales_outbound_penalty": -14.0,
    "generic_keyword_risk_penalty": -12.0,
    "generic_task_risk_penalty": -14.0,
    "low_domain_alignment_penalty": -18.0,
    "avoid_task_overlap_penalty": -20.0,
    "weak_detail_penalty": -8.0,
}

SIGNAL_LABELS = {
    "domain_alignment": "domain alignment",
    "task_alignment": "task alignment",
    "role_match": "role match",
    "keyword_match": "keyword match",
    "location_fit": "location fit",
    "distance_fit": "distance fit",
    "sales_outbound_penalty": "sales/outbound penalty",
    "generic_keyword_risk_penalty": "generic keyword risk penalty",
    "generic_task_risk_penalty": "generic task risk penalty",
    "low_domain_alignment_penalty": "low domain alignment penalty",
    "avoid_task_overlap_penalty": "avoid task overlap penalty",
    "weak_detail_penalty": "weak detail penalty",
}


def normalize_optional_collection(value: Any) -> list[Any]:
    """Normalize optional scalar/list/dict values into a flat list."""
    if value is None:
        return []
    if isinstance(value, bytes):
        text = value.decode("utf-8", errors="ignore").strip()
        return [text] if text else []
    if isinstance(value, str):
        text = value.strip()
        return [text] if text else []
    if isinstance(value, Mapping):
        return [value]
    if isinstance(value, Iterable):
        items = []
        for child in value:
            items.extend(normalize_optional_collection(child))
        return items
    return [value]


def safe_list(value: Any) -> list[Any]:
    """Return a list for optional collection-like values, never None."""
    return normalize_optional_collection(value)


def safe_set(value: Any) -> set[Any]:
    """Return a set for optional collection-like values, tolerating malformed items."""
    result: set[Any] = set()
    for item in safe_list(value):
        try:
            result.add(item)
        except TypeError:
            result.add(str(item))
    return result


def safe_dict(value: Any) -> dict[Any, Any]:
    """Return a shallow dict copy when value is a mapping, otherwise an empty dict."""
    return dict(value) if isinstance(value, Mapping) else {}


DOMAIN_CATALOG = {
    "administration": [
        "administration",
        "administrative",
        "admin",
        "amministrativo",
        "back office",
        "office",
        "data entry",
        "documentale",
    ],
    "banking": [
        "bank",
        "banking",
        "banca",
        "bancario",
        "wealth",
        "payments",
        "credito",
        "conti",
        "carte",
    ],
    "construction": [
        "construction",
        "building",
        "edilizia",
        "cantiere",
        "civil engineering",
        "architecture",
    ],
    "customer_support": [
        "customer support",
        "customer care",
        "supporto clienti",
        "clientela",
        "call center",
        "service desk",
        "helpdesk",
    ],
    "data_analytics": [
        "data",
        "analytics",
        "analyst",
        "business intelligence",
        "bi",
        "sql",
        "machine learning",
        "reporting",
    ],
    "education": [
        "education",
        "school",
        "teaching",
        "training",
        "formazione",
        "insegnamento",
        "universita",
    ],
    "finance": [
        "finance",
        "financial",
        "finanza",
        "accounting",
        "contabil",
        "ledger",
        "fatture",
        "audit",
        "treasury",
    ],
    "healthcare": [
        "healthcare",
        "medical",
        "medico",
        "sanita",
        "salute",
        "clinic",
        "ospedale",
        "patient",
        "nurse",
        "infermiere",
        "pharma",
    ],
    "hospitality": [
        "hospitality",
        "hotel",
        "restaurant",
        "ristorante",
        "turismo",
        "travel",
        "reception",
    ],
    "hr": [
        "hr",
        "human resources",
        "risorse umane",
        "recruiting",
        "talent",
        "people",
        "payroll",
    ],
    "insurance": [
        "insurance",
        "assicur",
        "sinistri",
        "claims",
        "claim",
        "poliz",
        "policy",
        "underwriting",
        "broker",
        "danni",
        "previdenza",
    ],
    "it": [
        "it",
        "software",
        "developer",
        "engineer",
        "cloud",
        "cybersecurity",
        "devops",
        "frontend",
        "backend",
        "typescript",
        "python",
        "technical support",
    ],
    "legal": [
        "legal",
        "legale",
        "law",
        "contenzioso",
        "contract",
        "compliance",
        "regulatory",
    ],
    "logistics": [
        "logistics",
        "logistica",
        "warehouse",
        "magazzino",
        "supply chain",
        "transport",
        "spedizioni",
        "procurement",
    ],
    "manufacturing": [
        "manufacturing",
        "production",
        "produzione",
        "factory",
        "stabilimento",
        "quality control",
        "maintenance",
    ],
    "marketing": [
        "marketing",
        "seo",
        "content",
        "brand",
        "campaign",
        "social media",
        "growth",
        "performance marketing",
    ],
    "retail": [
        "retail",
        "store",
        "shop",
        "negozio",
        "vendita al dettaglio",
        "commesso",
        "sales assistant",
        "merchandising",
    ],
    "sales": [
        "sales",
        "vendite",
        "commerciale",
        "business development",
        "account manager",
        "outbound",
        "field sales",
        "agente",
        "sdr",
        "provvigioni",
        "commission",
    ],
}

ADJACENT_DOMAIN_GROUPS = [
    {"banking", "finance", "insurance"},
    {"it", "data_analytics"},
    {"sales", "marketing", "retail"},
    {"administration", "customer_support", "hr"},
    {"logistics", "manufacturing", "retail"},
    {"healthcare", "insurance"},
    {"legal", "finance", "insurance"},
    {"education", "hr"},
    {"hospitality", "retail", "customer_support"},
]

GENERIC_FUNCTIONAL_DOMAINS = {
    "administration",
    "customer_support",
}

GENERIC_KEYWORD_TERMS = [
    "crm",
    "excel",
    "office",
    "customer support",
    "customer care",
    "supporto clienti",
    "communication",
    "team",
    "back office",
    "operations",
    "document review",
    "analisi documentale",
    "italiano",
    "tedesco",
    "francese",
    "inglese",
]

SALES_OUTBOUND_TERMS = [
    "outbound",
    "field sales",
    "porta a porta",
    "provvigioni",
    "commission",
    "acquisizione clienti",
    "agente",
    "sdr",
]

TASK_CATALOG = {
    "customer_support": [
        "customer support",
        "customer care",
        "supporto clienti",
        "clientela",
        "assistenza clienti",
        "helpdesk",
        "service desk",
        "post vendita",
        "inbound",
    ],
    "sales": [
        "sales",
        "vendite",
        "commerciale",
        "account manager",
        "business development",
        "consulente commerciale",
    ],
    "outbound_acquisition": [
        "outbound",
        "prospezione",
        "acquisizione clienti",
        "lead generation",
        "cold calling",
        "porta a porta",
        "field sales",
        "provvigioni",
        "commission",
        "sdr",
    ],
    "administration": [
        "administration",
        "admin",
        "amministrativo",
        "back office",
        "office",
        "data entry",
        "archiviazione",
        "dossier",
    ],
    "policy_administration": [
        "policy administration",
        "polizze",
        "polizza",
        "coperture",
        "contratti assicurativi",
        "rinnovi polizze",
        "modifiche contrattuali",
    ],
    "claims_handling": [
        "claims",
        "claim",
        "sinistri",
        "liquidazione sinistri",
        "gestione sinistri",
        "periti",
        "coperture sinistri",
    ],
    "software_development": [
        "software development",
        "developer",
        "sviluppo software",
        "backend",
        "frontend",
        "full stack",
        "python",
        "typescript",
        "api",
    ],
    "it_support": [
        "it support",
        "technical support",
        "supporto tecnico",
        "help desk it",
        "service desk it",
        "infrastructure",
        "cloud",
        "cybersecurity",
    ],
    "data_analysis": [
        "data analysis",
        "analytics",
        "analyst",
        "reporting",
        "business intelligence",
        "sql",
        "dashboard",
        "machine learning",
    ],
    "marketing": [
        "marketing",
        "campaign",
        "brand",
        "seo",
        "growth",
        "performance marketing",
        "social media",
    ],
    "content_creation": [
        "content",
        "copywriting",
        "editorial",
        "newsletter",
        "video",
        "creative",
        "storytelling",
    ],
    "healthcare_care": [
        "healthcare",
        "medical",
        "patient",
        "care",
        "cura",
        "sanita",
        "salute",
        "infermiere",
        "clinica",
    ],
    "case_management": [
        "case management",
        "case manager",
        "gestione casi",
        "pratiche",
        "dossier",
        "coordinamento casi",
    ],
    "retail_sales": [
        "retail",
        "store",
        "negozio",
        "sales assistant",
        "merchandising",
        "stock",
        "cassa",
        "vendita al dettaglio",
    ],
    "logistics_coordination": [
        "logistics",
        "logistica",
        "warehouse",
        "magazzino",
        "supply chain",
        "spedizioni",
        "transport",
        "procurement",
    ],
    "finance_operations": [
        "finance operations",
        "accounting",
        "contabil",
        "fatture",
        "reconciliation",
        "riconciliazioni",
        "ledger",
        "pagamenti",
    ],
    "hr_coordination": [
        "hr",
        "human resources",
        "risorse umane",
        "recruiting",
        "talent",
        "payroll",
        "people admin",
    ],
    "compliance": [
        "compliance",
        "regulatory",
        "audit",
        "risk",
        "controllo",
        "normativa",
        "verifica",
    ],
    "project_management": [
        "project management",
        "project manager",
        "coordinamento progetto",
        "planning",
        "stakeholder",
        "delivery",
    ],
    "document_review": [
        "document review",
        "analisi documentale",
        "verifica documenti",
        "controllo documenti",
        "documentazione",
    ],
    "crm_usage": [
        "crm",
        "case management system",
        "ticketing",
        "pipeline",
        "anagrafiche",
    ],
    "office_tools": [
        "office",
        "excel",
        "word",
        "powerpoint",
        "spreadsheet",
        "fogli di calcolo",
    ],
    "language_use": [
        "italiano",
        "tedesco",
        "francese",
        "inglese",
        "german",
        "french",
        "english",
        "language",
    ],
    "communication": [
        "communication",
        "comunicazione",
        "negoziazione",
        "stakeholder",
        "team",
        "coordinamento",
        "collaboration",
    ],
}

ADJACENT_TASK_GROUPS = [
    {"customer_support", "case_management", "crm_usage", "communication"},
    {"administration", "document_review", "crm_usage", "office_tools"},
    {"policy_administration", "claims_handling", "case_management", "compliance", "document_review"},
    {"sales", "outbound_acquisition", "retail_sales", "marketing", "crm_usage"},
    {"software_development", "it_support", "data_analysis", "project_management"},
    {"marketing", "content_creation", "sales"},
    {"healthcare_care", "case_management", "document_review"},
    {"finance_operations", "compliance", "administration", "document_review"},
    {"hr_coordination", "administration", "communication", "project_management"},
    {"logistics_coordination", "administration", "project_management"},
]

GENERIC_TASK_GROUPS = {
    "administration",
    "customer_support",
    "crm_usage",
    "office_tools",
    "language_use",
    "communication",
    "document_review",
}


def build_scoring_breakdown(job: Mapping[str, Any], cv_profile: Mapping[str, Any]) -> dict[str, Any]:
    """Build an explainable weighted signal report for one job."""
    job = safe_dict(job)
    cv_profile = safe_dict(cv_profile)
    cv_domains = detect_cv_domains(cv_profile)
    job_domains = detect_job_domains(job)
    cv_tasks = detect_cv_task_profile(cv_profile)
    job_tasks = detect_job_task_profile(job)
    task_alignment = compare_task_alignment(cv_tasks, job_tasks)
    job_text = _normalize_text(_collect_job_text(job))
    title_text = _normalize_text(str(job.get("title", "")))
    profile_terms = _profile_terms(cv_profile)
    role_signal = _role_match(title_text, job_text, profile_terms["role_terms"])
    keyword_signal = _keyword_match(job, job_text, profile_terms["keyword_terms"])
    task_overlap = task_alignment["task_alignment_score"]
    skill_overlap = _overlap_strength(job_text, profile_terms["skill_terms"], exclude_generic=True)
    generic_overlap_ratio = _generic_overlap_ratio(keyword_signal.get("evidence", []))
    alignment = compare_domain_alignment(
        cv_domains,
        job_domains,
        role_overlap=role_signal["strength"],
        task_overlap=task_overlap,
        skill_overlap=skill_overlap,
        generic_overlap_ratio=generic_overlap_ratio,
    )
    generic_risk = detect_generic_keyword_risk(keyword_signal, alignment)
    alignment["generic_keyword_risk_boost"] = generic_risk["generic_keyword_risk_boost"]

    signal_inputs = {
        "domain_alignment": {
            "strength": alignment["domain_alignment_score"],
            "evidence": alignment["why"],
        },
        "task_alignment": {
            "strength": task_alignment["task_alignment_score"],
            "evidence": task_alignment["why"],
        },
        "role_match": role_signal,
        "keyword_match": keyword_signal,
        "location_fit": _location_fit(job, cv_profile),
        "distance_fit": _distance_fit(job, cv_profile),
        "sales_outbound_penalty": _sales_outbound_penalty(job_text, cv_domains),
        "generic_keyword_risk_penalty": {
            "strength": generic_risk["risk_score"],
            "evidence": generic_risk["why"],
        },
        "generic_task_risk_penalty": {
            "strength": task_alignment["generic_task_risk"]["risk_score"],
            "evidence": task_alignment["generic_task_risk"]["why"],
        },
        "low_domain_alignment_penalty": _low_domain_alignment_penalty(alignment, cv_domains),
        "avoid_task_overlap_penalty": {
            "strength": 1.0 if task_alignment["avoid_task_overlap"] else 0.0,
            "evidence": task_alignment["avoid_task_overlap"] or ["no CV avoid-task overlap"],
        },
        "weak_detail_penalty": _weak_detail_penalty(job),
    }

    signals = [_weighted_signal(name, signal_inputs[name]) for name in SIGNAL_WEIGHTS]
    positive_signals = [
        signal for signal in signals if signal["direction"] == "positive" and signal["strength"] > 0
    ]
    negative_signals = [
        signal for signal in signals if signal["direction"] == "negative" and signal["strength"] > 0
    ]
    weighted_contributions = {
        signal["name"]: signal["contribution"]
        for signal in signals
    }

    return {
        "job_id": _safe_job_id(job),
        "title": str(job.get("title", "")).strip(),
        "company": str(job.get("company", "")).strip(),
        "location": str(job.get("location", "")).strip(),
        "source_score": job.get("score"),
        "weighted_total": round(sum(signal["contribution"] for signal in signals), 3),
        "signals": signals,
        "positive_signals": positive_signals,
        "negative_signals": negative_signals,
        "weighted_contributions": weighted_contributions,
        "cv_domains": cv_domains,
        "job_domains": job_domains,
        "cv_tasks": cv_tasks,
        "job_tasks": job_tasks,
        "task_alignment": task_alignment,
        "domain_alignment": alignment,
        "generic_keyword_risk": generic_risk,
        "task_overlap": task_overlap,
        "skill_overlap": skill_overlap,
    }


def build_scoring_report(
    jobs: Sequence[Mapping[str, Any]],
    cv_profile: Mapping[str, Any],
    expected_ranking: Mapping[str, Any],
) -> dict[str, Any]:
    """Build per-job diagnostics plus ranking mistake explanations."""
    jobs = [safe_dict(job) for job in safe_list(jobs) if isinstance(job, Mapping)]
    cv_profile = safe_dict(cv_profile)
    expected_ranking = safe_dict(expected_ranking)
    actual_ranking = [_safe_job_id(job) for job in jobs]
    expected_top = normalize_job_ids(
        expected_ranking.get("expected_top_job_ids")
        or expected_ranking.get("ideal_ranking")
        or expected_ranking.get("relevant_job_ids")
        or []
    )
    cv_domains = detect_cv_domains(cv_profile)
    cv_tasks = detect_cv_task_profile(cv_profile)
    breakdowns = [build_scoring_breakdown(job, cv_profile) for job in jobs]

    for index, breakdown in enumerate(breakdowns, start=1):
        breakdown["actual_rank"] = index
        breakdown["expected_rank"] = _rank_of(breakdown["job_id"], expected_top)

    leakage_report = build_leakage_report(breakdowns, cv_domains, cv_tasks)

    return {
        "cv_domains": cv_domains,
        "cv_tasks": cv_tasks,
        "jobs": breakdowns,
        "weighted_contribution_report": summarize_weighted_contributions(breakdowns),
        "top_comparison": compare_top_expected_vs_actual(actual_ranking, expected_top),
        "ranking_mistakes": explain_biggest_ranking_mistakes(breakdowns, actual_ranking, expected_top),
        "leakage_report": leakage_report,
        "weight_recommendations": recommend_weight_changes(leakage_report, cv_domains),
    }


def detect_cv_domains(cv_profile: Mapping[str, Any]) -> dict[str, Any]:
    """Infer target, acceptable, weak-fit, and avoided domains from cv_profile.json."""
    cv_profile = safe_dict(cv_profile)
    target_scores = _score_domains_from_sources(
        [
            ("explicit", 3.0, _profile_values_by_keys(cv_profile, _EXPLICIT_DOMAIN_KEYS)),
            ("target_roles", 2.1, _profile_values_by_keys(cv_profile, _TARGET_ROLE_KEYS)),
            ("current_past_roles", 1.8, _profile_values_by_keys(cv_profile, _ROLE_HISTORY_KEYS)),
            ("keywords", 1.4, _profile_values_by_keys(cv_profile, _KEYWORD_KEYS)),
            ("skills", 1.0, _profile_values_by_keys(cv_profile, _SKILL_KEYS)),
        ]
    )
    acceptable_scores = _score_domains_from_sources(
        [("acceptable_roles", 1.0, _profile_values_by_keys(cv_profile, _ACCEPTABLE_ROLE_KEYS))]
    )
    weak_scores = _score_domains_from_sources(
        [("weak_fit_roles", 1.0, _profile_values_by_keys(cv_profile, _WEAK_ROLE_KEYS))]
    )
    avoid_scores = _score_domains_from_sources(
        [("avoid_terms", 1.0, _profile_values_by_keys(cv_profile, _AVOID_KEYS))]
    )

    target_domains = _ranked_domain_names(target_scores, min_score=1.0)
    acceptable_domains = _ranked_domain_names(acceptable_scores, min_score=0.75)
    weak_fit_domains = _ranked_domain_names(weak_scores, min_score=0.75)
    avoid_domains = _ranked_domain_names(avoid_scores, min_score=0.75)

    target_domains = [domain for domain in target_domains if domain not in avoid_domains]
    primary_target_domains = _primary_domain_names(target_scores, target_domains)
    acceptable_domains = [
        domain for domain in acceptable_domains if domain not in target_domains and domain not in avoid_domains
    ]
    weak_fit_domains = [
        domain
        for domain in weak_fit_domains
        if domain not in target_domains and domain not in acceptable_domains and domain not in avoid_domains
    ]
    clear_target_domain = bool(target_domains) and max(target_scores.get(domain, {}).get("score", 0.0) for domain in target_domains) >= 2.0

    return {
        "target_domains": target_domains,
        "primary_target_domains": primary_target_domains,
        "acceptable_domains": acceptable_domains,
        "weak_fit_domains": weak_fit_domains,
        "avoid_domains": avoid_domains,
        "clear_target_domain": clear_target_domain,
        "domain_scores": target_scores,
        "acceptable_domain_scores": acceptable_scores,
        "weak_fit_domain_scores": weak_scores,
        "avoid_domain_scores": avoid_scores,
    }


def detect_job_domains(job: Mapping[str, Any]) -> dict[str, Any]:
    """Infer job domains from title, company, description, keywords, and sector-like terms."""
    job = safe_dict(job)
    weighted_sources = [
        ("title", 2.2, [job.get("title", "")]),
        ("company", 0.6, [job.get("company", "")]),
        ("sector", 1.8, [job.get("sector", ""), job.get("industry", ""), job.get("domain", "")]),
        ("description", 1.2, [job.get("snippet", ""), job.get("fullDescription", "")]),
        (
            "keywords",
            1.4,
            _as_list(job.get("matchedKeywords"))
            + _as_list(job.get("keyword"))
            + _as_list(job.get("requirements"))
            + _as_list(job.get("responsibilities")),
        ),
        ("risk_flags", 0.8, _as_list(job.get("riskFlags"))),
    ]
    domain_scores = _score_domains_from_sources(weighted_sources)
    detected_domains = _ranked_domain_names(domain_scores, min_score=0.9)
    primary_domains = _primary_domain_names(domain_scores, detected_domains)
    primary_domain = primary_domains[0] if primary_domains else None

    return {
        "detected_domains": detected_domains,
        "primary_domains": primary_domains,
        "primary_domain": primary_domain,
        "domain_scores": domain_scores,
    }


def compare_domain_alignment(
    cv_domains: Mapping[str, Any],
    job_domains: Mapping[str, Any],
    role_overlap: float = 0.0,
    task_overlap: float = 0.0,
    skill_overlap: float = 0.0,
    generic_overlap_ratio: float = 0.0,
) -> dict[str, Any]:
    """Compare detected CV domains against detected job domains without global industry bias."""
    cv_domains = safe_dict(cv_domains)
    job_domains = safe_dict(job_domains)
    target = safe_set(cv_domains.get("target_domains"))
    primary_target = safe_set(cv_domains.get("primary_target_domains")) or target
    acceptable = safe_set(cv_domains.get("acceptable_domains"))
    weak_fit = safe_set(cv_domains.get("weak_fit_domains"))
    avoided = safe_set(cv_domains.get("avoid_domains"))
    job = safe_set(job_domains.get("detected_domains"))
    primary_job = safe_set(job_domains.get("primary_domains")) or safe_set(job_domains.get("primary_domain"))
    clear_target = bool(cv_domains.get("clear_target_domain"))
    role_overlap = float(role_overlap or 0.0)
    task_overlap = float(task_overlap or 0.0)
    skill_overlap = float(skill_overlap or 0.0)
    generic_overlap_ratio = float(generic_overlap_ratio or 0.0)

    matching_domains = sorted(job & target)
    primary_matching_domains = sorted(primary_job & primary_target)
    generic_matching_domains = sorted(set(matching_domains) & GENERIC_FUNCTIONAL_DOMAINS)
    substantive_matching_domains = sorted(set(matching_domains) - GENERIC_FUNCTIONAL_DOMAINS)
    acceptable_matches = sorted(job & acceptable)
    weak_matches = sorted(job & weak_fit)
    adjacent_domains = sorted(
        domain
        for domain in job
        if domain not in substantive_matching_domains and _is_adjacent_to_any(domain, primary_target)
    )
    avoided_matches = sorted(job & avoided)
    mismatching_domains = sorted(
        domain
        for domain in job
        if domain not in safe_set(
            substantive_matching_domains
            + generic_matching_domains
            + acceptable_matches
            + weak_matches
        )
    )
    strong_role_task_evidence = (
        role_overlap >= 0.7 and (task_overlap >= 0.45 or skill_overlap >= 0.45)
    ) or (
        role_overlap >= 0.55 and task_overlap >= 0.45 and skill_overlap >= 0.35
    )

    if primary_matching_domains:
        score = 1.0
        alignment_type = "exact_domain_alignment"
        dominant_reason = f"same primary domain: {', '.join(primary_matching_domains)}"
        why = [dominant_reason]
    elif substantive_matching_domains and strong_role_task_evidence:
        score = 0.94
        alignment_type = "strong_role_task_alignment"
        dominant_reason = (
            "substantive domain overlap reinforced by strong role/task/skill evidence: "
            + ", ".join(substantive_matching_domains)
        )
        why = [dominant_reason]
    elif substantive_matching_domains:
        score = 0.82
        alignment_type = "exact_domain_alignment"
        dominant_reason = f"job domain matches CV target domain: {', '.join(substantive_matching_domains)}"
        why = [dominant_reason, "not boosted to full alignment because primary-domain or role/task evidence is weaker"]
    elif acceptable_matches:
        score = 0.78
        alignment_type = "acceptable_domain_alignment"
        dominant_reason = f"job domain is acceptable for this CV: {', '.join(acceptable_matches)}"
        why = [dominant_reason]
    elif adjacent_domains:
        if role_overlap >= 0.55 and (task_overlap >= 0.35 or skill_overlap >= 0.35):
            score = 0.72
            alignment_type = "adjacent_domain_alignment"
            dominant_reason = (
                f"adjacent domain reinforced by role/task evidence: {', '.join(adjacent_domains)}"
            )
        else:
            score = 0.52 if clear_target else 0.58
            alignment_type = "weak_adjacent_alignment"
            dominant_reason = (
                f"adjacent domain without enough role/task reinforcement: {', '.join(adjacent_domains)}"
            )
        why = [dominant_reason]
    elif generic_matching_domains:
        score = 0.42 if clear_target else 0.5
        alignment_type = "generic_overlap_only"
        dominant_reason = (
            "only generic functional overlap detected: "
            + ", ".join(generic_matching_domains)
        )
        why = [dominant_reason, "generic functional overlap cannot create full domain alignment"]
    elif weak_matches:
        score = 0.45
        alignment_type = "weak_adjacent_alignment"
        dominant_reason = f"job domain appears only in weak-fit CV roles: {', '.join(weak_matches)}"
        why = [dominant_reason]
    elif not job:
        score = 0.35 if clear_target else 0.55
        alignment_type = "unknown_job_domain"
        dominant_reason = "no clear job domain detected"
        why = [dominant_reason]
    elif clear_target:
        score = 0.18
        alignment_type = "domain_mismatch"
        dominant_reason = f"job domains do not match clear CV target domains ({', '.join(sorted(primary_target))})"
        why = [dominant_reason]
    else:
        score = 0.45
        alignment_type = "soft_mismatch_unclear_cv_domain"
        dominant_reason = "CV has no clear target domain, so mismatch penalty stays soft"
        why = [dominant_reason]

    if avoided_matches:
        score = min(score, 0.12)
        alignment_type = "avoided_domain_overlap"
        dominant_reason = f"job domain overlaps CV avoid terms: {', '.join(avoided_matches)}"
        why.append(f"job domain overlaps CV avoid terms: {', '.join(avoided_matches)}")

    return {
        "domain_alignment_score": round(score, 3),
        "alignment_type": alignment_type,
        "dominant_alignment_reason": dominant_reason,
        "matching_domains": matching_domains,
        "primary_matching_domains": primary_matching_domains,
        "generic_matching_domains": generic_matching_domains,
        "acceptable_domains": acceptable_matches,
        "adjacent_domains": adjacent_domains,
        "weak_fit_domains": weak_matches,
        "mismatching_domains": mismatching_domains,
        "avoided_domains": avoided_matches,
        "role_overlap": round(role_overlap, 3),
        "task_overlap": round(task_overlap, 3),
        "skill_overlap": round(skill_overlap, 3),
        "generic_overlap_ratio": round(generic_overlap_ratio, 3),
        "generic_keyword_risk_boost": 0.0,
        "why": why,
    }


def detect_generic_keyword_risk(
    keyword_signal: Mapping[str, Any],
    alignment: Mapping[str, Any],
) -> dict[str, Any]:
    """Detect whether generic keywords are overpowering weak domain fit."""
    evidence = [
        str(value)
        for value in safe_list(safe_dict(keyword_signal).get("evidence"))
        if not str(value).startswith("no CV ")
    ]
    generic_terms = [
        term for term in evidence if _contains_any(_normalize_text(term), GENERIC_KEYWORD_TERMS)
    ]
    keyword_signal = safe_dict(keyword_signal)
    alignment = safe_dict(alignment)
    domain_score = float(alignment.get("domain_alignment_score", 0.0) or 0.0)
    keyword_strength = float(keyword_signal.get("strength", 0.0) or 0.0)
    generic_overlap_ratio = float(
        alignment.get("generic_overlap_ratio") or _generic_overlap_ratio(evidence)
    )
    alignment_type = str(alignment.get("alignment_type", ""))
    risk_score = 0.0

    if domain_score < 0.55 and keyword_strength >= 0.5 and len(generic_terms) >= 2:
        risk_score = 1.0
    elif domain_score < 0.55 and keyword_strength >= 0.35 and generic_terms:
        risk_score = 0.6
    elif domain_score < 0.7 and keyword_strength >= 0.5 and len(generic_terms) >= 2:
        risk_score = 0.4

    generic_keyword_risk_boost = 0.0
    if generic_overlap_ratio >= 0.5 and alignment_type in {
        "generic_overlap_only",
        "weak_adjacent_alignment",
        "domain_mismatch",
        "soft_mismatch_unclear_cv_domain",
    }:
        generic_keyword_risk_boost = 0.25
    elif generic_overlap_ratio >= 0.7 and alignment_type == "adjacent_domain_alignment":
        generic_keyword_risk_boost = 0.15

    risk_score = min(1.0, risk_score + generic_keyword_risk_boost)

    why = []
    if risk_score:
        why.append(
            "generic keywords may be compensating for weak domain alignment: "
            + ", ".join(generic_terms[:5])
        )
        if generic_keyword_risk_boost:
            why.append(f"generic keyword risk boost applied: {generic_keyword_risk_boost:.2f}")
    else:
        why.append("generic keyword risk not detected")

    return {
        "risk_score": risk_score,
        "generic_keyword_risk_boost": generic_keyword_risk_boost,
        "generic_overlap_ratio": round(generic_overlap_ratio, 3),
        "generic_terms": generic_terms,
        "why": why,
    }


def detect_cv_task_profile(cv_profile: Mapping[str, Any]) -> dict[str, Any]:
    """Infer neutral task groups from CV evidence only."""
    cv_profile = safe_dict(cv_profile)
    target_scores = _score_tasks_from_sources(
        [
            ("target_roles", 2.2, _profile_values_by_keys(cv_profile, _TARGET_ROLE_KEYS)),
            ("current_past_roles", 1.8, _profile_values_by_keys(cv_profile, _ROLE_HISTORY_KEYS)),
            ("strong_keywords", 1.6, _profile_values_by_keys(cv_profile, _KEYWORD_KEYS)),
            ("skills", 1.2, _profile_values_by_keys(cv_profile, _SKILL_KEYS)),
            ("highlights", 1.4, _profile_values_by_keys(cv_profile, _HIGHLIGHT_KEYS)),
        ]
    )
    acceptable_scores = _score_tasks_from_sources(
        [("acceptable_roles", 1.0, _profile_values_by_keys(cv_profile, _ACCEPTABLE_ROLE_KEYS))]
    )
    weak_scores = _score_tasks_from_sources(
        [("weak_fit_roles", 1.0, _profile_values_by_keys(cv_profile, _WEAK_ROLE_KEYS))]
    )
    avoid_scores = _score_tasks_from_sources(
        [("avoid_terms", 1.2, _profile_values_by_keys(cv_profile, _AVOID_KEYS))]
    )

    target_tasks = _ranked_task_names(target_scores, min_score=0.9)
    acceptable_tasks = _ranked_task_names(acceptable_scores, min_score=0.75)
    weak_fit_tasks = _ranked_task_names(weak_scores, min_score=0.75)
    avoid_tasks = _ranked_task_names(avoid_scores, min_score=0.75)

    target_tasks = [task for task in target_tasks if task not in avoid_tasks]
    primary_target_tasks = _primary_task_names(target_scores, target_tasks)
    acceptable_tasks = [
        task for task in acceptable_tasks if task not in target_tasks and task not in avoid_tasks
    ]
    weak_fit_tasks = [
        task
        for task in weak_fit_tasks
        if task not in target_tasks and task not in acceptable_tasks and task not in avoid_tasks
    ]
    clear_target_tasks = bool(target_tasks) and max(
        target_scores.get(task, {}).get("score", 0.0) for task in target_tasks
    ) >= 1.8
    task_hierarchy = build_cv_task_importance_hierarchy(
        {
            "target_tasks": target_tasks,
            "primary_target_tasks": primary_target_tasks,
            "acceptable_tasks": acceptable_tasks,
            "weak_fit_tasks": weak_fit_tasks,
            "avoid_tasks": avoid_tasks,
            "clear_target_tasks": clear_target_tasks,
            "task_scores": target_scores,
        }
    )

    return {
        "target_tasks": target_tasks,
        "primary_target_tasks": primary_target_tasks,
        "acceptable_tasks": acceptable_tasks,
        "weak_fit_tasks": weak_fit_tasks,
        "avoid_tasks": avoid_tasks,
        "core_tasks": task_hierarchy["core_tasks"],
        "adjacent_tasks": task_hierarchy["adjacent_tasks"],
        "generic_tasks": task_hierarchy["generic_tasks"],
        "clear_target_tasks": clear_target_tasks,
        "task_scores": target_scores,
        "acceptable_task_scores": acceptable_scores,
        "weak_fit_task_scores": weak_scores,
        "avoid_task_scores": avoid_scores,
        "task_importance_hierarchy": task_hierarchy,
    }


def detect_job_task_profile(job: Mapping[str, Any]) -> dict[str, Any]:
    """Infer neutral task groups from job title, description, requirements, and keywords."""
    job = safe_dict(job)
    task_scores = _score_tasks_from_sources(
        [
            ("title", 2.2, [job.get("title", "")]),
            ("company", 0.3, [job.get("company", "")]),
            ("description", 1.4, [job.get("snippet", ""), job.get("fullDescription", "")]),
            (
                "requirements",
                1.5,
                _as_list(job.get("requirements")) + _as_list(job.get("responsibilities")),
            ),
            (
                "keywords",
                1.3,
                _as_list(job.get("matchedKeywords")) + _as_list(job.get("keyword")),
            ),
        ]
    )
    detected_tasks = _ranked_task_names(task_scores, min_score=0.8)
    primary_tasks = _primary_task_names(task_scores, detected_tasks)
    task_specificity_score = _task_specificity_score(task_scores, detected_tasks)

    return {
        "detected_tasks": detected_tasks,
        "primary_tasks": primary_tasks,
        "task_scores": task_scores,
        "task_specificity_score": task_specificity_score,
    }


def build_cv_task_importance_hierarchy(cv_tasks: Mapping[str, Any]) -> dict[str, Any]:
    """Classify CV-derived tasks by importance without global task bias."""
    cv_tasks = safe_dict(cv_tasks)
    target_tasks = safe_list(cv_tasks.get("target_tasks"))
    primary_tasks = safe_list(cv_tasks.get("primary_target_tasks")) or target_tasks
    acceptable_tasks = safe_list(cv_tasks.get("acceptable_tasks"))
    weak_fit_tasks = safe_list(cv_tasks.get("weak_fit_tasks"))
    avoid_tasks = safe_list(cv_tasks.get("avoid_tasks"))
    task_scores = safe_dict(cv_tasks.get("task_scores"))

    core_tasks = [
        task
        for task in primary_tasks
        if task not in avoid_tasks and (
            task not in GENERIC_TASK_GROUPS
            or _task_score(task_scores, task) >= 2.0
            or task in safe_set(primary_tasks)
        )
    ]
    if not core_tasks:
        core_tasks = [
            task
            for task in target_tasks
            if task not in avoid_tasks and task not in GENERIC_TASK_GROUPS
        ][:4]
    if not core_tasks and cv_tasks.get("clear_target_tasks"):
        core_tasks = [task for task in target_tasks if task not in avoid_tasks][:3]

    adjacent_candidates = safe_list(acceptable_tasks) + safe_list(weak_fit_tasks) + [
        task
        for task in target_tasks
        if task not in core_tasks and task not in avoid_tasks
    ]
    adjacent_tasks = [
        task
        for task in adjacent_candidates
        if task not in core_tasks and task not in avoid_tasks and task not in GENERIC_TASK_GROUPS
    ]

    generic_tasks = [
        task
        for task in target_tasks + acceptable_tasks + weak_fit_tasks
        if task in GENERIC_TASK_GROUPS and task not in core_tasks and task not in avoid_tasks
    ]

    return {
        "core_tasks": _unique(core_tasks),
        "adjacent_tasks": _unique(adjacent_tasks),
        "generic_tasks": _unique(generic_tasks),
        "avoid_tasks": _unique(avoid_tasks),
        "clear_target_tasks": bool(cv_tasks.get("clear_target_tasks")),
        "why": _task_hierarchy_reason(core_tasks, adjacent_tasks, generic_tasks, avoid_tasks),
    }


def compare_task_importance(
    cv_task_hierarchy: Mapping[str, Any],
    job_tasks: Mapping[str, Any],
) -> dict[str, Any]:
    """Compare job tasks with the CV task importance hierarchy."""
    hierarchy = safe_dict(cv_task_hierarchy)
    job_tasks = safe_dict(job_tasks)
    detected_tasks = safe_set(job_tasks.get("detected_tasks"))
    core_tasks = safe_set(hierarchy.get("core_tasks"))
    adjacent_tasks = safe_set(hierarchy.get("adjacent_tasks"))
    generic_tasks = safe_set(hierarchy.get("generic_tasks"))
    avoid_tasks = safe_set(hierarchy.get("avoid_tasks"))
    task_specificity_score = float(job_tasks.get("task_specificity_score", 0.0) or 0.0)
    task_scores = safe_dict(job_tasks.get("task_scores"))
    primary_tasks = safe_set(job_tasks.get("primary_tasks"))

    core_overlap = sorted(detected_tasks & core_tasks)
    adjacent_overlap = sorted((detected_tasks & adjacent_tasks) - set(core_overlap))
    avoid_overlap = sorted(detected_tasks & avoid_tasks)
    generic_overlap = sorted(
        task
        for task in detected_tasks
        if task in GENERIC_TASK_GROUPS
        and task not in core_overlap
        and task not in adjacent_overlap
        and (not generic_tasks or task in generic_tasks or task not in core_tasks)
    )
    generic_task_share = len(generic_overlap) / max(len(detected_tasks), 1)
    task_depth_score = _task_depth_score(task_scores, core_overlap)
    concrete_task_evidence_score = _task_evidence_strength(
        task_scores,
        [task for task in core_overlap if task not in GENERIC_TASK_GROUPS] or core_overlap,
    )
    role_specificity_score = (
        len(set(core_overlap) & primary_tasks) / max(len(core_overlap), 1)
        if core_overlap
        else 0.0
    )

    if core_overlap:
        generic_drag = 0.10 * generic_task_share
        if len(core_overlap) <= 1 and not adjacent_overlap and generic_overlap:
            generic_drag += 0.06
        if concrete_task_evidence_score < 0.45 and generic_overlap:
            generic_drag += 0.04
        score = (
            0.76
            + 0.035 * min(len(core_overlap), 3)
            + 0.08 * task_specificity_score
            + 0.06 * task_depth_score
            + 0.05 * concrete_task_evidence_score
            + 0.04 * role_specificity_score
            - generic_drag
        )
        score = max(0.62, min(1.0, score))
        reason = "job overlaps core CV tasks: " + ", ".join(core_overlap)
        if generic_overlap:
            reason += "; broad/supportive tasks also present: " + ", ".join(generic_overlap)
    elif adjacent_overlap:
        score = min(0.74, 0.58 + 0.05 * (len(adjacent_overlap) - 1))
        reason = "job overlaps adjacent CV tasks: " + ", ".join(adjacent_overlap)
    elif generic_overlap:
        score = 0.28 if hierarchy.get("clear_target_tasks") else 0.38
        reason = "job only overlaps broad/generic tasks: " + ", ".join(generic_overlap)
    elif not detected_tasks:
        score = 0.3 if hierarchy.get("clear_target_tasks") else 0.5
        reason = "job has no clear task groups"
    else:
        score = 0.18 if hierarchy.get("clear_target_tasks") else 0.45
        reason = "job tasks do not overlap CV task hierarchy"

    if avoid_overlap:
        score = min(score, 0.12)
        reason = "job overlaps CV avoid tasks: " + ", ".join(avoid_overlap)

    generic_leakage_risk = _generic_leakage_risk_from_importance(
        core_overlap=core_overlap,
        adjacent_overlap=adjacent_overlap,
        generic_overlap=generic_overlap,
        avoid_overlap=avoid_overlap,
        clear_target_tasks=bool(hierarchy.get("clear_target_tasks")),
        task_specificity_score=task_specificity_score,
        detected_task_count=len(detected_tasks),
    )

    return {
        "core_task_overlap": core_overlap,
        "adjacent_task_overlap": adjacent_overlap,
        "generic_task_overlap": generic_overlap,
        "avoid_task_overlap": avoid_overlap,
        "task_importance_score": round(score, 3),
        "task_depth_score": round(task_depth_score, 3),
        "role_specificity_score": round(role_specificity_score, 3),
        "concrete_task_evidence_score": round(concrete_task_evidence_score, 3),
        "generic_task_share": round(generic_task_share, 3),
        "generic_leakage_risk": round(generic_leakage_risk, 3),
        "reason": reason,
    }


def compare_task_alignment(
    cv_tasks: Mapping[str, Any],
    job_tasks: Mapping[str, Any],
) -> dict[str, Any]:
    """Compare CV task profile to job task profile with neutral, CV-relative rules."""
    cv_tasks = safe_dict(cv_tasks)
    job_tasks = safe_dict(job_tasks)
    target = safe_set(cv_tasks.get("target_tasks"))
    primary_target = safe_set(cv_tasks.get("primary_target_tasks")) or target
    acceptable = safe_set(cv_tasks.get("acceptable_tasks"))
    weak_fit = safe_set(cv_tasks.get("weak_fit_tasks"))
    avoid = safe_set(cv_tasks.get("avoid_tasks"))
    job = safe_set(job_tasks.get("detected_tasks"))
    primary_job = safe_set(job_tasks.get("primary_tasks"))
    clear_target = bool(cv_tasks.get("clear_target_tasks"))
    task_specificity_score = float(job_tasks.get("task_specificity_score", 0.0) or 0.0)

    matching_tasks = sorted(job & target)
    primary_matching_tasks = sorted(primary_job & primary_target)
    acceptable_matches = sorted(job & acceptable)
    weak_matches = sorted(job & weak_fit)
    avoid_task_overlap = sorted(job & avoid)
    generic_matching_tasks = sorted(
        task for task in matching_tasks if _task_is_generic_noise(task, cv_tasks)
    )
    substantive_matching_tasks = sorted(set(matching_tasks) - set(generic_matching_tasks))
    adjacent_tasks = sorted(
        task
        for task in job
        if task not in matching_tasks and _is_adjacent_task_to_any(task, primary_target)
    )
    mismatching_tasks = sorted(
        task
        for task in job
        if task not in safe_set(matching_tasks + acceptable_matches + weak_matches)
    )
    generic_task_overlap_ratio = _generic_task_overlap_ratio(
        matching_tasks + adjacent_tasks,
        job_tasks,
        cv_tasks,
    )
    task_hierarchy = safe_dict(cv_tasks.get("task_importance_hierarchy")) or build_cv_task_importance_hierarchy(cv_tasks)
    task_importance = compare_task_importance(task_hierarchy, job_tasks)

    if primary_matching_tasks:
        score = 1.0
        alignment_type = "exact_task_alignment"
        dominant_reason = f"same primary task group: {', '.join(primary_matching_tasks)}"
        why = [dominant_reason]
    elif substantive_matching_tasks and task_specificity_score >= 0.45:
        score = 0.86
        alignment_type = "task_alignment"
        dominant_reason = (
            "specific task overlap with CV target tasks: "
            + ", ".join(substantive_matching_tasks)
        )
        why = [dominant_reason]
    elif substantive_matching_tasks:
        score = 0.72
        alignment_type = "weak_task_alignment"
        dominant_reason = (
            "task overlap exists but job task profile is broad/generic: "
            + ", ".join(substantive_matching_tasks)
        )
        why = [dominant_reason]
    elif acceptable_matches:
        score = 0.68
        alignment_type = "acceptable_task_alignment"
        dominant_reason = f"job task is acceptable for this CV: {', '.join(acceptable_matches)}"
        why = [dominant_reason]
    elif adjacent_tasks:
        score = 0.5 if clear_target else 0.56
        alignment_type = "adjacent_task_alignment"
        dominant_reason = f"job task is adjacent to CV tasks: {', '.join(adjacent_tasks)}"
        why = [dominant_reason]
    elif generic_matching_tasks:
        score = 0.42 if clear_target else 0.5
        alignment_type = "generic_task_overlap_only"
        dominant_reason = (
            "only generic task overlap detected: "
            + ", ".join(generic_matching_tasks)
        )
        why = [dominant_reason, "generic tasks cannot dominate unless they are clear CV targets"]
    elif weak_matches:
        score = 0.35
        alignment_type = "weak_fit_task_alignment"
        dominant_reason = f"job task appears only in weak-fit CV tasks: {', '.join(weak_matches)}"
        why = [dominant_reason]
    elif not job:
        score = 0.3 if clear_target else 0.5
        alignment_type = "unknown_job_tasks"
        dominant_reason = "no clear job tasks detected"
        why = [dominant_reason]
    elif clear_target:
        score = 0.18
        alignment_type = "task_mismatch"
        dominant_reason = (
            "job tasks do not match clear CV target tasks "
            f"({', '.join(sorted(primary_target))})"
        )
        why = [dominant_reason]
    else:
        score = 0.45
        alignment_type = "soft_task_mismatch_unclear_cv_tasks"
        dominant_reason = "CV has no clear target task profile, so mismatch penalty stays soft"
        why = [dominant_reason]

    generic_task_risk = _generic_task_risk(
        generic_task_overlap_ratio=max(generic_task_overlap_ratio, task_importance["generic_leakage_risk"]),
        task_alignment_score=score,
        matching_tasks=matching_tasks,
        cv_tasks=cv_tasks,
    )

    if generic_task_risk["risk_score"] >= 0.6 and alignment_type not in {
        "exact_task_alignment",
        "task_alignment",
    }:
        score = min(score, 0.5)
        why.append("generic task overlap capped task alignment")

    if task_importance["generic_leakage_risk"] >= 0.75 and not task_importance["core_task_overlap"]:
        score = min(score, 0.42)
        why.append("generic task leakage capped task alignment")

    if task_importance["generic_leakage_risk"] >= 0.35 and task_importance["core_task_overlap"]:
        capped_score = min(score, max(0.66, task_importance["task_importance_score"] + 0.04))
        if capped_score < score:
            score = capped_score
            if alignment_type == "exact_task_alignment":
                alignment_type = "core_task_with_generic_leakage"
                dominant_reason = task_importance["reason"]
            why.append("generic/supportive task share capped otherwise exact task alignment")

    if task_importance["core_task_overlap"] and not avoid_task_overlap:
        score = max(score, task_importance["task_importance_score"])
    elif task_importance["adjacent_task_overlap"] and not avoid_task_overlap:
        score = max(score, min(task_importance["task_importance_score"], 0.74))

    if avoid_task_overlap:
        score = min(score, 0.12)
        alignment_type = "avoid_task_overlap"
        dominant_reason = f"job overlaps CV avoid tasks: {', '.join(avoid_task_overlap)}"
        why.append(dominant_reason)

    generic_task_risk = _generic_task_risk(
        generic_task_overlap_ratio=max(generic_task_overlap_ratio, task_importance["generic_leakage_risk"]),
        task_alignment_score=score,
        matching_tasks=matching_tasks,
        cv_tasks=cv_tasks,
    )

    return {
        "task_alignment_score": round(score, 3),
        "alignment_type": alignment_type,
        "dominant_task_reason": dominant_reason,
        "matching_tasks": matching_tasks,
        "primary_matching_tasks": primary_matching_tasks,
        "adjacent_tasks": adjacent_tasks,
        "mismatching_tasks": mismatching_tasks,
        "acceptable_tasks": acceptable_matches,
        "weak_fit_tasks": weak_matches,
        "avoid_task_overlap": avoid_task_overlap,
        "generic_task_overlap_ratio": round(generic_task_overlap_ratio, 3),
        "task_specificity_score": round(task_specificity_score, 3),
        "generic_task_risk": generic_task_risk,
        "task_importance_hierarchy": task_hierarchy,
        "core_task_overlap": task_importance["core_task_overlap"],
        "adjacent_task_overlap": task_importance["adjacent_task_overlap"],
        "generic_task_overlap": task_importance["generic_task_overlap"],
        "task_importance_score": task_importance["task_importance_score"],
        "task_depth_score": task_importance["task_depth_score"],
        "role_specificity_score": task_importance["role_specificity_score"],
        "concrete_task_evidence_score": task_importance["concrete_task_evidence_score"],
        "generic_task_share": task_importance["generic_task_share"],
        "generic_leakage_risk": task_importance["generic_leakage_risk"],
        "task_importance_reason": task_importance["reason"],
        "why": why,
    }


def build_leakage_report(
    breakdowns: Sequence[Mapping[str, Any]],
    cv_domains: Mapping[str, Any],
    cv_tasks: Mapping[str, Any],
    top_k: int = 10,
) -> dict[str, Any]:
    """Find high-ranking jobs that look weak by universal domain/role diagnostics."""
    cv_domains = safe_dict(cv_domains)
    cv_tasks = safe_dict(cv_tasks)
    top_jobs = [
        breakdown
        for breakdown in safe_list(breakdowns)
        if isinstance(breakdown, Mapping)
        and int(breakdown.get("actual_rank", 10_000) or 10_000) <= top_k
    ]

    low_domain = [
        _leakage_item(breakdown)
        for breakdown in top_jobs
        if float(safe_dict(breakdown.get("domain_alignment")).get("domain_alignment_score", 0.0) or 0.0) < 0.45
    ]
    generic_keyword = [
        _leakage_item(breakdown)
        for breakdown in top_jobs
        if float(safe_dict(breakdown.get("generic_keyword_risk")).get("risk_score", 0.0) or 0.0) >= 0.6
    ]
    weak_role_domain = [
        _leakage_item(breakdown)
        for breakdown in top_jobs
        if _signal_strength(breakdown, "role_match") < 0.35
        and float(safe_dict(breakdown.get("domain_alignment")).get("domain_alignment_score", 0.0) or 0.0) < 0.58
    ]
    weak_task = [
        _leakage_item(breakdown)
        for breakdown in top_jobs
        if float(safe_dict(breakdown.get("task_alignment")).get("task_alignment_score", 0.0) or 0.0) < 0.45
    ]
    generic_task = [
        _leakage_item(breakdown)
        for breakdown in top_jobs
        if float(
            safe_dict(safe_dict(breakdown.get("task_alignment")).get("generic_task_risk")).get("risk_score", 0.0)
            or 0.0
        ) >= 0.6
    ]
    generic_importance_task = [
        _leakage_item(breakdown)
        for breakdown in top_jobs
        if float(safe_dict(breakdown.get("task_alignment")).get("generic_leakage_risk", 0.0) or 0.0) >= 0.6
    ]
    generic_above_core = [
        _leakage_item_with_core_below(breakdown, breakdowns)
        for breakdown in top_jobs
        if _has_generic_task_leakage(breakdown) and _core_task_jobs_below(breakdown, breakdowns)
    ]
    avoid_task = [
        _leakage_item(breakdown)
        for breakdown in top_jobs
        if safe_list(safe_dict(breakdown.get("task_alignment")).get("avoid_task_overlap"))
    ]
    avoid_task_still_high = [
        _leakage_item(breakdown)
        for breakdown in top_jobs
        if safe_list(safe_dict(breakdown.get("task_alignment")).get("avoid_task_overlap"))
    ]

    return {
        "clear_target_domain": bool(cv_domains.get("clear_target_domain")),
        "clear_target_tasks": bool(cv_tasks.get("clear_target_tasks")),
        "jobs_ranking_high_despite_low_domain_alignment": low_domain,
        "jobs_ranking_high_mainly_because_of_generic_keywords": generic_keyword,
        "jobs_ranking_high_despite_weak_role_domain_fit": weak_role_domain,
        "jobs_ranking_high_despite_weak_task_alignment": weak_task,
        "jobs_ranking_high_mainly_because_of_generic_tasks": generic_task,
        "jobs_ranking_high_mostly_due_to_generic_tasks": generic_importance_task,
        "jobs_ranking_above_more_specific_core_task_jobs": generic_above_core,
        "jobs_ranking_high_despite_avoid_task_overlap": avoid_task,
        "jobs_with_avoid_task_overlap_still_too_high": avoid_task_still_high,
    }


def recommend_weight_changes(
    leakage_report: Mapping[str, Any],
    cv_domains: Mapping[str, Any],
) -> list[dict[str, Any]]:
    """Simulate neutral weight recommendations from leakage patterns."""
    recommendations = []
    leakage_report = safe_dict(leakage_report)
    cv_domains = safe_dict(cv_domains)
    clear_target = bool(cv_domains.get("clear_target_domain"))
    clear_target_tasks = bool(leakage_report.get("clear_target_tasks"))

    if safe_list(leakage_report.get("jobs_ranking_high_despite_low_domain_alignment")) and clear_target:
        recommendations.append(
            {
                "recommendation": "increase domain alignment weight",
                "reason": "top-ranked jobs include low domain-alignment results while the CV has a clear target domain",
                "suggested_change": "raise domain_alignment weight by 15-25%",
            }
        )
        recommendations.append(
            {
                "recommendation": "increase low-domain-alignment penalty",
                "reason": "apply only when the CV has a clear target domain",
                "suggested_change": "increase low_domain_alignment_penalty by 10-20%",
            }
        )

    if safe_list(leakage_report.get("jobs_ranking_high_mainly_because_of_generic_keywords")):
        recommendations.append(
            {
                "recommendation": "reduce generic keyword weight",
                "reason": "generic skills are helping top-ranked jobs despite weak domain alignment",
                "suggested_change": "reduce keyword_match contribution for generic terms by 15-30%",
            }
        )

    if safe_list(leakage_report.get("jobs_ranking_high_despite_weak_role_domain_fit")) and clear_target:
        recommendations.append(
            {
                "recommendation": "increase combined role/domain fit threshold",
                "reason": "some top-ranked jobs have weak role fit and weak domain fit",
                "suggested_change": "require either role_match >= 0.35 or domain_alignment >= 0.58 for strong ranking",
            }
        )

    if safe_list(leakage_report.get("jobs_ranking_high_despite_weak_task_alignment")) and clear_target_tasks:
        recommendations.append(
            {
                "recommendation": "increase task alignment weight",
                "reason": "top-ranked jobs include weak task-alignment results while the CV has clear target tasks",
                "suggested_change": "raise task_alignment weight by 15-25%",
            }
        )

    if safe_list(leakage_report.get("jobs_ranking_above_more_specific_core_task_jobs")) and clear_target_tasks:
        recommendations.append(
            {
                "recommendation": "increase core task weight",
                "reason": "generic or weak-task jobs are ranking above jobs with specific core-task overlap",
                "suggested_change": "boost core_task_overlap and require it for strongest task scores",
            }
        )
        recommendations.append(
            {
                "recommendation": "require core or adjacent task evidence for top 5",
                "reason": "top-ranked jobs should not rely only on broad generic tasks when CV target tasks are clear",
                "suggested_change": "apply a top-5 guardrail unless core_task_overlap or adjacent_task_overlap exists",
            }
        )

    if safe_list(leakage_report.get("jobs_ranking_high_mainly_because_of_generic_tasks")):
        recommendations.append(
            {
                "recommendation": "reduce generic task weight",
                "reason": "generic tasks are helping top-ranked jobs despite weak task alignment",
                "suggested_change": "discount generic tasks unless they are clear CV target tasks",
            }
        )

    if safe_list(leakage_report.get("jobs_ranking_high_mostly_due_to_generic_tasks")):
        recommendations.append(
            {
                "recommendation": "reduce generic task weight",
                "reason": "task hierarchy shows high generic leakage risk in top-ranked jobs",
                "suggested_change": "cap generic_task_overlap unless reinforced by core or adjacent task evidence",
            }
        )

    if safe_list(leakage_report.get("jobs_ranking_high_despite_avoid_task_overlap")):
        recommendations.append(
            {
                "recommendation": "increase avoid task penalty",
                "reason": "avoid-task overlap comes from explicit CV avoid/deal-breaker evidence",
                "suggested_change": "increase avoid_task_overlap_penalty only for CV-derived avoid tasks",
            }
        )

    if safe_list(leakage_report.get("jobs_with_avoid_task_overlap_still_too_high")):
        recommendations.append(
            {
                "recommendation": "strengthen avoid task penalty",
                "reason": "jobs with explicit CV-derived avoid-task overlap still appear in high-ranking results",
                "suggested_change": "push avoid-task overlap below top 10 unless also supported by strong core-task evidence",
            }
        )

    if not recommendations:
        recommendations.append(
            {
                "recommendation": "no weight change suggested",
                "reason": "no clear leakage pattern detected in the current fixture",
                "suggested_change": "keep current diagnostic weights",
            }
        )

    return recommendations


def summarize_weighted_contributions(breakdowns: Sequence[Mapping[str, Any]]) -> list[dict[str, Any]]:
    """Aggregate average weighted contribution by signal across evaluated jobs."""
    if not breakdowns:
        return []

    totals = {name: 0.0 for name in SIGNAL_WEIGHTS}
    active_counts = {name: 0 for name in SIGNAL_WEIGHTS}

    for breakdown in safe_list(breakdowns):
        if not isinstance(breakdown, Mapping):
            continue
        contributions = safe_dict(breakdown.get("weighted_contributions"))
        for name, contribution in contributions.items():
            if name not in totals:
                continue
            totals[name] += contribution
            if contribution != 0:
                active_counts[name] += 1

    return [
        {
            "name": name,
            "label": SIGNAL_LABELS[name],
            "average_contribution": round(totals[name] / len(breakdowns), 3),
            "active_jobs": active_counts[name],
            "weight": SIGNAL_WEIGHTS[name],
        }
        for name in SIGNAL_WEIGHTS
    ]


def compare_top_expected_vs_actual(
    actual_ranking: Sequence[str],
    expected_top_ranking: Sequence[str],
    top_k: int = 10,
) -> list[dict[str, Any]]:
    """Compare top expected and top actual rankings side by side."""
    rows = []
    actual_ranking = safe_list(actual_ranking)
    expected_top_ranking = safe_list(expected_top_ranking)
    for index in range(top_k):
        actual_id = actual_ranking[index] if index < len(actual_ranking) else None
        expected_id = expected_top_ranking[index] if index < len(expected_top_ranking) else None
        rows.append(
            {
                "rank": index + 1,
                "actual_id": actual_id,
                "expected_id": expected_id,
                "match": actual_id == expected_id,
            }
        )
    return rows


def explain_biggest_ranking_mistakes(
    breakdowns: Sequence[Mapping[str, Any]],
    actual_ranking: Sequence[str],
    expected_top_ranking: Sequence[str],
    top_k: int = 10,
    limit: int = 8,
) -> list[dict[str, Any]]:
    """Explain the biggest gaps between actual top jobs and expected top jobs."""
    breakdown_by_id = {
        breakdown.get("job_id"): breakdown
        for breakdown in safe_list(breakdowns)
        if isinstance(breakdown, Mapping) and breakdown.get("job_id")
    }
    actual_ranking = safe_list(actual_ranking)
    expected_top_ranking = safe_list(expected_top_ranking)
    actual_top = actual_ranking[:top_k]
    expected_top = expected_top_ranking[:top_k]
    actual_set = safe_set(actual_top)
    expected_set = safe_set(expected_top)
    mistakes: list[dict[str, Any]] = []

    for job_id in expected_top:
        if job_id not in actual_set:
            expected_rank = expected_top.index(job_id) + 1
            actual_rank = _rank_of(job_id, actual_ranking)
            severity = top_k - expected_rank + 1
            if actual_rank:
                severity += min(5, actual_rank - expected_rank)
            mistakes.append(
                _mistake(
                    kind="expected_missing_from_actual_top",
                    job_id=job_id,
                    severity=severity,
                    expected_rank=expected_rank,
                    actual_rank=actual_rank,
                    breakdown=breakdown_by_id.get(job_id),
                )
            )

    for job_id in actual_top:
        if job_id not in expected_set:
            actual_rank = actual_top.index(job_id) + 1
            expected_rank = _rank_of(job_id, expected_top_ranking)
            severity = top_k - actual_rank + 1
            mistakes.append(
                _mistake(
                    kind="unexpected_actual_top_job",
                    job_id=job_id,
                    severity=severity,
                    expected_rank=expected_rank,
                    actual_rank=actual_rank,
                    breakdown=breakdown_by_id.get(job_id),
                )
            )

    for job_id in expected_set & actual_set:
        actual_rank = actual_top.index(job_id) + 1
        expected_rank = expected_top.index(job_id) + 1
        delta = actual_rank - expected_rank
        if abs(delta) >= 3:
            mistakes.append(
                _mistake(
                    kind="large_rank_shift",
                    job_id=job_id,
                    severity=abs(delta),
                    expected_rank=expected_rank,
                    actual_rank=actual_rank,
                    breakdown=breakdown_by_id.get(job_id),
                )
            )

    return sorted(mistakes, key=lambda item: item["severity"], reverse=True)[:limit]


_EXPLICIT_DOMAIN_KEYS = {
    "domain",
    "domains",
    "industry",
    "industries",
    "sector",
    "sectors",
    "targetDomain",
    "targetDomains",
    "targetIndustry",
    "targetIndustries",
    "preferredIndustries",
}
_TARGET_ROLE_KEYS = {
    "target_roles",
    "targetRoles",
    "preferredRoles",
    "bestFitRoles",
    "desiredRoles",
    "searchTerms",
}
_ROLE_HISTORY_KEYS = {
    "currentRole",
    "currentRoles",
    "currentTitle",
    "pastRole",
    "pastRoles",
    "pastTitle",
    "experience",
    "workExperience",
    "jobTitle",
    "jobTitles",
    "position",
    "positions",
    "role",
    "roles",
    "title",
}
_KEYWORD_KEYS = {
    "strongKeywords",
    "keywords",
    "searchTerms",
    "profileSummary",
    "summary",
    "cvHighlights",
}
_HIGHLIGHT_KEYS = {"cvHighlights", "highlights", "achievements", "summary", "profileSummary"}
_SKILL_KEYS = {
    "skills",
    "skillTags",
    "hardSkills",
    "softSkills",
    "tools",
    "certifications",
}
_ACCEPTABLE_ROLE_KEYS = {"acceptableRoles", "secondaryRoles"}
_WEAK_ROLE_KEYS = {"weakFitRoles", "weakRoles"}
_AVOID_KEYS = {"avoidKeywords", "avoidRoles", "dealBreakers", "excludedDomains", "excludedIndustries"}


def _weighted_signal(name: str, signal_input: Mapping[str, Any]) -> dict[str, Any]:
    signal_input = safe_dict(signal_input)
    weight = SIGNAL_WEIGHTS[name]
    strength = max(0.0, min(1.0, float(signal_input.get("strength", 0.0) or 0.0)))
    contribution = round(weight * strength, 3)
    return {
        "name": name,
        "label": SIGNAL_LABELS[name],
        "direction": "positive" if weight >= 0 else "negative",
        "weight": weight,
        "strength": round(strength, 3),
        "contribution": contribution,
        "evidence": safe_list(signal_input.get("evidence"))[:6],
    }


def _role_match(title_text: str, job_text: str, role_terms: Sequence[str]) -> dict[str, Any]:
    title_matches = _matched_terms(title_text, role_terms)
    text_matches = _matched_terms(job_text, role_terms)
    matches = _unique(title_matches + text_matches)
    strength = min((len(title_matches) * 0.6) + (len(matches) * 0.2), 1.0)
    return {
        "strength": strength,
        "evidence": matches or ["no CV target role terms matched"],
    }


def _keyword_match(job: Mapping[str, Any], job_text: str, keyword_terms: Sequence[str]) -> dict[str, Any]:
    matched_keywords = [
        str(value)
        for value in _as_list(job.get("matchedKeywords"))
        if str(value).strip()
    ]
    text_matches = _matched_terms(job_text, keyword_terms)
    matches = _unique(matched_keywords + text_matches)
    return {
        "strength": min(len(matches) / 6, 1.0),
        "evidence": matches or ["no CV keyword terms matched"],
    }


def _location_fit(job: Mapping[str, Any], cv_profile: Mapping[str, Any]) -> dict[str, Any]:
    job_location = _normalize_text(str(job.get("location", "")))
    profile_locations = [_normalize_text(str(value)) for value in _as_list(cv_profile.get("locations"))]
    if not job_location:
        return {"strength": 0.0, "evidence": ["missing job location"]}

    for profile_location in profile_locations:
        if profile_location and (
            profile_location in job_location or job_location in profile_location
        ):
            return {"strength": 1.0, "evidence": [str(job.get("location", "")).strip()]}

    profile_text = " ".join(profile_locations)
    if "remoto" in job_location or "remote" in job_location:
        if "remoto" in profile_text or "remote" in profile_text or "svizzera" in profile_text:
            return {"strength": 0.9, "evidence": [str(job.get("location", "")).strip(), "remote compatible"]}
        return {"strength": 0.5, "evidence": [str(job.get("location", "")).strip(), "remote"]}

    if "ticino" in job_location and any("lugano" in value for value in profile_locations):
        return {"strength": 0.75, "evidence": [str(job.get("location", "")).strip(), "same region as Lugano"]}

    if "svizzera" in job_location or "schweiz" in job_location:
        return {"strength": 0.6, "evidence": [str(job.get("location", "")).strip(), "Swiss location"]}

    return {"strength": 0.0, "evidence": [str(job.get("location", "")).strip(), "no preferred location match"]}


def _distance_fit(job: Mapping[str, Any], cv_profile: Mapping[str, Any]) -> dict[str, Any]:
    distance_score = job.get("distanceScore")
    if isinstance(distance_score, (int, float)):
        evidence = [f"distanceScore={distance_score:g}"]
        distance_km = job.get("distanceKm")
        if isinstance(distance_km, (int, float)):
            evidence.append(f"distanceKm={distance_km:g}")
        return {"strength": max(0.0, min(float(distance_score) / 100, 1.0)), "evidence": evidence}

    location = _location_fit(job, cv_profile)
    if location["strength"] >= 0.9:
        return {"strength": 0.8, "evidence": ["fallback from strong location fit"]}
    if location["strength"] >= 0.6:
        return {"strength": 0.6, "evidence": ["fallback from partial location fit"]}
    if str(job.get("location", "")).strip():
        return {"strength": 0.35, "evidence": ["fallback, no distance data"]}
    return {"strength": 0.0, "evidence": ["missing distance and location"]}


def _sales_outbound_penalty(job_text: str, cv_domains: Mapping[str, Any]) -> dict[str, Any]:
    matches = _matched_terms(job_text, SALES_OUTBOUND_TERMS)
    if not matches:
        return {"strength": 0.0, "evidence": ["no sales/outbound terms detected"]}

    cv_domains = safe_dict(cv_domains)
    target_domains = safe_set(cv_domains.get("target_domains"))
    acceptable_domains = safe_set(cv_domains.get("acceptable_domains"))
    if "sales" in target_domains or "sales" in acceptable_domains:
        return {"strength": 0.0, "evidence": ["sales is aligned with this CV target/acceptable domains"]}

    avoid_domains = safe_set(cv_domains.get("avoid_domains"))
    strength = 1.0 if "sales" in avoid_domains else 0.65
    return {
        "strength": strength,
        "evidence": matches + ["sales is not a target domain for this CV"],
    }


def _low_domain_alignment_penalty(
    alignment: Mapping[str, Any],
    cv_domains: Mapping[str, Any],
) -> dict[str, Any]:
    cv_domains = safe_dict(cv_domains)
    alignment = safe_dict(alignment)
    score = float(alignment.get("domain_alignment_score", 0.0) or 0.0)
    if not cv_domains.get("clear_target_domain"):
        return {"strength": 0.0, "evidence": ["CV target domain is not clear enough for a hard penalty"]}
    if score >= 0.45:
        return {"strength": 0.0, "evidence": ["domain alignment is not low"]}
    return {
        "strength": min((0.45 - score) / 0.45, 1.0),
        "evidence": safe_list(alignment.get("why")),
    }


def _weak_detail_penalty(job: Mapping[str, Any]) -> dict[str, Any]:
    source_name = _normalize_text(str(job.get("sourceName", "")))
    detail_text = " ".join(
        [
            str(job.get("fullDescription", "")),
            str(job.get("snippet", "")),
            " ".join(str(value) for value in _as_list(job.get("requirements"))),
            " ".join(str(value) for value in _as_list(job.get("responsibilities"))),
        ]
    ).strip()
    detail_length = len(detail_text)
    evidence = [f"detail chars={detail_length}"]

    if "search preview" in source_name:
        evidence.append("search preview source")
        return {"strength": 0.75, "evidence": evidence}
    if detail_length < 80:
        return {"strength": 0.6, "evidence": evidence}
    if detail_length < 140 and not _as_list(job.get("requirements")):
        return {"strength": 0.35, "evidence": evidence + ["few structured requirements"]}
    return {"strength": 0.0, "evidence": evidence}


def _profile_terms(cv_profile: Mapping[str, Any]) -> dict[str, list[str]]:
    role_terms = _profile_values_by_keys(cv_profile, _TARGET_ROLE_KEYS | _ACCEPTABLE_ROLE_KEYS)
    keyword_terms = _profile_values_by_keys(cv_profile, _KEYWORD_KEYS | _SKILL_KEYS | _TARGET_ROLE_KEYS)
    task_terms = _profile_values_by_keys(cv_profile, _TARGET_ROLE_KEYS | _KEYWORD_KEYS)
    skill_terms = _profile_values_by_keys(cv_profile, _SKILL_KEYS)
    return {
        "role_terms": _unique(_normalize_text(term) for term in role_terms if str(term).strip()),
        "keyword_terms": _unique(_normalize_text(term) for term in keyword_terms if str(term).strip()),
        "task_terms": _unique(_normalize_text(term) for term in task_terms if str(term).strip()),
        "skill_terms": _unique(_normalize_text(term) for term in skill_terms if str(term).strip()),
    }


def _score_domains_from_sources(
    weighted_sources: Sequence[tuple[str, float, Sequence[Any]]],
) -> dict[str, dict[str, Any]]:
    scores: dict[str, dict[str, Any]] = {}
    for source_name, weight, values in (weighted_sources or []):
        for value in safe_list(values):
            text = _normalize_text(str(value))
            if not text:
                continue
            for domain, terms in DOMAIN_CATALOG.items():
                matches = _matched_terms(text, terms)
                if not matches:
                    continue
                entry = scores.setdefault(domain, {"score": 0.0, "evidence": [], "sources": []})
                entry["score"] = round(float(entry["score"]) + weight * min(len(matches), 3), 3)
                entry["evidence"].extend(matches[:4])
                entry["sources"].append(source_name)

    for entry in scores.values():
        entry["evidence"] = _unique(entry["evidence"])[:8]
        entry["sources"] = _unique(entry["sources"])
    return scores


def _score_tasks_from_sources(
    weighted_sources: Sequence[tuple[str, float, Sequence[Any]]],
) -> dict[str, dict[str, Any]]:
    scores: dict[str, dict[str, Any]] = {}
    for source_name, weight, values in (weighted_sources or []):
        for value in safe_list(values):
            text = _normalize_text(str(value))
            if not text:
                continue
            for task, terms in TASK_CATALOG.items():
                matches = _matched_terms(text, terms)
                if not matches:
                    continue
                entry = scores.setdefault(task, {"score": 0.0, "evidence": [], "sources": []})
                entry["score"] = round(float(entry["score"]) + weight * min(len(matches), 3), 3)
                entry["evidence"].extend(matches[:4])
                entry["sources"].append(source_name)

    for entry in scores.values():
        entry["evidence"] = _unique(entry["evidence"])[:8]
        entry["sources"] = _unique(entry["sources"])
    return scores


def _ranked_domain_names(domain_scores: Mapping[str, Mapping[str, Any]], min_score: float) -> list[str]:
    return [
        domain
        for domain, data in sorted(
            safe_dict(domain_scores).items(),
            key=lambda item: (-float(safe_dict(item[1]).get("score", 0.0) or 0.0), item[0]),
        )
        if float(safe_dict(data).get("score", 0.0) or 0.0) >= min_score
    ]


def _ranked_task_names(task_scores: Mapping[str, Mapping[str, Any]], min_score: float) -> list[str]:
    return [
        task
        for task, data in sorted(
            safe_dict(task_scores).items(),
            key=lambda item: (-float(safe_dict(item[1]).get("score", 0.0) or 0.0), item[0]),
        )
        if float(safe_dict(data).get("score", 0.0) or 0.0) >= min_score
    ]


def _primary_domain_names(
    domain_scores: Mapping[str, Mapping[str, Any]],
    ranked_domains: Sequence[str],
) -> list[str]:
    ranked_domains = safe_list(ranked_domains)
    domain_scores = safe_dict(domain_scores)
    if not ranked_domains:
        return []

    non_generic_domains = [
        domain for domain in ranked_domains if domain not in GENERIC_FUNCTIONAL_DOMAINS
    ]
    candidates = non_generic_domains or list(ranked_domains)
    max_score = max(float(safe_dict(domain_scores.get(domain)).get("score", 0.0) or 0.0) for domain in candidates)
    threshold = max(max_score * 0.75, max_score - 1.5)
    return [
        domain
        for domain in candidates
        if float(safe_dict(domain_scores.get(domain)).get("score", 0.0) or 0.0) >= threshold
    ]


def _primary_task_names(
    task_scores: Mapping[str, Mapping[str, Any]],
    ranked_tasks: Sequence[str],
) -> list[str]:
    ranked_tasks = safe_list(ranked_tasks)
    task_scores = safe_dict(task_scores)
    if not ranked_tasks:
        return []

    non_generic_tasks = [
        task for task in ranked_tasks if task not in GENERIC_TASK_GROUPS
    ]
    candidates = non_generic_tasks or list(ranked_tasks)
    max_score = max(float(safe_dict(task_scores.get(task)).get("score", 0.0) or 0.0) for task in candidates)
    threshold = max(max_score * 0.72, max_score - 1.5)
    return [
        task
        for task in candidates
        if float(safe_dict(task_scores.get(task)).get("score", 0.0) or 0.0) >= threshold
    ]


def _task_specificity_score(
    task_scores: Mapping[str, Mapping[str, Any]],
    ranked_tasks: Sequence[str],
) -> float:
    ranked_tasks = safe_list(ranked_tasks)
    task_scores = safe_dict(task_scores)
    if not ranked_tasks:
        return 0.0

    total_score = sum(float(safe_dict(task_scores.get(task)).get("score", 0.0) or 0.0) for task in ranked_tasks)
    if total_score == 0:
        return 0.0

    specific_score = sum(
        float(safe_dict(task_scores.get(task)).get("score", 0.0) or 0.0)
        for task in ranked_tasks
        if task not in GENERIC_TASK_GROUPS
    )
    return round(specific_score / total_score, 3)


def _profile_values_by_keys(payload: Any, key_names: set[str]) -> list[Any]:
    values: list[Any] = []

    def visit(value: Any, key: str | None = None) -> None:
        if isinstance(value, Mapping):
            for child_key, child_value in value.items():
                visit(child_value, str(child_key))
        elif isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
            for item in value:
                visit(item, key)
        elif key in key_names and value is not None:
            values.append(value)

    visit(payload)
    return values


def _mistake(
    kind: str,
    job_id: str,
    severity: float,
    expected_rank: int | None,
    actual_rank: int | None,
    breakdown: Mapping[str, Any] | None,
) -> dict[str, Any]:
    if breakdown:
        breakdown = safe_dict(breakdown)
        top_positive = sorted(
            [signal for signal in safe_list(breakdown.get("positive_signals")) if isinstance(signal, Mapping)],
            key=lambda signal: signal.get("contribution", 0.0),
            reverse=True,
        )[:3]
        top_negative = sorted(
            [signal for signal in safe_list(breakdown.get("negative_signals")) if isinstance(signal, Mapping)],
            key=lambda signal: signal.get("contribution", 0.0),
        )[:3]
        title = breakdown.get("title", "")
        weighted_total = breakdown.get("weighted_total", 0.0)
        alignment = safe_dict(breakdown.get("domain_alignment"))
    else:
        top_positive = []
        top_negative = []
        title = ""
        weighted_total = 0.0
        alignment = {}

    return {
        "kind": kind,
        "job_id": job_id,
        "title": title,
        "severity": round(float(severity), 3),
        "expected_rank": expected_rank,
        "actual_rank": actual_rank,
        "weighted_total": weighted_total,
        "domain_alignment_score": alignment.get("domain_alignment_score"),
        "top_positive_signals": top_positive,
        "top_negative_signals": top_negative,
        "explanation": _mistake_explanation(kind, expected_rank, actual_rank, top_positive, top_negative, alignment),
    }


def _mistake_explanation(
    kind: str,
    expected_rank: int | None,
    actual_rank: int | None,
    top_positive: Sequence[Mapping[str, Any]],
    top_negative: Sequence[Mapping[str, Any]],
    alignment: Mapping[str, Any],
) -> str:
    positive_labels = ", ".join(str(signal.get("label", "unknown")) for signal in top_positive) or "no strong positive signals"
    negative_labels = ", ".join(str(signal.get("label", "unknown")) for signal in top_negative) or "no strong negative signals"
    domain_why = "; ".join(str(value) for value in safe_list(safe_dict(alignment).get("why"))) or "domain alignment unavailable"

    if kind == "unexpected_actual_top_job":
        return (
            f"Actual rank #{actual_rank} is inside the top results but expected rank is "
            f"{expected_rank or 'outside expected top'}; domain: {domain_why}; "
            f"positives: {positive_labels}; penalties: {negative_labels}."
        )
    if kind == "expected_missing_from_actual_top":
        return (
            f"Expected rank #{expected_rank} is missing from actual top results "
            f"(actual rank {actual_rank or 'not found'}); domain: {domain_why}; "
            f"positives: {positive_labels}; penalties: {negative_labels}."
        )
    return (
        f"Expected rank #{expected_rank} and actual rank #{actual_rank} differ materially; "
        f"domain: {domain_why}; positives: {positive_labels}; penalties: {negative_labels}."
    )


def _leakage_item(breakdown: Mapping[str, Any]) -> dict[str, Any]:
    breakdown = safe_dict(breakdown)
    domain_alignment = safe_dict(breakdown.get("domain_alignment"))
    task_alignment = safe_dict(breakdown.get("task_alignment"))
    job_domains = safe_dict(breakdown.get("job_domains"))
    job_tasks = safe_dict(breakdown.get("job_tasks"))
    return {
        "job_id": breakdown.get("job_id", ""),
        "title": breakdown.get("title", ""),
        "actual_rank": breakdown.get("actual_rank"),
        "source_score": breakdown.get("source_score"),
        "domain_alignment_score": domain_alignment.get("domain_alignment_score", 0.0),
        "task_alignment_score": task_alignment.get("task_alignment_score", 0.0),
        "detected_job_domains": safe_list(job_domains.get("detected_domains")),
        "detected_job_tasks": safe_list(job_tasks.get("detected_tasks")),
        "matching_domains": safe_list(domain_alignment.get("matching_domains")),
        "matching_tasks": safe_list(task_alignment.get("matching_tasks")),
        "core_task_overlap": safe_list(task_alignment.get("core_task_overlap")),
        "adjacent_task_overlap": safe_list(task_alignment.get("adjacent_task_overlap")),
        "generic_task_overlap": safe_list(task_alignment.get("generic_task_overlap")),
        "task_importance_score": task_alignment.get("task_importance_score", 0.0),
        "generic_leakage_risk": task_alignment.get("generic_leakage_risk", 0.0),
        "mismatching_domains": safe_list(domain_alignment.get("mismatching_domains")),
        "mismatching_tasks": safe_list(task_alignment.get("mismatching_tasks")),
        "avoid_task_overlap": safe_list(task_alignment.get("avoid_task_overlap")),
        "generic_keyword_risk": safe_dict(breakdown.get("generic_keyword_risk")),
        "generic_task_risk": safe_dict(task_alignment.get("generic_task_risk")),
        "why": safe_list(domain_alignment.get("why")),
        "task_why": safe_list(task_alignment.get("why")),
    }


def _leakage_item_with_core_below(
    breakdown: Mapping[str, Any],
    breakdowns: Sequence[Mapping[str, Any]],
) -> dict[str, Any]:
    item = _leakage_item(breakdown)
    item["more_specific_core_task_jobs_below"] = [
        {
            "job_id": candidate.get("job_id"),
            "actual_rank": candidate.get("actual_rank"),
            "core_task_overlap": safe_list(safe_dict(candidate.get("task_alignment")).get("core_task_overlap")),
        }
        for candidate in _core_task_jobs_below(breakdown, breakdowns)[:5]
    ]
    return item


def _has_generic_task_leakage(breakdown: Mapping[str, Any]) -> bool:
    task_alignment = safe_dict(safe_dict(breakdown).get("task_alignment"))
    return (
        float(task_alignment.get("generic_leakage_risk", 0.0) or 0.0) >= 0.6
        or (
            bool(safe_list(task_alignment.get("generic_task_overlap")))
            and not safe_list(task_alignment.get("core_task_overlap"))
            and not safe_list(task_alignment.get("adjacent_task_overlap"))
        )
    )


def _core_task_jobs_below(
    breakdown: Mapping[str, Any],
    breakdowns: Sequence[Mapping[str, Any]],
) -> list[Mapping[str, Any]]:
    rank = int(safe_dict(breakdown).get("actual_rank", 10_000) or 10_000)
    candidates = []
    for candidate in safe_list(breakdowns):
        if not isinstance(candidate, Mapping):
            continue
        candidate_rank = int(candidate.get("actual_rank", 10_000) or 10_000)
        candidate_alignment = safe_dict(candidate.get("task_alignment"))
        if candidate_rank > rank and safe_list(candidate_alignment.get("core_task_overlap")):
            candidates.append(candidate)
    return candidates


def _signal_strength(breakdown: Mapping[str, Any], signal_name: str) -> float:
    for signal in safe_list(safe_dict(breakdown).get("signals")):
        if isinstance(signal, Mapping) and signal.get("name") == signal_name:
            return float(signal.get("strength", 0.0) or 0.0)
    return 0.0


def _collect_job_text(job: Mapping[str, Any]) -> str:
    values: list[str] = []
    for key in (
        "title",
        "company",
        "location",
        "snippet",
        "fullDescription",
        "previewSummary",
        "keyword",
        "fitLabel",
        "sourceName",
    ):
        values.append(str(job.get(key, "")))
    for key in (
        "matchedKeywords",
        "missingKeywords",
        "riskFlags",
        "requirements",
        "responsibilities",
        "benefits",
        "highlights",
    ):
        values.extend(str(value) for value in _as_list(job.get(key)))
    return " ".join(values)


def _matched_terms(text: str, terms: Sequence[str]) -> list[str]:
    matches = []
    for term in safe_list(terms):
        normalized_term = _normalize_text(str(term))
        if not normalized_term:
            continue
        if _term_in_text(text, normalized_term):
            matches.append(str(term))
    return _unique(matches)


def _overlap_strength(text: str, terms: Sequence[str], exclude_generic: bool = False) -> float:
    usable_terms = [
        term
        for term in safe_list(terms)
        if term and (not exclude_generic or not _is_generic_keyword_term(term))
    ]
    if not usable_terms:
        return 0.0

    matches = _matched_terms(text, usable_terms)
    return min(len(matches) / min(len(usable_terms), 6), 1.0)


def _generic_overlap_ratio(evidence: Sequence[Any]) -> float:
    usable = [
        str(value)
        for value in safe_list(evidence)
        if str(value).strip() and not str(value).startswith("no CV ")
    ]
    if not usable:
        return 0.0

    generic_count = sum(1 for value in usable if _is_generic_keyword_term(value))
    return round(generic_count / len(usable), 3)


def _generic_task_overlap_ratio(
    overlap_tasks: Sequence[str],
    job_tasks: Mapping[str, Any],
    cv_tasks: Mapping[str, Any],
) -> float:
    job_tasks = safe_dict(job_tasks)
    usable = safe_list(overlap_tasks)
    if not usable:
        usable = safe_list(job_tasks.get("detected_tasks"))
    if not usable:
        return 0.0

    generic_count = sum(1 for task in usable if _task_is_generic_noise(task, cv_tasks))
    return round(generic_count / len(usable), 3)


def _generic_task_risk(
    generic_task_overlap_ratio: float,
    task_alignment_score: float,
    matching_tasks: Sequence[str],
    cv_tasks: Mapping[str, Any],
) -> dict[str, Any]:
    generic_task_overlap_ratio = float(generic_task_overlap_ratio or 0.0)
    task_alignment_score = float(task_alignment_score or 0.0)
    generic_matches = [
        task for task in safe_list(matching_tasks) if _task_is_generic_noise(task, cv_tasks)
    ]
    risk_score = 0.0

    if task_alignment_score >= 0.95 and generic_task_overlap_ratio < 0.35:
        return {
            "risk_score": 0.0,
            "generic_tasks": generic_matches,
            "why": ["generic task risk not detected because task alignment is strong"],
        }
    if task_alignment_score >= 0.85 and generic_task_overlap_ratio < 0.25:
        return {
            "risk_score": 0.0,
            "generic_tasks": generic_matches,
            "why": ["generic task risk not detected because task alignment is strong"],
        }

    if generic_task_overlap_ratio >= 0.75 and task_alignment_score < 0.65:
        risk_score = 1.0
    elif generic_task_overlap_ratio >= 0.5 and task_alignment_score < 0.55:
        risk_score = 0.7
    elif generic_task_overlap_ratio >= 0.35 and task_alignment_score < 0.9:
        risk_score = 0.4
    elif generic_task_overlap_ratio >= 0.5 and generic_matches:
        risk_score = 0.4

    if risk_score:
        why = [
            "generic task overlap may be dominating task alignment: "
            + ", ".join(generic_matches or ["generic job tasks"])
        ]
    else:
        why = ["generic task risk not detected"]

    return {
        "risk_score": risk_score,
        "generic_tasks": generic_matches,
        "why": why,
    }


def _task_depth_score(
    task_scores: Mapping[str, Any],
    tasks: Sequence[str],
) -> float:
    """Estimate whether task evidence appears across role/title, description, and keywords."""
    tasks = safe_list(tasks)
    if not tasks:
        return 0.0

    sources = set()
    evidence_count = 0
    for task in tasks:
        data = safe_dict(safe_dict(task_scores).get(task))
        sources.update(str(source) for source in safe_list(data.get("sources")))
        evidence_count += len(safe_list(data.get("evidence")))

    source_depth = min(len(sources) / 3, 1.0)
    evidence_depth = min(evidence_count / max(len(tasks) * 3, 1), 1.0)
    return round((source_depth * 0.6) + (evidence_depth * 0.4), 3)


def _task_evidence_strength(
    task_scores: Mapping[str, Any],
    tasks: Sequence[str],
) -> float:
    """Estimate how concrete the overlapping task evidence is for the job."""
    tasks = safe_list(tasks)
    if not tasks:
        return 0.0

    total_score = sum(_task_score(task_scores, str(task)) for task in tasks)
    return round(min(total_score / max(len(tasks) * 4.0, 1), 1.0), 3)


def _task_score(task_scores: Mapping[str, Any], task: str) -> float:
    return float(safe_dict(task_scores.get(task)).get("score", 0.0) or 0.0)


def _task_hierarchy_reason(
    core_tasks: Sequence[str],
    adjacent_tasks: Sequence[str],
    generic_tasks: Sequence[str],
    avoid_tasks: Sequence[str],
) -> list[str]:
    reasons = []
    if core_tasks:
        reasons.append("core tasks come from primary target roles/keywords/skills: " + ", ".join(core_tasks))
    if adjacent_tasks:
        reasons.append("adjacent tasks come from acceptable/weak-fit CV evidence: " + ", ".join(adjacent_tasks))
    if generic_tasks:
        reasons.append("generic tasks are broad/supportive CV evidence: " + ", ".join(generic_tasks))
    if avoid_tasks:
        reasons.append("avoid tasks come from explicit avoid/deal-breaker CV evidence: " + ", ".join(avoid_tasks))
    return reasons or ["no clear CV task hierarchy detected"]


def _generic_leakage_risk_from_importance(
    *,
    core_overlap: Sequence[str],
    adjacent_overlap: Sequence[str],
    generic_overlap: Sequence[str],
    avoid_overlap: Sequence[str],
    clear_target_tasks: bool,
    task_specificity_score: float = 0.0,
    detected_task_count: int = 0,
) -> float:
    if avoid_overlap:
        return 1.0
    if core_overlap:
        if not generic_overlap:
            return 0.0
        try:
            specificity = max(0.0, min(1.0, float(task_specificity_score or 0.0)))
        except (TypeError, ValueError):
            specificity = 0.0
        try:
            task_count = max(int(detected_task_count or 0), 0)
        except (TypeError, ValueError):
            task_count = 0
        task_count = max(task_count, len(core_overlap) + len(adjacent_overlap) + len(generic_overlap))
        generic_share = len(generic_overlap) / max(task_count, 1)
        core_is_cv_targeted_generic = all(task in GENERIC_TASK_GROUPS for task in core_overlap)
        if core_is_cv_targeted_generic:
            return 0.15
        if not adjacent_overlap and generic_share >= 0.5 and specificity < 0.55:
            return 0.45
        if not adjacent_overlap and generic_share >= 0.33 and specificity < 0.45:
            return 0.35
        if generic_share >= 0.5 and specificity < 0.4:
            return 0.35
        return 0.15
    if adjacent_overlap and generic_overlap:
        return 0.35
    if adjacent_overlap:
        return 0.15
    if generic_overlap and clear_target_tasks:
        return 0.9
    if generic_overlap:
        return 0.55
    return 0.0


def _task_is_generic_noise(task: str, cv_tasks: Mapping[str, Any]) -> bool:
    if task not in GENERIC_TASK_GROUPS:
        return False
    primary_target = safe_set(safe_dict(cv_tasks).get("primary_target_tasks"))
    return task not in primary_target


def _is_generic_keyword_term(value: Any) -> bool:
    return _contains_any(_normalize_text(str(value)), GENERIC_KEYWORD_TERMS)


def _contains_any(text: str, terms: Sequence[str]) -> bool:
    return bool(_matched_terms(text, terms))


def _term_in_text(text: str, term: str) -> bool:
    if len(term) <= 3:
        return re.search(rf"(^|[^a-z0-9]){re.escape(term)}([^a-z0-9]|$)", text) is not None
    return term in text


def _is_adjacent_to_any(domain: str, target_domains: set[str]) -> bool:
    if not target_domains:
        return False
    return any(domain in group and bool(target_domains & group) for group in ADJACENT_DOMAIN_GROUPS)


def _is_adjacent_task_to_any(task: str, target_tasks: set[str]) -> bool:
    if not target_tasks:
        return False
    return any(task in group and bool(target_tasks & group) for group in ADJACENT_TASK_GROUPS)


def _rank_of(job_id: str, ranking: Sequence[str]) -> int | None:
    try:
        return safe_list(ranking).index(job_id) + 1
    except ValueError:
        return None


def _safe_job_id(job: Mapping[str, Any]) -> str:
    try:
        normalized = normalize_job_ids([job])[0]
        if "|" in normalized:
            compact = "|".join(part for part in normalized.split("|") if part)
            return compact or normalized
        return normalized
    except (TypeError, ValueError, IndexError):
        title = str(job.get("title", "")).strip().lower()
        company = str(job.get("company", "")).strip().lower()
        location = str(job.get("location", "")).strip().lower()
        fallback = "|".join(part for part in (title, company, location) if part)
        return fallback or "unknown_job"


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_value = normalized.encode("ascii", "ignore").decode("ascii")
    return re.sub(r"\s+", " ", ascii_value.lower()).strip()


def _as_list(value: Any) -> list[Any]:
    return safe_list(value)


def _unique(values: Iterable[Any]) -> list[Any]:
    seen = set()
    result = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result
