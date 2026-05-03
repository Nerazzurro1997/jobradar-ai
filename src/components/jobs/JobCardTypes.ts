import type { ReactNode } from "react";
import type { Job } from "../../types";

export type JobCardProps = {
  job: Job;
  index: number;
  analysisText?: string;
  hoveredId: number | null;
  showSavedJobs: boolean;
  onHover: (id: number | null) => void;
  onAnalyze: (job: Job) => void;
};

export type JobWithOptionalFields = Job & {
  workload?: string;
  workloadPercent?: string;
  employmentLevel?: string;
  pensum?: string;
  distanceScore?: number | string | null;
  recencyScore?: number | string | null;
  requirementMatchScore?: number | string | null;
  finalScore?: number | string | null;
  publishedDate?: string | null;
  savedAt?: number | string | null;
  uiDecisionSection?: "new" | "all" | "live";
};

export type BadgeTone =
  | "neutral"
  | "blue"
  | "green"
  | "amber"
  | "red"
  | "purple";

export type BadgeProps = {
  children: ReactNode;
  tone?: BadgeTone;
};

export type RecommendationStyle = {
  label: string;
  background: string;
  border: string;
  color: string;
};

export type MobileAnalysisSection = {
  title: string;
  items: string[];
};

export const ANALYZING_TEXT = "⏳ Analisi in corso...";
