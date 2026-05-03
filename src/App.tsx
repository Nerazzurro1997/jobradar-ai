import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import type { CvProfile, Job } from "./types";
import {
  clearJobs,
  getSavedJobs,
  logShowSavedFinalOrder,
  saveJobs,
} from "./utils/storage";
import { prepareJobsForDisplay } from "./utils/jobs";
import { Sidebar } from "./components/Sidebar";
import { JobDashboard } from "./components/JobDashboard";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { useJobs } from "./hooks/useJobs";

const CV_PROFILE_KEY = "jobradar_cv_profile";

type CvFileMeta = {
  name: string;
  size: number;
  lastModified: number;
  type: string;
};

type StoredCvProfile = {
  version: 1;
  profile: CvProfile;
  fileMeta: CvFileMeta | null;
  savedAt: string;
};

type AnalyzeCvOptions = {
  showAlert?: boolean;
};

const APP_SHELL_STYLE: CSSProperties = {
  display: "flex",
  minHeight: "100vh",
  background:
    "radial-gradient(circle at top left, #1e3a8a 0, transparent 30%), radial-gradient(circle at top right, #064e3b 0, transparent 28%), #020617",
  fontFamily:
    "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, Arial",
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function getCvFileMeta(file: File): CvFileMeta {
  return {
    name: file.name,
    size: file.size,
    lastModified: file.lastModified,
    type: file.type,
  };
}

function isCvFileMeta(value: unknown): value is CvFileMeta {
  if (!value || typeof value !== "object") return false;

  const meta = value as Partial<CvFileMeta>;

  return (
    typeof meta.name === "string" &&
    typeof meta.size === "number" &&
    typeof meta.lastModified === "number" &&
    typeof meta.type === "string"
  );
}

function isSameCvFileMeta(
  first: CvFileMeta | null | undefined,
  second: CvFileMeta | null | undefined
): boolean {
  if (!first || !second) return false;

  return (
    first.name === second.name &&
    first.size === second.size &&
    first.lastModified === second.lastModified &&
    first.type === second.type
  );
}

function readStoredCvProfile(): StoredCvProfile | null {
  const storage = getStorage();
  const rawProfile = storage?.getItem(CV_PROFILE_KEY);

  if (!storage || !rawProfile) return null;

  try {
    const parsed = JSON.parse(rawProfile) as unknown;

    if (!parsed || typeof parsed !== "object") {
      storage.removeItem(CV_PROFILE_KEY);
      return null;
    }

    if ("profile" in parsed) {
      const stored = parsed as Partial<StoredCvProfile>;

      if (!stored.profile) {
        storage.removeItem(CV_PROFILE_KEY);
        return null;
      }

      return {
        version: 1,
        profile: stored.profile as CvProfile,
        fileMeta: isCvFileMeta(stored.fileMeta) ? stored.fileMeta : null,
        savedAt:
          typeof stored.savedAt === "string"
            ? stored.savedAt
            : new Date().toISOString(),
      };
    }

    return {
      version: 1,
      profile: parsed as CvProfile,
      fileMeta: null,
      savedAt: new Date().toISOString(),
    };
  } catch {
    storage.removeItem(CV_PROFILE_KEY);
    return null;
  }
}

function writeStoredCvProfile(
  profile: CvProfile,
  fileMeta: CvFileMeta | null
): void {
  const storage = getStorage();
  if (!storage) return;

  const payload: StoredCvProfile = {
    version: 1,
    profile,
    fileMeta,
    savedAt: new Date().toISOString(),
  };

  storage.setItem(CV_PROFILE_KEY, JSON.stringify(payload));
}

function removeStoredCvProfile(): void {
  getStorage()?.removeItem(CV_PROFILE_KEY);
}

function loadSavedJobs(): Job[] {
  try {
    return prepareJobsForDisplay(getSavedJobs());
  } catch (error) {
    console.error("Failed to load saved jobs", error);
    return [];
  }
}

function getErrorMessage(error: unknown, fallback = "Something went wrong") {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  return fallback;
}

export default function App() {
  const [initialCvCache] = useState<StoredCvProfile | null>(() =>
    readStoredCvProfile()
  );

  const [cvFile, setCvFile] = useState<File | null>(null);
  const [cvProfile, setCvProfile] = useState<CvProfile | null>(
    () => initialCvCache?.profile ?? null
  );
  const [cvProfileFileMeta, setCvProfileFileMeta] =
    useState<CvFileMeta | null>(() => initialCvCache?.fileMeta ?? null);

  const [savedJobs, setSavedJobs] = useState<Job[]>(loadSavedJobs);
  const [onlyTop, setOnlyTop] = useState(false);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const [showSavedJobs, setShowSavedJobs] = useState(false);
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false);
  const [workspaceResetAt, setWorkspaceResetAt] = useState<string | null>(null);

  const {
    jobs,
    analysis,
    stats,
    searchLoading,
    profileLoading,
    searchJobs: searchJobsFromHook,
    analyzeJob: analyzeJobFromHook,
    analyzeCv: analyzeCvFromHook,
    resetJobs: resetJobsFromHook,
  } = useJobs();

  const refreshSavedJobs = useCallback((persistSorted = false): Job[] => {
    const nextSavedJobs = loadSavedJobs();

    setSavedJobs(nextSavedJobs);

    if (persistSorted) {
      try {
        saveJobs(nextSavedJobs);
      } catch (error) {
        console.error("Failed to persist sorted saved jobs", error);
      }
    }

    return nextSavedJobs;
  }, []);

  useEffect(() => {
    if (!cvFile) return;

    const selectedFileMeta = getCvFileMeta(cvFile);

    if (isSameCvFileMeta(cvProfileFileMeta, selectedFileMeta)) {
      return;
    }

    const storedProfile = readStoredCvProfile();

    if (
      storedProfile?.fileMeta &&
      isSameCvFileMeta(storedProfile.fileMeta, selectedFileMeta)
    ) {
      setCvProfile(storedProfile.profile);
      setCvProfileFileMeta(storedProfile.fileMeta);
      return;
    }

    setCvProfile(null);
    setCvProfileFileMeta(null);
    removeStoredCvProfile();
  }, [cvFile, cvProfileFileMeta]);

  useEffect(() => {
    if (!cvProfile) {
      removeStoredCvProfile();
      return;
    }

    writeStoredCvProfile(cvProfile, cvProfileFileMeta);
  }, [cvProfile, cvProfileFileMeta]);

  const setCvFileAndSyncProfile: Dispatch<SetStateAction<File | null>> =
    useCallback((value) => {
      setCvFile((currentFile) => {
        const nextFile =
          typeof value === "function"
            ? (value as (currentFile: File | null) => File | null)(currentFile)
            : value;

        if (!nextFile) {
          setCvProfile(null);
          setCvProfileFileMeta(null);
        }

        return nextFile;
      });
    }, []);

  const setCvProfileAndPersist: Dispatch<SetStateAction<CvProfile | null>> =
    useCallback(
      (value) => {
        setCvProfile((currentProfile) => {
          const nextProfile =
            typeof value === "function"
              ? (value as (
                  currentProfile: CvProfile | null
                ) => CvProfile | null)(currentProfile)
              : value;

          setCvProfileFileMeta(
            nextProfile && cvFile ? getCvFileMeta(cvFile) : null
          );

          return nextProfile;
        });
      },
      [cvFile]
    );

  const toggleSavedJobs = useCallback(() => {
    const shouldShowSavedJobs = !showSavedJobs;

    if (shouldShowSavedJobs) {
      const sortedSavedJobs = refreshSavedJobs(true);

      logShowSavedFinalOrder(sortedSavedJobs);

      if (sortedSavedJobs.length > 0) {
        setWorkspaceResetAt(null);
      }
    }

    setShowSavedJobs(shouldShowSavedJobs);
  }, [refreshSavedJobs, showSavedJobs]);

  const toggleOnlyTop = useCallback(() => {
    setOnlyTop((current) => !current);
  }, []);

  function requestClearSavedJobs() {
    setClearConfirmOpen(true);
  }

  function cancelClearSavedJobs() {
    setClearConfirmOpen(false);
  }

  function confirmClearSavedJobs() {
    try {
      clearJobs();
      removeStoredCvProfile();
      resetJobsFromHook();

      setSavedJobs([]);
      setCvProfile(null);
      setCvProfileFileMeta(null);
      setCvFile(null);
      setOnlyTop(false);
      setShowSavedJobs(false);
      setHoveredId(null);
      setWorkspaceResetAt(new Date().toISOString());
    } catch (error) {
      console.error("Failed to clear saved data", error);
      window.alert("Could not clear saved data. Please try again.");
    } finally {
      setClearConfirmOpen(false);
    }
  }

  function clearCvProfile() {
    removeStoredCvProfile();
    setCvProfile(null);
    setCvProfileFileMeta(null);
  }

  async function handleAnalyzeCv(
    fileOverride?: File,
    options: AnalyzeCvOptions = {}
  ): Promise<CvProfile> {
    const { showAlert = true } = options;
    const file = fileOverride ?? cvFile;

    if (!file) {
      if (showAlert) {
        window.alert("Upload your CV first");
      }

      throw new Error("No CV file selected");
    }

    try {
      const profile = await analyzeCvFromHook(file);
      const fileMeta = getCvFileMeta(file);

      setCvProfile(profile);
      setCvProfileFileMeta(fileMeta);
      writeStoredCvProfile(profile, fileMeta);

      return profile;
    } catch (error) {
      console.error("CV analysis failed", error);

      if (showAlert) {
        window.alert(
          "CV analysis failed.\n\n" +
            getErrorMessage(error, "Please check your CV and try again.").slice(
              0,
              900
            )
        );
      }

      throw error;
    }
  }

  async function getProfileForFile(file: File): Promise<CvProfile> {
    const currentFileMeta = getCvFileMeta(file);

    if (
      cvProfile &&
      cvProfileFileMeta &&
      isSameCvFileMeta(cvProfileFileMeta, currentFileMeta)
    ) {
      return cvProfile;
    }

    const storedProfile = readStoredCvProfile();

    if (
      storedProfile?.fileMeta &&
      isSameCvFileMeta(storedProfile.fileMeta, currentFileMeta)
    ) {
      setCvProfile(storedProfile.profile);
      setCvProfileFileMeta(storedProfile.fileMeta);
      return storedProfile.profile;
    }

    return handleAnalyzeCv(file, { showAlert: false });
  }

  async function handleSearchJobs() {
    if (!cvFile) {
      window.alert("Upload your CV first");
      return;
    }

    setOnlyTop(false);
    setShowSavedJobs(false);

    try {
      const profileToUse = await getProfileForFile(cvFile);
      const savedJobsBeforeSearch = refreshSavedJobs(false);

      const incomingJobs = await searchJobsFromHook(
        cvFile,
        profileToUse,
        savedJobsBeforeSearch
      );

      const refreshedSavedJobs = refreshSavedJobs(true);

      if (incomingJobs.length > 0) {
        setWorkspaceResetAt(null);
        setShowSavedJobs(false);
        return;
      }

      if (refreshedSavedJobs.length > 0) {
        setWorkspaceResetAt(null);
        setShowSavedJobs(true);
        logShowSavedFinalOrder(refreshedSavedJobs);
        return;
      }

      window.alert("No new jobs found.");
    } catch (error) {
      console.error("Job search failed", error);

      window.alert(
        "Job search failed.\n\n" +
          getErrorMessage(error, "Check your CV and try again.").slice(0, 900)
      );
    }
  }

  async function handleAnalyzeJob(job: Job) {
    if (!cvFile) {
      window.alert("Upload your CV first");
      return;
    }

    try {
      const profileToUse = await getProfileForFile(cvFile);
      await analyzeJobFromHook(job, cvFile, profileToUse);
    } catch (error) {
      console.error("Job analysis failed", error);
      window.alert("Job analysis failed");
    }
  }

  return (
    <div style={APP_SHELL_STYLE}>
      <Sidebar
        cvFile={cvFile}
        cvProfile={cvProfile}
        profileLoading={profileLoading}
        savedJobsCount={savedJobs.length}
        showSavedJobs={showSavedJobs}
        onToggleSavedJobs={toggleSavedJobs}
      />

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
        workspaceResetAt={workspaceResetAt}
        onSearch={handleSearchJobs}
        onAnalyzeCv={() => handleAnalyzeCv()}
        onClearCv={clearCvProfile}
        onToggleSaved={toggleSavedJobs}
        onToggleTop={toggleOnlyTop}
        onClearCache={requestClearSavedJobs}
        onHover={setHoveredId}
        onAnalyzeJob={handleAnalyzeJob}
        setCvFile={setCvFileAndSyncProfile}
        setCvProfile={setCvProfileAndPersist}
      />

      <ConfirmDialog
        open={clearConfirmOpen}
        title="Clear all saved data?"
        description="This will remove your saved jobs, CV profile and current CV selection from Job Radar AI."
        confirmLabel="Clear everything"
        cancelLabel="Keep my data"
        danger
        onConfirm={confirmClearSavedJobs}
        onCancel={cancelClearSavedJobs}
      />
    </div>
  );
}
