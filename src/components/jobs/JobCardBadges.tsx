import type { BadgeProps, BadgeTone } from "./JobCardTypes";

const badgeStyles: Record<
  BadgeTone,
  {
    background: string;
    border: string;
    color: string;
  }
> = {
  neutral: {
    background: "rgba(15,23,42,0.055)",
    border: "1px solid rgba(15,23,42,0.07)",
    color: "#334155",
  },
  blue: {
    background: "rgba(37,99,235,0.1)",
    border: "1px solid rgba(37,99,235,0.18)",
    color: "#1d4ed8",
  },
  green: {
    background: "rgba(34,197,94,0.12)",
    border: "1px solid rgba(34,197,94,0.26)",
    color: "#166534",
  },
  amber: {
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.26)",
    color: "#92400e",
  },
  red: {
    background: "rgba(220,38,38,0.08)",
    border: "1px solid rgba(220,38,38,0.18)",
    color: "#991b1b",
  },
  purple: {
    background: "rgba(124,58,237,0.12)",
    border: "1px solid rgba(124,58,237,0.24)",
    color: "#5b21b6",
  },
};

export function Badge({ children, tone = "neutral" }: BadgeProps) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        maxWidth: "100%",
        minHeight: 23,
        padding: "5px 8px",
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 900,
        lineHeight: 1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
        verticalAlign: "middle",
        ...badgeStyles[tone],
      }}
    >
      {children}
    </span>
  );
}
