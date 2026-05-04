import { useEffect, useRef, useState } from "react";
import { getJobDisplayScore } from "../../utils/jobs";
import { scoreColor } from "../../utils/score";
import {
  DesktopAnalysisContent,
  MobileAnalysisModal,
} from "./JobCardAnalysis";
import { Badge } from "./JobCardBadges";
import type { JobCardProps, JobWithOptionalFields } from "./JobCardTypes";
import { ANALYZING_TEXT } from "./JobCardTypes";
import {
  extractWorkloadFromTitle,
  getAnalysisSummary,
  getDistanceLabel,
  getExplicitWorkload,
  getMetaItems,
  getRecommendationStyle,
  isMobileViewport,
  resetPageOverflow,
  toNumber,
} from "./JobCardUtils";

function getMainBadge(score: number, isBestChoice: boolean) {
  if (isBestChoice) {
    return {
      label: "Best choice",
      tone: "green" as const,
    };
  }

  if (score >= 85) {
    return {
      label: "Best Match",
      tone: "green" as const,
    };
  }

  if (score >= 70) {
    return {
      label: "Good Match",
      tone: "amber" as const,
    };
  }

  return {
    label: "Weak",
    tone: "red" as const,
  };
}

function getScoreConfidenceLabel(score: number) {
  if (score >= 85) return "High confidence";
  if (score >= 70) return "Good opportunity";
  return "Review carefully";
}

function getDecisionLine(score: number) {
  if (score >= 85) {
    return {
      icon: "🟢",
      label: "Strong match",
      background: "rgba(34,197,94,0.08)",
      border: "1px solid rgba(34,197,94,0.18)",
      color: "#166534",
    };
  }

  if (score >= 70) {
    return {
      icon: "🟡",
      label: "Good match",
      background: "rgba(245,158,11,0.08)",
      border: "1px solid rgba(245,158,11,0.18)",
      color: "#92400e",
    };
  }

  return {
    icon: "🔴",
    label: "Low match",
    background: "rgba(220,38,38,0.06)",
    border: "1px solid rgba(220,38,38,0.14)",
    color: "#991b1b",
  };
}

function getMetaItemByPrefix(items: string[], prefix: string) {
  return items.find((item) =>
    item.toLowerCase().startsWith(prefix.toLowerCase())
  );
}

