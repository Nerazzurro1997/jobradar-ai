import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Job = {
  id?: number;
  title?: string;
  company?: string;
  location?: string;
  url?: string;
  snippet?: string;
  keyword?: string;
  score?: number;
};

type RequestBody = {
  fileName?: string;
  fileBase64?: string;
  job?: Job;
};

const OPENAI_MODEL = "gpt-4.1-mini";
const OPENAI_TIMEOUT_MS = 75_000;
const MAX_OUTPUT_TOKENS = 1600;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ success: false, error: "Use POST request" }, 405);
  }

  try {
    const body = await parseJsonBody(req);
    if (!body.ok) return jsonResponse(body.error, body.status);

    const { fileName, fileBase64, job } = body.data;

    const validation = validateInput(fileName, fileBase64, job);
    if (!validation.ok) {
      return jsonResponse(
        { success: false, error: validation.message },
        validation.status
      );
    }

    const OPENAI_KEY = Deno.env.get("OPENAI_API_KEY");

    if (!OPENAI_KEY) {
      return jsonResponse(
        {
          success: false,
          error: "OPENAI_API_KEY fehlt in Supabase Secrets",
        },
        500
      );
    }

    const normalizedJob = normalizeJob(job!);
    const prompt = buildPrompt(normalizedJob);

    const openAiResult = await callOpenAI({
      apiKey: OPENAI_KEY,
      fileName: fileName!,
      fileBase64: fileBase64!,
      prompt,
    });

    if (!openAiResult.ok) {
      return jsonResponse(
        {
          success: false,
          error: openAiResult.error,
          details: openAiResult.details,
        },
        openAiResult.status
      );
    }

    const answer = extractOutputText(openAiResult.data);

    if (!answer) {
      return jsonResponse(
        {
          success: false,
          error: "Keine Analyse erhalten.",
          details: "OpenAI returned no readable text output.",
        },
        500
      );
    }

    return jsonResponse({
      success: true,
      text: cleanAnswer(answer),
      meta: {
        model: openAiResult.data?.model || OPENAI_MODEL,
        jobTitle: normalizedJob.title,
        company: normalizedJob.company,
        score: normalizedJob.score,
      },
    });
  } catch (error) {
    return jsonResponse(
      {
        success: false,
        error: "Unexpected server error",
        details: String(error),
      },
      500
    );
  }
});

async function parseJsonBody(req: Request): Promise<
  | { ok: true; data: RequestBody }
  | { ok: false; status: number; error: { success: false; error: string } }
> {
  try {
    const data = await req.json();
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      status: 400,
      error: {
        success: false,
        error: "Invalid JSON body",
      },
    };
  }
}

function validateInput(fileName?: string, fileBase64?: string, job?: Job) {
  if (!fileName || !fileBase64 || !job) {
    return {
      ok: false,
      status: 400,
      message: "Missing fileName, fileBase64 or job",
    };
  }

  if (!fileName.toLowerCase().endsWith(".pdf")) {
    return {
      ok: false,
      status: 400,
      message: "Only PDF files are supported",
    };
  }

  if (fileBase64.length < 1000) {
    return {
      ok: false,
      status: 400,
      message: "PDF fileBase64 seems too small or invalid",
    };
  }

  if (!job.title && !job.snippet) {
    return {
      ok: false,
      status: 400,
      message: "Job must contain at least title or snippet",
    };
  }

  return { ok: true, status: 200, message: "ok" };
}

function normalizeJob(job: Job): Required<Job> {
  const score =
    typeof job.score === "number" && Number.isFinite(job.score)
      ? Math.max(0, Math.min(100, Math.round(job.score)))
      : 0;

  return {
    id: job.id || 0,
    title: cleanValue(job.title) || "Unbekannt",
    company: cleanValue(job.company) || "Unbekannt",
    location: cleanValue(job.location) || "Unbekannt",
    url: cleanValue(job.url) || "Nicht vorhanden",
    snippet: cleanValue(job.snippet) || "Keine Beschreibung vorhanden",
    keyword: cleanValue(job.keyword) || "Unbekannt",
    score,
  };
}

function cleanValue(value?: string) {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim().slice(0, 5000);
}

