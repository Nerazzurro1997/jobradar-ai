import type {
  JobWithOptionalFields,
  MobileAnalysisSection,
  RecommendationStyle,
} from "./JobCardTypes";

export function resetPageOverflow() {
  if (typeof document === "undefined") return;

  document.body.style.overflow = "";
  document.documentElement.style.overflow = "";
}

export function isMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(max-width: 767px)").matches;
}

export function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim().replace(",", ".");
    const numericText = normalized.match(/-?\d+(\.\d+)?/)?.[0];
    const parsed = numericText ? Number(numericText) : Number(normalized);

    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

export function getDateTime(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return 0;

  const swissDate = text.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (swissDate) {
    const [, day, month, year] = swissDate;
    const parsed = new Date(
      Number(year),
      Number(month) - 1,
      Number(day)
    ).getTime();

    return Number.isFinite(parsed) ? parsed : 0;
  }

  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatDate(value: unknown) {
  const time = getDateTime(value);
  if (!time) return "";

  return new Intl.DateTimeFormat("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(time));
}

function normalizeWorkload(value: string) {
  return value.replace(/\s+/g, "").replace(/-/g, "–").trim();
}

export function extractWorkloadFromTitle(title: string) {
  const cleanTitle = title.trim();

  const parenthesisMatch = cleanTitle.match(
    /\s*\((\d{1,3}\s*(?:[-–]\s*\d{1,3})?\s*%)\)\s*$/
  );

  if (parenthesisMatch) {
    return {
      title: cleanTitle.replace(parenthesisMatch[0], "").trim(),
      workload: normalizeWorkload(parenthesisMatch[1]),
    };
  }

  const trailingMatch = cleanTitle.match(
    /\s+(\d{1,3}\s*(?:[-–]\s*\d{1,3})?\s*%)\s*$/
  );

  if (trailingMatch) {
    return {
      title: cleanTitle.replace(trailingMatch[0], "").trim(),
      workload: normalizeWorkload(trailingMatch[1]),
    };
  }

  return {
    title: cleanTitle,
    workload: "",
  };
}

export function getExplicitWorkload(job: JobWithOptionalFields) {
  return (
    job.workload ||
    job.workloadPercent ||
    job.employmentLevel ||
    job.pensum ||
    ""
  ).trim();
}

export function cleanAnalysisText(text?: string) {
  if (!text) return "";

  return text
    .replace(/\*\*/g, "")
    .replace(/###/g, "")
    .replace(/---/g, "")
    .replace(/\r/g, "")
    .trim();
}

export function cleanBullet(line: string) {
  return line
    .replace(/^[-•*]\s*/, "")
    .replace(/^(\d+\.|\d+\))\s*/, "")
    .trim();
}

export function isSectionTitle(line: string) {
  const lower = line.toLowerCase();

  return (
    line.endsWith(":") ||
    lower.includes("match score") ||
    lower.includes("kurzfazit") ||
    lower.includes("passung") ||
    lower.includes("kritische") ||
    lower.includes("risiken") ||
    lower.includes("realistische chance") ||
    lower.includes("empfehlung") ||
    lower.includes("begründung") ||
    lower.includes("positionierung") ||
    lower.includes("bewerbungsstrategie") ||
    lower.includes("direkter tipp") ||
    lower.includes("warum")
  );
}

export function getAnalysisSummary(text?: string) {
  const clean = cleanAnalysisText(text);

  if (!clean) return "";

  const firstUsefulLine = clean
    .split("\n")
    .map((line) => line.trim())
    .find((line) => {
      if (!line) return false;
      if (line.startsWith("-") || line.startsWith("•")) return false;
      if (isSectionTitle(line)) return false;
      return line.length > 18;
    });

  return (
    firstUsefulLine ||
    "AI analysis completed. Review the detailed recommendation below."
  );
}

export function getRecommendationStyle(text?: string): RecommendationStyle {
  const lower = (text || "").toLowerCase();

  if (
    lower.includes("nicht bewerben") ||
    lower.includes("abraten") ||
    lower.includes("geringe chance") ||
    lower.includes("schwache passung")
  ) {
    return {
      label: "Review carefully",
      background: "rgba(239,68,68,0.12)",
      border: "1px solid rgba(239,68,68,0.26)",
      color: "#991b1b",
    };
  }

  if (
    lower.includes("bewerben") ||
    lower.includes("hohe chance") ||
    lower.includes("sehr gut") ||
    lower.includes("starke passung")
  ) {
    return {
      label: "Recommended",
      background: "rgba(34,197,94,0.14)",
      border: "1px solid rgba(34,197,94,0.3)",
      color: "#166534",
    };
  }

  return {
    label: "AI reviewed",
    background: "rgba(37,99,235,0.12)",
    border: "1px solid rgba(37,99,235,0.24)",
    color: "#1d4ed8",
  };
}

export function getDistanceLabel(distanceScore: number) {
  if (distanceScore >= 90) return "Very close";
  if (distanceScore >= 75) return "Good distance";
  if (distanceScore >= 60) return "Reachable";
  if (distanceScore > 0) return "Farther away";
  return "";
}

function getCompactDistanceLabel(distanceScore: number) {
  if (distanceScore >= 90) return "Very close";
  if (distanceScore >= 75) return "Close";
  if (distanceScore >= 60) return "Reachable";
  if (distanceScore > 0) return "Far";
  return "";
}

export function getRecencyLabel(job: JobWithOptionalFields) {
  const publishedDate = formatDate(job.publishedDate);
  if (publishedDate) return `Published ${publishedDate}`;

  const recencyScore = toNumber(job.recencyScore);

  if (recencyScore >= 14) return "Very recent";
  if (recencyScore >= 8) return "Recent";
  if (recencyScore > 0) return "Fresh enough";

  return "";
}

export function isNewSavedJob(job: JobWithOptionalFields) {
  if (job.uiDecisionSection === "new") return true;

  const savedAt = getDateTime(job.savedAt);
  if (!savedAt) return false;

  const oneDayMs = 24 * 60 * 60 * 1000;
  return Date.now() - savedAt <= oneDayMs;
}

export function getMetaItems(job: JobWithOptionalFields) {
  const items: string[] = [];

  const distanceScore = toNumber(job.distanceScore);
  const requirementMatchScore = toNumber(job.requirementMatchScore);
  const compactDistanceLabel = getCompactDistanceLabel(distanceScore);
  const publishedDate = formatDate(job.publishedDate);

  if (compactDistanceLabel) {
    items.push(compactDistanceLabel);
  }

  if (publishedDate) {
    items.push(`Published ${publishedDate}`);
  }

  if (requirementMatchScore > 0) {
    items.push(`CV match ${requirementMatchScore}`);
  }

  if (job.keyword) {
    items.push(`Reason: ${job.keyword}`);
  }

  return items;
}

export function parseMobileAnalysisSections(
  text: string
): MobileAnalysisSection[] {
  const lines = cleanAnalysisText(text)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const sections: MobileAnalysisSection[] = [];
  let current: MobileAnalysisSection = {
    title: "Key points",
    items: [],
  };

  function pushCurrent() {
    if (current.items.length > 0) {
      sections.push({
        title: current.title,
        items: current.items.slice(0, 2),
      });
    }
  }

  for (const line of lines) {
    if (/^\d{1,3}\s*%$/.test(line)) continue;

    const headingMatch = line.match(/^([^:]{2,62}):\s*(.*)$/);

    if (headingMatch) {
      pushCurrent();

      current = {
        title: headingMatch[1].trim(),
        items: [],
      };

      if (headingMatch[2]?.trim()) {
        current.items.push(cleanBullet(headingMatch[2]));
      }

      continue;
    }

    if (isSectionTitle(line) && line.length < 72) {
      pushCurrent();

      current = {
        title: line.replace(/:$/, "").trim(),
        items: [],
      };

      continue;
    }

    current.items.push(cleanBullet(line));
  }

  pushCurrent();

  if (sections.length === 0) {
    return [
      {
        title: "Details",
        items: lines.slice(0, 2).map(cleanBullet),
      },
    ];
  }

  return sections.slice(0, 6);
}