function cleanReasonLabel(value: string) {
  const cleaned = value
    .replace(/^Reason:\s*/i, "")
    .replace(/\bcv[-_\s]*direct\b/gi, "")
    .replace(/\s*[|,/]\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";

  return cleaned.length > 58 ? `${cleaned.slice(0, 55).trim()}...` : cleaned;
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
  const modalOpenRef = useRef(false);

  const score = getJobDisplayScore(job);
  const isBestChoice = showSavedJobs && index < 3;
  const isHovered = hoveredId === job.id;

  const titleData = extractWorkloadFromTitle(job.title || "Untitled job");
  const explicitWorkload = getExplicitWorkload(rankedJob);
  const workload = titleData.workload || explicitWorkload;

  const distanceScore = toNumber(rankedJob.distanceScore);
  const distanceLabel = getDistanceLabel(distanceScore);
  const metaItems = getMetaItems(rankedJob);
  const savedIsNew = showSavedJobs && rankedJob.uiDecisionSection === "new";
  const mainBadge = getMainBadge(score, isBestChoice);
  const scoreConfidenceLabel = getScoreConfidenceLabel(score);
  const decisionLine = getDecisionLine(score);

  const publishedMetaItem = getMetaItemByPrefix(metaItems, "Published");
  const cvMatchMetaItem = getMetaItemByPrefix(metaItems, "CV match");
  const reasonMetaItem = getMetaItemByPrefix(metaItems, "Reason:");
  const reasonLabel = reasonMetaItem ? cleanReasonLabel(reasonMetaItem) : "";

  const firstMetaRow = [
    distanceLabel ? `📍 ${distanceLabel}` : "",
    publishedMetaItem ? `📅 ${publishedMetaItem}` : "",
  ].filter(Boolean);

  const secondMetaRow = [
    cvMatchMetaItem ? `🎯 ${cvMatchMetaItem}` : "",
    workload ? `Workload ${workload}` : "",
  ].filter(Boolean);

  const thirdMetaRow = [reasonLabel ? `💡 ${reasonLabel}` : ""].filter(Boolean);

  const metaRows = [firstMetaRow, secondMetaRow, thirdMetaRow].filter(
    (row) => row.length > 0
  );

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
    if (!analysisModalOpen || !isMobileViewport()) {
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

  return (
    <>
      <article
        className="job-card fade-in"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => onHover(null)}
        style={{
          position: "relative",
          overflow: "hidden",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background:
            "radial-gradient(circle at 8% 0%, rgba(59,130,246,0.08), transparent 34%), linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
          color: "#0f172a",
          padding: 0,
          borderRadius: 21,
          border: isBestChoice
            ? "1px solid rgba(34,197,94,0.42)"
            : showSavedJobs
              ? "1px solid rgba(34,197,94,0.22)"
              : "1px solid rgba(226,232,240,0.9)",
          boxShadow: isHovered
            ? "0 28px 70px rgba(0,0,0,0.26)"
            : isBestChoice
              ? "0 20px 48px rgba(34,197,94,0.16), inset 0 1px 0 rgba(255,255,255,0.92)"
              : "0 18px 44px rgba(0,0,0,0.16), inset 0 1px 0 rgba(255,255,255,0.9)",
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
            flex: 1,
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr) 92px",
            gap: 14,
            alignItems: "start",
            padding: "16px 18px 16px 20px",
          }}
        >
          <div
            className="jr-job-card-body"
            style={{
              minWidth: 0,
              height: "100%",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div
              style={{
                display: "flex",
                gap: 6,
                flexWrap: "wrap",
                marginBottom: 8,
              }}
            >
              {showSavedJobs && <Badge tone="blue">Saved</Badge>}
              {savedIsNew && <Badge tone="green">NEW</Badge>}
              <Badge tone={mainBadge.tone}>{mainBadge.label}</Badge>
              {distanceLabel && <Badge tone="blue">{distanceLabel}</Badge>}
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

            {metaRows.length > 0 && (
              <div
                className="jr-job-meta-row"
                style={{
                  display: "grid",
                  gap: 5,
                  marginTop: 8,
                  color: "#64748b",
                  fontSize: 11.5,
                  fontWeight: 850,
                  lineHeight: 1.35,
                }}
              >
                {metaRows.map((row, rowIndex) => (
                  <span
                    key={`meta-${rowIndex}`}
                    style={{ display: "block", overflowWrap: "anywhere" }}
                  >
                    {row.join(" · ")}
                  </span>
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
                  marginTop: 11,
                  maxWidth: 980,
                  display: "grid",
                  gap: 7,
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
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {job.previewSummary}
                  </div>
                )}

                {visibleHighlights.length > 0 ? (
                  <div
                    style={{
                      padding: "8px 10px",
                      borderRadius: 12,
                      background: "rgba(15,23,42,0.022)",
                      border: "1px solid rgba(15,23,42,0.05)",
                    }}
                  >
                    <p
                      style={{
                        margin: "0 0 6px",
                        color: "#0f172a",
                        fontSize: 11,
                        fontWeight: 950,
                        letterSpacing: 0,
                        textTransform: "uppercase",
                      }}
                    >
                      Highlights
                    </p>

                    <div style={{ display: "grid", gap: 5 }}>
                      {visibleHighlights.map((highlight, i) => (
                        <div
                          key={`${highlight}-${i}`}
                          style={{
                            display: "grid",
                            gridTemplateColumns: "16px 1fr",
                            gap: 7,
                            alignItems: "start",
                            color: "#334155",
                            fontSize: 12.3,
                            lineHeight: 1.38,
                          }}
                        >
                          <span style={{ color: "#15803d", fontWeight: 950 }}>
                            ✓
                          </span>
                          <span
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                            }}
                          >
                            {highlight}
                          </span>
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
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
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
              style={{
                marginTop: "auto",
                paddingTop: 10,
              }}
            >
              <div
                className="jr-job-decision-line"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  maxWidth: "100%",
                  padding: "6px 10px",
                  borderRadius: 999,
                  background: decisionLine.background,
                  border: decisionLine.border,
                  color: decisionLine.color,
                  fontSize: 12,
                  fontWeight: 900,
                  lineHeight: 1.2,
                }}
              >
                <span aria-hidden="true">{decisionLine.icon}</span>
                <span>{decisionLine.label}</span>
              </div>

              <div
                className="jr-job-actions"
                style={{
                  display: "flex",
                  gap: 8,
                  marginTop: 10,
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
                      background:
                        "linear-gradient(135deg, #1f2937 0%, #0f172a 100%)",
                      border: "1px solid rgba(15,23,42,0.16)",
                      boxShadow: "0 10px 20px rgba(15,23,42,0.18)",
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
                    background:
                      "linear-gradient(135deg, #2563eb 0%, #0891b2 100%)",
                    border: "1px solid rgba(37,99,235,0.18)",
                    boxShadow: "0 10px 20px rgba(37,99,235,0.18)",
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
          </div>

          <div
            className="jr-score-column"
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "flex-start",
            }}
          >
            <div
              className="jr-score-box"
              style={{
                width: 82,
                height: 86,
                borderRadius: 19,
                background: `linear-gradient(135deg, ${scoreColor(
                  score
                )} 0%, ${scoreColor(score)}dd 100%)`,
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                fontWeight: 950,
                textAlign: "center",
                padding: "7px 6px",
                boxShadow: isHovered
                  ? `0 20px 42px ${scoreColor(score)}55`
                  : `0 14px 30px ${scoreColor(score)}30`,
                transform: isHovered ? "scale(1.035)" : "scale(1)",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              <span style={{ fontSize: 24, lineHeight: 1 }}>{score}%</span>
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
              <span
                style={{
                  marginTop: 4,
                  maxWidth: 66,
                  fontSize: 8,
                  lineHeight: 1.1,
                  opacity: 0.92,
                }}
              >
                {scoreConfidenceLabel}
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

      <MobileAnalysisModal
        open={analysisModalOpen}
        title={titleData.title}
        analysisText={mobileAnalysisText}
        isAnalyzing={mobileIsAnalyzing}
        analysisSummary={
          analysisSummary || "AI is preparing a recommendation for this job."
        }
        recommendationStyle={recommendationStyle}
        onClose={() => setAnalysisModalOpen(false)}
      />
    </>
  );
}
