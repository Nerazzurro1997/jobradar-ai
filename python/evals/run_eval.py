"""Command-line runner for local JobRadar AI ranking evaluations."""

from __future__ import annotations

import argparse
from collections.abc import Mapping, Sequence
from typing import Any

from evaluation import (
    compare_rankings,
    load_fixture_bundle,
    load_search_results,
    normalize_job_ids,
    save_search_results,
)
from diagnostics import build_scoring_report
from filter_model import FILTER_NAMES, build_filter_strategy


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Evaluate saved search-jobs output against expected rankings."
    )
    parser.add_argument(
        "fixture",
        help="Fixture bundle name, for example insurance_claims_realistic",
    )
    parser.add_argument(
        "--import-results",
        dest="import_results",
        help="Optional JSON file exported from search-jobs to save as fixtures/<fixture>/jobs.json",
    )
    args = parser.parse_args()

    if args.import_results:
        payload = load_search_results(args.import_results)
        saved_path = save_search_results(payload, args.fixture)
        print(f"Saved search results: {saved_path}")

    bundle = load_fixture_bundle(args.fixture)
    report = compare_rankings(
        bundle["jobs_payload"],
        bundle["expected_ranking"],
        ks=(5, 10),
    )
    scoring_report = build_scoring_report(
        bundle["jobs"],
        bundle["cv_profile"],
        bundle["expected_ranking"],
    )
    filter_strategy = build_filter_strategy(bundle["cv_profile"])

    print_header(bundle["name"])
    print_metrics(report["metrics"])
    print()
    print_cv_domain_context(scoring_report["cv_domains"])
    print()
    print_cv_task_context(scoring_report["cv_tasks"])
    print()
    print_filter_strategy(filter_strategy)
    print()
    print_top_expected_vs_actual(scoring_report["top_comparison"])
    print()
    print_top_jobs("Top 10 risultati reali", bundle["jobs"], report["actual_ranking"][:10])
    print()
    print_expected_top("Top 10 attesi", bundle["jobs"], report["expected_top_ranking"][:10])
    print()
    print_differences(bundle["jobs"], report)
    print()
    print_weighted_contribution_report(scoring_report["weighted_contribution_report"])
    print()
    print_scoring_diagnostics(scoring_report["jobs"])
    print()
    print_leakage_report(scoring_report["leakage_report"])
    print()
    print_weight_recommendations(scoring_report["weight_recommendations"])
    print()
    print_ranking_mistakes(scoring_report["ranking_mistakes"])

    return 0


def print_header(name: str) -> None:
    print(f"JobRadar AI eval: {name}")
    print("=" * (len(name) + 18))


def print_metrics(metrics: Mapping[str, float]) -> None:
    rows = [
        ("precision@5", metrics.get("precision_at_5", 0.0)),
        ("precision@10", metrics.get("precision_at_10", 0.0)),
        ("recall@10", metrics.get("recall_at_10", 0.0)),
        ("ndcg@10", metrics.get("ndcg_at_10", 0.0)),
        ("mean reciprocal rank", metrics.get("mean_reciprocal_rank", 0.0)),
    ]
    for label, value in rows:
        print(f"{label}: {value:.3f}")


def print_cv_domain_context(cv_domains: Mapping[str, Any]) -> None:
    print("Detected CV domain context")
    print(f"- target domains: {format_list(cv_domains.get('target_domains', []))}")
    print(f"- acceptable domains: {format_list(cv_domains.get('acceptable_domains', []))}")
    print(f"- weak-fit domains: {format_list(cv_domains.get('weak_fit_domains', []))}")
    print(f"- avoid domains: {format_list(cv_domains.get('avoid_domains', []))}")
    print(f"- clear target domain: {cv_domains.get('clear_target_domain')}")


def print_cv_task_context(cv_tasks: Mapping[str, Any]) -> None:
    print("Detected CV task context")
    print(f"- target tasks: {format_list(cv_tasks.get('target_tasks', []))}")
    print(f"- core tasks: {format_list(cv_tasks.get('core_tasks', []))}")
    print(f"- adjacent tasks: {format_list(cv_tasks.get('adjacent_tasks', []))}")
    print(f"- generic tasks: {format_list(cv_tasks.get('generic_tasks', []))}")
    print(f"- acceptable tasks: {format_list(cv_tasks.get('acceptable_tasks', []))}")
    print(f"- weak-fit tasks: {format_list(cv_tasks.get('weak_fit_tasks', []))}")
    print(f"- avoid tasks: {format_list(cv_tasks.get('avoid_tasks', []))}")
    print(f"- clear target tasks: {cv_tasks.get('clear_target_tasks')}")


