import { useEffect, useRef, useState } from "react";
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
      variant: "analyzing",
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
      variant: "active",
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
      variant: "ready",
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
      variant: "cv-loaded",
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
    variant: "setup",
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
    const duration = 520;

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
  count,
  active = false,
  disabled = false,
  onClick,
}: NavButtonProps) {
  return (
    <button
      type="button"
      className={[
        "jr-side-motion-nav-btn",
        active ? "jr-side-motion-nav-btn-active" : "",
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      aria-current={active ? "page" : undefined}
      onClick={disabled ? undefined : onClick}
    >
      <span className="jr-side-motion-nav-left">
        <span className="jr-side-motion-nav-icon">{icon}</span>
        <span className="jr-side-motion-nav-label">{label}</span>
      </span>

      {typeof count === "number" && (
        <span className="jr-side-motion-nav-count">
          <AnimatedNumber value={count} />
        </span>
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
    <div className="jr-side-motion-step">
      <span
        className={[
          "jr-side-motion-step-dot",
          done ? "jr-side-motion-step-dot-done" : "",
          active ? "jr-side-motion-step-dot-active" : "",
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
  const stateKey = `${workspaceState.variant}-${hasCvFile}-${hasProfile}-${hasSavedJobs}`;

  return (
    <>
      <style>
        {`
          .jr-side-motion,
          .jr-side-motion * {
            box-sizing: border-box;
          }

          .jr-side-motion {
            animation: jr-side-motion-shell-in 360ms cubic-bezier(0.16, 1, 0.3, 1);
          }

          .jr-side-motion::-webkit-scrollbar {
            width: 7px;
          }

          .jr-side-motion::-webkit-scrollbar-track {
            background: transparent;
          }

          .jr-side-motion::-webkit-scrollbar-thumb {
            background: rgba(148,163,184,0.18);
            border-radius: 999px;
          }

          .jr-side-motion-brand {
            display: flex;
            gap: 12px;
            align-items: center;
          }

          .jr-side-motion-logo {
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

          .jr-side-motion-logo::before {
            content: "";
            position: absolute;
            inset: -2px;
            border-radius: inherit;
            background: linear-gradient(135deg, rgba(96,165,250,0.8), rgba(34,197,94,0.55));
            opacity: 0.28;
            filter: blur(10px);
            animation: jr-side-motion-logo-breathe 3.8s ease-in-out infinite;
          }

          .jr-side-motion-logo::after {
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
            animation: jr-side-motion-shine 5.2s ease-in-out infinite;
          }

          .jr-side-motion-logo-text {
            position: relative;
            z-index: 1;
            font-size: 17px;
            font-weight: 950;
            letter-spacing: -0.5px;
            color: #ffffff;
          }

          .jr-side-motion-title {
            margin: 0;
            font-size: 19px;
            line-height: 1.05;
            letter-spacing: -0.45px;
            color: #f8fafc;
          }

          .jr-side-motion-subtitle {
            margin: 5px 0 0;
            font-size: 11.5px;
            color: #94a3b8;
            font-weight: 750;
          }

          .jr-side-motion-chip {
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

          .jr-side-motion-chip-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: #22c55e;
            box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
            animation: jr-side-motion-dot-pulse 2.4s ease-in-out infinite;
          }

          .jr-side-motion-nav {
            margin-top: 30px;
            display: grid;
            gap: 10px;
          }

          .jr-side-motion-nav-btn {
            position: relative;
            width: 100%;
            min-height: 44px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            overflow: hidden;
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

          .jr-side-motion-nav-btn::after {
            content: "";
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

          .jr-side-motion-nav-btn:hover:not(:disabled) {
            transform: translateY(-1px);
            border-color: rgba(96,165,250,0.34);
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.18), transparent 40%),
              linear-gradient(180deg, rgba(30,41,59,0.88), rgba(15,23,42,0.82));
            box-shadow:
              0 18px 36px rgba(0,0,0,0.18),
              inset 0 1px 0 rgba(255,255,255,0.06);
          }

          .jr-side-motion-nav-btn:hover:not(:disabled)::after {
            opacity: 1;
            animation: jr-side-motion-nav-shimmer 900ms ease;
          }

          .jr-side-motion-nav-btn:active:not(:disabled) {
            transform: translateY(0);
          }

          .jr-side-motion-nav-btn:focus-visible {
            outline: 3px solid rgba(96,165,250,0.35);
            outline-offset: 3px;
          }

          .jr-side-motion-nav-btn:disabled {
            cursor: not-allowed;
            opacity: 0.48;
          }

          .jr-side-motion-nav-btn-active {
            color: #ffffff;
            border-color: rgba(34,197,94,0.42);
            background:
              radial-gradient(circle at top left, rgba(255,255,255,0.14), transparent 35%),
              linear-gradient(135deg, #22c55e, #16a34a 58%, #15803d);
            box-shadow:
              0 18px 40px rgba(34,197,94,0.25),
              inset 0 1px 0 rgba(255,255,255,0.16);
          }

          .jr-side-motion-nav-btn-active::before {
            content: "";
            position: absolute;
            inset: -1px;
            border-radius: inherit;
            border: 1px solid rgba(187,247,208,0.32);
            opacity: 0.72;
            animation: jr-side-motion-active-glow 2.8s ease-in-out infinite;
            pointer-events: none;
          }

          .jr-side-motion-nav-left {
            position: relative;
            z-index: 1;
            display: flex;
            align-items: center;
            min-width: 0;
            gap: 9px;
          }

          .jr-side-motion-nav-icon {
            width: 21px;
            height: 21px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 8px;
            background: rgba(255,255,255,0.08);
            font-size: 12px;
          }

          .jr-side-motion-nav-label {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .jr-side-motion-nav-count {
            position: relative;
            z-index: 1;
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

          .jr-side-motion-status {
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
            animation: jr-side-motion-card-in 260ms cubic-bezier(0.16, 1, 0.3, 1);
          }

          .jr-side-motion-status::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            background:
              linear-gradient(135deg, rgba(255,255,255,0.06), transparent 34%),
              radial-gradient(circle at 100% 100%, rgba(34,197,94,0.08), transparent 34%);
          }

          .jr-side-motion-status::after {
            content: "";
            position: absolute;
            width: 120px;
            height: 120px;
            right: -48px;
            top: -48px;
            border-radius: 999px;
            background: var(--sidebar-accent-soft);
            filter: blur(24px);
            opacity: 0.55;
            animation: jr-side-motion-aurora 5.4s ease-in-out infinite alternate;
            pointer-events: none;
          }

          .jr-side-motion-status-content {
            position: relative;
            z-index: 1;
          }

          .jr-side-motion-status-top {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 13px;
          }

          .jr-side-motion-status-label {
            color: #94a3b8;
            font-size: 10px;
            font-weight: 950;
            letter-spacing: 0.13em;
            text-transform: uppercase;
          }

          .jr-side-motion-status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 5px 8px;
            border-radius: 999px;
            font-size: 10px;
            font-weight: 950;
            white-space: nowrap;
          }

          .jr-side-motion-status-main {
            display: flex;
            gap: 11px;
            align-items: center;
            margin-bottom: 12px;
          }

          .jr-side-motion-status-icon {
            position: relative;
            width: 38px;
            height: 38px;
            flex: 0 0 auto;
            display: grid;
            place-items: center;
            border-radius: 15px;
            font-size: 17px;
          }

          .jr-side-motion-status-icon::after {
            content: "";
            position: absolute;
            inset: -4px;
            border-radius: 18px;
            border: 1px solid currentColor;
            opacity: 0.12;
            animation: jr-side-motion-icon-breathe 2.6s ease-in-out infinite;
            pointer-events: none;
          }

          .jr-side-motion-status-icon-analyzing::after {
            opacity: 0.32;
            border-style: dashed;
            animation: jr-side-motion-icon-spin 1.6s linear infinite;
          }

          .jr-side-motion-status-title {
            margin: 0;
            font-size: 15.5px;
            line-height: 1.15;
            letter-spacing: -0.25px;
            font-weight: 950;
          }

          .jr-side-motion-status-subtitle {
            margin: 5px 0 0;
            color: #94a3b8;
            font-size: 11.5px;
            line-height: 1.35;
            font-weight: 750;
          }

          .jr-side-motion-progress-wrap {
            margin: 13px 0 12px;
          }

          .jr-side-motion-progress-meta {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            color: #94a3b8;
            font-size: 10.5px;
            font-weight: 900;
          }

          .jr-side-motion-progress-track {
            position: relative;
            height: 8px;
            overflow: hidden;
            border-radius: 999px;
            background: rgba(15,23,42,0.88);
            border: 1px solid rgba(148,163,184,0.1);
          }

          .jr-side-motion-progress-track::before {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255,255,255,0.05),
              transparent
            );
            animation: jr-side-motion-track-scan 2.4s ease-in-out infinite;
          }

          .jr-side-motion-progress-fill {
            position: relative;
            height: 100%;
            overflow: hidden;
            border-radius: inherit;
            transition: width 420ms cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 0 18px currentColor;
          }

          .jr-side-motion-progress-fill::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(255,255,255,0.36),
              transparent
            );
            transform: translateX(-120%);
            animation: jr-side-motion-progress-shimmer 1.8s ease-in-out infinite;
          }

          .jr-side-motion-next {
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

          .jr-side-motion-next span:first-child {
            width: 21px;
            height: 21px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 8px;
            background: rgba(96,165,250,0.13);
            animation: jr-side-motion-arrow 1.8s ease-in-out infinite;
          }

          .jr-side-motion-file {
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
            animation: jr-side-motion-file-in 240ms ease-out;
          }

          .jr-side-motion-file-icon {
            width: 23px;
            height: 23px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border-radius: 8px;
            background: rgba(96,165,250,0.14);
          }

          .jr-side-motion-file-main {
            min-width: 0;
          }

          .jr-side-motion-file-name {
            display: block;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            color: #e2e8f0;
          }

          .jr-side-motion-file-size {
            display: block;
            margin-top: 2px;
            color: #64748b;
            font-size: 10px;
            font-weight: 800;
          }

          .jr-side-motion-steps {
            display: grid;
            gap: 8px;
            padding-top: 12px;
            border-top: 1px solid rgba(148,163,184,0.11);
          }

          .jr-side-motion-step {
            display: flex;
            align-items: center;
            gap: 9px;
            color: #94a3b8;
            font-size: 11.5px;
            font-weight: 850;
            animation: jr-side-motion-step-in 260ms ease-out both;
          }

          .jr-side-motion-step:nth-child(1) {
            animation-delay: 40ms;
          }

          .jr-side-motion-step:nth-child(2) {
            animation-delay: 80ms;
          }

          .jr-side-motion-step:nth-child(3) {
            animation-delay: 120ms;
          }

          .jr-side-motion-step-dot {
            width: 9px;
            height: 9px;
            flex: 0 0 auto;
            border-radius: 999px;
            background: rgba(100,116,139,0.75);
            box-shadow: 0 0 0 4px rgba(100,116,139,0.08);
            transition: background 240ms ease, box-shadow 240ms ease;
          }

          .jr-side-motion-step-dot-done {
            background: #22c55e;
            box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
          }

          .jr-side-motion-step-dot-active {
            background: #facc15;
            box-shadow: 0 0 0 4px rgba(250,204,21,0.13);
            animation: jr-side-motion-pulse 1.35s ease-in-out infinite;
          }

          .jr-side-motion-stats {
            margin-top: 13px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 9px;
          }

          .jr-side-motion-stat {
            padding: 10px;
            border-radius: 15px;
            background: rgba(2,6,23,0.34);
            border: 1px solid rgba(148,163,184,0.11);
            transition: border-color 180ms ease, background 180ms ease;
          }

          .jr-side-motion-stat:hover {
            border-color: rgba(96,165,250,0.24);
            background: rgba(15,23,42,0.5);
          }

          .jr-side-motion-stat-value {
            margin: 0;
            color: #f8fafc;
            font-size: 16px;
            line-height: 1;
            font-weight: 950;
          }

          .jr-side-motion-stat-label {
            margin: 6px 0 0;
            color: #64748b;
            font-size: 9.8px;
            font-weight: 950;
            text-transform: uppercase;
            letter-spacing: 0.06em;
          }

          .jr-side-motion-footer {
            margin-top: 30px;
            padding-top: 17px;
            border-top: 1px solid rgba(148,163,184,0.12);
          }

          .jr-side-motion-footer-card {
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

          .jr-side-motion-footer-card::after {
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
            animation: jr-side-motion-footer-shine 7s ease-in-out infinite;
          }

          .jr-side-motion-footer-kicker,
          .jr-side-motion-footer-name {
            position: relative;
            z-index: 1;
          }

          .jr-side-motion-footer-kicker {
            margin: 0;
            color: #64748b;
            font-size: 10px;
            font-weight: 850;
          }

          .jr-side-motion-footer-name {
            margin: 5px 0 0;
            color: #e2e8f0;
            font-size: 12px;
            font-weight: 950;
          }

          @keyframes jr-side-motion-shell-in {
            from {
              opacity: 0;
              transform: translateX(-10px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes jr-side-motion-card-in {
            from {
              opacity: 0;
              transform: translateY(8px) scale(0.985);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes jr-side-motion-file-in {
            from {
              opacity: 0;
              transform: translateY(6px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @keyframes jr-side-motion-step-in {
            from {
              opacity: 0;
              transform: translateX(-5px);
            }
            to {
              opacity: 1;
              transform: translateX(0);
            }
          }

          @keyframes jr-side-motion-shine {
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

          @keyframes jr-side-motion-logo-breathe {
            0%, 100% {
              opacity: 0.18;
              transform: scale(0.96);
            }
            50% {
              opacity: 0.34;
              transform: scale(1.08);
            }
          }

          @keyframes jr-side-motion-dot-pulse {
            0%, 100% {
              transform: scale(1);
              box-shadow: 0 0 0 4px rgba(34,197,94,0.12);
            }
            50% {
              transform: scale(1.18);
              box-shadow: 0 0 0 6px rgba(34,197,94,0.08);
            }
          }

          @keyframes jr-side-motion-nav-shimmer {
            from {
              transform: translateX(-120%);
            }
            to {
              transform: translateX(120%);
            }
          }

          @keyframes jr-side-motion-active-glow {
            0%, 100% {
              opacity: 0.42;
            }
            50% {
              opacity: 0.9;
            }
          }

          @keyframes jr-side-motion-icon-breathe {
            0%, 100% {
              opacity: 0.12;
              transform: scale(1);
            }
            50% {
              opacity: 0.24;
              transform: scale(1.08);
            }
          }

          @keyframes jr-side-motion-icon-spin {
            from {
              transform: rotate(0deg) scale(1.05);
            }
            to {
              transform: rotate(360deg) scale(1.05);
            }
          }

          @keyframes jr-side-motion-aurora {
            from {
              transform: translate3d(-4px, 0, 0) scale(0.95);
            }
            to {
              transform: translate3d(6px, 8px, 0) scale(1.08);
            }
          }

          @keyframes jr-side-motion-track-scan {
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

          @keyframes jr-side-motion-progress-shimmer {
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

          @keyframes jr-side-motion-arrow {
            0%, 100% {
              transform: translateX(0);
            }
            50% {
              transform: translateX(2px);
            }
          }

          @keyframes jr-side-motion-pulse {
            0%, 100% {
              transform: scale(1);
              opacity: 1;
            }
            50% {
              transform: scale(1.25);
              opacity: 0.72;
            }
          }

          @keyframes jr-side-motion-footer-shine {
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
            .jr-side-motion,
            .jr-side-motion-logo::before,
            .jr-side-motion-logo::after,
            .jr-side-motion-chip-dot,
            .jr-side-motion-nav-btn,
            .jr-side-motion-nav-btn::before,
            .jr-side-motion-nav-btn::after,
            .jr-side-motion-status,
            .jr-side-motion-status::after,
            .jr-side-motion-status-icon::after,
            .jr-side-motion-progress-track::before,
            .jr-side-motion-progress-fill,
            .jr-side-motion-progress-fill::after,
            .jr-side-motion-next span:first-child,
            .jr-side-motion-file,
            .jr-side-motion-step,
            .jr-side-motion-step-dot-active,
            .jr-side-motion-footer-card::after {
              animation: none;
              transition: none;
            }
          }
        `}
      </style>

      <aside className="jr-side-motion" style={sidebarStyle}>
        <div>
          <header className="jr-side-motion-brand">
            <div className="jr-side-motion-logo" aria-hidden="true">
              <span className="jr-side-motion-logo-text">JR</span>
            </div>

            <div>
              <h2 className="jr-side-motion-title">JobRadar AI</h2>
              <p className="jr-side-motion-subtitle">Your AI Job Scout</p>

              <div className="jr-side-motion-chip">
                <span className="jr-side-motion-chip-dot" />
                Local workspace
              </div>
            </div>
          </header>

          <nav className="jr-side-motion-nav" aria-label="Main navigation">
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

          <section
            key={stateKey}
            className="jr-side-motion-status"
            style={
              {
                "--sidebar-accent-soft": workspaceState.softColor,
              } as CSSProperties
            }
          >
            <div className="jr-side-motion-status-content">
              <div className="jr-side-motion-status-top">
                <span className="jr-side-motion-status-label">Workspace</span>

                <span
                  className="jr-side-motion-status-badge"
                  style={{
                    color: workspaceState.color,
                    background: workspaceState.softColor,
                    border: `1px solid ${workspaceState.borderColor}`,
                  }}
                >
                  {workspaceState.label}
                </span>
              </div>

              <div className="jr-side-motion-status-main">
                <div
                  className={[
                    "jr-side-motion-status-icon",
                    workspaceState.variant === "analyzing"
                      ? "jr-side-motion-status-icon-analyzing"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
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
                    className="jr-side-motion-status-title"
                    style={{ color: workspaceState.color }}
                  >
                    {workspaceState.title}
                  </h3>

                  <p className="jr-side-motion-status-subtitle">
                    {workspaceState.subtitle}
                  </p>
                </div>
              </div>

              <div className="jr-side-motion-progress-wrap">
                <div className="jr-side-motion-progress-meta">
                  <span>Session progress</span>
                  <span>{workspaceState.progress}%</span>
                </div>

                <div className="jr-side-motion-progress-track">
                  <div
                    className="jr-side-motion-progress-fill"
                    style={{
                      width: `${workspaceState.progress}%`,
                      color: workspaceState.color,
                      background: `linear-gradient(90deg, ${workspaceState.color}, rgba(96,165,250,0.88))`,
                    }}
                  />
                </div>
              </div>

              <div className="jr-side-motion-next">
                <span>→</span>
                <span>Next: {workspaceState.nextStep}</span>
              </div>

              {cvFile && (
                <div className="jr-side-motion-file" title={cvFile.name}>
                  <span className="jr-side-motion-file-icon">📄</span>

                  <span className="jr-side-motion-file-main">
                    <span className="jr-side-motion-file-name">
                      {truncateFileName(cvFile.name)}
                    </span>

                    {fileSize && (
                      <span className="jr-side-motion-file-size">
                        {fileSize}
                      </span>
                    )}
                  </span>
                </div>
              )}

              <div className="jr-side-motion-steps">
                <ProgressStep label="CV selected" done={hasCvFile} />
                <ProgressStep
                  label="AI profile"
                  done={hasProfile}
                  active={profileLoading}
                />
                <ProgressStep label="Saved jobs" done={hasSavedJobs} />
              </div>

              <div className="jr-side-motion-stats">
                <div className="jr-side-motion-stat">
                  <p className="jr-side-motion-stat-value">
                    <AnimatedNumber value={savedJobsCount} />
                  </p>
                  <p className="jr-side-motion-stat-label">Saved</p>
                </div>

                <div className="jr-side-motion-stat">
                  <p className="jr-side-motion-stat-value">
                    {hasProfile ? "AI" : "--"}
                  </p>
                  <p className="jr-side-motion-stat-label">Profile</p>
                </div>
              </div>
            </div>
          </section>
        </div>

        <footer className="jr-side-motion-footer">
          <div className="jr-side-motion-footer-card">
            <p className="jr-side-motion-footer-kicker">Created by</p>
            <p className="jr-side-motion-footer-name">Francesco Molea</p>
          </div>
        </footer>
      </aside>
    </>
  );
}