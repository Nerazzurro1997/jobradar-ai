import { useEffect, useState } from "react";
import type { CvProfile, Job } from "./types";
import { getSavedJobs, saveJobs, clearJobs } from "./utils/storage";
import { sortJobsByScore } from "./utils/jobs";
import { JobCard } from "./components/JobCard";
import { Sidebar } from "./components/Sidebar";
import { useJobs } from "./hooks/useJobs";

const CV_PROFILE_KEY = "jobradar_cv_profile";

export default function App() {
  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvProfile, setCvProfile] = useState<CvProfile | null>(null);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [onlyTop, setOnlyTop] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [showSavedJobs, setShowSavedJobs] = useState(false);

  const {
    jobs,
    analysis,
    stats,
    searchLoading,
    profileLoading,
    searchJobs: searchJobsFromHook,
    analyzeJob: analyzeJobFromHook,
    analyzeCv: analyzeCvFromHook,
  } = useJobs();

  useEffect(() => {
    setSavedJobs(sortJobsByScore(getSavedJobs()));

    const storedProfile = localStorage.getItem(CV_PROFILE_KEY);

    if (storedProfile) {
      try {
        setCvProfile(JSON.parse(storedProfile));
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

  function clearSavedJobs() {
    const confirmDelete = confirm(
      "Willst du wirklich alles löschen? Gespeicherte Jobs und CV Profil werden entfernt."
    );

    if (!confirmDelete) return;

    clearJobs();
    localStorage.removeItem(CV_PROFILE_KEY);

    setSavedJobs([]);
    setCvProfile(null);
    setCvFile(null);
    setOnlyTop(false);
    setShowSavedJobs(true);
  }

  function clearCvProfile() {
    localStorage.removeItem(CV_PROFILE_KEY);
    setCvProfile(null);
  }

  async function handleAnalyzeCv(fileOverride?: File): Promise<CvProfile> {
    const file = fileOverride || cvFile;

    if (!file) {
      throw new Error("Carica prima il CV PDF");
    }

    const profile = await analyzeCvFromHook(file);

    setCvProfile(profile);
    localStorage.setItem(CV_PROFILE_KEY, JSON.stringify(profile));

    return profile;
  }

  async function handleSearchJobs() {
    if (!cvFile) {
      alert("Carica prima il CV PDF");
      return;
    }

    setOnlyTop(false);
    setShowSavedJobs(false);

    try {
      let profileToUse = cvProfile;

      if (!profileToUse) {
        profileToUse = await handleAnalyzeCv(cvFile);
      }

      const incomingJobs = await searchJobsFromHook(
        cvFile,
        profileToUse,
        savedJobs
      );

      const refreshedSavedJobs = sortJobsByScore(getSavedJobs());
      setSavedJobs(refreshedSavedJobs);

      if (incomingJobs.length > 0) {
        setShowSavedJobs(false);
        return;
      }

      if (refreshedSavedJobs.length > 0) {
        saveJobs(refreshedSavedJobs);
        setShowSavedJobs(true);
        return;
      }

      alert("Keine neuen Jobs gefunden.");
    } catch (error) {
      alert("Fehler bei der Jobsuche: " + String(error));
    }
  }

  async function handleAnalyzeJob(job: Job) {
    if (!cvFile) {
      alert("Carica prima il CV PDF");
      return;
    }

    await analyzeJobFromHook(job, cvFile, cvProfile);
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

      <Sidebar
        cvFile={cvFile}
        cvProfile={cvProfile}
        profileLoading={profileLoading}
        savedJobsCount={savedJobs.length}
        showSavedJobs={showSavedJobs}
        onToggleSavedJobs={() => setShowSavedJobs(!showSavedJobs)}
      />

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
                  onClick={handleSearchJobs}
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
                      handleAnalyzeCv().catch((error) =>
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
                onAnalyze={handleAnalyzeJob}
              />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}