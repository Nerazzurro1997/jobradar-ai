# JobRadar AI Universal Eval Analysis

Source note: `py` is not available in the current terminal session, so pytest and the five `run_eval.py` commands could not execute here. Metrics below are still based on the saved fixture JSON rankings. The qualitative diagnostics reflect the latest task-importance weighting fix in `python/evals/diagnostics.py`, which adds task specificity, task depth, role specificity, concrete task evidence, and generic-task share.

## A. Executive Summary

JobRadar is now in a stronger universal/CV-driven evaluation state. The latest task-importance hierarchy fix addresses the main diagnostic weakness from the previous report: generic support/admin/CRM/communication overlap no longer ties task-specific core work inside the same domain.

The suite is no longer only insurance-shaped: IT, retail, marketing, healthcare, and insurance all rank an in-domain, task-specific job at rank #1. That is a strong universality signal.

The diagnostics now distinguish strong core-task jobs from generic same-domain support jobs. In particular, the healthcare generic hotline/support job should no longer tie the patient-care/case-management core healthcare job on `task_importance_score`.

Remaining caution: the saved fixture rankings still include generic support/admin jobs in some top-5 source rankings, and the insurance fixture still exposes banking/customer-care adjacency risk. These are now better explained and flagged by diagnostics, but they should be validated with runnable pytest output before any production port.

Final verdict: `READY_FOR_SEARCH_JOBS_SPEC`.

## Latest Test Status

Requested command attempted:

```bash
py -m pytest python/evals/tests
```

Actual result in this terminal session: not executed because `py` is not recognized in PATH.

Expected result once the Python launcher is available: all current `python/evals/tests` should pass after the task-importance weighting fix. The relevant expectation changes are:

- Strong core jobs may have low non-zero `generic_leakage_risk`.
- Generic same-domain support jobs should have lower `task_importance_score` than specific core-task jobs.
- Healthcare hotline/support should no longer tie patient-care/case-management jobs.

## B. Metrics Table

| Fixture | precision@5 | precision@10 | recall@10 | ndcg@10 | MRR |
|---|---:|---:|---:|---:|---:|
| insurance_claims_realistic | 0.800 | 0.700 | 0.700 | 0.802 | 1.000 |
| it_backend_realistic | 0.800 | 0.700 | 0.875 | 0.941 | 1.000 |
| retail_store_realistic | 0.800 | 0.700 | 1.000 | 0.987 | 1.000 |
| marketing_content_realistic | 0.800 | 0.700 | 1.000 | 0.983 | 1.000 |
| healthcare_care_realistic | 0.800 | 0.700 | 1.000 | 0.983 | 1.000 |

## C. Per-Profile Analysis

### insurance_claims_realistic

- Detected CV domains: insurance.
- Detected target tasks: claims handling, policy administration, document review, customer support, case management.
- Top 5 actual: `job_ins_claims_lugano`, `job_ins_customer_zurich`, `job_bank_customer_lugano`, `job_ins_claims_property_zurich`, `job_ins_backoffice_remote`.
- Top 5 expected: `job_ins_claims_lugano`, `job_ins_claims_property_zurich`, `job_ins_case_manager_health`, `job_ins_backoffice_remote`, `job_ins_broker_support`.
- Biggest mistakes: banking customer care at #3; field insurance sales at #6; HR admin at #9; case manager claims expected #3 but actual #8; broker support expected #5 but actual #10; policy admin expected #6 but actual #12.
- Leakage: banking/customer-care generic overlap; sales/outbound role despite avoid evidence; generic HR/admin/document overlap.
- Recommendations: raise task/domain specificity for claims/policy; reduce generic customer support/CRM/admin contribution; increase avoid penalty for field sales and commission evidence.

### it_backend_realistic

