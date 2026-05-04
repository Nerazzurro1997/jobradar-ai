const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const CACHE_VERSION = "analyze-cv-v3";

function getDurationMs(start: number) {
  return Math.round(performance.now() - start);
}

function logDuration(
  label: string,
  start: number,
  details: Record<string, unknown> = {}
) {
  console.info(label, {
    durationMs: getDurationMs(start),
    ...details,
  });
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanJsonText(text = "") {
  return text.replace(/```json/gi, "").replace(/```/g, "").trim();
}

function extractJsonObject(text = "") {
  const cleaned = cleanJsonText(text);
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    return cleaned;
  }

  return cleaned.slice(first, last + 1);
}

function safeArray(value: unknown, limit = 30) {
  return Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim())
        .slice(0, limit)
    : [];
}

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim().match(/\d+(\.\d+)?/)?.[0]);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function uniqueArray(items: string[], limit = 50) {
  return [...new Set(items.filter(Boolean).map((item) => item.trim()))].slice(
    0,
    limit
  );
}

async function calculateFileHash(fileBase64: string) {
  const payload = new TextEncoder().encode(`${CACHE_VERSION}:${fileBase64}`);
  const digest = await crypto.subtle.digest("SHA-256", payload);

  const fileHash = [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  console.info("CV cache file hash", {
    fileHashPrefix: fileHash.slice(0, 12),
  });

  return fileHash;
}

function getCacheConfig() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const hasSupabaseUrl = Boolean(supabaseUrl);
  const hasServiceRoleKey = Boolean(serviceRoleKey);

  console.info("CV cache config", {
    hasSupabaseUrl,
    hasServiceRoleKey,
  });

  if (!supabaseUrl || !serviceRoleKey) {
    console.warn(
      "CV cache disabled: missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY"
    );
    return null;
  }

  return {
    supabaseUrl: supabaseUrl.replace(/\/$/, ""),
    serviceRoleKey,
  };
}

