const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

const cvValidationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    shouldAnalyze: { type: "boolean" },
    isCv: { type: "boolean" },
    hasClearCvStructure: { type: "boolean" },
    confidence: { type: "number" },
    documentType: { type: "string" },
    cvSignals: stringArraySchema,
    nonCvSignals: stringArraySchema,
    reason: { type: "string" },
  },
  required: [
    "shouldAnalyze",
    "isCv",
    "hasClearCvStructure",
    "confidence",
    "documentType",
    "cvSignals",
    "nonCvSignals",
    "reason",
  ],
};

async function repairJsonWithOpenAI(apiKey: string, brokenText: string) {
  const repairResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
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
          name: "cv_profile_compact_repair",
          strict: true,
          schema: compactProfileSchema,
        },
      },
      input: [
        {
          role: "system",
          content:
            "You repair broken JSON. Return only valid JSON matching the schema. No markdown. No explanations.",
        },
        {
          role: "user",
          content: `
Repair this broken JSON into the requested schema.

If information is missing, use empty arrays, empty strings, or null.

Broken JSON:
${brokenText.slice(0, 10000)}
`.trim(),
        },
      ],
    }),
  });

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

function hasBlockedDocumentTypeSignal(
  fileName: string,
  validation: {
    documentType: string;
    reason: string;
    nonCvSignals: string[];
  }
) {
  const text = [
    fileName,
    validation.documentType,
    validation.reason,
    ...validation.nonCvSignals,
  ]
    .join(" ")
    .toLowerCase();

  return [
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
  ].some((term) => text.includes(term));
}

