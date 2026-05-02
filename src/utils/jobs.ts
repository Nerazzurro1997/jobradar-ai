import type { Job } from "../types";

export function sortJobsByScore(jobs: Job[]) {
  return [...jobs].sort((a, b) => (b.score || 0) - (a.score || 0));
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
    .map((job) => ({
      ...job,
      id: job.id ?? Math.floor(Date.now() + Math.random() * 1_000_000),
    }));
}