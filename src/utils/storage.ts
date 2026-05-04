import type { Job } from "../types";
import { prepareSavedJobsForStorage } from "./jobs";

const STORAGE_KEY = "jobradar_saved_jobs";

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
