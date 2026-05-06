"""CV-driven filter strategy diagnostics for local JobRadar AI evaluations."""

from __future__ import annotations

import re
import unicodedata
from collections.abc import Mapping, Sequence
from typing import Any

from diagnostics import detect_cv_domains, detect_cv_task_profile, safe_dict, safe_list


FILTER_NAMES = [
    "keyword_queries",
    "role_categories",
    "professional_field_category",
    "location_home_base",
    "radius_suggestions",
    "remote_hybrid_on_site_preference",
    "workload_percentage_preference",
    "seniority_level",
    "language_requirements",
    "salary_expectation",
    "target_domains",
    "target_task_groups",
    "avoid_domains_tasks",
    "must_have_skills",
    "nice_to_have_skills",
    "company_industry_preferences",
]

TARGET_ROLE_KEYS = {
    "targetroles",
    "preferredroles",
    "bestfitroles",
    "desiredroles",
    "roles",
    "role",
}
ACCEPTABLE_ROLE_KEYS = {"acceptableroles", "secondaryroles", "relatedroles"}
WEAK_ROLE_KEYS = {"weakfitroles", "fallbackroles", "exploratoryroles"}
KEYWORD_KEYS = {
    "searchterms",
    "searchqueries",
    "strongkeywords",
    "keywords",
    "targetkeywords",
    "skilltags",
}
LOCATION_KEYS = {
    "location",
    "locations",
    "preferredlocations",
    "homebase",
    "city",
    "region",
    "canton",
}
WORK_MODE_KEYS = {
    "workmode",
    "workmodes",
    "workmodepreference",
    "remotepreference",
    "remote",
    "hybrid",
    "onsite",
    "onsitepreference",
    "workpreferences",
}
WORKLOAD_KEYS = {
    "workload",
    "workloadpercentage",
    "employmentpercentage",
    "percentage",
    "employmenttype",
}
SENIORITY_KEYS = {
    "seniority",
    "level",
    "experience",
    "yearsexperience",
    "experienceyears",
}
LANGUAGE_KEYS = {"languages", "languagerequirements", "languageprofile"}
SALARY_KEYS = {
    "salary",
    "salaryexpectation",
    "expectedsalary",
    "compensation",
    "annualsalary",
}
MUST_SKILL_KEYS = {
    "musthaveskills",
    "hardskills",
    "strongkeywords",
    "tools",
    "certifications",
}
NICE_SKILL_KEYS = {
    "nicetohaveskills",
    "skilltags",
    "softskills",
    "tools",
    "certifications",
}
PREFERENCE_KEYS = {
    "companypreferences",
    "preferredcompanies",
    "preferredindustries",
    "industrypreferences",
    "industries",
    "domains",
}
AVOID_KEYS = {
    "avoidkeywords",
    "dealbreakers",
    "avoiddomains",
    "avoidtasks",
    "weakfitroles",
}

DOMAIN_FALLBACK_TERMS = {
    "healthcare": [
        "healthcare",
        "sanita",
        "medical",
        "medico",
        "patient",
        "patient care",
        "care",
        "clinical",
        "clinica",
        "clinic",
        "infermiere",
        "nurse",
        "pflege",
    ],
}


