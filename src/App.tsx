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
      return <p style={{ fontWeight: "bold" }}>⏳ Analisi in corso...</p>;
    }

    return (
      <div style={{ lineHeight: 1.6 }}>
        {text.split("\n").map((line, i) => {
          const cleanLine = line.trim();
          if (!cleanLine) return null;

          if (cleanLine.toLowerCase().includes("match score")) {
            return (
              <h2 key={i} style={{ color: "#16a34a", marginTop: 10 }}>
                {cleanLine}
              </h2>
            );
          }

          if (cleanLine.toLowerCase().includes("warum")) {
            return (
              <h3 key={i} style={{ color: "#2563eb", marginTop: 22 }}>
                💡 {cleanLine}
              </h3>
            );
          }

          if (cleanLine.toLowerCase().includes("risiken")) {
            return (
              <h3 key={i} style={{ color: "#dc2626", marginTop: 22 }}>
                ⚠️ {cleanLine}
              </h3>
            );
          }

          if (cleanLine.toLowerCase().includes("empfehlung")) {
            return (
              <h3 key={i} style={{ color: "#7c3aed", marginTop: 22 }}>
                🎯 {cleanLine}
              </h3>
            );
          }

          if (cleanLine.startsWith("-")) {
            return (
              <p key={i} style={{ marginLeft: 18, marginBottom: 8 }}>
                • {cleanLine.replace("-", "").trim()}
              </p>
            );
          }

          return (
            <p key={i} style={{ marginBottom: 10 }}>
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
        background: "#0f172a",
        fontFamily: "Arial, sans-serif",
      }}
    >
      <aside
        style={{
          width: 230,
          background: "#020617",
          color: "white",
          padding: 26,
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
        }}
      >
        <h2 style={{ marginBottom: 6 }}>JobRadar AI</h2>
        <p style={{ fontSize: 13, color: "#cbd5e1" }}>
          Dein persönlicher Job Scout
        </p>

        <button
          style={{
            width: "100%",
            marginTop: 28,
            padding: 12,
            background: "#2563eb",
            color: "white",
            border: "none",
            borderRadius: 10,
            fontWeight: "bold",
          }}
        >
          Dashboard
        </button>

        <button
          style={{
            width: "100%",
            marginTop: 12,
            padding: 12,
            background: "#1e293b",
            color: "white",
            border: "none",
            borderRadius: 10,
            fontWeight: "bold",
          }}
        >
          Mein CV
        </button>
      </aside>

      <main
        style={{
          flex: 1,
          marginLeft: 230,
          padding: "40px 32px",
          color: "#f8fafc",
        }}
      >
        <div style={{ maxWidth: 980, margin: "0 auto" }}>
          <h1 style={{ fontSize: 52, marginBottom: 8, textAlign: "center" }}>
            Dashboard
          </h1>

          <div style={{ textAlign: "center", marginBottom: 28 }}>
            <input
              type="file"
              accept="application/pdf"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setCvFile(file);
              }}
            />

            <p style={{ marginTop: 8 }}>
              CV Status:{" "}
              <strong>{cvFile ? "Geladen ✅" : "Nicht geladen ❌"}</strong>
            </p>

            <button
              onClick={searchJobs}
              disabled={searchLoading}
              style={{
                marginTop: 18,
                background: searchLoading ? "#64748b" : "#16a34a",
                color: "white",
                border: "none",
                padding: "14px 22px",
                borderRadius: 12,
                cursor: searchLoading ? "not-allowed" : "pointer",
                fontWeight: "bold",
                fontSize: 15,
              }}
            >
              {searchLoading ? "Jobs werden gesucht..." : "Passende Jobs suchen"}
            </button>

            {jobs.length > 0 && (
              <button
                onClick={() => setOnlyTop(!onlyTop)}
                style={{
                  marginTop: 12,
                  marginLeft: 10,
                  background: onlyTop ? "#f59e0b" : "#334155",
                  color: "white",
                  border: "none",
                  padding: "12px 18px",
                  borderRadius: 12,
                  cursor: "pointer",
                  fontWeight: "bold",
                  fontSize: 14,
                }}
              >
                {onlyTop ? "Alle Jobs anzeigen" : "Nur Top Jobs"}
              </button>
            )}
          </div>

          {!searchLoading && jobs.length === 0 && (
            <p style={{ textAlign: "center", color: "#cbd5e1" }}>
              Noch keine Jobs geladen. Klicke auf “Passende Jobs suchen”.
            </p>
          )}

          {jobs.length > 0 && (
            <div
              style={{
                background: "#1e293b",
                padding: 20,
                borderRadius: 14,
                marginBottom: 24,
                textAlign: "center",
              }}
            >
              <strong>AI Profil:</strong>

              <p style={{ marginTop: 8 }}>
                Jobs wurden basierend auf deinem CV gefiltert und priorisiert.
              </p>

              {onlyTop && (
                <p style={{ marginTop: 8, color: "#fbbf24" }}>
                  Du siehst aktuell nur Top Jobs ab 80% Match.
                </p>
              )}

              {stats.foundLinks !== undefined && (
                <div
                  style={{
                    marginTop: 12,
                    fontSize: 13,
                    color: "#94a3b8",
                  }}
                >
                  🔍 Gefunden: {stats.foundLinks} Links · 🧠 Analysiert:{" "}
                  {stats.scanned} Jobs · 🎯 Angezeigt: {stats.shown}
                </div>
              )}
            </div>
          )}

          {displayedJobs.map((job) => (
            <div
              key={job.id}
              style={{
                background: "#f8fafc",
                color: "#0f172a",
                padding: 28,
                borderRadius: 22,
                marginBottom: 24,
                boxShadow: "0 20px 40px rgba(0,0,0,0.25)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 20,
                  alignItems: "flex-start",
                }}
              >
                <div>
                  <h2 style={{ margin: 0, fontSize: 26 }}>{job.title}</h2>

                  <p
                    style={{
                      marginTop: 10,
                      fontSize: 16,
                      color: "#475569",
                      fontWeight: "bold",
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
                        padding: "6px 10px",
                        borderRadius: 999,
                        fontSize: 13,
                        fontWeight: "bold",
                      }}
                    >
                      Gefunden mit: {job.keyword}
                    </span>
                  )}
                </div>

                {job.score !== undefined && (
                  <div
                    style={{
                      minWidth: 88,
                      height: 88,
                      borderRadius: "50%",
                      background:
                        job.score >= 80
                          ? "#16a34a"
                          : job.score >= 65
                          ? "#f59e0b"
                          : "#ef4444",
                      color: "white",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "column",
                      fontWeight: "bold",
                    }}
                  >
                    <span style={{ fontSize: 24 }}>{job.score}%</span>
                    <span style={{ fontSize: 11 }}>Match</span>
                  </div>
                )}
              </div>

              {job.snippet && (
                <p
                  style={{
                    marginTop: 18,
                    color: "#334155",
                    lineHeight: 1.6,
                    fontSize: 15,
                  }}
                >
                  {job.snippet}
                </p>
              )}

              <div
                style={{
                  display: "flex",
                  gap: 12,
                  marginTop: 22,
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
                      padding: "11px 15px",
                      borderRadius: 10,
                      fontWeight: "bold",
                    }}
                  >
                    Stelle öffnen
                  </a>
                )}

                <button
                  onClick={() => analyzeJob(job)}
                  style={{
                    background: "#2563eb",
                    color: "white",
                    border: "none",
                    padding: "11px 15px",
                    borderRadius: 10,
                    cursor: "pointer",
                    fontWeight: "bold",
                  }}
                >
                  AI Analyse
                </button>
              </div>

              {analysis[job.id] && (
                <div
                  style={{
                    marginTop: 22,
                    padding: 20,
                    background: "#e2e8f0",
                    borderRadius: 14,
                  }}
                >
                  <strong>AI Analyse:</strong>
                  {renderAnalysis(analysis[job.id])}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
