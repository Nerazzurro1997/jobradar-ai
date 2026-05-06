# Search-Jobs Integration Specification

Status: specification only. Do not implement in production yet.

Source files reviewed:

- `python/evals/diagnostics.py`
- `python/evals/filter_model.py`
- `supabase/functions/search-jobs/index.ts`
- `python/evals/reports/universal_eval_analysis.md`

## Executive Summary

The Python eval suite is now ready to act as a specification source for `search-jobs`, not as code to copy directly.

Recommended approach: implement partially, in phases. Start with TypeScript-only diagnostics and query/filter strategy improvements. Do not immediately change final ranking weights or frontend display until the diagnostics prove stable on real search output.

The main integration goal is to make `search-jobs` more CV-driven and less dependent on globally fixed notions of what is "good" or "bad". Generic terms such as support, CRM, admin, office, communication, Excel, and customer care should only help strongly when the CV itself makes them core target work.

## Concepts To Port

### 1. CV-Driven Filter Model

Source: `python/evals/filter_model.py`.

Port the filter model as a deterministic TypeScript helper that derives filters from CV evidence:

- keyword queries
- role categories
- professional field/category
- location/home base
- radius suggestions
- remote/hybrid/on-site preference
- workload percentage preference
- seniority level
- language requirements
- salary expectation if present
- target domains
- target task groups
- avoid domains/tasks
- must-have skills
- nice-to-have skills
- company/industry preferences if present

Important rule: every filter must be derived from CV evidence or marked missing/unknown. Do not introduce a fixed industry preference.

### 2. Domain Alignment

Source: `detect_cv_domains`, `detect_job_domains`, `compare_domain_alignment`.

Port the concept, not the exact Python report object:

- detect CV target domains from profile fields, roles, skills, keywords, highlights, acceptable roles, weak-fit roles, avoid terms
- detect job domains from title, company, snippet, full description, requirements, responsibilities, keywords
- compute:
  - exact domain alignment
  - adjacent domain alignment
  - weak adjacent alignment
  - generic overlap only
  - mismatch
- expose diagnostic fields:
  - `domainAlignmentScore`
  - `matchingDomains`
  - `adjacentDomains`
  - `mismatchingDomains`
  - `genericKeywordRiskBoost`
  - `domainAlignmentType`

No domain should be globally good or bad. Banking is good for a banking CV, adjacent or weak for an insurance CV, and irrelevant for unrelated CVs.

### 3. Task Alignment

Source: `detect_cv_task_profile`, `detect_job_task_profile`, `compare_task_alignment`.

Port neutral task-group detection:

- customer support
- sales
- outbound acquisition
- administration
- policy administration
- claims handling
- software development
- IT support
- data analysis
- marketing
- content creation
- healthcare care
- case management
- retail sales
- logistics coordination
- finance operations
- HR coordination
- compliance
- project management
- document review
- CRM usage
- office tools
- language use
- communication

These are neutral task labels. They become positive, adjacent, generic, or risky only relative to the CV.

### 4. Task Importance Hierarchy

Source: `build_cv_task_importance_hierarchy`, `compare_task_importance`.

Port the hierarchy:

- `coreTasks`: primary target work derived from strongest CV evidence
- `adjacentTasks`: related/acceptable work derived from CV evidence
- `genericTasks`: broad supportive tasks from CV evidence
- `avoidTasks`: explicit avoid/deal-breaker work from CV evidence

Scoring interpretation:

- core task overlap should be strongest
- adjacent task overlap should be medium
- generic task overlap should not produce top ranking alone
- avoid task overlap should be a strong warning when avoid evidence is explicit in the CV

Also port the latest weighting idea:

- `taskSpecificityScore`
- `taskDepthScore`
- `roleSpecificityScore`
- `concreteTaskEvidenceScore`
- `genericTaskShare`

This prevents a same-domain generic support job from tying a concrete core-task job.

### 5. Generic Leakage Risk

Source: `detect_generic_keyword_risk`, `_generic_task_risk`, `_generic_leakage_risk_from_importance`.

Port as diagnostics first, then as score caps:

- jobs ranking high mainly because of generic keywords
- jobs ranking high mainly because of generic tasks
- jobs ranking high despite weak domain/task fit
- jobs with generic support/admin/CRM/communication overlap but weak core-task depth

