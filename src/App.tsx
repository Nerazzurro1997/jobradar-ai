import { useState } from "react";

type Job = {
  id: number;
  title: string;
  company: string;
  location: string;
  url?: string;
  snippet?: string;
  keyword?: string;
  score?: number;
};

type SearchStats = {
  foundLinks?: number;
  scanned?: number;
  shown?: number;
};

const SUPABASE_FUNCTION_URL =
  "https://splummvxjbyubbtiiebl.supabase.co/functions/v1/match-job";

const SUPABASE_SEARCH_JOBS_URL =
  "https://splummvxjbyubbtiiebl.supabase.co/functions/v1/search-jobs";

const SUPABASE_ANON_KEY = "sb_publishable_Kc7qxUo7qpHaRz3w-wOCWg_rVqIeixX";

export default function App() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [analysis, setAnalysis] = useState<{ [key: number]: string }>({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [onlyTop, setOnlyTop] = useState(false);
  const [stats, setStats] = useState<SearchStats>({});

  const displayedJobs = jobs.filter(
    (job) => !onlyTop || (job.score || 0) >= 80
  );

  const bestScore = jobs.length
    ? Math.max(...jobs.map((job) => job.score || 0))
    : 0;

  const averageScore = jobs.length
    ? Math.round(
        jobs.reduce((sum, job) => sum + (job.score || 0), 0) / jobs.length
      )
    : 0;

  function scoreColor(score = 0) {
    if (score >= 85) return "#15803d";
    if (score >= 75) return "#84cc16";
    if (score >= 65) return "#f59e0b";
    return "#ef4444";
  }

  function scoreLabel(score = 0) {
    if (score >= 90) return "Elite Match";
    if (score >= 80) return "Top Match";
    if (score >= 70) return "Good Match";
    if (score >= 65) return "Possible";
    return "Weak";
  }

  const toBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const base64 = reader.result?.toString().split(",")[1];
        resolve(base64 || "");
      };
      reader.onerror = reject;
    });
  };

  async function searchJobs() {
    if (!cvFile) {
      alert("Carica prima il CV PDF");
      return;
    }

    setSearchLoading(true);
    setJobs([]);
    setAnalysis({});
    setOnlyTop(false);
    setStats({});

    try {
      const base64 = await toBase64(cvFile);

      const response = await fetch(SUPABASE_SEARCH_JOBS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          fileName: cvFile.name,
          fileBase64: base64,
          location: "Zürich",
        }),
      });

      const rawText = await response.text();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(rawText.slice(0, 300));
      }

      if (data.error) {
        throw new Error(data.error);
      }

      setJobs(data.jobs || []);
      setStats({
        foundLinks: data.foundLinks,
        scanned: data.scanned,
        shown: data.count,
      });

      console.log("AI Profile:", data.profile);
    } catch (error) {
      alert("Fehler bei der Jobsuche: " + String(error));
    } finally {
      setSearchLoading(false);
    }
  }

  async function analyzeJob(job: Job) {
    if (!cvFile) {
      alert("Carica prima il CV PDF");
      return;
    }

    setAnalysis((prev) => ({
      ...prev,
      [job.id]: "⏳ Analisi in corso...",
    }));

    try {
      const base64 = await toBase64(cvFile);

      const response = await fetch(SUPABASE_FUNCTION_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          fileName: cvFile.name,
          fileBase64: base64,
          job,
        }),
      });

      const rawText = await response.text();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(rawText.slice(0, 300));
      }

      const raw =
        data?.text ||
        data?.output?.[0]?.content?.[0]?.text ||
        data?.error ||
        "Nessuna risposta";

      const formatted = raw
        .replace(/\*\*/g, "")
        .replace(/###/g, "")
        .replace(/---/g, "")
        .replace(/Vielen Dank.*?\./, "")
        .trim();

      setAnalysis((prev) => ({
        ...prev,
        [job.id]: formatted,
      }));
    } catch (error) {
      setAnalysis((prev) => ({
        ...prev,
        [job.id]: "Errore: " + String(error),
      }));
    }
  }

  function renderAnalysis(text: string) {
    if (text === "⏳ Analisi in corso...") {
      return (
        <p style={{ fontWeight: 800, color: "#0f172a" }}>
          ⏳ Analisi in corso...
        </p>
      );
    }

    return (
      <div style={{ lineHeight: 1.7 }}>
        {text.split("\n").map((line, i) => {
          const cleanLine = line.trim();
          if (!cleanLine) return null;

          if (cleanLine.toLowerCase().includes("match score")) {
            return (
              <h2
                key={i}
                style={{
                  color: "#166534",
                  marginTop: 12,
                  marginBottom: 14,
                  fontSize: 28,
                }}
              >
                {cleanLine}
              </h2>
            );
          }

          if (cleanLine.toLowerCase().includes("warum")) {
            return (
              <h3 key={i} style={{ color: "#2563eb", marginTop: 24 }}>
                💡 {cleanLine}
              </h3>
            );
          }

          if (cleanLine.toLowerCase().includes("risiken")) {
            return (
              <h3 key={i} style={{ color: "#dc2626", marginTop: 24 }}>
                ⚠️ {cleanLine}
              </h3>
            );
          }

          if (cleanLine.toLowerCase().includes("empfehlung")) {
            return (
              <h3 key={i} style={{ color: "#7c3aed", marginTop: 24 }}>
                🎯 {cleanLine}
              </h3>
            );
          }

          if (cleanLine.startsWith("-")) {
            return (
              <p key={i} style={{ marginLeft: 18, color: "#334155" }}>
                • {cleanLine.replace("-", "").trim()}
              </p>
            );
          }

          return (
            <p key={i} style={{ marginBottom: 10, color: "#1e293b" }}>
              {cleanLine}
            </p>
          );
        })}
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        background:
          "radial-gradient(circle at top left, #1e3a8a 0, transparent 30%), radial-gradient(circle at top right, #065f46 0, transparent 28%), #020617",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial",
      }}
    >
      <aside
        style={{
          width: 240,
          background: "rgba(2, 6, 23, 0.86)",
          color: "white",
          padding: 26,
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          borderRight: "1px solid rgba(148, 163, 184, 0.16)",
        }}
      >
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "linear-gradient(135deg, #2563eb, #15803d)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: 900,
            }}
          >
            JR
          </div>
          <div>
            <h2 style={{ margin: 0 }}>JobRadar AI</h2>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#94a3b8" }}>
              Dein persönlicher Job Scout
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 36 }}>
          <button
            style={{
              padding: "13px 14px",
              background: "linear-gradient(135deg, #15803d, #166534)",
              color: "white",
              border: "none",
              borderRadius: 14,
              fontWeight: 900,
              textAlign: "left",
            }}
          >
            📊 Dashboard
          </button>

          <button
            style={{
              padding: "13px 14px",
              background: "rgba(30, 41, 59, 0.8)",
              color: "#e2e8f0",
              border: "1px solid rgba(148, 163, 184, 0.14)",
              borderRadius: 14,
              fontWeight: 900,
              textAlign: "left",
            }}
          >
            📄 Mein CV
          </button>
        </div>

        <div
          style={{
            marginTop: 34,
            padding: 18,
            borderRadius: 18,
            background: "rgba(15, 23, 42, 0.85)",
            border: "1px solid rgba(148, 163, 184, 0.14)",
          }}
        >
          <p style={{ margin: 0, color: "#94a3b8", fontSize: 12 }}>Status</p>
          <p
            style={{
              margin: "8px 0 0",
              fontWeight: 900,
              color: cvFile ? "#86efac" : "#fca5a5",
            }}
          >
            {cvFile ? "CV geladen" : "CV fehlt"}
          </p>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          marginLeft: 240,
          padding: "34px 42px 70px",
          color: "#f8fafc",
        }}
      >
        <div style={{ width: "100%", maxWidth: "none", margin: 0 }}>
          <section
            style={{
              display: "grid",
              gridTemplateColumns: "1.45fr 0.85fr",
              gap: 24,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                padding: "44px 48px",
                borderRadius: 30,
                background:
                  "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.68))",
                border: "1px solid rgba(148, 163, 184, 0.18)",
                boxShadow: "0 24px 70px rgba(0,0,0,0.32)",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "rgba(37, 99, 235, 0.16)",
                  border: "1px solid rgba(96, 165, 250, 0.25)",
                  color: "#bfdbfe",
                  fontSize: 13,
                  fontWeight: 900,
                  marginBottom: 18,
                }}
              >
                ✨ AI powered job matching
              </div>

              <h1
                style={{
                  fontSize: 64,
                  lineHeight: 1,
                  margin: 0,
                  letterSpacing: -2.5,
                }}
              >
                Dashboard
              </h1>

              <p
                style={{
                  margin: "16px 0 0",
                  color: "#cbd5e1",
                  fontSize: 18,
                  maxWidth: 720,
                }}
              >
                Lade deinen CV hoch, finde passende Jobs auf jobs.ch und sortiere
                die besten Chancen automatisch nach Match.
              </p>

              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginTop: 30,
                  flexWrap: "wrap",
                }}
              >
                <button
                  onClick={searchJobs}
                  disabled={searchLoading}
                  style={{
                    background: searchLoading
                      ? "#64748b"
                      : "linear-gradient(135deg, #15803d, #166534)",
                    color: "white",
                    border: "none",
                    padding: "16px 24px",
                    borderRadius: 16,
                    cursor: searchLoading ? "not-allowed" : "pointer",
                    fontWeight: 950,
                    fontSize: 15,
                    boxShadow: searchLoading
                      ? "none"
                      : "0 18px 35px rgba(34,197,94,0.25)",
                  }}
                >
                  {searchLoading
                    ? "Jobs werden gesucht..."
                    : "Passende Jobs suchen"}
                </button>

                {jobs.length > 0 && (
                  <button
                    onClick={() => setOnlyTop(!onlyTop)}
                    style={{
                      background: onlyTop
                        ? "linear-gradient(135deg, #f59e0b, #d97706)"
                        : "rgba(51, 65, 85, 0.9)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "16px 22px",
                      borderRadius: 16,
                      cursor: "pointer",
                      fontWeight: 950,
                      fontSize: 15,
                    }}
                  >
                    {onlyTop ? "Alle Jobs anzeigen" : "Nur Top Jobs"}
                  </button>
                )}
              </div>
            </div>

            <div
              style={{
                padding: 26,
                borderRadius: 30,
                background: "rgba(15, 23, 42, 0.82)",
                border: "1px solid rgba(148, 163, 184, 0.18)",
                boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: 18,
              }}
            >
              <div>
                <p style={{ margin: 0, color: "#94a3b8", fontWeight: 800 }}>
                  CV Upload
                </p>
                <h2 style={{ margin: "8px 0 18px", fontSize: 28 }}>
                  Dein Profil
                </h2>

                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setCvFile(file);
                  }}
                  style={{
                    width: "100%",
                    color: "#e2e8f0",
                    marginBottom: 14,
                  }}
                />

                <div
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    background: cvFile
                      ? "rgba(34, 197, 94, 0.13)"
                      : "rgba(239, 68, 68, 0.13)",
                    border: cvFile
                      ? "1px solid rgba(34, 197, 94, 0.24)"
                      : "1px solid rgba(239, 68, 68, 0.24)",
                    fontWeight: 950,
                    color: cvFile ? "#86efac" : "#fca5a5",
                    fontSize: 18,
                  }}
                >
                  {cvFile ? "Geladen ✅" : "Nicht geladen ❌"}
                </div>
              </div>

              <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                Die Suche basiert auf deinem CV und priorisiert Jobs nach
                Relevanz, nicht nur nach Keywords.
              </p>
            </div>
          </section>

          {jobs.length > 0 && (
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {[
                ["Gefunden", stats.foundLinks ?? "-", "🔍"],
                ["Analysiert", stats.scanned ?? "-", "🧠"],
                ["Angezeigt", stats.shown ?? "-", "🎯"],
                ["Top Score", `${bestScore}%`, "🚀"],
                ["Ø Match", `${averageScore}%`, "📈"],
              ].map(([label, value, icon]) => (
                <div
                  key={label}
                  style={{
                    padding: 18,
                    borderRadius: 22,
                    background: "rgba(30, 41, 59, 0.72)",
                    border: "1px solid rgba(148, 163, 184, 0.16)",
                    boxShadow: "0 18px 45px rgba(0,0,0,0.22)",
                  }}
                >
                  <div style={{ fontSize: 22 }}>{icon}</div>
                  <p
                    style={{
                      margin: "10px 0 4px",
                      color: "#94a3b8",
                      fontSize: 13,
                      fontWeight: 800,
                    }}
                  >
                    {label}
                  </p>
                  <p
                    style={{
                      margin: 0,
                      fontSize: 28,
                      fontWeight: 950,
                      color: "#f8fafc",
                    }}
                  >
                    {value}
                  </p>
                </div>
              ))}
            </section>
          )}
{searchLoading && (
  <section
    style={{
      marginTop: 24,
      display: "grid",
      gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
      gap: 22,
    }}
  >
    {[1, 2, 3, 4, 5, 6].map((item) => (
      <div
        key={item}
        style={{
          minHeight: 220,
          borderRadius: 28,
          background:
            "linear-gradient(135deg, rgba(30,41,59,0.88), rgba(15,23,42,0.82))",
          border: "1px solid rgba(148,163,184,0.18)",
          boxShadow: "0 22px 55px rgba(0,0,0,0.22)",
          padding: 26,
        }}
      >
        <div
          style={{
            width: "65%",
            height: 18,
            borderRadius: 999,
            background: "rgba(148,163,184,0.22)",
            marginBottom: 18,
          }}
        />
        <div
          style={{
            width: "42%",
            height: 14,
            borderRadius: 999,
            background: "rgba(148,163,184,0.16)",
            marginBottom: 32,
          }}
        />
        <div
          style={{
            width: "100%",
            height: 12,
            borderRadius: 999,
            background: "rgba(148,163,184,0.14)",
            marginBottom: 12,
          }}
        />
        <div
          style={{
            width: "82%",
            height: 12,
            borderRadius: 999,
            background: "rgba(148,163,184,0.14)",
            marginBottom: 32,
          }}
        />
        <div
          style={{
            width: 120,
            height: 38,
            borderRadius: 14,
            background: "rgba(34,197,94,0.22)",
          }}
        />
      </div>
    ))}
  </section>
)}
          {!searchLoading && jobs.length === 0 && (
            <div
              style={{
                marginTop: 24,
                padding: 34,
                textAlign: "center",
                borderRadius: 26,
                background: "rgba(30, 41, 59, 0.55)",
                border: "1px solid rgba(148, 163, 184, 0.16)",
                color: "#cbd5e1",
                fontSize: 18,
              }}
            >
              Noch keine Jobs geladen. Klicke auf “Passende Jobs suchen”.
            </div>
          )}

          {jobs.length > 0 && (
            <section
              style={{
                padding: 22,
                borderRadius: 26,
                background: "rgba(15, 23, 42, 0.72)",
                border: "1px solid rgba(148, 163, 184, 0.16)",
                marginBottom: 24,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: 18,
                flexWrap: "wrap",
              }}
            >
              <div>
                <strong style={{ fontSize: 18 }}>AI Profil</strong>
                <p style={{ margin: "8px 0 0", color: "#cbd5e1" }}>
                  Jobs wurden basierend auf deinem CV gefiltert und priorisiert.
                </p>
                {onlyTop && (
                  <p style={{ margin: "8px 0 0", color: "#fbbf24" }}>
                    Du siehst aktuell nur Top Jobs ab 80% Match.
                  </p>
                )}
              </div>
            </section>
          )}

          <div style={{ display: "grid", gap: 22 }}>
            {displayedJobs.map((job, index) => {
              const score = job.score || 0;
              const isBest = index < 3;

              return (
                <div
                  key={job.id}
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    background:
                      "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
                    color: "#0f172a",
                    padding: 32,
                    borderRadius: 28,
                    border: isBest
                      ? "2px solid rgba(34,197,94,0.55)"
                      : "1px solid rgba(226,232,240,0.8)",
                    boxShadow: isBest
                      ? "0 28px 70px rgba(34,197,94,0.18)"
                      : "0 22px 55px rgba(0,0,0,0.22)",
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

                      {job.snippet && (
                        <p
                          style={{
                            marginTop: 22,
                            color: "#334155",
                            lineHeight: 1.7,
                            fontSize: 15,
                            maxWidth: 1050,
                          }}
                        >
                          {job.snippet}
                        </p>
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
                            }}
                          >
                            Stelle öffnen
                          </a>
                        )}

                        <button
                          onClick={() => analyzeJob(job)}
                          style={{
                            background:
                              "linear-gradient(135deg, #2563eb, #1d4ed8)",
                            color: "white",
                            border: "none",
                            padding: "12px 16px",
                            borderRadius: 14,
                            cursor: "pointer",
                            fontWeight: 900,
                          }}
                        >
                          AI Analyse
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
                        boxShadow: `0 20px 45px ${scoreColor(score)}55`,
                      }}
                    >
                      <span style={{ fontSize: 32 }}>{score}%</span>
                      <span style={{ fontSize: 11, letterSpacing: 0.8 }}>
                        MATCH
                      </span>
                    </div>
                  </div>

                  {analysis[job.id] && (
                    <div
                      style={{
                        marginTop: 26,
                        padding: 24,
                        background:
                          "linear-gradient(135deg, #eef2ff, #e2e8f0)",
                        border: "1px solid rgba(148,163,184,0.3)",
                        borderRadius: 22,
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
                      {renderAnalysis(analysis[job.id])}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
