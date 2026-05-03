function normalizeScore(score: unknown) {
  if (typeof score === "number" && Number.isFinite(score)) {
    return score;
  }

  if (typeof score === "string" && score.trim()) {
    const parsed = Number(score.trim().replace(",", "."));

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return 0;
}

export function scoreColor(score: unknown = 0) {
  const normalizedScore = normalizeScore(score);

  if (normalizedScore >= 90) return "#15803d";
  if (normalizedScore >= 85) return "#16a34a";
  if (normalizedScore >= 80) return "#65a30d";
  if (normalizedScore >= 70) return "#d97706";
  return "#dc2626";
}

export function scoreLabel(score: unknown = 0) {
  const normalizedScore = normalizeScore(score);

  if (normalizedScore >= 90) return "Elite Match";
  if (normalizedScore >= 85) return "Best Match";
  if (normalizedScore >= 80) return "Top Match";
  if (normalizedScore >= 70) return "Good Match";
  return "Weak";
}
