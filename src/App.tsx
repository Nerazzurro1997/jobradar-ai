import { useEffect, useState } from "react";
import type { CvProfile, Job } from "./types";
import { getSavedJobs, saveJobs, clearJobs } from "./utils/storage";
import { sortJobsByScore } from "./utils/jobs";
import { Sidebar } from "./components/Sidebar";
import { JobDashboard } from "./components/JobDashboard";
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

  /* ========================= */
  /* INIT */
  /* ========================= */
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

  /* ========================= */
  /* CLEAR ALL */
  /* ========================= */
  function clearSavedJobs() {
    const confirmDelete = confirm(
      "Do you really want to delete everything? Saved jobs and CV profile will be removed."
    );

    if (!confirmDelete) return;

    clearJobs();
    localStorage.removeItem(CV_PROFILE_KEY);

    setSavedJobs([]);
    setCvProfile(null);
    setCvFile(null);
    setOnlyTop(false);
    setShowSavedJobs(false);
  }

  /* ========================= */
  /* RESET CV ONLY */
  /* ========================= */
  function clearCvProfile() {
    localStorage.removeItem(CV_PROFILE_KEY);
    setCvProfile(null);
  }

  /* ========================= */
  /* ANALYZE CV */
  /* ========================= */
  async function handleAnalyzeCv(fileOverride?: File): Promise<CvProfile> {
    const file = fileOverride || cvFile;

    if (!file) {
      alert("Upload your CV first");
      throw new Error("No CV file");
    }

    try {
      const profile = await analyzeCvFromHook(file);

      setCvProfile(profile);
      localStorage.setItem(CV_PROFILE_KEY, JSON.stringify(profile));

      return profile;
    } catch (error) {
      alert("CV analysis failed");
      throw error;
    }
  }

  /* ========================= */
  /* SEARCH JOBS */
  /* ========================= */
  async function handleSearchJobs() {
    if (!cvFile) {
      alert("Upload your CV first");
      return;
    }

    setOnlyTop(false);
    setShowSavedJobs(false);

    try {
      let profileToUse = cvProfile;

      // 🔥 auto-analyze se manca
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

      alert("No new jobs found.");
    } catch (error) {
      console.error(error);
      alert("Job search failed");
    }
  }

  /* ========================= */
  /* ANALYZE SINGLE JOB */
  /* ========================= */
  async function handleAnalyzeJob(job: Job) {
    if (!cvFile) {
      alert("Upload your CV first");
      return;
    }

    try {
      await analyzeJobFromHook(job, cvFile, cvProfile);
    } catch (error) {
      console.error(error);
      alert("Job analysis failed");
    }
  }

  /* ========================= */
  /* UI */
  /* ========================= */
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
      {/* SIDEBAR */}
      <Sidebar
        cvFile={cvFile}
        cvProfile={cvProfile}
        profileLoading={profileLoading}
        savedJobsCount={savedJobs.length}
        showSavedJobs={showSavedJobs}
        onToggleSavedJobs={() => setShowSavedJobs(!showSavedJobs)}
      />

      {/* DASHBOARD */}
      <JobDashboard
        cvFile={cvFile}
        cvProfile={cvProfile}
        jobs={jobs}
        savedJobs={savedJobs}
        showSavedJobs={showSavedJobs}
        onlyTop={onlyTop}
        hoveredId={hoveredId}
        analysis={analysis}
        stats={stats}
        searchLoading={searchLoading}
        profileLoading={profileLoading}
        onSearch={handleSearchJobs}
        onAnalyzeCv={() => handleAnalyzeCv()}
        onClearCv={clearCvProfile}
        onToggleSaved={() => setShowSavedJobs(!showSavedJobs)}
        onToggleTop={() => setOnlyTop(!onlyTop)}
        onClearCache={clearSavedJobs}
        onHover={setHoveredId}
        onAnalyzeJob={handleAnalyzeJob}
        setCvFile={setCvFile}
        setCvProfile={setCvProfile}
      />
    </div>
  );
}