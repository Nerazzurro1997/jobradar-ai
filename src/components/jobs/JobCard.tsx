import { useEffect, useRef, useState } from "react";
import { getJobDisplayScore } from "../../utils/jobs";
import { scoreColor, scoreLabel } from "../../utils/score";
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
  getRecencyLabel,
  getRecommendationStyle,
  isMobileViewport,
  isNewSavedJob,
  resetPageOverflow,
  toNumber,
} from "./JobCardUtils";

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
