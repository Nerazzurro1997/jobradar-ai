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
    "radial-gradient(circle at top left, rgba(37,99,235,0.18), transparent 30%), radial-gradient(circle at bottom right, rgba(34,197,94,0.1), transparent 28%), rgba(2,6,23,0.96)",
  backdropFilter: "blur(18px)",
  WebkitBackdropFilter: "blur(18px)",
  color: "white",
  padding: 24,
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
  boxShadow: "18px 0 60px rgba(0,0,0,0.22)",
};

function truncateFileName(name: string, maxLength = 24): string {
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
      subtitle: "AI profile in progress",
      color: "#facc15",
      softColor: "rgba(250,204,21,0.13)",
      borderColor: "rgba(250,204,21,0.26)",
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
      borderColor: "rgba(34,197,94,0.26)",
      icon: "✅",
    };
  }

  if (cvFile) {
    return {
      label: "CV loaded",
      title: "CV uploaded",
      subtitle: "Ready for AI analysis",
      color: "#60a5fa",
      softColor: "rgba(96,165,250,0.13)",
      borderColor: "rgba(96,165,250,0.26)",
      icon: "📄",
    };
  }

  return {
    label: "Setup",
    title: "No CV uploaded",
    subtitle: "Upload your CV to start",
    color: "#fb7185",
    softColor: "rgba(251,113,133,0.13)",
    borderColor: "rgba(251,113,133,0.26)",
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
        "jr-sidebar-nav-btn",
        active ? "jr-sidebar-nav-btn-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      onClick={disabled ? undefined : onClick}
    >
      <span className="jr-sidebar-nav-left">
        <span className="jr-sidebar-nav-icon">{icon}</span>
        <span>{label}</span>
      </span>

      {typeof count === "number" && (
        <span className="jr-sidebar-nav-count">{count}</span>
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
    <div className="jr-sidebar-step">
      <span
        className={[
          "jr-sidebar-step-dot",
          done ? "jr-sidebar-step-dot-done" : "",
          active ? "jr-sidebar-step-dot-active" : "",
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
          .jr-sidebar,
          .jr-sidebar * {
            box-sizing: border-box;
          }

          .jr-sidebar::-webkit-scrollbar {
            width: 7px;
          }

          .jr-sidebar::-webkit-scrollbar-track {
            background: transparent;
          }

          .jr-sidebar::-webkit-scrollbar-thumb {
            background: rgba(148,163,184,0.18);
            border-radius: 999px;
          }

          .jr-sidebar-brand {
            display: flex;
            gap: 14px;
            align-items: center;
          }

          .jr-sidebar-logo {
            position: relative;
            width: 56px;
            height: 56px;
            border-radius: 20px;
            display: grid;
            place-items: center;
            overflow: hidden;
            background:
              radial-gradient(circle at 25% 20%, rgba(255,255,255,0.24), transparent 32%),
              linear-gradient(135deg, #2563eb, #22c55e);
            box-shadow:
              0 18px 42px rgba(37,99,235,0.32),
              inset 0 1px 0 rgba(255,255,255,0.18);
          }

          .jr-sidebar-logo::after {
            content: "";
            position: absolute;
            inset: -40%;
            background: linear-gradient(
              120deg,
              transparent,
              rgba(255,255,255,0.26),
              transparent
            );
            transform: translateX(-70%) rotate(18deg);
            animation: jr-sidebar-shine 5s ease-in-out infinite;
          }

          .jr-sidebar-logo-text {
            position: relative;
            z-index: 1;
            font-size: 18px;
            font-weight: 950;
            letter-spacing: -0.5px;
          }

          .jr-sidebar-brand-title {
            margin: 0;
            font-size: 22px;
            line-height: 1.05;
            letter-spacing: -0.55px;
            color: #f8fafc;
          }

          .jr-sidebar-brand-subtitle {
            margin: 6px 0 0;
            font-size: 12.5px;
            color: #94a3b8;
            font-weight: 650;
          }

          .jr-sidebar-live-chip {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            margin-top: 14px;
            padding: 7px 10px;
            border-radius: 999px;
            background: rgba(15,23,42,0.72);
            border: 1px solid rgba(148,163,184,0.14);
            color: #cbd5e1;
            font-size: 11px;
            font-weight: 850;
          }

          .jr-sidebar-live-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #22c55e;
            box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
          }

          .jr-sidebar-nav {
            margin-top: 34px;
            display: grid;
            gap: 12px;
          }

          .jr-sidebar-nav-btn {
            width: 100%;
            min-height: 48px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            border: 1px solid rgba(148,163,184,0.18);
            border-radius: 18px;
            padding: 13px 14px;
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

          .jr-sidebar-nav-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            border-color: rgba(96,165,250,0.34);
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 40%),
              linear-gradient(180deg, rgba(30,41,59,0.9), rgba(15,23,42,0.82));
            box-shadow:
              0 18px 36px rgba(0,0,0,0.18),
              inset 0 1px 0 rgba(255,255,255,0.06);
          }

          .jr-sidebar-nav-btn:active:not(:disabled) {
            transform: translateY(0);
          }

          .jr-sidebar-nav-btn:focus-visible {
            outline: 3px solid rgba(96,165,250,0.35);
            outline-offset: 3px;
          }

          .jr-sidebar-nav-btn:disabled {
            cursor: not-allowed;
            opacity: 0.58;
          }

          .jr-sidebar-nav-btn-active {
            color: #ffffff;
            border-color: rgba(34,197,94,0.42);
            background:
              radial-gradient(circle at top left, rgba(255,255,255,0.14), transparent 35%),
              linear-gradient(135deg, #22c55e, #16a34a 58%, #15803d);
            box-shadow:
              0 18px 40px rgba(34,197,94,0.25),
              inset 0 1px 0 rgba(255,255,255,0.16);
          }

          .jr-sidebar-nav-left {
            display: flex;
            align-items: center;
            min-width: 0;
            gap: 10px;
          }

          .jr-sidebar-nav-icon {
            width: 22px;
            height: 22px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 9px;
            background: rgba(255,255,255,0.08);
          }

          .jr-sidebar-nav-count {
            min-width: 26px;
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

          .jr-sidebar-status-card {
            position: relative;
            margin-top: 30px;
            padding: 18px;
            overflow: hidden;
            border-radius: 24px;
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.13), transparent 36%),
              linear-gradient(135deg, rgba(15,23,42,0.86), rgba(15,23,42,0.64));
            border: 1px solid rgba(148,163,184,0.16);
            box-shadow:
              0 18px 42px rgba(0,0,0,0.18),
              inset 0 1px 0 rgba(255,255,255,0.045);
          }

          .jr-sidebar-status-card::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              linear-gradient(135deg, rgba(255,255,255,0.06), transparent 35%),
              radial-gradient(circle at bottom right, rgba(34,197,94,0.08), transparent 34%);
          }

          .jr-sidebar-status-content {
            position: relative;
            z-index: 1;
          }

          .jr-sidebar-status-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 16px;
          }

          .jr-sidebar-status-label {
            color: #94a3b8;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .jr-sidebar-status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 8px;
            border-radius: 999px;
            font-size: 10.5px;
            font-weight: 950;
            white-space: nowrap;
          }

          .jr-sidebar-status-main {
            display: flex;
            gap: 12px;
            align-items: flex-start;
            margin-bottom: 16px;
          }

          .jr-sidebar-status-icon {
            width: 42px;
            height: 42px;
            flex: 0 0 auto;
            display: grid;
            place-items: center;
            border-radius: 16px;
            font-size: 18px;
          }

          .jr-sidebar-status-title {
            margin: 0;
            font-size: 17px;
            line-height: 1.15;
            letter-spacing: -0.25px;
            font-weight: 950;
          }

          .jr-sidebar-status-subtitle {
            margin: 6px 0 0;
            color: #94a3b8;
            font-size: 12.5px;
            line-height: 1.35;
            font-weight: 650;
          }

          .jr-sidebar-file-chip {
            display: flex;
            align-items: center;
            gap: 9px;
            margin-bottom: 14px;
            padding: 10px 11px;
            border-radius: 16px;
            background: rgba(2,6,23,0.36);
            border: 1px solid rgba(148,163,184,0.12);
            color: #cbd5e1;
            font-size: 12px;
            font-weight: 800;
          }

          .jr-sidebar-file-icon {
            width: 24px;
            height: 24px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 9px;
            background: rgba(96,165,250,0.14);
          }

          .jr-sidebar-steps {
            display: grid;
            gap: 9px;
            padding-top: 14px;
            border-top: 1px solid rgba(148,163,184,0.11);
          }

          .jr-sidebar-step {
            display: flex;
            align-items: center;
            gap: 9px;
            color: #94a3b8;
            font-size: 12px;
            font-weight: 800;
          }

          .jr-sidebar-step-dot {
            width: 9px;
            height: 9px;
            flex: 0 0 auto;
            border-radius: 999px;
            background: rgba(100,116,139,0.75);
            box-shadow: 0 0 0 4px rgba(100,116,139,0.08);
          }

          .jr-sidebar-step-dot-done {
            background: #22c55e;
            box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
          }

          .jr-sidebar-step-dot-active {
            background: #facc15;
            box-shadow: 0 0 0 4px rgba(250,204,21,0.13);
            animation: jr-sidebar-pulse 1.35s ease-in-out infinite;
          }

          .jr-sidebar-mini-stats {
            margin-top: 16px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
          }

          .jr-sidebar-mini-stat {
            padding: 12px;
            border-radius: 17px;
            background: rgba(2,6,23,0.34);
            border: 1px solid rgba(148,163,184,0.11);
          }

          .jr-sidebar-mini-stat-value {
            margin: 0;
            color: #f8fafc;
            font-size: 18px;
            line-height: 1;
            font-weight: 950;
          }

          .jr-sidebar-mini-stat-label {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 10.5px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .jr-sidebar-footer {
            margin-top: 34px;
            padding-top: 18px;
            border-top: 1px solid rgba(148,163,184,0.12);
          }

          .jr-sidebar-footer-card {
            padding: 14px;
            border-radius: 20px;
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.1), transparent 34%),
              rgba(15,23,42,0.5);
            border: 1px solid rgba(148,163,184,0.12);
            text-align: center;
          }

          .jr-sidebar-footer-kicker {
            margin: 0;
            color: #64748b;
            font-size: 11px;
            font-weight: 800;
          }

          .jr-sidebar-footer-name {
            margin: 5px 0 0;
            color: #e2e8f0;
            font-size: 13px;
            font-weight: 950;
          }

          .jr-sidebar-footer-note {
            margin: 10px 0 0;
            color: #64748b;
            font-size: 10.5px;
            line-height: 1.35;
            font-weight: 750;
          }

          @keyframes jr-sidebar-shine {
            0% {
              transform: translateX(-78%) rotate(18deg);
            }
            45% {
              transform: translateX(90%) rotate(18deg);
            }
            100% {
              transform: translateX(90%) rotate(18deg);
            }
          }

          @keyframes jr-sidebar-pulse {
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
            .jr-sidebar-logo::after,
            .jr-sidebar-step-dot-active {
              animation: none;
            }

            .jr-sidebar-nav-btn {
              transition: none;
            }
          }
        `}
      </style>

      <aside className="jr-sidebar" style={sidebarStyle}>
        <div>
          <header className="jr-sidebar-brand">
            <div className="jr-sidebar-logo" aria-hidden="true">
              <span className="jr-sidebar-logo-text">JR</span>
            </div>

            <div>
              <h2 className="jr-sidebar-brand-title">JobRadar AI</h2>
              <p className="jr-sidebar-brand-subtitle">Your AI Job Scout</p>

              <div className="jr-sidebar-live-chip">
                <span className="jr-sidebar-live-dot" />
                Local workspace
              </div>
            </div>
          </header>

          <nav className="jr-sidebar-nav" aria-label="Main navigation">
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

          <section className="jr-sidebar-status-card">
            <div className="jr-sidebar-status-content">
              <div className="jr-sidebar-status-top">
                <span className="jr-sidebar-status-label">Workspace</span>

                <span
                  className="jr-sidebar-status-badge"
                  style={{
                    color: status.color,
                    background: status.softColor,
                    border: `1px solid ${status.borderColor}`,
                  }}
                >
                  {status.label}
                </span>
              </div>

              <div className="jr-sidebar-status-main">
                <div
                  className="jr-sidebar-status-icon"
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
                    className="jr-sidebar-status-title"
                    style={{ color: status.color }}
                  >
                    {status.title}
                  </h3>

                  <p className="jr-sidebar-status-subtitle">
                    {status.subtitle}
                  </p>
                </div>
              </div>

              {cvFile && (
                <div className="jr-sidebar-file-chip" title={cvFile.name}>
                  <span className="jr-sidebar-file-icon">📄</span>
                  <span>{truncateFileName(cvFile.name)}</span>
                </div>
              )}

              <div className="jr-sidebar-steps">
                <StatusStep label="CV selected" done={hasCvFile} />
                <StatusStep
                  label="Profile analyzed"
                  done={hasProfile}
                  active={profileLoading}
                />
                <StatusStep label="Saved jobs available" done={savedJobsCount > 0} />
              </div>

              <div className="jr-sidebar-mini-stats">
                <div className="jr-sidebar-mini-stat">
                  <p className="jr-sidebar-mini-stat-value">
                    {savedJobsCount}
                  </p>
                  <p className="jr-sidebar-mini-stat-label">Saved</p>
                </div>

                <div className="jr-sidebar-mini-stat">
                  <p className="jr-sidebar-mini-stat-value">
                    {hasProfile ? "AI" : "--"}
                  </p>
                  <p className="jr-sidebar-mini-stat-label">Profile</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="jr-sidebar-footer">
          <div className="jr-sidebar-footer-card">
            <p className="jr-sidebar-footer-kicker">Created by</p>
            <p className="jr-sidebar-footer-name">Francesco Molea</p>
            <p className="jr-sidebar-footer-note">
              Built for smarter job matching.
            </p>
          </div>
        </footer>
      </aside>
    </>
  );
}