async function getCachedCvProfile(fileHash: string) {
  const fileHashPrefix = fileHash.slice(0, 12);

  console.info("CV cache lookup start", {
    fileHashPrefix,
    cacheVersion: CACHE_VERSION,
  });

  const cacheConfig = getCacheConfig();

  if (!cacheConfig) {
    return null;
  }

  try {
    const url = new URL(`${cacheConfig.supabaseUrl}/rest/v1/cv_profile_cache`);

    url.searchParams.set("file_hash", `eq.${fileHash}`);
    url.searchParams.set("cache_version", `eq.${CACHE_VERSION}`);
    url.searchParams.set("select", "profile,document_validation");
    url.searchParams.set("limit", "1");

    const response = await fetch(url.toString(), {
      headers: {
        apikey: cacheConfig.serviceRoleKey,
        Authorization: `Bearer ${cacheConfig.serviceRoleKey}`,
      },
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      console.warn("CV profile cache lookup failed", {
        status: response.status,
        body: responseBody.slice(0, 500),
      });
      return null;
    }

    const rows = await response.json();
    const row = Array.isArray(rows) ? rows[0] : null;

    if (row?.profile) {
      console.info("CV cache hit", { fileHashPrefix });
      return row;
    }

    console.info("CV cache miss", { fileHashPrefix });
    return null;
  } catch (error) {
    console.warn("CV profile cache lookup failed", error);
    return null;
  }
}

async function saveCachedCvProfile(
  fileHash: string,
  profile: unknown,
  documentValidation: unknown
) {
  const fileHashPrefix = fileHash.slice(0, 12);

  console.info("CV cache save start", {
    fileHashPrefix,
    cacheVersion: CACHE_VERSION,
  });

  const cacheConfig = getCacheConfig();

  if (!cacheConfig) {
    return;
  }

  try {
    const url = new URL(`${cacheConfig.supabaseUrl}/rest/v1/cv_profile_cache`);

    url.searchParams.set("on_conflict", "file_hash,cache_version");

    const response = await fetch(url.toString(), {
      method: "POST",
      headers: {
        apikey: cacheConfig.serviceRoleKey,
        Authorization: `Bearer ${cacheConfig.serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        file_hash: fileHash,
        cache_version: CACHE_VERSION,
        profile,
        document_validation: documentValidation,
      }),
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      console.warn("CV profile cache save failed", {
        status: response.status,
        body: responseBody.slice(0, 500),
      });
      return;
    }

    console.info("CV cache save success", { fileHashPrefix });
  } catch (error) {
    console.warn("CV profile cache save failed", error);
  }
}

async function clearCachedCvProfile(fileHash: string) {
  const fileHashPrefix = fileHash.slice(0, 12);

  console.info("CV cache clear start", {
    fileHashPrefix,
    cacheVersion: CACHE_VERSION,
  });

  const cacheConfig = getCacheConfig();

  if (!cacheConfig) {
    return false;
  }

  try {
    const url = new URL(`${cacheConfig.supabaseUrl}/rest/v1/cv_profile_cache`);

    url.searchParams.set("file_hash", `eq.${fileHash}`);
    url.searchParams.set("cache_version", `eq.${CACHE_VERSION}`);

    const response = await fetch(url.toString(), {
      method: "DELETE",
      headers: {
        apikey: cacheConfig.serviceRoleKey,
        Authorization: `Bearer ${cacheConfig.serviceRoleKey}`,
        Prefer: "return=minimal",
      },
    });

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      console.warn("CV cache clear failed", {
        status: response.status,
        body: responseBody.slice(0, 500),
      });
      return false;
    }

    console.info("CV cache clear success", { fileHashPrefix });
    return true;
  } catch (error) {
    console.warn("CV cache clear failed", error);
    return false;
  }
}

function normalizeBlockedFileNameText(value = "") {
  return value
    .toLowerCase()
    .replace(/\u00e4/g, "ae")
    .replace(/\u00f6/g, "oe")
    .replace(/\u00fc/g, "ue")
    .replace(/\u00df/g, "ss")
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getBlockedNonCvReasonFromFileName(fileName: string): string | null {
  const normalizedFileName = normalizeBlockedFileNameText(fileName);
  const compactFileName = normalizedFileName.replace(/[^a-z0-9]+/g, "");
  const blockedTerms = [
    "arbeitsbestätigung",
    "arbeitsbestaetigung",
    "arbeitszeugnis",
    "arbeitgeberbescheinigung",
    "employment confirmation",
    "employment certificate",
    "work certificate",
    "attestation de travail",
    "certificat de travail",
    "attestato di lavoro",
    "certificato di lavoro",
    "conferma di lavoro",
    "rechnung",
    "invoice",
    "fattura",
    "facture",
    "vertrag",
    "contract",
    "contratto",
    "contrat",
    "police",
    "offerte",
    "offerte assicurativa",
    "versicherungsofferte",
    "stelleninserat",
    "job ad",
  ];

  for (const term of blockedTerms) {
    const normalizedTerm = normalizeBlockedFileNameText(term);
    const compactTerm = normalizedTerm.replace(/[^a-z0-9]+/g, "");

    if (
      normalizedFileName.includes(normalizedTerm) ||
      compactFileName.includes(compactTerm)
    ) {
      return `Filename contains non-CV document signal: ${term}`;
    }
  }

  return null;
}

function getBlockedNonCvReasonFromValidation(validation: any): string | null {
  const text = normalizeBlockedFileNameText(
    [
      safeString(validation?.documentType),
      ...safeArray(validation?.nonCvSignals, 20),
    ].join(" ")
  );
  const compactText = text.replace(/[^a-z0-9]+/g, "");
  const blockedTerms = [
    "arbeitsbestätigung",
    "arbeitsbestaetigung",
    "arbeitszeugnis",
    "arbeitgeberbescheinigung",
    "employment confirmation",
    "employment certificate",
    "work certificate",
    "attestation de travail",
    "certificat de travail",
    "attestato di lavoro",
    "certificato di lavoro",
    "conferma di lavoro",
    "attestato",
    "certificato",
    "certificate",
    "diploma",
    "rechnung",
    "invoice",
    "fattura",
    "facture",
    "vertrag",
    "contract",
    "contratto",
    "contrat",
    "police",
    "polizza",
    "versicherungspolice",
  ];

  for (const term of blockedTerms) {
    const normalizedTerm = normalizeBlockedFileNameText(term);
    const compactTerm = normalizedTerm.replace(/[^a-z0-9]+/g, "");

    if (text.includes(normalizedTerm) || compactText.includes(compactTerm)) {
      return `Document validation found non-CV signal: ${term}`;
    }
  }

  return null;
}

function extractStructuredOutput(data: any) {
  if (typeof data?.output_parsed === "object" && data.output_parsed) {
    return data.output_parsed;
  }

  if (typeof data?.parsed === "object" && data.parsed) {
    return data.parsed;
  }

  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (!Array.isArray(item?.content)) continue;

      for (const content of item.content) {
        if (typeof content?.parsed === "object" && content.parsed) {
          return content.parsed;
        }

        if (typeof content?.json === "object" && content.json) {
          return content.json;
        }
      }
    }
  }

  return null;
}

function extractOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts: string[] = [];

  if (Array.isArray(data?.output)) {
    for (const item of data.output) {
      if (Array.isArray(item?.content)) {
        for (const content of item.content) {
          if (typeof content?.text === "string" && content.text.trim()) {
            parts.push(content.text.trim());
          }

          if (
            content?.type === "output_text" &&
            typeof content?.text === "string" &&
            content.text.trim()
          ) {
            parts.push(content.text.trim());
          }

          if (typeof content?.json === "object" && content.json) {
            return JSON.stringify(content.json);
          }

          if (typeof content?.parsed === "object" && content.parsed) {
            return JSON.stringify(content.parsed);
          }
        }
      }
    }
  }

  return parts.join("\n").trim();
}

async function parseOpenAiResponse(response: Response) {
  const rawText = await response.text();

  try {
    return {
      data: JSON.parse(rawText),
      rawText,
      isJson: true,
    };
  } catch {
    return {
      data: null,
      rawText,
      isJson: false,
    };
  }
}

function tryParseJson(text: string) {
  const extracted = extractJsonObject(text);

  try {
    return JSON.parse(extracted);
  } catch {
    // try basic cleanup below
  }

  try {
    const fixed = extracted
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]")
      .replace(/\u0000/g, "");

    return JSON.parse(fixed);
  } catch {
    return null;
  }
}

function extractJsonFromText(text = "") {
  const cleaned = cleanJsonText(text);
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    return null;
  }

  const candidate = cleaned.slice(first, last + 1);

  try {
    return JSON.parse(candidate);
  } catch {
    // try basic cleanup below
  }

  try {
    return JSON.parse(
      candidate
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]")
        .replace(/\u0000/g, "")
    );
  } catch {
    return null;
  }
}

function extractBalancedJsonObject(text: string, startIndex: number) {
  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = startIndex; index < text.length; index++) {
    const char = text[index];

    if (escaped) {
      escaped = false;
      continue;
    }

    if (char === "\\") {
      escaped = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === "{") depth++;

    if (char === "}") {
      depth--;

      if (depth === 0) {
        return text.slice(startIndex, index + 1);
      }
    }
  }

  return "";
}

function extractStringFieldFromText(text: string, fieldName: string) {
  const match = text.match(new RegExp(`"${fieldName}"\\s*:\\s*"([^"]*)"`, "i"));
  return match ? match[1].trim() : "";
}

function extractNumberFieldFromText(text: string, fieldName: string) {
  const match = text.match(
    new RegExp(`"${fieldName}"\\s*:\\s*(-?\\d+(?:\\.\\d+)?)`, "i")
  );

  if (!match) return null;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractDocumentValidationFromText(text = "") {
  const cleaned = cleanJsonText(text);
  const lower = cleaned.toLowerCase();
  const keyIndex = lower.indexOf("documentvalidation");
  const searchStart = keyIndex >= 0 ? keyIndex : 0;
  const braceIndex = cleaned.indexOf("{", searchStart);

  if (braceIndex >= 0) {
    const validationText = extractBalancedJsonObject(cleaned, braceIndex);
    const parsedValidation = validationText
      ? extractJsonFromText(validationText)
      : null;

    if (
      parsedValidation &&
      typeof parsedValidation.shouldAnalyze === "boolean"
    ) {
      return parsedValidation;
    }
  }

  const windowText = cleaned.slice(searchStart, searchStart + 2000);
  const shouldAnalyzeMatch = windowText.match(
    /"shouldAnalyze"\s*:\s*(true|false)/i
  );

  if (!shouldAnalyzeMatch) {
    return null;
  }

  return {
    shouldAnalyze: shouldAnalyzeMatch[1].toLowerCase() === "true",
    documentType: extractStringFieldFromText(windowText, "documentType"),
    confidence: extractNumberFieldFromText(windowText, "confidence"),
    cvSignals: [],
    nonCvSignals: [],
    reason: extractStringFieldFromText(windowText, "reason"),
  };
}

function hasPotentialAnalysisJson(text = "") {
  const cleaned = cleanJsonText(text).toLowerCase();

  if (!cleaned.includes("{")) {
    return false;
  }

  return [
    "documentvalidation",
    "shouldanalyze",
    "profile",
    "searchterms",
    "strongkeywords",
    "avoidkeywords",
    "locations",
    "profilesummary",
    "cvhighlights",
    "skilltags",
    "languageprofile",
    "matching",
    "summary",
    "identity",
    "search",
    "experience",
    "skills",
    "preferences",
    "deepprofile",
  ].some((key) => cleaned.includes(`"${key}"`));
}

const stringArraySchema = {
  type: "array",
  items: { type: "string" },
};

const languageProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    languages: stringArraySchema,
    strongestLanguages: stringArraySchema,
    businessLanguages: stringArraySchema,
    languageKeywords: stringArraySchema,
    languageSummary: { type: "string" },
  },
  required: [
    "languages",
    "strongestLanguages",
    "businessLanguages",
    "languageKeywords",
    "languageSummary",
  ],
};

const identitySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    currentRole: { type: "string" },
    targetRole: { type: "string" },
    seniorityLevel: { type: "string" },
    yearsOfExperience: { type: ["number", "null"] },
    industryFocus: stringArraySchema,
  },
  required: [
    "currentRole",
    "targetRole",
    "seniorityLevel",
    "yearsOfExperience",
    "industryFocus",
  ],
};

const searchProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    searchTerms: stringArraySchema,
    strongKeywords: stringArraySchema,
    avoidKeywords: stringArraySchema,
    preferredLocations: stringArraySchema,
    preferredRoles: stringArraySchema,
    acceptableRoles: stringArraySchema,
    avoidRoles: stringArraySchema,
  },
  required: [
    "searchTerms",
    "strongKeywords",
    "avoidKeywords",
    "preferredLocations",
    "preferredRoles",
    "acceptableRoles",
    "avoidRoles",
  ],
};

const experienceProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    roles: stringArraySchema,
    insuranceExperience: stringArraySchema,
    adminExperience: stringArraySchema,
    salesExperience: stringArraySchema,
    customerExperience: stringArraySchema,
    underwritingRelatedExperience: stringArraySchema,
    claimsRelatedExperience: stringArraySchema,
  },
  required: [
    "roles",
    "insuranceExperience",
    "adminExperience",
    "salesExperience",
    "customerExperience",
    "underwritingRelatedExperience",
    "claimsRelatedExperience",
  ],
};

const skillsProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    hardSkills: stringArraySchema,
    softSkills: stringArraySchema,
    tools: stringArraySchema,
    languages: stringArraySchema,
    certifications: stringArraySchema,
  },
  required: [
    "hardSkills",
    "softSkills",
    "tools",
    "languages",
    "certifications",
  ],
};

const preferencesProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    workload: { type: "string" },
    employmentType: { type: "string" },
    workMode: { type: "string" },
    salaryExpectation: { type: "string" },
    fixumPreference: { type: "string" },
    commutePreference: { type: "string" },
  },
  required: [
    "workload",
    "employmentType",
    "workMode",
    "salaryExpectation",
    "fixumPreference",
    "commutePreference",
  ],
};

const matchingProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    bestFitRoles: stringArraySchema,
    acceptableRoles: stringArraySchema,
    weakFitRoles: stringArraySchema,
    dealBreakers: stringArraySchema,
    sellingPoints: stringArraySchema,
    riskAreas: stringArraySchema,
    scoringHints: stringArraySchema,
    applicationPositioning: stringArraySchema,
  },
  required: [
    "bestFitRoles",
    "acceptableRoles",
    "weakFitRoles",
    "dealBreakers",
    "sellingPoints",
    "riskAreas",
    "scoringHints",
    "applicationPositioning",
  ],
};

const summaryProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    shortSummary: { type: "string" },
    detailedSummary: { type: "string" },
    recruiterPitch: { type: "string" },
  },
  required: ["shortSummary", "detailedSummary", "recruiterPitch"],
};

const compactProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    searchTerms: stringArraySchema,
    strongKeywords: stringArraySchema,
    avoidKeywords: stringArraySchema,
    locations: stringArraySchema,
    profileSummary: { type: "string" },
    cvHighlights: stringArraySchema,
    skillTags: stringArraySchema,
    languageProfile: languageProfileSchema,
    matching: matchingProfileSchema,
    summary: summaryProfileSchema,
    identity: identitySchema,
    search: searchProfileSchema,
    experience: experienceProfileSchema,
    skills: skillsProfileSchema,
    preferences: preferencesProfileSchema,
  },
  required: [
    "searchTerms",
    "strongKeywords",
    "avoidKeywords",
    "locations",
    "profileSummary",
    "cvHighlights",
    "skillTags",
    "languageProfile",
    "matching",
    "summary",
    "identity",
    "search",
    "experience",
    "skills",
    "preferences",
  ],
};

const nullableCompactProfileSchema = {
  ...compactProfileSchema,
  type: ["object", "null"],
};

const aiProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    profileSummary: { type: "string" },
    cvHighlights: stringArraySchema,
    languageProfile: languageProfileSchema,
    identity: identitySchema,
    search: searchProfileSchema,
    experience: experienceProfileSchema,
    skills: skillsProfileSchema,
    preferences: preferencesProfileSchema,
    matching: matchingProfileSchema,
    summary: summaryProfileSchema,
  },
  required: [
    "profileSummary",
    "cvHighlights",
    "languageProfile",
    "identity",
    "search",
    "experience",
    "skills",
    "preferences",
    "matching",
    "summary",
  ],
};

const nullableAiProfileSchema = {
  ...aiProfileSchema,
  type: ["object", "null"],
};

const documentValidationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    shouldAnalyze: { type: "boolean" },
    documentType: { type: "string" },
    confidence: { type: "number" },
    cvSignals: stringArraySchema,
    nonCvSignals: stringArraySchema,
    reason: { type: "string" },
  },
  required: [
    "shouldAnalyze",
    "documentType",
    "confidence",
    "cvSignals",
    "nonCvSignals",
    "reason",
  ],
};

const cvAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    documentValidation: documentValidationSchema,
    profile: nullableAiProfileSchema,
  },
  required: ["documentValidation", "profile"],
};

async function repairJsonWithOpenAI(apiKey: string, brokenText: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let repairResponse: Response;

  try {
    repairResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0,
        max_output_tokens: 4200,
        text: {
          format: {
            type: "json_schema",
            name: "cv_analysis_repair",
            strict: true,
            schema: cvAnalysisSchema,
          },
        },
        input: [
          {
            role: "system",
            content:
              "You repair broken JSON. Return only valid JSON matching the combined CV validation and profile schema. No markdown. No explanations.",
          },
          {
            role: "user",
            content: `
Repair this broken JSON into the requested schema.

If information is missing, use empty arrays, empty strings, or null.
If documentValidation.shouldAnalyze is false, keep shouldAnalyze false and set profile to null.

Broken JSON:
${brokenText.slice(0, 10000)}
`.trim(),
          },
        ],
      }),
    });
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }

  const parsedRepair = await parseOpenAiResponse(repairResponse);

  if (!parsedRepair.isJson || !repairResponse.ok) {
    return null;
  }

  const repairedText = extractOutputText(parsedRepair.data);
  if (!repairedText) {
    return null;
  }

  return tryParseJson(repairedText);
}

