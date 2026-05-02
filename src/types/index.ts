export type Job = {
  id: number;
  title: string;
  company: string;
  location: string;
  url?: string;
  snippet?: string;
  fullDescription?: string;
  highlights?: string[];
  riskFlags?: string[];
  previewSummary?: string;
  publishedDate?: string;
  keyword?: string;
  score?: number;
};

export type CvProfile = {
  searchTerms: string[];
  strongKeywords: string[];
  avoidKeywords: string[];
  locations: string[];
  profileSummary: string;
};

export type SearchStats = {
  foundLinks?: number;
  scanned?: number;
  shown?: number;
};