def print_filter_strategy(strategy: Mapping[str, Any]) -> None:
    print("CV-driven filter model")
    filters = strategy["filters"]
    for name in FILTER_NAMES:
        item = filters[name]
        print(
            f"- {name}: {item['status']} | confidence {item['confidence']:.2f} | "
            f"value={format_filter_value(item.get('value'))}"
        )

    missing = strategy.get("missing_filter_information", [])
    print(f"- missing filter information: {format_list(missing)}")
    print("Suggested search strategy")
    for wave in strategy.get("search_strategy", []):
        print(f"  wave {wave['wave']}: {wave['name']}")
        print(f"    purpose: {wave['purpose']}")
        for key, value in wave.get("filters", {}).items():
            print(f"    {key}: {format_filter_value(value)}")


def print_top_jobs(title: str, jobs: Sequence[Any], ranking_ids: Sequence[str]) -> None:
    print(title)
    job_lookup = build_job_lookup(jobs)
    for index, job_id in enumerate(ranking_ids, start=1):
        print(f"{index:>2}. {format_job(job_lookup.get(job_id), job_id)}")


def print_expected_top(title: str, jobs: Sequence[Any], expected_ids: Sequence[str]) -> None:
    print_top_jobs(title, jobs, expected_ids)


def print_top_expected_vs_actual(rows: Sequence[Mapping[str, Any]]) -> None:
    print("Top expected vs top actual")
    for row in rows:
        status = "match" if row["match"] else "diff"
        print(
            f"{row['rank']:>2}. actual={row['actual_id'] or '-'} | "
            f"expected={row['expected_id'] or '-'} | {status}"
        )


def print_differences(jobs: Sequence[Any], report: Mapping[str, Any]) -> None:
    actual_top_10 = report["actual_ranking"][:10]
    expected_top_10 = report["expected_top_ranking"][:10]
    actual_set = set(actual_top_10)
    expected_set = set(expected_top_10)
    job_lookup = build_job_lookup(jobs)

    missing_expected = [job_id for job_id in expected_top_10 if job_id not in actual_set]
    unexpected_actual = [job_id for job_id in actual_top_10 if job_id not in expected_set]
    moved_jobs = [
        job_id
        for job_id in expected_top_10
        if job_id in actual_set and actual_top_10.index(job_id) != expected_top_10.index(job_id)
    ]

    print("Differenze principali")
    print_difference_group("Attesi ma assenti dalla top 10 reale", missing_expected, job_lookup)
    print_difference_group("Presenti nella top 10 reale ma non attesi", unexpected_actual, job_lookup)

    if moved_jobs:
        print("Attesi presenti ma in posizione diversa")
        for job_id in moved_jobs[:10]:
            actual_position = actual_top_10.index(job_id) + 1
            expected_position = expected_top_10.index(job_id) + 1
            print(
                f"- {format_job(job_lookup.get(job_id), job_id)} "
                f"(reale #{actual_position}, atteso #{expected_position})"
            )
    else:
        print("Attesi presenti ma in posizione diversa: nessuno")


def print_weighted_contribution_report(rows: Sequence[Mapping[str, Any]]) -> None:
    print("Weighted contribution report")
    for row in rows:
        print(
            f"- {row['label']}: avg {row['average_contribution']:+.2f} "
            f"(weight {row['weight']:+.0f}, active jobs {row['active_jobs']})"
        )


