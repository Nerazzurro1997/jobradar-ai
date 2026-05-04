type SectionKind =
  | "score"
  | "summary"
  | "fit"
  | "risks"
  | "chance"
  | "recommendation"
  | "reason"
  | "positioning"
  | "strategy"
  | "tip"
  | "generic";

type Section = {
  kind: SectionKind;
  title: string;
  icon: string;
  color: string;
  background: string;
  border: string;
  lines: string[];
  bullets: string[];
};

type SectionConfig = {
  icon: string;
  title: string;
  color: string;
  background: string;
  border: string;
};

function cleanAnalysisText(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/###/g, "")
    .replace(/---/g, "")
    .replace(/\r/g, "")
    .trim();
}

function cleanLine(line: string) {
  return line
    .replace(/\*\*/g, "")
    .replace(/###/g, "")
    .replace(/---/g, "")
    .trim();
}

function cleanBullet(line: string) {
  return line
    .replace(/^[-•*]\s*/, "")
    .replace(/^(\d+\.|\d+\))\s*/, "")
    .trim();
}

function isBullet(line: string) {
  return (
    line.startsWith("-") ||
    line.startsWith("•") ||
    line.startsWith("*") ||
    /^(\d+\.|\d+\))\s/.test(line)
  );
}

function isStandaloneScoreLine(line: string) {
  return /^\d{1,3}\s*%$/.test(line.trim());
}

function getSectionConfig(kind: SectionKind) {
  const configs: Record<SectionKind, SectionConfig> = {
    score: {
      icon: "📊",
      title: "Match Score",
      color: "#166534",
      background: "rgba(34,197,94,0.12)",
      border: "1px solid rgba(34,197,94,0.28)",
    },
    summary: {
      icon: "🧾",
      title: "Kurzfazit",
      color: "#1d4ed8",
      background: "rgba(37,99,235,0.10)",
      border: "1px solid rgba(37,99,235,0.24)",
    },
    fit: {
      icon: "💡",
      title: "Passung",
      color: "#1d4ed8",
      background: "rgba(59,130,246,0.10)",
      border: "1px solid rgba(59,130,246,0.24)",
    },
    risks: {
      icon: "⚠️",
      title: "Kritische Punkte",
      color: "#b45309",
      background: "rgba(245,158,11,0.12)",
      border: "1px solid rgba(245,158,11,0.28)",
    },
    chance: {
      icon: "📈",
      title: "Realistische Chance",
      color: "#166534",
      background: "rgba(34,197,94,0.10)",
      border: "1px solid rgba(34,197,94,0.24)",
    },
    recommendation: {
      icon: "🎯",
      title: "Empfehlung",
      color: "#7c3aed",
      background: "rgba(124,58,237,0.10)",
      border: "1px solid rgba(124,58,237,0.24)",
    },
    reason: {
      icon: "✅",
      title: "Begründung",
      color: "#166534",
      background: "rgba(34,197,94,0.10)",
      border: "1px solid rgba(34,197,94,0.24)",
    },
    positioning: {
      icon: "🧭",
      title: "Positionierung der Bewerbung",
      color: "#1d4ed8",
      background: "rgba(37,99,235,0.10)",
      border: "1px solid rgba(37,99,235,0.24)",
    },
    strategy: {
      icon: "📝",
      title: "Bewerbungsstrategie",
      color: "#0f766e",
      background: "rgba(20,184,166,0.10)",
      border: "1px solid rgba(20,184,166,0.24)",
    },
    tip: {
      icon: "🔥",
      title: "Direkter Tipp",
      color: "#be123c",
      background: "rgba(244,63,94,0.10)",
      border: "1px solid rgba(244,63,94,0.24)",
    },
    generic: {
      icon: "•",
      title: "Analyse",
      color: "#334155",
      background: "rgba(100,116,139,0.08)",
      border: "1px solid rgba(100,116,139,0.18)",
    },
  };

  return configs[kind];
}

function createSection(kind: SectionKind, customTitle?: string): Section {
  const config = getSectionConfig(kind);

  return {
    kind,
    title: customTitle || config.title,
    icon: config.icon,
    color: config.color,
    background: config.background,
    border: config.border,
    lines: [],
    bullets: [],
  };
}