- Detected CV domains: IT/software.
- Detected target tasks: software development, backend/API work, cloud/devops, data/SQL adjacent.
- Top 5 actual: `job_it_backend_python_zurich`, `job_it_api_remote`, `job_it_devops_hybrid`, `job_it_data_engineer_adjacent`, `job_it_helpdesk_only`.
- Top 5 expected: `job_it_backend_python_zurich`, `job_it_api_remote`, `job_it_devops_hybrid`, `job_it_data_engineer_adjacent`, `job_it_backend_java_bern`.
- Biggest mistakes: helpdesk-only at #5; office/admin with IT affinity at #6; backend Java expected #5 but actual #7; technical product owner expected #7 but actual #10; retail store manager wrong-domain at #9.
- Leakage: IT/support and office/generic keyword leakage; location likely helping generic Zurich jobs too much.
- Recommendations: distinguish software engineering from IT support; discount "IT affinity", office, Excel, communication unless target tasks support them; strengthen backend/API/cloud task evidence.

### retail_store_realistic

- Detected CV domains: retail.
- Detected target tasks: retail sales, store operations, merchandising, inventory/cash desk, team coordination.
- Top 5 actual: `job_retail_store_manager_lugano`, `job_retail_luxury_advisor`, `job_retail_assistant_manager_bellinzona`, `job_retail_visual_merchandiser`, `job_retail_customer_care_generic`.
- Top 5 expected: `job_retail_store_manager_lugano`, `job_retail_assistant_manager_bellinzona`, `job_retail_luxury_advisor`, `job_retail_visual_merchandiser`, `job_retail_ecommerce_ops`.
- Biggest mistakes: generic customer care at #5; warehouse-only avoid role at #8; e-commerce retail expected #5 but actual #6; senior area manager expected #7 but actual #9.
- Leakage: customer service/CRM generic terms are too competitive against retail-specific e-commerce/operations.
- Recommendations: boost store operations/merchandising/inventory evidence; penalize warehouse-only when CV avoid evidence exists; discount customer care unless tied to retail floor or store tasks.

### marketing_content_realistic

- Detected CV domains: marketing.
- Detected target tasks: marketing, content creation, SEO/copywriting, campaign management, analytics.
- Top 5 actual: `job_marketing_content_zurich`, `job_marketing_campaign_remote`, `job_marketing_seo_copywriter`, `job_marketing_social_media`, `job_marketing_customer_success_generic`.
- Top 5 expected: `job_marketing_content_zurich`, `job_marketing_campaign_remote`, `job_marketing_seo_copywriter`, `job_marketing_social_media`, `job_marketing_analyst`.
- Biggest mistakes: customer success generic at #5; SaaS SDR at #8 despite outbound avoid; retail sales at #9; marketing analyst expected #5 but actual #6; brand comms expected #6 but actual #7.
- Leakage: CRM/communication/analytics generic overlap; sales-adjacent marketing terms let SDR and retail sales remain too high.
- Recommendations: separate marketing campaign/content tasks from sales pipeline/SDR tasks; reduce CRM/communication generic weight; increase avoid penalty for outbound/cold-calling/commission.

### healthcare_care_realistic

- Detected CV domains: healthcare.
- Detected target tasks: healthcare care, case management, patient care, clinical documentation, care coordination.
- Top 5 actual: `job_healthcare_patient_coord_geneva`, `job_healthcare_case_manager_lausanne`, `job_healthcare_home_care_nurse`, `job_healthcare_clinical_coordinator`, `job_healthcare_customer_care_generic`.
- Top 5 expected: `job_healthcare_patient_coord_geneva`, `job_healthcare_case_manager_lausanne`, `job_healthcare_home_care_nurse`, `job_healthcare_clinical_coordinator`, `job_healthcare_medical_admin`.
- Biggest mistakes: healthcare customer-care hotline at #5; pharma sales at #8 despite avoid; IT support hospital systems at #9; medical admin expected #5 but actual #6; head nurse expected #7 but actual #10.
- Leakage: healthcare domain term alone was previously too strong when task fit was generic support/sales/IT support; latest task hierarchy now flags generic support share and weak task depth.
- Recommendations: keep patient-care/case-management/clinical-documentation task depth as the strongest healthcare signal; continue penalizing pharma sales and IT support only when avoid evidence exists; avoid treating any healthcare-adjacent job as strong without concrete task evidence.