function normalizeProfile(raw: any) {
  const rawIdentity = raw?.identity || raw?.deepProfile?.identity || {};
  const rawSearch = raw?.search || raw?.deepProfile?.search || {};
  const rawExperience = raw?.experience || raw?.deepProfile?.experience || {};
  const rawSkills = raw?.skills || raw?.deepProfile?.skills || {};
  const rawPreferences =
    raw?.preferences || raw?.deepProfile?.preferences || {};
  const rawMatching = raw?.matching || raw?.deepProfile?.matching || {};
  const rawSummary = raw?.summary || raw?.deepProfile?.summary || {};
  const rawLanguageProfile =
    raw?.languageProfile || raw?.deepProfile?.languageProfile || {};

  const languageProfile = {
    languages: uniqueArray(
      [
        ...safeArray(rawLanguageProfile?.languages, 20),
        ...safeArray(rawSkills?.languages, 20),
      ],
      25
    ),
    strongestLanguages: safeArray(rawLanguageProfile?.strongestLanguages, 10),
    businessLanguages: safeArray(rawLanguageProfile?.businessLanguages, 10),
    languageKeywords: safeArray(rawLanguageProfile?.languageKeywords, 20),
    languageSummary: safeString(rawLanguageProfile?.languageSummary),
  };

  const allLanguages = uniqueArray(languageProfile.languages, 25);

  const searchTerms = uniqueArray(
    [
      ...safeArray(raw?.searchTerms, 25),
      ...safeArray(rawSearch?.searchTerms, 25),
    ],
    25
  );

  const skills = {
    hardSkills: uniqueArray(
      [
        ...safeArray(rawSkills?.hardSkills, 80),
        ...safeArray(raw?.skillTags, 40),
      ],
      60
    ),
    softSkills: safeArray(rawSkills?.softSkills, 40),
    tools: safeArray(rawSkills?.tools, 40),
    languages: allLanguages,
    certifications: safeArray(rawSkills?.certifications, 30),
  };

  const skillTags = uniqueArray(
    [
      ...safeArray(raw?.skillTags, 40),
      ...skills.hardSkills,
      ...skills.tools,
      ...skills.certifications,
    ],
    40
  );

  const strongKeywords = uniqueArray(
    [
      ...safeArray(raw?.strongKeywords, 60),
      ...safeArray(rawSearch?.strongKeywords, 60),
      ...skillTags,
      ...skills.hardSkills,
      ...skills.tools,
      ...skills.certifications,
      ...languageProfile.languageKeywords,
      ...languageProfile.strongestLanguages,
      ...languageProfile.businessLanguages,
    ],
    90
  );

  const bestFitRoles = uniqueArray(
    [
      ...safeArray(rawMatching?.bestFitRoles, 25),
      ...safeArray(rawSearch?.preferredRoles, 25),
    ],
    25
  );
  const acceptableRoles = uniqueArray(
    [
      ...safeArray(rawMatching?.acceptableRoles, 25),
      ...safeArray(rawSearch?.acceptableRoles, 25),
    ],
    25
  );
  const weakFitRoles = safeArray(rawMatching?.weakFitRoles, 25);
  const avoidRoles = uniqueArray(
    [
      ...safeArray(rawSearch?.avoidRoles, 25),
      ...safeArray(rawMatching?.dealBreakers, 25),
    ],
    35
  );
  const dealBreakers = uniqueArray(
    [
      ...safeArray(rawMatching?.dealBreakers, 25),
      ...safeArray(rawSearch?.avoidKeywords, 25),
    ],
    25
  );

  const avoidKeywords = uniqueArray(
    [
      ...safeArray(raw?.avoidKeywords, 45),
      ...safeArray(rawSearch?.avoidKeywords, 45),
      ...avoidRoles,
      ...dealBreakers,
    ],
    45
  );

  const locations = uniqueArray(
    [
      ...safeArray(raw?.locations, 15),
      ...safeArray(rawSearch?.preferredLocations, 15),
    ],
    15
  );

  const profileSummary =
    safeString(raw?.profileSummary) ||
    safeString(rawSummary?.shortSummary) ||
    safeString(rawSummary?.detailedSummary);

  const cvHighlights = uniqueArray(safeArray(raw?.cvHighlights, 12), 12);

  const sellingPoints = safeArray(rawMatching?.sellingPoints, 35);
  const scoringHints = uniqueArray(
    [...safeArray(rawMatching?.scoringHints, 35), ...sellingPoints],
    35
  );
  const riskAreas = safeArray(rawMatching?.riskAreas, 25);
  const applicationPositioning = uniqueArray(
    [
      ...safeArray(rawMatching?.applicationPositioning, 15),
      safeString(rawSummary?.recruiterPitch),
    ],
    15
  );

  const identity = {
    currentRole: safeString(rawIdentity?.currentRole),
    targetRole:
      safeString(rawIdentity?.targetRole) ||
      bestFitRoles[0] ||
      searchTerms[0] ||
      "",
    seniorityLevel: safeString(rawIdentity?.seniorityLevel),
    yearsOfExperience: safeNumber(rawIdentity?.yearsOfExperience),
    industryFocus: safeArray(rawIdentity?.industryFocus, 20),
  };

  const search = {
    searchTerms,
    strongKeywords,
    avoidKeywords,
    preferredLocations: locations,
    preferredRoles: bestFitRoles,
    acceptableRoles,
    avoidRoles,
  };

  const experience = {
    roles: safeArray(rawExperience?.roles, 30),
    insuranceExperience: safeArray(rawExperience?.insuranceExperience, 30),
    adminExperience: safeArray(rawExperience?.adminExperience, 30),
    salesExperience: safeArray(rawExperience?.salesExperience, 30),
    customerExperience: safeArray(rawExperience?.customerExperience, 30),
    underwritingRelatedExperience: safeArray(
      rawExperience?.underwritingRelatedExperience,
      30
    ),
    claimsRelatedExperience: safeArray(
      rawExperience?.claimsRelatedExperience,
      30
    ),
  };

  const preferences = {
    workload: safeString(rawPreferences?.workload),
    employmentType: safeString(rawPreferences?.employmentType),
    workMode: safeString(rawPreferences?.workMode),
    salaryExpectation: safeString(rawPreferences?.salaryExpectation),
    fixumPreference: safeString(rawPreferences?.fixumPreference),
    commutePreference: safeString(rawPreferences?.commutePreference),
  };

  const matching = {
    bestFitRoles,
    acceptableRoles,
    weakFitRoles,
    dealBreakers,
    scoringHints,
    sellingPoints,
    applicationPositioning,
    riskAreas,
  };

  const summary = {
    shortSummary: safeString(rawSummary?.shortSummary),
    detailedSummary: safeString(rawSummary?.detailedSummary),
    recruiterPitch: safeString(rawSummary?.recruiterPitch),
  };

  const deepProfile = {
    identity,
    languageProfile,
    search,
    experience,
    skills,
    preferences,
    matching,
    gaps: {
      missingSkills: safeArray(raw?.gaps?.missingSkills, 25),
      riskAreas,
      howToCompensate: safeArray(raw?.gaps?.howToCompensate, 25),
    },
    summary,
  };

  return {
    searchTerms,
    strongKeywords,
    avoidKeywords,
    locations,
    profileSummary,
    cvHighlights,
    languageProfile,
    skillTags,

    deepProfile,

    identity,
    search,
    experience,
    skills,
    preferences,
    matching,
    gaps: deepProfile.gaps,
    summary,
  };
}

