import type { Job } from "../types";

type RankedJob = Job & {
  distanceScore?: number | string | null;
  recencyScore?: number | string | null;
  requirementMatchScore?: number | string | null;
  finalScore?: number | string | null;
  locationPriority?: number | string | null;
  matchedLocation?: string | null;
  publishedDate?: string | null;
  savedAt?: number | string | null;
};

const SAVED_JOBS_MIN_SCORE = 70;

const COMPANY_DUPLICATE_NOISE_WORDS = new Set([
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

const TITLE_DUPLICATE_NOISE_WORDS = new Set([
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

const LOCATION_DUPLICATE_NOISE_WORDS = new Set([
  "schweiz",
  "suisse",
  "svizzera",
  "switzerland",
]);

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const normalized = value.trim().replace(",", ".");
    const numericText = normalized.match(/-?\d+(\.\d+)?/)?.[0];
    const parsed = numericText ? Number(numericText) : Number(normalized);

    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function normalizeUrl(value: unknown) {
  const raw = normalizeText(value);
  if (!raw) return "";

  return raw.split("#")[0].split("?")[0].replace(/\/$/, "");
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function normalizeDuplicateText(value: unknown) {
  return normalizeText(value)
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeCompanyName(value: unknown) {
  const normalized = normalizeDuplicateText(value);
  const words = normalized
    .split(" ")
    .filter((word) => word && !COMPANY_DUPLICATE_NOISE_WORDS.has(word));

  return words.join(" ") || normalized.trim();
}

function normalizeJobTitleForDuplicate(value: unknown) {
  const raw = typeof value === "string" ? value : "";
  const withoutNoise = raw
    .replace(
      /\([^)]*(?:m\s*\/\s*w\s*\/\s*d|w\s*\/\s*m\s*\/\s*d|mwd|all genders|\d{1,3}\s*%)[^)]*\)/gi,
      " "
    )
    .replace(/\b\d{1,3}\s*(?:[-\u2013\u2014]|bis|to)\s*\d{1,3}\s*%/gi, " ")
    .replace(/\b\d{1,3}\s*%/g, " ")
    .replace(/\b(?:m\s*\/\s*w\s*\/\s*d|w\s*\/\s*m\s*\/\s*d|mwd|all genders)\b/gi, " ");

  return normalizeDuplicateText(withoutNoise)
    .split(" ")
    .filter((word) => word && !TITLE_DUPLICATE_NOISE_WORDS.has(word))
    .join(" ");
}

function normalizeLocationForDuplicate(value: unknown) {
  const normalized = normalizeDuplicateText(value)
    .split(" ")
    .filter((word) => word && !LOCATION_DUPLICATE_NOISE_WORDS.has(word))
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

function getScore(job: RankedJob) {
  return Math.max(toNumber(job.score), toNumber(job.finalScore));
}

export function getJobDisplayScore(job: Job) {
  return getScore(job as RankedJob);
}

export function isJobAboveMinimumScore(
  job: Job,
  minimumScore = SAVED_JOBS_MIN_SCORE
) {
  return getJobDisplayScore(job) >= minimumScore;
}

function getDistanceScoreFromLocation(locationValue: unknown) {
  const location = normalizeText(locationValue);

  if (!location) return 40;

  if (
    /\bau\b/.test(location) ||
    location.includes("au zh") ||
    location.includes("au, zh") ||
    location.includes("au zürich") ||
    location.includes("au zurich") ||
    location.includes("au zuerich")
  ) {
    return 100;
  }

  if (location.includes("wädenswil") || location.includes("waedenswil")) {
    return 96;
  }

  if (location.includes("horgen")) return 96;
  if (location.includes("richterswil")) return 92;
  if (location.includes("thalwil")) return 90;

  if (location.includes("pfäffikon") || location.includes("pfaeffikon")) {
    return 86;
  }

  if (location.includes("rapperswil")) {
    return 84;
  }

  if (location.includes("meilen")) return 82;
  if (location.includes("adliswil")) return 78;
  if (location.includes("altendorf")) return 68;
  if (location.includes("lachen")) return 66;
  if (location.includes("siebnen")) return 64;

  if (
    location === "zürich" ||
    location === "zurich" ||
    location === "zuerich" ||
    location.includes("stadt zürich") ||
    location.includes("stadt zurich") ||
    location.includes("stadt zuerich")
  ) {
    return 76;
  }

  if (location.includes("samstagern")) return 88;
  if (location.includes("schwerzenbach")) return 65;
  if (location.includes("zug")) return 60;
  if (location.includes("schwyz")) return 58;
  if (location.includes("winterthur")) return 45;
  if (location.includes("st. gallen") || location.includes("sankt gallen")) {
    return 35;
  }
  if (location.includes("tuggen")) return 35;

  const otherZurichCantonSignals = [
    "zh",
    "kanton zürich",
    "kanton zurich",
    "uster",
    "dietikon",
    "dübendorf",
    "duebendorf",
    "kloten",
    "bülach",
    "buelach",
    "regensdorf",
    "schlieren",
    "wetzikon",
    "zollikon",
    "küsnacht",
    "kuesnacht",
    "affoltern",
    "opfikon",
    "glattbrugg",
    "wallisellen",
    "volketswil",
    "hinwil",
  ];

  if (includesAny(location, otherZurichCantonSignals)) return 55;

  return 40;
}

function getDistanceScore(job: RankedJob) {
  const explicitDistanceScore = toNumber(job.distanceScore);
  return explicitDistanceScore > 0
    ? explicitDistanceScore
    : getDistanceScoreFromLocation(job.location);
}

function getRecencyScore(job: RankedJob) {
  return toNumber(job.recencyScore);
}

function getRequirementMatchScore(job: RankedJob) {
  return toNumber(job.requirementMatchScore);
}

function getDateTime(value: unknown) {
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

function getPublishedDateScore(job: RankedJob) {
  return getDateTime(job.publishedDate);
}

function getSavedAtScore(job: RankedJob) {
  return getDateTime(job.savedAt);
}

function getDuplicateJobKey(job: Job) {
  const title = normalizeJobTitleForDuplicate(job.title);
  const company = normalizeCompanyName(job.company);
  const location = normalizeLocationForDuplicate(job.location);

  return title && company && location
    ? [title, company, location].join("|")
    : "";
}

function getJobKey(job: Job) {
  const duplicateKey = getDuplicateJobKey(job);
  if (duplicateKey) return `duplicate:${duplicateKey}`;

  const url = normalizeUrl(job.url);
  if (url) return `url:${url}`;

  const title = normalizeText(job.title);
  const company = normalizeText(job.company);
  const location = normalizeText(job.location);
  const fallbackKey = [title, company, location].filter(Boolean).join("|");

  return fallbackKey ? `fallback:${fallbackKey}` : "";
}

function getFullDescriptionLength(job: Job) {
  return typeof job.fullDescription === "string"
    ? job.fullDescription.trim().length
    : 0;
}

function shouldPreferJob(candidate: RankedJob, current: RankedJob) {
  const scoreDiff = getScore(candidate) - getScore(current);
  if (scoreDiff !== 0) return scoreDiff > 0;

  const publishedDateDiff =
    getPublishedDateScore(candidate) - getPublishedDateScore(current);
  if (publishedDateDiff !== 0) return publishedDateDiff > 0;

  return getFullDescriptionLength(candidate) > getFullDescriptionLength(current);
}

function mergeJob(existingJob: Job, incomingJob: Job) {
  const existingRankedJob = existingJob as RankedJob;
  const incomingRankedJob = incomingJob as RankedJob;
  const preferredJob = shouldPreferJob(incomingRankedJob, existingRankedJob)
    ? incomingJob
    : existingJob;
  const secondaryJob = preferredJob === incomingJob ? existingJob : incomingJob;
  const preferredRankedJob = preferredJob as RankedJob;
  const secondaryRankedJob = secondaryJob as RankedJob;

  const bestScore = Math.max(
    getScore(existingRankedJob),
    getScore(incomingRankedJob)
  );

  const bestRequirementMatchScore = Math.max(
    getRequirementMatchScore(existingRankedJob),
    getRequirementMatchScore(incomingRankedJob)
  );

  const bestRecencyScore = Math.max(
    getRecencyScore(existingRankedJob),
    getRecencyScore(incomingRankedJob)
  );

  const mergedLocation = preferredJob.location || secondaryJob.location;
  const mergedDistanceJob = {
    ...existingRankedJob,
    ...incomingRankedJob,
    location: mergedLocation,
  } as RankedJob;

  return {
    ...secondaryJob,
    ...preferredJob,
    id: existingJob.id ?? incomingJob.id,
    url: preferredJob.url || secondaryJob.url,
    title: preferredJob.title || secondaryJob.title,
    company: preferredJob.company || secondaryJob.company,
    location: mergedLocation,
    snippet: preferredJob.snippet || secondaryJob.snippet,
    fullDescription:
      preferredJob.fullDescription || secondaryJob.fullDescription,
    highlights: preferredJob.highlights?.length
      ? preferredJob.highlights
      : secondaryJob.highlights,
    riskFlags: preferredJob.riskFlags?.length
      ? preferredJob.riskFlags
      : secondaryJob.riskFlags,
    matchedKeywords: preferredJob.matchedKeywords?.length
      ? preferredJob.matchedKeywords
      : secondaryJob.matchedKeywords,
    missingKeywords: preferredJob.missingKeywords?.length
      ? preferredJob.missingKeywords
      : secondaryJob.missingKeywords,
    score: bestScore,
    finalScore: bestScore,
    distanceScore: getDistanceScore(mergedDistanceJob),
    requirementMatchScore: bestRequirementMatchScore,
    recencyScore: bestRecencyScore,
    locationPriority:
      preferredRankedJob.locationPriority ?? secondaryRankedJob.locationPriority,
    matchedLocation:
      preferredRankedJob.matchedLocation ?? secondaryRankedJob.matchedLocation,
    publishedDate:
      preferredRankedJob.publishedDate ?? secondaryRankedJob.publishedDate,
    savedAt: existingRankedJob.savedAt ?? incomingRankedJob.savedAt,
  };
}

function getUniqueJobMapKey(uniqueJobs: Map<string, Job>, job: Job) {
  const key = getJobKey(job);

  if (!key || uniqueJobs.has(key)) return key;

  const jobTitle = normalizeJobTitleForDuplicate(job.title);
  const jobCompany = normalizeCompanyName(job.company);
  const jobLocation = normalizeLocationForDuplicate(job.location);

  if (!jobTitle || !jobCompany || !jobLocation) return key;

  for (const [existingKey, existingJob] of uniqueJobs) {
    const existingCompany = normalizeCompanyName(existingJob.company);
    const existingLocation = normalizeLocationForDuplicate(
      existingJob.location
    );

    if (jobCompany !== existingCompany || jobLocation !== existingLocation) {
      continue;
    }

    const existingTitle = normalizeJobTitleForDuplicate(existingJob.title);
    if (areDuplicateTitles(jobTitle, existingTitle)) return existingKey;
  }

  return key;
}

export function sortJobsByScore(jobs: Job[]) {
  const sortedJobs = [...jobs].sort((a, b) => {
    const jobA = a as RankedJob;
    const jobB = b as RankedJob;

    const scoreA = getScore(jobA);
    const scoreB = getScore(jobB);
    const scoreDiff = scoreB - scoreA;

    if (Math.abs(scoreDiff) >= 10) {
      return scoreDiff;
    }

    const distanceDiff = getDistanceScore(jobB) - getDistanceScore(jobA);
    if (distanceDiff !== 0) return distanceDiff;

    const requirementDiff =
      getRequirementMatchScore(jobB) - getRequirementMatchScore(jobA);
    if (requirementDiff !== 0) return requirementDiff;

    const recencyDiff = getRecencyScore(jobB) - getRecencyScore(jobA);
    if (recencyDiff !== 0) return recencyDiff;

    const publishedDateDiff =
      getPublishedDateScore(jobB) - getPublishedDateScore(jobA);
    if (publishedDateDiff !== 0) return publishedDateDiff;

    const savedAtDiff = getSavedAtScore(jobB) - getSavedAtScore(jobA);
    if (savedAtDiff !== 0) return savedAtDiff;

    return scoreDiff;
  });

  return sortedJobs;
}

export function getUniqueJobsByUrl(jobs: Job[]) {
  const uniqueJobs = new Map<string, Job>();
  const jobsWithoutKey: Job[] = [];

  for (const job of jobs) {
    const key = getUniqueJobMapKey(uniqueJobs, job);

    if (!key) {
      jobsWithoutKey.push(job);
      continue;
    }

    const existingJob = uniqueJobs.get(key);
    uniqueJobs.set(key, existingJob ? mergeJob(existingJob, job) : job);
  }

  return [...uniqueJobs.values(), ...jobsWithoutKey];
}

export function normalizeJobs(jobs: Job[]) {
  return jobs
    .filter((job) => getJobKey(job))
    .map((job) => {
      const rankedJob = job as RankedJob;
      const score = getScore(rankedJob);

      return {
        ...job,
        id: job.id ?? Math.floor(Date.now() + Math.random() * 1_000_000),
        score,
        distanceScore: getDistanceScore(rankedJob),
        recencyScore: getRecencyScore(rankedJob),
        requirementMatchScore: getRequirementMatchScore(rankedJob),
        finalScore: score,
        locationPriority: rankedJob.locationPriority,
        matchedLocation: rankedJob.matchedLocation,
        publishedDate: rankedJob.publishedDate,
        savedAt: rankedJob.savedAt ?? new Date().toISOString(),
      };
    });
}

export function prepareJobsForDisplay(jobs: Job[]) {
  return sortJobsByScore(getUniqueJobsByUrl(normalizeJobs(jobs)));
}

export function prepareSavedJobsForStorage(jobs: Job[]) {
  const normalizedJobs = normalizeJobs(jobs);
  const aboveMinimumScoreJobs = normalizedJobs.filter((job) =>
    isJobAboveMinimumScore(job, SAVED_JOBS_MIN_SCORE)
  );
  const uniqueJobs = getUniqueJobsByUrl(aboveMinimumScoreJobs);
  const sortedJobs = sortJobsByScore(uniqueJobs);

  return sortedJobs;
}
