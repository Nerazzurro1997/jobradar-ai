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
            backdrop-filter: blur(22px) saturate(1.22);
            -webkit-backdrop-filter: blur(22px) saturate(1.22);
          }

          .jr-confirm-aurora {
            position: absolute;
            width: 390px;
            height: 390px;
            border-radius: 999px;
            pointer-events: none;
            filter: blur(76px);
            opacity: 0.34;
            animation: jr-confirm-float 8s ease-in-out infinite alternate;
          }

          .jr-confirm-aurora-one {
            top: -130px;
            left: 12%;
            background: rgba(59,130,246,0.54);
          }

          .jr-confirm-aurora-two {
            right: 10%;
            bottom: -160px;
            background: rgba(239,68,68,0.32);
            animation-delay: -2s;
          }

          .jr-confirm-aurora-three {
            top: 32%;
            right: 24%;
            width: 280px;
            height: 280px;
            background: rgba(20,184,166,0.24);
            animation-delay: -4s;
          }

          .jr-confirm-card {
            position: relative;
            width: min(620px, calc(100vw - 32px));
            max-height: calc(100vh - 48px);
            overflow: auto;
            border-radius: 34px;
            padding: 32px;
            color: #f8fafc;
            background:
              radial-gradient(circle at 0% 0%, rgba(59,130,246,0.18), transparent 34%),
              radial-gradient(circle at 100% 100%, rgba(220,38,38,0.14), transparent 32%),
              linear-gradient(145deg, rgba(15,23,42,0.98), rgba(17,24,39,0.93));
            border: 1px solid rgba(148,163,184,0.28);
            box-shadow:
              0 42px 120px rgba(0,0,0,0.66),
              0 0 0 1px rgba(255,255,255,0.035) inset,
              0 1px 0 rgba(255,255,255,0.09) inset;
            animation: jr-confirm-enter 240ms cubic-bezier(0.16, 1, 0.3, 1);
          }

          .jr-confirm-card::before {
            content: "";
            position: absolute;
            inset: 0;
            pointer-events: none;
            border-radius: inherit;
            background:
              linear-gradient(135deg, rgba(255,255,255,0.14), transparent 28%),
              linear-gradient(180deg, rgba(255,255,255,0.065), transparent 38%);
            opacity: 0.86;
          }

          .jr-confirm-card::after {
            content: "";
            position: absolute;
            left: 36px;
            right: 36px;
            bottom: 0;
            height: 1px;
            background: linear-gradient(
              90deg,
              transparent,
              rgba(248,113,113,0.52),
              transparent
            );
            opacity: 0.9;
          }

          .jr-confirm-content {
            position: relative;
            z-index: 1;
          }

          .jr-confirm-top {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 18px;
            margin-bottom: 24px;
          }

          .jr-confirm-icon-wrap {
            display: flex;
            align-items: center;
            gap: 16px;
          }

          .jr-confirm-icon {
            width: 62px;
            height: 62px;
            flex: 0 0 auto;
            display: grid;
            place-items: center;
            border-radius: 22px;
            color: #fecaca;
            background:
              radial-gradient(circle at 30% 20%, rgba(255,255,255,0.17), transparent 38%),
              linear-gradient(135deg, rgba(239,68,68,0.25), rgba(127,29,29,0.23));
            border: 1px solid rgba(248,113,113,0.34);
            box-shadow:
              0 20px 46px rgba(220,38,38,0.2),
              0 1px 0 rgba(255,255,255,0.09) inset;
          }

          .jr-confirm-icon-safe {
            color: #bfdbfe;
            background:
              radial-gradient(circle at 30% 20%, rgba(255,255,255,0.17), transparent 38%),
              linear-gradient(135deg, rgba(59,130,246,0.25), rgba(30,64,175,0.23));
            border-color: rgba(96,165,250,0.34);
            box-shadow:
              0 20px 46px rgba(37,99,235,0.2),
              0 1px 0 rgba(255,255,255,0.09) inset;
          }

          .jr-confirm-eyebrow {
            margin: 0 0 7px;
            color: #94a3b8;
            font-size: 11px;
            font-weight: 950;
            letter-spacing: 0.13em;
            text-transform: uppercase;
          }

          .jr-confirm-title {
            margin: 0;
            color: #f8fafc;
            font-size: 30px;
            line-height: 1.08;
            letter-spacing: -0.85px;
          }

          .jr-confirm-close {
            width: 40px;
            height: 40px;
            display: grid;
            place-items: center;
            flex: 0 0 auto;
            border: 1px solid rgba(148,163,184,0.2);
            border-radius: 15px;
            background: rgba(15,23,42,0.58);
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
            background: rgba(30,41,59,0.82);
            border-color: rgba(203,213,225,0.34);
            color: #ffffff;
          }

          .jr-confirm-description {
            margin: 0;
            max-width: 520px;
            color: #cbd5e1;
            font-size: 16px;
            line-height: 1.68;
          }

          .jr-confirm-impact {
            margin-top: 24px;
            padding: 18px;
            border-radius: 24px;
            background:
              radial-gradient(circle at top left, rgba(59,130,246,0.09), transparent 42%),
              rgba(2,6,23,0.48);
            border: 1px solid rgba(148,163,184,0.17);
            box-shadow: 0 1px 0 rgba(255,255,255,0.045) inset;
          }

          .jr-confirm-impact-title {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 14px;
          }

          .jr-confirm-impact-title span:first-child {
            color: #e2e8f0;
            font-size: 13px;
            font-weight: 950;
          }

          .jr-confirm-impact-title span:last-child {
            padding: 6px 10px;
            border-radius: 999px;
            background: rgba(248,113,113,0.13);
            border: 1px solid rgba(248,113,113,0.24);
            color: #fecaca;
            font-size: 11px;
            font-weight: 950;
            letter-spacing: 0.02em;
            white-space: nowrap;
          }

          .jr-confirm-detail-grid {
            display: grid;
            gap: 10px;
          }

          .jr-confirm-detail-item {
            display: flex;
            align-items: center;
            gap: 11px;
            padding: 12px 13px;
            border-radius: 16px;
            background: rgba(15,23,42,0.52);
            border: 1px solid rgba(148,163,184,0.11);
            color: #dbeafe;
            font-size: 13.5px;
            font-weight: 800;
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
            margin: 14px 0 0;
            color: #94a3b8;
            font-size: 12.8px;
            line-height: 1.55;
          }

          .jr-confirm-actions {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            margin-top: 28px;
          }

          .jr-confirm-btn {
            min-height: 52px;
            border-radius: 17px;
            padding: 13px 18px;
            font-size: 13.5px;
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
              linear-gradient(180deg, rgba(30,41,59,0.92), rgba(15,23,42,0.9));
            border: 1px solid rgba(148,163,184,0.26);
            box-shadow:
              0 16px 36px rgba(0,0,0,0.24),
              0 1px 0 rgba(255,255,255,0.07) inset;
          }

          .jr-confirm-cancel:hover {
            border-color: rgba(203,213,225,0.38);
            background:
              linear-gradient(180deg, rgba(51,65,85,0.92), rgba(15,23,42,0.92));
          }

          .jr-confirm-confirm {
            color: #ffffff;
            background:
              radial-gradient(circle at 30% 10%, rgba(255,255,255,0.24), transparent 30%),
              linear-gradient(135deg, #ef4444, #b91c1c 55%, #7f1d1d);
            border: 1px solid rgba(248,113,113,0.46);
            box-shadow:
              0 20px 48px rgba(220,38,38,0.36),
              0 1px 0 rgba(255,255,255,0.19) inset;
          }

          .jr-confirm-confirm:hover {
            filter: brightness(1.08);
            box-shadow:
              0 24px 58px rgba(220,38,38,0.44),
              0 1px 0 rgba(255,255,255,0.2) inset;
          }

          .jr-confirm-confirm-safe {
            background:
              radial-gradient(circle at 30% 10%, rgba(255,255,255,0.24), transparent 30%),
              linear-gradient(135deg, #2563eb, #1d4ed8 55%, #1e3a8a);
            border-color: rgba(96,165,250,0.46);
            box-shadow:
              0 20px 48px rgba(37,99,235,0.36),
              0 1px 0 rgba(255,255,255,0.19) inset;
          }

          @keyframes jr-confirm-enter {
            from {
              opacity: 0;
              transform: translateY(18px) scale(0.972);
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
              padding: 24px;
              border-radius: 30px;
            }

            .jr-confirm-top {
              gap: 12px;
            }

            .jr-confirm-icon {
              width: 56px;
              height: 56px;
              border-radius: 20px;
            }

            .jr-confirm-title {
              font-size: 24px;
            }

            .jr-confirm-description {
              font-size: 15px;
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
                      width="27"
                      height="27"
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
                      width="27"
                      height="27"
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
                  <span>{danger ? "Permanent reset" : "Review required"}</span>
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