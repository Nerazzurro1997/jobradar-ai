import type { ReactNode } from "react";
import type { Job } from "../types";
import { renderAnalysis } from "../utils/renderAnalysis";
import { getJobDisplayScore } from "../utils/jobs";
import { scoreColor, scoreLabel } from "../utils/score";

type JobCardProps = {
  job: Job;
  index: number;
  analysisText?: string;
  hoveredId: number | null;
  showSavedJobs: boolean;
  onHover: (id: number | null) => void;
  onAnalyze: (job: Job) => void;
};

type JobWithOptionalFields = Job & {
  workload?: string;
  workloadPercent?: string;
  employmentLevel?: string;
  pensum?: string;

  distanceScore?: number | string | null;
  distanceKm?: number | string | null;
  commuteKm?: number | string | null;
  distanceText?: string | null;

  recencyScore?: number | string | null;
  requirementMatchScore?: number | string | null;
  finalScore?: number | string | null;
  locationPriority?: number | string | null;
  matchedLocation?: string | null;
  publishedDate?: string | null;
  savedAt?: number | string | null;

  uiIsNew?: boolean;
  uiIsPriority?: boolean;
  uiPriorityRank?: number;
  uiDecisionSection?: "new" | "all" | "live";
};

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim().replace(",", ".");
    const numericText = normalized.match(/-?\d+(\.\d+)?/)?.[0];
    const parsed = numericText ? Number(numericText) : Number(normalized);

    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function getDateTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return 0;

  const swissDate = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (swissDate) {
    const [, day, month, year] = swissDate;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    ).getTime();

    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value: unknown) {
  const time = getDateTime(value);
  if (!time) return "";

  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(time));
}

function formatRelativeDate(value: unknown) {
  const time = getDateTime(value);
  if (!time) return "";

  const diffMs = Date.now() - time;
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < hourMs) return "today";

  const hours = Math.floor(diffMs / hourMs);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(diffMs / dayMs);
  if (days === 1) return "1 day ago";
  if (days < 14) return `${days} days ago`;

  return formatDate(value);
}

function normalizeWorkload(value: string) {
  return value.replace(/\s+/g, "").replace(/-/g, "–").trim();
}

function extractWorkloadFromTitle(title: string) {
  const cleanTitle = title.trim();

  const parenthesisMatch = cleanTitle.match(
    /\s*\((\d{1,3}\s*(?:[-–]\s*\d{1,3})?\s*%)\)\s*$/
  );

  if (parenthesisMatch) {
    return {
      title: cleanTitle.replace(parenthesisMatch[0], "").trim(),
      workload: normalizeWorkload(parenthesisMatch[1]),
    };
  }

  const trailingMatch = cleanTitle.match(
    /\s+(\d{1,3}\s*(?:[-–]\s*\d{1,3})?\s*%)\s*$/
  );

  if (trailingMatch) {
    return {
      title: cleanTitle.replace(trailingMatch[0], "").trim(),
      workload: normalizeWorkload(trailingMatch[1]),
    };
  }

  return {
    title: cleanTitle,
    workload: "",
  };
}

function getExplicitWorkload(job: JobWithOptionalFields) {
  return (
    job.workload ||
    job.workloadPercent ||
    job.employmentLevel ||
    job.pensum ||
    ""
  ).trim();
}

function cleanAnalysisText(text?: string) {
  if (!text) return "";

  return text
    .replace(/\*\*/g, "")
    .replace(/###/g, "")
    .replace(/---/g, "")
    .trim();
}

function isSectionTitle(line: string) {
  const lower = line.toLowerCase();

  return (
    line.endsWith(":") ||
    lower.includes("match score") ||
    lower.includes("kurzfazit") ||
    lower.includes("passung") ||
    lower.includes("kritische") ||
    lower.includes("risiken") ||
    lower.includes("realistische chance") ||
    lower.includes("empfehlung") ||
    lower.includes("begründung") ||
    lower.includes("positionierung") ||
    lower.includes("bewerbungsstrategie") ||
    lower.includes("direkter tipp") ||
    lower.includes("warum")
  );
}

function getAnalysisSummary(text?: string) {
  const clean = cleanAnalysisText(text);

  if (!clean) return "";

  const firstUsefulLine = clean
    .split("\n")
    .map((line) => line.trim())
    .find((line) => {
      if (!line) return false;
      if (line.startsWith("-") || line.startsWith("•")) return false;
      if (isSectionTitle(line)) return false;
      return line.length > 18;
    });

  return (
    firstUsefulLine ||
    "AI analysis completed. Review the detailed recommendation below."
  );
}

function getRecommendationStyle(text?: string) {
  const lower = (text || "").toLowerCase();

  if (
    lower.includes("nicht bewerben") ||
    lower.includes("abraten") ||
    lower.includes("geringe chance") ||
    lower.includes("schwache passung")
  ) {
    return {
      label: "Review carefully",
      background: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.26)",
      color: "#991b1b",
    };
  }

  if (
    lower.includes("bewerben") ||
    lower.includes("hohe chance") ||
    lower.includes("sehr gut") ||
    lower.includes("starke passung")
  ) {
    return {
      label: "Recommended",
      background: "rgba(34,197,94,0.14)",
      border: "1px solid rgba(34,197,94,0.3)",
      color: "#166534",
    };
  }

  return {
    label: "AI reviewed",
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(37,99,235,0.24)",
    color: "#1d4ed8",
  };
}

