import type { Job } from "../types";
import { prepareSavedJobsForStorage } from "./jobs";

const STORAGE_KEY = "jobradar_saved_jobs";
const DEBUG_STORAGE_KEY = "jobradar_debug_storage";

type SavedDebugJob = Job & {
  finalScore?: number | string | null;
  distanceScore?: number | string | null;
  requirementMatchScore?: number | string | null;
  recencyScore?: number | string | null;
  publishedDate?: string | null;
  savedAt?: number | string | null;
};

function getStorage(): Storage | null {
  if (typeof window === "undefined") return null;

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeStoredJobs(value: unknown): Job[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord) as Job[];
}

function isStorageDebugEnabled() {
  return getStorage()?.getItem(DEBUG_STORAGE_KEY) === "1";
}

function getSavedJobDebugPayload(job: Job) {
  const savedJob = job as SavedDebugJob;

  return {
    title: savedJob.title,
    company: savedJob.company,
    location: savedJob.location,
    score: savedJob.score,
    finalScore: savedJob.finalScore,
    distanceScore: savedJob.distanceScore,
    requirementMatchScore: savedJob.requirementMatchScore,
    recencyScore: savedJob.recencyScore,
    publishedDate: savedJob.publishedDate,
    savedAt: savedJob.savedAt,
  };
}

function logSavedSortDebug(sortedSavedJobs: Job[]) {
  if (!isStorageDebugEnabled()) return;

  console.log(
    "SAVED SORT DEBUG",
    sortedSavedJobs.slice(0, 10).map(getSavedJobDebugPayload)
  );
}

export function logShowSavedFinalOrder(jobs: Job[]) {
  if (!isStorageDebugEnabled()) return;

  console.log(
    "SHOW SAVED FINAL ORDER",
    jobs.slice(0, 20).map(getSavedJobDebugPayload)
  );
}

export function getSavedJobs(): Job[] {
  const storage = getStorage();
  if (!storage) return [];

  try {
    const data = storage.getItem(STORAGE_KEY);
    if (!data) return [];

    const storedJobs = normalizeStoredJobs(JSON.parse(data));
    const cleanedSavedJobs = prepareSavedJobsForStorage(storedJobs);

    if (cleanedSavedJobs.length !== storedJobs.length) {
      storage.setItem(STORAGE_KEY, JSON.stringify(cleanedSavedJobs));
    }

    logSavedSortDebug(cleanedSavedJobs);

    return cleanedSavedJobs;
  } catch (error) {
    console.error("Failed to read saved jobs", error);
    return [];
  }
}

export function saveJobs(jobs: Job[]) {
  const storage = getStorage();
  if (!storage) return;

  try {
    const cleanedSavedJobs = prepareSavedJobsForStorage(jobs);

    logSavedSortDebug(cleanedSavedJobs);

    storage.setItem(STORAGE_KEY, JSON.stringify(cleanedSavedJobs));
  } catch (error) {
    console.error("Failed to save jobs", error);
  }
}

export function clearJobs() {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear saved jobs", error);
  }
}
