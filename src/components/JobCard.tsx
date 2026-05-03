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
  recencyScore?: number | string | null;
  requirementMatchScore?: number | string | null;
  finalScore?: number | string | null;
  publishedDate?: string | null;
  savedAt?: number | string | null;
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

function getDistanceLabel(distanceScore: number) {
  if (distanceScore >= 90) return "Very close";
  if (distanceScore >= 75) return "Good distance";
  if (distanceScore >= 60) return "Reachable";
  if (distanceScore > 0) return "Farther away";
  return "";
}

function getRecencyLabel(job: JobWithOptionalFields) {
  const publishedDate = formatDate(job.publishedDate);
  if (publishedDate) return `Published ${publishedDate}`;

  const recencyScore = toNumber(job.recencyScore);

  if (recencyScore >= 14) return "Very recent";
  if (recencyScore >= 8) return "Recent";
  if (recencyScore > 0) return "Fresh enough";

  return "";
}

function isNewSavedJob(job: JobWithOptionalFields) {
  const savedAt = getDateTime(job.savedAt);
  if (!savedAt) return false;

  const oneDayMs = 24 * 60 * 60 * 1000;
  return Date.now() - savedAt <= oneDayMs;
}

function getMetaItems(job: JobWithOptionalFields) {
  const items: string[] = [];

  const distanceScore = toNumber(job.distanceScore);
  const requirementMatchScore = toNumber(job.requirementMatchScore);
  const publishedDate = formatDate(job.publishedDate);

  if (distanceScore > 0) {
    items.push(`Distance ${distanceScore}`);
  }

  if (requirementMatchScore > 0) {
    items.push(`Requirement fit ${requirementMatchScore}`);
  }

  if (publishedDate) {
    items.push(`Published ${publishedDate}`);
  }

  if (job.keyword) {
    items.push(`Reason: ${job.keyword}`);
  }

  return items;
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "blue" | "green" | "amber" | "red" | "purple";
}) {
  const styles: Record<
    NonNullable<Parameters<typeof Badge>[0]["tone"]>,
    {
      background: string;
      border: string;
      color: string;
    }
  > = {
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
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: 28,
        padding: "6px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 900,
        lineHeight: 1,
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

  const titleData = extractWorkloadFromTitle(job.title || "Untitled job");
  const explicitWorkload = getExplicitWorkload(rankedJob);
  const workload = titleData.workload || explicitWorkload;

  const distanceScore = toNumber(rankedJob.distanceScore);
  const distanceLabel = getDistanceLabel(distanceScore);
  const recencyLabel = getRecencyLabel(rankedJob);
  const metaItems = getMetaItems(rankedJob);
  const savedIsNew = showSavedJobs && isNewSavedJob(rankedJob);

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
        borderRadius: 24,
        border: showSavedJobs
          ? "1px solid rgba(34,197,94,0.32)"
          : isBest
          ? "1px solid rgba(34,197,94,0.35)"
          : "1px solid rgba(226,232,240,0.9)",
        boxShadow: isHovered
          ? "0 30px 78px rgba(0,0,0,0.3)"
          : showSavedJobs
          ? "0 22px 58px rgba(15,23,42,0.22)"
          : "0 22px 55px rgba(0,0,0,0.2)",
        transform: isHovered ? "translateY(-4px)" : "translateY(0)",
        transition:
          "transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          bottom: 0,
          left: 0,
          width: 5,
          background: scoreColor(score),
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 118px",
          gap: 24,
          alignItems: "start",
          padding: 26,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            {showSavedJobs && <Badge tone="blue">Saved</Badge>}
            {savedIsNew && <Badge tone="green">New</Badge>}
            {isBest && <Badge tone="green">Best Match</Badge>}

            <Badge>{scoreLabel(score)}</Badge>

            {distanceLabel && <Badge tone="blue">{distanceLabel}</Badge>}
            {recencyLabel && <Badge>{recencyLabel}</Badge>}
            {workload && <Badge tone="amber">Workload {workload}</Badge>}
            {hasFinishedAnalysis && <Badge tone="purple">AI reviewed</Badge>}
          </div>

          <h2
            style={{
              margin: 0,
              color: "#0f172a",
              fontSize: 26,
              lineHeight: 1.16,
              letterSpacing: -0.45,
            }}
          >
            {titleData.title}
          </h2>

          <p
            style={{
              margin: "10px 0 0",
              fontSize: 14,
              color: "#475569",
              fontWeight: 900,
            }}
          >
            {job.company} · {job.location}
          </p>

          {metaItems.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 14px",
                marginTop: 11,
                color: "#64748b",
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              {metaItems.slice(0, 4).map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}

          {(job.previewSummary ||
            job.highlights?.length ||
            job.riskFlags?.length ||
            job.snippet) && (
            <div
              style={{
                marginTop: 18,
                maxWidth: 980,
                display: "grid",
                gap: 12,
              }}
            >
              {job.previewSummary && (
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: 14,
                    background: "rgba(37,99,235,0.07)",
                    border: "1px solid rgba(37,99,235,0.14)",
                    color: "#1e3a8a",
                    fontWeight: 900,
                    lineHeight: 1.55,
                    fontSize: 13,
                  }}
                >
                  {job.previewSummary}
                </div>
              )}

              {job.highlights && job.highlights.length > 0 ? (
                <div
                  style={{
                    padding: "14px 15px",
                    borderRadius: 16,
                    background: "rgba(15,23,42,0.035)",
                    border: "1px solid rgba(15,23,42,0.07)",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 10px",
                      color: "#0f172a",
                      fontSize: 12,
                      fontWeight: 950,
                      letterSpacing: 0.35,
                      textTransform: "uppercase",
                    }}
                  >
                    Highlights
                  </p>

                  <div style={{ display: "grid", gap: 8 }}>
                    {job.highlights.slice(0, 3).map((highlight, i) => (
                      <div
                        key={`${highlight}-${i}`}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "20px 1fr",
                          gap: 8,
                          alignItems: "start",
                          color: "#334155",
                          fontSize: 13,
                          lineHeight: 1.55,
                        }}
                      >
                        <span style={{ color: "#15803d", fontWeight: 950 }}>
                          ✓
                        </span>
                        <span>{highlight}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : job.snippet ? (
                <div
                  style={{
                    padding: "14px 15px",
                    borderRadius: 16,
                    background: "rgba(15,23,42,0.035)",
                    border: "1px solid rgba(15,23,42,0.07)",
                    color: "#334155",
                    lineHeight: 1.65,
                    fontSize: 13,
                  }}
                >
                  {job.snippet}
                </div>
              ) : null}

              {job.riskFlags && job.riskFlags.length > 0 && (
                <div
                  style={{
                    padding: "14px 15px",
                    borderRadius: 16,
                    background: "rgba(220,38,38,0.06)",
                    border: "1px solid rgba(220,38,38,0.16)",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 8px",
                      color: "#991b1b",
                      fontSize: 12,
                      fontWeight: 950,
                      letterSpacing: 0.35,
                      textTransform: "uppercase",
                    }}
                  >
                    Watch out
                  </p>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {job.riskFlags.slice(0, 3).map((risk, i) => (
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
              gap: 10,
              marginTop: 20,
              flexWrap: "wrap",
            }}
          >
            {job.url && (
              <a
                className="btn btn-dark"
                href={job.url}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: "none" }}
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
              width: 104,
              height: 104,
              borderRadius: 26,
              background: scoreColor(score),
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexDirection: "column",
              fontWeight: 950,
              boxShadow: isHovered
                ? `0 24px 55px ${scoreColor(score)}66`
                : `0 18px 38px ${scoreColor(score)}35`,
              transform: isHovered ? "scale(1.04)" : "scale(1)",
              transition: "transform 0.22s ease, box-shadow 0.22s ease",
            }}
          >
            <span style={{ fontSize: 30, lineHeight: 1 }}>{score}%</span>
            <span
              style={{
                marginTop: 5,
                fontSize: 10,
                letterSpacing: 0.7,
                textTransform: "uppercase",
              }}
            >
              Match
            </span>
          </div>
        </div>
      </div>

      <div
        style={{
          maxHeight: analysisText ? 980 : 0,
          opacity: analysisText ? 1 : 0,
          overflow: "hidden",
          transform: analysisText ? "translateY(0)" : "translateY(-8px)",
          transition:
            "max-height 0.45s ease, opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        {analysisText && (
          <div
            style={{
              margin: "0 26px 26px",
              padding: 0,
              background: "linear-gradient(135deg, #eef2ff, #e2e8f0)",
              border: "1px solid rgba(148,163,184,0.32)",
              borderRadius: 20,
              overflow: "hidden",
              boxShadow: "0 18px 45px rgba(15,23,42,0.1)",
            }}
          >
            <div
              style={{
                padding: "16px 18px",
                background:
                  "linear-gradient(135deg, rgba(37,99,235,0.11), rgba(124,58,237,0.08))",
                borderBottom: "1px solid rgba(148,163,184,0.25)",
                display: "flex",
                justifyContent: "space-between",
                gap: 16,
                alignItems: "center",
              }}
            >
              <div>
                <strong
                  style={{
                    display: "block",
                    color: "#0f172a",
                    fontSize: 17,
                    letterSpacing: -0.2,
                  }}
                >
                  AI Matching Insight
                </strong>

                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  Personalized analysis based on your CV profile.
                </p>
              </div>

              <span
                style={{
                  padding: "7px 11px",
                  borderRadius: 999,
                  background: isAnalyzing
                    ? "rgba(245,158,11,0.14)"
                    : recommendationStyle.background,
                  color: isAnalyzing ? "#92400e" : recommendationStyle.color,
                  border: isAnalyzing
                    ? "1px solid rgba(245,158,11,0.28)"
                    : recommendationStyle.border,
                  fontSize: 12,
                  fontWeight: 900,
                  whiteSpace: "nowrap",
                }}
              >
                {isAnalyzing ? "Analyzing" : recommendationStyle.label}
              </span>
            </div>

            <div
              style={{
                padding: 18,
                maxHeight: 620,
                overflowY: "auto",
              }}
            >
              {isAnalyzing ? (
                <div style={{ display: "grid", gap: 12 }}>
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
                        height: 14,
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
                      marginBottom: 16,
                      padding: 14,
                      borderRadius: 16,
                      background: "rgba(255,255,255,0.72)",
                      border: "1px solid rgba(148,163,184,0.22)",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        color: "#0f172a",
                        fontSize: 14,
                        fontWeight: 900,
                        lineHeight: 1.55,
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
      </div>
    </article>
  );
}