function getDistanceLabel(job: JobWithOptionalFields) {
  const distanceText =
    typeof job.distanceText === "string" ? job.distanceText.trim() : "";
  if (distanceText) return distanceText;

  const distanceKm = toNumber(job.distanceKm, toNumber(job.commuteKm));
  if (distanceKm > 0) return `${Math.round(distanceKm)} km`;

  const distanceScore = toNumber(job.distanceScore);

  if (distanceScore >= 90) return "very close";
  if (distanceScore >= 75) return "good distance";
  if (distanceScore >= 60) return "reachable";
  if (distanceScore > 0) return "farther away";

  return "";
}

function getPublishedLabel(job: JobWithOptionalFields) {
  const relativeDate = formatRelativeDate(job.publishedDate);
  if (relativeDate) return relativeDate;

  const recencyScore = toNumber(job.recencyScore);

  if (recencyScore >= 14) return "very recent";
  if (recencyScore >= 8) return "recent";
  if (recencyScore > 0) return "fresh enough";

  return "";
}

function getReasonLabel(job: JobWithOptionalFields, score: number) {
  const requirementMatchScore = toNumber(job.requirementMatchScore);

  if (job.keyword) return job.keyword;
  if (requirementMatchScore >= 85) return "strong CV match";
  if (score >= 90) return "elite profile fit";
  if (score >= 85) return "high match quality";
  if (job.previewSummary) return "profile-relevant role";

  return "saved match";
}

function isNewSavedJob(job: JobWithOptionalFields) {
  if (job.uiIsNew) return true;

  const savedAt = getDateTime(job.savedAt);
  if (!savedAt) return false;

  const oneDayMs = 24 * 60 * 60 * 1000;
  return Date.now() - savedAt <= oneDayMs;
}

function getMetaItems(job: JobWithOptionalFields, score: number) {
  const items: string[] = [];

  const distanceLabel = getDistanceLabel(job);
  const publishedLabel = getPublishedLabel(job);
  const reasonLabel = getReasonLabel(job, score);

  if (distanceLabel) items.push(`Distance: ${distanceLabel}`);
  if (publishedLabel) items.push(`Published: ${publishedLabel}`);
  if (reasonLabel) items.push(`Reason: ${reasonLabel}`);

  return items;
}

function getQualityTone(score: number): "green" | "blue" | "amber" {
  if (score >= 90) return "green";
  if (score >= 85) return "blue";
  return "amber";
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red" | "purple" | "dark";
}) {
  const styles = {
    neutral: {
      background: "rgba(15,23,42,0.055)",
      border: "1px solid rgba(15,23,42,0.07)",
      color: "#334155",
    },
    blue: {
      background: "rgba(37,99,235,0.1)",
      border: "1px solid rgba(37,99,235,0.18)",
      color: "#1d4ed8",
    },
    green: {
      background: "rgba(34,197,94,0.12)",
      border: "1px solid rgba(34,197,94,0.26)",
      color: "#166534",
    },
    amber: {
      background: "rgba(245,158,11,0.12)",
      border: "1px solid rgba(245,158,11,0.26)",
      color: "#92400e",
    },
    red: {
      background: "rgba(220,38,38,0.08)",
      border: "1px solid rgba(220,38,38,0.18)",
      color: "#991b1b",
    },
    purple: {
      background: "rgba(124,58,237,0.12)",
      border: "1px solid rgba(124,58,237,0.24)",
      color: "#5b21b6",
    },
    dark: {
      background: "rgba(15,23,42,0.9)",
      border: "1px solid rgba(15,23,42,0.12)",
      color: "#f8fafc",
    },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 23,
        padding: "5px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 900,
        lineHeight: 1,
        whiteSpace: "nowrap",
        ...styles[tone],
      }}
    >
      {children}
    </span>
  );
}

