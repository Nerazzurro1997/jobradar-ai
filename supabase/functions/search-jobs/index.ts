const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type CvProfile = {
  searchTerms: string[];
  strongKeywords: string[];
  avoidKeywords: string[];
  locations: string[];
  profileSummary: string;
  skillTags?: string[];
  cvHighlights?: string[];
  languageProfile?: {
    languages?: string[];
    strongestLanguages?: string[];
    businessLanguages?: string[];
    languageKeywords?: string[];
    languageSummary?: string;
  };
  search?: {
    searchTerms?: string[];
    strongKeywords?: string[];
    preferredRoles?: string[];
    preferredLocations?: string[];
    avoidRoles?: string[];
  };
  matching?: {
    bestFitRoles?: string[];
    acceptableRoles?: string[];
    weakFitRoles?: string[];
    dealBreakers?: string[];
    sellingPoints?: string[];
    scoringHints?: string[];
    applicationPositioning?: string[];
  };
  skills?:
    | string[]
    | {
        hardSkills?: string[];
        softSkills?: string[];
        tools?: string[];
        languages?: string[];
        certifications?: string[];
      };
  deepProfile?: any;
};

type Job = {
  id: number;
  title: string;
  company: string;
  location: string;
  url: string;
  snippet?: string;
  fullDescription?: string;
  highlights?: string[];
  riskFlags?: string[];
  previewSummary?: string;
  keyword?: string;
  score?: number;
  publishedDate?: string;
  matchedKeywords?: string[];
  missingKeywords?: string[];
  fitLabel?: string;
  source?: string;
  sourceName?: string;
  recencyScore?: number;
  requirementMatchScore?: number;
  distanceScore?: number;
  distanceKm?: number | null;
  distanceSource?: "geocoded" | "remote" | "fallback";
  ageDays?: number | null;
  requirements?: string[];
  responsibilities?: string[];
  benefits?: string[];
  extractedRequirementsCount?: number;
  requirementMismatchFlags?: string[];
};

type SearchQuery = {
  term: string;
  source: "cv-direct" | "cv-expanded" | "fallback";
  weight: number;
};

type SearchHit = {
  url: string;
  keyword: string;
  query: SearchQuery;
  title?: string;
  company?: string;
  location?: string;
  snippet?: string;
  publishedDate?: string;
  sourceKind?: "search-card" | "search-link" | "search-json";
};

type FetchHtmlResult = {
  ok: boolean;
  status: number;
  html: string;
  finalUrl: string;
};

type Coordinates = {
  lat: number;
  lon: number;
};

type SearchDiscardReason =
  | "duplicate"
  | "missingTitle"
  | "missingCompany"
  | "scoreTooLow"
  | "invalidUrl"
  | "noDetail"
  | "timeout";

type SearchRunDebugStats = {
  runId: string;
  searchPagesAttempted: number;
  totalLinksBeforeDedup: number;
  linkDuplicates: number;
  discardReasons: Record<SearchDiscardReason, number>;
};

const geocodeCache = new Map<string, Coordinates | null>();
const geocodeInFlightCache = new Map<string, Promise<Coordinates | null>>();

type SearchWave = {
  id: number;
  name: string;
  queries: SearchQuery[];
  locations: string[];
  maxPages: number;
  targetLinks: number;
  candidateLimit: number;
  detailLimit: number;
  allowFallbackJobs: boolean;
};

type JobWaveMetadata = {
  id: number;
  name: string;
};

function createRunId() {
  return crypto.randomUUID().slice(0, 8);
}

function createSearchRunDebugStats(runId: string): SearchRunDebugStats {
  return {
    runId,
    searchPagesAttempted: 0,
    totalLinksBeforeDedup: 0,
    linkDuplicates: 0,
    discardReasons: {
      duplicate: 0,
      missingTitle: 0,
      missingCompany: 0,
      scoreTooLow: 0,
      invalidUrl: 0,
      noDetail: 0,
      timeout: 0,
    },
  };
}

function incrementDiscardReason(
  debugStats: SearchRunDebugStats,
  reason: SearchDiscardReason
) {
  debugStats.discardReasons[reason]++;
}

function getFetchFailureReason(error: unknown) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "timeout";
  }

  if (
    error instanceof Error &&
    /abort|timeout|timed out/i.test(`${error.name} ${error.message}`)
  ) {
    return "timeout";
  }

  return "fetch_error";
}

function cleanText(value: unknown = "") {
  return String(value ?? "")
    .replace(/\\u002F/g, "/")
    .replace(/\\u00e4/gi, "ä")
    .replace(/\\u00f6/gi, "ö")
    .replace(/\\u00fc/gi, "ü")
    .replace(/\\u00c4/g, "Ä")
    .replace(/\\u00d6/g, "Ö")
    .replace(/\\u00dc/g, "Ü")
    .replace(/\\u00df/gi, "ß")
    .replace(/\\"/g, '"')
    .replace(/<br\s*\/?>/gi, ". ")
    .replace(/<\/p>/gi, ". ")
    .replace(/<\/li>/gi, ". ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&auml;/g, "ä")
    .replace(/&ouml;/g, "ö")
    .replace(/&uuml;/g, "ü")
    .replace(/&Auml;/g, "Ä")
    .replace(/&Ouml;/g, "Ö")
    .replace(/&Uuml;/g, "Ü")
    .replace(/&szlig;/g, "ß")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeUrl(url = "") {
  let cleaned = cleanText(url)
    .replace(/\\\//g, "/")
    .replace(/^https?:\/www\./i, "https://www.")
    .split("#")[0]
    .split("?")[0]
    .replace(/\/$/, "")
    .trim();

  try {
    cleaned = decodeURI(cleaned);
  } catch {
    // Keep the original URL if decoding fails.
  }

  return cleaned;
}

function safeArray(value: unknown, limit = 30): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function uniqueArray(items: string[], limit = 50): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of items) {
    const cleaned = cleanText(item);
    const key = cleaned.toLowerCase();

    if (!cleaned || seen.has(key)) continue;

    seen.add(key);
    result.push(cleaned);

    if (result.length >= limit) break;
  }

  return result;
}

function normalizeProfile(profile: any): CvProfile | null {
  if (!profile || typeof profile !== "object") return null;

  const skillsValue = profile.skills;

  const nestedSearch = profile.search || profile.deepProfile?.search || {};
  const nestedMatching =
    profile.matching || profile.deepProfile?.matching || {};

  const languageProfile =
    profile.languageProfile || profile.deepProfile?.languageProfile || {};

  const searchTerms = uniqueArray(
    [
      ...safeArray(profile.searchTerms, 20),
      ...safeArray(nestedSearch.searchTerms, 20),
      ...safeArray(nestedSearch.preferredRoles, 20),
      ...safeArray(nestedMatching.bestFitRoles, 20),
      ...safeArray(nestedMatching.acceptableRoles, 20),
    ],
    30
  );

  const strongKeywords = uniqueArray(
    [
      ...safeArray(profile.strongKeywords, 60),
      ...safeArray(nestedSearch.strongKeywords, 60),
      ...safeArray(profile.skillTags, 40),
      ...(Array.isArray(skillsValue) ? safeArray(skillsValue, 40) : []),
      ...(!Array.isArray(skillsValue)
        ? safeArray(skillsValue?.hardSkills, 40)
        : []),
      ...(!Array.isArray(skillsValue)
        ? safeArray(skillsValue?.softSkills, 30)
        : []),
      ...(!Array.isArray(skillsValue)
        ? safeArray(skillsValue?.tools, 30)
        : []),
      ...(!Array.isArray(skillsValue)
        ? safeArray(skillsValue?.certifications, 20)
        : []),
      ...safeArray(languageProfile.languages, 20),
      ...safeArray(languageProfile.languageKeywords, 20),
    ],
    90
  );

  const avoidKeywords = uniqueArray(
    [
      ...safeArray(profile.avoidKeywords, 50),
      ...safeArray(nestedSearch.avoidKeywords, 50),
      ...safeArray(nestedSearch.avoidRoles, 30),
      ...safeArray(nestedMatching.weakFitRoles, 30),
      ...safeArray(nestedMatching.dealBreakers, 30),
    ],
    70
  );

  const locations = uniqueArray(
    [
      ...safeArray(profile.locations, 15),
      ...safeArray(nestedSearch.preferredLocations, 15),
    ],
    15
  );

  return {
    searchTerms,
    strongKeywords,
    avoidKeywords,
    locations: locations.length > 0 ? locations : ["Zürich"],
    profileSummary:
      typeof profile.profileSummary === "string" ? profile.profileSummary : "",
    skillTags: safeArray(profile.skillTags, 40),
    cvHighlights: safeArray(profile.cvHighlights, 20),
    languageProfile,
    search: nestedSearch,
    matching: nestedMatching,
    skills: skillsValue,
    deepProfile: profile.deepProfile,
  };
}

function splitSentences(text = "") {
  return cleanText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 30 && sentence.length <= 260);
}

function includesAny(text: string, words: string[]) {
  const lower = text.toLowerCase();
  return words.some((word) => word && lower.includes(word.toLowerCase()));
}

function normalizeForKeywordMatch(value: unknown = "") {
  return cleanText(value)
    .toLowerCase()
    .replace(/Ã¤|ä/g, "ae")
    .replace(/Ã¶|ö/g, "oe")
    .replace(/Ã¼|ü/g, "ue")
    .replace(/Ã„|Ä/g, "ae")
    .replace(/Ã–|Ö/g, "oe")
    .replace(/Ãœ|Ü/g, "ue")
    .replace(/ÃŸ|ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesNormalizedTerm(text: string, term: string) {
  const normalizedText = ` ${normalizeForKeywordMatch(text)} `;
  const normalizedTerm = normalizeForKeywordMatch(term);

  return Boolean(
    normalizedTerm && normalizedText.includes(` ${normalizedTerm} `)
  );
}

function findNormalizedMatches(text: string, terms: string[]) {
  const normalizedText = ` ${normalizeForKeywordMatch(text)} `;

  return terms.filter((term) => {
    const normalizedTerm = normalizeForKeywordMatch(term);
    return Boolean(
      normalizedTerm && normalizedText.includes(` ${normalizedTerm} `)
    );
  });
}

type JobSectionKind = "requirements" | "responsibilities" | "benefits";

type ExtractedJobSections = {
  requirements: string[];
  responsibilities: string[];
  benefits: string[];
};

type SectionParsingStats = {
  sectionParsingSkipped: number;
  sectionParsingFailed: number;
  sectionParsingUsed: number;
};

const sectionHeadingLabels: Record<JobSectionKind, string[]> = {
  requirements: [
    "anforderungen",
    "profil",
    "dein profil",
    "ihr profil",
    "du bringst mit",
    "das bringst du mit",
    "das bringen sie mit",
    "du bringst folgende faehigkeiten mit",
    "was du mitbringst",
    "voraussetzungen",
    "deine skills",
    "skills",
    "qualifikationen",
    "kompetenzen",
  ],
  responsibilities: [
    "aufgaben",
    "deine aufgaben",
    "ihre aufgaben",
    "dein aufgabenbereich",
    "ihr aufgabenbereich",
    "taetigkeiten",
    "verantwortlichkeiten",
    "was du machst",
    "was sie erwartet",
    "job description",
    "responsibilities",
  ],
  benefits: [
    "benefits",
    "wir bieten",
    "das bieten wir",
    "was wir bieten",
    "deine vorteile",
    "ihre vorteile",
    "angebot",
    "unser angebot",
    "darauf kannst du dich freuen",
  ],
};

function decodeStructuredText(value: unknown = "") {
  let text = cleanText(value).slice(0, 2500);
  const headingLabels = Object.values(sectionHeadingLabels)
    .flat()
    .sort((a, b) => b.length - a.length)
    .slice(0, 36);

  for (const label of headingLabels) {
    const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`\\b${escapedLabel}\\b`, "gi"), `\n${label}:`);
  }

  return text;
}

function cleanSectionLine(line = "") {
  return cleanText(line)
    .replace(/^[-*•·–—]+\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getSectionHeadingKind(line: string): JobSectionKind | null {
  const normalized = normalizeForKeywordMatch(line);

  if (!normalized) return null;

  for (const [kind, labels] of Object.entries(sectionHeadingLabels) as [
    JobSectionKind,
    string[]
  ][]) {
    for (const label of labels) {
      const normalizedLabel = normalizeForKeywordMatch(label);

      if (!normalizedLabel) continue;

      if (normalized === normalizedLabel) return kind;

      if (
        normalized.startsWith(`${normalizedLabel} `) &&
        normalized.length <= normalizedLabel.length + 90
      ) {
        return kind;
      }

      if (
        normalized.includes(` ${normalizedLabel} `) &&
        normalized.length <= normalizedLabel.length + 40
      ) {
        return kind;
      }
    }
  }

  return null;
}

function getHeadingRemainder(line: string) {
  const separators = [":", "-", "–", "—"];

  for (const separator of separators) {
    const index = line.indexOf(separator);

    if (index > 0 && index < 120) {
      return cleanSectionLine(line.slice(index + separator.length));
    }
  }

  const normalized = normalizeForKeywordMatch(line);

  for (const labels of Object.values(sectionHeadingLabels)) {
    for (const label of labels) {
      const normalizedLabel = normalizeForKeywordMatch(label);

      if (
        normalizedLabel &&
        normalized.startsWith(`${normalizedLabel} `) &&
        normalized.length > normalizedLabel.length + 12
      ) {
        return cleanSectionLine(line);
      }
    }
  }

  return "";
}

function addSectionItem(items: string[], line: string, limit = 8) {
  const cleaned = cleanSectionLine(line);

  if (!cleaned || cleaned.length < 4) return;
  if (/^(m\/w\/d|w\/m\/d|job|jobs|bewerben|jetzt bewerben)$/i.test(cleaned)) {
    return;
  }

  const sentenceChunks = splitSentences(cleaned).slice(0, 2);
  const chunks =
    cleaned.length > 280 && sentenceChunks.length > 0
      ? sentenceChunks
      : [cleaned];

  for (const chunk of chunks) {
    const item = cleanSectionLine(chunk).slice(0, 320);
    const key = item.toLowerCase();

    if (!item || items.some((existing) => existing.toLowerCase() === key)) {
      continue;
    }

    items.push(item);

    if (items.length >= limit) break;
  }
}

function emptyJobSections(): ExtractedJobSections {
  return {
    requirements: [],
    responsibilities: [],
    benefits: [],
  };
}

function skipSectionParsing(stats?: SectionParsingStats) {
  if (stats) stats.sectionParsingSkipped++;
  return emptyJobSections();
}

function extractJobSections(
  source: unknown,
  stats?: SectionParsingStats,
  options: { allowShortText?: boolean } = {}
): ExtractedJobSections {
  const sections: ExtractedJobSections = {
    requirements: [],
    responsibilities: [],
    benefits: [],
  };

  try {
    const structuredText = decodeStructuredText(source);

    if (
      !structuredText ||
      (!options.allowShortText && structuredText.length < 120)
    ) {
      return skipSectionParsing(stats);
    }

    const lines = structuredText
      .replace(/[•·]/g, "\n")
      .replace(/\s+-\s+/g, "\n")
      .split(/[\n.!?]+/)
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 90);
    let currentSection: JobSectionKind | null = null;

    for (const line of lines) {
      const cleaned = cleanSectionLine(line);
      if (!cleaned) continue;

      const headingKind = getSectionHeadingKind(cleaned);

      if (headingKind) {
        currentSection = headingKind;

        const remainder = getHeadingRemainder(cleaned);
        if (remainder) {
          addSectionItem(
            sections[currentSection],
            remainder,
            currentSection === "benefits" ? 6 : 8
          );
        }

        continue;
      }

      if (!currentSection) continue;

      addSectionItem(
        sections[currentSection],
        cleaned,
        currentSection === "benefits" ? 6 : 8
      );
    }

    const parsedSections = {
      requirements: uniqueArray(sections.requirements, 8),
      responsibilities: uniqueArray(sections.responsibilities, 8),
      benefits: uniqueArray(sections.benefits, 6),
    };

    if (
      parsedSections.requirements.length > 0 ||
      parsedSections.responsibilities.length > 0 ||
      parsedSections.benefits.length > 0
    ) {
      if (stats) stats.sectionParsingUsed++;
    } else if (stats) {
      stats.sectionParsingSkipped++;
    }

    return parsedSections;
  } catch {
    if (stats) stats.sectionParsingFailed++;
    return emptyJobSections();
  }
}

function createJobInsights(text = "", title = "") {
  const clean = cleanText(text);
  const titleLower = title.toLowerCase();
  const allText = `${title} ${clean}`.toLowerCase();
  const sentences = splitSentences(clean);

  const positiveWords = [
    "versicherung",
    "versicherungs",
    "innendienst",
    "sachbearbeiter",
    "kundenberatung",
    "kundenberater",
    "kundenservice",
    "backoffice",
    "administration",
    "policen",
    "offerten",
    "mutationen",
    "anträge",
    "schaden",
    "broker",
    "underwriting",
    "homeoffice",
    "team",
    "crm",
    "beratung",
    "office",
    "support",
    "koordination",
  ];

  const scored = sentences
    .map((sentence) => {
      const lower = sentence.toLowerCase();
      let score = 0;

      for (const word of positiveWords) {
        if (lower.includes(word)) score += 3;
      }

      if (lower.includes("aufgaben")) score += 5;
      if (lower.includes("profil")) score += 4;
      if (lower.includes("anforderungen")) score += 4;
      if (lower.includes("ihre aufgaben")) score += 6;
      if (lower.includes("das bringen sie mit")) score += 5;
      if (lower.includes("wir bieten")) score += 2;

      if (titleLower.includes("versicherung") && lower.includes("versicherung")) {
        score += 4;
      }

      if (lower.includes("wir sind") || lower.includes("über uns")) {
        score -= 2;
      }

      return { sentence, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);

  const highlights = scored.slice(0, 3).map((item) => item.sentence);
  const riskFlags: string[] = [];

  const hasAussendienst =
    titleLower.includes("aussendienst") ||
    allText.includes("aussendienst") ||
    allText.includes("im aussendienst");

  const hasProvisionPressure =
    allText.includes("provision") ||
    allText.includes("provisionsbasis") ||
    allText.includes("kaltakquise") ||
    allText.includes("verkaufsziele") ||
    allText.includes("hunter") ||
    allText.includes("door to door");

  const isClearlySenior =
    titleLower.includes("teamleiter") ||
    titleLower.includes("leiter ") ||
    titleLower.startsWith("leiter") ||
    titleLower.includes("head of") ||
    titleLower.includes("senior manager") ||
    titleLower.includes("bereichsleiter") ||
    titleLower.includes("abteilungsleiter");

  const isTemporary =
    allText.includes("temporär") ||
    allText.includes("befristet") ||
    allText.includes("temporary") ||
    allText.includes("contract role");

  const isWrongEntryLevel =
    titleLower.includes("praktikum") ||
    titleLower.includes("lehrstelle") ||
    titleLower.includes("lernende") ||
    allText.includes("praktikum") ||
    allText.includes("lehrstelle") ||
    allText.includes("lernende");

  if (hasAussendienst) riskFlags.push("Aussendienst Anteil prüfen");
  if (hasProvisionPressure) {
    riskFlags.push("Möglicher Verkaufs oder Provisionsdruck");
  }
  if (isClearlySenior) {
    riskFlags.push("Seniorität oder Führungserfahrung prüfen");
  }
  if (isWrongEntryLevel) {
    riskFlags.push("Einstiegslevel passt vermutlich nicht");
  }
  if (isTemporary) {
    riskFlags.push("Anstellung könnte befristet sein");
  }

  const fallbackHighlights =
    highlights.length > 0
      ? highlights
      : clean
      ? [clean.slice(0, 260)]
      : ["Diese Stelle wurde aus der jobs.ch Suche erkannt."];

  const previewSummary = createPreviewSummary(
    fallbackHighlights,
    riskFlags,
    title
  );

  return {
    highlights: fallbackHighlights,
    riskFlags,
    previewSummary,
    snippet: fallbackHighlights.join(" "),
  };
}

function createPreviewSummary(
  highlights: string[],
  riskFlags: string[],
  title: string
) {
  const lowerTitle = title.toLowerCase();

  if (
    lowerTitle.includes("sachbearbeiter") ||
    lowerTitle.includes("innendienst") ||
    lowerTitle.includes("versicherung")
  ) {
    return riskFlags.length > 0
      ? "Grundsätzlich passend, aber einzelne Punkte sollten geprüft werden."
      : "Sehr passende Stelle im Versicherungs oder Innendienst Umfeld.";
  }

  if (riskFlags.length > 0) {
    return "Interessant, aber mit klaren Risiken für dein Zielprofil.";
  }

  if (highlights.length > 0) {
    return "Relevante Stelle mit prüfbaren Überschneidungen zum Profil.";
  }

  return "Kurzprofil der Stelle konnte nur teilweise erkannt werden.";
}

async function createProfileFromCv(
  fileName: string,
  fileBase64: string
): Promise<CvProfile> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");

  if (!apiKey) {
    throw new Error("OPENAI_API_KEY fehlt in Supabase Secrets");
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Analysiere diesen CV für eine Jobsuche auf jobs.ch in der Schweiz. " +
                "Gib nur JSON zurück. Keine Erklärung. " +
                "Der Kandidat sucht realistische Jobs passend zu Erfahrung, Sprache, Versicherung, Innendienst, Backoffice, Sachbearbeitung, Kundenberatung, Underwriting Assistant, Customer Service oder Administration. " +
                "Gib auch ähnliche realistische Rollen zurück, die nicht exakt gleich heissen, aber aufgrund der Erfahrung passen könnten. " +
                "Vermeide reine Aussendienstjobs, Provisionsrollen, Praktika, Lehrstellen und stark seniorige Führungsstellen, falls keine klare Führungserfahrung im CV steht. " +
                "JSON Format: { searchTerms: string[], strongKeywords: string[], avoidKeywords: string[], locations: string[], profileSummary: string }",
            },
            {
              type: "input_file",
              filename: fileName,
              file_data: `data:application/pdf;base64,${fileBase64}`,
            },
          ],
        },
      ],
    }),
  });

  const data = await response.json();

  const text =
    data?.output?.[0]?.content?.[0]?.text || data?.output_text || "";

  const jsonText = text.replace(/```json/g, "").replace(/```/g, "").trim();
  const parsed = JSON.parse(jsonText);

  return normalizeProfile({
    searchTerms: parsed.searchTerms?.slice(0, 12) || [],
    strongKeywords: parsed.strongKeywords || [],
    avoidKeywords: parsed.avoidKeywords || [],
    locations: parsed.locations || ["Zürich"],
    profileSummary: parsed.profileSummary || "",
  })!;
}

