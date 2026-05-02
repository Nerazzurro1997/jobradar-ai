import { useEffect, useState } from "react";
import type { CvProfile, Job, SearchStats } from "./types";
import { getSavedJobs, saveJobs, clearJobs } from "./utils/storage";
import { toBase64 } from "./utils/file";
import { JobCard } from "./components/JobCard";

import {
  SUPABASE_ANALYZE_CV_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_FUNCTION_URL,
  SUPABASE_SEARCH_JOBS_URL,
} from "./config/supabase";

const CV_PROFILE_KEY = "jobradar_cv_profile";

export default function App() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvProfile, setCvProfile] = useState<CvProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [analysis, setAnalysis] = useState<Record<number, string>>({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [onlyTop, setOnlyTop] = useState(false);
  const [stats, setStats] = useState<SearchStats>({});
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [showSavedJobs, setShowSavedJobs] = useState(false);

  useEffect(() => {
    const storedJobs = getSavedJobs();
    setSavedJobs(sortJobsByScore(storedJobs));

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
          id: job.id ?? Math.floor(Date.now() + Math.random() * 1_000_000),
        }));

      const merged = [...normalizedNewJobs, ...prev];

      const unique = merged.filter((job, index, self) => {
        if (!job.url) return false;
        return index === self.findIndex((item) => item.url === job.url);
      });

      const sorted = sortJobsByScore(unique);

      saveJobs(sorted);
      return sorted;
    });
  }

  function clearSavedJobs() {
    const confirmDelete = confirm(
      "Willst du wirklich alles löschen? Gespeicherte Jobs und CV Profil werden entfernt."
    );

    if (!confirmDelete) return;

    clearJobs();
    localStorage.removeItem(CV_PROFILE_KEY);

    setSavedJobs([]);
    setJobs([]);
    setCvProfile(null);
    setCvFile(null);
    setAnalysis({});
    setStats({});
    setOnlyTop(false);
    setShowSavedJobs(false);
  }

  function clearCvProfile() {
    localStorage.removeItem(CV_PROFILE_KEY);
    setCvProfile(null);
  }

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
          saveJobs(sortedSavedJobs);
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
                        setCvProfile(null);
                        localStorage.removeItem(CV_PROFILE_KEY);
                        setCvFile(file);
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
            {displayedJobs.map((job, index) => (
              <JobCard
                key={job.url || job.id}
                job={job}
                index={index}
                analysisText={analysis[job.id]}
                hoveredId={hoveredId}
                showSavedJobs={showSavedJobs}
                onHover={setHoveredId}
                onAnalyze={analyzeJob}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}