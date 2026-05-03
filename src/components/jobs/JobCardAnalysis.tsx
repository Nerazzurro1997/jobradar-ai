import { createPortal } from "react-dom";
import { renderAnalysis } from "../../utils/renderAnalysis";
import type { RecommendationStyle } from "./JobCardTypes";
import { parseMobileAnalysisSections } from "./JobCardUtils";

type DesktopAnalysisContentProps = {
  analysisText: string;
  isAnalyzing: boolean;
  analysisSummary: string;
  recommendationStyle: RecommendationStyle;
};

type MobileAnalysisContentProps = {
  analysisText: string;
  isAnalyzing: boolean;
  analysisSummary: string;
  recommendationStyle: RecommendationStyle;
};

type MobileAnalysisModalProps = MobileAnalysisContentProps & {
  open: boolean;
  title: string;
  onClose: () => void;
};

export function DesktopAnalysisContent({
  analysisText,
  isAnalyzing,
  analysisSummary,
  recommendationStyle,
}: DesktopAnalysisContentProps) {
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
}: MobileAnalysisContentProps) {
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

export function MobileAnalysisModal({
  open,
  title,
  analysisText,
  isAnalyzing,
  analysisSummary,
  recommendationStyle,
  onClose,
}: MobileAnalysisModalProps) {
  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="jr-analysis-mobile-modal"
      role="dialog"
      aria-modal="true"
      aria-label="AI Analysis"
    >
      <header className="jr-analysis-mobile-modal-header">
        <div>
          <p>AI Analysis</p>
          <h2>{title}</h2>
        </div>

        <button type="button" aria-label="Close AI analysis" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="jr-analysis-mobile-scroll">
        <MobileAnalysisContent
          analysisText={analysisText}
          isAnalyzing={isAnalyzing}
          analysisSummary={analysisSummary}
          recommendationStyle={recommendationStyle}
        />
      </div>
    </div>,
    document.body
  );
}