async function fetchHtml(
  url: string,
  timeoutMs = 7500
): Promise<FetchHtmlResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "de-CH,de;q=0.9,en;q=0.8,it;q=0.7",
        "Cache-Control": "no-cache",
      },
    });

    return {
      ok: response.ok,
      status: response.status,
      html: await response.text(),
      finalUrl: response.url || url,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchHtmlWithRetry(
  url: string,
  retries = 1,
  timeoutMs = 7500
) {
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetchHtml(url, timeoutMs);
    } catch (error) {
      lastError = error;

      if (attempt === retries) break;

      await new Promise((resolve) =>
        setTimeout(resolve, 350 * (attempt + 1))
      );
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Fetch failed after retries");
}

function extractLinks(html: string) {
  const links: string[] = [];

  const patterns = [
    /href="([^"]*\/de\/stellenangebote\/detail\/[^"]*)"/g,
    /"url":"([^"]*\/de\/stellenangebote\/detail\/[^"]*)"/g,
    /href=\\"([^"]*\/de\/stellenangebote\/detail\/[^"]*)\\"/g,
    /https:\\\/\\\/www\.jobs\.ch\\\/de\\\/stellenangebote\\\/detail\\\/[^"\\]+/g,
  ];

  for (const regex of patterns) {
    let match;

    while ((match = regex.exec(html)) !== null) {
      let url = match[1] || match[0];

      url = url
        .replace(/\\u002F/g, "/")
        .replace(/\\\//g, "/")
        .replace(/\\"/g, "")
        .replace(/\\/g, "");

      if (!url.startsWith("http")) {
        url = `https://www.jobs.ch${url}`;
      }

      url = normalizeUrl(url);

      if (!links.includes(url)) {
        links.push(url);
      }
    }
  }

  return links;
}

function decodeJsonString(value = "") {
  try {
    return JSON.parse(`"${value.replace(/"/g, '\\"')}"`);
  } catch {
    return value
      .replace(/\\u002F/g, "/")
      .replace(/\\\//g, "/")
      .replace(/\\"/g, '"');
  }
}

function extractJsonValueFromText(text: string, keys: string[]) {
  for (const key of keys) {
    const regex = new RegExp(`"${key}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i");
    const match = text.match(regex);
    const value = match ? cleanText(decodeJsonString(match[1])) : "";

    if (value) return value;
  }

  return "";
}

function getUsefulTitleFromText(text = "") {
  const cleaned = cleanText(text)
    .replace(/\b(jetzt bewerben|bewerben|merken|job speichern)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!cleaned) return "";
  if (cleaned.length < 4 || cleaned.length > 180) return "";
  if (/stellenangebote|jobs\.ch|job mail|login|registrieren/i.test(cleaned)) {
    return "";
  }

  return cleaned;
}

function deriveTitleFromKeyword(keyword = "") {
  const afterColon = keyword.includes(":")
    ? keyword.split(":").slice(1).join(":")
    : keyword;
  const beforeLocation = afterColon.split(" - ")[0] || afterColon;
  return getUsefulTitleFromText(beforeLocation) || "Stellenanzeige auf jobs.ch";
}

function deriveLocationFromKeyword(keyword = "", profile?: CvProfile) {
  const parts = keyword.split(" - ").map((part) => cleanText(part));
  const fromKeyword = parts.length > 1 ? parts[parts.length - 1] : "";

  return (
    getUsefulTitleFromText(fromKeyword) ||
    profile?.locations?.[0] ||
    "Schweiz"
  );
}

function addSearchHit(
  map: Map<string, SearchHit>,
  hit: SearchHit,
  patch: Partial<SearchHit> = {}
) {
  const normalized = normalizeUrl(hit.url);
  const existing = map.get(normalized);

  if (!existing) {
    map.set(normalized, { ...hit, url: normalized, ...patch });
    return;
  }

  map.set(normalized, {
    ...existing,
    title: existing.title || patch.title || hit.title,
    company: existing.company || patch.company || hit.company,
    location: existing.location || patch.location || hit.location,
    snippet: existing.snippet || patch.snippet || hit.snippet,
    publishedDate:
      existing.publishedDate || patch.publishedDate || hit.publishedDate,
    sourceKind: patch.sourceKind || existing.sourceKind || hit.sourceKind,
  });
}

function extractSearchHits(
  html: string,
  keyword: string,
  query: SearchQuery
): SearchHit[] {
  const hitsByUrl = new Map<string, SearchHit>();
  const links = extractLinks(html);

  for (const url of links) {
    addSearchHit(hitsByUrl, {
      url,
      keyword,
      query,
      sourceKind: "search-link",
    });
  }

  const anchorRegex =
    /<a[^>]+href=(?:"|\\")([^"\\]*(?:\/|\\u002F|\\\/)de(?:\/|\\u002F|\\\/)stellenangebote(?:\/|\\u002F|\\\/)detail(?:\/|\\u002F|\\\/)[^"\\]*)(?:"|\\")[^>]*>([\s\S]*?)<\/a>/gi;

  let anchorMatch;

  while ((anchorMatch = anchorRegex.exec(html)) !== null) {
    let url = anchorMatch[1]
      .replace(/\\u002F/g, "/")
      .replace(/\\\//g, "/")
      .replace(/\\/g, "");

    if (!url.startsWith("http")) {
      url = `https://www.jobs.ch${url}`;
    }

    const title = getUsefulTitleFromText(anchorMatch[2]);

    addSearchHit(
      hitsByUrl,
      {
        url,
        keyword,
        query,
        sourceKind: "search-card",
      },
      {
        title,
        sourceKind: "search-card",
      }
    );
  }

  for (const url of links) {
    const escapedPath = url
      .replace("https://www.jobs.ch", "")
      .replace(/\//g, "\\/");

    const variants = [
      url,
      url.replace(/\//g, "\\/"),
      normalizeUrl(url).replace("https://www.jobs.ch", ""),
      escapedPath,
    ].filter(Boolean);

    for (const variant of variants) {
      const index = html.indexOf(variant);
      if (index < 0) continue;

      const windowStart = Math.max(0, index - 2500);
      const windowEnd = Math.min(html.length, index + 3500);
      const windowText = html.slice(windowStart, windowEnd);

      const title = getUsefulTitleFromText(
        extractJsonValueFromText(windowText, [
          "title",
          "jobTitle",
          "name",
          "positionTitle",
        ])
      );

      const company = getUsefulTitleFromText(
        extractJsonValueFromText(windowText, [
          "companyName",
          "hiringOrganizationName",
          "employerName",
          "company",
        ])
      );

      const location = getUsefulTitleFromText(
        extractJsonValueFromText(windowText, [
          "location",
          "addressLocality",
          "workplace",
          "city",
        ])
      );

      const snippet = cleanText(
        extractJsonValueFromText(windowText, [
          "description",
          "snippet",
          "preview",
          "summary",
        ])
      ).slice(0, 500);

      const publishedDate = cleanText(
        extractJsonValueFromText(windowText, [
          "datePosted",
          "publishedAt",
          "publishedDate",
          "publicationDate",
        ])
      );

      addSearchHit(
        hitsByUrl,
        {
          url,
          keyword,
          query,
          sourceKind: "search-json",
        },
        {
          title,
          company,
          location,
          snippet,
          publishedDate,
          sourceKind: "search-json",
        }
      );

      break;
    }
  }

  return [...hitsByUrl.values()];
}

function extractJsonLd(html: string) {
  const blocks = [
    ...html.matchAll(
      /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi
    ),
  ];

  for (const block of blocks) {
    const raw = block[1].trim();
    const candidates = [
      raw,
      raw.replace(/&quot;/g, '"').replace(/&amp;/g, "&"),
    ];

    for (const candidate of candidates) {
      try {
        const json = JSON.parse(candidate);
        const items = Array.isArray(json) ? json : [json];

        for (const item of items) {
          if (item["@type"] === "JobPosting") return item;

          if (Array.isArray(item["@graph"])) {
            const found = item["@graph"].find(
              (x: any) => x["@type"] === "JobPosting"
            );
            if (found) return found;
          }
        }
      } catch {
        continue;
      }
    }
  }

  return null;
}

function extractBetween(html: string, regex: RegExp) {
  const match = html.match(regex);
  return match ? cleanText(match[1]) : "";
}

function getJsonLdCompany(jsonLd: any) {
  const organization = Array.isArray(jsonLd?.hiringOrganization)
    ? jsonLd?.hiringOrganization?.[0]
    : jsonLd?.hiringOrganization;

  return cleanText(organization?.name);
}

function getJsonLdLocation(jsonLd: any) {
  const jobLocation = Array.isArray(jsonLd?.jobLocation)
    ? jsonLd?.jobLocation?.[0]
    : jsonLd?.jobLocation;

  const address = jobLocation?.address || {};

  return cleanText(
    [
      address.addressLocality,
      address.addressRegion,
      address.addressCountry,
    ]
      .filter(Boolean)
      .join(", ")
  );
}

function getPreferredRoleSignals(profile: CvProfile) {
  return uniqueArray(
    [
      ...profile.searchTerms,
      ...safeArray(profile.search?.preferredRoles, 20),
      ...safeArray(profile.matching?.bestFitRoles, 20),
      ...safeArray(profile.matching?.acceptableRoles, 20),
    ],
    35
  );
}

function getLanguageSignals(profile: CvProfile) {
  const skillsValue = profile.skills;

  return uniqueArray(
    [
      ...safeArray(profile.languageProfile?.languages, 20),
      ...safeArray(profile.languageProfile?.strongestLanguages, 20),
      ...safeArray(profile.languageProfile?.businessLanguages, 20),
      ...safeArray(profile.languageProfile?.languageKeywords, 20),
      ...(!Array.isArray(skillsValue)
        ? safeArray(skillsValue?.languages, 20)
        : []),
    ],
    25
  );
}

function isWeakSearchTerm(term: string) {
  const lower = term.toLowerCase().trim();

  const weakTerms = [
    "crm",
    "deutsch",
    "italienisch",
    "englisch",
    "french",
    "german",
    "italian",
    "english",
    "französisch",
  ];

  return weakTerms.includes(lower);
}

function isLowPriorityQuery(term: string) {
  const lower = term.toLowerCase().trim();

  const lowPriorityTerms = [
    "administration",
    "mitarbeiter administration",
    "sachbearbeiter",
    "kundenservice",
    "customer service",
    "backoffice",
    "office manager",
    "support",
  ];

  return lowPriorityTerms.includes(lower);
}

function getRoleLikeSearchSignals() {
  return [
    "administrator",
    "administration",
    "advisor",
    "analyst",
    "assistant",
    "backoffice",
    "berater",
    "beraterin",
    "broker",
    "buchhalter",
    "consultant",
    "controller",
    "coordinator",
    "customer service",
    "data",
    "designer",
    "developer",
    "engineer",
    "entwickler",
    "fachfrau",
    "fachmann",
    "claims",
    "informatiker",
    "innendienst",
    "kaufmann",
    "kauffrau",
    "koordinator",
    "kundenberater",
    "kundenberatung",
    "kundenservice",
    "manager",
    "marketing",
    "mitarbeiter",
    "nurse",
    "pflege",
    "pflegefach",
    "project manager",
    "policen",
    "sachbearbeiter",
    "sales",
    "schaden",
    "software",
    "specialist",
    "support",
    "technician",
    "techniker",
    "underwriting",
    "verkaufer",
    "verkaeufer",
    "verkauf",
    "verkaeuferin",
    "verkaufsberater",
  ];
}

function isRoleLikeSearchTerm(term: string) {
  const normalized = normalizeForKeywordMatch(term);

  if (!normalized) return false;

  return getRoleLikeSearchSignals().some((signal) => {
    const normalizedSignal = normalizeForKeywordMatch(signal);
    return Boolean(
      normalizedSignal &&
        (` ${normalized} `.includes(` ${normalizedSignal} `) ||
          ` ${normalizedSignal} `.includes(` ${normalized} `) ||
          normalized.includes(normalizedSignal))
    );
  });
}

function toJobSearchQuery(term: string): string | null {
  const cleaned = cleanText(term);

  if (!cleaned || cleaned.length < 4) return null;

  if (isWeakSearchTerm(cleaned)) return null;
  if (!isRoleLikeSearchTerm(cleaned)) return null;

  return cleaned;
}

function toSkillBasedJobSearchQuery(term: string): string | null {
  const query = toJobSearchQuery(term);

  if (!query) return null;

  const words = query.split(/\s+/).filter(Boolean);
  return words.length > 1 ? query : null;
}

function isUsefulSkillSearchModifier(term: string) {
  const cleaned = cleanText(term);
  const normalized = normalizeForKeywordMatch(cleaned);

  if (!cleaned || normalized.length < 3) return false;
  if (isWeakSearchTerm(cleaned)) return false;

  const words = normalized.split(/\s+/).filter(Boolean);

  if (words.length > 4) return false;

  const genericSkillModifiers = [
    "team",
    "office",
    "ms office",
    "microsoft office",
    "service",
    "support",
    "kommunikation",
    "communication",
    "organisation",
    "organization",
    "beratung",
    "consulting",
  ];

  return !genericSkillModifiers.includes(normalized);
}

function getRoleSkillSearchQueries(profile: CvProfile, directTerms: string[]) {
  const roleTerms = uniqueArray(
    directTerms.filter((term) => !isLowPriorityQuery(term)),
    6
  );
  const skillTerms = uniqueArray(
    getProfileSkillQuerySignals(profile).filter(isUsefulSkillSearchModifier),
    10
  );
  const combinedTerms: string[] = [];

  for (const role of roleTerms.slice(0, 4)) {
    const normalizedRole = normalizeForKeywordMatch(role);

    if (!normalizedRole) continue;

    for (const skill of skillTerms.slice(0, 6)) {
      const normalizedSkill = normalizeForKeywordMatch(skill);

      if (!normalizedSkill) continue;
      if (
        normalizedRole.includes(normalizedSkill) ||
        normalizedSkill.includes(normalizedRole)
      ) {
        continue;
      }

      const totalWords = [
        ...normalizedRole.split(/\s+/),
        ...normalizedSkill.split(/\s+/),
      ].filter(Boolean).length;

      if (totalWords > 5) continue;

      combinedTerms.push(`${role} ${skill}`);

      if (combinedTerms.length >= 6) {
        return uniqueArray(combinedTerms, 6);
      }
    }
  }

  return uniqueArray(combinedTerms, 6);
}

function getProfileSkillQuerySignals(profile: CvProfile) {
  const skillsValue = profile.skills;

  return uniqueArray(
    [
      ...safeArray(profile.skillTags, 40),
      ...(Array.isArray(skillsValue) ? safeArray(skillsValue, 40) : []),
      ...(!Array.isArray(skillsValue)
        ? safeArray(skillsValue?.hardSkills, 40)
        : []),
      ...(!Array.isArray(skillsValue)
        ? safeArray(skillsValue?.tools, 30)
        : []),
      ...(!Array.isArray(skillsValue)
        ? safeArray(skillsValue?.certifications, 20)
        : []),
    ],
    70
  );
}

function getProfileRoleQuerySignals(profile: CvProfile) {
  const identity = profile.deepProfile?.identity || {};
  const experience = profile.deepProfile?.experience || {};

  return uniqueArray(
    [
      ...getPreferredRoleSignals(profile),
      ...safeArray(profile.search?.searchTerms, 20),
      cleanText(identity.targetRole),
      cleanText(identity.currentRole),
      ...safeArray(experience.roles, 20),
    ],
    50
  );
}

function getGenericFallbackQueriesFromProfile(profile: CvProfile) {
  const profileText = normalizeForKeywordMatch(getProfileSearchText(profile));
  const fallbackTerms: string[] = [];

  if (
    includesAny(profileText, [
      "administration",
      "admin",
      "office",
      "backoffice",
      "sachbearbeiter",
      "kaufmann",
      "kauffrau",
      "kaufmaennisch",
    ])
  ) {
    fallbackTerms.push("Mitarbeiter Administration", "Sachbearbeiter");
  }

  if (
    includesAny(profileText, [
      "kunden",
      "customer",
      "client",
      "service",
      "support",
      "beratung",
      "berater",
    ])
  ) {
    fallbackTerms.push("Kundenservice");
  }

  if (includesAny(profileText, ["backoffice", "office", "innendienst"])) {
    fallbackTerms.push("Backoffice");
  }

  return uniqueArray(fallbackTerms, 4);
}

function getSearchQueries(
  profile: CvProfile,
  knownUrlSet: Set<string>
): SearchQuery[] {
  const maxQueries = 20;

  const directTerms = uniqueArray(
    getProfileRoleQuerySignals(profile)
      .map(toJobSearchQuery)
      .filter((term): term is string => Boolean(term)),
    24
  );

  const coreDirectQueries = directTerms
    .filter((term) => !isLowPriorityQuery(term))
    .slice(0, 8)
    .map((term) => ({
      term,
      source: "cv-direct" as const,
      weight: 1.35,
    }));

  const expandedRoleSeeds = uniqueArray(
    getProfileSkillQuerySignals(profile)
      .map(toSkillBasedJobSearchQuery)
      .filter((term): term is string => Boolean(term))
      .filter(
        (term) =>
          !directTerms.some(
            (directTerm) => directTerm.toLowerCase() === term.toLowerCase()
          )
      ),
    12
  );

  const roleSkillSeeds = getRoleSkillSearchQueries(profile, directTerms).filter(
    (term) =>
      !directTerms.some(
        (directTerm) => directTerm.toLowerCase() === term.toLowerCase()
      ) &&
      !expandedRoleSeeds.some(
        (expandedTerm) => expandedTerm.toLowerCase() === term.toLowerCase()
      )
  );

  const roleSkillQueries = roleSkillSeeds.map((term) => ({
    term,
    source: "cv-expanded" as const,
    weight: 0.95,
  }));

  const expandedQueries = expandedRoleSeeds.map((term) => ({
    term,
    source: "cv-expanded" as const,
    weight: 1.05,
  }));

  const primaryQueries = [
    ...coreDirectQueries,
    ...roleSkillQueries,
    ...expandedQueries,
  ];
  const shouldUseFallbackQueries =
    knownUrlSet.size > 20 || primaryQueries.length <= 8;

  const lowPriorityDirectQueries = shouldUseFallbackQueries
    ? directTerms
        .filter((term) => isLowPriorityQuery(term))
        .slice(0, 2)
        .map((term) => ({
          term,
          source: "fallback" as const,
          weight: 0.42,
        }))
    : [];

  const fallbackQueries = shouldUseFallbackQueries
    ? getGenericFallbackQueriesFromProfile(profile)
        .filter(
          (term) =>
            !primaryQueries.some(
              (query) => query.term.toLowerCase() === term.toLowerCase()
            )
        )
        .slice(0, 3)
        .map((term) => ({
          term,
          source: "fallback" as const,
          weight: 0.35,
        }))
    : [];

  const primaryLimit = Math.max(
    maxQueries - lowPriorityDirectQueries.length - fallbackQueries.length,
    10
  );

  const allQueries = [
    ...primaryQueries.slice(0, primaryLimit),
    ...lowPriorityDirectQueries,
    ...fallbackQueries,
  ];

  const seen = new Set<string>();
  const uniqueQueries: SearchQuery[] = [];

  for (const query of allQueries) {
    const key = query.term.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    uniqueQueries.push(query);

    if (uniqueQueries.length >= maxQueries) break;
  }

  return uniqueQueries;
}

function getSearchLocations(profile: CvProfile) {
  const localLocations = [
    "Wädenswil",
    "Horgen",
    "Thalwil",
    "Richterswil",
    "Au ZH",
    "Pfäffikon SZ",
    "Rapperswil",
  ];

  return {
    localLocations: uniqueArray(localLocations, 7),
    zurichLocations: ["Zürich"],
    schwyzLocations: ["Schwyz"],
    zugLocations: ["Zug"],
  };
}

function uniqueQueries(queries: SearchQuery[], limit: number) {
  const seen = new Set<string>();
  const result: SearchQuery[] = [];

  for (const query of queries) {
    const key = normalizeForKeywordMatch(query.term);

    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(query);

    if (result.length >= limit) break;
  }

  return result;
}

function getWaveOnePriorityTerms(profile: CvProfile) {
  return uniqueArray(
    [
      ...profile.searchTerms,
      ...safeArray(profile.search?.searchTerms, 30),
      ...safeArray(profile.matching?.bestFitRoles, 30),
    ],
    40
  )
    .map(normalizeForKeywordMatch)
    .filter(Boolean);
}

function queryMatchesPriorityTerms(query: SearchQuery, priorityTerms: string[]) {
  const queryTerm = normalizeForKeywordMatch(query.term);

  if (!queryTerm) return false;

  return priorityTerms.some(
    (term) =>
      queryTerm === term ||
      queryTerm.includes(term) ||
      term.includes(queryTerm)
  );
}

function createSearchWaves(
  profile: CvProfile,
  queries: SearchQuery[],
  locations: string[]
): SearchWave[] {
  const nonFallbackQueries = queries.filter((query) => query.source !== "fallback");
  const fallbackQueries = queries.filter((query) => query.source === "fallback");
  const waveOnePriorityTerms = getWaveOnePriorityTerms(profile);
  const waveOneQueries = uniqueQueries(
    [
      ...nonFallbackQueries.filter((query) =>
        queryMatchesPriorityTerms(query, waveOnePriorityTerms)
      ),
      ...nonFallbackQueries.filter((query) => query.source === "cv-direct"),
      ...nonFallbackQueries,
    ],
    5
  );

  const waveTwoQueries = uniqueQueries(nonFallbackQueries, 10);
  const waveThreeQueries = uniqueQueries(queries, queries.length);
  const waveFourQueries = uniqueQueries(fallbackQueries, fallbackQueries.length);
  const topLocations = locations.slice(0, 3);
  const broadLocations = locations.slice(
    0,
    Math.max(3, Math.min(locations.length, 7))
  );

  return [
    {
      id: 1,
      name: "wave-1-best-fit",
      queries: waveOneQueries,
      locations: topLocations,
      maxPages: 4,
      targetLinks: 36,
      candidateLimit: 24,
      detailLimit: 18,
      allowFallbackJobs: false,
    },
    {
      id: 2,
      name: "wave-2-good-new",
      queries: waveTwoQueries,
      locations: broadLocations,
      maxPages: 3,
      targetLinks: 48,
      candidateLimit: 28,
      detailLimit: 16,
      allowFallbackJobs: true,
    },
    {
      id: 3,
      name: "wave-3-medium-wide",
      queries: waveThreeQueries,
      locations,
      maxPages: 2,
      targetLinks: 52,
      candidateLimit: 26,
      detailLimit: 12,
      allowFallbackJobs: true,
    },
    {
      id: 4,
      name: "wave-4-cv-fallback",
      queries: waveFourQueries,
      locations,
      maxPages: 2,
      targetLinks: 24,
      candidateLimit: 14,
      detailLimit: 8,
      allowFallbackJobs: true,
    },
  ].filter((wave) => wave.queries.length > 0 && wave.locations.length > 0);
}

function parsePublishedDate(value?: string) {
  const cleaned = cleanText(value);

  if (!cleaned) return null;

  const isoMatch = cleaned.match(/\d{4}-\d{2}-\d{2}/);

  if (isoMatch) {
    const date = new Date(`${isoMatch[0]}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const swissMatch = cleaned.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);

  if (swissMatch) {
    const [, day, month, year] = swissMatch;
    const date = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day))
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }

  const lower = cleaned.toLowerCase();
  const relativeMatch = lower.match(/vor\s+(\d+)\s+tag/);

  if (lower.includes("heute")) return new Date();
  if (lower.includes("gestern")) {
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  if (relativeMatch) {
    return new Date(
      Date.now() - Number(relativeMatch[1]) * 24 * 60 * 60 * 1000
    );
  }

  const parsed = new Date(cleaned);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getJobAgeDays(job: Job) {
  const date = parsePublishedDate(job.publishedDate);

  if (!date) return null;

  const age = Math.floor((Date.now() - date.getTime()) / (24 * 60 * 60 * 1000));

  return Math.max(0, age);
}

function getRecencyScoreModifier(job: Job) {
  const ageDays = getJobAgeDays(job);

  if (ageDays === null) {
    return { ageDays, score: -3 };
  }

  if (ageDays <= 7) return { ageDays, score: 20 };
  if (ageDays <= 14) return { ageDays, score: 14 };
  if (ageDays <= 30) return { ageDays, score: 8 };
  if (ageDays <= 60) return { ageDays, score: 2 };
  if (ageDays > 90) return { ageDays, score: -16 };
  if (ageDays > 60) return { ageDays, score: -8 };

  return { ageDays, score: 0 };
}

function isTooOldJob(job: Job) {
  const ageDays = getJobAgeDays(job);
  return ageDays !== null && ageDays > 90;
}

function addRiskFlag(job: Job, flag: string) {
  const existing = job.riskFlags || [];

  if (!existing.some((item) => item.toLowerCase() === flag.toLowerCase())) {
    job.riskFlags = [...existing, flag];
  }
}

function flattenProfileSkills(profile: CvProfile) {
  const skillsValue = profile.skills;

  if (Array.isArray(skillsValue)) return skillsValue;

  return [
    ...safeArray(skillsValue?.hardSkills, 80),
    ...safeArray(skillsValue?.softSkills, 80),
    ...safeArray(skillsValue?.tools, 80),
    ...safeArray(skillsValue?.languages, 40),
    ...safeArray(skillsValue?.certifications, 40),
  ];
}

function getProfileSearchText(profile: CvProfile) {
  return [
    ...profile.searchTerms,
    ...profile.strongKeywords,
    ...profile.avoidKeywords,
    ...profile.locations,
    ...safeArray(profile.skillTags, 80),
    ...safeArray(profile.cvHighlights, 60),
    ...safeArray(profile.search?.searchTerms, 60),
    ...safeArray(profile.search?.strongKeywords, 60),
    ...safeArray(profile.search?.preferredRoles, 60),
    ...safeArray(profile.matching?.bestFitRoles, 60),
    ...safeArray(profile.matching?.acceptableRoles, 60),
    ...safeArray(profile.languageProfile?.languages, 40),
    ...flattenProfileSkills(profile),
    profile.profileSummary,
  ]
    .join(" ")
    .toLowerCase();
}

function getProfileRoleScoringTerms(profile: CvProfile) {
  return uniqueArray(
    [
      ...getProfileRoleQuerySignals(profile),
      ...getPreferredRoleSignals(profile),
    ],
    45
  ).filter((term) => normalizeForKeywordMatch(term).length > 2);
}

function getProfileKeywordScoringTerms(profile: CvProfile) {
  return uniqueArray(
    [
      ...profile.strongKeywords,
      ...safeArray(profile.search?.strongKeywords, 80),
      ...safeArray(profile.skillTags, 80),
      ...flattenProfileSkills(profile),
      ...safeArray(profile.languageProfile?.languages, 40),
      ...safeArray(profile.languageProfile?.languageKeywords, 40),
    ],
    120
  ).filter((term) => normalizeForKeywordMatch(term).length > 2);
}

function getProfileRequirementTerms(profile: CvProfile) {
  return uniqueArray(
    [
      ...getProfileRoleScoringTerms(profile),
      ...getProfileKeywordScoringTerms(profile),
      ...getLanguageSignals(profile),
    ],
    90
  );
}

function getProfilePositiveSignalTerms(profile: CvProfile) {
  return uniqueArray(
    [
      ...profile.searchTerms,
      ...profile.strongKeywords,
      ...safeArray(profile.skillTags, 80),
      ...safeArray(profile.cvHighlights, 60),
      ...safeArray(profile.search?.searchTerms, 80),
      ...safeArray(profile.search?.strongKeywords, 80),
      ...safeArray(profile.search?.preferredRoles, 80),
      ...safeArray(profile.matching?.bestFitRoles, 80),
      ...safeArray(profile.matching?.acceptableRoles, 80),
      ...safeArray(profile.languageProfile?.languages, 40),
      ...safeArray(profile.languageProfile?.languageKeywords, 40),
      ...flattenProfileSkills(profile),
    ],
    180
  ).filter((term) => normalizeForKeywordMatch(term).length > 2);
}

function profileTermConflictsWithPositiveSignals(
  term: string,
  positiveTerms: string[]
) {
  const normalizedTerm = normalizeForKeywordMatch(term);

  if (normalizedTerm.length <= 2) return true;

  return positiveTerms.some((positiveTerm) => {
    const normalizedPositive = normalizeForKeywordMatch(positiveTerm);

    if (normalizedPositive.length <= 2) return false;
    if (normalizedTerm === normalizedPositive) return true;

    return (
      includesDomainTerm(normalizedPositive, normalizedTerm) ||
      includesDomainTerm(normalizedTerm, normalizedPositive)
    );
  });
}

function isClearlyNegativeProfileAvoidTerm(term: string) {
  const normalized = normalizeForKeywordMatch(term);

  if (!normalized) return false;

  return includesAny(normalized, [
    "avoid",
    "avoidance",
    "weak fit",
    "weak role",
    "deal breaker",
    "dealbreaker",
    "not suitable",
    "not preferred",
    "do not",
    "no ",
    "without ",
    "keine",
    "kein",
    "nicht",
    "vermeiden",
    "ungeeignet",
    "nicht passend",
    "passt nicht",
    "da evitare",
    "evitare",
    "non ",
    "senza ",
    "pas ",
    "sans ",
  ]);
}

function getProfileAvoidTerms(profile: CvProfile) {
  const positiveTerms = getProfilePositiveSignalTerms(profile);
  const explicitAvoidTerms = [
    ...profile.avoidKeywords,
    ...safeArray(profile.search?.avoidRoles, 50),
  ];
  const weakAvoidTerms = [
    ...safeArray(profile.matching?.weakFitRoles, 50),
    ...safeArray(profile.matching?.dealBreakers, 50),
  ].filter(isClearlyNegativeProfileAvoidTerm);

  return uniqueArray(
    [
      ...explicitAvoidTerms,
      ...weakAvoidTerms,
    ],
    90
  ).filter(
    (term) => !profileTermConflictsWithPositiveSignals(term, positiveTerms)
  );
}

function getJobSearchableText(job: Job) {
  return [
    job.title,
    job.company,
    job.location,
    job.snippet,
    job.fullDescription,
    job.keyword,
  ]
    .join(" ")
    .toLowerCase();
}

function getSearchHitSearchableText(hit: SearchHit) {
  return [
    hit.title,
    hit.company,
    hit.location,
    hit.snippet,
    hit.keyword,
    hit.query?.term,
  ]
    .join(" ")
    .toLowerCase();
}

function estimateSearchHitQuality(hit: SearchHit, profile: CvProfile) {
  const text = getSearchHitSearchableText(hit);
  const title = (hit.title || "").toLowerCase();
  const location =
    hit.location || getLocationFromKeyword(hit.keyword || "") || "";
  const roleMatches = findNormalizedMatches(
    text,
    getProfileRoleScoringTerms(profile)
  );
  const titleRoleMatches = findNormalizedMatches(
    title,
    getProfileRoleScoringTerms(profile)
  );
  const keywordMatches = findNormalizedMatches(
    text,
    getProfileKeywordScoringTerms(profile)
  );
  const avoidMatches = findNormalizedMatches(text, getProfileAvoidTerms(profile));

  let score = hit.query.weight * 20;

  if (hit.query.source === "cv-direct") score += 12;
  if (hit.query.source === "cv-expanded") score += 6;
  if (hit.query.source === "fallback") score -= 8;

  score += titleRoleMatches.length * 14;
  score += roleMatches.length * 8;
  score += Math.min(keywordMatches.length * 3, 18);
  score += Math.round(getLocationFallbackScore(profile.locations, location) / 12);
  score -= avoidMatches.length * 18;

  if (hit.publishedDate) score += 3;
  if (hit.title) score += 2;
  if (hit.company) score += 1;
  if (hit.snippet && cleanText(hit.snippet).length > 80) score += 2;

  return score;
}

function selectWaveCandidates(
  hits: SearchHit[],
  profile: CvProfile,
  limit: number
) {
  return [...hits]
    .map((hit, index) => ({
      hit,
      index,
      quality: estimateSearchHitQuality(hit, profile),
    }))
    .sort((a, b) => {
      const qualityDiff = b.quality - a.quality;

      if (Math.abs(qualityDiff) > 0.01) return qualityDiff;

      return (
        b.hit.query.weight - a.hit.query.weight ||
        a.hit.query.source.localeCompare(b.hit.query.source) ||
        cleanText(a.hit.title).localeCompare(cleanText(b.hit.title)) ||
        a.hit.url.localeCompare(b.hit.url) ||
        a.index - b.index
      );
    })
    .slice(0, limit)
    .map((item) => item.hit);
}

function hasProfileSupportForTerm(profile: CvProfile, term: string) {
  const profileText = getProfileSearchText(profile);
  const normalizedTerm = normalizeForKeywordMatch(term);

  if (!normalizedTerm) return false;
  if (includesDomainTerm(profileText, normalizedTerm)) return true;

  return normalizedTerm
    .split(" ")
    .filter((part) => part.length > 3)
    .some((part) => includesDomainTerm(profileText, part));
}

function hasProfileAlignedSignal(job: Job, profile: CvProfile) {
  const jobText = getJobSearchableText(job);
  const roleMatches = findNormalizedMatches(
    jobText,
    getProfileRoleScoringTerms(profile)
  );
  const keywordMatches = findNormalizedMatches(
    jobText,
    getProfileKeywordScoringTerms(profile)
  );

  return roleMatches.length > 0 || keywordMatches.length > 0;
}

function isEntryLevelProfile(profile: CvProfile) {
  return includesAny(getProfileSearchText(profile), [
    "junior",
    "entry level",
    "entry-level",
    "praktikum",
    "trainee",
    "lehrstelle",
    "lernende",
    "internship",
    "apprentice",
    "ausbildung",
    "graduate",
  ]);
}

function includesDomainTerm(text: string, term: string) {
  const lower = text.toLowerCase();
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  if (term.length <= 4 || /^[a-zäöüß]+$/i.test(term)) {
    return new RegExp(`(^|[^a-zäöüß])${escaped}([^a-zäöüß]|$)`, "i").test(
      lower
    );
  }

  return lower.includes(term);
}

function getJobRequirementMismatchText(job: Job) {
  return [
    job.title,
    ...(job.requirements || []),
  ]
    .join(" ")
    .toLowerCase();
}

function getTechnicalRequirementMismatchSeverity(job: Job, profile: CvProfile) {
  const jobText = getJobSearchableText(job);
  const requirementText = getJobRequirementMismatchText(job);
  const domainRequirementTerms = [
    "technische produkte",
    "handelsunternehmen",
    "audio",
    "video",
    "medientechnik",
    "netzwerk",
    "network",
    "av-technik",
    "av technik",
    "av professional",
    "technische anforderungen",
    "systemprojekte",
    "elektro",
    "elektrotechnik",
    "montage",
    "gebäudetechnik",
    "it support",
    "hardware",
    "software engineer",
    "programmierer",
    "mechanik",
    "logistik",
    "gastronomie",
    "pflege",
    "medizin",
    "bau",
    "detailhandel",
    "retail",
    "produktion",
    "handwerk",
  ];

  const matchedDomainTerms = domainRequirementTerms.filter((term) =>
    includesDomainTerm(jobText, term)
  );

  if (matchedDomainTerms.length === 0) return "none";

  const avoidTerms = getProfileAvoidTerms(profile);
  const hasExplicitAvoidedDomain = matchedDomainTerms.some((term) =>
    findNormalizedMatches(term, avoidTerms).length > 0
  );

  if (hasExplicitAvoidedDomain) return "hard";

  const unsupportedRequirementTerms = matchedDomainTerms.filter(
    (term) =>
      includesDomainTerm(requirementText, term) &&
      !hasProfileSupportForTerm(profile, term)
  );

  if (unsupportedRequirementTerms.length > 0) return "hard";

  const unsupportedContextTerms = matchedDomainTerms.some(
    (term) => !hasProfileSupportForTerm(profile, term)
  );

  return unsupportedContextTerms ? "soft" : "none";
}

function hasProfileAvoidedSignal(job: Job, profile: CvProfile) {
  const jobText = getJobSearchableText(job);
  return getProfileAvoidTerms(profile).some(
    (term) =>
      normalizeForKeywordMatch(term).length > 3 &&
      includesDomainTerm(jobText, normalizeForKeywordMatch(term))
  );
}

function isGenericJobWithoutProfileAnchor(job: Job, profile: CvProfile) {
  if (hasProfileAlignedSignal(job, profile)) return false;

  const title = job.title.toLowerCase();
  const text = getJobSearchableText(job);

  const genericTerms = [
    "administration",
    "office manager",
    "assistant",
    "client service",
    "customer service",
    "support",
    "operations",
    "sachbearbeiter",
    "mitarbeiter",
    "innendienst",
    "verkaufsinnendienst",
    "specialist",
  ];

  return includesAny(title, genericTerms) || includesAny(text, genericTerms);
}

function hasPerfectMatchSignals(job: Job, profile: CvProfile) {
  const title = job.title.toLowerCase();
  const riskText = (job.riskFlags || []).join(" ").toLowerCase();
  const requirementMatchScore = job.requirementMatchScore || 0;
  const hasDetailedText =
    job.sourceName !== "jobs.ch search preview" &&
    cleanText(job.fullDescription).length >= 180;
  const strongTitleTerms = getProfileRoleScoringTerms(profile);

  if (!hasDetailedText) return false;
  if (!hasProfileAlignedSignal(job, profile)) return false;
  if (
    strongTitleTerms.length > 0 &&
    findNormalizedMatches(title, strongTitleTerms).length === 0
  ) {
    return false;
  }
  if (requirementMatchScore < 18) return false;
  if (isGenericJobWithoutProfileAnchor(job, profile)) return false;

  return !(
    riskText.includes("requisiti tecnici") ||
    riskText.includes("branchenanforderungen passen vermutlich nicht zum cv") ||
    riskText.includes("profile avoid") ||
    riskText.includes("aussendienst") ||
    riskText.includes("provision")
  );
}

function getRiskScoreCap(job: Job, profile: CvProfile) {
  const riskText = (job.riskFlags || []).join(" ").toLowerCase();
  const allText = getJobSearchableText(job);
  let cap = 95;

  if (
    riskText.includes("requisiti tecnici") ||
    riskText.includes("requisiti principali non in linea") ||
    riskText.includes("branchenanforderungen passen vermutlich nicht zum cv")
  ) {
    cap = Math.min(cap, 65);
  }

  if (riskText.includes("profile avoid")) {
    cap = Math.min(cap, 72);
  }

  if ((job.requirementMismatchFlags || []).length > 0) {
    cap = Math.min(cap, 65);
  }

  if (
    riskText.includes("aussendienst") ||
    riskText.includes("provision") ||
    allText.includes("kaltakquise") ||
    allText.includes("hunter")
  ) {
    cap = Math.min(cap, 70);
  }

  if (job.sourceName === "jobs.ch search preview") {
    cap = Math.min(cap, 80);
  }

  if (getJobAgeDays(job) === null) {
    cap = Math.min(cap, 85);
  }

  if (!hasProfileAlignedSignal(job, profile)) {
    cap = Math.min(cap, 85);
  }

  if (isGenericJobWithoutProfileAnchor(job, profile)) {
    cap = Math.min(cap, 78);
  }

  if (!hasPerfectMatchSignals(job, profile)) {
    cap = Math.min(cap, 92);
  }

  return cap;
}

function hasNormalizedLocationTerm(location: string, term: string) {
  const normalizedTerm = normalizeForKeywordMatch(term);

  if (!location || !normalizedTerm) return false;

  return ` ${location} `.includes(` ${normalizedTerm} `);
}

function isRemoteLocation(location: string) {
  return [
    "remote",
    "remoto",
    "homeoffice",
    "home office",
    "work from home",
    "hybrid",
    "hybride",
    "teletravail",
    "telelavoro",
  ].some((term) => hasNormalizedLocationTerm(location, term));
}

function getLocationCountry(location: string) {
  const countryTerms: Record<string, string[]> = {
    switzerland: [
      "switzerland",
      "schweiz",
      "suisse",
      "svizzera",
      "ch",
      "zurich",
      "zuerich",
      "geneva",
      "geneve",
      "basel",
      "bern",
      "lausanne",
      "luzern",
      "lugano",
      "winterthur",
      "st gallen",
      "zug",
      "schwyz",
    ],
    italy: [
      "italy",
      "italia",
      "italien",
      "italie",
      "milano",
      "milan",
      "roma",
      "rome",
      "torino",
      "turin",
      "napoli",
      "bologna",
      "firenze",
      "venezia",
    ],
    germany: [
      "germany",
      "deutschland",
      "allemagne",
      "germania",
      "berlin",
      "munich",
      "muenchen",
      "hamburg",
      "frankfurt",
      "koln",
      "koeln",
      "stuttgart",
    ],
    france: [
      "france",
      "frankreich",
      "francia",
      "paris",
      "lyon",
      "marseille",
      "toulouse",
    ],
    austria: [
      "austria",
      "oesterreich",
      "osterreich",
      "autriche",
      "vienna",
      "wien",
      "salzburg",
    ],
  };

  for (const [country, terms] of Object.entries(countryTerms)) {
    if (terms.some((term) => hasNormalizedLocationTerm(location, term))) {
      return country;
    }
  }

  return null;
}

function getLocationArea(location: string) {
  const areaTerms: Record<string, string[]> = {
    "ch-zh": [
      "zh",
      "zurich",
      "zuerich",
      "horgen",
      "thalwil",
      "waedenswil",
      "richterswil",
      "winterthur",
      "uster",
      "dietikon",
      "duebendorf",
      "kloten",
      "buelach",
      "regensdorf",
      "schlieren",
      "wetzikon",
      "wallisellen",
    ],
    "ch-zg": ["zg", "zug"],
    "ch-sz": ["sz", "schwyz", "pfaeffikon", "pfaffikon"],
    "ch-be": ["be", "bern", "berne"],
    "ch-bs": ["bs", "basel"],
    "ch-ge": ["ge", "geneva", "geneve"],
    "ch-ti": ["ti", "ticino", "tessin", "lugano", "bellinzona"],
    "ch-vd": ["vd", "vaud", "lausanne"],
    "it-lombardy": ["milano", "milan", "lombardia", "lombardy"],
    "it-lazio": ["roma", "rome", "lazio"],
    "it-piedmont": ["torino", "turin", "piemonte", "piedmont"],
    "de-bavaria": ["munich", "muenchen", "bayern", "bavaria"],
    "de-berlin": ["berlin"],
    "fr-ile-de-france": ["paris", "ile de france"],
  };

  for (const [area, terms] of Object.entries(areaTerms)) {
    if (terms.some((term) => hasNormalizedLocationTerm(location, term))) {
      return area;
    }
  }

  return null;
}

function isGenericCountryLocation(location: string) {
  return [
    "switzerland",
    "schweiz",
    "suisse",
    "svizzera",
    "italy",
    "italia",
    "italien",
    "italie",
    "germany",
    "deutschland",
    "france",
    "austria",
  ].some((term) => hasNormalizedLocationTerm(location, term));
}

function locationsMatchExactly(profileLocation: string, jobLocation: string) {
  if (!profileLocation || !jobLocation) return false;
  if (profileLocation === jobLocation) return true;
  if (
    isGenericCountryLocation(profileLocation) ||
    isGenericCountryLocation(jobLocation)
  ) {
    return false;
  }

  return (
    hasNormalizedLocationTerm(jobLocation, profileLocation) ||
    hasNormalizedLocationTerm(profileLocation, jobLocation)
  );
}

function getLocationFallbackScore(profileLocations: string[] = [], jobLocation = "") {
  const normalizedJobLocation = normalizeForKeywordMatch(jobLocation);
  const normalizedProfileLocations = safeArray(profileLocations, 20)
    .map(normalizeForKeywordMatch)
    .filter(Boolean);

  if (!normalizedJobLocation) return 55;

  const jobIsRemote = isRemoteLocation(normalizedJobLocation);

  if (normalizedProfileLocations.length === 0) {
    if (jobIsRemote) return 90;
    if (getLocationCountry(normalizedJobLocation)) return 68;
    return 60;
  }

  if (
    normalizedProfileLocations.some(
      (profileLocation) => isRemoteLocation(profileLocation) && jobIsRemote
    )
  ) {
    return 100;
  }

  if (
    normalizedProfileLocations.some((profileLocation) =>
      locationsMatchExactly(profileLocation, normalizedJobLocation)
    )
  ) {
    return 100;
  }

  const jobArea = getLocationArea(normalizedJobLocation);

  if (
    jobArea &&
    normalizedProfileLocations.some(
      (profileLocation) => getLocationArea(profileLocation) === jobArea
    )
  ) {
    return 86;
  }

  const jobCountry = getLocationCountry(normalizedJobLocation);

  if (
    jobCountry &&
    normalizedProfileLocations.some(
      (profileLocation) => getLocationCountry(profileLocation) === jobCountry
    )
  ) {
    return jobIsRemote ? 88 : 72;
  }

  if (jobIsRemote) return 82;

  return 58;
}

function getGeocodeCacheKey(location = "") {
  return normalizeForKeywordMatch(location);
}

async function getCoordinatesFromLocation(
  location: string
): Promise<Coordinates | null> {
  const cleanedLocation = cleanText(location);
  const cacheKey = getGeocodeCacheKey(cleanedLocation);

  if (!cacheKey) return null;
  if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey) || null;
  if (geocodeInFlightCache.has(cacheKey)) {
    return await geocodeInFlightCache.get(cacheKey)!;
  }

  const geocodePromise = (async () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(
          cleanedLocation
        )}&format=json&limit=1`,
        {
          headers: {
            Accept: "application/json",
            "User-Agent": "JobRadarAI/1.0",
          },
          signal: controller.signal,
        }
      );

      if (!response.ok) {
        console.warn("search-jobs geocoding failed", {
          locationKey: cacheKey,
          status: response.status,
        });
        geocodeCache.set(cacheKey, null);
        return null;
      }

      const results = await response.json();
      const firstResult = Array.isArray(results) ? results[0] : null;
      const lat = Number(firstResult?.lat);
      const lon = Number(firstResult?.lon);

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        geocodeCache.set(cacheKey, null);
        return null;
      }

      const coordinates = { lat, lon };
      geocodeCache.set(cacheKey, coordinates);
      return coordinates;
    } catch (error) {
      console.warn("search-jobs geocoding unavailable", {
        locationKey: cacheKey,
        reason: getFetchFailureReason(error),
      });
      geocodeCache.set(cacheKey, null);
      return null;
    } finally {
      clearTimeout(timeoutId);
    }
  })();

  geocodeInFlightCache.set(cacheKey, geocodePromise);

  try {
    return await geocodePromise;
  } finally {
    geocodeInFlightCache.delete(cacheKey);
  }
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const earthRadiusKm = 6371;
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

function getDistanceScore(distanceKm: number | null, isRemote: boolean) {
  if (isRemote) return 85;
  if (distanceKm === null || !Number.isFinite(distanceKm)) return 60;
  if (distanceKm < 5) return 100;
  if (distanceKm < 10) return 90;
  if (distanceKm < 20) return 80;
  if (distanceKm < 40) return 65;
  if (distanceKm < 80) return 50;
  return 30;
}

function getPrimaryProfileLocation(profile: CvProfile) {
  return (
    safeArray(profile.locations, 20).find((location) => {
      const normalizedLocation = normalizeForKeywordMatch(location);
      return normalizedLocation && !isRemoteLocation(normalizedLocation);
    }) || ""
  );
}

function getJobLocationForDistance(job: Job, fallbackLocation = "") {
  return (
    cleanText(job.location) ||
    cleanText(fallbackLocation) ||
    getLocationFromKeyword(job.keyword || "")
  );
}

async function getDistanceScoreForJob(
  profile: CvProfile,
  jobLocation: string
) {
  const normalizedJobLocation = normalizeForKeywordMatch(jobLocation);
  const jobIsRemote = isRemoteLocation(normalizedJobLocation);

  if (jobIsRemote) {
    return {
      score: getDistanceScore(null, true),
      distanceKm: null,
      source: "remote" as const,
    };
  }

  const profileLocation = getPrimaryProfileLocation(profile);

  if (!profileLocation || !normalizedJobLocation) {
    return {
      score: getDistanceScore(null, false),
      distanceKm: null,
      source: "fallback" as const,
    };
  }

  const [profileCoordinates, jobCoordinates] = await Promise.all([
    getCoordinatesFromLocation(profileLocation),
    getCoordinatesFromLocation(jobLocation),
  ]);

  if (!profileCoordinates || !jobCoordinates) {
    return {
      score: getDistanceScore(null, false),
      distanceKm: null,
      source: "fallback" as const,
    };
  }

  const distanceKm = getDistanceKm(
    profileCoordinates.lat,
    profileCoordinates.lon,
    jobCoordinates.lat,
    jobCoordinates.lon
  );

  return {
    score: getDistanceScore(distanceKm, false),
    distanceKm,
    source: "geocoded" as const,
  };
}

async function applyDistanceAwareScore(
  job: Job,
  profile: CvProfile,
  fallbackLocation = ""
) {
  const jobLocation = getJobLocationForDistance(job, fallbackLocation);
  const distance = await getDistanceScoreForJob(profile, jobLocation);

  job.distanceScore = distance.score;
  job.distanceKm =
    distance.distanceKm === null ? null : Math.round(distance.distanceKm);
  job.distanceSource = distance.source;
  job.score = scoreJob(job, profile, distance.score);

  return job;
}

function scoreJob(job: Job, profile: CvProfile, distanceScoreValue = 60) {
  const title = job.title.toLowerCase();

  const allText = getJobSearchableText(job);

  let score = 34;

  const matchedKeywords: string[] = [];
  const missingKeywords: string[] = [];
  let requirementMatchScore = 0;
  let distanceScore = 0;

  const preferredTitleWords = getProfileRoleScoringTerms(profile);
  const profileKeywordTerms = getProfileKeywordScoringTerms(profile);
  const profileAvoidTerms = getProfileAvoidTerms(profile);

  const hardNegative = [
    "provision",
    "provisionsbasis",
    "kaltakquise",
    "hunter",
    "door to door",
    "fundraising",
    "call agent outbound",
  ];
  const entryLevelNegative = isEntryLevelProfile(profile)
    ? []
    : [
        "praktikum",
        "lehrstelle",
        "lernende",
        "ausbildung",
        "trainee",
        "junior",
      ];

  const seniorNegative = [
    "teamleiter",
    "leiter",
    "head of",
    "senior manager",
    "bereichsleiter",
    "abteilungsleiter",
    "director",
    "leiterin",
  ];

  for (const word of preferredTitleWords) {
    const normalizedWord = normalizeForKeywordMatch(word);

    if (normalizedWord.length <= 2) continue;

    if (includesDomainTerm(title, normalizedWord)) {
      score += 5;
      requirementMatchScore += 4;
      matchedKeywords.push(word);
    } else if (includesDomainTerm(allText, normalizedWord)) {
      score += 2;
      requirementMatchScore += 2;
      matchedKeywords.push(word);
    }
  }

  for (const term of getPreferredRoleSignals(profile)) {
    const parts = term
      .toLowerCase()
      .split(/\s+/)
      .filter((part) => part.length > 3);

    let localMatch = 0;

    for (const part of parts) {
      if (title.includes(part)) localMatch += 2;
      else if (allText.includes(part)) localMatch += 1;
    }

    if (localMatch >= 2) {
      score += Math.min(localMatch * 2, 8);
      requirementMatchScore += Math.min(localMatch * 2, 6);
      matchedKeywords.push(term);
    }
  }

  for (const word of profileKeywordTerms) {
    const w = normalizeForKeywordMatch(word);

    if (w.length <= 3) continue;

    const isCoreKeyword = preferredTitleWords.some((coreWord) => {
      const normalizedCoreWord = normalizeForKeywordMatch(coreWord);
      return (
        normalizedCoreWord.length > 2 &&
        (includesDomainTerm(w, normalizedCoreWord) ||
          includesDomainTerm(normalizedCoreWord, w))
      );
    });

    if (includesDomainTerm(title, w)) {
      score += isCoreKeyword ? 4 : 2;
      requirementMatchScore += isCoreKeyword ? 3 : 1;
      matchedKeywords.push(word);
    } else if (includesDomainTerm(allText, w)) {
      score += isCoreKeyword ? 2 : 1;
      requirementMatchScore += isCoreKeyword ? 1 : 0;
      matchedKeywords.push(word);
    }
  }

  const languageSignals = getLanguageSignals(profile);

  for (const language of languageSignals) {
    const lang = language.toLowerCase();

    if (lang.length <= 3) continue;

    if (allText.includes(lang)) {
      score += 3;
      matchedKeywords.push(language);
    }
  }

  distanceScore = distanceScoreValue;
  score += Math.round(distanceScore / 8);

  for (const word of profileAvoidTerms) {
    const w = normalizeForKeywordMatch(word);

    if (w.length > 3 && includesDomainTerm(allText, w)) {
      score -= 18;
      missingKeywords.push(`Avoid: ${word}`);
    }
  }

  for (const word of hardNegative) {
    if (includesDomainTerm(allText, word)) {
      score -= 25;
      missingKeywords.push(`Risk: ${word}`);

      if (
        word.includes("provision") ||
        word.includes("kaltakquise") ||
        word.includes("hunter") ||
        word.includes("door to door")
      ) {
        addRiskFlag(job, "Aussendienst oder Provisionsdruck prüfen");
      }
    }
  }

  for (const word of entryLevelNegative) {
    if (includesDomainTerm(allText, word)) {
      score -= 18;
      missingKeywords.push(`Entry-level: ${word}`);
      addRiskFlag(job, "Entry-level role prüfen");
    }
  }

  job.extractedRequirementsCount = (job.requirements || []).length;

  const requirementsText = (job.requirements || []).join(" ");
  const positiveRequirementTerms = getProfileRequirementTerms(profile);
  const negativeRequirementTerms = profileAvoidTerms;
  const matchedRequirementTerms = findNormalizedMatches(
    requirementsText,
    positiveRequirementTerms
  );
  const requirementMismatchTerms = findNormalizedMatches(
    requirementsText,
    negativeRequirementTerms
  );

  if (matchedRequirementTerms.length > 0) {
    score += Math.min(matchedRequirementTerms.length * 2, 12);
    requirementMatchScore += Math.min(matchedRequirementTerms.length * 3, 18);
    matchedKeywords.push(
      ...matchedRequirementTerms.map((term) => `Requirement: ${term}`)
    );
  }

  if (requirementMismatchTerms.length > 0) {
    score -= 35;
    requirementMatchScore -= 35;
    job.requirementMismatchFlags = uniqueArray(requirementMismatchTerms, 8);
    missingKeywords.push(
      ...requirementMismatchTerms.map((term) => `Requirement mismatch: ${term}`)
    );
    addRiskFlag(job, "Requisiti principali non in linea con il CV");
  } else {
    job.requirementMismatchFlags = [];
  }

  const technicalMismatchSeverity = getTechnicalRequirementMismatchSeverity(
    job,
    profile
  );

  if (technicalMismatchSeverity === "hard") {
    score -= 35;
    requirementMatchScore -= 35;
    missingKeywords.push("Branche/Fachanforderung ausserhalb CV");
    addRiskFlag(
      job,
      "Requisiti tecnici oder Branchenanforderungen passen vermutlich nicht zum CV"
    );
  } else if (technicalMismatchSeverity === "soft") {
    score -= 12;
    requirementMatchScore -= 8;
    missingKeywords.push("Possibile Branchenkontext ausserhalb CV");
    addRiskFlag(job, "Branch signal not clearly supported by CV");
  }

  if (hasProfileAvoidedSignal(job, profile)) {
    score -= 30;
    requirementMatchScore -= 22;
    missingKeywords.push("Profile avoid signal");
    addRiskFlag(job, "Profile avoid signal matched");
  }

  if (isGenericJobWithoutProfileAnchor(job, profile)) {
    score -= 10;
    requirementMatchScore -= 5;
    missingKeywords.push("Zu generisch ohne klaren Profilbezug");
  }

  const profileSearchText = getProfileSearchText(profile);
  const hasLeadershipInCv = includesAny(profileSearchText, [
    "führung",
    "fuehrung",
    "teamleiter",
    "leiter",
    "management",
    "lead",
    "head of",
  ]);

  if (!hasLeadershipInCv) {
    for (const word of seniorNegative) {
      if (title.includes(word)) {
        score -= 14;
        missingKeywords.push(`Senior: ${word}`);
      }
    }
  }

  const profileRoleContextMatches = findNormalizedMatches(
    allText,
    preferredTitleWords
  );
  const profileKeywordContextMatches = findNormalizedMatches(
    allText,
    profileKeywordTerms
  );

  if (
    profileRoleContextMatches.length > 0 &&
    profileKeywordContextMatches.length > 0
  ) {
    score += 5;
    requirementMatchScore += 4;
    matchedKeywords.push("Strong profile role fit");
  }

  if (job.keyword?.toLowerCase().includes("cv-direct")) score += 4;
  if (job.keyword?.toLowerCase().includes("cv-expanded")) score += 2;
  if (job.keyword?.toLowerCase().includes("fallback")) score -= 7;

  const hasDetailedText =
    job.sourceName !== "jobs.ch search preview" &&
    cleanText(job.fullDescription).length >= 180;

  if (hasDetailedText) score += 5;
  else score -= 10;

  if (job.sourceName === "jobs.ch search preview") score -= 12;

  const recency = getRecencyScoreModifier(job);
  score += recency.score;
  job.recencyScore = recency.score;
  job.requirementMatchScore = Math.max(-40, Math.min(requirementMatchScore, 80));
  job.distanceScore = distanceScore;
  job.ageDays = recency.ageDays;

  if (recency.ageDays === null) {
    missingKeywords.push("Datum nicht erkannt");
  } else if (recency.ageDays > 60) {
    missingKeywords.push(`Alt: ${recency.ageDays} Tage`);
  } else if (recency.ageDays <= 14) {
    matchedKeywords.push(`Neu: ${recency.ageDays} Tage`);
  }

  job.matchedKeywords = uniqueArray(matchedKeywords, 16);
  job.missingKeywords = uniqueArray(missingKeywords, 10);

  const finalScore = Math.max(1, Math.min(score, getRiskScoreCap(job, profile)));

  if (finalScore >= 88) job.fitLabel = "Best Match";
  else if (finalScore >= 78) job.fitLabel = "Good Match";
  else if (finalScore >= 65) job.fitLabel = "Medium Match";
  else job.fitLabel = "Low Match";

  return finalScore;
}

function extractJobDetail(
  html: string,
  url: string,
  id: number,
  keyword: string,
  profile: CvProfile,
  preview?: Partial<SearchHit>,
  sectionStats?: SectionParsingStats,
  allowSectionParsing = true
): Job {
  const jsonLd = extractJsonLd(html);
  const rawJsonLdDescription =
    typeof jsonLd?.description === "string" ? jsonLd.description : "";

  let title =
    cleanText(jsonLd?.title) ||
    getUsefulTitleFromText(
      extractJsonValueFromText(html, ["title", "jobTitle", "positionTitle"])
    ) ||
    extractBetween(html, /<meta property="og:title" content="([^"]+)"/i) ||
    extractBetween(html, /<h1[^>]*>([\s\S]*?)<\/h1>/i) ||
    extractBetween(html, /<title[^>]*>([\s\S]*?)<\/title>/i) ||
    preview?.title ||
    deriveTitleFromKeyword(keyword);

  let company =
    getJsonLdCompany(jsonLd) ||
    getUsefulTitleFromText(
      extractJsonValueFromText(html, [
        "companyName",
        "hiringOrganizationName",
        "employerName",
        "company",
      ])
    ) ||
    preview?.company ||
    "Firma auf jobs.ch";

  let location =
    getJsonLdLocation(jsonLd) ||
    getUsefulTitleFromText(
      extractJsonValueFromText(html, [
        "addressLocality",
        "location",
        "workplace",
        "city",
      ])
    ) ||
    preview?.location ||
    deriveLocationFromKeyword(keyword, profile);

  let description =
    cleanText(rawJsonLdDescription) ||
    extractBetween(html, /<meta name="description" content="([^"]+)"/i) ||
    extractBetween(html, /<meta property="og:description" content="([^"]+)"/i) ||
    cleanText(
      extractJsonValueFromText(html, [
        "description",
        "jobDescription",
        "snippet",
        "summary",
      ])
    ) ||
    preview?.snippet ||
    `Gefunden über ${keyword}.`;

  const publishedDate =
    cleanText(jsonLd?.datePosted) ||
    extractBetween(html, /"datePosted"\s*:\s*"([^"]+)"/i) ||
    extractBetween(html, /"publishedAt"\s*:\s*"([^"]+)"/i);

  title = cleanText(title)
    .replace(/\s*\|\s*jobs\.ch.*$/i, "")
    .replace(/\s*-\s*jobs\.ch.*$/i, "");
  company = cleanText(company);
  location = cleanText(location);
  description = cleanText(description);

  const fullDescription = description.slice(0, 2500);
  const sections = allowSectionParsing
    ? extractJobSections(fullDescription, sectionStats)
    : skipSectionParsing(sectionStats);
  const insights = createJobInsights(fullDescription, title);

  const job: Job = {
    id,
    title: title || deriveTitleFromKeyword(keyword),
    company: company || "Firma auf jobs.ch",
    location: location || deriveLocationFromKeyword(keyword, profile),
    url: normalizeUrl(url),
    snippet: insights.snippet,
    highlights: insights.highlights,
    riskFlags: insights.riskFlags,
    previewSummary: insights.previewSummary,
    fullDescription,
    requirements: sections.requirements,
    responsibilities: sections.responsibilities,
    benefits: sections.benefits,
    extractedRequirementsCount: sections.requirements.length,
    requirementMismatchFlags: [],
    keyword,
    publishedDate,
    source: "jobs.ch",
    sourceName: "jobs.ch",
  };

  return job;
}

function isUsefulDetailedJob(job: Job) {
  return getDetailedJobRejectReason(job) === null;
}

function getDetailedJobRejectReason(job: Job): SearchDiscardReason | null {
  const title = job.title.toLowerCase();
  const company = job.company.toLowerCase();
  const descriptionLength = cleanText(job.fullDescription).length;

  if (!job.url) return "invalidUrl";
  if (title.includes("access denied") || title.includes("cloudflare")) {
    return "noDetail";
  }
  if (title === "stellenanzeige auf jobs.ch" && descriptionLength < 80) {
    return "missingTitle";
  }
  if (company === "firma auf jobs.ch" && descriptionLength < 120) {
    return "missingCompany";
  }

  return null;
}

function createFallbackJobFromHit(
  hit: SearchHit,
  id: number,
  profile: CvProfile,
  sectionStats?: SectionParsingStats,
  allowSectionParsing = true
): Job {
  const title = hit.title || deriveTitleFromKeyword(hit.keyword);
  const company = hit.company || "Firma auf jobs.ch";
  const location = hit.location || deriveLocationFromKeyword(hit.keyword, profile);
  const fullDescription = (
    hit.snippet ||
    `Gefunden auf jobs.ch über die Suche: ${hit.keyword}. Detailseite konnte nicht zuverlässig gelesen werden.`
  ).slice(0, 2500);

  const insights = createJobInsights(fullDescription, title);
  const hasValidFallbackDescription = Boolean(
    hit.snippet && cleanText(hit.snippet).length >= 120
  );
  const sections = hasValidFallbackDescription && allowSectionParsing
    ? extractJobSections(fullDescription, sectionStats, { allowShortText: true })
    : skipSectionParsing(sectionStats);

  const job: Job = {
    id,
    title,
    company,
    location,
    url: normalizeUrl(hit.url),
    snippet: insights.snippet,
    highlights: insights.highlights,
    riskFlags: insights.riskFlags,
    previewSummary: insights.previewSummary,
    fullDescription,
    requirements: sections.requirements,
    responsibilities: sections.responsibilities,
    benefits: sections.benefits,
    extractedRequirementsCount: sections.requirements.length,
    requirementMismatchFlags: [],
    keyword: hit.keyword,
    publishedDate: hit.publishedDate,
    source: "jobs.ch",
    sourceName: "jobs.ch search preview",
  };

  return job;
}

async function collectLinks(
  queries: SearchQuery[],
  locations: string[],
  startedAt: number,
  maxRuntimeMs: number,
  targetLinks: number,
  knownUrlSet: Set<string>,
  maxPagesOverride?: number,
  debugStats?: SearchRunDebugStats,
  visitedSearchPageKeys?: Set<string>
) {
  const foundLinks: SearchHit[] = [];
  const foundUrlSet = new Set<string>();
  let skippedKnown = 0;
  let searchPagesFetched = 0;
  let searchPagesFailed = 0;
  let searchPagesAttempted = 0;
  let totalLinksBeforeDedup = 0;
  let linkDuplicates = 0;

  const buildResult = () => ({
    foundLinks,
    skippedKnown,
    searchPagesFetched,
    searchPagesFailed,
    searchPagesAttempted,
    totalLinksBeforeDedup,
    totalLinksAfterDedup: foundLinks.length,
    linkDuplicates,
  });

  const maxPages =
    maxPagesOverride ??
    (knownUrlSet.size >= 25 ? 5 : knownUrlSet.size >= 10 ? 4 : 3);

  for (let page = 1; page <= maxPages; page++) {
    for (
      let locationIndex = 0;
      locationIndex < locations.length;
      locationIndex++
    ) {
      const loc = locations[locationIndex];

      for (let queryIndex = 0; queryIndex < queries.length; queryIndex++) {
        const query = queries[queryIndex];

        if (Date.now() - startedAt > maxRuntimeMs - 15000) {
          return buildResult();
        }

        const base = `https://www.jobs.ch/de/stellenangebote/?term=${encodeURIComponent(
          query.term
        )}&location=${encodeURIComponent(loc)}&page=${page}`;

        const urlsToTry = [`${base}&sort=date`, base];

        for (let urlIndex = 0; urlIndex < urlsToTry.length; urlIndex++) {
          const searchUrl = urlsToTry[urlIndex];
          const searchVariant = urlIndex === 0 ? "sort=date" : "base";
          const searchPageKey = `${query.source}:${query.term}|${loc}|${page}|${searchVariant}`;

          if (visitedSearchPageKeys?.has(searchPageKey)) {
            continue;
          }

          visitedSearchPageKeys?.add(searchPageKey);

          searchPagesAttempted++;
          if (debugStats) debugStats.searchPagesAttempted++;

          try {
            const result = await fetchHtmlWithRetry(searchUrl, 0, 5500);
            searchPagesFetched++;

            const keyword = `${query.source}: ${query.term} - ${loc}`;
            const hits = extractSearchHits(result.html, keyword, query);
            totalLinksBeforeDedup += hits.length;
            if (debugStats) debugStats.totalLinksBeforeDedup += hits.length;

            console.info("search-jobs search page", {
              runId: debugStats?.runId,
              page,
              query: query.term,
              querySource: query.source,
              location: loc,
              variant: searchVariant,
              status: result.status,
              ok: result.ok,
              linksFound: hits.length,
              fallback: urlIndex > 0,
              timeout: false,
            });

            for (const hit of hits) {
              const normalized = normalizeUrl(hit.url);

              if (knownUrlSet.has(normalized)) {
                skippedKnown++;
                continue;
              }

              if (!foundUrlSet.has(normalized)) {
                foundUrlSet.add(normalized);
                foundLinks.push({
                  ...hit,
                  url: normalized,
                  keyword,
                  query,
                });
              } else {
                linkDuplicates++;
                if (debugStats) debugStats.linkDuplicates++;
              }
            }

            if (hits.length > 0) break;
          } catch (error) {
            const failureReason = getFetchFailureReason(error);

            if (debugStats) {
              if (failureReason === "timeout") {
                incrementDiscardReason(debugStats, "timeout");
              }
            }

            console.warn("search-jobs search page failed", {
              runId: debugStats?.runId,
              page,
              query: query.term,
              querySource: query.source,
              location: loc,
              variant: searchVariant,
              status: null,
              linksFound: 0,
              fallback: urlIndex > 0,
              timeout: failureReason === "timeout",
              reason: failureReason,
            });

            searchPagesFailed++;
            continue;
          }
        }

        const hasVisitedAllLocations = locationIndex >= locations.length - 1;
        const hasTriedAllQueries = queryIndex >= queries.length - 1;
        const hasCompletedAtLeastOneFullPage =
          page > 1 ||
          (page === 1 && hasVisitedAllLocations && hasTriedAllQueries);

        if (
          foundLinks.length >= targetLinks &&
          hasVisitedAllLocations &&
          hasTriedAllQueries &&
          hasCompletedAtLeastOneFullPage
        ) {
          return buildResult();
        }
      }
    }
  }

  return buildResult();
}

function mergeSearchHits(target: SearchHit[], incoming: SearchHit[]) {
  const targetUrls = new Set(target.map((link) => link.url));

  for (const link of incoming) {
    if (!targetUrls.has(link.url)) {
      targetUrls.add(link.url);
      target.push(link);
    }
  }
}

const companyDuplicateNoiseWords = new Set([
  "ag",
  "sa",
  "gmbh",
  "ltd",
  "llc",
  "inc",
  "co",
  "company",
  "group",
  "holding",
  "schweiz",
  "switzerland",
  "suisse",
  "svizzera",
  "versicherungen",
  "versicherung",
  "insurance",
]);

const titleDuplicateNoiseWords = new Set([
  "all",
  "and",
  "das",
  "dem",
  "den",
  "der",
  "des",
  "d",
  "die",
  "fuer",
  "fur",
  "genders",
  "in",
  "m",
  "mwd",
  "oder",
  "und",
  "w",
]);

const locationDuplicateNoiseWords = new Set([
  "schweiz",
  "suisse",
  "svizzera",
  "switzerland",
]);

function normalizeCompanyName(value = "") {
  const normalized = normalizeForKeywordMatch(value);
  const words = normalized
    .split(" ")
    .filter((word) => word && !companyDuplicateNoiseWords.has(word));

  return words.join(" ") || normalized;
}

function normalizeJobTitleForDuplicate(value = "") {
  const withoutNoise = cleanText(value)
    .replace(
      /\([^)]*(?:m\s*\/\s*w\s*\/\s*d|w\s*\/\s*m\s*\/\s*d|mwd|all genders|\d{1,3}\s*%)[^)]*\)/gi,
      " "
    )
    .replace(/\b\d{1,3}\s*(?:[-\u2013\u2014]|bis|to)\s*\d{1,3}\s*%/gi, " ")
    .replace(/\b\d{1,3}\s*%/g, " ")
    .replace(/\b(?:m\s*\/\s*w\s*\/\s*d|w\s*\/\s*m\s*\/\s*d|mwd|all genders)\b/gi, " ");

  return normalizeForKeywordMatch(withoutNoise)
    .split(" ")
    .filter((word) => word && !titleDuplicateNoiseWords.has(word))
    .join(" ");
}