async function validateCvDocument(
  apiKey: string,
  fileName: string,
  fileBase64: string
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);

  let validationResponse: Response;

  try {
    validationResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        temperature: 0,
        max_output_tokens: 700,
        text: {
          format: {
            type: "json_schema",
            name: "cv_document_validation",
            strict: true,
            schema: cvValidationSchema,
          },
        },
        input: [
          {
            role: "system",
            content:
              "Classify whether the uploaded PDF is a CV/resume/Lebenslauf. Be conservative: employment confirmations and work certificates are not CVs. Return only valid JSON matching the schema.",
          },
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `
Validate this uploaded PDF before CV analysis.

Use the filename, the first visible parts of the PDF content, and the document structure.
Accept CV/resume documents in German, English, Italian, and French.

Strong CV signals include:
- German: Lebenslauf, CV, Bewerbung, Berufserfahrung, Ausbildung, Fähigkeiten, Kenntnisse, Sprachen
- English: CV, resume, work experience, education, skills, employment history, languages
- Italian: curriculum, CV, esperienze lavorative, formazione, competenze, lingue
- French: CV, curriculum vitae, expérience professionnelle, formation, compétences, langues
- Structured candidate profile with personal/contact info plus work experience and education/skills.

Block documents that look like:
- invoices, Rechnungen, fatture
- contracts, Verträge, contratti
- insurance offers, Versicherungsofferten, offerte assicurative
- Arbeitsbestätigung, Arbeitszeugnis single document, Arbeitgeberbescheinigung
- employment confirmation, employment certificate, work certificate
- attestation de travail, certificat de travail
- attestato di lavoro, certificato di lavoro, conferma di lavoro
- letters, Briefe, lettere
- job ads, Stelleninserate, annunci di lavoro
- standalone certificates without a CV structure
- reports, rapporti, generic business documents

Decision rules:
- A document is not a CV merely because it contains a person's name, employer, employment dates, a job title, or experience at one company.
- A CV must have clear CV structure, usually multiple sections such as Berufserfahrung/work experience/esperienze lavorative/expérience professionnelle, Ausbildung/education/formazione, Fähigkeiten/skills/competenze/compétences, Sprachen/languages/lingue/langues, Profil/profile/profilo, or multiple roles/stations.
- Set hasClearCvStructure true only when the document has clear CV/resume structure.
- shouldAnalyze must be true only when the document is probably a CV/resume and has clear CV structure.
- If uncertain but there are strong CV structure signals, set shouldAnalyze true.
- If uncertain and it looks like an invoice, contract, offer, letter, job ad, certificate-only, report, or generic document, set shouldAnalyze false.
- If confidence is below 0.75 and there is no clear CV structure, set shouldAnalyze false.
- Do not rely only on the filename.
- confidence must be between 0 and 1.

Filename: ${fileName}
`.trim(),
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
  }

  const parsedValidation = await parseOpenAiResponse(validationResponse);

  if (!parsedValidation.isJson) {
    return {
      ok: false,
      error: "OpenAI returned non-JSON CV validation response",
      details: parsedValidation.rawText.slice(0, 1200),
    };
  }

  const validationData = parsedValidation.data;

  if (!validationResponse.ok) {
    return {
      ok: false,
      error: validationData?.error?.message || "OpenAI CV validation failed",
      details: validationData?.error || validationData,
    };
  }

  const validationText = extractOutputText(validationData);
  const validation = validationText ? tryParseJson(validationText) : null;

  if (!validation || typeof validation !== "object") {
    return {
      ok: false,
      error: "Could not parse CV validation response",
      details: validationText || JSON.stringify(validationData).slice(0, 1500),
    };
  }

  return {
    ok: true,
    validation: {
      shouldAnalyze: Boolean(validation.shouldAnalyze),
      isCv: Boolean(validation.isCv),
      hasClearCvStructure: Boolean(validation.hasClearCvStructure),
      confidence: safeNumber(validation.confidence) ?? 0,
      documentType: safeString(validation.documentType),
      cvSignals: safeArray(validation.cvSignals, 12),
      nonCvSignals: safeArray(validation.nonCvSignals, 12),
      reason: safeString(validation.reason),
    },
  };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Use POST request" }, 405);
  }

  try {
    const { fileName, fileBase64 } = await req.json();

    if (!fileName || !fileBase64) {
      return jsonResponse(
        { success: false, error: "Missing fileName or fileBase64" },
        400
      );
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      return jsonResponse(
        { success: false, error: "OPENAI_API_KEY missing in Supabase Secrets" },
        500
      );
    }

    const cvValidationResult = await validateCvDocument(
      apiKey,
      fileName,
      fileBase64
    );

    if (!cvValidationResult.ok) {
      return jsonResponse(
        {
          success: false,
          error: cvValidationResult.error,
          details: cvValidationResult.details,
        },
        200
      );
    }

    const cvValidation = cvValidationResult.validation;

    if (!cvValidation) {
      return jsonResponse(
        {
          success: false,
          error: "Could not validate whether the uploaded file is a CV",
        },
        200
      );
    }

    const hasLowConfidenceWithoutClearCvStructure =
      cvValidation.confidence < 0.75 && !cvValidation.hasClearCvStructure;
    const hasBlockedDocumentType =
      hasBlockedDocumentTypeSignal(fileName, cvValidation) &&
      !cvValidation.hasClearCvStructure;

    if (
      !cvValidation.shouldAnalyze ||
      hasLowConfidenceWithoutClearCvStructure ||
      hasBlockedDocumentType
    ) {
      return jsonResponse(
        {
          success: false,
          errorCode: "NOT_A_CV",
          error:
            "The uploaded file does not look like a CV or resume. Please upload your CV.",
          documentType: cvValidation.documentType || "not_cv",
          reason:
            cvValidation.reason ||
            "The document does not have clear CV or resume structure.",
        },
        200
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 120_000);

    let openAiResponse: Response;

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
              name: "cv_profile_compact",
              strict: true,
              schema: compactProfileSchema,
            },
          },
          input: [
            {
              role: "system",
              content:
                "Return only valid compact JSON matching the schema. No markdown. No explanations. Do not invent facts. Use empty arrays, empty strings, or null when the CV does not support a field.",
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `
Analyze the uploaded CV for Swiss job matching.

Primary matching domains:
- Insurance, health insurance, broker support, policy administration
- Administration, backoffice, office coordination
- Customer service, client service, sales support, internal sales
- Underwriting assistant, claims assistant, claims support

Critical extraction rules:
- Do not invent facts or preferences.
- If a field is not clearly present or inferable from the CV, use "", [], or null.
- Keep arrays concise, ordered by matching importance, and free of duplicates.
- Use Swiss/German job-market wording where useful for jobs.ch.

searchTerms:
- Must be real jobs.ch search queries, not generic skills.
- Prefer 6 to 14 short role queries such as "Versicherung Innendienst", "Sachbearbeiter Versicherung", "Kundenberater Innendienst", "Backoffice Versicherung", "Underwriting Assistant", "Schaden Sachbearbeiter".
- Include only queries that fit the CV evidence.
- Do not include skills-only terms like "CRM", "MS Office", "Deutsch", or "Teamwork".

strongKeywords:
- Include match-relevant domain terms, hard skills, tools, certifications, languages, insurance/admin/customer-service keywords, and CV-specific strengths.
- Avoid generic soft skills unless unusually important in the CV.

avoidKeywords:
- Include only real negative matching signals supported by the CV goals or constraints.
- Use for roles/conditions to avoid, e.g. "Aussendienst", "Provision", "Kaltakquise", "Praktikum", "Lehrstelle", "Senior Leadership", only when appropriate.

identity:
- currentRole, targetRole, seniorityLevel, yearsOfExperience, industryFocus.
- seniorityLevel examples: Entry, Junior, Professional, Senior, Lead, Management.
- yearsOfExperience must be a number only if reasonably inferable, otherwise null.

experience:
- Separate insuranceExperience, adminExperience, salesExperience, customerExperience, underwritingRelatedExperience, and claimsRelatedExperience.
- Each item should be a short evidence-based phrase from the CV.

skills:
- hardSkills: concrete role skills.
- softSkills: interpersonal or work-style skills only if evidenced.
- tools: software/tools/systems.
- languages: language names only.
- certifications: degrees/certificates/training if present.

languageProfile:
- languages: all languages found.
- strongestLanguages: languages clearly strongest/native/fluent.
- businessLanguages: languages usable professionally.
- languageKeywords: useful matching terms such as "Deutsch", "Italienisch", "Franzoesisch", "Englisch", "bilingual", "fluent".
- languageSummary: short business relevance summary.

matching:
- bestFitRoles: strongest realistic target roles.
- acceptableRoles: plausible adjacent roles.
- weakFitRoles: roles with partial fit or notable gaps.
- dealBreakers: conditions likely unsuitable.
- sellingPoints: evidence-based strengths for applications.
- riskAreas: gaps or points recruiters may question.
- scoringHints: concise signals useful for ranking.
- applicationPositioning: how to position the candidate.

preferences:
- Fill workload, employmentType, workMode, salaryExpectation, fixumPreference, commutePreference only if explicitly present in the CV.
- Do not infer salary or fixed-salary preference from role history.

Summaries:
- profileSummary max 220 characters.
- cvHighlights 4 to 8 short points.
- detailedSummary max 500 characters.
`.trim(),
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

    const outputText = extractOutputText(openAiData);

    if (!outputText) {
      return jsonResponse(
        {
          success: false,
          error: "OpenAI returned empty output",
          details: JSON.stringify(openAiData).slice(0, 1500),
        },
        200
      );
    }

    let rawProfile = tryParseJson(outputText);

    if (!rawProfile) {
      console.error("Initial JSON parse failed. Trying repair.");
      console.error("Broken output:", outputText.slice(0, 2000));

      rawProfile = await repairJsonWithOpenAI(apiKey, outputText);
    }

    if (!rawProfile) {
      return jsonResponse(
        {
          success: false,
          error: "Could not parse or repair CV profile JSON",
          details: outputText.slice(0, 1500),
        },
        200
      );
    }

    const profile = normalizeProfile(rawProfile);

    return jsonResponse({
      success: true,
      profile,
      meta: {
        model: openAiData?.model || "gpt-4.1-mini",
        profileVersion: "compact-v2-stable",
        extractedAt: new Date().toISOString(),
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
  }
});
