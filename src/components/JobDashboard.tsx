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
      ...(!Array.isArray(skillsValue) ? safeArray(skillsValue?.certifications) : []),
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
  const activeJobs = showSavedJobs ? savedJobs : jobs;

  const displayedJobs = activeJobs.filter(
    (job) => !onlyTop || (job.score || 0) >= 80
  );

  const bestScore =
    activeJobs.length > 0
      ? Math.max(...activeJobs.map((job) => job.score || 0))
      : 0;

  const avgScore =
    activeJobs.length > 0
      ? Math.round(
          activeJobs.reduce((sum, job) => sum + (job.score || 0), 0) /
            activeJobs.length
        )
      : 0;

  const { skillSignals, languageSignals, roleSignals, highlightSignals } =
    getProfileSignals(cvProfile);

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
          {showSavedJobs ? "Saved Jobs" : "AI Job Radar"}
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
            <label className="file-upload">
              📄 Upload CV
              <input
                type="file"
                accept="application/pdf"
                onChange={(event) => {
                  const file = event.target.files?.[0];

                  if (file) {
                    setCvProfile(null);
                    localStorage.removeItem(CV_PROFILE_KEY);
                    setCvFile(file);
                  }
                }}
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
                      <SignalPill key={`skill-${signal}-${index}`} label={signal} />
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
                      <SignalPill key={`role-${signal}-${index}`} label={signal} />
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
                      <li key={`highlight-${index}`}>{highlight}</li>
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
          disabled={searchLoading || profileLoading}
          style={{
            opacity: searchLoading || profileLoading ? 0.7 : 1,
            cursor: searchLoading || profileLoading ? "not-allowed" : "pointer",
          }}
        >
          {searchLoading ? "🔄 Searching..." : "🔍 Search Jobs"}
        </button>

        {savedJobs.length > 0 && (
          <button className="btn btn-dark" onClick={onToggleSaved}>
            💾 {showSavedJobs ? "Show Live Jobs" : "Show Saved Jobs"}
          </button>
        )}

        {activeJobs.length > 0 && (
          <button className="btn btn-dark" onClick={onToggleTop}>
            ⭐ {onlyTop ? "Show All Jobs" : "Only Top Jobs"}
          </button>
        )}

        {savedJobs.length > 0 && (
          <button className="btn btn-danger" onClick={onClearCache}>
            🗑 Clear Cache
          </button>
        )}
      </section>

      {activeJobs.length > 0 && (
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
            <div
              key={item}
              className="card loading"
              style={{ minHeight: 160 }}
            />
          ))}
        </section>
      )}

      {!searchLoading && activeJobs.length === 0 && (
        <section
          className="card fade-in"
          style={{
            textAlign: "center",
            padding: 36,
            marginBottom: 28,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 22 }}>No jobs loaded yet</h3>

          <p style={{ margin: "10px 0 0", color: "#94a3b8" }}>
            Upload your CV and start a search to see AI-ranked jobs here.
          </p>
        </section>
      )}

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
    </main>
  );
}