function normalizeLocationForDuplicate(value = "") {
  const normalized = normalizeForKeywordMatch(value)
    .split(" ")
    .filter((word) => word && !locationDuplicateNoiseWords.has(word))
    .join(" ");

  if (
    normalized === "zurich" ||
    normalized === "zuerich" ||
    normalized === "stadt zurich" ||
    normalized === "stadt zuerich"
  ) {
    return "zuerich";
  }

  return normalized;
}

function getTitleSimilarity(firstTitle: string, secondTitle: string) {
  const firstTokens = new Set(firstTitle.split(" ").filter(Boolean));
  const secondTokens = new Set(secondTitle.split(" ").filter(Boolean));

  if (firstTokens.size === 0 || secondTokens.size === 0) return 0;

  let shared = 0;

  for (const token of firstTokens) {
    if (secondTokens.has(token)) shared++;
  }

  return shared / Math.max(firstTokens.size, secondTokens.size);
}

function areDuplicateTitles(firstTitle: string, secondTitle: string) {
  if (!firstTitle || !secondTitle) return false;
  if (firstTitle === secondTitle) return true;

  return getTitleSimilarity(firstTitle, secondTitle) >= 0.82;
}

function findDuplicateJobIndex(jobs: Job[], job: Job) {
  const jobUrl = normalizeUrl(job.url);
  const jobTitle = normalizeJobTitleForDuplicate(job.title);
  const jobCompany = normalizeCompanyName(job.company);
  const jobLocation = normalizeLocationForDuplicate(job.location);

  return jobs.findIndex((existingJob) => {
    const existingUrl = normalizeUrl(existingJob.url);
    if (jobUrl && existingUrl === jobUrl) return true;

    const existingCompany = normalizeCompanyName(existingJob.company);
    const existingLocation = normalizeLocationForDuplicate(
      existingJob.location
    );

    if (
      !jobCompany ||
      !jobLocation ||
      jobCompany !== existingCompany ||
      jobLocation !== existingLocation
    ) {
      return false;
    }

    const existingTitle = normalizeJobTitleForDuplicate(existingJob.title);
    return areDuplicateTitles(jobTitle, existingTitle);
  });
}

