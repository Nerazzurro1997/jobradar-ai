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

function getScore(job: RankedJob) {
  return Math.max(toNumber(job.score), toNumber(job.finalScore));
}

export function getJobDisplayScore(job: Job) {
  return getScore(job as RankedJob);
}

export function isJobAboveMinimumScore(job: Job, minimumScore = SAVED_JOBS_MIN_SCORE) {
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

  if (
    location.includes("pfäffikon") ||
    location.includes("pfaeffikon") ||
    location.includes("pfäffikon sz") ||
    location.includes("pfaeffikon sz")
  ) {
    return 86;
  }

  if (
    location.includes("rapperswil-jona") ||
    location.includes("rapperswil")
  ) {
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

function getJobKey(job: Job) {
  const url = normalizeUrl(job.url);
  if (url) return `url:${url}`;

  const title = normalizeText(job.title);
  const company = normalizeText(job.company);
  const location = normalizeText(job.location);
  const fallbackKey = [title, company, location].filter(Boolean).join("|");

  return fallbackKey ? `fallback:${fallbackKey}` : "";
}

function mergeJob(existingJob: Job, incomingJob: Job) {
  const existingRankedJob = existingJob as RankedJob;
  const incomingRankedJob = incomingJob as RankedJob;

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

  const mergedLocation = incomingJob.location || existingJob.location;
  const mergedDistanceJob = {
    ...existingRankedJob,
    ...incomingRankedJob,
    location: mergedLocation,
  } as RankedJob;

  return {
    ...existingJob,
    ...incomingJob,
    id: existingJob.id ?? incomingJob.id,
    url: incomingJob.url || existingJob.url,
    title: incomingJob.title || existingJob.title,
    company: incomingJob.company || existingJob.company,
    location: incomingJob.location || existingJob.location,
    snippet: incomingJob.snippet || existingJob.snippet,
    fullDescription:
      incomingJob.fullDescription || existingJob.fullDescription,
    highlights: incomingJob.highlights?.length
      ? incomingJob.highlights
      : existingJob.highlights,
    riskFlags: incomingJob.riskFlags?.length
      ? incomingJob.riskFlags
      : existingJob.riskFlags,
    matchedKeywords: incomingJob.matchedKeywords?.length
      ? incomingJob.matchedKeywords
      : existingJob.matchedKeywords,
    missingKeywords: incomingJob.missingKeywords?.length
      ? incomingJob.missingKeywords
      : existingJob.missingKeywords,
    score: bestScore,
    finalScore: bestScore,
    distanceScore: getDistanceScore(mergedDistanceJob),
    requirementMatchScore: bestRequirementMatchScore,
    recencyScore: bestRecencyScore,
    locationPriority:
      incomingRankedJob.locationPriority ?? existingRankedJob.locationPriority,
    matchedLocation:
      incomingRankedJob.matchedLocation ?? existingRankedJob.matchedLocation,
    publishedDate:
      incomingRankedJob.publishedDate ?? existingRankedJob.publishedDate,
    savedAt: existingRankedJob.savedAt ?? incomingRankedJob.savedAt,
  };
}

function logSortPreview(sortedJobs: Job[]) {
  console.log(
    "JOB SORT DEBUG:",
    sortedJobs.slice(0, 10).map((job) => {
      const rankedJob = job as RankedJob;

      return {
        title: rankedJob.title,
        location: rankedJob.location,
        score: getScore(rankedJob),
        distanceScore: getDistanceScore(rankedJob),
        recencyScore: getRecencyScore(rankedJob),
        requirementMatchScore: getRequirementMatchScore(rankedJob),
      };
    })
  );
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

  logSortPreview(sortedJobs);

  return sortedJobs;
}

export function getUniqueJobsByUrl(jobs: Job[]) {
  const uniqueJobs = new Map<string, Job>();
  const jobsWithoutKey: Job[] = [];

  for (const job of jobs) {
    const key = getJobKey(job);

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
  const beforeFilterCount = jobs.length;
  const normalizedJobs = normalizeJobs(jobs);
  const aboveMinimumScoreJobs = normalizedJobs.filter((job) =>
    isJobAboveMinimumScore(job, SAVED_JOBS_MIN_SCORE)
  );
  const removedBelow70 = beforeFilterCount - aboveMinimumScoreJobs.length;
  const uniqueJobs = getUniqueJobsByUrl(aboveMinimumScoreJobs);
  const sortedJobs = sortJobsByScore(uniqueJobs);

  console.log("SAVED FILTER DEBUG", {
    beforeFilterCount,
    afterFilterCount: aboveMinimumScoreJobs.length,
    removedBelow70,
  });

  return sortedJobs;
}
