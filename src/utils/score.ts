export function scoreColor(score = 0) {
  if (score >= 85) return "#15803d";
  if (score >= 75) return "#65a30d";
  if (score >= 65) return "#d97706";
  return "#dc2626";
}

export function scoreLabel(score = 0) {
  if (score >= 90) return "Elite Match";
  if (score >= 80) return "Top Match";
  if (score >= 70) return "Good Match";
  if (score >= 65) return "Possible";
  return "Weak";
}