function isDuplicateJob(jobs: Job[], job: Job) {
  return findDuplicateJobIndex(jobs, job) !== -1;
}

function getJobPublishedTime(job: Job) {
  return parsePublishedDate(job.publishedDate)?.getTime() || 0;
}

function getJobDescriptionLength(job: Job) {
  return cleanText(job.fullDescription).length;
}

function shouldPreferDuplicateJob(candidate: Job, current: Job) {
  const scoreDiff = (candidate.score || 0) - (current.score || 0);
  if (scoreDiff !== 0) return scoreDiff > 0;

  const publishedDateDiff =
    getJobPublishedTime(candidate) - getJobPublishedTime(current);
  if (publishedDateDiff !== 0) return publishedDateDiff > 0;

  return getJobDescriptionLength(candidate) > getJobDescriptionLength(current);
}

function addOrReplaceDuplicateJob(jobs: Job[], job: Job) {
  if (!isDuplicateJob(jobs, job)) {
    jobs.push(job);
    return false;
  }

  const duplicateIndex = findDuplicateJobIndex(jobs, job);

  if (duplicateIndex === -1) {
    jobs.push(job);
    return false;
  }

  const currentJob = jobs[duplicateIndex];

  if (shouldPreferDuplicateJob(job, currentJob)) {
    jobs[duplicateIndex] = {
      ...job,
      id: currentJob.id || job.id,
    };
  }

  return true;
}