def print_scoring_diagnostics(breakdowns: Sequence[Mapping[str, Any]]) -> None:
    print("Scoring diagnostics by evaluated job")
    for breakdown in breakdowns:
        actual_rank = breakdown.get("actual_rank")
        expected_rank = breakdown.get("expected_rank") or "-"
        alignment = breakdown["domain_alignment"]
        job_domains = breakdown["job_domains"]
        cv_domains = breakdown["cv_domains"]
        task_alignment = breakdown["task_alignment"]
        job_tasks = breakdown["job_tasks"]
        cv_tasks = breakdown["cv_tasks"]
        generic_risk = breakdown["generic_keyword_risk"]
        print(
            f"{actual_rank:>2}. {format_job(breakdown, breakdown['job_id'])} "
            f"| expected #{expected_rank} | diagnostic total {breakdown['weighted_total']:+.2f}"
        )
        print(
            f"    cv domains: {format_list(cv_domains.get('target_domains', []))} | "
            f"job domains: {format_list(job_domains.get('detected_domains', []))}"
        )
        print(
            f"    domain alignment: {alignment['domain_alignment_score']:.2f} | "
            f"type={alignment['alignment_type']} | "
            f"matching={format_list(alignment['matching_domains'])} | "
            f"adjacent={format_list(alignment['adjacent_domains'])} | "
            f"mismatch={format_list(alignment['mismatching_domains'])}"
        )
        print(f"    dominant reason: {alignment['dominant_alignment_reason']}")
        print(
            f"    generic overlap ratio: {alignment['generic_overlap_ratio']:.2f} | "
            f"risk boost {alignment['generic_keyword_risk_boost']:.2f}"
        )
        print(f"    why: {'; '.join(str(value) for value in alignment['why'])}")
        print(
            f"    generic keyword risk: {generic_risk['risk_score']:.2f} | "
            f"{'; '.join(str(value) for value in generic_risk['why'])}"
        )
        print(
            f"    cv tasks: {format_list(cv_tasks.get('target_tasks', []))} | "
            f"job tasks: {format_list(job_tasks.get('detected_tasks', []))}"
        )
        print(
            f"    task alignment: {task_alignment['task_alignment_score']:.2f} | "
            f"type={task_alignment['alignment_type']} | "
            f"matching={format_list(task_alignment['matching_tasks'])} | "
            f"adjacent={format_list(task_alignment['adjacent_tasks'])} | "
            f"mismatch={format_list(task_alignment['mismatching_tasks'])}"
        )
        print(
            f"    task specificity: {task_alignment['task_specificity_score']:.2f} | "
            f"generic task ratio {task_alignment['generic_task_overlap_ratio']:.2f} | "
            f"avoid overlap={format_list(task_alignment['avoid_task_overlap'])}"
        )
        print(
            f"    task importance: {task_alignment['task_importance_score']:.2f} | "
            f"core={format_list(task_alignment['core_task_overlap'])} | "
            f"adjacent={format_list(task_alignment['adjacent_task_overlap'])} | "
            f"generic={format_list(task_alignment['generic_task_overlap'])}"
        )
        print(
            f"    generic leakage risk: {task_alignment['generic_leakage_risk']:.2f} | "
            f"{task_alignment['task_importance_reason']}"
        )
        print(f"    task reason: {task_alignment['dominant_task_reason']}")
        print(
            f"    generic task risk: {task_alignment['generic_task_risk']['risk_score']:.2f} | "
            f"{'; '.join(str(value) for value in task_alignment['generic_task_risk']['why'])}"
        )
        for signal in breakdown["signals"]:
            sign = "+" if signal["direction"] == "positive" else "-"
            evidence = ", ".join(str(value) for value in signal["evidence"][:3]) or "no evidence"
            print(
                f"    {sign} {signal['label']}: {signal['contribution']:+.2f} "
                f"(strength {signal['strength']:.2f}; {evidence})"
            )


def print_leakage_report(leakage_report: Mapping[str, Any]) -> None:
    print("Leakage report")
    print_leakage_group(
        "Jobs ranking high despite low domain alignment",
        leakage_report["jobs_ranking_high_despite_low_domain_alignment"],
    )
    print_leakage_group(
        "Jobs ranking high mainly because of generic keywords",
        leakage_report["jobs_ranking_high_mainly_because_of_generic_keywords"],
    )
    print_leakage_group(
        "Jobs ranking high despite weak role/domain fit",
        leakage_report["jobs_ranking_high_despite_weak_role_domain_fit"],
    )
    print_leakage_group(
        "Jobs ranking high despite weak task alignment",
        leakage_report["jobs_ranking_high_despite_weak_task_alignment"],
    )
    print_leakage_group(
        "Jobs ranking high mainly because of generic tasks",
        leakage_report["jobs_ranking_high_mainly_because_of_generic_tasks"],
    )
    print_leakage_group(
        "Jobs ranking high mostly due to generic tasks",
        leakage_report["jobs_ranking_high_mostly_due_to_generic_tasks"],
    )
    print_leakage_group(
        "Jobs ranking above more specific core-task jobs",
        leakage_report["jobs_ranking_above_more_specific_core_task_jobs"],
    )
    print_leakage_group(
        "Jobs ranking high despite avoid-task overlap",
        leakage_report["jobs_ranking_high_despite_avoid_task_overlap"],
    )
    print_leakage_group(
        "Jobs with avoid-task overlap still too high",
        leakage_report["jobs_with_avoid_task_overlap_still_too_high"],
    )


