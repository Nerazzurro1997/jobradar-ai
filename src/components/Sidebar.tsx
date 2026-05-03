import { useEffect, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";

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
  description: string;
  count?: number;
  active?: boolean;
  disabled?: boolean;
  variant: "dashboard" | "saved";
  onClick?: () => void;
};

type WorkspaceVariant =
  | "setup"
  | "cv-loaded"
  | "analyzing"
  | "ready"
  | "active";

type WorkspaceState = {
  variant: WorkspaceVariant;
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

type CssVars = CSSProperties & Record<string, string | number>;

const SIDEBAR_WIDTH = 260;

const sidebarStyle: CSSProperties = {
  width: SIDEBAR_WIDTH,
  background:
    "radial-gradient(circle at top left, rgba(37,99,235,0.24), transparent 34%), radial-gradient(circle at bottom right, rgba(20,184,166,0.14), transparent 30%), rgba(2,6,23,0.97)",
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
      variant: "analyzing",
      label: "Analyzing",
      title: "Analyzing CV",
      subtitle: "Building your AI profile",
      nextStep: "Wait for profile analysis",
      progress: 62,
      color: "#facc15",
      softColor: "rgba(250,204,21,0.14)",
      borderColor: "rgba(250,204,21,0.3)",
      icon: "⏳",
    };
  }

  if (cvProfile && savedJobsCount > 0) {
    return {
      variant: "active",
      label: "Active",
      title: "Radar active",
      subtitle: `${savedJobsCount} saved job${savedJobsCount === 1 ? "" : "s"}`,
      nextStep: "Review your best matches",
      progress: 100,
      color: "#22c55e",
      softColor: "rgba(34,197,94,0.14)",
      borderColor: "rgba(34,197,94,0.3)",
      icon: "⚡",
    };
  }

  if (cvProfile) {
    return {
      variant: "ready",
      label: "Ready",
      title: "Profile ready",
      subtitle: "Matching signals active",
      nextStep: "Search jobs",
      progress: 86,
      color: "#22c55e",
      softColor: "rgba(34,197,94,0.14)",
      borderColor: "rgba(34,197,94,0.3)",
      icon: "✅",
    };
  }

  if (cvFile) {
    return {
      variant: "cv-loaded",
      label: "CV loaded",
      title: "CV uploaded",
      subtitle: "Analyze profile next",
      nextStep: "Analyze CV",
      progress: 44,
      color: "#60a5fa",
      softColor: "rgba(96,165,250,0.14)",
      borderColor: "rgba(96,165,250,0.3)",
      icon: "📄",
    };
  }

  return {
    variant: "setup",
    label: "Setup",
    title: "No CV yet",
    subtitle: "Upload your CV to start",
    nextStep: "Upload CV",
    progress: 12,
    color: "#fb7185",
    softColor: "rgba(251,113,133,0.14)",
    borderColor: "rgba(251,113,133,0.3)",
    icon: "⚠️",
  };
}

function AnimatedNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const previousValueRef = useRef(value);

  useEffect(() => {
    const from = previousValueRef.current;
    const to = value;

    previousValueRef.current = value;

    if (from === to) {
      setDisplayValue(to);
      return;
    }

    if (typeof window === "undefined") {
      setDisplayValue(to);
      return;
    }

    let frameId = 0;
    const start = window.performance.now();
    const duration = 560;

    function tick(now: number) {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const nextValue = Math.round(from + (to - from) * eased);

      setDisplayValue(nextValue);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    frameId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [value]);

  return <>{displayValue}</>;
}

function NavButton({
  icon,
  label,
  description,
  count,
  active = false,
  disabled = false,
  variant,
  onClick,
}: NavButtonProps) {
  return (
    <button
      type="button"
      className={[
        "jr-wow-nav-card",
        `jr-wow-nav-card-${variant}`,
        active ? "jr-wow-nav-card-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      onClick={disabled ? undefined : onClick}
    >
      <span className="jr-wow-nav-card-orb" aria-hidden="true" />
      <span className="jr-wow-nav-card-shine" aria-hidden="true" />

      <span className="jr-wow-nav-card-left">
        <span className="jr-wow-nav-card-icon">
          <span className="jr-wow-nav-card-icon-core">{icon}</span>
        </span>

        <span className="jr-wow-nav-card-copy">
          <span className="jr-wow-nav-card-title">{label}</span>
          <span className="jr-wow-nav-card-description">{description}</span>
        </span>
      </span>

      <span className="jr-wow-nav-card-right">
        {active && <span className="jr-wow-nav-card-active-dot" />}

        {typeof count === "number" && (
          <span className="jr-wow-nav-card-count">
            <AnimatedNumber value={count} />
          </span>
        )}
      </span>
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
    <div className="jr-wow-step">
      <span
        className={[
          "jr-wow-step-dot",
          done ? "jr-wow-step-dot-done" : "",
          active ? "jr-wow-step-dot-active" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      />
      <span>{label}</span>
    </div>
  );
}

function WorkspaceOrb({ state }: { state: WorkspaceState }) {
  return (
    <div
      className={["jr-wow-orb", `jr-wow-orb-${state.variant}`].join(" ")}
      style={
        {
          "--jr-state-color": state.color,
          "--jr-state-soft": state.softColor,
          "--jr-state-border": state.borderColor,
        } as CssVars
      }
    >
      <span className="jr-wow-orb-ring jr-wow-orb-ring-one" />
      <span className="jr-wow-orb-ring jr-wow-orb-ring-two" />
      <span className="jr-wow-orb-sweep" />
      <span className="jr-wow-orb-ping" />
      <span className="jr-wow-orb-icon">{state.icon}</span>
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
  const [spotlight, setSpotlight] = useState({
    x: 0,
    y: 0,
    active: false,
  });

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
  const stateKey = workspaceState.variant;

  function handleMouseMove(event: MouseEvent<HTMLElement>) {
    const rect = event.currentTarget.getBoundingClientRect();

    setSpotlight({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
      active: true,
    });
  }

  function handleMouseLeave() {
    setSpotlight((current) => ({
      ...current,
      active: false,
    }));
  }

  return (
    <>
      <style>
        {`
          .jr-wow,
          .jr-wow * {
            box-sizing: border-box;
          }

          .jr-wow {
            isolation: isolate;
            animation: jr-wow-shell-in 380ms cubic-bezier(0.16, 1, 0.3, 1);
          }

          .jr-wow::before {
            content: "";
            position: absolute;
            inset: 0;
            z-index: 0;
            pointer-events: none;
            background:
              radial-gradient(
                circle at var(--jr-mouse-x) var(--jr-mouse-y),
                rgba(96,165,250,0.18),
                rgba(34,197,94,0.08) 18%,
                transparent 42%
              );
            opacity: var(--jr-mouse-opacity);
            transition: opacity 180ms ease;
          }

          .jr-wow::after {
            content: "";
            position: absolute;
            top: 0;
            right: -1px;
            bottom: 0;
            z-index: 0;
            width: 1px;
            background: linear-gradient(
              180deg,
              transparent,
              rgba(96,165,250,0.42),
              rgba(34,197,94,0.32),
              transparent
            );
            opacity: 0.72;
            animation: jr-wow-edge-flow 5.6s ease-in-out infinite;
          }

          .jr-wow > * {
            position: relative;
            z-index: 1;
          }

          .jr-wow::-webkit-scrollbar {
            width: 7px;
          }

          .jr-wow::-webkit-scrollbar-track {
            background: transparent;
          }

          .jr-wow::-webkit-scrollbar-thumb {
            background: rgba(148,163,184,0.18);
            border-radius: 999px;
          }

          .jr-wow-brand {
            display: flex;
            gap: 12px;
            align-items: center;
          }

          .jr-wow-logo {
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

          .jr-wow-logo::before {
            content: "";
            position: absolute;
            inset: -2px;
            border-radius: inherit;
            background: linear-gradient(135deg, rgba(96,165,250,0.8), rgba(34,197,94,0.55));
            opacity: 0.28;
            filter: blur(10px);
            animation: jr-wow-logo-breathe 3.8s ease-in-out infinite;
          }

          .jr-wow-logo::after {
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
            animation: jr-wow-shine 5.2s ease-in-out infinite;
          }

          .jr-wow-logo-orbit {
            position: absolute;
            inset: 5px;
            border-radius: inherit;
            border: 1px solid rgba(255,255,255,0.13);
            animation: jr-wow-logo-orbit 6s linear infinite;
          }

          .jr-wow-logo-orbit::before,
          .jr-wow-logo-orbit::after {
            content: "";
            position: absolute;
            width: 5px;
            height: 5px;
            border-radius: 999px;
            background: #ffffff;
            box-shadow: 0 0 10px rgba(255,255,255,0.55);
          }

          .jr-wow-logo-orbit::before {
            top: -3px;
            left: 50%;
          }

          .jr-wow-logo-orbit::after {
            right: -3px;
            top: 52%;
            opacity: 0.72;
          }

          .jr-wow-logo-text {
            position: relative;
            z-index: 1;
            font-size: 17px;
            font-weight: 950;
            letter-spacing: -0.5px;
            color: #ffffff;
          }

          .jr-wow-title {
            margin: 0;
            font-size: 19px;
            line-height: 1.05;
            letter-spacing: -0.45px;
            color: #f8fafc;
          }

          .jr-wow-subtitle {
            margin: 5px 0 0;
            font-size: 11.5px;
            color: #94a3b8;
            font-weight: 750;
          }

          .jr-wow-chip {
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
            box-shadow: inset 0 1px 0 rgba(255,255,255,0.04);
          }

          .jr-wow-chip-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #22c55e;
            box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
            animation: jr-wow-dot-pulse 2.4s ease-in-out infinite;
          }

          .jr-wow-nav {
            margin-top: 32px;
            display: grid;
            gap: 12px;
          }

          .jr-wow-nav-card {
            position: relative;
            width: 100%;
            min-height: 72px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            overflow: hidden;
            border: 1px solid rgba(148,163,184,0.17);
            border-radius: 22px;
            padding: 13px 14px;
            color: #e2e8f0;
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.08), transparent 42%),
              linear-gradient(180deg, rgba(30,41,59,0.72), rgba(15,23,42,0.72));
            box-shadow:
              0 14px 30px rgba(0,0,0,0.14),
              inset 0 1px 0 rgba(255,255,255,0.045);
            cursor: pointer;
            text-align: left;
            transition:
              transform 180ms ease,
              border-color 180ms ease,
              background 180ms ease,
              box-shadow 180ms ease,
              opacity 180ms ease;
          }

          .jr-wow-nav-card::before {
            content: "";
            position: absolute;
            inset: 0;
            background:
              linear-gradient(135deg, rgba(255,255,255,0.08), transparent 32%),
              radial-gradient(circle at 90% 15%, rgba(96,165,250,0.16), transparent 32%);
            opacity: 0;
            transition: opacity 180ms ease;
            pointer-events: none;
          }

          .jr-wow-nav-card-orb {
            position: absolute;
            right: -36px;
            top: -42px;
            width: 100px;
            height: 100px;
            border-radius: 999px;
            background: rgba(96,165,250,0.12);
            filter: blur(14px);
            opacity: 0.5;
            transform: scale(0.92);
            transition: opacity 180ms ease, transform 180ms ease;
            pointer-events: none;
          }

          .jr-wow-nav-card-shine {
            position: absolute;
            inset: 0;
            background: linear-gradient(
              120deg,
              transparent 20%,
              rgba(255,255,255,0.12),
              transparent 80%
            );
            transform: translateX(-120%);
            opacity: 0;
            pointer-events: none;
          }

          .jr-wow-nav-card:hover:not(:disabled) {
            transform: translateY(-2px);
            border-color: rgba(96,165,250,0.34);
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 44%),
              linear-gradient(180deg, rgba(30,41,59,0.9), rgba(15,23,42,0.84));
            box-shadow:
              0 22px 44px rgba(0,0,0,0.22),
              inset 0 1px 0 rgba(255,255,255,0.07);
          }

          .jr-wow-nav-card:hover:not(:disabled)::before {
            opacity: 1;
          }

          .jr-wow-nav-card:hover:not(:disabled) .jr-wow-nav-card-orb {
            opacity: 0.9;
            transform: scale(1.08);
          }

          .jr-wow-nav-card:hover:not(:disabled) .jr-wow-nav-card-shine {
            opacity: 1;
            animation: jr-wow-nav-shimmer 900ms ease;
          }

          .jr-wow-nav-card:active:not(:disabled) {
            transform: translateY(0);
          }

          .jr-wow-nav-card:focus-visible {
            outline: 3px solid rgba(96,165,250,0.35);
            outline-offset: 3px;
          }

          .jr-wow-nav-card:disabled {
            cursor: not-allowed;
            opacity: 0.52;
          }

          .jr-wow-nav-card-dashboard.jr-wow-nav-card-active {
            color: #ffffff;
            border-color: rgba(34,197,94,0.48);
            background:
              radial-gradient(circle at 20% 10%, rgba(255,255,255,0.16), transparent 32%),
              radial-gradient(circle at 92% 15%, rgba(187,247,208,0.28), transparent 34%),
              linear-gradient(135deg, #22c55e, #16a34a 55%, #15803d);
            box-shadow:
              0 22px 48px rgba(34,197,94,0.28),
              inset 0 1px 0 rgba(255,255,255,0.18);
          }

          .jr-wow-nav-card-saved.jr-wow-nav-card-active {
            color: #ffffff;
            border-color: rgba(96,165,250,0.48);
            background:
              radial-gradient(circle at 20% 10%, rgba(255,255,255,0.15), transparent 32%),
              radial-gradient(circle at 92% 15%, rgba(147,197,253,0.28), transparent 34%),
              linear-gradient(135deg, #2563eb, #1d4ed8 55%, #1e3a8a);
            box-shadow:
              0 22px 48px rgba(37,99,235,0.3),
              inset 0 1px 0 rgba(255,255,255,0.18);
          }

          .jr-wow-nav-card-active::after {
            content: "";
            position: absolute;
            inset: -1px;
            border-radius: inherit;
            border: 1px solid rgba(255,255,255,0.22);
            opacity: 0.72;
            animation: jr-wow-active-glow 2.8s ease-in-out infinite;
            pointer-events: none;
          }

          .jr-wow-nav-card-active .jr-wow-nav-card-orb {
            opacity: 1;
            transform: scale(1.16);
            filter: blur(12px);
          }

          .jr-wow-nav-card-dashboard.jr-wow-nav-card-active .jr-wow-nav-card-orb {
            background: rgba(187,247,208,0.28);
          }

          .jr-wow-nav-card-saved.jr-wow-nav-card-active .jr-wow-nav-card-orb {
            background: rgba(147,197,253,0.3);
          }

          .jr-wow-nav-card-left {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            min-width: 0;
            gap: 12px;
          }

          .jr-wow-nav-card-icon {
            position: relative;
            width: 38px;
            height: 38px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 15px;
            background:
              radial-gradient(circle at 30% 20%, rgba(255,255,255,0.16), transparent 34%),
              rgba(15,23,42,0.42);
            border: 1px solid rgba(255,255,255,0.12);
            box-shadow:
              0 12px 24px rgba(0,0,0,0.18),
              inset 0 1px 0 rgba(255,255,255,0.08);
          }

          .jr-wow-nav-card-icon::before {
            content: "";
            position: absolute;
            inset: -4px;
            border-radius: 18px;
            border: 1px solid rgba(255,255,255,0.12);
            opacity: 0;
            transform: scale(0.92);
            transition: opacity 180ms ease, transform 180ms ease;
          }

          .jr-wow-nav-card:hover:not(:disabled) .jr-wow-nav-card-icon::before,
          .jr-wow-nav-card-active .jr-wow-nav-card-icon::before {
            opacity: 1;
            transform: scale(1);
          }

          .jr-wow-nav-card-icon-core {
            position: relative;
            z-index: 1;
            font-size: 18px;
            line-height: 1;
            filter: drop-shadow(0 2px 8px rgba(0,0,0,0.22));
          }

          .jr-wow-nav-card-copy {
            display: grid;
            min-width: 0;
            gap: 3px;
          }

          .jr-wow-nav-card-title {
            color: #f8fafc;
            font-size: 14px;
            line-height: 1.05;
            font-weight: 950;
            letter-spacing: -0.18px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .jr-wow-nav-card-description {
            color: rgba(203,213,225,0.78);
            font-size: 10.7px;
            line-height: 1.25;
            font-weight: 800;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .jr-wow-nav-card-active .jr-wow-nav-card-description {
            color: rgba(255,255,255,0.82);
          }

          .jr-wow-nav-card-right {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            gap: 8px;
            flex: 0 0 auto;
          }

          .jr-wow-nav-card-active-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: #ffffff;
            box-shadow: 0 0 0 5px rgba(255,255,255,0.14);
            animation: jr-wow-dot-pulse-white 2.2s ease-in-out infinite;
          }

          .jr-wow-nav-card-count {
            min-width: 34px;
            height: 32px;
            display: grid;
            place-items: center;
            border-radius: 999px;
            padding: 0 10px;
            background: rgba(2,6,23,0.32);
            border: 1px solid rgba(255,255,255,0.14);
            color: #f8fafc;
            font-size: 12px;
            font-weight: 950;
            box-shadow:
              0 12px 24px rgba(0,0,0,0.14),
              inset 0 1px 0 rgba(255,255,255,0.06);
          }

          .jr-wow-status {
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
            animation: jr-wow-card-in 260ms cubic-bezier(0.16, 1, 0.3, 1);
          }

          .jr-wow-status::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              linear-gradient(135deg, rgba(255,255,255,0.06), transparent 34%),
              radial-gradient(circle at 100% 100%, rgba(34,197,94,0.08), transparent 34%);
          }

          .jr-wow-status::after {
            content: "";
            position: absolute;
            width: 130px;
            height: 130px;
            right: -52px;
            top: -52px;
            border-radius: 999px;
            background: var(--jr-status-soft);
            filter: blur(25px);
            opacity: 0.58;
            animation: jr-wow-aurora 5.4s ease-in-out infinite alternate;
            pointer-events: none;
          }

          .jr-wow-status-particles {
            position: absolute;
            inset: 0;
            pointer-events: none;
            overflow: hidden;
          }

          .jr-wow-status-particles span {
            position: absolute;
            width: 4px;
            height: 4px;
            border-radius: 999px;
            background: var(--jr-status-color);
            opacity: 0.16;
            filter: blur(0.2px);
            animation: jr-wow-particle-float 5s ease-in-out infinite;
          }

          .jr-wow-status-particles span:nth-child(1) {
            left: 18%;
            top: 24%;
            animation-delay: -0.4s;
          }

          .jr-wow-status-particles span:nth-child(2) {
            left: 76%;
            top: 36%;
            animation-delay: -1.2s;
          }

          .jr-wow-status-particles span:nth-child(3) {
            left: 42%;
            top: 78%;
            animation-delay: -2s;
          }

          .jr-wow-status-particles span:nth-child(4) {
            left: 86%;
            top: 76%;
            animation-delay: -3.1s;
          }

          .jr-wow-status-content {
            position: relative;
            z-index: 1;
          }

          .jr-wow-status-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 13px;
          }

          .jr-wow-status-label {
            color: #94a3b8;
            font-size: 10px;
            font-weight: 950;
            letter-spacing: 0.13em;
            text-transform: uppercase;
          }

          .jr-wow-status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 8px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 950;
            white-space: nowrap;
          }

          .jr-wow-status-main {
            display: flex;
            gap: 11px;
            align-items: center;
            margin-bottom: 12px;
          }

          .jr-wow-orb {
            position: relative;
            width: 40px;
            height: 40px;
            flex: 0 0 auto;
            display: grid;
            place-items: center;
            border-radius: 16px;
            color: var(--jr-state-color);
            background:
              radial-gradient(circle at 35% 25%, rgba(255,255,255,0.12), transparent 32%),
              var(--jr-state-soft);
            border: 1px solid var(--jr-state-border);
            box-shadow:
              0 0 26px color-mix(in srgb, var(--jr-state-color) 24%, transparent),
              inset 0 1px 0 rgba(255,255,255,0.07);
            overflow: hidden;
          }

          .jr-wow-orb-ring {
            position: absolute;
            border-radius: 999px;
            border: 1px solid currentColor;
            opacity: 0.16;
          }

          .jr-wow-orb-ring-one {
            width: 28px;
            height: 28px;
            animation: jr-wow-ring-pulse 2.7s ease-in-out infinite;
          }

          .jr-wow-orb-ring-two {
            width: 18px;
            height: 18px;
            animation: jr-wow-ring-pulse 2.7s ease-in-out infinite reverse;
          }

          .jr-wow-orb-sweep {
            position: absolute;
            inset: 4px;
            border-radius: 999px;
            background: conic-gradient(
              from 0deg,
              transparent 0deg,
              transparent 250deg,
              currentColor 315deg,
              transparent 360deg
            );
            opacity: 0.2;
            animation: jr-wow-radar-sweep 2.8s linear infinite;
          }

          .jr-wow-orb-ping {
            position: absolute;
            right: 8px;
            top: 8px;
            width: 6px;
            height: 6px;
            border-radius: 999px;
            background: currentColor;
            box-shadow: 0 0 0 4px color-mix(in srgb, currentColor 18%, transparent);
            animation: jr-wow-dot-pulse 1.8s ease-in-out infinite;
          }

          .jr-wow-orb-icon {
            position: relative;
            z-index: 1;
            font-size: 16px;
            filter: drop-shadow(0 2px 8px rgba(0,0,0,0.28));
          }

          .jr-wow-orb-analyzing .jr-wow-orb-sweep {
            opacity: 0.34;
            animation-duration: 1.2s;
          }

          .jr-wow-status-title {
            margin: 0;
            font-size: 15.5px;
            line-height: 1.15;
            letter-spacing: -0.25px;
            font-weight: 950;
          }

          .jr-wow-status-subtitle {
            margin: 5px 0 0;
            color: #94a3b8;
            font-size: 11.5px;
            line-height: 1.35;
            font-weight: 750;
          }

          .jr-wow-progress-wrap {
            margin: 13px 0 12px;
          }

          .jr-wow-progress-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            color: #94a3b8;
            font-size: 10.5px;
            font-weight: 900;
          }

          .jr-wow-progress-track {
            position: relative;
            height: 8px;
            overflow: hidden;
            border-radius: 999px;
            background: rgba(15,23,42,0.88);
            border: 1px solid rgba(148,163,184,0.1);
          }

          .jr-wow-progress-track::before {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255,255,255,0.05),
              transparent
            );
            animation: jr-wow-track-scan 2.4s ease-in-out infinite;
          }

          .jr-wow-progress-fill {
            position: relative;
            height: 100%;
            overflow: hidden;
            border-radius: inherit;
            transition: width 440ms cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 0 18px currentColor;
          }

          .jr-wow-progress-fill::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255,255,255,0.42),
              transparent
            );
            transform: translateX(-120%);
            animation: jr-wow-progress-shimmer 1.8s ease-in-out infinite;
          }

          .jr-wow-next {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
            padding: 9px 10px;
            border-radius: 14px;
            background:
              radial-gradient(circle at left, rgba(96,165,250,0.08), transparent 45%),
              rgba(2,6,23,0.34);
            border: 1px solid rgba(148,163,184,0.11);
            color: #dbeafe;
            font-size: 11.5px;
            font-weight: 850;
          }

          .jr-wow-next span:first-child {
            width: 21px;
            height: 21px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 8px;
            background: rgba(96,165,250,0.13);
            animation: jr-wow-arrow 1.8s ease-in-out infinite;
          }

          .jr-wow-file {
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
            animation: jr-wow-file-in 240ms ease-out;
          }

          .jr-wow-file-icon {
            width: 23px;
            height: 23px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 8px;
            background: rgba(96,165,250,0.14);
          }

          .jr-wow-file-main {
            min-width: 0;
          }

          .jr-wow-file-name {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #e2e8f0;
          }

          .jr-wow-file-size {
            display: block;
            margin-top: 2px;
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
          }

          .jr-wow-steps {
            position: relative;
            display: grid;
            gap: 8px;
            padding-top: 12px;
            border-top: 1px solid rgba(148,163,184,0.11);
          }

          .jr-wow-steps::before {
            content: "";
            position: absolute;
            left: 4px;
            top: 20px;
            bottom: 7px;
            width: 1px;
            background: linear-gradient(
              180deg,
              rgba(34,197,94,0.34),
              rgba(96,165,250,0.16),
              rgba(100,116,139,0.12)
            );
          }

          .jr-wow-step {
            position: relative;
            display: flex;
            align-items: center;
            gap: 9px;
            color: #94a3b8;
            font-size: 11.5px;
            font-weight: 850;
            animation: jr-wow-step-in 260ms ease-out both;
          }

          .jr-wow-step:nth-child(1) {
            animation-delay: 40ms;
          }

          .jr-wow-step:nth-child(2) {
            animation-delay: 80ms;
          }

          .jr-wow-step:nth-child(3) {
            animation-delay: 120ms;
          }

          .jr-wow-step-dot {
            position: relative;
            z-index: 1;
            width: 9px;
            height: 9px;
            flex: 0 0 auto;
            border-radius: 999px;
            background: rgba(100,116,139,0.75);
            box-shadow: 0 0 0 4px rgba(100,116,139,0.08);
            transition: background 240ms ease, box-shadow 240ms ease;
          }

          .jr-wow-step-dot-done {
            background: #22c55e;
            box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
          }

          .jr-wow-step-dot-active {
            background: #facc15;
            box-shadow: 0 0 0 4px rgba(250,204,21,0.13);
            animation: jr-wow-pulse 1.35s ease-in-out infinite;
          }

          .jr-wow-stats {
            margin-top: 13px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .jr-wow-stat {
            position: relative;
            overflow: hidden;
            padding: 10px;
            border-radius: 15px;
            background: rgba(2,6,23,0.34);
            border: 1px solid rgba(148,163,184,0.11);
            transition: border-color 180ms ease, background 180ms ease;
          }

          .jr-wow-stat::after {
            content: "";
            position: absolute;
            inset: 0;
            background: radial-gradient(circle at top left, rgba(96,165,250,0.08), transparent 45%);
            opacity: 0;
            transition: opacity 180ms ease;
          }

          .jr-wow-stat:hover {
            border-color: rgba(96,165,250,0.24);
            background: rgba(15,23,42,0.5);
          }

          .jr-wow-stat:hover::after {
            opacity: 1;
          }

          .jr-wow-stat-value,
          .jr-wow-stat-label {
            position: relative;
            z-index: 1;
          }

          .jr-wow-stat-value {
            margin: 0;
            color: #f8fafc;
            font-size: 16px;
            line-height: 1;
            font-weight: 950;
          }

          .jr-wow-stat-label {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 9.8px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .jr-wow-footer {
            margin-top: 30px;
            padding-top: 17px;
            border-top: 1px solid rgba(148,163,184,0.12);
          }

          .jr-wow-footer-card {
            position: relative;
            overflow: hidden;
            padding: 12px;
            border-radius: 17px;
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.09), transparent 34%),
              rgba(15,23,42,0.45);
            border: 1px solid rgba(148,163,184,0.11);
            text-align: center;
          }

          .jr-wow-footer-card::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
              120deg,
              transparent,
              rgba(255,255,255,0.04),
              transparent
            );
            transform: translateX(-100%);
            animation: jr-wow-footer-shine 7s ease-in-out infinite;
          }

          .jr-wow-footer-kicker,
          .jr-wow-footer-name {
            position: relative;
            z-index: 1;
          }

          .jr-wow-footer-kicker {
            margin: 0;
            color: #64748b;
            font-size: 10px;
            font-weight: 850;
          }

          .jr-wow-footer-name {
            margin: 5px 0 0;
            color: #e2e8f0;
            font-size: 12px;
            font-weight: 950;
          }

          @keyframes jr-wow-shell-in {
            from {
              opacity: 0;
              transform: translateX(-10px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes jr-wow-edge-flow {
            0%, 100% {
              opacity: 0.35;
              filter: blur(0);
            }
            50% {
              opacity: 0.9;
              filter: blur(0.5px);
            }
          }

          @keyframes jr-wow-card-in {
            from {
              opacity: 0;
              transform: translateY(8px) scale(0.985);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes jr-wow-file-in {
            from {
              opacity: 0;
              transform: translateY(6px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes jr-wow-step-in {
            from {
              opacity: 0;
              transform: translateX(-5px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes jr-wow-shine {
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

          @keyframes jr-wow-logo-breathe {
            0%, 100% {
              opacity: 0.18;
              transform: scale(0.96);
            }
            50% {
              opacity: 0.34;
              transform: scale(1.08);
            }
          }

          @keyframes jr-wow-logo-orbit {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes jr-wow-dot-pulse {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
            }
            50% {
              transform: scale(1.18);
              box-shadow: 0 0 0 6px rgba(34,197,94,0.08);
            }
          }

          @keyframes jr-wow-dot-pulse-white {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 0 5px rgba(255,255,255,0.14);
            }
            50% {
              transform: scale(1.16);
              box-shadow: 0 0 0 7px rgba(255,255,255,0.08);
            }
          }

          @keyframes jr-wow-nav-shimmer {
            from {
              transform: translateX(-120%);
            }
            to {
              transform: translateX(120%);
            }
          }

          @keyframes jr-wow-active-glow {
            0%, 100% {
              opacity: 0.42;
            }
            50% {
              opacity: 0.9;
            }
          }

          @keyframes jr-wow-aurora {
            from {
              transform: translate3d(-4px, 0, 0) scale(0.95);
            }
            to {
              transform: translate3d(6px, 8px, 0) scale(1.08);
            }
          }

          @keyframes jr-wow-particle-float {
            0%, 100% {
              transform: translate3d(0, 0, 0) scale(1);
              opacity: 0.12;
            }
            50% {
              transform: translate3d(8px, -10px, 0) scale(1.45);
              opacity: 0.34;
            }
          }

          @keyframes jr-wow-ring-pulse {
            0%, 100% {
              transform: scale(0.95);
              opacity: 0.12;
            }
            50% {
              transform: scale(1.08);
              opacity: 0.26;
            }
          }

          @keyframes jr-wow-radar-sweep {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }

          @keyframes jr-wow-track-scan {
            0% {
              transform: translateX(-100%);
              opacity: 0;
            }
            35% {
              opacity: 1;
            }
            100% {
              transform: translateX(100%);
              opacity: 0;
            }
          }

          @keyframes jr-wow-progress-shimmer {
            0% {
              transform: translateX(-120%);
            }
            55% {
              transform: translateX(120%);
            }
            100% {
              transform: translateX(120%);
            }
          }

          @keyframes jr-wow-arrow {
            0%, 100% {
              transform: translateX(0);
            }
            50% {
              transform: translateX(2px);
            }
          }

          @keyframes jr-wow-pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.25);
              opacity: 0.72;
            }
          }

          @keyframes jr-wow-footer-shine {
            0% {
              transform: translateX(-100%);
            }
            35% {
              transform: translateX(100%);
            }
            100% {
              transform: translateX(100%);
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .jr-wow,
            .jr-wow::after,
            .jr-wow-logo::before,
            .jr-wow-logo::after,
            .jr-wow-logo-orbit,
            .jr-wow-chip-dot,
            .jr-wow-nav-card,
            .jr-wow-nav-card::after,
            .jr-wow-nav-card-shine,
            .jr-wow-nav-card-active::after,
            .jr-wow-nav-card-active-dot,
            .jr-wow-status,
            .jr-wow-status::after,
            .jr-wow-status-particles span,
            .jr-wow-orb-ring,
            .jr-wow-orb-sweep,
            .jr-wow-orb-ping,
            .jr-wow-progress-track::before,
            .jr-wow-progress-fill,
            .jr-wow-progress-fill::after,
            .jr-wow-next span:first-child,
            .jr-wow-file,
            .jr-wow-step,
            .jr-wow-step-dot-active,
            .jr-wow-footer-card::after {
              animation: none;
              transition: none;
            }
          }
        `}
      </style>

      <aside
        className="jr-wow"
        style={
          {
            ...sidebarStyle,
            "--jr-mouse-x": `${spotlight.x}px`,
            "--jr-mouse-y": `${spotlight.y}px`,
            "--jr-mouse-opacity": spotlight.active ? 1 : 0,
          } as CssVars
        }
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <div>
          <header className="jr-wow-brand">
            <div className="jr-wow-logo" aria-hidden="true">
              <span className="jr-wow-logo-orbit" />
              <span className="jr-wow-logo-text">JR</span>
            </div>

            <div>
              <h2 className="jr-wow-title">JobRadar AI</h2>
              <p className="jr-wow-subtitle">Your AI Job Scout</p>

              <div className="jr-wow-chip">
                <span className="jr-wow-chip-dot" />
                Local workspace
              </div>
            </div>
          </header>

          <nav className="jr-wow-nav" aria-label="Main navigation">
            <NavButton
              icon="📊"
              label="Dashboard"
              description="Live job radar"
              variant="dashboard"
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
              description={
                hasSavedJobs
                  ? "Shortlisted matches"
                  : "No saved matches yet"
              }
              count={savedJobsCount}
              variant="saved"
              active={showSavedJobs}
              disabled={!hasSavedJobs && !showSavedJobs}
              onClick={onToggleSavedJobs}
            />
          </nav>

          <section
            key={stateKey}
            className="jr-wow-status"
            style={
              {
                "--jr-status-color": workspaceState.color,
                "--jr-status-soft": workspaceState.softColor,
              } as CssVars
            }
          >
            <div className="jr-wow-status-particles" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
            </div>

            <div className="jr-wow-status-content">
              <div className="jr-wow-status-top">
                <span className="jr-wow-status-label">Workspace</span>

                <span
                  className="jr-wow-status-badge"
                  style={{
                    color: workspaceState.color,
                    background: workspaceState.softColor,
                    border: `1px solid ${workspaceState.borderColor}`,
                  }}
                >
                  {workspaceState.label}
                </span>
              </div>

              <div className="jr-wow-status-main">
                <WorkspaceOrb state={workspaceState} />

                <div>
                  <h3
                    className="jr-wow-status-title"
                    style={{ color: workspaceState.color }}
                  >
                    {workspaceState.title}
                  </h3>

                  <p className="jr-wow-status-subtitle">
                    {workspaceState.subtitle}
                  </p>
                </div>
              </div>

              <div className="jr-wow-progress-wrap">
                <div className="jr-wow-progress-meta">
                  <span>Session progress</span>
                  <span>{workspaceState.progress}%</span>
                </div>

                <div className="jr-wow-progress-track">
                  <div
                    className="jr-wow-progress-fill"
                    style={{
                      width: `${workspaceState.progress}%`,
                      color: workspaceState.color,
                      background: `linear-gradient(90deg, ${workspaceState.color}, rgba(96,165,250,0.9))`,
                    }}
                  />
                </div>
              </div>

              <div className="jr-wow-next">
                <span>→</span>
                <span>Next: {workspaceState.nextStep}</span>
              </div>

              {cvFile && (
                <div className="jr-wow-file" title={cvFile.name}>
                  <span className="jr-wow-file-icon">📄</span>

                  <span className="jr-wow-file-main">
                    <span className="jr-wow-file-name">
                      {truncateFileName(cvFile.name)}
                    </span>

                    {fileSize && (
                      <span className="jr-wow-file-size">{fileSize}</span>
                    )}
                  </span>
                </div>
              )}

              <div className="jr-wow-steps">
                <ProgressStep label="CV selected" done={hasCvFile} />
                <ProgressStep
                  label="AI profile"
                  done={hasProfile}
                  active={profileLoading}
                />
                <ProgressStep label="Saved jobs" done={hasSavedJobs} />
              </div>

              <div className="jr-wow-stats">
                <div className="jr-wow-stat">
                  <p className="jr-wow-stat-value">
                    <AnimatedNumber value={savedJobsCount} />
                  </p>
                  <p className="jr-wow-stat-label">Saved</p>
                </div>

                <div className="jr-wow-stat">
                  <p className="jr-wow-stat-value">
                    {hasProfile ? "AI" : "--"}
                  </p>
                  <p className="jr-wow-stat-label">Profile</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="jr-wow-footer">
          <div className="jr-wow-footer-card">
            <p className="jr-wow-footer-kicker">Created by</p>
            <p className="jr-wow-footer-name">Francesco Molea</p>
          </div>
        </footer>
      </aside>
    </>
  );
}