function getLocationFromKeyword(keyword = "") {
  const parts = keyword.split(" - ").map((part) => cleanText(part));
  return parts.length > 1 ? parts[parts.length - 1] : "Unknown";
}

function createLocationStats(foundLinks: SearchHit[], jobs: Job[]) {
  const foundByLocation: Record<string, number> = {};
  const jobsByLocation: Record<string, number> = {};

  for (const hit of foundLinks) {
    const location = getLocationFromKeyword(hit.keyword);
    foundByLocation[location] = (foundByLocation[location] || 0) + 1;
  }

  for (const job of jobs) {
    const location =
      cleanText(job.location) || getLocationFromKeyword(job.keyword || "");
    jobsByLocation[location] = (jobsByLocation[location] || 0) + 1;
  }

  return {
    foundByLocation,
    jobsByLocation,
  };
}

function selectBalancedSearchHits(foundLinks: SearchHit[], limit: number) {
  const preferredLocations = [
    "Wädenswil",
    "Horgen",
    "Thalwil",
    "Richterswil",
    "Au ZH",
    "Pfäffikon SZ",
    "Rapperswil",
    "Zürich",
    "Schwyz",
    "Zug",
  ];

  const grouped = new Map<string, SearchHit[]>();

  for (const hit of foundLinks) {
    const location = getLocationFromKeyword(hit.keyword);
    const group = grouped.get(location) || [];
    group.push(hit);
    grouped.set(location, group);
  }

  const selected: SearchHit[] = [];
  const seen = new Set<string>();
  const maxPerLocation = Math.max(5, Math.ceil(limit / preferredLocations.length) + 4);

  for (const location of preferredLocations) {
    const hits = grouped.get(location) || [];

    for (const hit of hits.slice(0, maxPerLocation)) {
      if (selected.length >= limit) return selected;
      if (seen.has(hit.url)) continue;

      selected.push(hit);
      seen.add(hit.url);
    }
  }

  for (const hit of foundLinks) {
    if (selected.length >= limit) break;
    if (seen.has(hit.url)) continue;

    selected.push(hit);
    seen.add(hit.url);
  }

  return selected;
}