def build_filter_strategy(cv_profile: Mapping[str, Any]) -> dict[str, Any]:
    """Build a universal local filter strategy from CV evidence only."""
    cv_profile = safe_dict(cv_profile)
    cv_domains = detect_cv_domains(cv_profile)
    cv_tasks = detect_cv_task_profile(cv_profile)

    target_roles = _dedupe(_values_by_keys(cv_profile, TARGET_ROLE_KEYS))
    acceptable_roles = _dedupe(_values_by_keys(cv_profile, ACCEPTABLE_ROLE_KEYS))
    weak_roles = _dedupe(_values_by_keys(cv_profile, WEAK_ROLE_KEYS))
    keywords = _keyword_queries(cv_profile, target_roles)
    locations = _dedupe(_values_by_keys(cv_profile, LOCATION_KEYS))
    work_mode = _work_mode_preference(cv_profile)
    workload = _workload_preference(cv_profile)
    seniority = _seniority_level(cv_profile)
    languages = _dedupe(_values_by_keys(cv_profile, LANGUAGE_KEYS))
    salary = _salary_expectation(cv_profile)
    target_domains = _target_domains(cv_domains, cv_profile)
    target_tasks = safe_list(cv_tasks.get("target_tasks"))
    avoid_domains = safe_list(cv_domains.get("avoid_domains"))
    avoid_tasks = safe_list(cv_tasks.get("avoid_tasks"))
    avoid_terms = _dedupe(_values_by_keys(cv_profile, AVOID_KEYS))
    must_have_skills = _skills(cv_profile, MUST_SKILL_KEYS, limit=12)
    nice_to_have_skills = _skills(cv_profile, NICE_SKILL_KEYS, limit=12)
    company_preferences = _dedupe(_values_by_keys(cv_profile, PREFERENCE_KEYS))
    radius = _radius_suggestions(locations, work_mode.get("value"))
    target_domain_evidence = _domain_evidence(cv_domains, target_domains, cv_profile)

    filters = {
        "keyword_queries": _filter(
            keywords,
            0.82 if keywords else 0.0,
            _evidence_for_values(cv_profile, keywords),
        ),
        "role_categories": _filter(
            target_roles,
            0.9 if target_roles else 0.0,
            _evidence_for_values(cv_profile, target_roles),
        ),
        "professional_field_category": _filter(
            target_domains,
            0.86 if cv_domains.get("clear_target_domain") else 0.62 if target_domains else 0.0,
            target_domain_evidence,
            empty_value=[],
        ),
        "location_home_base": _filter(
            locations,
            0.82 if locations else 0.0,
            _evidence_for_values(cv_profile, locations),
        ),
        "radius_suggestions": _filter(
            radius,
            0.74 if radius else 0.0,
            locations,
        ),
        "remote_hybrid_on_site_preference": _filter(
            work_mode.get("value"),
            work_mode.get("confidence", 0.0),
            work_mode.get("evidence", []),
        ),
        "workload_percentage_preference": _filter(
            workload.get("value"),
            workload.get("confidence", 0.0),
            workload.get("evidence", []),
        ),
        "seniority_level": _filter(
            seniority.get("value"),
            seniority.get("confidence", 0.0),
            seniority.get("evidence", []),
        ),
        "language_requirements": _filter(
            languages,
            0.82 if languages else 0.0,
            _evidence_for_values(cv_profile, languages),
        ),
        "salary_expectation": _filter(
            salary.get("value"),
            salary.get("confidence", 0.0),
            salary.get("evidence", []),
        ),
        "target_domains": _filter(
            target_domains,
            0.88 if target_domains else 0.0,
            target_domain_evidence,
            empty_value=[],
        ),
        "target_task_groups": _filter(
            target_tasks,
            0.88 if target_tasks else 0.0,
            _score_evidence(cv_tasks.get("task_scores", {})),
            empty_value=[],
        ),
        "avoid_domains_tasks": _filter(
            {
                "domains": avoid_domains,
                "tasks": avoid_tasks,
                "terms": avoid_terms,
            },
            0.8 if avoid_domains or avoid_tasks or avoid_terms else 0.0,
            avoid_terms + avoid_domains + avoid_tasks,
        ),
        "must_have_skills": _filter(
            must_have_skills,
            0.82 if must_have_skills else 0.0,
            _evidence_for_values(cv_profile, must_have_skills),
        ),
        "nice_to_have_skills": _filter(
            nice_to_have_skills,
            0.66 if nice_to_have_skills else 0.0,
            _evidence_for_values(cv_profile, nice_to_have_skills),
        ),
        "company_industry_preferences": _filter(
            company_preferences,
            0.68 if company_preferences else 0.0,
            _evidence_for_values(cv_profile, company_preferences),
        ),
    }

    missing = [
        name
        for name in FILTER_NAMES
        if filters[name]["status"] != "detected"
    ]

    return {
        "profile_id": str(cv_profile.get("id", "")),
        "filters": filters,
        "missing_filter_information": missing,
        "detected_domains": cv_domains,
        "detected_tasks": cv_tasks,
        "search_strategy": _search_strategy(
            target_roles=target_roles,
            acceptable_roles=acceptable_roles,
            weak_roles=weak_roles,
            keywords=keywords,
            locations=locations,
            radius=radius,
            work_mode=work_mode.get("value"),
            workload=workload.get("value"),
            target_domains=target_domains,
            acceptable_domains=safe_list(cv_domains.get("acceptable_domains")),
            weak_domains=safe_list(cv_domains.get("weak_fit_domains")),
            target_tasks=target_tasks,
            acceptable_tasks=safe_list(cv_tasks.get("acceptable_tasks")),
            avoid_domains=avoid_domains,
            avoid_tasks=avoid_tasks,
        ),
    }


