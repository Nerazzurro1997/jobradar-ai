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

type JobWithOptionalWorkload = Job & {
  workload?: string;
  workloadPercent?: string;
  employmentLevel?: string;
  pensum?: string;
};

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

function getExplicitWorkload(job: JobWithOptionalWorkload) {
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

export function JobCard({
  job,
  index,
  analysisText,
  hoveredId,
  showSavedJobs,
  onHover,
  onAnalyze,
}: JobCardProps) {
  const score = getJobDisplayScore(job);
  const isBest = index < 3;
  const isHovered = hoveredId === job.id;

  const titleData = extractWorkloadFromTitle(job.title || "Untitled job");
  const explicitWorkload = getExplicitWorkload(job as JobWithOptionalWorkload);
  const workload = titleData.workload || explicitWorkload;

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
        padding: 32,
        borderRadius: 28,
        border: isBest
          ? "2px solid rgba(34,197,94,0.42)"
          : "1px solid rgba(226,232,240,0.85)",
        boxShadow: isHovered
          ? "0 35px 85px rgba(0,0,0,0.34)"
          : isBest
          ? "0 28px 70px rgba(34,197,94,0.14)"
          : "0 22px 55px rgba(0,0,0,0.22)",
        transform: isHovered ? "translateY(-6px)" : "translateY(0)",
        transition:
          "transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: 6,
          background: scoreColor(score),
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 128px",
          gap: 28,
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 14,
            }}
          >
            {isBest && (
              <span
                style={{
                  background: "rgba(34,197,94,0.12)",
                  color: "#166534",
                  border: "1px solid rgba(34,197,94,0.28)",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                ⭐ Best Match
              </span>
            )}

            {showSavedJobs && (
              <span
                style={{
                  background: "rgba(37,99,235,0.1)",
                  color: "#1d4ed8",
                  border: "1px solid rgba(37,99,235,0.18)",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                💾 Saved
              </span>
            )}

            <span
              style={{
                background: "rgba(15,23,42,0.06)",
                color: "#334155",
                padding: "6px 10px",
                borderRadius: 999,
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              {scoreLabel(score)}
            </span>

            {workload && (
              <span
                style={{
                  background: "rgba(245,158,11,0.12)",
                  color: "#92400e",
                  border: "1px solid rgba(245,158,11,0.28)",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                🕒 Workload {workload}
              </span>
            )}

            {hasFinishedAnalysis && (
              <span
                style={{
                  background: "rgba(124,58,237,0.12)",
                  color: "#5b21b6",
                  border: "1px solid rgba(124,58,237,0.24)",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                🤖 AI reviewed
              </span>
            )}

            {job.keyword && (
              <span
                style={{
                  background: "#dbeafe",
                  color: "#1d4ed8",
                  padding: "6px 10px",
                  borderRadius: 999,
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                Keyword: {job.keyword}
              </span>
            )}
          </div>

          <h2
            style={{
              margin: 0,
              fontSize: 30,
              lineHeight: 1.15,
              letterSpacing: -0.5,
            }}
          >
            {titleData.title}
          </h2>

          <p
            style={{
              marginTop: 12,
              fontSize: 16,
              color: "#475569",
              fontWeight: 900,
            }}
          >
            {job.company} · {job.location}
          </p>

          {(job.previewSummary ||
            job.highlights?.length ||
            job.riskFlags?.length ||
            job.snippet) && (
            <div
              style={{
                marginTop: 22,
                maxWidth: 1050,
                display: "grid",
                gap: 14,
              }}
            >
              {job.previewSummary && (
                <div
                  style={{
                    padding: "13px 15px",
                    borderRadius: 16,
                    background: "rgba(37,99,235,0.08)",
                    border: "1px solid rgba(37,99,235,0.16)",
                    color: "#1e3a8a",
                    fontWeight: 900,
                    lineHeight: 1.55,
                    fontSize: 14,
                  }}
                >
                  💡 {job.previewSummary}
                </div>
              )}

              {job.highlights && job.highlights.length > 0 ? (
                <div
                  style={{
                    padding: "16px 18px",
                    borderRadius: 18,
                    background: "rgba(15,23,42,0.04)",
                    border: "1px solid rgba(15,23,42,0.08)",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 10px",
                      color: "#0f172a",
                      fontSize: 13,
                      fontWeight: 950,
                      letterSpacing: 0.4,
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
                          gridTemplateColumns: "22px 1fr",
                          gap: 8,
                          alignItems: "start",
                          color: "#334155",
                          fontSize: 14,
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
                    padding: "16px 18px",
                    borderRadius: 18,
                    background: "rgba(15,23,42,0.04)",
                    border: "1px solid rgba(15,23,42,0.08)",
                    color: "#334155",
                    lineHeight: 1.65,
                    fontSize: 14,
                  }}
                >
                  {job.snippet}
                </div>
              ) : null}

              {job.riskFlags && job.riskFlags.length > 0 && (
                <div
                  style={{
                    padding: "14px 16px",
                    borderRadius: 18,
                    background: "rgba(220,38,38,0.07)",
                    border: "1px solid rgba(220,38,38,0.18)",
                  }}
                >
                  <p
                    style={{
                      margin: "0 0 8px",
                      color: "#991b1b",
                      fontSize: 13,
                      fontWeight: 950,
                      letterSpacing: 0.4,
                      textTransform: "uppercase",
                    }}
                  >
                    Watch out
                  </p>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {job.riskFlags.slice(0, 3).map((risk, i) => (
                      <span
                        key={`${risk}-${i}`}
                        style={{
                          padding: "7px 10px",
                          borderRadius: 999,
                          background: "rgba(220,38,38,0.1)",
                          color: "#991b1b",
                          fontSize: 12,
                          fontWeight: 900,
                        }}
                      >
                        ⚠️ {risk}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 24,
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
              {isAnalyzing ? "🔄 AI analyzing..." : "🤖 AI Analysis"}
            </button>
          </div>
        </div>

        <div
          style={{
            width: 116,
            height: 116,
            borderRadius: 30,
            background: scoreColor(score),
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexDirection: "column",
            fontWeight: 950,
            boxShadow: isHovered
              ? `0 24px 55px ${scoreColor(score)}66`
              : `0 18px 38px ${scoreColor(score)}44`,
            transform: isHovered ? "scale(1.08)" : "scale(1)",
            transition: "transform 0.25s ease, box-shadow 0.25s ease",
          }}
        >
          <span style={{ fontSize: 34 }}>{score}%</span>
          <span style={{ fontSize: 11, letterSpacing: 0.8 }}>MATCH</span>
        </div>
      </div>

      <div
        style={{
          maxHeight: analysisText ? 980 : 0,
          opacity: analysisText ? 1 : 0,
          overflow: "hidden",
          transform: analysisText ? "translateY(0)" : "translateY(-10px)",
          transition:
            "max-height 0.45s ease, opacity 0.3s ease, transform 0.3s ease",
        }}
      >
        {analysisText && (
          <div
            style={{
              marginTop: 26,
              padding: 0,
              background: "linear-gradient(135deg, #eef2ff, #e2e8f0)",
              border: "1px solid rgba(148,163,184,0.35)",
              borderRadius: 24,
              overflow: "hidden",
              boxShadow: "0 18px 45px rgba(15,23,42,0.12)",
            }}
          >
            <div
              style={{
                padding: "18px 22px",
                background:
                  "linear-gradient(135deg, rgba(37,99,235,0.12), rgba(124,58,237,0.10))",
                borderBottom: "1px solid rgba(148,163,184,0.28)",
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
                    fontSize: 19,
                    letterSpacing: -0.3,
                  }}
                >
                  🤖 AI Matching Insight
                </strong>

                <p
                  style={{
                    margin: "6px 0 0",
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
                padding: 22,
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
                      marginBottom: 18,
                      padding: 16,
                      borderRadius: 18,
                      background: "rgba(255,255,255,0.7)",
                      border: "1px solid rgba(148,163,184,0.25)",
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
