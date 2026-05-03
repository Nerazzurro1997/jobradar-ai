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

const SIDEBAR_WIDTH = 260;

const sidebarStyle: CSSProperties = {
  width: SIDEBAR_WIDTH,
  background:
    "radial-gradient(circle at top left, rgba(37,99,235,0.2), transparent 32%), radial-gradient(circle at bottom right, rgba(34,197,94,0.11), transparent 30%), rgba(2,6,23,0.97)",
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

function truncateFileName(name: string, maxLength = 22): string {
  if (name.length <= maxLength) return name;

  const extensionIndex = name.lastIndexOf(".");
  const extension = extensionIndex > -1 ? name.slice(extensionIndex) : "";
  const baseName = extensionIndex > -1 ? name.slice(0, extensionIndex) : name;

  const visibleLength = Math.max(maxLength - extension.length - 4, 8);

  return `${baseName.slice(0, visibleLength)}...${extension}`;
}

function getWorkspaceStatus({
  cvFile,
  cvProfile,
  profileLoading,
}: {
  cvFile: File | null;
  cvProfile: unknown;
  profileLoading: boolean;
}) {
  if (profileLoading) {
    return {
      label: "Analyzing",
      title: "Analyzing CV",
      subtitle: "Building your AI profile",
      color: "#facc15",
      softColor: "rgba(250,204,21,0.13)",
      borderColor: "rgba(250,204,21,0.28)",
      icon: "⏳",
    };
  }

  if (cvProfile) {
    return {
      label: "Ready",
      title: "Profile ready",
      subtitle: "Matching signals active",
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
        "jr-side-v2-nav-btn",
        active ? "jr-side-v2-nav-btn-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      onClick={disabled ? undefined : onClick}
    >
      <span className="jr-side-v2-nav-left">
        <span className="jr-side-v2-nav-icon">{icon}</span>
        <span className="jr-side-v2-nav-label">{label}</span>
      </span>

      {typeof count === "number" && (
        <span className="jr-side-v2-nav-count">{count}</span>
      )}
    </button>
  );
}

function StatusStep({
  label,
  done,
  active,
}: {
  label: string;
  done: boolean;
  active?: boolean;
}) {
  return (
    <div className="jr-side-v2-step">
      <span
        className={[
          "jr-side-v2-step-dot",
          done ? "jr-side-v2-step-dot-done" : "",
          active ? "jr-side-v2-step-dot-active" : "",
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
  const status = getWorkspaceStatus({ cvFile, cvProfile, profileLoading });

  return (
    <>
      <style>
        {`
          .jr-side-v2,
          .jr-side-v2 * {
            box-sizing: border-box;
          }

          .jr-side-v2::-webkit-scrollbar {
            width: 7px;
          }

          .jr-side-v2::-webkit-scrollbar-track {
            background: transparent;
          }

          .jr-side-v2::-webkit-scrollbar-thumb {
            background: rgba(148,163,184,0.18);
            border-radius: 999px;
          }

          .jr-side-v2-brand {
            display: flex;
            gap: 13px;
            align-items: center;
          }

          .jr-side-v2-logo {
            position: relative;
            width: 52px;
            height: 52px;
            flex: 0 0 auto;
            border-radius: 19px;
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

          .jr-side-v2-logo::after {
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
            animation: jr-side-v2-shine 5.2s ease-in-out infinite;
          }

          .jr-side-v2-logo-text {
            position: relative;
            z-index: 1;
            font-size: 17px;
            font-weight: 950;
            letter-spacing: -0.5px;
            color: #ffffff;
          }

          .jr-side-v2-title {
            margin: 0;
            font-size: 20px;
            line-height: 1.05;
            letter-spacing: -0.5px;
            color: #f8fafc;
          }

          .jr-side-v2-subtitle {
            margin: 6px 0 0;
            font-size: 12px;
            color: #94a3b8;
            font-weight: 700;
          }

          .jr-side-v2-chip {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            margin-top: 14px;
            padding: 7px 10px;
            border-radius: 999px;
            background: rgba(15,23,42,0.68);
            border: 1px solid rgba(148,163,184,0.14);
            color: #cbd5e1;
            font-size: 11px;
            font-weight: 850;
          }

          .jr-side-v2-chip-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #22c55e;
            box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
          }

          .jr-side-v2-nav {
            margin-top: 32px;
            display: grid;
            gap: 11px;
          }

          .jr-side-v2-nav-btn {
            width: 100%;
            min-height: 46px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            border: 1px solid rgba(148,163,184,0.18);
            border-radius: 17px;
            padding: 12px 13px;
            color: #e2e8f0;
            background:
              linear-gradient(180deg, rgba(30,41,59,0.72), rgba(15,23,42,0.72));
            box-shadow:
              0 12px 26px rgba(0,0,0,0.12),
              inset 0 1px 0 rgba(255,255,255,0.04);
            cursor: pointer;
            font-size: 13px;
            font-weight: 900;
            text-align: left;
            transition:
              transform 170ms ease,
              border-color 170ms ease,
              background 170ms ease,
              box-shadow 170ms ease,
              opacity 170ms ease;
          }

          .jr-side-v2-nav-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            border-color: rgba(96,165,250,0.34);
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 40%),
              linear-gradient(180deg, rgba(30,41,59,0.9), rgba(15,23,42,0.82));
            box-shadow:
              0 18px 36px rgba(0,0,0,0.18),
              inset 0 1px 0 rgba(255,255,255,0.06);
          }

          .jr-side-v2-nav-btn:active:not(:disabled) {
            transform: translateY(0);
          }

          .jr-side-v2-nav-btn:focus-visible {
            outline: 3px solid rgba(96,165,250,0.35);
            outline-offset: 3px;
          }

          .jr-side-v2-nav-btn:disabled {
            cursor: not-allowed;
            opacity: 0.5;
          }

          .jr-side-v2-nav-btn-active {
            color: #ffffff;
            border-color: rgba(34,197,94,0.42);
            background:
              radial-gradient(circle at top left, rgba(255,255,255,0.14), transparent 35%),
              linear-gradient(135deg, #22c55e, #16a34a 58%, #15803d);
            box-shadow:
              0 18px 40px rgba(34,197,94,0.25),
              inset 0 1px 0 rgba(255,255,255,0.16);
          }

          .jr-side-v2-nav-left {
            display: flex;
            align-items: center;
            min-width: 0;
            gap: 10px;
          }

          .jr-side-v2-nav-icon {
            width: 22px;
            height: 22px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 9px;
            background: rgba(255,255,255,0.08);
            font-size: 13px;
          }

          .jr-side-v2-nav-label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .jr-side-v2-nav-count {
            min-width: 25px;
            height: 24px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            padding: 0 8px;
            background: rgba(2,6,23,0.36);
            border: 1px solid rgba(255,255,255,0.12);
            color: #f8fafc;
            font-size: 11px;
            font-weight: 950;
          }

          .jr-side-v2-status {
            position: relative;
            margin-top: 28px;
            padding: 16px;
            overflow: hidden;
            border-radius: 23px;
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.15), transparent 38%),
              radial-gradient(circle at bottom right, rgba(34,197,94,0.08), transparent 36%),
              linear-gradient(135deg, rgba(15,23,42,0.88), rgba(15,23,42,0.64));
            border: 1px solid rgba(148,163,184,0.16);
            box-shadow:
              0 18px 42px rgba(0,0,0,0.18),
              inset 0 1px 0 rgba(255,255,255,0.045);
          }

          .jr-side-v2-status::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              linear-gradient(135deg, rgba(255,255,255,0.06), transparent 34%),
              radial-gradient(circle at 100% 100%, rgba(34,197,94,0.08), transparent 34%);
          }

          .jr-side-v2-status-content {
            position: relative;
            z-index: 1;
          }

          .jr-side-v2-status-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 14px;
          }

          .jr-side-v2-status-label {
            color: #94a3b8;
            font-size: 10.5px;
            font-weight: 950;
            letter-spacing: 0.13em;
            text-transform: uppercase;
          }

          .jr-side-v2-status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 8px;
            border-radius: 999px;
            font-size: 10.5px;
            font-weight: 950;
            white-space: nowrap;
          }

          .jr-side-v2-status-main {
            display: flex;
            gap: 11px;
            align-items: center;
            margin-bottom: 14px;
          }

          .jr-side-v2-status-icon {
            width: 38px;
            height: 38px;
            flex: 0 0 auto;
            display: grid;
            place-items: center;
            border-radius: 15px;
            font-size: 17px;
          }

          .jr-side-v2-status-title {
            margin: 0;
            font-size: 16px;
            line-height: 1.15;
            letter-spacing: -0.25px;
            font-weight: 950;
          }

          .jr-side-v2-status-subtitle {
            margin: 5px 0 0;
            color: #94a3b8;
            font-size: 12px;
            line-height: 1.35;
            font-weight: 700;
          }

          .jr-side-v2-file {
            display: flex;
            align-items: center;
            gap: 9px;
            margin-bottom: 13px;
            padding: 9px 10px;
            border-radius: 15px;
            background: rgba(2,6,23,0.36);
            border: 1px solid rgba(148,163,184,0.12);
            color: #cbd5e1;
            font-size: 11.5px;
            font-weight: 850;
          }

          .jr-side-v2-file-icon {
            width: 23px;
            height: 23px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 8px;
            background: rgba(96,165,250,0.14);
          }

          .jr-side-v2-steps {
            display: grid;
            gap: 8px;
            padding-top: 13px;
            border-top: 1px solid rgba(148,163,184,0.11);
          }

          .jr-side-v2-step {
            display: flex;
            align-items: center;
            gap: 9px;
            color: #94a3b8;
            font-size: 11.8px;
            font-weight: 850;
          }

          .jr-side-v2-step-dot {
            width: 9px;
            height: 9px;
            flex: 0 0 auto;
            border-radius: 999px;
            background: rgba(100,116,139,0.75);
            box-shadow: 0 0 0 4px rgba(100,116,139,0.08);
          }

          .jr-side-v2-step-dot-done {
            background: #22c55e;
            box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
          }

          .jr-side-v2-step-dot-active {
            background: #facc15;
            box-shadow: 0 0 0 4px rgba(250,204,21,0.13);
            animation: jr-side-v2-pulse 1.35s ease-in-out infinite;
          }

          .jr-side-v2-stats {
            margin-top: 14px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .jr-side-v2-stat {
            padding: 11px;
            border-radius: 16px;
            background: rgba(2,6,23,0.34);
            border: 1px solid rgba(148,163,184,0.11);
          }

          .jr-side-v2-stat-value {
            margin: 0;
            color: #f8fafc;
            font-size: 17px;
            line-height: 1;
            font-weight: 950;
          }

          .jr-side-v2-stat-label {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 10px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .jr-side-v2-footer {
            margin-top: 32px;
            padding-top: 18px;
            border-top: 1px solid rgba(148,163,184,0.12);
          }

          .jr-side-v2-footer-card {
            padding: 13px;
            border-radius: 18px;
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.09), transparent 34%),
              rgba(15,23,42,0.45);
            border: 1px solid rgba(148,163,184,0.11);
            text-align: center;
          }

          .jr-side-v2-footer-kicker {
            margin: 0;
            color: #64748b;
            font-size: 10.5px;
            font-weight: 850;
          }

          .jr-side-v2-footer-name {
            margin: 5px 0 0;
            color: #e2e8f0;
            font-size: 12.5px;
            font-weight: 950;
          }

          @keyframes jr-side-v2-shine {
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

          @keyframes jr-side-v2-pulse {
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
            .jr-side-v2-logo::after,
            .jr-side-v2-step-dot-active {
              animation: none;
            }

            .jr-side-v2-nav-btn {
              transition: none;
            }
          }
        `}
      </style>

      <aside className="jr-side-v2" style={sidebarStyle}>
        <div>
          <header className="jr-side-v2-brand">
            <div className="jr-side-v2-logo" aria-hidden="true">
              <span className="jr-side-v2-logo-text">JR</span>
            </div>

            <div>
              <h2 className="jr-side-v2-title">JobRadar AI</h2>
              <p className="jr-side-v2-subtitle">Your AI Job Scout</p>

              <div className="jr-side-v2-chip">
                <span className="jr-side-v2-chip-dot" />
                Local workspace
              </div>
            </div>
          </header>

          <nav className="jr-side-v2-nav" aria-label="Main navigation">
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
              disabled={savedJobsCount === 0 && !showSavedJobs}
              onClick={onToggleSavedJobs}
            />
          </nav>

          <section className="jr-side-v2-status">
            <div className="jr-side-v2-status-content">
              <div className="jr-side-v2-status-top">
                <span className="jr-side-v2-status-label">Workspace</span>

                <span
                  className="jr-side-v2-status-badge"
                  style={{
                    color: status.color,
                    background: status.softColor,
                    border: `1px solid ${status.borderColor}`,
                  }}
                >
                  {status.label}
                </span>
              </div>

              <div className="jr-side-v2-status-main">
                <div
                  className="jr-side-v2-status-icon"
                  style={{
                    color: status.color,
                    background: status.softColor,
                    border: `1px solid ${status.borderColor}`,
                  }}
                >
                  {status.icon}
                </div>

                <div>
                  <h3
                    className="jr-side-v2-status-title"
                    style={{ color: status.color }}
                  >
                    {status.title}
                  </h3>

                  <p className="jr-side-v2-status-subtitle">
                    {status.subtitle}
                  </p>
                </div>
              </div>

              {cvFile && (
                <div className="jr-side-v2-file" title={cvFile.name}>
                  <span className="jr-side-v2-file-icon">📄</span>
                  <span>{truncateFileName(cvFile.name)}</span>
                </div>
              )}

              <div className="jr-side-v2-steps">
                <StatusStep label="CV selected" done={hasCvFile} />
                <StatusStep
                  label="AI profile"
                  done={hasProfile}
                  active={profileLoading}
                />
                <StatusStep label="Saved jobs" done={savedJobsCount > 0} />
              </div>

              <div className="jr-side-v2-stats">
                <div className="jr-side-v2-stat">
                  <p className="jr-side-v2-stat-value">{savedJobsCount}</p>
                  <p className="jr-side-v2-stat-label">Saved</p>
                </div>

                <div className="jr-side-v2-stat">
                  <p className="jr-side-v2-stat-value">
                    {hasProfile ? "AI" : "--"}
                  </p>
                  <p className="jr-side-v2-stat-label">Profile</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="jr-side-v2-footer">
          <div className="jr-side-v2-footer-card">
            <p className="jr-side-v2-footer-kicker">Created by</p>
            <p className="jr-side-v2-footer-name">Francesco Molea</p>
          </div>
        </footer>
      </aside>
    </>
  );
}