Generic leakage should be CV-relative. For a customer support CV, customer support can be core. For a backend CV, generic support should not overpower software development.

### 6. Avoid-Task Overlap

Source: `avoid_tasks`, `avoid_task_overlap`, `hasProfileAvoidedSignal`.

Port stronger CV-derived avoid behavior:

- avoid terms must come from `avoidKeywords`, `search.avoidRoles`, `matching.dealBreakers`, explicit weak-fit/avoid fields, or equivalent CV evidence
- do not use global bad-role lists as final truth
- avoid overlap should produce risk flags, score caps, and diagnostics

### 7. Wave Strategy Improvements

Source: `filter_model._search_strategy`.

Port the four-wave strategy:

1. strongest roles + closest locations
2. adjacent roles/domains supported by CV evidence
3. cautious broader fallback roles
4. exploratory/generic only if needed, with guardrails

Fallback/generic queries should be delayed and lower confidence unless the CV explicitly targets those generic tasks.

## Concepts Not To Port Yet

Do not port these yet:

- Python pytest/evaluation runner into production
- metrics such as precision@k, recall@k, NDCG, MRR
- full `build_scoring_report` output
- automatic weight recommendations as runtime behavior
- detailed per-job markdown-style explanations in the API response
- any Python runtime dependency in the Supabase function
- any new scraping behavior
- any frontend display changes before backend diagnostics are stable
- large ML/semantic inference beyond deterministic catalogs
- global industry blacklists or global role penalties

## Current Search-Jobs Areas Affected

The following TypeScript areas in `supabase/functions/search-jobs/index.ts` would be affected by a future implementation.

### Profile Normalization

Current area:

- `type CvProfile`
- `normalizeProfile`
- `createProfileFromCv`
- `getProfileSearchText`
- `flattenProfileSkills`

Needed change:

- add a derived `CvFitModel` or `ProfileFitDiagnostics` object after `normalizeProfile`
- keep original `CvProfile` stable for compatibility
- do not require new frontend input

### Query Generation

Current area:

- `getPreferredRoleSignals`
- `getLanguageSignals`
- `isWeakSearchTerm`
- `isLowPriorityQuery`
- `getRoleLikeSearchSignals`
- `isRoleLikeSearchTerm`
- `toJobSearchQuery`
- `toSkillBasedJobSearchQuery`
- `isUsefulSkillSearchModifier`
- `getRoleSkillSearchQueries`
- `getProfileSkillQuerySignals`
- `getProfileRoleQuerySignals`
- `getGenericFallbackQueriesFromProfile`
- `getSearchQueries`

Needed change:

- replace globally fixed weak/low-priority query behavior with CV-relative task hierarchy
- generate queries from core roles/tasks first
- generate adjacent queries only from acceptable CV evidence
- generate generic fallback queries only when needed
- attach query metadata such as `domainIntent`, `taskIntent`, `waveIntent`, and `genericRisk`

### Location and Filter Strategy

Current area:

- `getSearchLocations`
- `getLocationFallbackScore`
- `getPrimaryProfileLocation`
- `getDistanceScoreForJob`
- `applyDistanceAwareScore`

Needed change:

- make locations derive from CV profile instead of fixed local presets
- apply radius suggestions from the filter model
- keep current geocoding and distance scoring in TypeScript
- support remote/hybrid/on-site preferences as diagnostics first

### Wave Construction and Candidate Selection

Current area:

- `createSearchWaves`
- `getWaveOnePriorityTerms`
- `queryMatchesPriorityTerms`
- `collectLinks`
- `selectBalancedSearchHits`
- `estimateSearchHitQuality`
- `selectWaveCandidates`
- wave loop inside `Deno.serve`

Needed change:

- align waves with filter strategy:
  - wave 1: core roles/tasks/domains + closest locations
  - wave 2: adjacent roles/domains
  - wave 3: broader fallback with clear confidence caps
  - wave 4: generic/exploratory only if not enough quality jobs
- prefer candidates with core task/domain evidence before generic support/admin candidates
- log wave-level leakage stats

### Scoring and Risk Caps

Current area:

- `scoreJob`
- `estimateSearchHitQuality`
- `hasProfileAlignedSignal`
- `isGenericJobWithoutProfileAnchor`
- `hasPerfectMatchSignals`
- `getRiskScoreCap`
- `getTechnicalRequirementMismatchSeverity`
- `hasProfileAvoidedSignal`
- `sortJobsForOutput`
- `getFinalJobsForOutput`
- `createScoreTooLowDiagnostics`

Needed change:

- add deterministic fit diagnostics before scoring:
  - `domainAlignment`
  - `taskAlignment`
  - `taskImportance`
  - `genericLeakageRisk`
  - `avoidTaskOverlap`
- use diagnostics first in logs, later as score modifiers/caps
- reduce generic support/admin/CRM/communication scoring when core task evidence is weak
- cap high scores for low domain/task alignment when CV has clear target domains/tasks

### API Response and Debug Logging

Current area:

- `Job` type fields
- `console.info("search-jobs run start")`
- `console.info("search-jobs wave collected")`
- `console.info("search-jobs wave summary")`
- `console.info("search-jobs score-too-low diagnostics")`
- final JSON response

Needed change:

- Phase 1 should only log diagnostics, not expose them broadly
- Phase 5 may add compact frontend-safe fields:
  - `fitDiagnostics`
  - `domainAlignmentLabel`
  - `taskAlignmentLabel`
  - `riskFlags`
  - `whyThisMatches`
  - `whyReview`

## Proposed Implementation Phases

### Phase 1: Logging/Diagnostics Only

Goal: no ranking behavior change.

Add TypeScript helpers that compute:

- CV domain profile
- CV task profile
- task importance hierarchy
- job domain profile
- job task profile
- domain/task alignment
- generic leakage risk
- avoid-task overlap

Use them only in:

- run summary logs
- wave summary logs
- score-too-low diagnostics
- internal job debug snapshots

Success criteria:

- no change to returned jobs or scores
- logs show why generic jobs rank high
- logs show task/domain alignment for top 25 and rejected jobs

### Phase 2: Query Generation/Filter Strategy

Goal: improve what jobs are searched, still with minimal scoring changes.

Implement:

- `buildCvDrivenFilterStrategy(profile)`
- CV-driven locations/radius
- core query generation
- adjacent query generation
- guarded generic fallback query generation

Modify:

- `getSearchQueries`
- `getSearchLocations`
- `createSearchWaves`

Success criteria:

- fewer generic fallback queries in wave 1
- wave 1 queries are explainably tied to CV core tasks/domains
- generic fallback remains available only when needed

### Phase 3: Scoring Adjustments

Goal: use diagnostics in ranking.

Modify:

- `estimateSearchHitQuality`
- `scoreJob`
- `getRiskScoreCap`
- `sortJobsForOutput`

Add:

- domain alignment contribution
- task alignment contribution
- core task bonus
- adjacent task smaller bonus
- generic leakage penalty
- avoid-task penalty/cap
- low domain/task alignment cap when CV target is clear

Success criteria:

- generic support/admin jobs do not tie core-task jobs in same domain
- avoid-task jobs are below stronger core/adjacent jobs
- no profile-specific industry bias appears in fixtures

### Phase 4: Wave Ranking/Candidate Selection

Goal: improve which candidates get detail fetching budget.

Modify:

- `estimateSearchHitQuality`
- `selectWaveCandidates`
- `selectBalancedSearchHits`
- wave break conditions in `Deno.serve`

Add:

- core/adjacent/generic candidate buckets
- max generic candidates per wave
- avoid-risk candidate deprioritization
- wave-level coverage tracking by domain/task/location

Success criteria:

- detail fetches are spent on better core/adjacent candidates
- fallback preview jobs do not crowd out stronger detailed jobs
- wave 4 generic fallback is rare and explainable

### Phase 5: Frontend Display Fields

Goal: expose explainable matching only after backend behavior is stable.

Add compact fields to returned `Job` objects:

- `fitLabel` remains
- `matchedKeywords` remains
- `missingKeywords` remains
- optional `fitDiagnostics`:
  - `domainAlignmentLabel`
  - `taskAlignmentLabel`
  - `coreTaskMatches`
  - `genericRisk`
  - `avoidWarnings`

Do not expose noisy internal weights.

## Risk Analysis

### Performance

