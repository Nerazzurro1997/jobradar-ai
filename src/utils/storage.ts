import type { Job } from "../types";
import { prepareSavedJobsForStorage } from "./jobs";

const STORAGE_KEY = "jobradar_saved_jobs";

type SavedDebugJob = Job & {
  finalScore?: number | string | null;
  distanceScore?: number | string | null;
  requirementMatchScore?: number | string | null;
  recencyScore?: number | string | null;
  publishedDate?: string | null;
  savedAt?: number | string | null;
};

function normalizeStoredJobs(value: unknown): Job[] {
  return Array.isArray(value) ? value : [];
}

function logSavedSortDebug(sortedSavedJobs: Job[]) {
  console.log(
    "SAVED SORT DEBUG",
    sortedSavedJobs.slice(0, 10).map((job) => {
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
    })
  );
}

export function logShowSavedFinalOrder(jobs: Job[]) {
  console.log(
    "SHOW SAVED FINAL ORDER",
    jobs.slice(0, 20).map((job) => {
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
        savedAt: savedJob.savedAt,
      };
    })
  );
}

export function getSavedJobs(): Job[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];

    const storedJobs = normalizeStoredJobs(JSON.parse(data));
    const cleanedSavedJobs = prepareSavedJobsForStorage(storedJobs);

    if (cleanedSavedJobs.length !== storedJobs.length) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedSavedJobs));
    }

    logSavedSortDebug(cleanedSavedJobs);

    return cleanedSavedJobs;
  } catch {
    return [];
  }
}

export function saveJobs(jobs: Job[]) {
  const cleanedSavedJobs = prepareSavedJobsForStorage(jobs);

  logSavedSortDebug(cleanedSavedJobs);

  localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedSavedJobs));
}

export function clearJobs() {
  localStorage.removeItem(STORAGE_KEY);
}
