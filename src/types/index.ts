export type Primitive = string | number | boolean | null;

export type JsonValue =
  | Primitive
  | JsonValue[]
  | {
      [key: string]: JsonValue;
    };

export type UnknownRecord = Record<string, unknown>;

export type JobId = number;

export type PercentScore = number;

export type JobFitLabel =
  | "Best Match"
  | "Elite Match"
  | "Good Match"
  | "Medium Match"
  | "Low Match"
  | "Risk Match"
  | string;

export type JobSource =
  | "live"
  | "saved"
  | "manual"
  | "api"
  | "google"
  | "indeed"
  | "linkedin"
  | "company"
  | string;

export type Job = {
  id: JobId;

  title: string;
  company: string;
  location: string;

  url?: string;
  applicationUrl?: string;
  companyUrl?: string;
  companyLogo?: string;

  source?: JobSource;
  sourceName?: string;

  snippet?: string;
  fullDescription?: string;
  previewSummary?: string;
  aiSummary?: string;

  highlights?: string[];
  riskFlags?: string[];
  requirements?: string[];
  responsibilities?: string[];
  benefits?: string[];

  matchedKeywords?: string[];
  missingKeywords?: string[];
  tags?: string[];
  keyword?: string;

  score?: PercentScore;
  matchScore?: PercentScore;
  confidence?: PercentScore;
  fitLabel?: JobFitLabel;
  fitReasons?: string[];

  salary?: string;
  workload?: string | number;
  employmentType?: string;
  seniority?: string;
  industry?: string;
  languageRequirements?: string[];

  publishedDate?: string;
  createdAt?: string;
  savedAt?: string;
  analyzedAt?: string;

  /**
   * Keeps compatibility with AI/API fields that may evolve over time.
   */
  [key: string]: unknown;
};

export type LanguageProfile = {
  languages?: string[];
  strongestLanguages?: string[];
  businessLanguages?: string[];
  languageKeywords?: string[];
  languageSummary?: string;

  [key: string]: unknown;
};

export type CvIdentity = {
  currentRole?: string;
  targetRole?: string;
  seniorityLevel?: string;
  yearsOfExperience?: number | null;
  industryFocus?: string[];

  [key: string]: unknown;
};

export type CvSearchProfile = {
  searchTerms?: string[];
  strongKeywords?: string[];
  avoidKeywords?: string[];

  preferredLocations?: string[];
  preferredRoles?: string[];
  avoidRoles?: string[];

  [key: string]: unknown;
};

export type CvExperienceProfile = {
  roles?: string[];
  insuranceExperience?: string[];
  adminExperience?: string[];
  salesExperience?: string[];
  customerExperience?: string[];
  underwritingRelatedExperience?: string[];
  claimsRelatedExperience?: string[];

  [key: string]: unknown;
};

export type CvSkillsObject = {
  hardSkills?: string[];
  softSkills?: string[];
  tools?: string[];
  languages?: string[];
  certifications?: string[];

  [key: string]: unknown;
};

export type CvSkills = string[] | CvSkillsObject;

export type CvMatchingProfile = {
  bestFitRoles?: string[];
  acceptableRoles?: string[];
  weakFitRoles?: string[];

  dealBreakers?: string[];
  scoringHints?: string[];
  sellingPoints?: string[];
  applicationPositioning?: string[];

  riskAreas?: string[];

  [key: string]: unknown;
};

export type CvGapsProfile = {
  missingSkills?: string[];
  riskAreas?: string[];
  howToCompensate?: string[];

  [key: string]: unknown;
};

export type CvSummaryProfile = {
  shortSummary?: string;
  detailedSummary?: string;
  recruiterPitch?: string;

  [key: string]: unknown;
};

export type CvDeepProfile = {
  identity?: CvIdentity;
  languageProfile?: LanguageProfile;
  search?: CvSearchProfile;
  experience?: CvExperienceProfile;
  skills?: CvSkillsObject;
  matching?: CvMatchingProfile;
  gaps?: CvGapsProfile;
  summary?: CvSummaryProfile;

  [key: string]: unknown;
};

export type CvProfile = {
  /**
   * Core fields.
   * These are the minimum fields the app needs for searching and matching.
   */
  searchTerms: string[];
  strongKeywords: string[];
  avoidKeywords: string[];
  locations: string[];
  profileSummary: string;

  /**
   * Extra AI profile signals.
   */
  cvHighlights?: string[];
  skillTags?: string[];
  languageProfile?: LanguageProfile;

  /**
   * Structured profile sections.
   */
  identity?: CvIdentity;
  search?: CvSearchProfile;
  experience?: CvExperienceProfile;
  skills?: CvSkills;
  matching?: CvMatchingProfile;
  gaps?: CvGapsProfile;
  summary?: CvSummaryProfile;

  /**
   * Full deep profile returned/recovered by the AI.
   */
  deepProfile?: CvDeepProfile;

  /**
   * Keeps compatibility with future AI fields.
   */
  [key: string]: unknown;
};

export type SearchStats = {
  foundLinks?: number;
  scanned?: number;
  shown?: number;

  count?: number;
  saved?: number;
  duplicates?: number;
  skipped?: number;
  errors?: number;

  startedAt?: string;
  completedAt?: string;
  durationMs?: number;

  [key: string]: unknown;
};

export type JobAnalysisById = Record<JobId, string>;

export type ApiErrorPayload = {
  success?: boolean;
  error?: string;
  message?: string;
  details?: unknown;

  [key: string]: unknown;
};

export type AnalyzeCvApiResponse = ApiErrorPayload & {
  profile?: CvProfile;
};

export type SearchJobsApiResponse = ApiErrorPayload & {
  jobs?: Job[];
  foundLinks?: number;
  scanned?: number;
  count?: number;
};

export type AnalyzeJobApiResponse = ApiErrorPayload & {
  text?: string;
  output?: Array<{
    content?: Array<{
      text?: string;
      [key: string]: unknown;
    }>;
    [key: string]: unknown;
  }>;
};

export type StoredCvProfilePayload = {
  version: 1;
  profile: CvProfile;
  fileMeta: {
    name: string;
    size: number;
    lastModified: number;
    type: string;
  } | null;
  savedAt: string;
};