function getHeading(line: string):
  | {
      kind: SectionKind;
      value: string;
      customTitle?: string;
    }
  | null {
  const normalized = line.trim();

  const matchWithValue = (
    regex: RegExp,
    kind: SectionKind,
    customTitle?: string
  ) => {
    const match = normalized.match(regex);
    if (!match) return null;

    return {
      kind,
      value: (match[1] || "").trim(),
      customTitle,
    };
  };

  const scoreMatch = normalized.match(/^match\s*score\s*:?\s*(.*)$/i);
  if (scoreMatch) {
    return {
      kind: "score",
      value: (scoreMatch[1] || "").trim(),
    };
  }

  const summary =
    matchWithValue(/^kurzfazit\s*:?\s*(.*)$/i, "summary") ||
    matchWithValue(/^summary\s*:?\s*(.*)$/i, "summary");
  if (summary) return summary;

  const fit =
    matchWithValue(/^passung\s*:?\s*(.*)$/i, "fit") ||
    matchWithValue(/^warum\s*:?\s*(.*)$/i, "fit") ||
    matchWithValue(/^warum passt.*?:?\s*(.*)$/i, "fit");
  if (fit) return fit;

  const risks =
    matchWithValue(/^kritische punkte\s*:?\s*(.*)$/i, "risks") ||
    matchWithValue(/^risiken\s*:?\s*(.*)$/i, "risks") ||
    matchWithValue(/^risk.*?:?\s*(.*)$/i, "risks");
  if (risks) return risks;

  const chance =
    matchWithValue(/^realistische chance\s*:?\s*(.*)$/i, "chance") ||
    matchWithValue(/^chance\s*:?\s*(.*)$/i, "chance");
  if (chance) return chance;

  const recommendation =
    matchWithValue(/^empfehlung\s*:?\s*(.*)$/i, "recommendation") ||
    matchWithValue(/^recommendation\s*:?\s*(.*)$/i, "recommendation");
  if (recommendation) return recommendation;

  const reason = matchWithValue(/^begründung\s*:?\s*(.*)$/i, "reason");
  if (reason) return reason;

  const positioning =
    matchWithValue(
      /^positionierung der bewerbung\s*:?\s*(.*)$/i,
      "positioning"
    ) || matchWithValue(/^positionierung\s*:?\s*(.*)$/i, "positioning");
  if (positioning) return positioning;

  const strategy =
    matchWithValue(/^bewerbungsstrategie\s*:?\s*(.*)$/i, "strategy") ||
    matchWithValue(/^strategie\s*:?\s*(.*)$/i, "strategy");
  if (strategy) return strategy;

  const tip =
    matchWithValue(/^direkter tipp\s*:?\s*(.*)$/i, "tip") ||
    matchWithValue(/^tipp\s*:?\s*(.*)$/i, "tip");
  if (tip) return tip;

  if (normalized.endsWith(":") && normalized.length < 70) {
    return {
      kind: "generic",
      value: "",
      customTitle: normalized.replace(/:$/, "").trim(),
    };
  }

  return null;
}

function parseAnalysisSections(text: string) {
  const lines = cleanAnalysisText(text)
    .split("\n")
    .map(cleanLine)
    .filter(Boolean);

  const sections: Section[] = [];
  const sectionByKind = new Map<SectionKind, Section>();
  let currentSection: Section | null = null;

  const getOrCreateSection = (kind: SectionKind, customTitle?: string) => {
    const existing = sectionByKind.get(kind);

    if (existing) {
      currentSection = existing;
      return existing;
    }

    const section = createSection(kind, customTitle);
    sections.push(section);
    sectionByKind.set(kind, section);
    currentSection = section;
    return section;
  };

  for (const line of lines) {
    if (isStandaloneScoreLine(line)) {
      continue;
    }

    const heading = getHeading(line);

    if (heading) {
      if (heading.kind === "score") {
        currentSection = null;
        continue;
      }

      const section = getOrCreateSection(heading.kind, heading.customTitle);

      if (heading.value) {
        if (isStandaloneScoreLine(heading.value)) {
          continue;
        }

        if (isBullet(heading.value)) {
          section.bullets.push(cleanBullet(heading.value));
        } else {
          section.lines.push(heading.value);
        }
      }

      continue;
    }

    if (!currentSection) {
      currentSection = getOrCreateSection("summary");
    }

    if (isBullet(line)) {
      currentSection.bullets.push(cleanBullet(line));
    } else {
      currentSection.lines.push(line);
    }
  }

  return sections.filter(
    (section) => section.lines.length > 0 || section.bullets.length > 0
  );
}

