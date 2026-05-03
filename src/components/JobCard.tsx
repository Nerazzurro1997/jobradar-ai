import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
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
  uiDecisionSection?: "new" | "all" | "live";
};

type BadgeTone = "neutral" | "blue" | "green" | "amber" | "red" | "purple";

type RecommendationStyle = {
  label: string;
  background: string;
  border: string;
  color: string;
};

type MobileAnalysisSection = {
  title: string;
  items: string[];
};

const ANALYZING_TEXT = "⏳ Analisi in corso...";

function resetPageOverflow() {
  if (typeof document === "undefined") return;

  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
  console.log("BODY OVERFLOW RESET");
}

function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

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
    .replace(/\r/g, "")
    .trim();
}

function cleanBullet(line: string) {
  return line
    .replace(/^[-•*]\s*/, "")
    .replace(/^(\d+\.|\d+\))\s*/, "")
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

function getRecommendationStyle(text?: string): RecommendationStyle {
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

function getCompactDistanceLabel(distanceScore: number) {
  if (distanceScore >= 90) return "Very close";
  if (distanceScore >= 75) return "Close";
  if (distanceScore >= 60) return "Reachable";
  if (distanceScore > 0) return "Far";
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
  if (job.uiDecisionSection === "new") return true;

  const savedAt = getDateTime(job.savedAt);
  if (!savedAt) return false;

  const oneDayMs = 24 * 60 * 60 * 1000;
  return Date.now() - savedAt <= oneDayMs;
}

function getMetaItems(job: JobWithOptionalFields) {
  const items: string[] = [];

  const distanceScore = toNumber(job.distanceScore);
  const requirementMatchScore = toNumber(job.requirementMatchScore);
  const compactDistanceLabel = getCompactDistanceLabel(distanceScore);
  const publishedDate = formatDate(job.publishedDate);

  if (compactDistanceLabel) {
    items.push(compactDistanceLabel);
  }

  if (publishedDate) {
    items.push(`Published ${publishedDate}`);
  }

  if (requirementMatchScore > 0) {
    items.push(`CV match ${requirementMatchScore}`);
  }

  if (job.keyword) {
    items.push(`Reason: ${job.keyword}`);
  }

  return items;
}

function parseMobileAnalysisSections(text: string): MobileAnalysisSection[] {
  const lines = cleanAnalysisText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: MobileAnalysisSection[] = [];
  let current: MobileAnalysisSection = {
    title: "Key points",
    items: [],
  };

  function pushCurrent() {
    if (current.items.length > 0) {
      sections.push({
        title: current.title,
        items: current.items.slice(0, 2),
      });
    }
  }

  for (const line of lines) {
    if (/^\d{1,3}\s*%$/.test(line)) continue;

    const headingMatch = line.match(/^([^:]{2,62}):\s*(.*)$/);

    if (headingMatch) {
      pushCurrent();

      current = {
        title: headingMatch[1].trim(),
        items: [],
      };

      if (headingMatch[2]?.trim()) {
        current.items.push(cleanBullet(headingMatch[2]));
      }

      continue;
    }

    if (isSectionTitle(line) && line.length < 72) {
      pushCurrent();

      current = {
        title: line.replace(/:$/, "").trim(),
        items: [],
      };

      continue;
    }

    current.items.push(cleanBullet(line));
  }

  pushCurrent();

  if (sections.length === 0) {
    return [
      {
        title: "Details",
        items: lines.slice(0, 2).map(cleanBullet),
      },
    ];
  }

  return sections.slice(0, 6);
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: BadgeTone;
}) {
  const styles: Record<
    BadgeTone,
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
        minHeight: 23,
        padding: "5px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 900,
        lineHeight: 1,
        ...styles[tone],
      }}
    >
      {children}
    </span>
  );
}