Risk: deterministic catalogs and per-job diagnostics add CPU cost inside a time-limited Supabase Edge Function.

Mitigation:

- compute CV diagnostics once per run
- keep term catalogs compact
- compute detailed job diagnostics after text extraction, not during every HTML parse
- use cheap normalized text matching
- avoid remote calls

### Complexity

Risk: `search-jobs/index.ts` is already large and contains parsing, fetching, scoring, dedupe, geocoding, and response logic in one file.

Mitigation:

- implement helpers in small sections first
- avoid changing function signatures broadly in Phase 1
- add a single derived `fitModel` object passed to query/scoring helpers in later phases
- keep public API stable until Phase 5

### False Positives

Risk: task/domain catalogs may over-detect broad words like care, support, admin, communication, office, or CRM.

Mitigation:

- require role/task/domain evidence combinations for strong alignment
- use task specificity/depth
- cap generic-only matches
- treat generic overlap as supportive, not decisive

### Hardcoded Bias

Risk: fixed catalogs can accidentally encode "insurance good, banking bad" style behavior.

Mitigation:

- all positive/negative interpretation must be relative to CV target domains/tasks
- adjacent domains should not become full alignment by themselves
- avoid penalties require CV evidence
- add fixtures for banking/finance, HR, logistics, ambiguous CVs before major scoring rollout

### jobs.ch Scraping Fragility

Risk: search result parsing and detail extraction remain dependent on jobs.ch HTML structure.

Mitigation:

- do not add new scraping patterns in this integration
- keep diagnostics independent of scraping source
- make fallback-preview behavior stricter through diagnostics
- track whether a diagnostic came from preview text or full detail text

## What Should Remain In Supabase TypeScript For Now

Keep these in `search-jobs/index.ts` or nearby TypeScript helpers:

- jobs.ch query construction
- jobs.ch fetching
- HTML/link extraction
- JSON-LD extraction
- preview fallback handling
- dedupe
- geocoding and distance scoring
- final job scoring
- final API response
- deterministic domain/task matching
- logging diagnostics

Reason: this preserves deployment simplicity and avoids adding a Python runtime service before the behavior is proven.

## What Could Become A Python Service Later

Consider Python later for:

- offline evaluation and report generation
- fixture management
- batch regression testing
- weight calibration
- richer semantic task/domain classifiers
- model-assisted CV/job embeddings if ever needed
- analysis dashboards for ranking mistakes

Do not introduce this service until:

- TypeScript diagnostics are stable
- more fixtures exist
- real search outputs are saved and evaluated
- latency and deployment ownership are clear

## Data Model Sketch

Possible internal TypeScript types:

```ts
type CvFitModel = {
  targetDomains: string[];
  acceptableDomains: string[];
  weakFitDomains: string[];
  avoidDomains: string[];
  coreTasks: string[];
  adjacentTasks: string[];
  genericTasks: string[];
  avoidTasks: string[];
  filters: CvDrivenFilters;
  missingFilterInformation: string[];
};

type JobFitDiagnostics = {
  domainAlignmentScore: number;
  domainAlignmentType: string;
  matchingDomains: string[];
  adjacentDomains: string[];
  mismatchingDomains: string[];
  taskAlignmentScore: number;
  taskImportanceScore: number;
  coreTaskOverlap: string[];
  adjacentTaskOverlap: string[];
  genericTaskOverlap: string[];
  avoidTaskOverlap: string[];
  taskSpecificityScore: number;
  taskDepthScore: number;
  genericTaskShare: number;
  genericLeakageRisk: number;
};
```

Do not expose these exact structures to the frontend until Phase 5.

## Recommended Next Action

Implement partially.

Start with Phase 1 only:

1. Add TypeScript diagnostic helpers for CV/job domain and task profiles.
2. Compute diagnostics for top jobs and rejected low-score jobs.
3. Log aggregate leakage stats without changing scores.
4. Run real `search-jobs` output through `python/evals/run_eval.py`.
5. Only then move to Phase 2 query/filter strategy.

Do not implement Phase 3 scoring changes yet. The diagnostics are ready to specify scoring, but production ranking changes should wait until the TypeScript diagnostics have been compared against the five current fixtures plus at least a banking/finance CV and an ambiguous CV.