def _target_domains(cv_domains: Mapping[str, Any], cv_profile: Mapping[str, Any]) -> list[str]:
    detected_domains = _dedupe(str(value) for value in safe_list(cv_domains.get("target_domains")))
    if detected_domains:
        return detected_domains

    profile_text = _normalize_text(_profile_text(cv_profile))
    inferred_domains = []
    for domain, terms in DOMAIN_FALLBACK_TERMS.items():
        if _domain_terms_match(domain, terms, profile_text):
            inferred_domains.append(domain)
    return _dedupe(inferred_domains)


def _domain_evidence(
    cv_domains: Mapping[str, Any],
    target_domains: Sequence[str],
    cv_profile: Mapping[str, Any],
) -> list[str]:
    scored_evidence = _score_evidence(cv_domains.get("domain_scores", {}))
    if scored_evidence or not target_domains:
        return scored_evidence

    profile_text = _normalize_text(_profile_text(cv_profile))
    evidence = []
    for domain in target_domains:
        for term in DOMAIN_FALLBACK_TERMS.get(str(domain), []):
            if _domain_term_matches(str(domain), term, profile_text):
                evidence.append(term)
    return _dedupe(evidence)


def _domain_terms_match(domain: str, terms: Sequence[str], profile_text: str) -> bool:
    return any(_domain_term_matches(domain, term, profile_text) for term in terms)


def _domain_term_matches(domain: str, term: str, profile_text: str) -> bool:
    normalized_term = _normalize_text(term)
    if domain == "healthcare" and normalized_term == "care":
        return "care" in profile_text and "customer care" not in profile_text
    return normalized_term in profile_text


def _filter(
    value: Any,
    confidence: float,
    evidence: Sequence[Any],
    empty_value: Any = None,
) -> dict[str, Any]:
    clean_value = _clean_filter_value(value)
    status = "detected" if _has_value(clean_value) else "missing"
    return {
        "value": clean_value if _has_value(clean_value) else empty_value,
        "confidence": round(float(confidence), 2) if status == "detected" else 0.0,
        "status": status,
        "evidence": _dedupe([str(item) for item in safe_list(evidence) if str(item).strip()])[:12],
    }


