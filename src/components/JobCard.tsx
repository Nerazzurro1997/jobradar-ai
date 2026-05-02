import type { Job } from "../types";
import { renderAnalysis } from "../utils/renderAnalysis";
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

export function JobCard({
  job,
  index,
  analysisText,
  hoveredId,
  showSavedJobs,
  onHover,
  onAnalyze,
}: JobCardProps) {
  const score = job.score || 0;
  const isBest = index < 3;
  const isHovered = hoveredId === job.id;
  const isAnalyzing = analysisText === "⏳ Analisi in corso...";

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
            {job.title}
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
          maxHeight: analysisText ? 900 : 0,
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
              padding: 24,
              background: "linear-gradient(135deg, #eef2ff, #e2e8f0)",
              border: "1px solid rgba(148,163,184,0.3)",
              borderRadius: 22,
              maxHeight: 520,
              overflowY: "auto",
            }}
          >
            <strong
              style={{
                display: "block",
                marginBottom: 10,
                color: "#0f172a",
                fontSize: 18,
              }}
            >
              🤖 AI Analysis
            </strong>

            {isAnalyzing ? (
              <p style={{ margin: 0, color: "#475569", fontWeight: 800 }}>
                AI is analyzing this job...
              </p>
            ) : (
              renderAnalysis(analysisText)
            )}
          </div>
        )}
      </div>
    </article>
  );
}