def print_leakage_group(title: str, items: Sequence[Mapping[str, Any]]) -> None:
    if not items:
        print(f"- {title}: none")
        return

    print(f"- {title}:")
    for item in items:
        print(
            f"  #{item['actual_rank']} {item['job_id']} | "
            f"domain {item['domain_alignment_score']:.2f} | "
            f"task {item['task_alignment_score']:.2f} | "
            f"job domains={format_list(item['detected_job_domains'])}"
        )
        print(f"    {'; '.join(str(value) for value in item['why'])}")
        print(
            f"    tasks: {format_list(item['detected_job_tasks'])} | "
            f"core={format_list(item.get('core_task_overlap', []))} | "
            f"adjacent={format_list(item.get('adjacent_task_overlap', []))} | "
            f"generic={format_list(item.get('generic_task_overlap', []))}"
        )
        print(f"    {'; '.join(str(value) for value in item['task_why'])}")
        below = item.get("more_specific_core_task_jobs_below", [])
        if below:
            print(
                "    core-task jobs below: "
                + "; ".join(
                    f"#{candidate.get('actual_rank')} {candidate.get('job_id')}"
                    for candidate in below[:5]
                )
            )


def print_weight_recommendations(recommendations: Sequence[Mapping[str, Any]]) -> None:
    print("Simulated weight recommendations")
    for recommendation in recommendations:
        print(
            f"- {recommendation['recommendation']}: "
            f"{recommendation['suggested_change']} "
            f"({recommendation['reason']})"
        )


def print_ranking_mistakes(mistakes: Sequence[Mapping[str, Any]]) -> None:
    print("Biggest ranking mistakes")
    if not mistakes:
        print("No large ranking mistakes detected.")
        return

    for mistake in mistakes:
        print(
            f"- {mistake['kind']} | {mistake['job_id']} | "
            f"actual #{mistake['actual_rank'] or '-'} | expected #{mistake['expected_rank'] or '-'}"
        )
        print(f"  {mistake['explanation']}")


def print_difference_group(title: str, job_ids: Sequence[str], job_lookup: Mapping[str, Any]) -> None:
    if not job_ids:
        print(f"{title}: nessuno")
        return

    print(title)
    for job_id in job_ids[:10]:
        print(f"- {format_job(job_lookup.get(job_id), job_id)}")


def build_job_lookup(jobs: Sequence[Any]) -> dict[str, Any]:
    return {
        job_id: job
        for job_id, job in zip(normalize_job_ids(jobs), jobs)
    }


def format_job(job: Any, fallback_id: str) -> str:
    if not isinstance(job, Mapping):
        return fallback_id

    title = clean_display_value(job.get("title")) or fallback_id
    company = clean_display_value(job.get("company"))
    location = clean_display_value(job.get("location"))
    score = job.get("score", job.get("source_score"))
    job_id = clean_display_value(
        job.get("eval_id")
        or job.get("job_id")
        or job.get("jobId")
        or job.get("id")
    )

    parts = [title]
    if company:
        parts.append(company)
    if location:
        parts.append(location)
    if isinstance(score, (int, float)):
        parts.append(f"score {score:g}")
    if job_id:
        parts.append(job_id)

    return " | ".join(parts)


def clean_display_value(value: Any) -> str:
    return str(value or "").strip()


def format_list(values: Sequence[Any]) -> str:
    cleaned = [str(value) for value in values if str(value)]
    return ", ".join(cleaned) if cleaned else "-"


def format_filter_value(value: Any) -> str:
    if value is None:
        return "-"
    if isinstance(value, Mapping):
        parts = [
            f"{key}={format_filter_value(child)}"
            for key, child in value.items()
            if format_filter_value(child) != "-"
        ]
        return "; ".join(parts) if parts else "-"
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return format_list(value)
    return str(value)


if __name__ == "__main__":
    raise SystemExit(main())