def _search_strategy(
    *,
    target_roles: Sequence[str],
    acceptable_roles: Sequence[str],
    weak_roles: Sequence[str],
    keywords: Sequence[str],
    locations: Sequence[str],
    radius: Sequence[str],
    work_mode: Any,
    workload: Any,
    target_domains: Sequence[str],
    acceptable_domains: Sequence[str],
    weak_domains: Sequence[str],
    target_tasks: Sequence[str],
    acceptable_tasks: Sequence[str],
    avoid_domains: Sequence[str],
    avoid_tasks: Sequence[str],
) -> list[dict[str, Any]]:
    closest_radius = radius[:1] or ["missing"]
    broad_radius = radius[-1:] if radius else ["missing"]
    strongest_roles = list(target_roles[:4])
    fallback_roles = list(weak_roles[:4] or acceptable_roles[:4] or target_roles[:2])
    generic_queries = [
        term
        for term in keywords
        if term.lower() not in {role.lower() for role in strongest_roles}
    ][:5]

    return [
        {
            "wave": 1,
            "name": "strongest_roles_closest_locations",
            "purpose": "Use the strongest CV role/domain/task evidence with the closest practical geography.",
            "filters": {
                "roles": strongest_roles or ["missing"],
                "domains": list(target_domains[:4]) or ["missing"],
                "tasks": list(target_tasks[:5]) or ["missing"],
                "locations": list(locations[:3]) or ["missing"],
                "radius": closest_radius,
                "work_mode": work_mode or "missing",
                "workload": workload or "missing",
            },
        },
        {
            "wave": 2,
            "name": "adjacent_roles_domains",
            "purpose": "Expand only to roles or domains supported by acceptable CV evidence.",
            "filters": {
                "roles": list(acceptable_roles[:4]) or strongest_roles[:2] or ["missing"],
                "domains": list(acceptable_domains[:4]) or list(target_domains[:3]) or ["missing"],
                "tasks": list(acceptable_tasks[:5]) or list(target_tasks[:3]) or ["missing"],
                "locations": list(locations[:4]) or ["missing"],
                "radius": radius[:2] or ["missing"],
            },
        },
        {
            "wave": 3,
            "name": "broader_fallback_roles",
            "purpose": "Broaden cautiously when the first two waves do not return enough quality jobs.",
            "filters": {
                "roles": fallback_roles or ["missing"],
                "domains": list(weak_domains[:4]) or list(target_domains[:2]) or ["missing"],
                "tasks": list(target_tasks[:5]) or ["missing"],
                "locations": list(locations[:4]) or ["missing"],
                "radius": broad_radius,
            },
        },
        {
            "wave": 4,
            "name": "exploratory_generic_only_if_needed",
            "purpose": "Use broad keywords only after checking that generic overlap is not overpowering CV fit.",
            "filters": {
                "queries": generic_queries or list(keywords[:5]) or ["missing"],
                "locations": list(locations[:4]) or ["missing"],
                "radius": broad_radius,
                "guardrails_avoid_domains": list(avoid_domains) or ["missing"],
                "guardrails_avoid_tasks": list(avoid_tasks) or ["missing"],
            },
        },
    ]


def _keyword_queries(cv_profile: Mapping[str, Any], target_roles: Sequence[str]) -> list[str]:
    values = _values_by_keys(cv_profile, KEYWORD_KEYS)
    values.extend(target_roles)
    values = [
        value
        for value in values
        if len(value) >= 2 and not _looks_like_sentence(value)
    ]
    return _dedupe(values)[:10]


def _skills(cv_profile: Mapping[str, Any], keys: set[str], limit: int) -> list[str]:
    values = [
        value
        for value in _values_by_keys(cv_profile, keys)
        if len(value) >= 2 and not _looks_like_sentence(value)
    ]
    return _dedupe(values)[:limit]


def _work_mode_preference(cv_profile: Mapping[str, Any]) -> dict[str, Any]:
    values = _dedupe(_values_by_keys(cv_profile, WORK_MODE_KEYS))
    text = _normalize_text(" ".join(values) + " " + _profile_text(cv_profile))
    modes = []
    if "remote" in text or "remoto" in text:
        modes.append("remote")
    if "hybrid" in text or "ibrido" in text:
        modes.append("hybrid")
    if "on site" in text or "on-site" in text or "onsite" in text or "in sede" in text:
        modes.append("on-site")
    if not modes:
        return {"value": None, "confidence": 0.0, "evidence": []}
    return {"value": modes, "confidence": 0.76, "evidence": values or modes}


def _workload_preference(cv_profile: Mapping[str, Any]) -> dict[str, Any]:
    values = _dedupe(_values_by_keys(cv_profile, WORKLOAD_KEYS))
    text = " ".join(values) + " " + _profile_text(cv_profile)
    matches = re.findall(r"\b(?:[4-9]0|100)\s?%", text)
    if matches:
        return {"value": _dedupe(matches), "confidence": 0.82, "evidence": values + matches}
    if values:
        return {"value": values, "confidence": 0.7, "evidence": values}
    return {"value": None, "confidence": 0.0, "evidence": []}


def _seniority_level(cv_profile: Mapping[str, Any]) -> dict[str, Any]:
    values = _dedupe(_values_by_keys(cv_profile, SENIORITY_KEYS))
    text = _normalize_text(" ".join(values) + " " + _profile_text(cv_profile))
    levels = []
    if re.search(r"\b(junior|entry|stage|intern)\b", text):
        levels.append("junior")
    if re.search(r"\b(mid|middle|specialist|professional)\b", text):
        levels.append("mid")
    if re.search(r"\b(senior|lead|manager|head)\b", text):
        levels.append("senior")
    years = [int(value) for value in re.findall(r"\b(\d{1,2})\s*(?:years|anni|ans)\b", text)]
    if years:
        max_years = max(years)
        if max_years < 3:
            levels.append("junior")
        elif max_years < 8:
            levels.append("mid")
        else:
            levels.append("senior")
    levels = _dedupe(levels)
    if levels:
        return {"value": levels, "confidence": 0.72, "evidence": values or [f"{max(years)} years" if years else levels[0]]}
    return {"value": None, "confidence": 0.0, "evidence": []}


