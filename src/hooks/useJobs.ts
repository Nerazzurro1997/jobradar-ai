import { useState } from "react";
import type { CvProfile, Job, SearchStats } from "../types";
import { toBase64 } from "../utils/file";
import { saveJobs } from "../utils/storage";
import { analyzeCvAPI, searchJobsAPI, analyzeJobAPI } from "../services/api";
import {
  sortJobsByScore,
  getUniqueJobsByUrl,
  normalizeJobs,
} from "../utils/jobs";

function safeString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function safeArray(value: unknown, limit = 30) {
  return Array.isArray(value)
    ? value
        .filter((item) => typeof item === "string" && item.trim())
        .map((item) => item.trim())
        .slice(0, limit)
    : [];
}

function uniqueArray(items: string[], limit = 50) {
  return [...new Set(items.filter(Boolean).map((item) => item.trim()))].slice(
    0,
    limit
  );
}

function valueToText(value: unknown) {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractJsonObject(text = "") {
  const cleaned = text
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) {
    return cleaned;
  }

  return cleaned.slice(first, last + 1);
}

function tryParseJson(text: string) {
  const extracted = extractJsonObject(text);

  try {
    return JSON.parse(extracted);
  } catch {
    // Continue
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

function extractArrayFromText(text: string, key: string, limit = 30) {
  const regex = new RegExp(`"${key}"\\s*:\\s*\\[([\\s\\S]*?)\\]`, "i");
  const match = text.match(regex);

  if (!match) return [];

  const rawArray = `[${match[1]}]`;

  try {
    return safeArray(JSON.parse(rawArray), limit);
  } catch {
    const items: string[] = [];
    const itemRegex = /"((?:\\.|[^"\\])*)"/g;
    let itemMatch: RegExpExecArray | null;

    while ((itemMatch = itemRegex.exec(match[1])) !== null) {
      const value = itemMatch[1].replace(/\\"/g, '"').trim();
      if (value) items.push(value);
    }

    return uniqueArray(items, limit);
  }
}

