import type { CSSProperties } from "react";

type SidebarProps = {
  cvFile: File | null;
  cvProfile: unknown;
  profileLoading: boolean;
  savedJobsCount: number;
  showSavedJobs: boolean;
  onToggleSavedJobs: () => void;
};

type NavButtonProps = {
  icon: string;
  label: string;
  count?: number;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

type WorkspaceState = {
  label: string;
  title: string;
  subtitle: string;
  nextStep: string;
  progress: number;
  color: string;
  softColor: string;
  borderColor: string;
  icon: string;
};

const SIDEBAR_WIDTH = 260;

const sidebarStyle: CSSProperties = {
  width: SIDEBAR_WIDTH,
  background:
    "radial-gradient(circle at top left, rgba(37,99,235,0.22), transparent 34%), radial-gradient(circle at bottom right, rgba(20,184,166,0.13), transparent 30%), rgba(2,6,23,0.97)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  color: "white",
  padding: 22,
  position: "fixed",
  top: 0,
  bottom: 0,
  left: 0,
  borderRight: "1px solid rgba(148,163,184,0.16)",
  boxSizing: "border-box",
  display: "flex",
  flexDirection: "column",
  justifyContent: "space-between",
  overflowY: "auto",
  boxShadow: "18px 0 60px rgba(0,0,0,0.24)",
};

function truncateFileName(name: string, maxLength = 23): string {
  if (name.length <= maxLength) return name;

  const extensionIndex = name.lastIndexOf(".");
  const extension = extensionIndex > -1 ? name.slice(extensionIndex) : "";
  const baseName = extensionIndex > -1 ? name.slice(0, extensionIndex) : name;
  const visibleLength = Math.max(maxLength - extension.length - 4, 8);

  return `${baseName.slice(0, visibleLength)}...${extension}`;
}

function formatFileSize(size: number): string {
  if (!Number.isFinite(size) || size <= 0) return "";

  if (size < 1024 * 1024) {
    return `${Math.round(size / 1024)} KB`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function getWorkspaceState({
  cvFile,
  cvProfile,
  profileLoading,
  savedJobsCount,
}: {
  cvFile: File | null;
  cvProfile: unknown;
  profileLoading: boolean;
  savedJobsCount: number;
}): WorkspaceState {
  if (profileLoading) {
    return {
      label: "Analyzing",
      title: "Analyzing CV",
      subtitle: "Building your AI profile",
      nextStep: "Wait for profile analysis",
      progress: 62,
      color: "#facc15",
      softColor: "rgba(250,204,21,0.13)",
      borderColor: "rgba(250,204,21,0.28)",
      icon: "⏳",
    };
  }

  if (cvProfile && savedJobsCount > 0) {
    return {
      label: "Active",
      title: "Radar active",
      subtitle: `${savedJobsCount} saved job${savedJobsCount === 1 ? "" : "s"}`,
      nextStep: "Review your best matches",
      progress: 100,
      color: "#22c55e",
      softColor: "rgba(34,197,94,0.13)",
      borderColor: "rgba(34,197,94,0.28)",
      icon: "⚡",
    };
  }

  if (cvProfile) {
    return {
      label: "Ready",
      title: "Profile ready",
      subtitle: "Matching signals active",
      nextStep: "Search jobs",
      progress: 86,
      color: "#22c55e",
      softColor: "rgba(34,197,94,0.13)",
      borderColor: "rgba(34,197,94,0.28)",
      icon: "✅",
    };
  }

  if (cvFile) {
    return {
      label: "CV loaded",
      title: "CV uploaded",
      subtitle: "Analyze profile next",
      nextStep: "Analyze CV",
      progress: 44,
      color: "#60a5fa",
      softColor: "rgba(96,165,250,0.13)",
      borderColor: "rgba(96,165,250,0.28)",
      icon: "📄",
    };
  }

  return {
    label: "Setup",
    title: "No CV yet",
    subtitle: "Upload your CV to start",
    nextStep: "Upload CV",
    progress: 12,
    color: "#fb7185",
    softColor: "rgba(251,113,133,0.13)",
    borderColor: "rgba(251,113,133,0.28)",
    icon: "⚠️",
  };
}

function NavButton({
  icon,
  label,
  count,
  active = false,
  disabled = false,
  onClick,
}: NavButtonProps) {
  return (
    <button
      type="button"
      className={[
        "jr-side-pro-nav-btn",
        active ? "jr-side-pro-nav-btn-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      onClick={disabled ? undefined : onClick}
    >
      <span className="jr-side-pro-nav-left">
        <span className="jr-side-pro-nav-icon">{icon}</span>
        <span className="jr-side-pro-nav-label">{label}</span>
      </span>

      {typeof count === "number" && (
        <span className="jr-side-pro-nav-count">{count}</span>
      )}
    </button>
  );
}

function ProgressStep({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active?: boolean;
}) {
  return (
    <div className="jr-side-pro-step">
      <span
        className={[
          "jr-side-pro-step-dot",
          done ? "jr-side-pro-step-dot-done" : "",
          active ? "jr-side-pro-step-dot-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <span>{label}</span>
    </div>
  );
}

export function Sidebar({
  cvFile,
  cvProfile,
  profileLoading,
  savedJobsCount,
  showSavedJobs,
  onToggleSavedJobs,
}: SidebarProps) {
  const hasCvFile = Boolean(cvFile);
  const hasProfile = Boolean(cvProfile);
  const hasSavedJobs = savedJobsCount > 0;

  const workspaceState = getWorkspaceState({
    cvFile,
    cvProfile,
    profileLoading,
    savedJobsCount,
  });

  const fileSize = cvFile ? formatFileSize(cvFile.size) : "";

  return (
    <>
      <style>
        {`
          .jr-side-pro,
          .jr-side-pro * {
            box-sizing: border-box;
          }

          .jr-side-pro::-webkit-scrollbar {
            width: 7px;
          }

          .jr-side-pro::-webkit-scrollbar-track {
            background: transparent;
          }

          .jr-side-pro::-webkit-scrollbar-thumb {
            background: rgba(148,163,184,0.18);
            border-radius: 999px;
          }

          .jr-side-pro-brand {
            display: flex;
            gap: 12px;
            align-items: center;
          }

          .jr-side-pro-logo {
            position: relative;
            width: 50px;
            height: 50px;
            flex: 0 0 auto;
            border-radius: 18px;
            display: grid;
            place-items: center;
            overflow: hidden;
            background:
              radial-gradient(circle at 25% 20%, rgba(255,255,255,0.24), transparent 34%),
              linear-gradient(135deg, #2563eb, #22c55e);
            box-shadow:
              0 18px 40px rgba(37,99,235,0.31),
              inset 0 1px 0 rgba(255,255,255,0.18);
          }

          .jr-side-pro-logo::after {
            content: "";
            position: absolute;
            inset: -45%;
            background: linear-gradient(
              120deg,
              transparent,
              rgba(255,255,255,0.28),
              transparent
            );
            transform: translateX(-80%) rotate(18deg);
            animation: jr-side-pro-shine 5.2s ease-in-out infinite;
          }

          .jr-side-pro-logo-text {
            position: relative;
            z-index: 1;
            font-size: 17px;
            font-weight: 950;
            letter-spacing: -0.5px;
            color: #ffffff;
          }

          .jr-side-pro-title {
            margin: 0;
            font-size: 19px;
            line-height: 1.05;
            letter-spacing: -0.45px;
            color: #f8fafc;
          }

          .jr-side-pro-subtitle {
            margin: 5px 0 0;
            font-size: 11.5px;
            color: #94a3b8;
            font-weight: 750;
          }

          .jr-side-pro-chip {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            margin-top: 13px;
            padding: 6px 9px;
            border-radius: 999px;
            background: rgba(15,23,42,0.68);
            border: 1px solid rgba(148,163,184,0.14);
            color: #cbd5e1;
            font-size: 10.5px;
            font-weight: 850;
          }

          .jr-side-pro-chip-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #22c55e;
            box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
          }

          .jr-side-pro-nav {
            margin-top: 30px;
            display: grid;
            gap: 10px;
          }

          .jr-side-pro-nav-btn {
            width: 100%;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border: 1px solid rgba(148,163,184,0.17);
            border-radius: 16px;
            padding: 11px 12px;
            color: #e2e8f0;
            background:
              linear-gradient(180deg, rgba(30,41,59,0.7), rgba(15,23,42,0.7));
            box-shadow:
              0 12px 26px rgba(0,0,0,0.12),
              inset 0 1px 0 rgba(255,255,255,0.04);
            cursor: pointer;
            font-size: 12.5px;
            font-weight: 900;
            text-align: left;
            transition:
              transform 170ms ease,
              border-color 170ms ease,
              background 170ms ease,
              box-shadow 170ms ease,
              opacity 170ms ease;
          }

          .jr-side-pro-nav-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            border-color: rgba(96,165,250,0.34);
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 40%),
              linear-gradient(180deg, rgba(30,41,59,0.88), rgba(15,23,42,0.82));
            box-shadow:
              0 18px 36px rgba(0,0,0,0.18),
              inset 0 1px 0 rgba(255,255,255,0.06);
          }

          .jr-side-pro-nav-btn:active:not(:disabled) {
            transform: translateY(0);
          }

          .jr-side-pro-nav-btn:focus-visible {
            outline: 3px solid rgba(96,165,250,0.35);
            outline-offset: 3px;
          }

          .jr-side-pro-nav-btn:disabled {
            cursor: not-allowed;
            opacity: 0.48;
          }

          .jr-side-pro-nav-btn-active {
            color: #ffffff;
            border-color: rgba(34,197,94,0.42);
            background:
              radial-gradient(circle at top left, rgba(255,255,255,0.14), transparent 35%),
              linear-gradient(135deg, #22c55e, #16a34a 58%, #15803d);
            box-shadow:
              0 18px 40px rgba(34,197,94,0.25),
              inset 0 1px 0 rgba(255,255,255,0.16);
          }

          .jr-side-pro-nav-left {
            display: flex;
            align-items: center;
            min-width: 0;
            gap: 9px;
          }

          .jr-side-pro-nav-icon {
            width: 21px;
            height: 21px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 8px;
            background: rgba(255,255,255,0.08);
            font-size: 12px;
          }

          .jr-side-pro-nav-label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .jr-side-pro-nav-count {
            min-width: 24px;
            height: 23px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            padding: 0 8px;
            background: rgba(2,6,23,0.36);
            border: 1px solid rgba(255,255,255,0.12);
            color: #f8fafc;
            font-size: 10.5px;
            font-weight: 950;
          }

          .jr-side-pro-status {
            position: relative;
            margin-top: 26px;
            padding: 15px;
            overflow: hidden;
            border-radius: 22px;
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.15), transparent 38%),
              radial-gradient(circle at bottom right, rgba(34,197,94,0.09), transparent 36%),
              linear-gradient(135deg, rgba(15,23,42,0.9), rgba(15,23,42,0.66));
            border: 1px solid rgba(148,163,184,0.16);
            box-shadow:
              0 18px 42px rgba(0,0,0,0.18),
              inset 0 1px 0 rgba(255,255,255,0.045);
          }

          .jr-side-pro-status::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              linear-gradient(135deg, rgba(255,255,255,0.06), transparent 34%),
              radial-gradient(circle at 100% 100%, rgba(34,197,94,0.08), transparent 34%);
          }

          .jr-side-pro-status-content {
            position: relative;
            z-index: 1;
          }

          .jr-side-pro-status-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 13px;
          }

          .jr-side-pro-status-label {
            color: #94a3b8;
            font-size: 10px;
            font-weight: 950;
            letter-spacing: 0.13em;
            text-transform: uppercase;
          }

          .jr-side-pro-status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 8px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 950;
            white-space: nowrap;
          }

          .jr-side-pro-status-main {
            display: flex;
            gap: 11px;
            align-items: center;
            margin-bottom: 12px;
          }

          .jr-side-pro-status-icon {
            width: 38px;
            height: 38px;
            flex: 0 0 auto;
            display: grid;
            place-items: center;
            border-radius: 15px;
            font-size: 17px;
          }

          .jr-side-pro-status-title {
            margin: 0;
            font-size: 15.5px;
            line-height: 1.15;
            letter-spacing: -0.25px;
            font-weight: 950;
          }

          .jr-side-pro-status-subtitle {
            margin: 5px 0 0;
            color: #94a3b8;
            font-size: 11.5px;
            line-height: 1.35;
            font-weight: 750;
          }

          .jr-side-pro-progress-wrap {
            margin: 13px 0 12px;
          }

          .jr-side-pro-progress-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            color: #94a3b8;
            font-size: 10.5px;
            font-weight: 900;
          }

          .jr-side-pro-progress-track {
            position: relative;
            height: 8px;
            overflow: hidden;
            border-radius: 999px;
            background: rgba(15,23,42,0.88);
            border: 1px solid rgba(148,163,184,0.1);
          }

          .jr-side-pro-progress-fill {
            height: 100%;
            border-radius: inherit;
            transition: width 280ms ease;
            box-shadow: 0 0 18px currentColor;
          }

          .jr-side-pro-next {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            padding: 9px 10px;
            border-radius: 14px;
            background: rgba(2,6,23,0.34);
            border: 1px solid rgba(148,163,184,0.11);
            color: #dbeafe;
            font-size: 11.5px;
            font-weight: 850;
          }

          .jr-side-pro-next span:first-child {
            width: 21px;
            height: 21px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 8px;
            background: rgba(96,165,250,0.13);
          }

          .jr-side-pro-file {
            display: flex;
            align-items: center;
            gap: 9px;
            margin-bottom: 12px;
            padding: 9px 10px;
            border-radius: 14px;
            background: rgba(2,6,23,0.36);
            border: 1px solid rgba(148,163,184,0.12);
            color: #cbd5e1;
            font-size: 11.5px;
            font-weight: 850;
          }

          .jr-side-pro-file-icon {
            width: 23px;
            height: 23px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 8px;
            background: rgba(96,165,250,0.14);
          }

          .jr-side-pro-file-main {
            min-width: 0;
          }

          .jr-side-pro-file-name {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #e2e8f0;
          }

          .jr-side-pro-file-size {
            display: block;
            margin-top: 2px;
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
          }

          .jr-side-pro-steps {
            display: grid;
            gap: 8px;
            padding-top: 12px;
            border-top: 1px solid rgba(148,163,184,0.11);
          }

          .jr-side-pro-step {
            display: flex;
            align-items: center;
            gap: 9px;
            color: #94a3b8;
            font-size: 11.5px;
            font-weight: 850;
          }

          .jr-side-pro-step-dot {
            width: 9px;
            height: 9px;
            flex: 0 0 auto;
            border-radius: 999px;
            background: rgba(100,116,139,0.75);
            box-shadow: 0 0 0 4px rgba(100,116,139,0.08);
          }

          .jr-side-pro-step-dot-done {
            background: #22c55e;
            box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
          }

          .jr-side-pro-step-dot-active {
            background: #facc15;
            box-shadow: 0 0 0 4px rgba(250,204,21,0.13);
            animation: jr-side-pro-pulse 1.35s ease-in-out infinite;
          }

          .jr-side-pro-stats {
            margin-top: 13px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .jr-side-pro-stat {
            padding: 10px;
            border-radius: 15px;
            background: rgba(2,6,23,0.34);
            border: 1px solid rgba(148,163,184,0.11);
          }

          .jr-side-pro-stat-value {
            margin: 0;
            color: #f8fafc;
            font-size: 16px;
            line-height: 1;
            font-weight: 950;
          }

          .jr-side-pro-stat-label {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 9.8px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .jr-side-pro-footer {
            margin-top: 30px;
            padding-top: 17px;
            border-top: 1px solid rgba(148,163,184,0.12);
          }

          .jr-side-pro-footer-card {
            padding: 12px;
            border-radius: 17px;
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.09), transparent 34%),
              rgba(15,23,42,0.45);
            border: 1px solid rgba(148,163,184,0.11);
            text-align: center;
          }

          .jr-side-pro-footer-kicker {
            margin: 0;
            color: #64748b;
            font-size: 10px;
            font-weight: 850;
          }

          .jr-side-pro-footer-name {
            margin: 5px 0 0;
            color: #e2e8f0;
            font-size: 12px;
            font-weight: 950;
          }

          @keyframes jr-side-pro-shine {
            0% {
              transform: translateX(-80%) rotate(18deg);
            }
            45% {
              transform: translateX(90%) rotate(18deg);
            }
            100% {
              transform: translateX(90%) rotate(18deg);
            }
          }

          @keyframes jr-side-pro-pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.25);
              opacity: 0.72;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .jr-side-pro-logo::after,
            .jr-side-pro-step-dot-active {
              animation: none;
            }

            .jr-side-pro-nav-btn,
            .jr-side-pro-progress-fill {
              transition: none;
            }
          }
        `}
      </style>

      <aside className="jr-side-pro" style={sidebarStyle}>
        <div>
          <header className="jr-side-pro-brand">
            <div className="jr-side-pro-logo" aria-hidden="true">
              <span className="jr-side-pro-logo-text">JR</span>
            </div>

            <div>
              <h2 className="jr-side-pro-title">JobRadar AI</h2>
              <p className="jr-side-pro-subtitle">Your AI Job Scout</p>

              <div className="jr-side-pro-chip">
                <span className="jr-side-pro-chip-dot" />
                Local workspace
              </div>
            </div>
          </header>

          <nav className="jr-side-pro-nav" aria-label="Main navigation">
            <NavButton
              icon="📊"
              label="Dashboard"
              active={!showSavedJobs}
              onClick={() => {
                if (showSavedJobs) {
                  onToggleSavedJobs();
                }
              }}
            />

            <NavButton
              icon="💾"
              label="Saved Jobs"
              count={savedJobsCount}
              active={showSavedJobs}
              disabled={!hasSavedJobs && !showSavedJobs}
              onClick={onToggleSavedJobs}
            />
          </nav>

          <section className="jr-side-pro-status">
            <div className="jr-side-pro-status-content">
              <div className="jr-side-pro-status-top">
                <span className="jr-side-pro-status-label">Workspace</span>

                <span
                  className="jr-side-pro-status-badge"
                  style={{
                    color: workspaceState.color,
                    background: workspaceState.softColor,
                    border: `1px solid ${workspaceState.borderColor}`,
                  }}
                >
                  {workspaceState.label}
                </span>
              </div>

              <div className="jr-side-pro-status-main">
                <div
                  className="jr-side-pro-status-icon"
                  style={{
                    color: workspaceState.color,
                    background: workspaceState.softColor,
                    border: `1px solid ${workspaceState.borderColor}`,
                  }}
                >
                  {workspaceState.icon}
                </div>

                <div>
                  <h3
                    className="jr-side-pro-status-title"
                    style={{ color: workspaceState.color }}
                  >
                    {workspaceState.title}
                  </h3>

                  <p className="jr-side-pro-status-subtitle">
                    {workspaceState.subtitle}
                  </p>
                </div>
              </div>

              <div className="jr-side-pro-progress-wrap">
                <div className="jr-side-pro-progress-meta">
                  <span>Session progress</span>
                  <span>{workspaceState.progress}%</span>
                </div>

                <div className="jr-side-pro-progress-track">
                  <div
                    className="jr-side-pro-progress-fill"
                    style={{
                      width: `${workspaceState.progress}%`,
                      color: workspaceState.color,
                      background: `linear-gradient(90deg, ${workspaceState.color}, rgba(96,165,250,0.85))`,
                    }}
                  />
                </div>
              </div>

              <div className="jr-side-pro-next">
                <span>→</span>
                <span>Next: {workspaceState.nextStep}</span>
              </div>

              {cvFile && (
                <div className="jr-side-pro-file" title={cvFile.name}>
                  <span className="jr-side-pro-file-icon">📄</span>

                  <span className="jr-side-pro-file-main">
                    <span className="jr-side-pro-file-name">
                      {truncateFileName(cvFile.name)}
                    </span>

                    {fileSize && (
                      <span className="jr-side-pro-file-size">{fileSize}</span>
                    )}
                  </span>
                </div>
              )}

              <div className="jr-side-pro-steps">
                <ProgressStep label="CV selected" done={hasCvFile} />
                <ProgressStep
                  label="AI profile"
                  done={hasProfile}
                  active={profileLoading}
                />
                <ProgressStep label="Saved jobs" done={hasSavedJobs} />
              </div>

              <div className="jr-side-pro-stats">
                <div className="jr-side-pro-stat">
                  <p className="jr-side-pro-stat-value">{savedJobsCount}</p>
                  <p className="jr-side-pro-stat-label">Saved</p>
                </div>

                <div className="jr-side-pro-stat">
                  <p className="jr-side-pro-stat-value">
                    {hasProfile ? "AI" : "--"}
                  </p>
                  <p className="jr-side-pro-stat-label">Profile</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="jr-side-pro-footer">
          <div className="jr-side-pro-footer-card">
            <p className="jr-side-pro-footer-kicker">Created by</p>
            <p className="jr-side-pro-footer-name">Francesco Molea</p>
          </div>
        </footer>
      </aside>
    </>
  );
}