function isPureRecommendationValue(text: string) {
  const lower = text.trim().toLowerCase();

  return (
    lower === "bewerben" ||
    lower === "nicht bewerben" ||
    lower === "prüfen" ||
    lower === "bedingt bewerben" ||
    lower === "apply" ||
    lower === "do not apply" ||
    lower === "review"
  );
}

function getRecommendationText(text: string) {
  const lower = text.trim().toLowerCase();

  if (lower === "bewerben" || lower === "apply") {
    return "Bewerben";
  }

  if (lower === "nicht bewerben" || lower === "do not apply") {
    return "Nicht bewerben";
  }

  if (lower === "prüfen" || lower === "review") {
    return "Prüfen";
  }

  if (lower === "bedingt bewerben") {
    return "Bedingt bewerben";
  }

  return text;
}

function renderContentCard({
  text,
  section,
  index,
}: {
  text: string;
  section: Section;
  index: number;
}) {
  const displayText =
    section.kind === "recommendation" && isPureRecommendationValue(text)
      ? getRecommendationText(text)
      : text;

  return (
    <div
      key={`${section.kind}-content-${index}-${text.slice(0, 20)}`}
      style={{
        display: "grid",
        gridTemplateColumns: "24px 1fr",
        gap: 10,
        alignItems: "start",
        padding: "11px 13px",
        borderRadius: 14,
        background: "rgba(255,255,255,0.58)",
        border: "1px solid rgba(148,163,184,0.18)",
      }}
    >
      <span
        style={{
          color: section.color,
          fontWeight: 950,
          lineHeight: 1.5,
        }}
      >
        ✓
      </span>

      <span
        style={{
          color: "#334155",
          fontSize: 14,
          lineHeight: 1.62,
          fontWeight: 600,
        }}
      >
        {displayText}
      </span>
    </div>
  );
}

function renderSection(section: Section, index: number) {
  return (
    <div
      key={`${section.kind}-${index}`}
      style={{
        display: "grid",
        gap: 10,
      }}
    >
      <div
        style={{
          padding: "12px 14px",
          borderRadius: 16,
          background: section.background,
          border: section.border,
        }}
      >
        <h3
          style={{
            margin: 0,
            color: section.color,
            fontSize: 17,
            letterSpacing: -0.2,
          }}
        >
          {section.icon} {section.title}
        </h3>
      </div>

      {section.lines.map((line, lineIndex) =>
        renderContentCard({
          text: line,
          section,
          index: lineIndex,
        })
      )}

      {section.bullets.length > 0 && (
        <div
          style={{
            display: "grid",
            gap: 8,
          }}
        >
          {section.bullets.map((bullet, bulletIndex) =>
            renderContentCard({
              text: bullet,
              section,
              index: bulletIndex,
            })
          )}
        </div>
      )}
    </div>
  );
}

export function renderAnalysis(text: string) {
  if (text === "⏳ Analisi in corso...") {
    return (
      <p style={{ fontWeight: 800, color: "#0f172a" }}>
        ⏳ Analisi in corso...
      </p>
    );
  }

  const sections = parseAnalysisSections(text);

  if (sections.length === 0) {
    return (
      <div
        style={{
          padding: 14,
          borderRadius: 14,
          background: "rgba(255,255,255,0.58)",
          border: "1px solid rgba(148,163,184,0.18)",
          color: "#334155",
          fontSize: 14,
          lineHeight: 1.65,
          fontWeight: 600,
        }}
      >
        {cleanAnalysisText(text)}
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: 16 }}>
      {sections.map((section, index) => renderSection(section, index))}
    </div>
  );
}
