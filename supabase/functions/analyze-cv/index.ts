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
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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

const compactProfileSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    searchTerms: {
      type: "array",
      items: { type: "string" },
    },
    strongKeywords: {
      type: "array",
      items: { type: "string" },
    },
    avoidKeywords: {
      type: "array",
      items: { type: "string" },
    },
    locations: {
      type: "array",
      items: { type: "string" },
    },
    profileSummary: {
      type: "string",
    },
    cvHighlights: {
      type: "array",
      items: { type: "string" },
    },
    skillTags: {
      type: "array",
      items: { type: "string" },
    },
    languageProfile: {
      type: "object",
      additionalProperties: false,
      properties: {
        languages: {
          type: "array",
          items: { type: "string" },
        },
        strongestLanguages: {
          type: "array",
          items: { type: "string" },
        },
        businessLanguages: {
          type: "array",
          items: { type: "string" },
        },
        languageKeywords: {
          type: "array",
          items: { type: "string" },
        },
        languageSummary: {
          type: "string",
        },
      },
      required: [
        "languages",
        "strongestLanguages",
        "businessLanguages",
        "languageKeywords",
        "languageSummary",
      ],
    },
    matching: {
      type: "object",
      additionalProperties: false,
      properties: {
        bestFitRoles: {
          type: "array",
          items: { type: "string" },
        },
        acceptableRoles: {
          type: "array",
          items: { type: "string" },
        },
        weakFitRoles: {
          type: "array",
          items: { type: "string" },
        },
        dealBreakers: {
          type: "array",
          items: { type: "string" },
        },
        sellingPoints: {
          type: "array",
          items: { type: "string" },
        },
        riskAreas: {
          type: "array",
          items: { type: "string" },
        },
      },
      required: [
        "bestFitRoles",
        "acceptableRoles",
        "weakFitRoles",
        "dealBreakers",
        "sellingPoints",
        "riskAreas",
      ],
    },
    summary: {
      type: "object",
      additionalProperties: false,
      properties: {
        shortSummary: {
          type: "string",
        },
        detailedSummary: {
          type: "string",
        },
        recruiterPitch: {
          type: "string",
        },
      },
      required: ["shortSummary", "detailedSummary", "recruiterPitch"],
    },
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
      max_output_tokens: 3000,
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

If information is missing, use empty arrays or empty strings.

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

function normalizeProfile(raw: any) {
  const languageProfile = {
    languages: safeArray(raw?.languageProfile?.languages, 20),
    strongestLanguages: safeArray(raw?.languageProfile?.strongestLanguages, 10),
    businessLanguages: safeArray(raw?.languageProfile?.businessLanguages, 10),
    languageKeywords: safeArray(raw?.languageProfile?.languageKeywords, 20),
    languageSummary: safeString(raw?.languageProfile?.languageSummary),
  };

  const allLanguages = uniqueArray(languageProfile.languages, 25);

  const searchTerms = safeArray(raw?.searchTerms, 25);

  const skillTags = uniqueArray(safeArray(raw?.skillTags, 40), 30);

  const strongKeywords = uniqueArray(
    [
      ...safeArray(raw?.strongKeywords, 60),
      ...skillTags,
      ...allLanguages,
      ...languageProfile.languageKeywords,
      ...languageProfile.strongestLanguages,
      ...languageProfile.businessLanguages,
    ],
    90
  );

  const avoidKeywords = safeArray(raw?.avoidKeywords, 45);

  const locations =
    safeArray(raw?.locations, 15).length > 0
      ? safeArray(raw?.locations, 15)
      : ["Zürich"];

  const profileSummary =
    safeString(raw?.profileSummary) ||
    safeString(raw?.summary?.shortSummary) ||
    "CV profile analyzed successfully.";

  const cvHighlights = uniqueArray(safeArray(raw?.cvHighlights, 12), 12);

  const bestFitRoles = safeArray(raw?.matching?.bestFitRoles, 25);
  const acceptableRoles = safeArray(raw?.matching?.acceptableRoles, 25);
  const weakFitRoles = safeArray(raw?.matching?.weakFitRoles, 25);
  const dealBreakers = safeArray(raw?.matching?.dealBreakers, 25);
  const sellingPoints = safeArray(raw?.matching?.sellingPoints, 35);
  const riskAreas = safeArray(raw?.matching?.riskAreas, 25);

  const deepProfile = {
    identity: {
      currentRole: "",
      targetRole: bestFitRoles[0] || "",
      seniorityLevel: "",
      yearsOfExperience: null,
      industryFocus: ["Insurance", "Administration", "Customer Service"],
    },

    languageProfile,

    search: {
      searchTerms,
      strongKeywords,
      avoidKeywords,
      preferredLocations: locations,
      preferredRoles: bestFitRoles,
      avoidRoles: weakFitRoles,
    },

    experience: {
      roles: [],
      insuranceExperience: [],
      adminExperience: [],
      salesExperience: [],
      customerExperience: [],
      underwritingRelatedExperience: [],
      claimsRelatedExperience: [],
    },

    skills: {
      hardSkills: skillTags,
      softSkills: [],
      tools: [],
      languages: allLanguages,
      certifications: [],
    },

    matching: {
      bestFitRoles,
      acceptableRoles,
      weakFitRoles,
      dealBreakers,
      scoringHints: sellingPoints,
      sellingPoints,
      applicationPositioning: safeArray(raw?.summary?.recruiterPitch, 5),
    },

    gaps: {
      missingSkills: [],
      riskAreas,
      howToCompensate: [],
    },

    summary: {
      shortSummary: safeString(raw?.summary?.shortSummary),
      detailedSummary: safeString(raw?.summary?.detailedSummary),
      recruiterPitch: safeString(raw?.summary?.recruiterPitch),
    },
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

    identity: deepProfile.identity,
    search: deepProfile.search,
    experience: deepProfile.experience,
    skills: deepProfile.skills,
    matching: deepProfile.matching,
    gaps: deepProfile.gaps,
    summary: deepProfile.summary,
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
          max_output_tokens: 2500,
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
                "Return only valid compact JSON matching the schema. No markdown. No explanations. Keep every string short.",
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: `
Analyze the uploaded CV for Swiss job matching.

Focus:
- Insurance roles
- Administration
- Backoffice
- Customer service
- Underwriting assistant
- Claims assistant
- Office roles

Rules:
- Do not invent facts.
- Keep arrays concise.
- Extract languages carefully.
- Search terms must be useful for jobs.ch.
- profileSummary must be short and useful for a UI card.
- cvHighlights must contain 4 to 8 short points.
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
        profileVersion: "compact-v1-stable",
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