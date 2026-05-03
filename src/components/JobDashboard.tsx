import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ChangeEvent, MouseEvent } from "react";
import type { Job, CvProfile } from "../types";
import { getJobDisplayScore, prepareJobsForDisplay } from "../utils/jobs";
import { JobCard } from "./JobCard";

type Stats = {
  foundLinks?: number;
  scanned?: number;
  shown?: number;
};

type ProfileSignals = {
  skillTags?: string[];
  strongKeywords?: string[];
  cvHighlights?: string[];
  profileSummary?: string;
  languageProfile?: {
    languages?: string[];
    strongestLanguages?: string[];
    businessLanguages?: string[];
    languageKeywords?: string[];
    languageSummary?: string;
  };
  skills?:
    | string[]
    | {
        hardSkills?: string[];
        softSkills?: string[];
        tools?: string[];
        languages?: string[];
        certifications?: string[];
      };
  matching?: {
    bestFitRoles?: string[];
    acceptableRoles?: string[];
    weakFitRoles?: string[];
    dealBreakers?: string[];
    scoringHints?: string[];
    sellingPoints?: string[];
    applicationPositioning?: string[];
  };
  search?: {
    strongKeywords?: string[];
    searchTerms?: string[];
    preferredRoles?: string[];
    preferredLocations?: string[];
  };
};

type RankedDebugJob = Job & {
  finalScore?: number | string | null;
  distanceScore?: number | string | null;
  requirementMatchScore?: number | string | null;
  recencyScore?: number | string | null;
  publishedDate?: string | null;
  savedAt?: number | string | null;
};

type UiDecisionJob = Job & {
  uiIsNew?: boolean;
  uiIsPriority?: boolean;
  uiPriorityRank?: number;
  uiDecisionSection?: "new" | "all" | "live";
};

type SavedSortMode = "best" | "closest" | "newest" | "furthest" | "score";
type SavedFilterMode = "all" | "best" | "top" | "elite";
type ScoreFilterMode = 70 | 80 | 90;

type Props = {
  cvFile: File | null;
  cvProfile: CvProfile | null;
  jobs: Job[];
  savedJobs: Job[];
  showSavedJobs: boolean;
  onlyTop: boolean;
  hoveredId: number | null;
  analysis: Record<number, string>;
  stats: Stats;
  searchLoading: boolean;
  profileLoading: boolean;
  workspaceResetAt: string | null;

  onSearch: () => void;
  onAnalyzeCv: () => void;
  onClearCv: () => void;
  onToggleSaved: () => void;
  onToggleTop: () => void;
  onClearCache: () => void;
  onHover: (id: number | null) => void;
  onAnalyzeJob: (job: Job) => void;

  setCvFile: (file: File | null) => void;
  setCvProfile: (profile: CvProfile | null) => void;
};

const CV_PROFILE_KEY = "jobradar_cv_profile";
const LAST_SEARCH_UI_KEY = "jobradar_saved_jobs_last_search_at";
const NEW_SAVED_JOB_KEYS_KEY = "jobradar_new_saved_job_keys";
const LATEST_SEARCH_JOB_KEYS_KEY = "jobradar_latest_search_job_keys";

const JOB_CARD_GRID_STYLE: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
  gridAutoRows: "1fr",
  gap: 24,
  alignItems: "stretch",
  justifyItems: "stretch",
  width: "100%",
  maxWidth: "100%",
  margin: 0,
};

function resetPageOverflow() {
  if (typeof document === "undefined") return;

  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
}

function closeOpenAiAnalysis() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("jobradar:close-ai-analysis"));
  }

  resetPageOverflow();
}

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function removeStoredCvProfile() {
  try {
    getStorage()?.removeItem(CV_PROFILE_KEY);
  } catch (error) {
    console.error("Failed to remove stored CV profile", error);
  }
}

function readNumberFromStorage(key: string) {
  const rawValue = getStorage()?.getItem(key);
  const parsed = rawValue ? Number(rawValue) : 0;

  return Number.isFinite(parsed) ? parsed : 0;
}

function writeNumberToStorage(key: string, value: number) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(key, String(value));
  } catch (error) {
    console.error(`Failed to store ${key}`, error);
  }
}

function readStringSetFromStorage(key: string) {
  const storage = getStorage();
  const rawValue = storage?.getItem(key);

  if (!rawValue) return new Set<string>();

  try {
    const parsed = JSON.parse(rawValue) as unknown;

    if (!Array.isArray(parsed)) {
      storage?.removeItem(key);
      return new Set<string>();
    }

    return new Set(
      parsed.filter((item): item is string => typeof item === "string")
    );
  } catch {
    storage?.removeItem(key);
    return new Set<string>();
  }
}

function writeStringSetToStorage(key: string, values: string[]) {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.setItem(key, JSON.stringify(values));
  } catch (error) {
    console.error(`Failed to store ${key}`, error);
  }
}

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueItems(items: string[], limit = 16): string[] {
  return [...new Set(items)].slice(0, limit);
}

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim().replace(",", ".");
    const numericText = normalized.match(/-?\d+(\.\d+)?/)?.[0];
    const parsed = numericText ? Number(numericText) : Number(normalized);

    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function getDateTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return 0;

  const swissDate = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (swissDate) {
    const [, day, month, year] = swissDate;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    ).getTime();

    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeUrl(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return "";

  return raw.split("#")[0].split("?")[0].replace(/\/$/, "");
}

function getJobUiKey(job: Job) {
  const url = normalizeUrl(job.url);
  if (url) return `url:${url}`;

  const title = normalizeText(job.title);
  const company = normalizeText(job.company);
  const location = normalizeText(job.location);
  const fallbackKey = [title, company, location].filter(Boolean).join("|");

  if (fallbackKey) return `fallback:${fallbackKey}`;

  return typeof job.id === "number" ? `id:${job.id}` : "";
}