function buildAnalyzeCvPrompt(fileName: string) {
  return `
Validate the uploaded PDF first. Analyze it only if it is clearly a real CV/resume/Lebenslauf.

Return one JSON object matching the schema:
- documentValidation: shouldAnalyze, documentType, confidence, cvSignals, nonCvSignals, reason.
- profile: null when shouldAnalyze is false; otherwise a compact profile with profileSummary, cvHighlights, identity, search, experience, skills, preferences, languageProfile, matching, summary.

Strict CV validation:
- Accept CVs/resumes/Lebenslauf in German, English, Italian, or French only when they show real CV structure.
- Strong CV structure means personal/contact profile plus multiple sections such as Berufserfahrung/work experience/esperienze lavorative/experience professionnelle, Ausbildung/education/formazione, skills/Faehigkeiten/competenze, languages/Sprachen/lingue, profile/Profil, or multiple roles/stations.
- Block invoices/Rechnungen/fatture, contracts/Vertraege/contratti, insurance offers/policies, Arbeitsbestaetigung, Arbeitszeugnis single document, Arbeitgeberbescheinigung, employment/work certificates, attestation/certificat de travail, attestato/certificato/conferma di lavoro, cover letters/application letters without a full CV, job ads/Stelleninserate, standalone certificates/diplomas/references/training records, reports, and generic business documents.
- A document is not a CV merely because it contains a person name, employer, employment dates, job title, or experience at one company.
- shouldAnalyze must be true only when the document is clearly a CV and confidence is at least 0.75. If uncertain, set shouldAnalyze false and profile null.

Filename: ${fileName}

Profile extraction for valid CVs:
- Do not invent facts. Use "", [], or null when the CV does not support a field.
- Keep arrays concise, evidence-based, ordered by matching importance, and free of duplicates.
- Use Swiss/German job-market wording where useful for jobs.ch.
- search.searchTerms must be real jobs.ch role queries, not skills. Prefer 6-12 short queries fitting the CV, e.g. Versicherung Innendienst, Sachbearbeiter Versicherung, Kundenberater Innendienst, Backoffice Versicherung, Underwriting Assistant, Schaden Sachbearbeiter.
- search.strongKeywords should include domain terms, hard skills, tools, certifications, languages, insurance/admin/customer-service keywords, and CV-specific strengths.
- search.avoidKeywords/search.avoidRoles only for real negative signals supported by the CV, e.g. Aussendienst, Provision, Kaltakquise, Praktikum, Lehrstelle, Senior Leadership.
- identity: currentRole, targetRole, seniorityLevel, yearsOfExperience if inferable, industryFocus.
- experience: separate insuranceExperience, adminExperience, salesExperience, customerExperience, underwritingRelatedExperience, claimsRelatedExperience.
- skills: concrete hardSkills, evidenced softSkills, tools, languages, certifications.
- languageProfile: all languages, strongest/business languages, useful language keywords, short business relevance summary.
- matching: bestFitRoles, acceptableRoles, weakFitRoles, dealBreakers, sellingPoints, riskAreas, scoringHints, applicationPositioning.
- preferences: fill workload, employmentType, workMode, salaryExpectation, fixumPreference, commutePreference only if explicitly present.
- profileSummary max 220 chars; cvHighlights 4-8 short points; summary.detailedSummary max 500 chars.
`.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Use POST request" }, 405);
  }

  const analyzeStartedAt = performance.now();

  try {
    const { action, fileName, fileBase64 } = await req.json();

    if (action === "clear_cv_cache") {
      if (!fileBase64) {
        return jsonResponse({
          success: true,
          cleared: false,
          reason: "Missing fileBase64",
        });
      }

      try {
        const fileHash = await calculateFileHash(fileBase64);
        const cleared = await clearCachedCvProfile(fileHash);

        return jsonResponse({
          success: true,
          cleared,
          fileHashPrefix: fileHash.slice(0, 12),
        });
      } catch (error) {
        console.warn("CV cache clear request failed", error);

        return jsonResponse({
          success: true,
          cleared: false,
          reason: "CV cache clear failed",
        });
      }
    }

    if (!fileName || !fileBase64) {
      return jsonResponse(
        { success: false, error: "Missing fileName or fileBase64" },
        400
      );
    }

    const blockedReason = getBlockedNonCvReasonFromFileName(fileName);

    if (blockedReason) {
      return jsonResponse(
        {
          success: false,
          errorCode: "NOT_A_CV",
          error:
            "The uploaded file does not look like a CV or resume. Please upload your CV.",
          documentType: "blocked_filename",
          reason: blockedReason,
        },
        200
      );
    }

    let fileHash = "";

    try {
      fileHash = await calculateFileHash(fileBase64);

      const cacheLookupStartedAt = performance.now();
      const cachedRow = await getCachedCvProfile(fileHash);
      logDuration("CV cache lookup duration", cacheLookupStartedAt, {
        fileHashPrefix: fileHash.slice(0, 12),
        cacheHit: Boolean(cachedRow?.profile),
      });

      const cachedProfile = cachedRow?.profile
        ? normalizeProfile(cachedRow.profile)
        : null;

      if (cachedProfile) {
        return jsonResponse({
          success: true,
          profile: cachedProfile,
          meta: {
            model: "gpt-4.1-mini",
            profileVersion: "compact-v2-stable",
            extractedAt: new Date().toISOString(),
            cacheHit: true,
            fileHashPrefix: fileHash.slice(0, 12),
          },
        });
      }
    } catch (error) {
      console.warn("CV profile cache setup failed", error);
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      return jsonResponse(
        { success: false, error: "OPENAI_API_KEY missing in Supabase Secrets" },
        500
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    let openAiResponse: Response;
    const primaryOpenAiStartedAt = performance.now();

    try {
      openAiResponse = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4.1-mini",
          temperature: 0,
          max_output_tokens: 4500,
          text: {
            format: {
              type: "json_schema",
              name: "cv_validation_and_profile",
              strict: true,
              schema: cvAnalysisSchema,
            },
          },
          input: [
            {
              role: "system",
              content:
                "Return only valid JSON matching the combined documentValidation and profile schema. No markdown. No explanations. Validate the document first, then extract the profile only when it is clearly a real CV/resume/Lebenslauf. Be conservative: when in doubt set documentValidation.shouldAnalyze to false. Do not invent facts. Use empty arrays, empty strings, or null when the CV does not support a field. Keep strings concise and complete the single JSON object without truncation.",
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: buildAnalyzeCvPrompt(fileName),
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
    } finally {
      clearTimeout(timeout);
      logDuration("CV primary OpenAI call duration", primaryOpenAiStartedAt);
    }

    const parsedOpenAi = await parseOpenAiResponse(openAiResponse);

    if (!parsedOpenAi.isJson) {
      return jsonResponse(
        {
          success: false,
          error: "OpenAI returned non-JSON HTTP response",
          details: parsedOpenAi.rawText.slice(0, 1200),
        },
        200
      );
    }

    const openAiData = parsedOpenAi.data;

    if (!openAiResponse.ok) {
      return jsonResponse(
        {
          success: false,
          error: openAiData?.error?.message || "OpenAI request failed",
          details: openAiData?.error || openAiData,
        },
        200
      );
    }

    const jsonParseStartedAt = performance.now();
    let rawAnalysis = extractStructuredOutput(openAiData);
    const usedStructuredOutput = Boolean(rawAnalysis);
    const outputText = rawAnalysis ? "" : extractOutputText(openAiData);

    if (!rawAnalysis && !outputText) {
      return jsonResponse(
        {
          success: false,
          error: "OpenAI returned empty output",
          details: JSON.stringify(openAiData).slice(0, 1500),
        },
        200
      );
    }

    if (!rawAnalysis) {
      rawAnalysis = tryParseJson(outputText);
    }

    if (!rawAnalysis) {
      rawAnalysis = extractJsonFromText(outputText);
    }

    if (!rawAnalysis) {
      const recoveredValidation = extractDocumentValidationFromText(outputText);

      if (recoveredValidation?.shouldAnalyze === false) {
        rawAnalysis = {
          documentValidation: recoveredValidation,
          profile: null,
        };
      }
    }

    logDuration("CV JSON parse duration", jsonParseStartedAt, {
      parsed: Boolean(rawAnalysis),
      usedStructuredOutput,
    });

    if (!rawAnalysis) {
      if (hasPotentialAnalysisJson(outputText)) {
        console.error("Initial JSON parse failed. Trying repair.");
        console.error("Broken output metadata", {
          length: outputText.length,
          hasDocumentValidation: outputText
            .toLowerCase()
            .includes("documentvalidation"),
          hasProfile: outputText.toLowerCase().includes("profile"),
        });

        const repairStartedAt = performance.now();
        try {
          rawAnalysis = await repairJsonWithOpenAI(apiKey, outputText);
        } finally {
          logDuration("CV repair JSON duration", repairStartedAt, {
            repaired: Boolean(rawAnalysis),
          });
        }
      } else {
        console.error(
          "Initial JSON parse failed. Skipping repair because no CV analysis JSON signal was found."
        );
        console.info("CV repair JSON duration", {
          durationMs: 0,
          skipped: true,
        });
      }
    } else {
      console.info("CV repair JSON duration", {
        durationMs: 0,
        skipped: true,
      });
    }

    if (!rawAnalysis) {
      const recoveredValidation = extractDocumentValidationFromText(outputText);

      if (recoveredValidation) {
        rawAnalysis = {
          documentValidation: recoveredValidation,
          profile: null,
        };
      }
    }

    if (!rawAnalysis) {
      return jsonResponse(
        {
          success: false,
          error: "Could not parse or repair CV analysis JSON",
          details: outputText.slice(0, 1500),
        },
        200
      );
    }

    console.info("CV analysis parsed", {
      hasDocumentValidation: Boolean(rawAnalysis?.documentValidation),
      hasProfile: Boolean(rawAnalysis?.profile),
    });

    const documentValidation = rawAnalysis?.documentValidation;

    if (
      !documentValidation ||
      typeof documentValidation.shouldAnalyze !== "boolean"
    ) {
      return jsonResponse(
        {
          success: false,
          error: "Could not validate whether the uploaded file is a CV",
        },
        200
      );
    }

    const validationConfidence = safeNumber(documentValidation.confidence);
    const hasLowValidationConfidence =
      validationConfidence === null || validationConfidence < 0.75;
    const blockedValidationReason =
      getBlockedNonCvReasonFromValidation(documentValidation);

    if (
      !documentValidation.shouldAnalyze ||
      hasLowValidationConfidence ||
      blockedValidationReason
    ) {
      return jsonResponse(
        {
          success: false,
          errorCode: "NOT_A_CV",
          error:
            "The uploaded file does not look like a CV or resume. Please upload your CV.",
          documentType: "not_cv",
          reason:
            blockedValidationReason ||
            safeString(documentValidation.reason) ||
            (hasLowValidationConfidence
              ? "The document validation confidence is below the threshold for a clear CV."
              : "The document does not have clear CV or resume structure."),
        },
        200
      );
    }

    console.info("CV document validation passed", {
      fileHashPrefix: fileHash ? fileHash.slice(0, 12) : "",
    });

    const rawProfileForNormalization =
      rawAnalysis &&
      typeof rawAnalysis.profile === "object" &&
      rawAnalysis.profile !== null
        ? rawAnalysis.profile
        : {};

    if (rawProfileForNormalization !== rawAnalysis.profile) {
      console.warn(
        "CV profile missing after valid validation, using empty normalization fallback",
        {
          fileHashPrefix: fileHash ? fileHash.slice(0, 12) : "",
        }
      );
    }

    const profile = normalizeProfile(rawProfileForNormalization);

    console.info("CV profile normalized", {
      fileHashPrefix: fileHash ? fileHash.slice(0, 12) : "",
    });

    if (fileHash) {
      console.info("CV cache save before response", {
        fileHashPrefix: fileHash.slice(0, 12),
      });
      const cacheSaveStartedAt = performance.now();
      await saveCachedCvProfile(fileHash, profile, documentValidation);
      logDuration("CV cache save duration", cacheSaveStartedAt, {
        fileHashPrefix: fileHash.slice(0, 12),
      });
    } else {
      console.warn("CV cache save skipped: missing fileHash");
      console.info("CV cache save duration", {
        durationMs: 0,
        skipped: true,
      });
    }

    return jsonResponse({
      success: true,
      profile,
      meta: {
        model: openAiData?.model || "gpt-4.1-mini",
        profileVersion: "compact-v2-stable",
        extractedAt: new Date().toISOString(),
        cacheHit: false,
        fileHashPrefix: fileHash ? fileHash.slice(0, 12) : "",
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown analyze CV error",
      },
      200
    );
  } finally {
    logDuration("total analyze-cv duration", analyzeStartedAt);
  }
});