function extractStringFromText(text: string, key: string, maxLength = 700) {
  const keyIndex = text.indexOf(`"${key}"`);

  if (keyIndex === -1) return "";

  const colonIndex = text.indexOf(":", keyIndex);
  if (colonIndex === -1) return "";

  const firstQuote = text.indexOf('"', colonIndex + 1);
  if (firstQuote === -1) return "";

  let value = "";
  let escaped = false;

  for (let i = firstQuote + 1; i < text.length; i++) {
    const char = text[i];

    if (escaped) {
      value += char;
      escaped = false;
      continue;
    }

    if (char === "\\") {
      value += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      break;
    }

    value += char;

    if (value.length >= maxLength) {
      break;
    }
  }

  try {
    return JSON.parse(`"${value}"`).trim();
  } catch {
    return value.replace(/\\"/g, '"').trim();
  }
}

function buildRecoveredProfileFromText(text: string): CvProfile | null {
  const parsed = tryParseJson(text);

  const searchTerms =
    safeArray(parsed?.searchTerms, 25).length > 0
      ? safeArray(parsed?.searchTerms, 25)
      : extractArrayFromText(text, "searchTerms", 25);

  const strongKeywords =
    safeArray(parsed?.strongKeywords, 60).length > 0
      ? safeArray(parsed?.strongKeywords, 60)
      : extractArrayFromText(text, "strongKeywords", 60);

  const avoidKeywords =
    safeArray(parsed?.avoidKeywords, 45).length > 0
      ? safeArray(parsed?.avoidKeywords, 45)
      : extractArrayFromText(text, "avoidKeywords", 45);

  const locations =
    safeArray(parsed?.locations, 15).length > 0
      ? safeArray(parsed?.locations, 15)
      : extractArrayFromText(text, "locations", 15).length > 0
      ? extractArrayFromText(text, "locations", 15)
      : ["Zürich"];

  const profileSummary =
    safeString(parsed?.profileSummary) ||
    extractStringFromText(text, "profileSummary", 700) ||
    "CV profile recovered from partial AI response.";

  const cvHighlights =
    safeArray(parsed?.cvHighlights, 12).length > 0
      ? safeArray(parsed?.cvHighlights, 12)
      : extractArrayFromText(text, "cvHighlights", 12);

  const languages =
    safeArray(parsed?.languageProfile?.languages, 20).length > 0
      ? safeArray(parsed?.languageProfile?.languages, 20)
      : extractArrayFromText(text, "languages", 20);

  const strongestLanguages =
    safeArray(parsed?.languageProfile?.strongestLanguages, 10).length > 0
      ? safeArray(parsed?.languageProfile?.strongestLanguages, 10)
      : extractArrayFromText(text, "strongestLanguages", 10);

  const businessLanguages =
    safeArray(parsed?.languageProfile?.businessLanguages, 10).length > 0
      ? safeArray(parsed?.languageProfile?.businessLanguages, 10)
      : extractArrayFromText(text, "businessLanguages", 10);

  const languageKeywords =
    safeArray(parsed?.languageProfile?.languageKeywords, 20).length > 0
      ? safeArray(parsed?.languageProfile?.languageKeywords, 20)
      : extractArrayFromText(text, "languageKeywords", 20);

  const languageSummary =
    safeString(parsed?.languageProfile?.languageSummary) ||
    extractStringFromText(text, "languageSummary", 500);

  const skillTags =
    safeArray(parsed?.skillTags, 40).length > 0
      ? safeArray(parsed?.skillTags, 40)
      : uniqueArray(
          [
            ...extractArrayFromText(text, "skillTags", 40),
            ...strongKeywords,
            ...languages,
          ],
          30
        );

  const bestFitRoles =
    safeArray(parsed?.matching?.bestFitRoles, 25).length > 0
      ? safeArray(parsed?.matching?.bestFitRoles, 25)
      : extractArrayFromText(text, "bestFitRoles", 25);

  const acceptableRoles =
    safeArray(parsed?.matching?.acceptableRoles, 25).length > 0
      ? safeArray(parsed?.matching?.acceptableRoles, 25)
      : extractArrayFromText(text, "acceptableRoles", 25);

  const weakFitRoles =
    safeArray(parsed?.matching?.weakFitRoles, 25).length > 0
      ? safeArray(parsed?.matching?.weakFitRoles, 25)
      : extractArrayFromText(text, "weakFitRoles", 25);

  const dealBreakers =
    safeArray(parsed?.matching?.dealBreakers, 25).length > 0
      ? safeArray(parsed?.matching?.dealBreakers, 25)
      : extractArrayFromText(text, "dealBreakers", 25);

  const sellingPoints =
    safeArray(parsed?.matching?.sellingPoints, 35).length > 0
      ? safeArray(parsed?.matching?.sellingPoints, 35)
      : extractArrayFromText(text, "sellingPoints", 35);

  const riskAreas =
    safeArray(parsed?.matching?.riskAreas, 25).length > 0
      ? safeArray(parsed?.matching?.riskAreas, 25)
      : extractArrayFromText(text, "riskAreas", 25);

  const hasEnoughData =
    searchTerms.length > 0 ||
    strongKeywords.length > 0 ||
    profileSummary.length > 0 ||
    skillTags.length > 0;

  if (!hasEnoughData) {
    return null;
  }

  const languageProfile = {
    languages,
    strongestLanguages,
    businessLanguages,
    languageKeywords,
    languageSummary,
  };

  const deepProfile = {
    identity: {
      currentRole: extractStringFromText(text, "currentRole", 120),
      targetRole:
        extractStringFromText(text, "targetRole", 120) ||
        bestFitRoles[0] ||
        searchTerms[0] ||
        "",
      seniorityLevel: extractStringFromText(text, "seniorityLevel", 80),
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
      languages,
      certifications: [],
    },

    matching: {
      bestFitRoles,
      acceptableRoles,
      weakFitRoles,
      dealBreakers,
      scoringHints: sellingPoints,
      sellingPoints,
      applicationPositioning: [],
    },

    gaps: {
      missingSkills: [],
      riskAreas,
      howToCompensate: [],
    },

    summary: {
      shortSummary:
        safeString(parsed?.summary?.shortSummary) ||
        extractStringFromText(text, "shortSummary", 300),
      detailedSummary:
        safeString(parsed?.summary?.detailedSummary) ||
        extractStringFromText(text, "detailedSummary", 700),
      recruiterPitch:
        safeString(parsed?.summary?.recruiterPitch) ||
        extractStringFromText(text, "recruiterPitch", 500),
    },
  };

  return {
    searchTerms,
    strongKeywords: uniqueArray(
      [...strongKeywords, ...skillTags, ...languages, ...languageKeywords],
      90
    ),
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
  } as unknown as CvProfile;
}

function recoverProfileFromApiFailure(data: any): CvProfile | null {
  const detailsText = valueToText(data?.details);
  const errorText = valueToText(data?.error);
  const combined = `${detailsText}\n${errorText}`;

  return buildRecoveredProfileFromText(combined);
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [analysis, setAnalysis] = useState<Record<number, string>>({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [stats, setStats] = useState<SearchStats>({});

  async function analyzeCv(file: File): Promise<CvProfile> {
    setProfileLoading(true);

    try {
      const base64 = await toBase64(file);
      const data = await analyzeCvAPI(base64, file.name);

      console.log("ANALYZE CV RESPONSE:", data);

      if (!data.success || !data.profile) {
        const recoveredProfile = recoverProfileFromApiFailure(data);

        if (recoveredProfile) {
          console.warn(
            "CV profile recovered from partial AI response:",
            recoveredProfile
          );

          return recoveredProfile;
        }

        const message =
          data.details ||
          data.error ||
          "CV analysis failed without details";

        console.error("CV ANALYSIS FAILED:", data);

        alert("CV analysis failed:\n\n" + String(message).slice(0, 1200));

        throw new Error(String(message));
      }

      return data.profile;
    } finally {
      setProfileLoading(false);
    }
  }

  async function searchJobs(
    file: File,
    profile: CvProfile | null,
    savedJobs: Job[]
  ) {
    setSearchLoading(true);
    setJobs([]);
    setAnalysis({});
    setStats({});

    try {
      const base64 = await toBase64(file);

      let profileToUse = profile;
      if (!profileToUse) {
        profileToUse = await analyzeCv(file);
      }

      const knownUrls = savedJobs
        .map((job) => job.url)
        .filter((url): url is string => Boolean(url));

      const data = await searchJobsAPI(
        base64,
        file.name,
        profileToUse,
        knownUrls
      );

      console.log("SEARCH JOBS RESPONSE:", data);

      if (data.error) {
        const message = data.details || data.error;
        alert("Job search failed:\n\n" + String(message).slice(0, 1200));
        throw new Error(String(message));
      }

      const incomingJobs: Job[] = data.jobs || [];
      const normalizedJobs = normalizeJobs(incomingJobs);
      const uniqueJobs = getUniqueJobsByUrl(normalizedJobs);
      const sortedJobs = sortJobsByScore(uniqueJobs);

      setJobs(sortedJobs);
      saveJobs(sortedJobs);

      setStats({
        foundLinks: data.foundLinks,
        scanned: data.scanned,
        shown: data.count,
      });

      return incomingJobs;
    } catch (error) {
      console.error("SEARCH JOBS ERROR:", error);
      return [];
    } finally {
      setSearchLoading(false);
    }
  }

  async function analyzeJob(job: Job, file: File, profile: CvProfile | null) {
    setAnalysis((prev) => ({
      ...prev,
      [job.id]: "⏳ Analisi in corso...",
    }));

    try {
      const base64 = await toBase64(file);
      const data = await analyzeJobAPI(base64, file.name, profile, job);

      console.log("ANALYZE JOB RESPONSE:", data);

      const raw =
        data?.text ||
        data?.output?.[0]?.content?.[0]?.text ||
        data?.error ||
        "Nessuna risposta";

      setAnalysis((prev) => ({
        ...prev,
        [job.id]: raw,
      }));
    } catch (error) {
      console.error("ANALYZE JOB ERROR:", error);

      setAnalysis((prev) => ({
        ...prev,
        [job.id]: "Errore: " + String(error),
      }));
    }
  }

  return {
    jobs,
    analysis,
    stats,
    searchLoading,
    profileLoading,
    searchJobs,
    analyzeJob,
    analyzeCv,
  };
}