function formatResetTime(value: string | null): string {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDistanceScore(job: Job) {
  return toNumber((job as RankedDebugJob).distanceScore);
}

function getDistanceScoreForFurthest(job: Job) {
  const distanceScore = getDistanceScore(job);

  return distanceScore > 0 ? distanceScore : 999;
}

function getRecencyScore(job: Job) {
  return toNumber((job as RankedDebugJob).recencyScore);
}

function getRequirementMatchScore(job: Job) {
  return toNumber((job as RankedDebugJob).requirementMatchScore);
}

function getPublishedTime(job: Job) {
  return getDateTime((job as RankedDebugJob).publishedDate);
}

function getSavedAtTime(job: Job) {
  return getDateTime((job as RankedDebugJob).savedAt);
}

function getProfileSignals(cvProfile: CvProfile | null) {
  const profile = cvProfile as unknown as ProfileSignals | null;

  if (!profile) {
    return {
      skillSignals: [],
      languageSignals: [],
      roleSignals: [],
      highlightSignals: [],
    };
  }

  const skillsValue = profile.skills;

  const skillSignals = uniqueItems(
    [
      ...safeArray(profile.skillTags),
      ...safeArray(profile.strongKeywords),
      ...safeArray(profile.search?.strongKeywords),
      ...(Array.isArray(skillsValue) ? safeArray(skillsValue) : []),
      ...(!Array.isArray(skillsValue) ? safeArray(skillsValue?.hardSkills) : []),
      ...(!Array.isArray(skillsValue) ? safeArray(skillsValue?.softSkills) : []),
      ...(!Array.isArray(skillsValue) ? safeArray(skillsValue?.tools) : []),
      ...(!Array.isArray(skillsValue)
        ? safeArray(skillsValue?.certifications)
        : []),
    ],
    18
  );

  const languageSignals = uniqueItems(
    [
      ...safeArray(profile.languageProfile?.languages),
      ...safeArray(profile.languageProfile?.strongestLanguages),
      ...safeArray(profile.languageProfile?.businessLanguages),
      ...safeArray(profile.languageProfile?.languageKeywords),
      ...(!Array.isArray(skillsValue) ? safeArray(skillsValue?.languages) : []),
    ],
    12
  );

  const roleSignals = uniqueItems(
    [
      ...safeArray(profile.matching?.bestFitRoles),
      ...safeArray(profile.matching?.acceptableRoles),
      ...safeArray(profile.search?.preferredRoles),
      ...safeArray(profile.search?.searchTerms),
    ],
    10
  );

  const highlightSignals = uniqueItems(
    [
      ...safeArray(profile.cvHighlights),
      ...safeArray(profile.matching?.sellingPoints),
      ...safeArray(profile.matching?.scoringHints),
    ],
    8
  );

  return {
    skillSignals,
    languageSignals,
    roleSignals,
    highlightSignals,
  };
}

function filterSavedJobs(
  jobs: Job[],
  filterMode: SavedFilterMode,
  minimumScore: ScoreFilterMode
) {
  return jobs.filter((job) => {
    const score = getJobDisplayScore(job);

    if (score < minimumScore) return false;
    if (filterMode === "elite") return score >= 90;
    if (filterMode === "best") return score >= 85;
    if (filterMode === "top") return score >= 80;

    return true;
  });
}

function sortSavedJobs(jobs: Job[], mode: SavedSortMode) {
  if (mode === "score") {
    return [...jobs].sort((a, b) => {
      const scoreDiff = getJobDisplayScore(b) - getJobDisplayScore(a);
      if (scoreDiff !== 0) return scoreDiff;

      return getRequirementMatchScore(b) - getRequirementMatchScore(a);
    });
  }

  if (mode === "closest") {
    return [...jobs].sort((a, b) => {
      const distanceDiff = getDistanceScore(b) - getDistanceScore(a);
      if (distanceDiff !== 0) return distanceDiff;

      const scoreDiff = getJobDisplayScore(b) - getJobDisplayScore(a);
      if (scoreDiff !== 0) return scoreDiff;

      return getRecencyScore(b) - getRecencyScore(a);
    });
  }

  if (mode === "furthest") {
    return [...jobs].sort((a, b) => {
      const distanceDiff =
        getDistanceScoreForFurthest(a) - getDistanceScoreForFurthest(b);
      if (distanceDiff !== 0) return distanceDiff;

      return getJobDisplayScore(b) - getJobDisplayScore(a);
    });
  }

  if (mode === "newest") {
    return [...jobs].sort((a, b) => {
      const recencyDiff = getRecencyScore(b) - getRecencyScore(a);
      if (recencyDiff !== 0) return recencyDiff;

      const publishedDiff = getPublishedTime(b) - getPublishedTime(a);
      if (publishedDiff !== 0) return publishedDiff;

      const savedAtDiff = getSavedAtTime(b) - getSavedAtTime(a);
      if (savedAtDiff !== 0) return savedAtDiff;

      return getJobDisplayScore(b) - getJobDisplayScore(a);
    });
  }

  return prepareJobsForDisplay(jobs);
}

function getAverageScore(jobs: Job[]) {
  if (jobs.length === 0) return 0;

  return Math.round(
    jobs.reduce((sum, job) => sum + getJobDisplayScore(job), 0) / jobs.length
  );
}

function getBestScore(jobs: Job[]) {
  if (jobs.length === 0) return 0;

  return Math.max(...jobs.map(getJobDisplayScore));
}

function decorateJobForDecision({
  job,
  section,
  newJobKeys,
  priorityRankByKey,
}: {
  job: Job;
  section: UiDecisionJob["uiDecisionSection"];
  newJobKeys: Set<string>;
  priorityRankByKey: Map<string, number>;
}): Job {
  const key = getJobUiKey(job);
  const priorityRank = priorityRankByKey.get(key);
  const isLatestSearchJob = newJobKeys.has(key);

  return {
    ...job,
    uiIsNew: isLatestSearchJob,
    uiIsPriority: Boolean(priorityRank),
    uiPriorityRank: priorityRank,
    uiDecisionSection: isLatestSearchJob ? "new" : section,
  } as UiDecisionJob;
}

function SignalPill({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: "6px 9px",
        borderRadius: 999,
        background: "rgba(59,130,246,0.16)",
        border: "1px solid rgba(59,130,246,0.24)",
        color: "#bfdbfe",
        fontSize: 11,
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

function SignalGroup({
  title,
  items,
  limit,
}: {
  title: string;
  items: string[];
  limit: number;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <p
        style={{
          margin: "0 0 7px",
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 800,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </p>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
        {items.slice(0, limit).map((signal, index) => (
          <SignalPill key={`${title}-${signal}-${index}`} label={signal} />
        ))}
      </div>
    </div>
  );
}

function SavedMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div
      style={{
        minWidth: 118,
        padding: 13,
        borderRadius: 16,
        background: "rgba(2,6,23,0.38)",
        border: "1px solid rgba(148,163,184,0.14)",
      }}
    >
      <p
        style={{
          margin: "0 0 7px",
          color: "#94a3b8",
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        {label}
      </p>

      <strong
        style={{
          display: "block",
          color: "#f8fafc",
          fontSize: 22,
          lineHeight: 1,
        }}
      >
        {value}
      </strong>

      {hint && (
        <small
          style={{
            display: "block",
            marginTop: 6,
            color: "#64748b",
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {hint}
        </small>
      )}
    </div>
  );
}

function ResetIllustration() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        width: "100%",
        minHeight: 210,
        borderRadius: 24,
        overflow: "hidden",
        background:
          "radial-gradient(circle at 30% 20%, rgba(59,130,246,0.32), transparent 34%), radial-gradient(circle at 80% 70%, rgba(34,197,94,0.18), transparent 30%), linear-gradient(135deg, rgba(15,23,42,0.86), rgba(2,6,23,0.92))",
        border: "1px solid rgba(148,163,184,0.16)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 20,
          borderRadius: 22,
          border: "1px solid rgba(148,163,184,0.12)",
          background: "rgba(2,6,23,0.26)",
        }}
      />

      <svg
        width="100%"
        height="210"
        viewBox="0 0 420 230"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ position: "relative", zIndex: 1 }}
      >
        <defs>
          <linearGradient id="radarLine" x1="120" y1="40" x2="300" y2="190">
            <stop stopColor="#60A5FA" stopOpacity="0.9" />
            <stop offset="1" stopColor="#22C55E" stopOpacity="0.7" />
          </linearGradient>
          <linearGradient id="cardGlow" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#EFF6FF" stopOpacity="0.18" />
            <stop offset="1" stopColor="#60A5FA" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <circle
          cx="210"
          cy="116"
          r="76"
          stroke="rgba(147,197,253,0.15)"
          strokeWidth="1.5"
        />
        <circle
          cx="210"
          cy="116"
          r="48"
          stroke="rgba(147,197,253,0.18)"
          strokeWidth="1.5"
        />
        <circle
          cx="210"
          cy="116"
          r="18"
          stroke="rgba(147,197,253,0.22)"
          strokeWidth="1.5"
        />
        <path
          d="M210 116L265 70"
          stroke="url(#radarLine)"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="265" cy="70" r="8" fill="#22C55E" />
        <circle cx="265" cy="70" r="16" fill="#22C55E" opacity="0.12" />

        <rect
          x="74"
          y="62"
          width="92"
          height="52"
          rx="16"
          fill="url(#cardGlow)"
          stroke="rgba(191,219,254,0.18)"
        />
        <rect
          x="94"
          y="80"
          width="48"
          height="5"
          rx="2.5"
          fill="rgba(191,219,254,0.52)"
        />
        <rect
          x="94"
          y="94"
          width="34"
          height="5"
          rx="2.5"
          fill="rgba(191,219,254,0.22)"
        />

        <rect
          x="252"
          y="132"
          width="96"
          height="54"
          rx="16"
          fill="url(#cardGlow)"
          stroke="rgba(191,219,254,0.18)"
        />
        <rect
          x="273"
          y="151"
          width="50"
          height="5"
          rx="2.5"
          fill="rgba(191,219,254,0.52)"
        />
        <rect
          x="273"
          y="165"
          width="36"
          height="5"
          rx="2.5"
          fill="rgba(191,219,254,0.22)"
        />

        <path
          d="M134 154C160 181 247 191 291 130"
          stroke="rgba(34,197,94,0.38)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray="5 7"
        />
        <circle cx="132" cy="154" r="6" fill="#60A5FA" />
        <circle cx="291" cy="130" r="6" fill="#22C55E" />

        <rect
          x="165"
          y="92"
          width="90"
          height="74"
          rx="22"
          fill="rgba(15,23,42,0.72)"
          stroke="rgba(148,163,184,0.22)"
        />
        <path
          d="M196 126L207 137L229 111"
          stroke="#22C55E"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function EmptyJobsState({
  resetAt,
  cvFile,
  cvProfile,
}: {
  resetAt: string | null;
  cvFile: File | null;
  cvProfile: CvProfile | null;
}) {
  const isResetState = Boolean(resetAt);
  const resetTime = formatResetTime(resetAt);

  const title = isResetState
    ? cvFile
      ? "Workspace cleared. Ready for a fresh search."
      : "Workspace reset complete."
    : "No jobs loaded yet";

  const description = isResetState
    ? cvFile
      ? "Your previous job results are hidden and your new CV is ready. Start a fresh search to rebuild your radar."
      : "Your saved jobs, CV profile and previous search view were cleared. Upload your CV again to start a clean radar session."
    : "Upload your CV and start a search to see AI-ranked jobs here.";

  return (
    <section
      className="card fade-in"
      style={{
        position: "relative",
        overflow: "hidden",
        padding: 0,
        marginBottom: 22,
        borderRadius: 26,
        background:
          "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.72))",
        border: "1px solid rgba(148,163,184,0.18)",
        boxShadow: "0 22px 58px rgba(0,0,0,0.24)",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 12% 15%, rgba(59,130,246,0.18), transparent 34%), radial-gradient(circle at 88% 70%, rgba(34,197,94,0.12), transparent 32%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          display: "grid",
          gridTemplateColumns: "1.05fr 0.95fr",
          gap: 24,
          padding: 28,
          alignItems: "center",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 11px",
              borderRadius: 999,
              background: isResetState
                ? "rgba(34,197,94,0.12)"
                : "rgba(59,130,246,0.14)",
              border: isResetState
                ? "1px solid rgba(34,197,94,0.24)"
                : "1px solid rgba(96,165,250,0.24)",
              color: isResetState ? "#bbf7d0" : "#bfdbfe",
              fontSize: 12,
              fontWeight: 900,
              marginBottom: 16,
            }}
          >
            {isResetState ? "Clean workspace" : "Ready to start"}
          </div>

          <h3
            style={{
              margin: 0,
              fontSize: 28,
              lineHeight: 1.08,
              letterSpacing: -0.5,
              color: "#f8fafc",
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: "11px 0 0",
              color: "#cbd5e1",
              fontSize: 15,
              lineHeight: 1.6,
              maxWidth: 620,
            }}
          >
            {description}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 9,
              marginTop: 18,
            }}
          >
            {isResetState && (
              <>
                <span
                  style={{
                    padding: "8px 11px",
                    borderRadius: 999,
                    background: "rgba(15,23,42,0.62)",
                    border: "1px solid rgba(148,163,184,0.16)",
                    color: "#dbeafe",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Previous results hidden
                </span>

                <span
                  style={{
                    padding: "8px 11px",
                    borderRadius: 999,
                    background: "rgba(15,23,42,0.62)",
                    border: "1px solid rgba(148,163,184,0.16)",
                    color: "#dbeafe",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  Storage cleared
                </span>

                {resetTime && (
                  <span
                    style={{
                      padding: "8px 11px",
                      borderRadius: 999,
                      background: "rgba(15,23,42,0.62)",
                      border: "1px solid rgba(148,163,184,0.16)",
                      color: "#dbeafe",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    Reset at {resetTime}
                  </span>
                )}
              </>
            )}

            {cvFile && (
              <span
                style={{
                  padding: "8px 11px",
                  borderRadius: 999,
                  background: "rgba(37,99,235,0.14)",
                  border: "1px solid rgba(96,165,250,0.22)",
                  color: "#bfdbfe",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                CV selected
              </span>
            )}

            {cvProfile && (
              <span
                style={{
                  padding: "8px 11px",
                  borderRadius: 999,
                  background: "rgba(34,197,94,0.12)",
                  border: "1px solid rgba(34,197,94,0.22)",
                  color: "#bbf7d0",
                  fontSize: 12,
                  fontWeight: 900,
                }}
              >
                Profile ready
              </span>
            )}
          </div>
        </div>

        <ResetIllustration />
      </div>
    </section>
  );
}

function EmptySavedJobsState({ onSearch }: { onSearch: () => void }) {
  return (
    <section
      className="fade-in"
      style={{
        display: "grid",
        gridTemplateColumns: "auto minmax(0, 1fr) auto",
        gap: 18,
        alignItems: "center",
        padding: 24,
        marginBottom: 22,
        borderRadius: 24,
        background:
          "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.68))",
        border: "1px solid rgba(148,163,184,0.18)",
        boxShadow: "0 22px 58px rgba(0,0,0,0.22)",
      }}
    >
      <div
        aria-hidden="true"
        style={{
          width: 56,
          height: 56,
          borderRadius: 19,
          display: "grid",
          placeItems: "center",
          background: "rgba(37,99,235,0.16)",
          border: "1px solid rgba(96,165,250,0.24)",
          color: "#bfdbfe",
          fontSize: 24,
          fontWeight: 900,
        }}
      >
        SJ
      </div>

      <div>
        <h3
          style={{
            margin: 0,
            color: "#f8fafc",
            fontSize: 25,
            letterSpacing: -0.4,
          }}
        >
          No saved jobs yet
        </h3>

        <p
          style={{
            margin: "8px 0 0",
            maxWidth: 620,
            color: "#cbd5e1",
            lineHeight: 1.6,
          }}
        >
          Start a search and JobRadar will keep only strong matches in your
          saved decision list.
        </p>
      </div>

      <button className="btn btn-primary" onClick={onSearch}>
        Search Jobs
      </button>
    </section>
  );
}

function AllSavedJobsSection({
  jobs,
  totalCount,
  savedSortMode,
  savedFilterMode,
  minimumScore,
  onSortChange,
  onFilterChange,
  onScoreChange,
  newJobKeys,
  priorityRankByKey,
  analysis,
  hoveredId,
  onHover,
  onAnalyzeJob,
}: {
  jobs: Job[];
  totalCount: number;
  savedSortMode: SavedSortMode;
  savedFilterMode: SavedFilterMode;
  minimumScore: ScoreFilterMode;
  onSortChange: (value: SavedSortMode) => void;
  onFilterChange: (value: SavedFilterMode) => void;
  onScoreChange: (value: ScoreFilterMode) => void;
  newJobKeys: Set<string>;
  priorityRankByKey: Map<string, number>;
  analysis: Record<number, string>;
  hoveredId: number | null;
  onHover: (id: number | null) => void;
  onAnalyzeJob: (job: Job) => void;
}) {
  return (
    <section
      className="fade-in"
      style={{
        marginBottom: 22,
        padding: 18,
        borderRadius: 26,
        background:
          "linear-gradient(135deg, rgba(15,23,42,0.84), rgba(15,23,42,0.54))",
        border: "1px solid rgba(148,163,184,0.15)",
        boxShadow: "0 22px 56px rgba(0,0,0,0.2)",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) auto",
          gap: 16,
          alignItems: "start",
          marginBottom: 15,
        }}
      >
        <div>
          <p
            style={{
              margin: "0 0 5px",
              color: "#bbf7d0",
              fontSize: 11,
              fontWeight: 900,
              textTransform: "uppercase",
              letterSpacing: 0.55,
            }}
          >
            Main decision list
          </p>

          <h2
            style={{
              margin: 0,
              color: "#f8fafc",
              fontSize: 26,
              lineHeight: 1.08,
              letterSpacing: -0.35,
            }}
          >
            All saved jobs
          </h2>

          <p
            style={{
              margin: "7px 0 0",
              color: "#94a3b8",
              fontSize: 13.5,
              lineHeight: 1.5,
              maxWidth: 760,
            }}
          >
            Complete saved shortlist. Sort, filter and score controls apply to
            this list.
          </p>
        </div>

        <strong
          style={{
            minWidth: 52,
            height: 42,
            borderRadius: 15,
            display: "grid",
            placeItems: "center",
            color: "#dcfce7",
            background: "rgba(34,197,94,0.12)",
            border: "1px solid rgba(34,197,94,0.24)",
            fontSize: 17,
          }}
        >
          {jobs.length}/{totalCount}
        </strong>
      </div>

      <div
        style={{
          display: "flex",
          gap: 10,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 15,
          padding: 9,
          borderRadius: 17,
          background: "rgba(2,6,23,0.4)",
          border: "1px solid rgba(148,163,184,0.13)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>
              Sort
            </span>

            <select
              value={savedSortMode}
              onChange={(event) =>
                onSortChange(event.target.value as SavedSortMode)
              }
              style={{
                height: 36,
                borderRadius: 10,
                padding: "0 12px",
                background: "rgba(2,6,23,0.72)",
                color: "#e2e8f0",
                border: "1px solid rgba(148,163,184,0.18)",
                fontWeight: 800,
                outline: "none",
              }}
            >
              <option value="best">Best match</option>
              <option value="closest">Closest</option>
              <option value="newest">Newest</option>
              <option value="furthest">Furthest</option>
              <option value="score">Highest score</option>
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>
              Filter
            </span>

            <select
              value={savedFilterMode}
              onChange={(event) =>
                onFilterChange(event.target.value as SavedFilterMode)
              }
              style={{
                height: 36,
                borderRadius: 10,
                padding: "0 12px",
                background: "rgba(2,6,23,0.72)",
                color: "#e2e8f0",
                border: "1px solid rgba(148,163,184,0.18)",
                fontWeight: 800,
                outline: "none",
              }}
            >
              <option value="all">All</option>
              <option value="best">Best match</option>
              <option value="top">Top match</option>
              <option value="elite">Elite match</option>
            </select>
          </label>

          <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#94a3b8", fontSize: 12, fontWeight: 900 }}>
              Score
            </span>

            <select
              value={minimumScore}
              onChange={(event) =>
                onScoreChange(Number(event.target.value) as ScoreFilterMode)
              }
              style={{
                height: 36,
                borderRadius: 10,
                padding: "0 12px",
                background: "rgba(2,6,23,0.72)",
                color: "#e2e8f0",
                border: "1px solid rgba(148,163,184,0.18)",
                fontWeight: 800,
                outline: "none",
              }}
            >
              <option value={70}>{">= 70"}</option>
              <option value={80}>{">= 80"}</option>
              <option value={90}>{">= 90"}</option>
            </select>
          </label>
        </div>
      </div>

      {jobs.length === 0 ? (
        <div
          className="card"
          style={{
            borderRadius: 20,
            padding: 20,
            background: "rgba(2,6,23,0.42)",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 21 }}>
            No saved jobs match this filter
          </h3>

          <p
            style={{
              margin: "8px 0 0",
              color: "#94a3b8",
              lineHeight: 1.55,
            }}
          >
            Try switching the filter back to All or lowering the score filter.
          </p>
        </div>
      ) : (
        <div style={JOB_CARD_GRID_STYLE}>
          {jobs.map((job, index) => {
            const decoratedJob = decorateJobForDecision({
              job,
              section: "all",
              newJobKeys,
              priorityRankByKey,
            });

            return (
              <JobCard
                key={job.url || job.id || `saved-${index}`}
                job={decoratedJob}
                index={index}
                analysisText={job.id ? analysis[job.id] : undefined}
                hoveredId={hoveredId}
                showSavedJobs
                onHover={onHover}
                onAnalyze={onAnalyzeJob}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export function JobDashboard({
  cvFile,
  cvProfile,
  jobs,
  savedJobs,
  showSavedJobs,
  onlyTop,
  hoveredId,
  analysis,
  stats,
  searchLoading,
  profileLoading,
  workspaceResetAt,
  onSearch,
  onAnalyzeCv,
  onClearCv,
  onToggleSaved,
  onToggleTop,
  onClearCache,
  onHover,
  onAnalyzeJob,
  setCvFile,
  setCvProfile,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const searchWasRunningRef = useRef(false);
  const activeSearchStartedAtRef = useRef(0);
  const savedKeysBeforeSearchRef = useRef<Set<string>>(new Set());

  const [savedSortMode, setSavedSortMode] = useState<SavedSortMode>("best");
  const [savedFilterMode, setSavedFilterMode] =
    useState<SavedFilterMode>("all");
  const [minimumScore, setMinimumScore] = useState<ScoreFilterMode>(70);
  const [lastSearchAt, setLastSearchAt] = useState(() =>
    readNumberFromStorage(LAST_SEARCH_UI_KEY)
  );
  const [newSavedJobKeys, setNewSavedJobKeys] = useState<Set<string>>(() =>
    readStringSetFromStorage(NEW_SAVED_JOB_KEYS_KEY)
  );
  const [latestSearchJobKeys, setLatestSearchJobKeys] = useState<Set<string>>(
    () => readStringSetFromStorage(LATEST_SEARCH_JOB_KEYS_KEY)
  );

  const isBusy = searchLoading || profileLoading;
  const isWorkspaceReset = Boolean(workspaceResetAt);
  const isSavedView = showSavedJobs && !isWorkspaceReset;

  const sortedLiveJobs = useMemo(() => prepareJobsForDisplay(jobs), [jobs]);

  const savedBaseJobs = useMemo(
    () =>
      prepareJobsForDisplay(savedJobs).filter(
        (job) => getJobDisplayScore(job) >= 70
      ),
    [savedJobs]
  );

  const savedVisibleJobs = useMemo(() => {
    const filteredJobs = filterSavedJobs(
      savedBaseJobs,
      savedFilterMode,
      minimumScore
    );

    return sortSavedJobs(filteredJobs, savedSortMode);
  }, [savedBaseJobs, savedFilterMode, minimumScore, savedSortMode]);

  const activeJobs = useMemo(() => {
    if (isWorkspaceReset) return [];

    return isSavedView ? savedVisibleJobs : sortedLiveJobs;
  }, [isWorkspaceReset, isSavedView, savedVisibleJobs, sortedLiveJobs]);

  const displayedJobs = useMemo(
    () => activeJobs.filter((job) => !onlyTop || getJobDisplayScore(job) >= 80),
    [activeJobs, onlyTop]
  );

  const latestSearchJobsAll = useMemo(
    () =>
      prepareJobsForDisplay(
        savedBaseJobs.filter((job) => latestSearchJobKeys.has(getJobUiKey(job)))
      ),
    [latestSearchJobKeys, savedBaseJobs]
  );

  const latestMarkedJobKeys = useMemo(
    () => new Set([...latestSearchJobKeys, ...newSavedJobKeys]),
    [latestSearchJobKeys, newSavedJobKeys]
  );

  const priorityRankByKey = useMemo(() => {
    const priorityMap = new Map<string, number>();

    savedVisibleJobs.slice(0, 3).forEach((job, index) => {
      const key = getJobUiKey(job);

      if (key) {
        priorityMap.set(key, index + 1);
      }
    });

    return priorityMap;
  }, [savedVisibleJobs]);

  const bestScore = useMemo(() => getBestScore(activeJobs), [activeJobs]);
  const avgScore = useMemo(() => getAverageScore(activeJobs), [activeJobs]);

  const savedBestScore = useMemo(
    () => getBestScore(savedBaseJobs),
    [savedBaseJobs]
  );
  const savedAvgScore = useMemo(
    () => getAverageScore(savedBaseJobs),
    [savedBaseJobs]
  );

  const canClearCache =
    !isWorkspaceReset &&
    (savedJobs.length > 0 ||
      jobs.length > 0 ||
      Boolean(cvFile) ||
      Boolean(cvProfile));

  const clearFileInput = useCallback(() => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  useEffect(() => {
    return () => {
      closeOpenAiAnalysis();
    };
  }, []);

  useEffect(() => {
    if (workspaceResetAt) {
      closeOpenAiAnalysis();
    }
  }, [workspaceResetAt]);

  useEffect(() => {
    if (!cvFile) {
      clearFileInput();
    }
  }, [cvFile, clearFileInput]);

  useEffect(() => {
    if (searchLoading) {
      searchWasRunningRef.current = true;
      return;
    }

    if (!searchWasRunningRef.current) return;

    searchWasRunningRef.current = false;

    const previousKeys = savedKeysBeforeSearchRef.current;
    const searchStartedAt = activeSearchStartedAtRef.current;

    const nextLatestKeys = savedBaseJobs
      .map((job) => {
        const key = getJobUiKey(job);
        const savedAtTime = getSavedAtTime(job);

        if (!key) return "";
        if (!previousKeys.has(key)) return key;
        if (searchStartedAt > 0 && savedAtTime >= searchStartedAt) return key;

        return "";
      })
      .filter(Boolean);

    const nextNewKeys = nextLatestKeys.filter((key) => !previousKeys.has(key));

    setLatestSearchJobKeys(new Set(nextLatestKeys));
    setNewSavedJobKeys(new Set(nextNewKeys));

    writeStringSetToStorage(LATEST_SEARCH_JOB_KEYS_KEY, nextLatestKeys);
    writeStringSetToStorage(NEW_SAVED_JOB_KEYS_KEY, nextNewKeys);

    const completedAt = Date.now();

    setLastSearchAt(completedAt);
    writeNumberToStorage(LAST_SEARCH_UI_KEY, completedAt);
  }, [savedBaseJobs, searchLoading]);

  const handleFileInputClick = useCallback(
    (event: MouseEvent<HTMLInputElement>) => {
      event.currentTarget.value = "";
    },
    []
  );

  const handleCvFileChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.currentTarget.files?.[0] ?? null;

      if (!file) {
        event.currentTarget.value = "";
        return;
      }

      closeOpenAiAnalysis();
      setCvProfile(null);
      removeStoredCvProfile();

      setCvFile(file);
      event.currentTarget.value = "";
    },
    [setCvFile, setCvProfile]
  );

  const handleSearch = useCallback(() => {
    closeOpenAiAnalysis();

    const now = Date.now();

    activeSearchStartedAtRef.current = now;
    savedKeysBeforeSearchRef.current = new Set(
      savedBaseJobs.map(getJobUiKey).filter(Boolean)
    );

    setLastSearchAt(now);
    writeNumberToStorage(LAST_SEARCH_UI_KEY, now);

    setNewSavedJobKeys(new Set());
    setLatestSearchJobKeys(new Set());
    writeStringSetToStorage(NEW_SAVED_JOB_KEYS_KEY, []);
    writeStringSetToStorage(LATEST_SEARCH_JOB_KEYS_KEY, []);

    onSearch();
  }, [onSearch, savedBaseJobs]);

  const handleToggleSaved = useCallback(() => {
    closeOpenAiAnalysis();
    onToggleSaved();
  }, [onToggleSaved]);

  const handleToggleTop = useCallback(() => {
    closeOpenAiAnalysis();
    onToggleTop();
  }, [onToggleTop]);

  const handleAnalyzeCv = useCallback(() => {
    closeOpenAiAnalysis();
    onAnalyzeCv();
  }, [onAnalyzeCv]);

  const handleClearCv = useCallback(() => {
    closeOpenAiAnalysis();
    onClearCv();
  }, [onClearCv]);

  const handleClearCacheClick = useCallback(() => {
    closeOpenAiAnalysis();
    onClearCache();
  }, [onClearCache]);

  const { skillSignals, languageSignals, roleSignals, highlightSignals } =
    useMemo(() => getProfileSignals(cvProfile), [cvProfile]);

  const hasProfileSignals =
    skillSignals.length > 0 ||
    languageSignals.length > 0 ||
    roleSignals.length > 0 ||
    highlightSignals.length > 0;

  return (
    <main
      style={{
        flex: 1,
        minWidth: 0,
        marginLeft: 260,
        padding: "30px",
        color: "#f8fafc",
      }}
    >
      <section
        className="fade-in"
        style={{
          display: "grid",
          gridTemplateColumns: isSavedView
            ? "minmax(0, 1fr) minmax(390px, 0.86fr)"
            : "minmax(0, 1fr)",
          gap: 20,
          alignItems: "stretch",
          marginBottom: 18,
          padding: 24,
          borderRadius: 26,
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.66))",
          border: "1px solid rgba(148,163,184,0.17)",
          boxShadow: "0 22px 58px rgba(0,0,0,0.24)",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              padding: "7px 12px",
              borderRadius: 999,
              background: isSavedView
                ? "rgba(34,197,94,0.12)"
                : "rgba(37,99,235,0.16)",
              border: isSavedView
                ? "1px solid rgba(34,197,94,0.24)"
                : "1px solid rgba(96,165,250,0.25)",
              color: isSavedView ? "#bbf7d0" : "#bfdbfe",
              fontSize: 12,
              fontWeight: 900,
              marginBottom: 14,
            }}
          >
            {isSavedView ? "Decision engine" : "AI powered job matching"}
          </div>

          <h1
            style={{
              margin: 0,
              fontSize: isSavedView ? 42 : 48,
              lineHeight: 1,
              letterSpacing: -1.1,
            }}
          >
            {isSavedView ? "Saved Jobs" : "AI Job Radar"}
          </h1>

          <p
            style={{
              margin: "12px 0 0",
              color: "#cbd5e1",
              fontSize: 16,
              maxWidth: 760,
              lineHeight: 1.5,
            }}
          >
            {isSavedView
              ? "A single decision list with sort, filter and score controls."
              : "Upload your CV, let AI understand your profile, and discover the best matching jobs automatically."}
          </p>
        </div>

        {isSavedView && (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 10,
            }}
          >
            <SavedMetricCard label="Saved jobs" value={savedBaseJobs.length} />
            <SavedMetricCard label="Best score" value={`${savedBestScore}%`} />
            <SavedMetricCard
              label="Average match"
              value={`${savedAvgScore}%`}
            />
            <SavedMetricCard
              label="Latest search"
              value={latestSearchJobsAll.length}
              hint={lastSearchAt ? "tracked locally" : undefined}
            />
          </div>
        )}
      </section>

      <section
        className="fade-in"
        style={{
          marginBottom: 18,
          display: "grid",
          gridTemplateColumns: isSavedView ? "0.78fr 1.22fr" : "1.05fr 0.95fr",
          gap: 16,
          alignItems: "stretch",
          padding: 16,
          borderRadius: 22,
          background: "rgba(15,23,42,0.7)",
          border: "1px solid rgba(148,163,184,0.14)",
          boxShadow: "0 18px 46px rgba(0,0,0,0.18)",
          backdropFilter: "blur(12px)",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: isSavedView ? 19 : 22 }}>
            CV Intelligence
          </h2>

          <p
            style={{
              margin: "7px 0 13px",
              color: "#94a3b8",
              lineHeight: 1.45,
              fontSize: 14,
            }}
          >
            {isSavedView
              ? "Compact profile summary used to rank your saved decisions."
              : "Your CV is used to create a profile for job matching."}
          </p>

          {profileLoading && (
            <div
              className="loading"
              style={{
                padding: 12,
                borderRadius: 14,
                background: "rgba(250,204,21,0.08)",
                border: "1px solid rgba(250,204,21,0.25)",
                marginBottom: 12,
              }}
            >
              AI is analyzing your CV...
            </div>
          )}

          {!profileLoading && cvProfile && (
            <div
              style={{
                padding: 13,
                borderRadius: 15,
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.26)",
                marginBottom: isSavedView ? 0 : 14,
              }}
            >
              <strong style={{ color: "#22c55e" }}>Profile ready</strong>

              <p
                style={{
                  margin: "7px 0 0",
                  color: "#dbeafe",
                  lineHeight: 1.5,
                  fontSize: 13.5,
                }}
              >
                {cvProfile.profileSummary || "CV analyzed successfully."}
              </p>
            </div>
          )}

          {!cvFile && !isSavedView && (
            <p style={{ margin: "0 0 14px", color: "#cbd5e1" }}>
              Upload your CV to start.
            </p>
          )}

          {!isSavedView && (
            <>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <label
                  className="file-upload"
                  style={{
                    opacity: isBusy ? 0.7 : 1,
                    cursor: isBusy ? "not-allowed" : "pointer",
                  }}
                >
                  Upload CV
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="application/pdf,.pdf"
                    disabled={isBusy}
                    onClick={handleFileInputClick}
                    onChange={handleCvFileChange}
                  />
                </label>

                {cvFile && !cvProfile && !profileLoading && (
                  <button className="btn btn-blue" onClick={handleAnalyzeCv}>
                    Analyze CV
                  </button>
                )}

                {cvProfile && (
                  <button className="btn btn-dark" onClick={handleClearCv}>
                    Reset Profile
                  </button>
                )}
              </div>

              {cvFile && (
                <p
                  style={{
                    margin: "11px 0 0",
                    color: "#94a3b8",
                    fontSize: 12.5,
                  }}
                >
                  Current file: {cvFile.name}
                </p>
              )}
            </>
          )}
        </div>

        <div
          style={{
            padding: 14,
            borderRadius: 18,
            background: "rgba(2,6,23,0.36)",
            border: "1px solid rgba(148,163,184,0.13)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 12,
              alignItems: "start",
            }}
          >
            <h3 style={{ margin: 0, fontSize: 16 }}>Profile signals</h3>

            {isSavedView && cvFile && (
              <small
                style={{
                  color: "#64748b",
                  fontSize: 10.5,
                  textAlign: "right",
                  maxWidth: 220,
                }}
              >
                {cvFile.name}
              </small>
            )}
          </div>

          {hasProfileSignals ? (
            <div style={{ display: "grid", gap: isSavedView ? 11 : 14 }}>
              <SignalGroup
                title="Best-fit roles"
                items={roleSignals}
                limit={isSavedView ? 5 : 8}
              />

              <SignalGroup
                title="Skills & keywords"
                items={skillSignals}
                limit={isSavedView ? 7 : 14}
              />

              <SignalGroup
                title="Languages"
                items={languageSignals}
                limit={isSavedView ? 6 : 10}
              />

              {!isSavedView && (
                <SignalGroup
                  title="Highlights"
                  items={highlightSignals}
                  limit={5}
                />
              )}
            </div>
          ) : (
            <p style={{ margin: 0, color: "#94a3b8", lineHeight: 1.5 }}>
              Skills, languages and matching signals will appear here after the
              CV profile is created.
            </p>
          )}
        </div>
      </section>

      <section
        style={{
          display: "flex",
          gap: 12,
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: 18,
        }}
      >
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button
            className="btn btn-primary"
            onClick={handleSearch}
            disabled={isBusy}
            style={{
              opacity: isBusy ? 0.7 : 1,
              cursor: isBusy ? "not-allowed" : "pointer",
            }}
          >
            {searchLoading ? "Searching..." : "Search Jobs"}
          </button>

          {!isWorkspaceReset && savedJobs.length > 0 && (
            <button className="btn btn-dark" onClick={handleToggleSaved}>
              {isSavedView ? "Show Live Jobs" : "Show Saved Jobs"}
            </button>
          )}

          {!isSavedView && !isWorkspaceReset && activeJobs.length > 0 && (
            <button className="btn btn-dark" onClick={handleToggleTop}>
              {onlyTop ? "Show All Jobs" : "Only Top Jobs"}
            </button>
          )}
        </div>

        {canClearCache && (
          <button
            className="btn btn-danger"
            onClick={handleClearCacheClick}
            disabled={isBusy}
            style={{
              opacity: isBusy ? 0.7 : 1,
              cursor: isBusy ? "not-allowed" : "pointer",
              marginLeft: isSavedView ? 0 : "auto",
            }}
          >
            Clear cache
          </button>
        )}
      </section>

      {!isSavedView && !isWorkspaceReset && activeJobs.length > 0 && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 14,
            marginBottom: 22,
          }}
        >
          {[
            ["Found", stats.foundLinks ?? "-"],
            ["Analyzed", stats.scanned ?? "-"],
            ["Shown", stats.shown ?? "-"],
            ["Best Score", `${bestScore}%`],
            ["Avg Match", `${avgScore}%`],
          ].map(([label, value]) => (
            <div key={String(label)} className="card">
              <p
                style={{
                  margin: "0 0 7px",
                  color: "#94a3b8",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {label}
              </p>

              <p style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>
                {value}
              </p>
            </div>
          ))}
        </section>
      )}

      {searchLoading && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 22,
          }}
        >
          {[1, 2, 3].map((item) => (
            <div key={item} className="card loading" style={{ minHeight: 130 }} />
          ))}
        </section>
      )}

      {!searchLoading && isSavedView && savedBaseJobs.length === 0 && (
        <EmptySavedJobsState onSearch={handleSearch} />
      )}

      {!searchLoading && isSavedView && savedBaseJobs.length > 0 && (
        <AllSavedJobsSection
          jobs={savedVisibleJobs}
          totalCount={savedBaseJobs.length}
          savedSortMode={savedSortMode}
          savedFilterMode={savedFilterMode}
          minimumScore={minimumScore}
          onSortChange={setSavedSortMode}
          onFilterChange={setSavedFilterMode}
          onScoreChange={setMinimumScore}
          newJobKeys={latestMarkedJobKeys}
          priorityRankByKey={priorityRankByKey}
          analysis={analysis}
          hoveredId={hoveredId}
          onHover={onHover}
          onAnalyzeJob={onAnalyzeJob}
        />
      )}

      {!searchLoading && !isSavedView && activeJobs.length === 0 && (
        <EmptyJobsState
          resetAt={workspaceResetAt}
          cvFile={cvFile}
          cvProfile={cvProfile}
        />
      )}

      {!searchLoading &&
        !isSavedView &&
        !isWorkspaceReset &&
        displayedJobs.length > 0 && (
          <section style={{ display: "grid", gap: 14 }}>
            {displayedJobs.map((job, index) => (
              <JobCard
                key={job.url || job.id || index}
                job={
                  {
                    ...job,
                    uiDecisionSection: "live",
                  } as UiDecisionJob
                }
                index={index}
                analysisText={job.id ? analysis[job.id] : undefined}
                hoveredId={hoveredId}
                showSavedJobs={showSavedJobs}
                onHover={onHover}
                onAnalyze={onAnalyzeJob}
              />
            ))}
          </section>
        )}
    </main>
  );
}