def _salary_expectation(cv_profile: Mapping[str, Any]) -> dict[str, Any]:
    values = _dedupe(_values_by_keys(cv_profile, SALARY_KEYS))
    text = " ".join(values) + " " + _profile_text(cv_profile)
    matches = re.findall(r"\b(?:CHF|EUR|USD)?\s?\d{2,3}(?:[ '\.]\d{3})\s?(?:CHF|EUR|USD)?\b", text, flags=re.IGNORECASE)
    if values:
        return {"value": values, "confidence": 0.78, "evidence": values}
    if matches:
        return {"value": _dedupe(matches), "confidence": 0.66, "evidence": matches}
    return {"value": None, "confidence": 0.0, "evidence": []}


def _radius_suggestions(locations: Sequence[str], work_mode: Any) -> list[str]:
    if not locations:
        return []
    normalized_modes = {str(value).lower() for value in _as_list(work_mode)}
    suggestions = ["10 km", "25 km", "50 km"]
    if "remote" in normalized_modes or any("remote" in _normalize_text(location) or "remoto" in _normalize_text(location) for location in locations):
        suggestions.append("Switzerland remote")
    else:
        suggestions.append("100 km fallback")
    return suggestions


def _score_evidence(scores: Mapping[str, Any]) -> list[str]:
    evidence = []
    for name, payload in safe_dict(scores).items():
        score = payload.get("score", 0.0) if isinstance(payload, Mapping) else 0.0
        if score > 0:
            evidence.append(f"{name}:{score:.1f}")
    return evidence


def _evidence_for_values(cv_profile: Mapping[str, Any], values: Sequence[str]) -> list[str]:
    all_text = _normalize_text(_profile_text(cv_profile))
    evidence = []
    for value in values:
        if _normalize_text(value) in all_text:
            evidence.append(value)
    return evidence or list(values)


def _values_by_keys(value: Any, keys: set[str]) -> list[str]:
    found: list[str] = []
    if isinstance(value, Mapping):
        for raw_key, raw_value in value.items():
            if _normalize_key(str(raw_key)) in keys:
                found.extend(_flatten_values(raw_value))
            found.extend(_values_by_keys(raw_value, keys))
    elif isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        for item in value:
            found.extend(_values_by_keys(item, keys))
    return _dedupe(found)


def _flatten_values(value: Any) -> list[str]:
    if isinstance(value, Mapping):
        return _dedupe(
            item
            for child in value.values()
            for item in _flatten_values(child)
        )
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return _dedupe(
            item
            for child in value
            for item in _flatten_values(child)
        )
    if value is None:
        return []
    text = str(value).strip()
    return [text] if text else []


def _profile_text(value: Any) -> str:
    return " ".join(_flatten_values(value))


def _clean_filter_value(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {
            key: _clean_filter_value(child)
            for key, child in value.items()
        }
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return _dedupe(str(item).strip() for item in value if str(item).strip())
    return value


def _has_value(value: Any) -> bool:
    if value is None:
        return False
    if isinstance(value, Mapping):
        return any(_has_value(child) for child in value.values())
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return any(str(item).strip() for item in value)
    return bool(str(value).strip())


def _as_list(value: Any) -> list[Any]:
    if value is None:
        return []
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return list(value)
    return [value]


def _dedupe(values: Sequence[Any]) -> list[str]:
    seen = set()
    result = []
    for value in values:
        text = str(value).strip()
        if not text:
            continue
        key = _normalize_text(text)
        if key in seen:
            continue
        seen.add(key)
        result.append(text)
    return result


def _normalize_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", _normalize_text(value))


def _normalize_text(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    ascii_text = normalized.encode("ascii", "ignore").decode("ascii")
    return ascii_text.lower().strip()


def _looks_like_sentence(value: str) -> bool:
    return len(value.split()) > 8
