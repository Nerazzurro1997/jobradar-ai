import type { Job } from "../types";

const STORAGE_KEY = "jobradar_saved_jobs";

export function getSavedJobs(): Job[] {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveJobs(jobs: Job[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

export function clearJobs() {
  localStorage.removeItem(STORAGE_KEY);
}