import { useCallback, useEffect, useMemo, useRef } from "react";
import type { ChangeEvent, MouseEvent } from "react";
import type { Job, CvProfile } from "../types";
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

function removeStoredCvProfile() {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.removeItem(CV_PROFILE_KEY);
  } catch (error) {
    console.error("Failed to remove stored CV profile", error);
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

function SignalPill({ label }: { label: string }) {
  return (
    <span
      style={{
        padding: "7px 10px",
        borderRadius: 999,
        background: "rgba(59,130,246,0.16)",
        border: "1px solid rgba(59,130,246,0.24)",
        color: "#bfdbfe",
        fontSize: 12,
        fontWeight: 800,
        lineHeight: 1,
      }}
    >
      {label}
    </span>
  );
}

function ResetIllustration() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: "relative",
        width: "100%",
        minHeight: 230,
        borderRadius: 28,
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
          inset: 22,
          borderRadius: 24,
          border: "1px solid rgba(148,163,184,0.12)",
          background: "rgba(2,6,23,0.26)",
        }}
      />

      <svg
        width="100%"
        height="230"
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
        marginBottom: 28,
        borderRadius: 30,
        background:
          "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.72))",
        border: "1px solid rgba(148,163,184,0.18)",
        boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
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
          gap: 28,
          padding: 32,
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
              marginBottom: 18,
            }}
          >
            {isResetState ? "✅ Clean workspace" : "✨ Ready to start"}
          </div>

          <h3
            style={{
              margin: 0,
              fontSize: 30,
              lineHeight: 1.08,
              letterSpacing: -0.7,
              color: "#f8fafc",
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: "12px 0 0",
              color: "#cbd5e1",
              fontSize: 15.5,
              lineHeight: 1.65,
              maxWidth: 620,
            }}
          >
            {description}
          </p>

          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              marginTop: 22,
            }}
          >
            {isResetState && (
              <>
                <span
                  style={{
                    padding: "9px 12px",
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
                    padding: "9px 12px",
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
                      padding: "9px 12px",
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
                  padding: "9px 12px",
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
                  padding: "9px 12px",
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

  const isBusy = searchLoading || profileLoading;
  const isWorkspaceReset = Boolean(workspaceResetAt);

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
    if (!cvFile) {
      clearFileInput();
    }
  }, [cvFile, clearFileInput]);

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

      setCvProfile(null);
      removeStoredCvProfile();
      setCvFile(file);

      event.currentTarget.value = "";
    },
    [setCvFile, setCvProfile]
  );

  const activeJobs = useMemo(() => {
    if (isWorkspaceReset) return [];

    return showSavedJobs ? savedJobs : jobs;
  }, [isWorkspaceReset, showSavedJobs, savedJobs, jobs]);

  const displayedJobs = useMemo(
    () => activeJobs.filter((job) => !onlyTop || (job.score || 0) >= 80),
    [activeJobs, onlyTop]
  );

  const bestScore = useMemo(() => {
    if (activeJobs.length === 0) return 0;

    return Math.max(...activeJobs.map((job) => job.score || 0));
  }, [activeJobs]);

  const avgScore = useMemo(() => {
    if (activeJobs.length === 0) return 0;

    return Math.round(
      activeJobs.reduce((sum, job) => sum + (job.score || 0), 0) /
        activeJobs.length
    );
  }, [activeJobs]);

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
        marginLeft: 260,
        padding: "42px",
        color: "#f8fafc",
      }}
    >
      <section
        className="fade-in"
        style={{
          marginBottom: 34,
          padding: 32,
          borderRadius: 28,
          background:
            "linear-gradient(135deg, rgba(15,23,42,0.94), rgba(30,41,59,0.7))",
          border: "1px solid rgba(148,163,184,0.18)",
          boxShadow: "0 24px 70px rgba(0,0,0,0.28)",
        }}
      >
        <div
          style={{
            display: "inline-flex",
            padding: "7px 12px",
            borderRadius: 999,
            background: "rgba(37,99,235,0.16)",
            border: "1px solid rgba(96,165,250,0.25)",
            color: "#bfdbfe",
            fontSize: 13,
            fontWeight: 900,
            marginBottom: 16,
          }}
        >
          ✨ AI powered job matching
        </div>

        <h1
          style={{
            margin: 0,
            fontSize: 52,
            lineHeight: 1,
            letterSpacing: -1.8,
          }}
        >
          {showSavedJobs && !isWorkspaceReset ? "Saved Jobs" : "AI Job Radar"}
        </h1>

        <p
          style={{
            margin: "14px 0 0",
            color: "#cbd5e1",
            fontSize: 17,
            maxWidth: 760,
            lineHeight: 1.55,
          }}
        >
          Upload your CV, let AI understand your profile, and discover the best
          matching jobs automatically.
        </p>
      </section>

      <section
        className="card fade-in"
        style={{
          marginBottom: 28,
          display: "grid",
          gridTemplateColumns: "1.1fr 0.9fr",
          gap: 22,
          alignItems: "stretch",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: 24 }}>🧠 CV Intelligence</h2>

          <p
            style={{
              margin: "8px 0 18px",
              color: "#94a3b8",
              lineHeight: 1.5,
            }}
          >
            Your CV is used to create a profile for job matching.
          </p>

          {profileLoading && (
            <div
              className="loading"
              style={{
                padding: 16,
                borderRadius: 16,
                background: "rgba(250,204,21,0.08)",
                border: "1px solid rgba(250,204,21,0.25)",
                marginBottom: 16,
              }}
            >
              🔄 AI is analyzing your CV...
            </div>
          )}

          {!profileLoading && cvProfile && (
            <div
              style={{
                padding: 16,
                borderRadius: 16,
                background: "rgba(34,197,94,0.1)",
                border: "1px solid rgba(34,197,94,0.3)",
                marginBottom: 16,
              }}
            >
              <strong style={{ color: "#22c55e" }}>✅ Profile ready</strong>

              <p
                style={{
                  margin: "8px 0 0",
                  color: "#dbeafe",
                  lineHeight: 1.55,
                }}
              >
                {cvProfile.profileSummary || "CV analyzed successfully."}
              </p>
            </div>
          )}

          {!cvFile && (
            <p style={{ margin: "0 0 14px", color: "#cbd5e1" }}>
              Upload your CV to start.
            </p>
          )}

          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <label
              className="file-upload"
              style={{
                opacity: isBusy ? 0.7 : 1,
                cursor: isBusy ? "not-allowed" : "pointer",
              }}
            >
              📄 Upload CV
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
              <button className="btn btn-blue" onClick={onAnalyzeCv}>
                🧠 Analyze CV
              </button>
            )}

            {cvProfile && (
              <button className="btn btn-dark" onClick={onClearCv}>
                🔄 Reset Profile
              </button>
            )}
          </div>

          {cvFile && (
            <p style={{ margin: "12px 0 0", color: "#94a3b8", fontSize: 13 }}>
              Current file: {cvFile.name}
            </p>
          )}
        </div>

        <div
          style={{
            padding: 18,
            borderRadius: 20,
            background: "rgba(2,6,23,0.4)",
            border: "1px solid rgba(148,163,184,0.14)",
          }}
        >
          <h3 style={{ margin: "0 0 12px", fontSize: 17 }}>
            Profile signals
          </h3>

          {hasProfileSignals ? (
            <div style={{ display: "grid", gap: 16 }}>
              {skillSignals.length > 0 && (
                <div>
                  <p
                    style={{
                      margin: "0 0 8px",
                      color: "#94a3b8",
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Skills & keywords
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {skillSignals.slice(0, 14).map((signal, index) => (
                      <SignalPill
                        key={`skill-${signal}-${index}`}
                        label={signal}
                      />
                    ))}
                  </div>
                </div>
              )}

              {languageSignals.length > 0 && (
                <div>
                  <p
                    style={{
                      margin: "0 0 8px",
                      color: "#94a3b8",
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Languages
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {languageSignals.slice(0, 10).map((signal, index) => (
                      <SignalPill
                        key={`language-${signal}-${index}`}
                        label={signal}
                      />
                    ))}
                  </div>
                </div>
              )}

              {roleSignals.length > 0 && (
                <div>
                  <p
                    style={{
                      margin: "0 0 8px",
                      color: "#94a3b8",
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Best-fit roles
                  </p>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {roleSignals.slice(0, 8).map((signal, index) => (
                      <SignalPill
                        key={`role-${signal}-${index}`}
                        label={signal}
                      />
                    ))}
                  </div>
                </div>
              )}

              {highlightSignals.length > 0 && (
                <div>
                  <p
                    style={{
                      margin: "0 0 8px",
                      color: "#94a3b8",
                      fontSize: 12,
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: 0.5,
                    }}
                  >
                    Highlights
                  </p>

                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: 18,
                      color: "#cbd5e1",
                      lineHeight: 1.6,
                      fontSize: 13,
                    }}
                  >
                    {highlightSignals.slice(0, 5).map((highlight, index) => (
                      <li key={`highlight-${highlight}-${index}`}>
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>
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
          marginBottom: 28,
        }}
      >
        <button
          className="btn btn-primary"
          onClick={onSearch}
          disabled={isBusy}
          style={{
            opacity: isBusy ? 0.7 : 1,
            cursor: isBusy ? "not-allowed" : "pointer",
          }}
        >
          {searchLoading ? "🔄 Searching..." : "🔍 Search Jobs"}
        </button>

        {!isWorkspaceReset && savedJobs.length > 0 && (
          <button className="btn btn-dark" onClick={onToggleSaved}>
            💾 {showSavedJobs ? "Show Live Jobs" : "Show Saved Jobs"}
          </button>
        )}

        {!isWorkspaceReset && activeJobs.length > 0 && (
          <button className="btn btn-dark" onClick={onToggleTop}>
            ⭐ {onlyTop ? "Show All Jobs" : "Only Top Jobs"}
          </button>
        )}

        {canClearCache && (
          <button
            className="btn btn-danger"
            onClick={onClearCache}
            disabled={isBusy}
            style={{
              opacity: isBusy ? 0.7 : 1,
              cursor: isBusy ? "not-allowed" : "pointer",
            }}
          >
            🗑 Clear Cache
          </button>
        )}
      </section>

      {!isWorkspaceReset && activeJobs.length > 0 && (
        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
            gap: 16,
            marginBottom: 28,
          }}
        >
          {[
            ["🔍", "Found", stats.foundLinks ?? "-"],
            ["🧠", "Analyzed", stats.scanned ?? "-"],
            ["🎯", "Shown", stats.shown ?? "-"],
            ["🚀", "Best Score", `${bestScore}%`],
            ["📈", "Avg Match", `${avgScore}%`],
          ].map(([icon, label, value]) => (
            <div key={String(label)} className="card">
              <div style={{ fontSize: 22 }}>{icon}</div>

              <p
                style={{
                  margin: "10px 0 4px",
                  color: "#94a3b8",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                {label}
              </p>

              <p style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>
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
            gap: 20,
            marginBottom: 28,
          }}
        >
          {[1, 2, 3].map((item) => (
            <div key={item} className="card loading" style={{ minHeight: 160 }} />
          ))}
        </section>
      )}

      {!searchLoading && activeJobs.length === 0 && (
        <EmptyJobsState
          resetAt={workspaceResetAt}
          cvFile={cvFile}
          cvProfile={cvProfile}
        />
      )}

      {!isWorkspaceReset && (
        <section style={{ display: "grid", gap: 22 }}>
          {displayedJobs.map((job, index) => (
            <JobCard
              key={job.url || job.id || index}
              job={job}
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