function createRecencyStats(jobs: Job[]) {
  const stats = {
    recent7: 0,
    recent14: 0,
    recent30: 0,
    days31To60: 0,
    days61To90: 0,
    olderThan90: 0,
    unknownDate: 0,
  };

  for (const job of jobs) {
    const ageDays = getJobAgeDays(job);

    if (ageDays === null) stats.unknownDate++;
    else if (ageDays <= 7) stats.recent7++;
    else if (ageDays <= 14) stats.recent14++;
    else if (ageDays <= 30) stats.recent30++;
    else if (ageDays <= 60) stats.days31To60++;
    else if (ageDays <= 90) stats.days61To90++;
    else stats.olderThan90++;
  }

  return stats;
}

function createMismatchStats(jobs: Job[]) {
  let technicalMismatch = 0;
  let requirementMismatch = 0;
  let salesPressure = 0;
  let fallbackOnly = 0;
  let missingDate = 0;

  for (const job of jobs) {
    const riskText = (job.riskFlags || []).join(" ").toLowerCase();

    if (riskText.includes("requisiti tecnici")) technicalMismatch++;
    if (
      riskText.includes("requisiti principali non in linea") ||
      (job.requirementMismatchFlags || []).length > 0
    ) {
      requirementMismatch++;
    }
    if (riskText.includes("aussendienst") || riskText.includes("provision")) {
      salesPressure++;
    }
    if (job.sourceName === "jobs.ch search preview") fallbackOnly++;
    if (getJobAgeDays(job) === null) missingDate++;
  }

  return {
    technicalMismatch,
    requirementMismatch,
    salesPressure,
    fallbackOnly,
    missingDate,
  };
}

