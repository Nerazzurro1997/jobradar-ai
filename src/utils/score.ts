export function scoreColor(score = 0) {
  if (score >= 90) return "#15803d";
  if (score >= 85) return "#16a34a";
  if (score >= 80) return "#65a30d";
  if (score >= 70) return "#d97706";
  return "#dc2626";
}

export function scoreLabel(score = 0) {
  if (score >= 90) return "Elite Match";
  if (score >= 85) return "Best Match";
  if (score >= 80) return "Top Match";
  if (score >= 70) return "Good Match";
  return "Weak";
}
