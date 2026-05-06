"""Simple ranking metrics for local JobRadar AI evaluations."""

from __future__ import annotations

import math
from collections.abc import Mapping, Sequence


def _top_k(ranked_ids: Sequence[str], k: int) -> list[str]:
    if k <= 0:
        return []
    return list(ranked_ids[:k])


def precision_at_k(ranked_ids: Sequence[str], relevant_ids: set[str] | Sequence[str], k: int) -> float:
    """Return the share of the top-k results that are relevant."""
    top = _top_k(ranked_ids, k)
    if k <= 0:
        return 0.0

    relevant = set(relevant_ids)
    hits = sum(1 for item_id in top if item_id in relevant)
    return hits / k


def recall_at_k(ranked_ids: Sequence[str], relevant_ids: set[str] | Sequence[str], k: int) -> float:
    """Return the share of all relevant results found in the top-k results."""
    relevant = set(relevant_ids)
    if not relevant:
        return 0.0

    top = _top_k(ranked_ids, k)
    hits = sum(1 for item_id in top if item_id in relevant)
    return hits / len(relevant)


def ndcg_at_k(
    ranked_ids: Sequence[str],
    relevant_ids: set[str] | Sequence[str] | Mapping[str, float],
    k: int,
) -> float:
    """Return a simple normalized discounted cumulative gain at k.

    If relevant_ids is a mapping, values are used as graded relevance scores.
    Otherwise each relevant id receives a binary relevance score of 1.0.
    """
    if k <= 0:
        return 0.0

    relevance = _as_relevance_scores(relevant_ids)
    if not relevance:
        return 0.0

    dcg = _discounted_cumulative_gain(_top_k(ranked_ids, k), relevance)
    ideal_scores = sorted(relevance.values(), reverse=True)[:k]
    ideal_dcg = sum(score / math.log2(index + 2) for index, score in enumerate(ideal_scores))

    if ideal_dcg == 0:
        return 0.0
    return dcg / ideal_dcg


def mean_reciprocal_rank(
    rankings: Sequence[Sequence[str]],
    relevant_ids_by_query: Sequence[set[str] | Sequence[str]],
) -> float:
    """Return mean reciprocal rank across multiple ranked result lists."""
    if not rankings:
        return 0.0
    if len(rankings) != len(relevant_ids_by_query):
        raise ValueError("rankings and relevant_ids_by_query must have the same length")

    reciprocal_ranks = [
        _reciprocal_rank(ranked_ids, set(relevant_ids))
        for ranked_ids, relevant_ids in zip(rankings, relevant_ids_by_query)
    ]
    return sum(reciprocal_ranks) / len(reciprocal_ranks)


def _as_relevance_scores(relevant_ids: set[str] | Sequence[str] | Mapping[str, float]) -> dict[str, float]:
    if isinstance(relevant_ids, Mapping):
        return {item_id: float(score) for item_id, score in relevant_ids.items()}
    return {item_id: 1.0 for item_id in relevant_ids}


def _discounted_cumulative_gain(ranked_ids: Sequence[str], relevance: Mapping[str, float]) -> float:
    return sum(
        relevance.get(item_id, 0.0) / math.log2(index + 2)
        for index, item_id in enumerate(ranked_ids)
    )


def _reciprocal_rank(ranked_ids: Sequence[str], relevant_ids: set[str]) -> float:
    for index, item_id in enumerate(ranked_ids, start=1):
        if item_id in relevant_ids:
            return 1 / index
    return 0.0