function sortJobsForOutput(jobs: Job[]) {
  jobs.sort((a, b) => {
    const scoreA = a.score || 0;
    const scoreB = b.score || 0;
    const scoreDiff = scoreB - scoreA;

    if (Math.abs(scoreDiff) > 10) {
      return scoreDiff;
    }

    return (
      (b.distanceScore || 0) - (a.distanceScore || 0) ||
      (b.recencyScore || 0) - (a.recencyScore || 0) ||
      scoreDiff ||
      (b.requirementMatchScore || 0) - (a.requirementMatchScore || 0)
    );
  });
}

function hasValidDetailForRelaxedThreshold(job: Job) {
  return (
    job.sourceName !== "jobs.ch search preview" &&
    (cleanText(job.fullDescription).length >= 180 ||
      (job.requirements || []).length > 0 ||
      (job.responsibilities || []).length > 0)
  );
}

function hasStrongFinalNegative(job: Job) {
  const riskText = (job.riskFlags || []).join(" ").toLowerCase();
  const missingText = (job.missingKeywords || []).join(" ").toLowerCase();

  return includesAny(`${riskText} ${missingText}`, [
    "risk:",
    "avoid:",
    "profile avoid",
    "requirement mismatch",
    "requisiti principali non in linea",
    "requisiti tecnici",
    "branchenanforderungen passen",
    "aussendienst",
    "provision",
    "kaltakquise",
    "hunter",
    "door to door",
  ]);
}

function isFallbackQualityJob(job: Job, profile: CvProfile) {
  const score = job.score || 0;

  if (score < 50) return false;
  if (hasStrongFinalNegative(job)) return false;

  if (score >= 55) {
    if (job.sourceName === "jobs.ch search preview") {
      return hasProfileAlignedSignal(job, profile);
    }

    return true;
  }

  return (
    hasValidDetailForRelaxedThreshold(job) &&
    hasProfileAlignedSignal(job, profile)
  );
}

function getFinalJobsForOutput(jobs: Job[], profile: CvProfile) {
  const highQualityJobs = jobs.filter((job) => (job.score || 0) >= 65);
  const fallbackQualityJobs = jobs.filter((job) =>
    isFallbackQualityJob(job, profile)
  );
  const relaxedThresholdUsed = fallbackQualityJobs.some(
    (job) => (job.score || 0) < 55
  );

  return {
    highQualityJobs,
    fallbackQualityJobs,
    finalJobs:
      highQualityJobs.length >= 10
        ? highQualityJobs.slice(0, 25)
        : fallbackQualityJobs.slice(0, 25),
    finalScoreThreshold:
      highQualityJobs.length >= 10 ? 65 : relaxedThresholdUsed ? 50 : 55,
  };
}

function createReasonCounts(values: string[], limit = 10) {
  return Object.entries(
    values.reduce<Record<string, number>>((acc, value) => {
      const key = cleanText(value).slice(0, 120);

      if (!key) return acc;

      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {})
  )
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([reason, count]) => ({ reason, count }));
}

function createSmallKeywordSample(values: string[] = [], limit = 3) {
  return values
    .map((value) => cleanText(value).slice(0, 80))
    .filter(Boolean)
    .slice(0, limit);
}

