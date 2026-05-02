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

  return (
    <div
      className="job-card"
      key={job.url || job.id}
      onMouseEnter={() => onHover(job.id)}
      onMouseLeave={() => onHover(null)}
      style={{
        position: "relative",
        overflow: "hidden",
        background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
        color: "#0f172a",
        padding: 32,
        borderRadius: 28,
        border: isBest
          ? "2px solid rgba(21,128,61,0.38)"
          : "1px solid rgba(226,232,240,0.8)",
        boxShadow: isHovered
          ? "0 35px 85px rgba(0,0,0,0.34)"
          : isBest
          ? "0 28px 70px rgba(21,128,61,0.12)"
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
          height: 5,
          background: scoreColor(score),
        }}
      />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 120px",
          gap: 26,
          alignItems: "start",
        }}
      >
        <div>
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 12,
            }}
          >
            {isBest && (
              <span
                style={{
                  background: "rgba(21,128,61,0.12)",
                  color: "#166534",
                  border: "1px solid rgba(21,128,61,0.28)",
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
                💾 Gespeichert
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

          {job.keyword && (
            <span
              style={{
                display: "inline-block",
                marginTop: 8,
                background: "#dbeafe",
                color: "#1d4ed8",
                padding: "7px 12px",
                borderRadius: 999,
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              Gefunden mit: {job.keyword}
            </span>
          )}

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
                    background: "rgba(37, 99, 235, 0.08)",
                    border: "1px solid rgba(37, 99, 235, 0.16)",
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
                    background: "rgba(15, 23, 42, 0.04)",
                    border: "1px solid rgba(15, 23, 42, 0.08)",
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
                        key={i}
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
                    background: "rgba(15, 23, 42, 0.04)",
                    border: "1px solid rgba(15, 23, 42, 0.08)",
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
                    background: "rgba(220, 38, 38, 0.07)",
                    border: "1px solid rgba(220, 38, 38, 0.18)",
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
                    Achtung
                  </p>

                  <div
                    style={{
                      display: "flex",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    {job.riskFlags.slice(0, 3).map((risk, i) => (
                      <span
                        key={i}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 10px",
                          borderRadius: 999,
                          background: "rgba(220, 38, 38, 0.1)",
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
                className="premium-link"
                href={job.url}
                target="_blank"
                rel="noreferrer"
                style={{
                  background: "#0f172a",
                  color: "white",
                  textDecoration: "none",
                  padding: "12px 16px",
                  borderRadius: 14,
                  fontWeight: 900,
                  boxShadow: "0 12px 24px rgba(15,23,42,0.22)",
                }}
              >
                Stelle öffnen
              </a>
            )}

            <button
              className="premium-btn"
              onClick={() => onAnalyze(job)}
              disabled={isAnalyzing}
              style={{
                background: isAnalyzing
                  ? "#64748b"
                  : "linear-gradient(135deg, #2563eb, #1d4ed8)",
                color: "white",
                border: "none",
                padding: "12px 16px",
                borderRadius: 14,
                cursor: isAnalyzing ? "not-allowed" : "pointer",
                fontWeight: 900,
                boxShadow: isAnalyzing
                  ? "none"
                  : "0 12px 24px rgba(37,99,235,0.25)",
              }}
            >
              {isAnalyzing ? "Analyse läuft..." : "AI Analyse"}
            </button>
          </div>
        </div>

        <div
          style={{
            width: 108,
            height: 108,
            borderRadius: 28,
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
            transform: isHovered ? "scale(1.04)" : "scale(1)",
            transition: "transform 0.25s ease, box-shadow 0.25s ease",
          }}
        >
          <span style={{ fontSize: 32 }}>{score}%</span>
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
                marginBottom: 8,
                color: "#0f172a",
                fontSize: 18,
              }}
            >
              AI Analyse
            </strong>
            {renderAnalysis(analysisText)}
          </div>
        )}
      </div>
    </div>
  );
}