export function JobCard({
  job,
  index,
  analysisText,
  hoveredId,
  showSavedJobs,
  onHover,
  onAnalyze,
}: JobCardProps) {
  const rankedJob = job as JobWithOptionalFields;

  const score = getJobDisplayScore(job);
  const isBest = index < 3;
  const isHovered = hoveredId === job.id;
  const isNew = showSavedJobs && isNewSavedJob(rankedJob);
  const isPriorityChoice = showSavedJobs && Boolean(rankedJob.uiIsPriority);
  const priorityRank = rankedJob.uiPriorityRank;

  const titleData = extractWorkloadFromTitle(job.title || "Untitled job");
  const explicitWorkload = getExplicitWorkload(rankedJob);
  const workload = titleData.workload || explicitWorkload;

  const distanceLabel = getDistanceLabel(rankedJob);
  const publishedLabel = getPublishedLabel(rankedJob);
  const reasonLabel = getReasonLabel(rankedJob, score);
  const metaItems = getMetaItems(rankedJob, score);

  const requirementMatchScore = toNumber(rankedJob.requirementMatchScore);
  const locationPriority = toNumber(rankedJob.locationPriority);
  const matchedLocation =
    typeof rankedJob.matchedLocation === "string"
      ? rankedJob.matchedLocation.trim()
      : "";

  const visibleHighlights = job.highlights?.slice(0, 2) ?? [];
  const extraHighlightCount = Math.max((job.highlights?.length ?? 0) - 2, 0);
  const visibleRiskFlags = job.riskFlags?.slice(0, 1) ?? [];

  const normalizedAnalysis = analysisText?.toLowerCase() || "";
  const isAnalyzing =
    analysisText === "⏳ Analisi in corso..." ||
    normalizedAnalysis.includes("analisi in corso") ||
    normalizedAnalysis.includes("ai is analyzing");

  const hasFinishedAnalysis = Boolean(analysisText && !isAnalyzing);
  const analysisSummary = getAnalysisSummary(analysisText);
  const recommendationStyle = getRecommendationStyle(analysisText);

  const handleMouseEnter = () => {
    if (typeof job.id === "number") {
      onHover(job.id);
    }
  };

  return (
    <article
      className="job-card fade-in"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => onHover(null)}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        color: "#0f172a",
        padding: 0,
        borderRadius: 20,
        border: isPriorityChoice
          ? "1px solid rgba(34,197,94,0.52)"
          : showSavedJobs
          ? "1px solid rgba(34,197,94,0.22)"
          : isBest
          ? "1px solid rgba(34,197,94,0.32)"
          : "1px solid rgba(226,232,240,0.9)",
        boxShadow: isHovered
          ? "0 24px 58px rgba(0,0,0,0.26)"
          : isPriorityChoice
          ? "0 18px 46px rgba(34,197,94,0.18)"
          : showSavedJobs
          ? "0 16px 42px rgba(15,23,42,0.18)"
          : "0 18px 44px rgba(0,0,0,0.18)",
        transform: isHovered ? "translateY(-3px)" : "translateY(0)",
        transition:
          "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: isPriorityChoice ? 6 : 4,
          background: scoreColor(score),
        }}
      />

      {isPriorityChoice && (
        <div
          style={{
            position: "absolute",
            top: 0,
            right: 0,
            left: 0,
            height: 3,
            background:
              "linear-gradient(90deg, rgba(34,197,94,0.9), rgba(59,130,246,0.5), transparent)",
          }}
        />
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 92px",
          gap: 16,
          alignItems: "start",
          padding: "18px 20px 18px 22px",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 6,
              flexWrap: "wrap",
              marginBottom: 10,
            }}
          >
            {isPriorityChoice && (
              <Badge tone="green">
                {priorityRank ? `Best choice #${priorityRank}` : "Best choice"}
              </Badge>
            )}

            {showSavedJobs && <Badge tone="blue">Saved</Badge>}
            {isNew && <Badge tone="green">NEW</Badge>}

            {!isPriorityChoice && isBest && <Badge tone="green">Best Match</Badge>}

            <Badge tone={getQualityTone(score)}>{scoreLabel(score)}</Badge>

            {distanceLabel && <Badge tone="blue">Distance {distanceLabel}</Badge>}
            {publishedLabel && <Badge>{publishedLabel}</Badge>}
            {workload && <Badge tone="amber">{workload}</Badge>}
            {hasFinishedAnalysis && <Badge tone="purple">AI reviewed</Badge>}
          </div>

          <h2
            style={{
              margin: 0,
              color: "#0f172a",
              fontSize: showSavedJobs ? 22 : 23,
              lineHeight: 1.14,
              letterSpacing: -0.25,
            }}
          >
            {titleData.title}
          </h2>

          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13.5,
              color: "#475569",
              fontWeight: 900,
              lineHeight: 1.35,
            }}
          >
            {job.company} · {job.location}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: "6px 12px",
              marginTop: 9,
              color: "#64748b",
              fontSize: 11.5,
              fontWeight: 800,
              lineHeight: 1.3,
            }}
          >
            {metaItems.slice(0, 3).map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>

          {(requirementMatchScore > 0 || locationPriority > 0 || matchedLocation) && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                marginTop: 9,
              }}
            >
              {requirementMatchScore > 0 && (
                <Badge tone="purple">CV fit {requirementMatchScore}</Badge>
              )}

              {locationPriority > 0 && (
                <Badge tone="blue">Location {locationPriority}</Badge>
              )}

              {matchedLocation && <Badge>{matchedLocation}</Badge>}

              {reasonLabel && <Badge tone="dark">{reasonLabel}</Badge>}
            </div>
          )}

          {(job.previewSummary ||
            visibleHighlights.length > 0 ||
            visibleRiskFlags.length > 0 ||
            job.snippet) && (
            <div
              style={{
                marginTop: 13,
                maxWidth: 920,
                display: "grid",
                gap: 9,
              }}
            >
              {job.previewSummary && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 13,
                    background: "rgba(37,99,235,0.07)",
                    border: "1px solid rgba(37,99,235,0.14)",
                    color: "#1e3a8a",
                    fontWeight: 900,
                    lineHeight: 1.45,
                    fontSize: 12.5,
                  }}
                >
                  {job.previewSummary}
                </div>
              )}

              {visibleHighlights.length > 0 ? (
                <div
                  style={{
                    padding: "11px 12px",
                    borderRadius: 14,
                    background: "rgba(15,23,42,0.035)",
                    border: "1px solid rgba(15,23,42,0.07)",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 8px",
                      color: "#0f172a",
                      fontSize: 11,
                      fontWeight: 950,
                      letterSpacing: 0.35,
                      textTransform: "uppercase",
                    }}
                  >
                    Highlights
                  </p>

                  <div style={{ display: "grid", gap: 6 }}>
                    {visibleHighlights.map((highlight, i) => (
                      <div
                        key={`${highlight}-${i}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "18px 1fr",
                          gap: 7,
                          alignItems: "start",
                          color: "#334155",
                          fontSize: 12.5,
                          lineHeight: 1.45,
                        }}
                      >
                        <span style={{ color: "#15803d", fontWeight: 950 }}>
                          ✓
                        </span>
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>

                  {extraHighlightCount > 0 && (
                    <p
                      style={{
                        margin: "7px 0 0",
                        color: "#64748b",
                        fontSize: 11,
                        fontWeight: 850,
                      }}
                    >
                      +{extraHighlightCount} more highlights
                    </p>
                  )}
                </div>
              ) : job.snippet ? (
                <div
                  style={{
                    padding: "11px 12px",
                    borderRadius: 14,
                    background: "rgba(15,23,42,0.035)",
                    border: "1px solid rgba(15,23,42,0.07)",
                    color: "#334155",
                    lineHeight: 1.55,
                    fontSize: 12.5,
                  }}
                >
                  {job.snippet}
                </div>
              ) : null}

              {visibleRiskFlags.length > 0 && (
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: 14,
                    background: "rgba(220,38,38,0.06)",
                    border: "1px solid rgba(220,38,38,0.16)",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 7px",
                      color: "#991b1b",
                      fontSize: 11,
                      fontWeight: 950,
                      letterSpacing: 0.35,
                      textTransform: "uppercase",
                    }}
                  >
                    Watch out
                  </p>

                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {visibleRiskFlags.map((risk, i) => (
                      <Badge key={`${risk}-${i}`} tone="red">
                        {risk}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 8,
              marginTop: 14,
              flexWrap: "wrap",
            }}
          >
            {job.url && (
              <a
                className="btn btn-dark"
                href={job.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  textDecoration: "none",
                  padding: "9px 13px",
                  fontSize: 13,
                  borderRadius: 11,
                }}
              >
                Open Job
              </a>
            )}

            <button
              className="btn btn-blue"
              onClick={() => onAnalyze(job)}
              disabled={isAnalyzing}
              style={{
                opacity: isAnalyzing ? 0.75 : 1,
                cursor: isAnalyzing ? "not-allowed" : "pointer",
                padding: "9px 13px",
                fontSize: 13,
                borderRadius: 11,
              }}
            >
              {isAnalyzing ? "AI analyzing..." : "AI Analysis"}
            </button>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <div
            style={{
              width: 82,
              height: 82,
              borderRadius: 22,
              background: scoreColor(score),
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              fontWeight: 950,
              boxShadow: isHovered
                ? `0 20px 42px ${scoreColor(score)}60`
                : `0 14px 28px ${scoreColor(score)}30`,
              transform: isHovered ? "scale(1.03)" : "scale(1)",
              transition: "transform 0.2s ease, box-shadow 0.2s ease",
            }}
          >
            <span style={{ fontSize: 25, lineHeight: 1 }}>{score}%</span>
            <span
              style={{
                marginTop: 4,
                fontSize: 9,
                letterSpacing: 0.65,
                textTransform: "uppercase",
              }}
            >
              Match
            </span>
          </div>
        </div>
      </div>

      {analysisText && (
        <div
          style={{
            margin: "0 20px 18px 22px",
            padding: 0,
            background: "linear-gradient(135deg, #eef2ff, #e2e8f0)",
            border: "1px solid rgba(148,163,184,0.32)",
            borderRadius: 18,
            overflow: "hidden",
            boxShadow: "0 14px 32px rgba(15,23,42,0.09)",
          }}
        >
          <div
            style={{
              padding: "13px 15px",
              background:
                "linear-gradient(135deg, rgba(37,99,235,0.11), rgba(124,58,237,0.08))",
              borderBottom: "1px solid rgba(148,163,184,0.25)",
              display: "flex",
              justifyContent: "space-between",
              gap: 14,
              alignItems: "center",
            }}
          >
            <div>
              <strong
                style={{
                  display: "block",
                  color: "#0f172a",
                  fontSize: 16,
                  letterSpacing: -0.15,
                }}
              >
                AI Matching Insight
              </strong>

              <p
                style={{
                  margin: "4px 0 0",
                  color: "#475569",
                  fontSize: 12.5,
                  fontWeight: 700,
                }}
              >
                Personalized analysis based on your CV profile.
              </p>
            </div>

            <span
              style={{
                padding: "6px 10px",
                borderRadius: 999,
                background: isAnalyzing
                  ? "rgba(245,158,11,0.14)"
                  : recommendationStyle.background,
                color: isAnalyzing ? "#92400e" : recommendationStyle.color,
                border: isAnalyzing
                  ? "1px solid rgba(245,158,11,0.28)"
                  : recommendationStyle.border,
                fontSize: 11,
                fontWeight: 900,
                whiteSpace: "nowrap",
              }}
            >
              {isAnalyzing ? "Analyzing" : recommendationStyle.label}
            </span>
          </div>

          <div
            style={{
              padding: 15,
            }}
          >
            {isAnalyzing ? (
              <div style={{ display: "grid", gap: 10 }}>
                <p
                  className="loading"
                  style={{
                    margin: 0,
                    color: "#475569",
                    fontWeight: 900,
                  }}
                >
                  AI is analyzing this job...
                </p>

                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    style={{
                      height: 12,
                      borderRadius: 999,
                      background:
                        item === 1
                          ? "rgba(37,99,235,0.20)"
                          : "rgba(100,116,139,0.20)",
                      width: item === 1 ? "85%" : item === 2 ? "70%" : "55%",
                    }}
                  />
                ))}
              </div>
            ) : (
              <>
                <div
                  style={{
                    marginBottom: 13,
                    padding: 12,
                    borderRadius: 14,
                    background: "rgba(255,255,255,0.72)",
                    border: "1px solid rgba(148,163,184,0.22)",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      color: "#0f172a",
                      fontSize: 13.5,
                      fontWeight: 900,
                      lineHeight: 1.5,
                    }}
                  >
                    {analysisSummary}
                  </p>
                </div>

                {renderAnalysis(analysisText)}
              </>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