function createScoreTooLowDiagnostics(
  jobs: Job[],
  profile: CvProfile,
  jobWaveMetadata: WeakMap<Job, JobWaveMetadata>
) {
  const scores = jobs.map((job) => job.score || 0);
  const averageScore =
    scores.length > 0
      ? Math.round(
          (scores.reduce((sum, score) => sum + score, 0) / scores.length) * 10
        ) / 10
      : null;

  return {
    total: jobs.length,
    minScore: scores.length > 0 ? Math.min(...scores) : null,
    maxScore: scores.length > 0 ? Math.max(...scores) : null,
    averageScore,
    scoreBands: {
      score50To54: jobs.filter(
        (job) => (job.score || 0) >= 50 && (job.score || 0) < 55
      ).length,
      score45To49: jobs.filter(
        (job) => (job.score || 0) >= 45 && (job.score || 0) < 50
      ).length,
      scoreBelow45: jobs.filter((job) => (job.score || 0) < 45).length,
    },
    previewOnlyCount: jobs.filter(
      (job) => job.sourceName === "jobs.ch search preview"
    ).length,
    validDetailCount: jobs.filter(hasValidDetailForRelaxedThreshold).length,
    profileAnchorCount: jobs.filter((job) => hasProfileAlignedSignal(job, profile))
      .length,
    hardNegativeCount: jobs.filter(hasStrongFinalNegative).length,
    topMissingKeywordReasons: createReasonCounts(
      jobs.flatMap((job) => (job.missingKeywords || []).slice(0, 10))
    ),
    topMatchedKeywordReasons: createReasonCounts(
      jobs.flatMap((job) => (job.matchedKeywords || []).slice(0, 10))
    ),
    sampleJobs: jobs.slice(0, 8).map((job) => {
      const waveMetadata = jobWaveMetadata.get(job);

      return {
        title: cleanText(job.title).slice(0, 120),
        company: cleanText(job.company).slice(0, 100),
        score: job.score || 0,
        sourceName: job.sourceName || "",
        query: cleanText(job.keyword).slice(0, 160),
        location: cleanText(job.location).slice(0, 100),
        distanceScore: job.distanceScore ?? null,
        distanceKm: job.distanceKm ?? null,
        requirementMatchScore: job.requirementMatchScore ?? null,
        matchedKeywordsCount: (job.matchedKeywords || []).length,
        missingKeywordsCount: (job.missingKeywords || []).length,
        firstMissingKeywords: createSmallKeywordSample(job.missingKeywords, 3),
        firstMatchedKeywords: createSmallKeywordSample(job.matchedKeywords, 3),
        hasValidDetail: hasValidDetailForRelaxedThreshold(job),
        isPreview: job.sourceName === "jobs.ch search preview",
        hasProfileAnchor: hasProfileAlignedSignal(job, profile),
        hasHardNegative: hasStrongFinalNegative(job),
        waveId: waveMetadata?.id ?? null,
        waveName: waveMetadata?.name ?? null,
      };
    }),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const runId = createRunId();
  const debugStats = createSearchRunDebugStats(runId);

  try {
    const maxRuntimeMs = 65000;

    const body = await req.json();

    const fileName = body.fileName;
    const fileBase64 = body.fileBase64;

    const knownUrls: string[] = Array.isArray(body.knownUrls)
      ? body.knownUrls
      : [];

    const knownUrlSet = new Set(
      knownUrls.filter(Boolean).map((url) => normalizeUrl(String(url)))
    );

    let profile = normalizeProfile(body.profile);

    if (!profile) {
      if (!fileName || !fileBase64) {
        throw new Error("CV Profil fehlt und CV PDF fehlt");
      }

      profile = await createProfileFromCv(fileName, fileBase64);
    }

    const searchQueries = getSearchQueries(profile, new Set<string>());
    const {
      localLocations,
      zurichLocations,
      schwyzLocations,
      zugLocations,
    } = getSearchLocations(profile);
    const orderedSearchLocations = [
      ...localLocations,
      ...zurichLocations,
      ...schwyzLocations,
      ...zugLocations,
    ];
    const knownUrlsCount = knownUrlSet.size;
    const veryLightMode = false;
    const lightMode = false;
    const targetLinks = 120;
    const targetFinalJobs = 25;
    const maxDetailJobsUsed = 30;
    const maxDetailAttemptsUsed = 45;
    const searchWaves = createSearchWaves(
      profile,
      searchQueries,
      orderedSearchLocations
    );
    const maxPagesUsed = Math.max(
      0,
      ...searchWaves.map((wave) => wave.maxPages)
    );

    console.info("search-jobs run start", {
      runId,
      queryCount: searchQueries.length,
      queries: searchQueries.map((query) => query.term),
      querySources: searchQueries.reduce<Record<string, number>>(
        (acc, query) => {
          acc[query.source] = (acc[query.source] || 0) + 1;
          return acc;
        },
        {}
      ),
      locations: orderedSearchLocations,
      locationCount: orderedSearchLocations.length,
      knownUrlsCount,
      targetLinks,
      maxPagesUsed,
      maxDetailJobsUsed,
      lightMode,
      veryLightMode,
      waves: searchWaves.map((wave) => ({
        id: wave.id,
        name: wave.name,
        queryCount: wave.queries.length,
        queries: wave.queries.map((query) => query.term),
        locationCount: wave.locations.length,
        locations: wave.locations,
        maxPages: wave.maxPages,
        targetLinks: wave.targetLinks,
        detailLimit: wave.detailLimit,
        allowFallbackJobs: wave.allowFallbackJobs,
      })),
    });

    let foundLinks: SearchHit[] = [];
    const visitedSearchPageKeys = new Set<string>();
    const jobs: Job[] = [];
    const jobWaveMetadata = new WeakMap<Job, JobWaveMetadata>();
    const usedUrls = new Set<string>();
    const oldUrls = new Set<string>();
    let skippedKnown = 0;
    let skippedDuplicate = 0;
    let searchPagesFetched = 0;
    let searchPagesFailed = 0;
    let totalLinksBeforeDedup = 0;
    let totalLinksAfterDedup = 0;
    let linkDuplicates = 0;
    let detailAttempts = 0;
    let detailSuccess = 0;
    let detailFailed = 0;
    let fallbackUsed = 0;
    let skippedOld = 0;
    const sectionStats: SectionParsingStats = {
      sectionParsingSkipped: 0,
      sectionParsingFailed: 0,
      sectionParsingUsed: 0,
    };

    for (const wave of searchWaves) {
      if (Date.now() - startedAt > maxRuntimeMs - 5000) break;
      if (jobs.length >= maxDetailJobsUsed) break;
      if (detailAttempts >= maxDetailAttemptsUsed) break;

      const waveKnownUrlSet = new Set(knownUrlSet);
      for (const url of usedUrls) waveKnownUrlSet.add(url);
      for (const url of oldUrls) waveKnownUrlSet.add(url);
      for (const hit of foundLinks) waveKnownUrlSet.add(normalizeUrl(hit.url));

      const collectedLinks = await collectLinks(
        wave.queries,
        wave.locations,
        startedAt,
        maxRuntimeMs,
        wave.targetLinks,
        waveKnownUrlSet,
        wave.maxPages,
        debugStats,
        visitedSearchPageKeys
      );

      skippedKnown += collectedLinks.skippedKnown;
      searchPagesFetched += collectedLinks.searchPagesFetched;
      searchPagesFailed += collectedLinks.searchPagesFailed;
      totalLinksBeforeDedup += collectedLinks.totalLinksBeforeDedup;
      linkDuplicates += collectedLinks.linkDuplicates;
      mergeSearchHits(foundLinks, collectedLinks.foundLinks);
      totalLinksAfterDedup = foundLinks.length;

      const balancedWaveLinks = selectBalancedSearchHits(
        collectedLinks.foundLinks,
        wave.candidateLimit
      );
      const waveCandidates = selectWaveCandidates(
        balancedWaveLinks,
        profile,
        wave.candidateLimit
      );

      console.info("search-jobs wave collected", {
        runId,
        wave: wave.name,
        waveId: wave.id,
        queries: wave.queries.map((query) => query.term),
        locations: wave.locations,
        searchPagesAttempted: collectedLinks.searchPagesAttempted,
        searchPagesFetched: collectedLinks.searchPagesFetched,
        searchPagesFailed: collectedLinks.searchPagesFailed,
        linksBeforeDedup: collectedLinks.totalLinksBeforeDedup,
        linksAfterDedup: collectedLinks.totalLinksAfterDedup,
        candidatesSelected: waveCandidates.length,
        skippedKnown: collectedLinks.skippedKnown,
      });

      const waveDetailLimit = Math.min(
        wave.detailLimit,
        maxDetailAttemptsUsed - detailAttempts
      );
      let waveDetailAttempts = 0;
      let waveJobsAddedBefore = jobs.length;

      for (const item of waveCandidates.slice(0, waveDetailLimit)) {
        if (Date.now() - startedAt > maxRuntimeMs - 3500) break;
        if (jobs.length >= maxDetailJobsUsed) break;
        if (detailAttempts >= maxDetailAttemptsUsed) break;

        const normalizedItemUrl = normalizeUrl(item.url);

        if (!normalizedItemUrl || !normalizedItemUrl.startsWith("http")) {
          incrementDiscardReason(debugStats, "invalidUrl");
        }

        if (knownUrlSet.has(normalizedItemUrl)) {
          skippedKnown++;
          continue;
        }

        if (usedUrls.has(normalizedItemUrl)) {
          skippedDuplicate++;
          continue;
        }

        let job: Job | null = null;
        detailAttempts++;
        waveDetailAttempts++;
        const allowSectionParsing = detailAttempts <= 20;

        try {
          const detailResult = await fetchHtmlWithRetry(item.url, 0, 3000);
          const detailedJob = extractJobDetail(
            detailResult.html,
            item.url,
            jobs.length + 1,
            item.keyword,
            profile,
            item,
            sectionStats,
            allowSectionParsing
          );

          const detailRejectReason = getDetailedJobRejectReason(detailedJob);

          if (!detailRejectReason) {
            job = await applyDistanceAwareScore(
              detailedJob,
              profile,
              getLocationFromKeyword(item.keyword)
            );
            detailSuccess++;
          } else {
            incrementDiscardReason(debugStats, detailRejectReason);
            detailFailed++;

            if (wave.allowFallbackJobs) {
              job = await applyDistanceAwareScore(
                createFallbackJobFromHit(
                  item,
                  jobs.length + 1,
                  profile,
                  sectionStats,
                  allowSectionParsing
                ),
                profile,
                getLocationFromKeyword(item.keyword)
              );
              fallbackUsed++;
            }
          }
        } catch (error) {
          const failureReason = getFetchFailureReason(error);

          if (failureReason === "timeout") {
            incrementDiscardReason(debugStats, "timeout");
          } else {
            incrementDiscardReason(debugStats, "noDetail");
          }

          detailFailed++;

          if (wave.allowFallbackJobs) {
            job = await applyDistanceAwareScore(
              createFallbackJobFromHit(
                item,
                jobs.length + 1,
                profile,
                sectionStats,
                allowSectionParsing
              ),
              profile,
              getLocationFromKeyword(item.keyword)
            );
            fallbackUsed++;
          }
        }

        if (!job) continue;

        jobWaveMetadata.set(job, { id: wave.id, name: wave.name });

        if (isTooOldJob(job)) {
          skippedOld++;
          oldUrls.add(normalizedItemUrl);
          continue;
        }

        const normalizedJobUrl = normalizeUrl(job.url);

        if (knownUrlSet.has(normalizedJobUrl)) {
          skippedKnown++;
          continue;
        }

        if (addOrReplaceDuplicateJob(jobs, job)) {
          skippedDuplicate++;
          incrementDiscardReason(debugStats, "duplicate");
          usedUrls.add(normalizedJobUrl);
          continue;
        }

        usedUrls.add(normalizedJobUrl);
      }

      const finalizableJobsBeforePreviewFallback =
        getFinalJobsForOutput(jobs, profile).finalJobs.length;

      if (
        wave.allowFallbackJobs &&
        finalizableJobsBeforePreviewFallback < 15
      ) {
        for (const item of waveCandidates) {
          if (jobs.length >= maxDetailJobsUsed) break;
          if (
            getFinalJobsForOutput(jobs, profile).finalJobs.length >=
            Math.min(maxDetailJobsUsed, targetFinalJobs)
          ) {
            break;
          }

          const normalized = normalizeUrl(item.url);

          if (
            knownUrlSet.has(normalized) ||
            usedUrls.has(normalized) ||
            oldUrls.has(normalized)
          ) {
            if (usedUrls.has(normalized)) {
              incrementDiscardReason(debugStats, "duplicate");
            }
            continue;
          }

          const fallbackJob = await applyDistanceAwareScore(
            createFallbackJobFromHit(
              item,
              jobs.length + 1,
              profile,
              sectionStats,
              false
            ),
            profile,
            getLocationFromKeyword(item.keyword)
          );

          jobWaveMetadata.set(fallbackJob, { id: wave.id, name: wave.name });

          if (isTooOldJob(fallbackJob)) {
            skippedOld++;
            oldUrls.add(normalized);
            continue;
          }

          if (addOrReplaceDuplicateJob(jobs, fallbackJob)) {
            skippedDuplicate++;
            incrementDiscardReason(debugStats, "duplicate");
            usedUrls.add(normalized);
            continue;
          }

          usedUrls.add(normalized);
          fallbackUsed++;
        }
      }

      sortJobsForOutput(jobs);
      const waveFinalState = getFinalJobsForOutput(jobs, profile);

      console.info("search-jobs wave summary", {
        runId,
        wave: wave.name,
        waveId: wave.id,
        detailAttempts: waveDetailAttempts,
        jobsAdded: jobs.length - waveJobsAddedBefore,
        jobsTotal: jobs.length,
        highQualityJobs: waveFinalState.highQualityJobs.length,
        finalJobsAvailable: waveFinalState.finalJobs.length,
        fallbackUsed,
      });

      const hasEnoughHighQuality =
        waveFinalState.highQualityJobs.length >= targetFinalJobs;
      const hasEnoughProgressiveResults =
        wave.id >= 2 && waveFinalState.finalJobs.length >= targetFinalJobs;

      if (hasEnoughHighQuality || hasEnoughProgressiveResults) {
        break;
      }
    }

    sortJobsForOutput(jobs);

    const { finalJobs, finalScoreThreshold } = getFinalJobsForOutput(
      jobs,
      profile
    );
    const finalJobUrlSet = new Set(
      finalJobs.map((job) => normalizeUrl(job.url))
    );
    const scoreTooLowJobs = jobs.filter(
      (job) =>
        !finalJobUrlSet.has(normalizeUrl(job.url)) &&
        (job.score || 0) < finalScoreThreshold
    );
    const scoreTooLowCount = scoreTooLowJobs.length;
    debugStats.discardReasons.scoreTooLow += scoreTooLowCount;

    if (scoreTooLowJobs.length > 0) {
      try {
        console.info("search-jobs score-too-low diagnostics", {
          runId,
          finalScoreThreshold,
          ...createScoreTooLowDiagnostics(
            scoreTooLowJobs,
            profile,
            jobWaveMetadata
          ),
        });
      } catch (error) {
        console.warn("search-jobs score-too-low diagnostics failed", {
          runId,
          totalScoreTooLow: scoreTooLowJobs.length,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const locationStats = createLocationStats(foundLinks, finalJobs);
    const recencyStats = createRecencyStats(finalJobs);
    const mismatchStats = createMismatchStats(finalJobs);

    console.info("search-jobs run summary", {
      runId,
      durationMs: Date.now() - startedAt,
      queryCount: searchQueries.length,
      queries: searchQueries.map((query) => query.term),
      locations: orderedSearchLocations,
      searchPagesAttempted: debugStats.searchPagesAttempted,
      searchPagesFetched,
      searchPagesFailed,
      totalLinksBeforeDedup,
      totalLinksAfterDedup,
      linksAfterBalancing: foundLinks.length,
      linkDuplicates,
      skippedKnown,
      detailPagesAttempted: detailAttempts,
      detailPagesSucceeded: detailSuccess,
      detailPagesFailed: detailFailed,
      fallbackUsed,
      jobsBeforeFinalFilter: jobs.length,
      finalScoreThreshold,
      finalJobsReturned: finalJobs.length,
      discardReasons: debugStats.discardReasons,
    });

    return new Response(
      JSON.stringify({
        profile,
        jobs: finalJobs,
        count: finalJobs.length,
        scanned: detailAttempts,
        foundLinks: foundLinks.length,
        knownUrls: knownUrlsCount,
        knownUrlsCount,
        lightMode,
        maxDetailJobsUsed,
        skippedKnown,
        skippedDuplicate,
        detailAttempts,
        detailSuccess,
        detailFailed,
        fallbackUsed,
        skippedOld,
        sectionParsingSkipped: sectionStats.sectionParsingSkipped,
        sectionParsingFailed: sectionStats.sectionParsingFailed,
        sectionParsingUsed: sectionStats.sectionParsingUsed,
        searchPagesFetched,
        searchPagesFailed,
        searchQueries: searchQueries.map((query) => query.term),
        searchSources: searchQueries.reduce<Record<string, number>>(
          (acc, query) => {
            acc[query.source] = (acc[query.source] || 0) + 1;
            return acc;
          },
          {}
        ),
        locationStats,
        recencyStats,
        mismatchStats,
        noNewJobs: finalJobs.length === 0,
        message:
          finalJobs.length === 0
            ? "Keine neuen Jobs gefunden. Es wurden Links gefunden, aber keine verwertbaren neuen Treffer erzeugt."
            : fallbackUsed > 0
            ? "Neue Jobs gefunden. Einige Treffer wurden aus der jobs.ch Suchvorschau erstellt, weil Detailseiten nicht zuverlässig lesbar waren."
            : "Neue Jobs gefunden.",
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("search-jobs run failed", {
      runId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });

    return new Response(
      JSON.stringify({
        error: String(error),
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
