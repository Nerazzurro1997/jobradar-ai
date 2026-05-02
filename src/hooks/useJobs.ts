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

      if (!data.success || !data.profile) {
        throw new Error(data.error || "CV error");
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

      if (data.error) {
        throw new Error(data.error);
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
      alert("Errore jobs: " + String(error));
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