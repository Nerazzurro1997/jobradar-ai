import type { CvProfile, Job } from "../types";

import {
  SUPABASE_ANALYZE_CV_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_FUNCTION_URL,
  SUPABASE_SEARCH_JOBS_URL,
} from "../config/supabase";

export async function analyzeCvAPI(base64: string, fileName: string) {
  const response = await fetch(SUPABASE_ANALYZE_CV_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      fileName,
      fileBase64: base64,
    }),
  });

  const data = await response.json();
  return data;
}

export async function searchJobsAPI(
  base64: string,
  fileName: string,
  profile: CvProfile,
  knownUrls: string[]
) {
  const response = await fetch(SUPABASE_SEARCH_JOBS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      profile,
      fileName,
      fileBase64: base64,
      location: "Zürich",
      knownUrls,
    }),
  });

  const data = await response.json();
  return data;
}

export async function analyzeJobAPI(
  base64: string,
  fileName: string,
  profile: CvProfile | null,
  job: Job
) {
  const response = await fetch(SUPABASE_FUNCTION_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      fileName,
      fileBase64: base64,
      profile,
      job,
    }),
  });

  const data = await response.json();
  return data;
}