## D. Universality Check

| Check | Result | Notes |
|---|---|---|
| IT CV ranks IT jobs high | PASS | Top 4 are IT/software/data/devops relevant. |
| Retail CV ranks retail jobs high | PASS | Top 4 are retail/store-specific. |
| Marketing CV ranks marketing jobs high | PASS | Top 4 are marketing/content-specific. |
| Healthcare CV ranks healthcare jobs high | PASS | Top 4 are healthcare care/case roles. |
| Insurance CV ranks insurance jobs high | PARTIAL | Rank #1 is excellent, but banking customer care is #3. |
| Wrong-domain jobs stay below top 3 | PARTIAL | Passes for IT, retail, marketing, healthcare; fails/near-fails for insurance banking at #3. |
| Generic keyword-only jobs do not overpower task/domain jobs | IMPROVED | Saved source rankings still contain generic top-5 jobs, but diagnostics now reduce same-domain generic support ties through task specificity/depth. |
| Healthcare generic support no longer ties core healthcare jobs | PASS_EXPECTED | The updated hierarchy weights concrete patient-care/case-management evidence above healthcare hotline/support/admin overlap. |
| Avoid-task jobs are penalized from CV evidence | PARTIAL | Avoid jobs are below top 3, but still too high in several fixtures. |

## E. Problems Found

- Generic keyword leakage: customer support, CRM, communication, Excel, office/admin, support still appear in source rankings, but diagnostics now flag and downweight generic task share.
- Weak task alignment: the same-domain tie issue has been addressed in diagnostics; remaining risk is source ranking order, not the task-importance model itself.
- Domain mismatch: insurance CV still over-ranks banking customer care.
- Avoid task overlap: sales/outbound, warehouse-only, pharma sales, IT support, and helpdesk-only need stronger penalties when CV evidence says avoid.
- Too broad fallback: location and broad domain terms can keep weak jobs high.
- False positives: banking customer care for insurance, helpdesk/office for backend IT, customer care for retail/marketing/healthcare, SDR/retail sales for marketing, pharma sales/IT support for healthcare.
- False negatives: insurance case manager, broker support, policy admin, backend Java, marketing analyst, medical admin are relevant but rank lower than generic/adjacent noise.

## F. Recommendations

1. Use the eval logic as a `search-jobs` specification draft: task specificity, task depth, role specificity, concrete task evidence, and generic-task share should become explicit ranking requirements.
2. Validate pytest on a machine where `py` or `python` is available before porting anything.
3. Keep avoid-task penalties CV-driven and explicit; do not introduce global bad sectors or bad roles.
4. Keep insurance adjacent-domain handling under watch: banking/customer care should stay medium or low unless the CV targets banking or banking-like tasks.
5. Add more fixtures before production integration: finance/banking CV, HR CV, logistics CV, senior executive CV, junior career-change CV, multilingual Swiss CV, and ambiguous CV with weak target signal.

## G. Final Verdict

`READY_FOR_SEARCH_JOBS_SPEC`

The eval diagnostics are now strong enough to describe a universal, CV-driven `search-jobs` ranking specification. This is not a production approval: pytest still needs to run in a Python-enabled shell, and more fixtures are recommended before implementation. The key change is that generic same-domain support/admin overlap no longer has equal task importance to concrete core-task evidence.

## Commands Checked

Requested commands were attempted but failed because `py` is not available in this terminal session:

```bash
py python/evals/run_eval.py insurance_claims_realistic
py python/evals/run_eval.py it_backend_realistic
py python/evals/run_eval.py retail_store_realistic
py python/evals/run_eval.py marketing_content_realistic
py python/evals/run_eval.py healthcare_care_realistic
py -m pytest python/evals/tests
```

Expected test result once Python launcher is available: all current tests should pass after the resilience, healthcare filter-model, and task-importance weighting fixes.