function DesktopAnalysisContent({
  analysisText,
  isAnalyzing,
  analysisSummary,
  recommendationStyle,
}: {
  analysisText: string;
  isAnalyzing: boolean;
  analysisSummary: string;
  recommendationStyle: RecommendationStyle;
}) {
  return (
    <>
      <div className="jr-analysis-head">
        <div>
          <strong className="jr-analysis-title">AI Matching Insight</strong>
          <p className="jr-analysis-subtitle">
            Personalized analysis based on your CV profile.
          </p>
        </div>

        <span
          className="jr-analysis-status"
          style={{
            background: isAnalyzing
              ? "rgba(245,158,11,0.14)"
              : recommendationStyle.background,
            color: isAnalyzing ? "#92400e" : recommendationStyle.color,
            border: isAnalyzing
              ? "1px solid rgba(245,158,11,0.28)"
              : recommendationStyle.border,
          }}
        >
          {isAnalyzing ? "Analyzing" : recommendationStyle.label}
        </span>
      </div>

      <div className="jr-analysis-body">
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
            <div className="jr-analysis-summary">
              <p>{analysisSummary}</p>
            </div>

            {renderAnalysis(analysisText)}
          </>
        )}
      </div>
    </>
  );
}

function MobileAnalysisContent({
  analysisText,
  isAnalyzing,
  analysisSummary,
  recommendationStyle,
}: {
  analysisText: string;
  isAnalyzing: boolean;
  analysisSummary: string;
  recommendationStyle: RecommendationStyle;
}) {
  const sections = parseMobileAnalysisSections(analysisText);

  if (isAnalyzing) {
    return (
      <div className="jr-mobile-analysis-loading">
        <p>AI is analyzing this job...</p>
        <span />
        <span />
        <span />
      </div>
    );
  }

  return (
    <div className="jr-mobile-analysis-content">
      <div
        className="jr-mobile-analysis-verdict"
        style={{
          border: recommendationStyle.border,
          background: recommendationStyle.background,
        }}
      >
        <span style={{ color: recommendationStyle.color }}>
          {recommendationStyle.label}
        </span>
        <p>{analysisSummary}</p>
      </div>

      <div className="jr-mobile-analysis-sections">
        {sections.map((section, sectionIndex) => (
          <section
            className="jr-mobile-analysis-section"
            key={`${section.title}-${sectionIndex}`}
          >
            <h3>{section.title}</h3>

            <div>
              {section.items.slice(0, 2).map((item, itemIndex) => (
                <p key={`${item}-${itemIndex}`}>{item}</p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
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
  const [analysisModalOpen, setAnalysisModalOpen] = useState(false);
  const previousModalOpenRef = useRef(false);
  const modalOpenRef = useRef(false);

  const score = getJobDisplayScore(job);
  const isBestChoice = showSavedJobs && index < 3;
  const isHovered = hoveredId === job.id;

  const titleData = extractWorkloadFromTitle(job.title || "Untitled job");
  const explicitWorkload = getExplicitWorkload(rankedJob);
  const workload = titleData.workload || explicitWorkload;

  const distanceScore = toNumber(rankedJob.distanceScore);
  const distanceLabel = getDistanceLabel(distanceScore);
  const recencyLabel = getRecencyLabel(rankedJob);
  const metaItems = getMetaItems(rankedJob);
  const savedIsNew = showSavedJobs && isNewSavedJob(rankedJob);

  const visibleHighlights = job.highlights?.slice(0, 2) ?? [];
  const hiddenHighlightsCount = Math.max((job.highlights?.length ?? 0) - 2, 0);
  const visibleRiskFlags = job.riskFlags?.slice(0, 1) ?? [];

  const normalizedAnalysis = analysisText?.toLowerCase() || "";
  const isAnalyzing =
    analysisText === ANALYZING_TEXT ||
    normalizedAnalysis.includes("analisi in corso") ||
    normalizedAnalysis.includes("ai is analyzing");

  const hasAnalysis = Boolean(analysisText);
  const hasFinishedAnalysis = Boolean(analysisText && !isAnalyzing);
  const analysisSummary = getAnalysisSummary(analysisText);
  const recommendationStyle = getRecommendationStyle(analysisText);

  const mobileAnalysisText = analysisText || ANALYZING_TEXT;
  const mobileIsAnalyzing = isAnalyzing || !analysisText;

  useEffect(() => {
    modalOpenRef.current = analysisModalOpen;
  }, [analysisModalOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function closeAnalysisModal() {
      setAnalysisModalOpen(false);
      resetPageOverflow();
    }

    window.addEventListener("jobradar:close-ai-analysis", closeAnalysisModal);

    return () => {
      window.removeEventListener(
        "jobradar:close-ai-analysis",
        closeAnalysisModal
      );

      if (modalOpenRef.current) {
        resetPageOverflow();
      }
    };
  }, []);

  useEffect(() => {
    const mobile = isMobileViewport();

    if (previousModalOpenRef.current !== analysisModalOpen) {
      console.log("AI MODAL STATE", {
        isOpen: analysisModalOpen,
        isMobile: mobile,
      });
    }

    previousModalOpenRef.current = analysisModalOpen;

    if (!analysisModalOpen || !mobile) {
      resetPageOverflow();
      return;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setAnalysisModalOpen(false);
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.removeEventListener("keydown", handleEscape);
      resetPageOverflow();
    };
  }, [analysisModalOpen]);

  const handleMouseEnter = () => {
    if (typeof job.id === "number") {
      onHover(job.id);
    }
  };

  const handleAnalyzeClick = () => {
    if (isMobileViewport()) {
      setAnalysisModalOpen(true);
    }

    if (!hasAnalysis) {
      onAnalyze(job);
    }
  };

  const mobileModal =
    analysisModalOpen && typeof document !== "undefined"
      ? createPortal(
          <div
            className="jr-analysis-mobile-modal"
            role="dialog"
            aria-modal="true"
            aria-label="AI Analysis"
          >
            <header className="jr-analysis-mobile-modal-header">
              <div>
                <p>AI Analysis</p>
                <h2>{titleData.title}</h2>
              </div>

              <button
                type="button"
                aria-label="Close AI analysis"
                onClick={() => setAnalysisModalOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="jr-analysis-mobile-scroll">
              <MobileAnalysisContent
                analysisText={mobileAnalysisText}
                isAnalyzing={mobileIsAnalyzing}
                analysisSummary={
                  analysisSummary ||
                  "AI is preparing a recommendation for this job."
                }
                recommendationStyle={recommendationStyle}
              />
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <>
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
          border: isBestChoice
            ? "1px solid rgba(34,197,94,0.42)"
            : showSavedJobs
              ? "1px solid rgba(34,197,94,0.22)"
              : "1px solid rgba(226,232,240,0.9)",
          boxShadow: isHovered
            ? "0 24px 58px rgba(0,0,0,0.24)"
            : isBestChoice
              ? "0 18px 42px rgba(34,197,94,0.16)"
              : "0 16px 38px rgba(0,0,0,0.16)",
          transform: isHovered ? "translateY(-3px)" : "none",
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
            width: 4,
            background: scoreColor(score),
          }}
        />

        {isBestChoice && (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background:
                "linear-gradient(135deg, rgba(34,197,94,0.08), transparent 36%)",
            }}
          />
        )}

        <div
          className="jr-job-card-main"
          style={{
            position: "relative",
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
              {showSavedJobs && <Badge tone="blue">Saved</Badge>}
              {savedIsNew && <Badge tone="green">NEW</Badge>}
              {isBestChoice && <Badge tone="green">Best choice</Badge>}

              <Badge>{scoreLabel(score)}</Badge>

              {distanceLabel && <Badge tone="blue">{distanceLabel}</Badge>}
              {recencyLabel && <Badge>{recencyLabel}</Badge>}
              {workload && <Badge tone="amber">{workload}</Badge>}
              {hasFinishedAnalysis && <Badge tone="purple">AI reviewed</Badge>}
            </div>

            <h2
              style={{
                margin: 0,
                color: "#0f172a",
                fontSize: 21,
                lineHeight: 1.18,
                letterSpacing: 0,
              }}
            >
              {titleData.title}
            </h2>

            <p
              style={{
                margin: "7px 0 0",
                fontSize: 13,
                color: "#475569",
                fontWeight: 900,
                lineHeight: 1.35,
              }}
            >
              {job.company} · {job.location}
            </p>

            {metaItems.length > 0 && (
              <div
                className="jr-job-meta-row"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "6px 10px",
                  marginTop: 9,
                  color: "#64748b",
                  fontSize: 11.5,
                  fontWeight: 850,
                  lineHeight: 1.35,
                }}
              >
                {metaItems.slice(0, 4).map((item) => (
                  <span key={item}>{item}</span>
                ))}
              </div>
            )}

            {(job.previewSummary ||
              visibleHighlights.length > 0 ||
              visibleRiskFlags.length > 0 ||
              job.snippet) && (
              <div
                className="jr-job-card-content"
                style={{
                  marginTop: 13,
                  maxWidth: 980,
                  display: "grid",
                  gap: 9,
                }}
              >
                {job.previewSummary && (
                  <div
                    style={{
                      padding: "10px 12px",
                      borderRadius: 12,
                      background: "rgba(37,99,235,0.07)",
                      border: "1px solid rgba(37,99,235,0.14)",
                      color: "#1e3a8a",
                      fontWeight: 850,
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
                      borderRadius: 13,
                      background: "rgba(15,23,42,0.035)",
                      border: "1px solid rgba(15,23,42,0.07)",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 7px",
                        color: "#0f172a",
                        fontSize: 11,
                        fontWeight: 950,
                        letterSpacing: 0,
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
                            gridTemplateColumns: "16px 1fr",
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

                      {hiddenHighlightsCount > 0 && (
                        <span
                          style={{
                            color: "#64748b",
                            fontSize: 11.5,
                            fontWeight: 850,
                          }}
                        >
                          +{hiddenHighlightsCount} more highlights
                        </span>
                      )}
                    </div>
                  </div>
                ) : job.snippet ? (
                  <div
                    style={{
                      padding: "11px 12px",
                      borderRadius: 13,
                      background: "rgba(15,23,42,0.035)",
                      border: "1px solid rgba(15,23,42,0.07)",
                      color: "#334155",
                      lineHeight: 1.5,
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
                      borderRadius: 13,
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
                        letterSpacing: 0,
                        textTransform: "uppercase",
                      }}
                    >
                      Watch out
                    </p>

                    <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
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
              className="jr-job-actions"
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
                  }}
                >
                  Open Job
                </a>
              )}

              <button
                className="btn btn-blue"
                onClick={handleAnalyzeClick}
                style={{
                  padding: "9px 13px",
                  fontSize: 13,
                  opacity: isAnalyzing ? 0.85 : 1,
                  cursor: "pointer",
                }}
              >
                {isAnalyzing
                  ? "AI analyzing..."
                  : hasFinishedAnalysis
                    ? "View AI Analysis"
                    : "AI Analysis"}
              </button>
            </div>
          </div>

          <div
            className="jr-score-column"
            style={{
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <div
              className="jr-score-box"
              style={{
                width: 82,
                height: 82,
                borderRadius: 21,
                background: scoreColor(score),
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                fontWeight: 950,
                boxShadow: isHovered
                  ? `0 20px 42px ${scoreColor(score)}55`
                  : `0 14px 30px ${scoreColor(score)}30`,
                transform: isHovered ? "scale(1.035)" : "scale(1)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              <span style={{ fontSize: 25, lineHeight: 1 }}>{score}%</span>
              <span
                style={{
                  marginTop: 4,
                  fontSize: 9,
                  letterSpacing: 0,
                  textTransform: "uppercase",
                }}
              >
                Match
              </span>
            </div>
          </div>
        </div>

        {analysisText && (
          <div className="jr-analysis-desktop-panel">
            <DesktopAnalysisContent
              analysisText={analysisText}
              isAnalyzing={isAnalyzing}
              analysisSummary={analysisSummary}
              recommendationStyle={recommendationStyle}
            />
          </div>
        )}
      </article>

      {mobileModal}
    </>
  );
}
