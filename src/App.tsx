import { useCallback, useEffect, useState } from "react";
import type { CSSProperties, Dispatch, SetStateAction } from "react";
import type { CvProfile, Job } from "./types";
import { clearJobs, getSavedJobs, saveJobs } from "./utils/storage";
import { prepareJobsForDisplay } from "./utils/jobs";
import { toBase64 } from "./utils/file";
import { clearCvCacheAPI } from "./services/api";
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

type ToastType = "success" | "error" | "warning";

type ToastMessage = {
  id: number;
  type: ToastType;
  title: string;
  message?: string;
};

const APP_SHELL_STYLE: CSSProperties = {
  display: "flex",
  width: "100%",
  minWidth: 0,
  minHeight: "100vh",
  overflowX: "hidden",
  alignItems: "stretch",
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

function normalizeBlockedFileNameText(value = "") {
  return value
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBlockedNonCvReasonFromFileName(fileName: string): string | null {
  const normalizedFileName = normalizeBlockedFileNameText(fileName);
  const compactFileName = normalizedFileName.replace(/[^a-z0-9]+/g, "");
  const blockedTerms = [
    "arbeitsbestätigung",
    "arbeitsbestaetigung",
    "arbeitszeugnis",
    "arbeitgeberbescheinigung",
    "employment confirmation",
    "employment certificate",
    "work certificate",
    "attestation de travail",
    "certificat de travail",
    "attestato di lavoro",
    "certificato di lavoro",
    "conferma di lavoro",
    "rechnung",
    "invoice",
    "fattura",
    "facture",
    "vertrag",
    "contract",
    "contratto",
    "contrat",
    "police",
    "offerte",
    "offerte assicurativa",
    "versicherungsofferte",
    "stelleninserat",
    "job ad",
  ];

  for (const term of blockedTerms) {
    const normalizedTerm = normalizeBlockedFileNameText(term);
    const compactTerm = normalizedTerm.replace(/[^a-z0-9]+/g, "");

    if (
      normalizedFileName.includes(normalizedTerm) ||
      compactFileName.includes(compactTerm)
    ) {
      return `Filename contains non-CV document signal: ${term}`;
    }
  }

  return null;
}

function getNonCvUploadMessage() {
  return "Questo file non sembra essere un CV. Carica per favore il tuo curriculum.";
}

function isRecoveredPartialCvProfile(profile: CvProfile | null | undefined) {
  return Boolean(
    profile?.profileSummary
      ?.toLowerCase()
      .includes("cv profile recovered from partial ai response")
  );
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

      const fileMeta = isCvFileMeta(stored.fileMeta) ? stored.fileMeta : null;

      if (
        isRecoveredPartialCvProfile(stored.profile as CvProfile) ||
        (fileMeta?.name && getBlockedNonCvReasonFromFileName(fileMeta.name))
      ) {
        storage.removeItem(CV_PROFILE_KEY);
        return null;
      }

      return {
        version: 1,
        profile: stored.profile as CvProfile,
        fileMeta,
        savedAt:
          typeof stored.savedAt === "string"
            ? stored.savedAt
            : new Date().toISOString(),
      };
    }

    if (isRecoveredPartialCvProfile(parsed as CvProfile)) {
      storage.removeItem(CV_PROFILE_KEY);
      return null;
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
  if (isRecoveredPartialCvProfile(profile)) return;
  if (fileMeta?.name && getBlockedNonCvReasonFromFileName(fileMeta.name)) return;

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

function getFriendlyErrorMessage(error: unknown, fallback = "Something went wrong. Try again.") {
  const message = getErrorMessage(error, fallback);
  const lower = message.toLowerCase();

  if (
    lower.includes("non sembra essere un cv") ||
    lower.includes("not_a_cv") ||
    lower.includes("does not look like a cv")
  ) {
    return "This file doesn't look like a CV. Please upload your resume.";
  }

  if (lower.includes("json") || lower.includes("parse")) {
    return "We couldn't read the AI response correctly. Try again.";
  }

  if (
    lower.includes("failed to fetch") ||
    lower.includes("network") ||
    lower.includes("timeout")
  ) {
    return "Network connection issue. Check your connection and try again.";
  }

  return message || fallback;
}

function formatDuration(durationMs: number) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "";

  const seconds = Math.max(1, Math.round(durationMs / 1000));
  return `${seconds}s`;
}

function getToastStyle(type: ToastType): CSSProperties {
  const colors = {
    success: {
      border: "rgba(34,197,94,0.35)",
      background: "rgba(5,46,22,0.94)",
      accent: "#22c55e",
    },
    error: {
      border: "rgba(248,113,113,0.36)",
      background: "rgba(69,10,10,0.95)",
      accent: "#f87171",
    },
    warning: {
      border: "rgba(250,204,21,0.36)",
      background: "rgba(66,32,6,0.95)",
      accent: "#facc15",
    },
  }[type];

  return {
    width: "min(420px, calc(100vw - 32px))",
    padding: "14px 16px",
    borderRadius: 18,
    color: "#f8fafc",
    background: colors.background,
    border: `1px solid ${colors.border}`,
    boxShadow: "0 22px 62px rgba(0,0,0,0.38)",
    backdropFilter: "blur(18px)",
    borderLeft: `4px solid ${colors.accent}`,
  };
}

function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "fixed",
        top: 18,
        right: 18,
        zIndex: 10000,
        display: "grid",
        gap: 10,
        pointerEvents: "none",
      }}
    >
      {toasts.map((toast) => (
        <div key={toast.id} style={getToastStyle(toast.type)}>
          <div
            style={{
              display: "flex",
              gap: 12,
              justifyContent: "space-between",
              alignItems: "start",
            }}
          >
            <div>
              <strong style={{ display: "block", fontSize: 14.5 }}>
                {toast.title}
              </strong>

              {toast.message && (
                <p
                  style={{
                    margin: "5px 0 0",
                    color: "#cbd5e1",
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  {toast.message}
                </p>
              )}
            </div>

            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={() => onDismiss(toast.id)}
              style={{
                pointerEvents: "auto",
                width: 28,
                height: 28,
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.16)",
                background: "rgba(15,23,42,0.42)",
                color: "#e2e8f0",
                cursor: "pointer",
              }}
            >
              ×
            </button>
          </div>
        </div>
      ))}
    </div>
  );
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
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

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
    lastCvAnalysisFeedback,
  } = useJobs();

  const dismissToast = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback(
    (type: ToastType, title: string, message?: string) => {
      const id = Date.now() + Math.random();

      setToasts((current) =>
        [...current, { id, type, title, message }].slice(-4)
      );

      window.setTimeout(() => dismissToast(id), 5200);
    },
    [dismissToast]
  );

  useEffect(() => {
    if (!lastCvAnalysisFeedback || !cvProfile) return;

    const durationText = formatDuration(lastCvAnalysisFeedback.durationMs);

    showToast(
      "success",
      lastCvAnalysisFeedback.cacheHit
        ? "Profile loaded from cache"
        : "CV analysis complete",
      lastCvAnalysisFeedback.cacheHit
        ? `Loaded from cache in ${durationText}.`
        : `CV analyzed in ${durationText}.`
    );
  }, [cvProfile, lastCvAnalysisFeedback, showToast]);

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

    if (getBlockedNonCvReasonFromFileName(cvFile.name)) {
      removeStoredCvProfile();
      setCvFile(null);
      setCvProfile(null);
      setCvProfileFileMeta(null);
      return;
    }

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

    if (isRecoveredPartialCvProfile(cvProfile)) {
      removeStoredCvProfile();
      setCvProfile(null);
      setCvProfileFileMeta(null);
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

        if (nextFile && getBlockedNonCvReasonFromFileName(nextFile.name)) {
          removeStoredCvProfile();
          setCvProfile(null);
          setCvProfileFileMeta(null);
          showToast(
            "warning",
            "This file doesn't look like a CV",
            "Please upload your resume as a PDF."
          );
          return null;
        }

        if (!nextFile) {
          setCvProfile(null);
          setCvProfileFileMeta(null);
        }

        return nextFile;
      });
    }, [showToast]);

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

  async function clearBackendCvCacheForFile(file: File | null) {
    if (!file) return;

    try {
      const base64 = await toBase64(file);
      const result = await clearCvCacheAPI(base64);

      if (!result?.success || !result?.cleared) {
        console.warn("Backend CV cache clear did not delete a cache row", result);
      }
    } catch (error) {
      console.warn("Failed to clear backend CV cache", error);
    }
  }

  async function confirmClearSavedJobs() {
    const cvFileToClear = cvFile;

    try {
      await clearBackendCvCacheForFile(cvFileToClear);

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
      showToast(
        "success",
        "Workspace cleared",
        "Your CV, profile and local job results were reset."
      );
    } catch (error) {
      console.error("Failed to clear saved data", error);
      showToast("error", "Could not clear workspace", "Please try again.");
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
        showToast(
          "warning",
          "Upload your CV first",
          "Choose a PDF resume before starting analysis."
        );
      }

      throw new Error("No CV file selected");
    }

    if (getBlockedNonCvReasonFromFileName(file.name)) {
      removeStoredCvProfile();
      setCvFile(null);
      setCvProfile(null);
      setCvProfileFileMeta(null);
      throw new Error(getNonCvUploadMessage());
    }

    try {
      const profile = await analyzeCvFromHook(file);
      const fileMeta = getCvFileMeta(file);

      setCvProfile(profile);
      setCvProfileFileMeta(fileMeta);
      writeStoredCvProfile(profile, fileMeta);
      setWorkspaceResetAt(null);

      return profile;
    } catch (error) {
      console.error("CV analysis failed", error);

      if (showAlert) {
        showToast(
          "error",
          "CV analysis failed",
          getFriendlyErrorMessage(
            error,
            "Please check your CV and try again."
          ).slice(0, 240)
        );
      }

      throw error;
    }
  }

  async function getProfileForFile(file: File): Promise<CvProfile> {
    if (getBlockedNonCvReasonFromFileName(file.name)) {
      removeStoredCvProfile();
      setCvFile(null);
      setCvProfile(null);
      setCvProfileFileMeta(null);
      throw new Error(getNonCvUploadMessage());
    }

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
      showToast(
        "warning",
        "Upload your CV first",
        "Choose a PDF resume before searching jobs."
      );
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

      if (refreshedSavedJobs.length > 0) {
        setWorkspaceResetAt(null);
        setShowSavedJobs(true);
        showToast(
          "success",
          "Search complete",
          `${refreshedSavedJobs.length} ranked jobs are ready.`
        );
        return;
      }

      if (incomingJobs.length > 0) {
        setWorkspaceResetAt(null);
        setShowSavedJobs(false);
        showToast(
          "success",
          "Search complete",
          `${incomingJobs.length} ranked jobs are ready.`
        );
        return;
      }

      showToast(
        "warning",
        "No new jobs found",
        "Try again later or adjust your CV/search profile."
      );
    } catch (error) {
      console.error("Job search failed", error);

      showToast(
        "error",
        "Job search failed",
        getFriendlyErrorMessage(error, "Check your CV and try again.").slice(
          0,
          240
        )
      );
    }
  }

  async function handleAnalyzeJob(job: Job) {
    if (!cvFile) {
      showToast(
        "warning",
        "Upload your CV first",
        "Choose a PDF resume before analyzing a job."
      );
      return;
    }

    try {
      const profileToUse = await getProfileForFile(cvFile);
      await analyzeJobFromHook(job, cvFile, profileToUse);
      showToast("success", "Job analysis ready", "The job card was updated.");
    } catch (error) {
      console.error("Job analysis failed", error);
      showToast(
        "error",
        "Job analysis failed",
        getFriendlyErrorMessage(error, "Try again.").slice(0, 240)
      );
    }
  }

  return (
    <div className="dashboard-shell" style={APP_SHELL_STYLE}>
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
        cvAnalysisFeedback={lastCvAnalysisFeedback}
        workspaceResetAt={workspaceResetAt}
        onSearch={handleSearchJobs}
        onAnalyzeCv={() => {
          void handleAnalyzeCv().catch(() => undefined);
        }}
        onClearCv={clearCvProfile}
        onToggleSaved={toggleSavedJobs}
        onToggleTop={toggleOnlyTop}
        onClearCache={requestClearSavedJobs}
        onHover={setHoveredId}
        onAnalyzeJob={handleAnalyzeJob}
        setCvFile={setCvFileAndSyncProfile}
        setCvProfile={setCvProfileAndPersist}
      />

      <ToastStack toasts={toasts} onDismiss={dismissToast} />

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