function buildPrompt(job: Required<Job>) {
  const scoreText = `${job.score}%`;

  return `
Du bist ein sehr ehrlicher, direkter und praxisnaher Karriereberater für den Schweizer Versicherungsmarkt.

Du analysierst einen CV als PDF und vergleichst ihn mit einer konkreten Stelle.

ZIEL:
Der Kandidat möchte realistische berufliche Chancen erkennen und keine Zeit mit unpassenden Bewerbungen verschwenden.

KANDIDATENPROFIL:
- Erfahrung in der Versicherungsbranche
- Stark im Kundenkontakt, Beratung, Verkauf, Administration und Versicherungsprozessen
- Bevorzugt Innendienst, Backoffice, Sachbearbeitung, Kundenberatung, Underwriting Assistant, Broker Support oder administrative Versicherungsfunktionen
- Reine Aussendienstrollen, tiefer Fixlohn, starker Provisionsdruck oder aggressiver Verkauf sind kritisch
- Der Kandidat will realistische Entwicklungschancen, Stabilität und ein faires Fixgehalt

STELLE:
Titel: ${job.title}
Firma: ${job.company}
Ort: ${job.location}
URL: ${job.url}
Kurzbeschreibung: ${job.snippet}
Gefunden mit Suchbegriff: ${job.keyword}
Bereits berechneter Match Score: ${scoreText}

HARTE REGELN:
- Verwende exakt diesen Match Score: ${scoreText}
- Berechne keinen neuen Score
- Erkläre nur, warum dieser Score plausibel oder eventuell etwas optimistisch/pessimistisch wirkt
- Sei ehrlich
- Nicht schönreden
- Keine generischen Floskeln
- Keine langen Einleitungen
- Keine erfundenen Fakten
- Wenn Informationen fehlen, klar sagen
- Antworte ausschliesslich auf Deutsch
- Schreibe direkt, professionell und hilfreich

BEWERTUNGSLOGIK:
Achte besonders auf:
- Versicherungserfahrung
- Innendienstnähe
- Administrativer Anteil
- Verkaufsdruck
- Fixlohn-Risiko
- Sprachliche Anforderungen
- Fachliche Einstiegshürde
- Realistische Chance auf Einladung
- Ob der Kandidat sich glaubwürdig positionieren kann

ANTWORTFORMAT:

Match Score: ${scoreText}

Kurzfazit:
[1 bis 2 sehr klare Sätze. Direkt sagen, ob die Stelle sinnvoll ist.]

Passung:
- [Konkreter Grund 1]
- [Konkreter Grund 2]
- [Konkreter Grund 3]

Kritische Punkte:
- [Konkretes Risiko 1]
- [Konkretes Risiko 2]
- [Falls wichtig: Aussendienst, Provision, fehlende Fachkenntnisse, Sprache, Seniorität]

Realistische Chance:
[Eine ehrliche Einschätzung in 1 bis 2 Sätzen: hoch, mittel oder tief und warum.]

Empfehlung:
[Bewerben / Prüfen / Nicht bewerben]

Begründung:
[2 bis 4 Sätze. Klar sagen, ob sich der Aufwand lohnt.]

Positionierung der Bewerbung:
- Verkauf dich als: [kurze Positionierung]
- Betone: [relevante Erfahrung]
- Schwäche elegant abfedern mit: [konkrete Formulierungsidee]

Bewerbungsstrategie:
- [Konkreter Schritt 1]
- [Konkreter Schritt 2]

Direkter Tipp:
[Ein ehrlicher, kurzer Tipp wie ein Karriereberater.]
`.trim();
}

async function callOpenAI(params: {
  apiKey: string;
  fileName: string;
  fileBase64: string;
  prompt: string;
}): Promise<
  | { ok: true; data: any }
  | { ok: false; status: number; error: string; details?: unknown }
> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${params.apiKey}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.15,
        max_output_tokens: MAX_OUTPUT_TOKENS,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: params.prompt,
              },
              {
                type: "input_file",
                filename: params.fileName,
                file_data: `data:application/pdf;base64,${params.fileBase64}`,
              },
            ],
          },
        ],
      }),
    });

    const rawText = await response.text();

    let data: any;
    try {
      data = JSON.parse(rawText);
    } catch {
      return {
        ok: false,
        status: 500,
        error: "OpenAI response was not valid JSON",
        details: rawText.slice(0, 500),
      };
    }

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: data?.error?.message || "OpenAI request failed",
        details: data?.error || data,
      };
    }

    return { ok: true, data };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return {
        ok: false,
        status: 504,
        error: "OpenAI request timed out",
        details: `Timeout after ${OPENAI_TIMEOUT_MS / 1000} seconds`,
      };
    }

    return {
      ok: false,
      status: 500,
      error: "OpenAI request failed",
      details: String(error),
    };
  } finally {
    clearTimeout(timeout);
  }
}

function extractOutputText(data: any): string {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const output = data?.output;

  if (!Array.isArray(output)) return "";

  const parts: string[] = [];

  for (const item of output) {
    if (!Array.isArray(item?.content)) continue;

    for (const content of item.content) {
      if (typeof content?.text === "string" && content.text.trim()) {
        parts.push(content.text.trim());
      }
    }
  }

  return parts.join("\n").trim();
}

function cleanAnswer(text: string) {
  return text
    .replace(/\*\*/g, "")
    .replace(/###/g, "")
    .replace(/---/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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