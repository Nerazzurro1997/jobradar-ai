import { useEffect, useState } from "react";

type Job = {
  id: number;
  title: string;
  company: string;
  location: string;
  url?: string;
  snippet?: string;
  fullDescription?: string;
  highlights?: string[];
  riskFlags?: string[];
  previewSummary?: string;
  publishedDate?: string;
  keyword?: string;
  score?: number;
};

type CvProfile = {
  searchTerms: string[];
  strongKeywords: string[];
  avoidKeywords: string[];
  locations: string[];
  profileSummary: string;
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

const SUPABASE_ANALYZE_CV_URL =
  "https://splummvxjbyubbtiiebl.supabase.co/functions/v1/analyze-cv";

const SUPABASE_ANON_KEY = "sb_publishable_Kc7qxUo7qpHaRz3w-wOCWg_rVqIeixX";

const STORAGE_KEY = "jobradar_saved_jobs";
const CV_PROFILE_KEY = "jobradar_cv_profile";

export default function App() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvProfile, setCvProfile] = useState<CvProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [analysis, setAnalysis] = useState<{ [key: number]: string }>({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [onlyTop, setOnlyTop] = useState(false);
  const [stats, setStats] = useState<SearchStats>({});
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [showSavedJobs, setShowSavedJobs] = useState(false);

  useEffect(() => {
    const storedJobs = localStorage.getItem(STORAGE_KEY);

    if (storedJobs) {
      try {
        const parsedJobs = JSON.parse(storedJobs);
        if (Array.isArray(parsedJobs)) {
          setSavedJobs(sortJobsByScore(parsedJobs));
        }
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }

    const storedProfile = localStorage.getItem(CV_PROFILE_KEY);

    if (storedProfile) {
      try {
        const parsedProfile = JSON.parse(storedProfile);
        setCvProfile(parsedProfile);
      } catch {
        localStorage.removeItem(CV_PROFILE_KEY);
      }
    }
  }, []);

  const activeJobs = showSavedJobs ? savedJobs : jobs;

  const displayedJobs = activeJobs.filter(
    (job) => !onlyTop || (job.score || 0) >= 80
  );

  const bestScore = activeJobs.length
    ? Math.max(...activeJobs.map((job) => job.score || 0))
    : 0;

  const averageScore = activeJobs.length
    ? Math.round(
        activeJobs.reduce((sum, job) => sum + (job.score || 0), 0) /
          activeJobs.length
      )
    : 0;

  function sortJobsByScore(jobsToSort: Job[]) {
    return [...jobsToSort].sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  function saveJobsToStorage(newJobs: Job[]) {
    if (!newJobs.length) return;

    setSavedJobs((prev) => {
      const normalizedNewJobs = newJobs
        .filter((job) => job.url)
        .map((job) => ({
          ...job,
          id: job.id || Math.floor(Math.random() * 1_000_000_000),
        }));

      const merged = [...normalizedNewJobs, ...prev];

      const unique = merged.filter((job, index, self) => {
        if (!job.url) return false;
        return index === self.findIndex((item) => item.url === job.url);
      });

      const sorted = sortJobsByScore(unique);

      localStorage.setItem(STORAGE_KEY, JSON.stringify(sorted));
      return sorted;
    });
  }

  function clearSavedJobs() {
    const confirmDelete = confirm(
      "Willst du wirklich alle gespeicherten Jobs löschen?"
    );

    if (!confirmDelete) return;

    localStorage.removeItem(STORAGE_KEY);
    setSavedJobs([]);
    setShowSavedJobs(false);
  }

  function clearCvProfile() {
    localStorage.removeItem(CV_PROFILE_KEY);
    setCvProfile(null);
  }

  function scoreColor(score = 0) {
    if (score >= 85) return "#15803d";
    if (score >= 75) return "#65a30d";
    if (score >= 65) return "#d97706";
    return "#dc2626";
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

  async function analyzeCv(fileOverride?: File): Promise<CvProfile> {
    const file = fileOverride || cvFile;

    if (!file) {
      throw new Error("Carica prima il CV PDF");
    }

    setProfileLoading(true);

    try {
      const base64 = await toBase64(file);

      const response = await fetch(SUPABASE_ANALYZE_CV_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          fileName: file.name,
          fileBase64: base64,
        }),
      });

      const rawText = await response.text();

      let data;
      try {
        data = JSON.parse(rawText);
      } catch {
        throw new Error(rawText.slice(0, 300));
      }

      if (!data.success || !data.profile) {
        throw new Error(data.error || "CV Profil konnte nicht erstellt werden.");
      }

      setCvProfile(data.profile);
      localStorage.setItem(CV_PROFILE_KEY, JSON.stringify(data.profile));

      console.log("CV Profile erstellt:", data.profile);

      return data.profile;
    } finally {
      setProfileLoading(false);
    }
  }

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
    setShowSavedJobs(false);

    try {
      const base64 = await toBase64(cvFile);

      let profileToUse = cvProfile;

      if (!profileToUse) {
        profileToUse = await analyzeCv(cvFile);
      }

      const knownUrls = savedJobs
        .map((job) => job.url)
        .filter((url): url is string => Boolean(url));

      const response = await fetch(SUPABASE_SEARCH_JOBS_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          profile: profileToUse,
          fileName: cvFile.name,
          fileBase64: base64,
          location: "Zürich",
          knownUrls,
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

      const incomingJobs: Job[] = data.jobs || [];

      if (data.noNewJobs || incomingJobs.length === 0) {
        setJobs([]);

        if (savedJobs.length > 0) {
          const sortedSavedJobs = sortJobsByScore(savedJobs);
          setSavedJobs(sortedSavedJobs);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(sortedSavedJobs));
          setShowSavedJobs(true);
        } else {
          alert("Keine neuen Jobs gefunden.");
        }
      } else {
        const sortedIncomingJobs = sortJobsByScore(incomingJobs);

        setShowSavedJobs(false);
        setJobs(sortedIncomingJobs);
        saveJobsToStorage(sortedIncomingJobs);
      }

      setStats({
        foundLinks: data.foundLinks,
        scanned: data.scanned,
        shown: data.count,
      });

      console.log("AI Profile:", data.profile || profileToUse);
      console.log("Known URLs sent:", knownUrls.length);
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
          profile: cvProfile,
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
          "radial-gradient(circle at top left, #1e3a8a 0, transparent 30%), radial-gradient(circle at top right, #064e3b 0, transparent 28%), #020617",
        fontFamily:
          "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial",
      }}
    >
      <style>
        {`
          .premium-btn, .premium-link, .upload-label {
            transition: transform 0.18s ease, box-shadow 0.18s ease, opacity 0.18s ease;
          }

          .premium-btn:hover, .premium-link:hover, .upload-label:hover {
            transform: translateY(-2px);
            opacity: 0.96;
          }

          .premium-btn:active, .premium-link:active, .upload-label:active {
            transform: translateY(0);
          }

          @keyframes softPulse {
            0% { opacity: 0.45; transform: scale(1); }
            50% { opacity: 0.95; transform: scale(1.015); }
            100% { opacity: 0.45; transform: scale(1); }
          }

          @keyframes slideIn {
            from { opacity: 0; transform: translateY(14px); }
            to { opacity: 1; transform: translateY(0); }
          }

          .skeleton-card {
            animation: softPulse 1.6s ease-in-out infinite;
          }

          .job-card {
            animation: slideIn 0.35s ease both;
          }
        `}
      </style>

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
          boxSizing: "border-box",
          overflowY: "auto",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <div
              style={{
                width: 44,
                height: 44,
                minWidth: 44,
                borderRadius: 14,
                background: "linear-gradient(135deg, #2563eb, #15803d)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 900,
                boxShadow: "0 18px 35px rgba(37,99,235,0.22)",
              }}
            >
              JR
            </div>

            <div style={{ minWidth: 0 }}>
              <h2 style={{ margin: 0, fontSize: 22, lineHeight: 1.08 }}>
                JobRadar AI
              </h2>
              <p
                style={{
                  margin: "5px 0 0",
                  fontSize: 12,
                  lineHeight: 1.35,
                  color: "#94a3b8",
                }}
              >
                Dein persönlicher Job Scout
              </p>
            </div>
          </div>

          <div
            style={{
              paddingTop: 14,
              borderTop: "1px solid rgba(148, 163, 184, 0.14)",
            }}
          >
            <p
              style={{
                margin: 0,
                fontSize: 9,
                color: "#64748b",
                letterSpacing: 1.2,
                textTransform: "uppercase",
                fontWeight: 800,
              }}
            >
              Created by
            </p>

            <p
              style={{
                margin: "5px 0 0",
                fontSize: 15,
                lineHeight: 1.1,
                color: "#e2e8f0",
                fontWeight: 900,
                fontFamily: "Georgia, serif",
                fontStyle: "italic",
                letterSpacing: 0.2,
              }}
            >
              Francesco Molea
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gap: 12, marginTop: 34 }}>
          <button
            className="premium-btn"
            style={{
              padding: "13px 14px",
              background: "linear-gradient(135deg, #15803d, #166534)",
              color: "white",
              border: "none",
              borderRadius: 14,
              fontWeight: 900,
              textAlign: "left",
              boxShadow: "0 12px 25px rgba(21,128,61,0.18)",
            }}
          >
            📊 Dashboard
          </button>

          <button
            className="premium-btn"
            onClick={() => setShowSavedJobs(!showSavedJobs)}
            style={{
              padding: "13px 14px",
              background: showSavedJobs
                ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
                : "rgba(30, 41, 59, 0.8)",
              color: "#e2e8f0",
              border: "1px solid rgba(148, 163, 184, 0.14)",
              borderRadius: 14,
              fontWeight: 900,
              textAlign: "left",
              cursor: "pointer",
            }}
          >
            💾 Gespeichert ({savedJobs.length})
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
              color: cvFile ? "#bbf7d0" : "#fca5a5",
            }}
          >
            {cvFile ? "CV geladen" : "CV fehlt"}
          </p>

          <p
            style={{
              margin: "8px 0 0",
              fontWeight: 900,
              color: cvProfile ? "#bfdbfe" : "#94a3b8",
              fontSize: 13,
            }}
          >
            {profileLoading
              ? "Profil wird analysiert..."
              : cvProfile
              ? "Profil analysiert"
              : "Profil noch nicht analysiert"}
          </p>

          {savedJobs.length > 0 && (
            <p
              style={{
                margin: "8px 0 0",
                color: "#94a3b8",
                fontSize: 12,
              }}
            >
              {savedJobs.length} Jobs im Speicher
            </p>
          )}
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
                {showSavedJobs ? "Gespeicherte Jobs" : "Dashboard"}
              </h1>

              <p
                style={{
                  margin: "16px 0 0",
                  color: "#cbd5e1",
                  fontSize: 18,
                  maxWidth: 720,
                }}
              >
                {showSavedJobs
                  ? "Hier siehst du alle Jobs, die bereits in deinem Browser gespeichert wurden."
                  : "Lade deinen CV hoch, finde passende Jobs auf jobs.ch und sortiere die besten Chancen automatisch nach Match."}
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
                  className="premium-btn"
                  onClick={searchJobs}
                  disabled={searchLoading || profileLoading}
                  style={{
                    background:
                      searchLoading || profileLoading
                        ? "#64748b"
                        : "linear-gradient(135deg, #15803d, #166534)",
                    color: "white",
                    border: "none",
                    padding: "16px 24px",
                    borderRadius: 16,
                    cursor:
                      searchLoading || profileLoading ? "not-allowed" : "pointer",
                    fontWeight: 950,
                    fontSize: 15,
                    boxShadow:
                      searchLoading || profileLoading
                        ? "none"
                        : "0 12px 25px rgba(21,128,61,0.25)",
                  }}
                >
                  {profileLoading
                    ? "CV wird analysiert..."
                    : searchLoading
                    ? "Jobs werden gesucht..."
                    : "Neue Jobs suchen"}
                </button>

                {cvFile && !cvProfile && (
                  <button
                    className="premium-btn"
                    onClick={() =>
                      analyzeCv().catch((error) =>
                        alert("Errore CV Analysis: " + String(error))
                      )
                    }
                    disabled={profileLoading}
                    style={{
                      background: "rgba(37, 99, 235, 0.9)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "16px 22px",
                      borderRadius: 16,
                      cursor: profileLoading ? "not-allowed" : "pointer",
                      fontWeight: 950,
                      fontSize: 15,
                    }}
                  >
                    Profil analysieren
                  </button>
                )}

                {cvProfile && (
                  <button
                    className="premium-btn"
                    onClick={clearCvProfile}
                    style={{
                      background: "rgba(51, 65, 85, 0.9)",
                      color: "white",
                      border: "1px solid rgba(255,255,255,0.1)",
                      padding: "16px 22px",
                      borderRadius: 16,
                      cursor: "pointer",
                      fontWeight: 950,
                      fontSize: 15,
                    }}
                  >
                    Profil neu analysieren
                  </button>
                )}

                {savedJobs.length > 0 && (
                  <button
                    className="premium-btn"
                    onClick={() => setShowSavedJobs(!showSavedJobs)}
                    style={{
                      background: showSavedJobs
                        ? "linear-gradient(135deg, #2563eb, #1d4ed8)"
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
                    {showSavedJobs
                      ? "Live Jobs anzeigen"
                      : `Gespeicherte Jobs (${savedJobs.length})`}
                  </button>
                )}

                {activeJobs.length > 0 && (
                  <button
                    className="premium-btn"
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

                {savedJobs.length > 0 && (
                  <button
                    className="premium-btn"
                    onClick={clearSavedJobs}
                    style={{
                      background: "rgba(127, 29, 29, 0.85)",
                      color: "white",
                      border: "1px solid rgba(248,113,113,0.25)",
                      padding: "16px 22px",
                      borderRadius: 16,
                      cursor: "pointer",
                      fontWeight: 950,
                      fontSize: 15,
                    }}
                  >
                    Cache löschen
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

                <label
                  className="upload-label"
                  style={{
                    display: "inline-block",
                    padding: "12px 16px",
                    borderRadius: 12,
                    background: "rgba(30,41,59,0.8)",
                    border: "1px solid rgba(148,163,184,0.2)",
                    cursor: "pointer",
                    fontWeight: 800,
                    marginBottom: 14,
                  }}
                >
                  📄 CV hochladen
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => {
                      const file = e.target.files?.[0];

                      if (file) {
                        setCvFile(file);
                        setCvProfile(null);
                        localStorage.removeItem(CV_PROFILE_KEY);
                      }
                    }}
                    style={{ display: "none" }}
                  />
                </label>

                {cvFile && (
                  <p
                    style={{
                      margin: "0 0 12px",
                      color: "#94a3b8",
                      fontSize: 12,
                      wordBreak: "break-word",
                    }}
                  >
                    {cvFile.name}
                  </p>
                )}

                <div
                  style={{
                    padding: 16,
                    borderRadius: 18,
                    background: cvFile
                      ? "rgba(21, 128, 61, 0.15)"
                      : "rgba(239, 68, 68, 0.13)",
                    border: cvFile
                      ? "1px solid rgba(21, 128, 61, 0.35)"
                      : "1px solid rgba(239, 68, 68, 0.24)",
                    fontWeight: 950,
                    color: cvFile ? "#bbf7d0" : "#fca5a5",
                    fontSize: 18,
                  }}
                >
                  {cvFile ? "Geladen ✅" : "Nicht geladen ❌"}
                </div>

                {cvProfile && (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 14,
                      borderRadius: 16,
                      background: "rgba(37, 99, 235, 0.12)",
                      border: "1px solid rgba(37, 99, 235, 0.2)",
                      color: "#bfdbfe",
                      fontSize: 13,
                      lineHeight: 1.5,
                    }}
                  >
                    <strong>Profil bereit</strong>
                    <p style={{ margin: "6px 0 0" }}>
                      {cvProfile.profileSummary || "CV Profil wurde analysiert."}
                    </p>
                  </div>
                )}
              </div>

              <p style={{ margin: 0, color: "#94a3b8", fontSize: 13 }}>
                Die Suche nutzt dein gespeichertes CV Profil und muss den CV
                nicht bei jeder Suche neu analysieren.
              </p>
            </div>
          </section>

          {activeJobs.length > 0 && (
            <section
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
                gap: 16,
                marginBottom: 24,
              }}
            >
              {[
                [
                  showSavedJobs ? "Gespeichert" : "Gefunden",
                  showSavedJobs ? savedJobs.length : stats.foundLinks ?? "-",
                  "🔍",
                ],
                [
                  showSavedJobs ? "Aktiv" : "Analysiert",
                  showSavedJobs ? displayedJobs.length : stats.scanned ?? "-",
                  "🧠",
                ],
                [
                  showSavedJobs ? "Total" : "Angezeigt",
                  showSavedJobs ? savedJobs.length : stats.shown ?? "-",
                  "🎯",
                ],
                ["Top Score", `${bestScore}%`, "🚀"],
                ["Ø Match", `${averageScore}%`, "📈"],
              ].map(([label, value, icon]) => (
                <div
                  key={String(label)}
                  className="premium-btn"
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
                  className="skeleton-card"
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
                />
              ))}
            </section>
          )}

          {!searchLoading && activeJobs.length === 0 && (
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
              {showSavedJobs
                ? "Noch keine gespeicherten Jobs vorhanden."
                : "Noch keine Jobs geladen. Klicke auf “Neue Jobs suchen”."}
            </div>
          )}

          {activeJobs.length > 0 && (
            <section
              style={{
                padding: 22,
                borderRadius: 26,
                background: "rgba(15, 23, 42, 0.72)",
                border: "1px solid rgba(148, 163, 184, 0.16)",
                marginBottom: 24,
              }}
            >
              <strong style={{ fontSize: 18 }}>
                {showSavedJobs ? "Gespeicherte Jobs" : "AI Profil"}
              </strong>
              <p style={{ margin: "8px 0 0", color: "#cbd5e1" }}>
                {showSavedJobs
                  ? "Diese Jobs wurden lokal im Browser gespeichert."
                  : "Jobs wurden basierend auf deinem CV Profil gefiltert und priorisiert."}
              </p>
            </section>
          )}

          <div style={{ display: "grid", gap: 22 }}>
            {displayedJobs.map((job, index) => {
              const score = job.score || 0;
              const isBest = index < 3;
              const isHovered = hoveredId === job.id;
              const isAnalyzing = analysis[job.id] === "⏳ Analisi in corso...";

              return (
                <div
                  className="job-card"
                  key={job.url || job.id}
                  onMouseEnter={() => setHoveredId(job.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  style={{
                    position: "relative",
                    overflow: "hidden",
                    background:
                      "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
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
                                {job.highlights
                                  .slice(0, 3)
                                  .map((highlight, i) => (
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
                                      <span
                                        style={{
                                          color: "#15803d",
                                          fontWeight: 950,
                                        }}
                                      >
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
                          onClick={() => analyzeJob(job)}
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
                        transition:
                          "transform 0.25s ease, box-shadow 0.25s ease",
                      }}
                    >
                      <span style={{ fontSize: 32 }}>{score}%</span>
                      <span style={{ fontSize: 11, letterSpacing: 0.8 }}>
                        MATCH
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      maxHeight: analysis[job.id] ? 900 : 0,
                      opacity: analysis[job.id] ? 1 : 0,
                      overflow: "hidden",
                      transform: analysis[job.id]
                        ? "translateY(0)"
                        : "translateY(-10px)",
                      transition:
                        "max-height 0.45s ease, opacity 0.3s ease, transform 0.3s ease",
                    }}
                  >
                    {analysis[job.id] && (
                      <div
                        style={{
                          marginTop: 26,
                          padding: 24,
                          background:
                            "linear-gradient(135deg, #eef2ff, #e2e8f0)",
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
                        {renderAnalysis(analysis[job.id])}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>
    </div>
  );
}
