import type { Job } from "../types";

type RankedJob = Job & {
  distanceScore?: number | string | null;
  recencyScore?: number | string | null;
  requirementMatchScore?: number | string | null;
  finalScore?: number | string | null;
  locationPriority?: number | string | null;
  matchedLocation?: string | null;
};

function toNumber(value: unknown, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }

  return fallback;
}

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

function includesAny(text: string, words: string[]) {
  return words.some((word) => text.includes(word));
}

function getScore(job: RankedJob) {
  return toNumber(job.finalScore, toNumber(job.score));
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
  return getDistanceScoreFromLocation(job.matchedLocation || job.location);
}

function getRecencyScore(job: RankedJob) {
  return toNumber(job.recencyScore);
}

function getRequirementMatchScore(job: RankedJob) {
  return toNumber(job.requirementMatchScore);
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

    if (Math.abs(scoreDiff) > 10) {
      return scoreDiff;
    }

    const distanceDiff = getDistanceScore(jobB) - getDistanceScore(jobA);
    if (distanceDiff !== 0) return distanceDiff;

    const requirementDiff =
      getRequirementMatchScore(jobB) - getRequirementMatchScore(jobA);
    if (requirementDiff !== 0) return requirementDiff;

    const recencyDiff = getRecencyScore(jobB) - getRecencyScore(jobA);
    if (recencyDiff !== 0) return recencyDiff;

    return scoreDiff;
  });

  logSortPreview(sortedJobs);

  return sortedJobs;
}

export function getUniqueJobsByUrl(jobs: Job[]) {
  return jobs.filter((job, index, self) => {
    if (!job.url) return false;
    return index === self.findIndex((item) => item.url === job.url);
  });
}

export function normalizeJobs(jobs: Job[]) {
  return jobs
    .filter((job) => job.url)
    .map((job) => {
      const rankedJob = job as RankedJob;

      return {
        ...job,
        id: job.id ?? Math.floor(Date.now() + Math.random() * 1_000_000),
        distanceScore: getDistanceScore(rankedJob),
        recencyScore: getRecencyScore(rankedJob),
        requirementMatchScore: getRequirementMatchScore(rankedJob),
        finalScore: toNumber(rankedJob.finalScore, toNumber(rankedJob.score)),
        locationPriority: rankedJob.locationPriority,
        matchedLocation: rankedJob.matchedLocation,
      };
    });
}
