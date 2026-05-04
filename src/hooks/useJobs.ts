import { useCallback, useRef, useState } from "react";
import type { CvProfile, Job, SearchStats } from "../types";
import { toBase64 } from "../utils/file";
import { getSavedJobs, saveJobs } from "../utils/storage";
import { analyzeCvAPI, searchJobsAPI, analyzeJobAPI } from "../services/api";
import {
  getUniqueJobsByUrl,
  isJobAboveMinimumScore,
  normalizeJobs,
  prepareSavedJobsForStorage,
  sortJobsByScore,
} from "../utils/jobs";

export type CvAnalysisFeedback = {
  durationMs: number;
  cacheHit: boolean;
  completedAt: number;
};

function safeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function safeArray(value: unknown, limit = 30): string[] {
  return Array.isArray(value)
    ? value
        .filter(
          (item): item is string =>
            typeof item === "string" && Boolean(item.trim())
        )
        .map((item) => item.trim())
        .slice(0, limit)
    : [];
}

function uniqueArray(items: string[], limit = 50): string[] {
  return [...new Set(items.filter(Boolean).map((item) => item.trim()))].slice(
    0,
    limit
  );
}

function valueToText(value: unknown): string {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function extractJsonObject(text = ""): string {
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

function tryParseJson(text: string): any | null {
  const extracted = extractJsonObject(text);

  try {
    return JSON.parse(extracted);
  } catch {
    // Continue with a light repair attempt.
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

function extractArrayFromText(text: string, key: string, limit = 30): string[] {
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

function extractStringFromText(
  text: string,
  key: string,
  maxLength = 700
): string {
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

function getErrorMessage(error: unknown, fallback = "Unknown error"): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string" && error.trim()) {
    return error.trim();
  }

  try {
    return JSON.stringify(error);
  } catch {
    return fallback;
  }
}

function getAnalyzeCvFailureMessage(data: any) {
  const detailsText = valueToText(data?.details);

  if (
    detailsText.includes('"shouldAnalyze"') ||
    detailsText.includes('"hasClearCvStructure"')
  ) {
    return data?.error || "CV analysis failed during document validation.";
  }

  return data?.details || data?.error || "CV analysis failed without details";
}

function hasUsableProfileSignals(profile: CvProfile) {
  const skillsValue = profile.skills;
  const skillSignals = [
    ...safeArray(profile.searchTerms, 25),
    ...safeArray(profile.strongKeywords, 60),
    ...safeArray(profile.skillTags, 40),
    ...safeArray(profile.cvHighlights, 12),
    ...safeArray(profile.languageProfile?.languages, 20),
    ...safeArray(profile.matching?.bestFitRoles, 25),
    ...safeArray(profile.matching?.acceptableRoles, 25),
    ...safeArray(profile.search?.preferredRoles, 25),
    ...(Array.isArray(skillsValue) ? safeArray(skillsValue, 40) : []),
    ...(!Array.isArray(skillsValue)
      ? safeArray(skillsValue?.hardSkills, 40)
      : []),
    ...(!Array.isArray(skillsValue)
      ? safeArray(skillsValue?.tools, 30)
      : []),
  ];

  return (
    uniqueArray(skillSignals, 12).length >= 3 &&
    !safeString(profile.profileSummary)
      .toLowerCase()
      .includes("cv profile recovered from partial ai response")
  );
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

  const recoveredProfileSummary =
    safeString(parsed?.profileSummary) ||
    extractStringFromText(text, "profileSummary", 700);

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
    skillTags.length > 0 ||
    bestFitRoles.length > 0 ||
    acceptableRoles.length > 0 ||
    cvHighlights.length > 0 ||
    languages.length > 0;

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
    profileSummary: recoveredProfileSummary,
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

function buildSavedJobsPipeline({
  apiJobs,
  previousSavedJobs,
}: {
  apiJobs: Job[];
  previousSavedJobs: Job[];
}) {
  const rawValidApiJobs = apiJobs.filter((job) =>
    isJobAboveMinimumScore(job, 70)
  );
  const normalizedValidApiJobs = normalizeJobs(rawValidApiJobs).filter((job) =>
    isJobAboveMinimumScore(job, 70)
  );

  const cleanedPreviousSavedJobs = prepareSavedJobsForStorage(previousSavedJobs);
  const mergedBeforeDedup = [
    ...cleanedPreviousSavedJobs,
    ...normalizedValidApiJobs,
  ];
  const mergedAfterDedup = getUniqueJobsByUrl(mergedBeforeDedup);
  const finalSavedJobs = prepareSavedJobsForStorage(mergedAfterDedup);
  const latestSearchJobs = sortJobsByScore(normalizedValidApiJobs);
  const visibleJobs = finalSavedJobs;

  return {
    finalSavedJobs,
    latestSearchJobs,
    visibleJobs,
  };
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [analysis, setAnalysis] = useState<Record<number, string>>({});
  const [searchLoading, setSearchLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(false);
  const [stats, setStats] = useState<SearchStats>({});
  const [lastCvAnalysisFeedback, setLastCvAnalysisFeedback] =
    useState<CvAnalysisFeedback | null>(null);

  const resetVersionRef = useRef(0);
  const searchRequestIdRef = useRef(0);
  const profileRequestIdRef = useRef(0);

  const isCurrentResetVersion = useCallback((version: number) => {
    return resetVersionRef.current === version;
  }, []);

  const resetJobs = useCallback(() => {
    resetVersionRef.current += 1;
    searchRequestIdRef.current += 1;
    profileRequestIdRef.current += 1;

    setJobs([]);
    setAnalysis({});
    setStats({});
    setSearchLoading(false);
    setProfileLoading(false);
    setLastCvAnalysisFeedback(null);
  }, []);

  async function analyzeCv(file: File): Promise<CvProfile> {
    const resetVersion = resetVersionRef.current;
    const profileRequestId = profileRequestIdRef.current + 1;
    const startedAt = performance.now();

    profileRequestIdRef.current = profileRequestId;
    setProfileLoading(true);

    const isCurrentProfileRequest = () =>
      isCurrentResetVersion(resetVersion) &&
      profileRequestIdRef.current === profileRequestId;

    try {
      const base64 = await toBase64(file);
      const data = await analyzeCvAPI(base64, file.name);

      if (!isCurrentProfileRequest()) {
        throw new Error("CV analysis was reset before completion.");
      }

      if (!data.success || !data.profile) {
        if (data.errorCode === "NOT_A_CV") {
          throw new Error(
            "Questo file non sembra essere un CV. Carica per favore il tuo curriculum."
          );
        }

        const recoveredProfile = recoverProfileFromApiFailure(data);

        if (recoveredProfile && hasUsableProfileSignals(recoveredProfile)) {
          setLastCvAnalysisFeedback({
            durationMs: Math.round(performance.now() - startedAt),
            cacheHit: false,
            completedAt: Date.now(),
          });

          return recoveredProfile;
        }

        const message = getAnalyzeCvFailureMessage(data);

        console.error("CV ANALYSIS FAILED:", data);

        throw new Error(String(message));
      }

      setLastCvAnalysisFeedback({
        durationMs: Math.round(performance.now() - startedAt),
        cacheHit: Boolean(data?.meta?.cacheHit),
        completedAt: Date.now(),
      });

      return data.profile;
    } finally {
      if (isCurrentProfileRequest()) {
        setProfileLoading(false);
      }
    }
  }

  async function searchJobs(
    file: File,
    profile: CvProfile | null,
    savedJobs: Job[]
  ): Promise<Job[]> {
    const resetVersion = resetVersionRef.current;
    const searchRequestId = searchRequestIdRef.current + 1;

    searchRequestIdRef.current = searchRequestId;

    const isCurrentSearchRequest = () =>
      isCurrentResetVersion(resetVersion) &&
      searchRequestIdRef.current === searchRequestId;

    setSearchLoading(true);
    setAnalysis({});
    setStats({});

    try {
      const base64 = await toBase64(file);

      let profileToUse = profile;
      if (!profileToUse) {
        profileToUse = await analyzeCv(file);
      }

      if (!isCurrentSearchRequest()) {
        return [];
      }

      const previousSavedJobs = prepareSavedJobsForStorage([
        ...getSavedJobs(),
        ...savedJobs,
      ]);

      const knownUrls = previousSavedJobs
        .map((job) => job.url)
        .filter((url): url is string => Boolean(url));

      const data = await searchJobsAPI(
        base64,
        file.name,
        profileToUse,
        knownUrls
      );

      if (!isCurrentSearchRequest()) {
        return [];
      }

      if (data.error) {
        const message = data.details || data.error;
        throw new Error(String(message));
      }

      if (data.noNewJobs) {
        const sortedSavedJobs = prepareSavedJobsForStorage(previousSavedJobs);

        setJobs(sortedSavedJobs);
        setStats({
          foundLinks: data.foundLinks,
          scanned: data.scanned,
          shown: sortedSavedJobs.length,
        });

        return sortedSavedJobs;
      }

      const apiJobs: Job[] = Array.isArray(data.jobs) ? data.jobs : [];

      const { finalSavedJobs, latestSearchJobs, visibleJobs } =
        buildSavedJobsPipeline({
          apiJobs,
          previousSavedJobs,
        });

      setJobs(visibleJobs);

      try {
        saveJobs(finalSavedJobs);
      } catch (error) {
        console.error("Failed to save jobs", error);
      }

      setStats({
        foundLinks: data.foundLinks,
        scanned: data.scanned,
        shown: visibleJobs.length,
      });

      return finalSavedJobs.length > 0 ? finalSavedJobs : latestSearchJobs;
    } catch (error) {
      console.error("SEARCH JOBS ERROR:", error);

      if (!isCurrentSearchRequest()) {
        return [];
      }

      throw new Error(getErrorMessage(error, "Job search failed"));
    } finally {
      if (isCurrentSearchRequest()) {
        setSearchLoading(false);
      }
    }
  }

  function showSavedJobs() {
    const sortedSavedJobs = prepareSavedJobsForStorage(getSavedJobs());

    setJobs(sortedSavedJobs);
    setStats((prev) => ({
      ...prev,
      shown: sortedSavedJobs.length,
    }));

    return sortedSavedJobs;
  }

  async function analyzeJob(job: Job, file: File, profile: CvProfile | null) {
    const resetVersion = resetVersionRef.current;

    if (!isCurrentResetVersion(resetVersion)) {
      return;
    }

    setAnalysis((prev) => ({
      ...prev,
      [job.id]: "⏳ Analisi in corso...",
    }));

    try {
      const base64 = await toBase64(file);
      const data = await analyzeJobAPI(base64, file.name, profile, job);

      if (!isCurrentResetVersion(resetVersion)) {
        return;
      }

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

      if (!isCurrentResetVersion(resetVersion)) {
        return;
      }

      setAnalysis((prev) => ({
        ...prev,
        [job.id]: "Errore: " + getErrorMessage(error),
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
    showSavedJobs,
    analyzeJob,
    analyzeCv,
    resetJobs,
    lastCvAnalysisFeedback,
  };
}
