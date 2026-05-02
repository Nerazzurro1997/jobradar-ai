import { useEffect, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  details?: string[];
  note?: string;
  onConfirm: () => void;
  onCancel: () => void;
};

const DEFAULT_DANGER_DETAILS = [
  "Saved jobs",
  "CV profile",
  "Current CV selection",
];

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger = false,
  details,
  note = "You can upload your CV again afterwards.",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement | null>(null);

  const visibleDetails =
    details && details.length > 0
      ? details
      : danger
        ? DEFAULT_DANGER_DETAILS
        : [];

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      cancelButtonRef.current?.focus();
    }, 0);

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onCancel();
      }
    }

    window.addEventListener("keydown", handleEscape);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <>
      <style>
        {`
          .jr-confirm-overlay,
          .jr-confirm-overlay * {
            box-sizing: border-box;
          }

          .jr-confirm-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 24px;
            overflow: hidden;
            background:
              radial-gradient(circle at 18% 12%, rgba(59,130,246,0.28), transparent 34%),
              radial-gradient(circle at 82% 18%, rgba(20,184,166,0.16), transparent 30%),
              radial-gradient(circle at 50% 110%, rgba(220,38,38,0.12), transparent 34%),
              rgba(2,6,23,0.78);
            backdrop-filter: blur(20px) saturate(1.2);
            -webkit-backdrop-filter: blur(20px) saturate(1.2);
          }

          .jr-confirm-aurora {
            position: absolute;
            width: 360px;
            height: 360px;
            border-radius: 999px;
            pointer-events: none;
            filter: blur(70px);
            opacity: 0.34;
            animation: jr-confirm-float 8s ease-in-out infinite alternate;
          }

          .jr-confirm-aurora-one {
            top: -120px;
            left: 12%;
            background: rgba(59,130,246,0.5);
          }

          .jr-confirm-aurora-two {
            right: 10%;
            bottom: -150px;
            background: rgba(239,68,68,0.32);
            animation-delay: -2s;
          }

          .jr-confirm-aurora-three {
            top: 32%;
            right: 24%;
            width: 260px;
            height: 260px;
            background: rgba(20,184,166,0.24);
            animation-delay: -4s;
          }

          .jr-confirm-card {
            position: relative;
            width: min(540px, calc(100vw - 32px));
            max-height: calc(100vh - 48px);
            overflow: auto;
            border-radius: 32px;
            padding: 28px;
            color: #f8fafc;
            background:
              radial-gradient(circle at 0% 0%, rgba(59,130,246,0.16), transparent 34%),
              radial-gradient(circle at 100% 100%, rgba(220,38,38,0.12), transparent 30%),
              linear-gradient(145deg, rgba(15,23,42,0.97), rgba(17,24,39,0.92));
            border: 1px solid rgba(148,163,184,0.26);
            box-shadow:
              0 36px 110px rgba(0,0,0,0.62),
              0 0 0 1px rgba(255,255,255,0.03) inset,
              0 1px 0 rgba(255,255,255,0.08) inset;
            animation: jr-confirm-enter 220ms cubic-bezier(0.16, 1, 0.3, 1);
          }

          .jr-confirm-card::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            border-radius: inherit;
            background:
              linear-gradient(135deg, rgba(255,255,255,0.13), transparent 28%),
              linear-gradient(180deg, rgba(255,255,255,0.06), transparent 38%);
            opacity: 0.8;
          }

          .jr-confirm-card::after {
            content: "";
            position: absolute;
            left: 32px;
            right: 32px;
            bottom: 0;
            height: 1px;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(248,113,113,0.5),
              transparent
            );
            opacity: 0.85;
          }

          .jr-confirm-content {
            position: relative;
            z-index: 1;
          }

          .jr-confirm-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 22px;
          }

          .jr-confirm-icon-wrap {
            display: flex;
            align-items: center;
            gap: 14px;
          }

          .jr-confirm-icon {
            width: 58px;
            height: 58px;
            flex: 0 0 auto;
            display: grid;
            place-items: center;
            border-radius: 20px;
            color: #fecaca;
            background:
              radial-gradient(circle at 30% 20%, rgba(255,255,255,0.16), transparent 38%),
              linear-gradient(135deg, rgba(239,68,68,0.24), rgba(127,29,29,0.22));
            border: 1px solid rgba(248,113,113,0.32);
            box-shadow:
              0 18px 42px rgba(220,38,38,0.18),
              0 1px 0 rgba(255,255,255,0.08) inset;
          }

          .jr-confirm-icon-safe {
            color: #bfdbfe;
            background:
              radial-gradient(circle at 30% 20%, rgba(255,255,255,0.16), transparent 38%),
              linear-gradient(135deg, rgba(59,130,246,0.24), rgba(30,64,175,0.22));
            border-color: rgba(96,165,250,0.32);
            box-shadow:
              0 18px 42px rgba(37,99,235,0.18),
              0 1px 0 rgba(255,255,255,0.08) inset;
          }

          .jr-confirm-eyebrow {
            margin: 0 0 6px;
            color: #94a3b8;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.12em;
            text-transform: uppercase;
          }

          .jr-confirm-title {
            margin: 0;
            color: #f8fafc;
            font-size: 26px;
            line-height: 1.1;
            letter-spacing: -0.7px;
          }

          .jr-confirm-close {
            width: 38px;
            height: 38px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border: 1px solid rgba(148,163,184,0.18);
            border-radius: 14px;
            background: rgba(15,23,42,0.55);
            color: #cbd5e1;
            cursor: pointer;
            transition:
              transform 160ms ease,
              background 160ms ease,
              border-color 160ms ease,
              color 160ms ease;
          }

          .jr-confirm-close:hover {
            transform: translateY(-1px);
            background: rgba(30,41,59,0.78);
            border-color: rgba(203,213,225,0.32);
            color: #ffffff;
          }

          .jr-confirm-description {
            margin: 0;
            max-width: 440px;
            color: #cbd5e1;
            font-size: 15.5px;
            line-height: 1.65;
          }

          .jr-confirm-impact {
            margin-top: 22px;
            padding: 16px;
            border-radius: 22px;
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.08), transparent 42%),
              rgba(2,6,23,0.46);
            border: 1px solid rgba(148,163,184,0.16);
            box-shadow: 0 1px 0 rgba(255,255,255,0.04) inset;
          }

          .jr-confirm-impact-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 12px;
          }

          .jr-confirm-impact-title span:first-child {
            color: #e2e8f0;
            font-size: 13px;
            font-weight: 900;
          }

          .jr-confirm-impact-title span:last-child {
            padding: 5px 9px;
            border-radius: 999px;
            background: rgba(248,113,113,0.12);
            border: 1px solid rgba(248,113,113,0.22);
            color: #fecaca;
            font-size: 11px;
            font-weight: 900;
            letter-spacing: 0.02em;
            white-space: nowrap;
          }

          .jr-confirm-detail-grid {
            display: grid;
            gap: 9px;
          }

          .jr-confirm-detail-item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 10px 11px;
            border-radius: 15px;
            background: rgba(15,23,42,0.5);
            border: 1px solid rgba(148,163,184,0.1);
            color: #dbeafe;
            font-size: 13px;
            font-weight: 750;
          }

          .jr-confirm-detail-dot {
            width: 8px;
            height: 8px;
            flex: 0 0 auto;
            border-radius: 999px;
            background: #fb7185;
            box-shadow: 0 0 0 4px rgba(251,113,133,0.12);
          }

          .jr-confirm-note {
            margin: 13px 0 0;
            color: #94a3b8;
            font-size: 12.5px;
            line-height: 1.5;
          }

          .jr-confirm-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-top: 26px;
          }

          .jr-confirm-btn {
            min-height: 48px;
            border-radius: 16px;
            padding: 12px 16px;
            font-size: 13px;
            font-weight: 950;
            letter-spacing: -0.1px;
            cursor: pointer;
            transition:
              transform 160ms ease,
              box-shadow 160ms ease,
              border-color 160ms ease,
              background 160ms ease,
              filter 160ms ease;
          }

          .jr-confirm-btn:hover {
            transform: translateY(-1px);
          }

          .jr-confirm-btn:active {
            transform: translateY(0);
          }

          .jr-confirm-btn:focus-visible,
          .jr-confirm-close:focus-visible {
            outline: 3px solid rgba(96,165,250,0.38);
            outline-offset: 3px;
          }

          .jr-confirm-cancel {
            color: #e2e8f0;
            background:
              linear-gradient(180deg, rgba(30,41,59,0.9), rgba(15,23,42,0.88));
            border: 1px solid rgba(148,163,184,0.24);
            box-shadow:
              0 14px 34px rgba(0,0,0,0.22),
              0 1px 0 rgba(255,255,255,0.06) inset;
          }

          .jr-confirm-cancel:hover {
            border-color: rgba(203,213,225,0.36);
            background:
              linear-gradient(180deg, rgba(51,65,85,0.9), rgba(15,23,42,0.9));
          }

          .jr-confirm-confirm {
            color: #ffffff;
            background:
              radial-gradient(circle at 30% 10%, rgba(255,255,255,0.22), transparent 30%),
              linear-gradient(135deg, #ef4444, #b91c1c 55%, #7f1d1d);
            border: 1px solid rgba(248,113,113,0.44);
            box-shadow:
              0 18px 44px rgba(220,38,38,0.34),
              0 1px 0 rgba(255,255,255,0.18) inset;
          }

          .jr-confirm-confirm:hover {
            filter: brightness(1.07);
            box-shadow:
              0 22px 54px rgba(220,38,38,0.42),
              0 1px 0 rgba(255,255,255,0.2) inset;
          }

          .jr-confirm-confirm-safe {
            background:
              radial-gradient(circle at 30% 10%, rgba(255,255,255,0.22), transparent 30%),
              linear-gradient(135deg, #2563eb, #1d4ed8 55%, #1e3a8a);
            border-color: rgba(96,165,250,0.44);
            box-shadow:
              0 18px 44px rgba(37,99,235,0.34),
              0 1px 0 rgba(255,255,255,0.18) inset;
          }

          @keyframes jr-confirm-enter {
            from {
              opacity: 0;
              transform: translateY(16px) scale(0.975);
            }
            to {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }

          @keyframes jr-confirm-float {
            from {
              transform: translate3d(-12px, -8px, 0) scale(1);
            }
            to {
              transform: translate3d(16px, 12px, 0) scale(1.08);
            }
          }

          @media (max-width: 560px) {
            .jr-confirm-overlay {
              padding: 16px;
              align-items: flex-end;
            }

            .jr-confirm-card {
              width: 100%;
              padding: 22px;
              border-radius: 28px;
            }

            .jr-confirm-top {
              gap: 12px;
            }

            .jr-confirm-title {
              font-size: 23px;
            }

            .jr-confirm-actions {
              grid-template-columns: 1fr;
            }

            .jr-confirm-confirm {
              order: -1;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .jr-confirm-card,
            .jr-confirm-aurora,
            .jr-confirm-btn,
            .jr-confirm-close {
              animation: none;
              transition: none;
            }
          }
        `}
      </style>

      <div
        className="jr-confirm-overlay"
        role="presentation"
        onClick={onCancel}
      >
        <div className="jr-confirm-aurora jr-confirm-aurora-one" />
        <div className="jr-confirm-aurora jr-confirm-aurora-two" />
        <div className="jr-confirm-aurora jr-confirm-aurora-three" />

        <div
          className="jr-confirm-card"
          role="dialog"
          aria-modal="true"
          aria-labelledby="jr-confirm-title"
          aria-describedby="jr-confirm-description"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="jr-confirm-content">
            <div className="jr-confirm-top">
              <div className="jr-confirm-icon-wrap">
                <div
                  className={`jr-confirm-icon ${
                    danger ? "" : "jr-confirm-icon-safe"
                  }`}
                  aria-hidden="true"
                >
                  {danger ? (
                    <svg
                      width="25"
                      height="25"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M9.5 4.5h5M5.75 7h12.5M10 10.5v6M14 10.5v6M7.5 7l.75 12.25c.06.98.87 1.75 1.85 1.75h3.8c.98 0 1.79-.77 1.85-1.75L16.5 7"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg
                      width="25"
                      height="25"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <path
                        d="M5 12.5l4 4L19 7"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </div>

                <div>
                  <p className="jr-confirm-eyebrow">
                    {danger ? "Safety check" : "Confirmation"}
                  </p>

                  <h2 id="jr-confirm-title" className="jr-confirm-title">
                    {title}
                  </h2>
                </div>
              </div>

              <button
                type="button"
                className="jr-confirm-close"
                aria-label="Close confirmation dialog"
                onClick={onCancel}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M6 6l12 12M18 6L6 18"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <p
              id="jr-confirm-description"
              className="jr-confirm-description"
            >
              {description}
            </p>

            {visibleDetails.length > 0 && (
              <div className="jr-confirm-impact">
                <div className="jr-confirm-impact-title">
                  <span>This action will clear</span>
                  <span>Permanent reset</span>
                </div>

                <div className="jr-confirm-detail-grid">
                  {visibleDetails.map((item) => (
                    <div className="jr-confirm-detail-item" key={item}>
                      <span className="jr-confirm-detail-dot" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>

                {note && <p className="jr-confirm-note">{note}</p>}
              </div>
            )}

            <div className="jr-confirm-actions">
              <button
                ref={cancelButtonRef}
                type="button"
                className="jr-confirm-btn jr-confirm-cancel"
                onClick={onCancel}
              >
                {cancelLabel}
              </button>

              <button
                type="button"
                className={`jr-confirm-btn jr-confirm-confirm ${
                  danger ? "" : "jr-confirm-confirm-safe"
                }`}
                onClick={onConfirm}
              >
                {confirmLabel}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}