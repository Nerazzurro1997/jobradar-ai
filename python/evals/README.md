# JobRadar AI Python Evals

Questa cartella contiene un laboratorio locale minimo per valutare la qualita del ranking jobs. Non chiama OpenAI, non chiama jobs.ch, non fa scraping e non e collegata al deploy.

## Struttura

```text
python/evals/
  fixtures/
    insurance_claims_realistic/
      cv_profile.json
      jobs.json
      expected_ranking.json
    cv_profiles/
    jobs/
    expected_rankings/
  tests/
  diagnostics.py
  evaluation.py
  filter_model.py
  metrics.py
  run_eval.py
  README.md
```

Il formato standard per i nuovi scenari e un bundle con tre file:

- `cv_profile.json`: profilo CV anonimo usato come input logico del test.
- `jobs.json`: ranking salvato localmente, in ordine, copiabile da un output di `search-jobs` oppure scritto a mano come fixture.
- `expected_ranking.json`: job attesi e soglie minime di qualita.

## Installazione dipendenze

Da root del repository:

```bash
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install pytest
```

Dipendenze opzionali per evoluzioni future:

```bash
python -m pip install pydantic numpy
```

## Lanciare i test

Da root del repository:

```bash
python -m pytest python/evals/tests
```

Su Windows puoi usare anche il comando richiesto dal workflow del progetto:

```bash
py -m pytest python/evals/tests
```

## Eseguire una valutazione

Da root del repository:

```bash
py python/evals/run_eval.py insurance_claims_realistic
```

Output principale:

- `precision@5`
- `precision@10`
- `recall@10`
- `ndcg@10`
- `mean reciprocal rank`

Il runner stampa anche top 10 reale, top 10 attesa e differenze principali.

La sezione diagnostica spiega per ogni job valutato:

- `domain alignment`
- `task alignment`
- `role match`
- `keyword match`
- `location fit`
- `distance fit`
- `sales/outbound penalty`
- `generic keyword risk penalty`
- `generic task risk penalty`
- `low domain alignment penalty`
- `avoid task overlap penalty`
- `weak detail penalty`

Ogni segnale mostra forza, evidenza e contributo pesato. Il totale diagnostico e solo uno strumento locale di spiegazione: non replica lo scoring di produzione.

## Profili multi-CV

La suite include fixture realistiche per piu profili, cosi JobRadar resta universale e non ottimizzato solo sul caso assicurativo:

- `insurance_claims_realistic`
- `it_backend_realistic`
- `retail_store_realistic`
- `marketing_content_realistic`
- `healthcare_care_realistic`

Ogni bundle contiene:

- match forti
- match adiacenti
- falsi positivi basati su keyword generiche
- job wrong-domain
- varieta di location/distanza
- varieta di workload
- varieta di seniority
- varieta remote/hybrid/on-site

I test multi-profilo verificano:

- `precision@5`
- `precision@10`
- top 1 rilevante
- wrong-domain non in top 3
- avoid-task sotto un job specifico per task/dominio
- keyword-only generico sotto un job specifico per task/dominio

## Universal CV-driven filter model

`filter_model.py` genera una strategia di filtri locale, ispirata ai filtri jobs.ch ma guidata solo dal CV. Non e codice di produzione e non impone nessun filtro globale.

Filtri prodotti:

- keyword queries
- role categories
- professional field/category
- location/home base
- radius suggestions
- remote/hybrid/on-site preference
- workload percentage preference
- seniority level
- language requirements
- salary expectation, se presente
- target domains
- target task groups
- avoid domains/tasks
- must-have skills
- nice-to-have skills
- company/industry preferences, se presenti

Ogni filtro ha:

- `value`
- `confidence`
- `status`, cioe `detected` oppure `missing`
- `evidence`

Se una informazione non appare nel CV, il filtro resta `missing`: la suite non inventa default fissi. Per esempio, se non c'e salario atteso nel CV, `salary_expectation` rimane mancante.

## CV incompleti e fallback diagnostico

Le diagnostiche sono pensate per tollerare CV parziali o export incompleti. Campi mancanti, `null`, liste vuote o sezioni non inferite non devono causare crash.

Helper disponibili in `diagnostics.py`:

- `normalize_optional_collection(...)`
- `safe_list(...)`
- `safe_set(...)`
- `safe_dict(...)`

Comportamento atteso:

- se mancano target domains, la diagnostica usa `soft_mismatch_unclear_cv_domain` o `unknown_job_domain` invece di applicare una penalita dura.
- se mancano target tasks, la diagnostica usa `soft_task_mismatch_unclear_cv_tasks` o `unknown_job_tasks`.
- se mancano skill, avoid terms o ruoli target, i segnali corrispondenti restano a bassa confidenza.
- se mancano filtri nel CV, `filter_model.py` marca quei filtri come `missing` e li elenca in `missing_filter_information`.
- le raccomandazioni simulate aumentano penalita forti solo quando il CV contiene evidenza chiara.

Il runner stampa anche una strategia a onde:

- wave 1: ruoli piu forti + location piu vicine
- wave 2: ruoli/domini adiacenti supportati dal CV
- wave 3: fallback piu ampio
- wave 4: esplorativo/generico solo se serve, con guardrail avoid

## Universal domain alignment

La diagnostica non considera nessun settore globalmente buono o cattivo. Prima legge il CV e prova a dedurre:

- target domains
- acceptable domains
- weak-fit domains
- avoid domains

Poi legge ogni job e deduce i job domains da titolo, azienda, descrizione, snippet, keyword, requisiti e segnali di ruolo. Il confronto restituisce:

- `domain_alignment_score`
- `alignment_type`
- `dominant_alignment_reason`
- `matching_domains`
- `adjacent_domains`
- `mismatching_domains`
- `generic_overlap_ratio`
- `generic_keyword_risk`

`alignment_type` distingue:

- `exact_domain_alignment`: stesso dominio primario tra CV e job.
- `strong_role_task_alignment`: dominio sostanziale rinforzato da forte evidenza ruolo/task/skill.
- `adjacent_domain_alignment`: dominio adiacente rinforzato da evidenza di ruolo o task.
- `weak_adjacent_alignment`: dominio adiacente senza abbastanza rinforzo.
- `generic_overlap_only`: solo overlap su keyword generiche o funzioni trasversali.
- `domain_mismatch`: dominio job non allineato a un CV con target chiaro.

Keyword generiche come `customer support`, `CRM`, `office`, `admin` e `communication` non possono creare full alignment da sole.

Esempi di comportamento atteso:

- CV insurance + job insurance: buon match dominio.
- CV banking + job banking: buon match dominio.
- CV retail + job retail: buon match dominio.
- CV IT + job IT: buon match dominio.
- CV insurance + job banking customer care: dominio adiacente o generic overlap, non full alignment, perche banking/customer care non equivalgono automaticamente a insurance claims.

Il leakage report e generico:

- jobs ranking high despite low domain alignment
- jobs ranking high mainly because of generic keywords
- jobs ranking high despite weak role/domain fit

Le weight recommendations sono simulate e locali:

- aumentare peso domain alignment
- ridurre peso keyword generiche
- aumentare penalita low-domain solo quando il CV ha un target domain chiaro

## Universal task alignment

La diagnostica costruisce anche un profilo task del CV e di ogni job. I task group sono etichette neutrali, non giudizi globali:

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

Il confronto task restituisce:

- `task_alignment_score`
- `matching_tasks`
- `adjacent_tasks`
- `mismatching_tasks`
- `avoid_task_overlap`
- `generic_task_overlap_ratio`
- `task_specificity_score`

La diagnostica costruisce inoltre una gerarchia universale di importanza task, sempre derivata dal CV:

- `core_tasks`: lavoro target principale, derivato da ruoli target, ruoli correnti/passati, keyword forti, skill e highlight.
- `adjacent_tasks`: task correlati ma non primari, derivati da ruoli accettabili/deboli e target secondari.
- `generic_tasks`: task utili ma broad/supportivi, come CRM, office, communication o customer support quando non sono core espliciti del CV.
- `avoid_tasks`: task da evitare, derivati solo da `avoidKeywords`, `dealBreakers` o campi analoghi del CV.

Per ogni job vengono mostrati:

- `core_task_overlap`
- `adjacent_task_overlap`
- `generic_task_overlap`
- `avoid_task_overlap`
- `task_importance_score`
- `generic_leakage_risk`
- `task_importance_reason`

Regole principali:

- Task generici come `communication`, `office`, `CRM`, `admin`, `customer support`, lingue ed `Excel` non dominano a meno che il CV li renda chiaramente task target.
- I task avoid vengono rilevati solo da evidenza nel CV, per esempio `avoidKeywords` o `dealBreakers`.
- Nessun task e globalmente buono o cattivo: `customer support` e forte per un CV customer support, ma puo essere rumore per un CV claims specialist se manca overlap task/ruolo specifico.
- `core_task_overlap` pesa piu di `adjacent_task_overlap`; `generic_task_overlap` resta debole se non e rinforzato da core/adjacent; `avoid_task_overlap` viene segnalato con forza solo quando deriva dal CV.

Il task leakage report aggiunge:

- jobs ranking high despite weak task alignment
- jobs ranking high mainly because of generic tasks
- jobs ranking high despite avoid-task overlap
- jobs ranking high mostly due to generic tasks
- jobs ranking above more specific core-task jobs
- jobs with avoid-task overlap still too high

Le task recommendations simulate possono suggerire:

- aumentare peso task alignment se esiste task leakage
- aumentare peso core task se job generici superano job con core-task overlap
- ridurre peso task generici se dominano
- richiedere evidenza core o adjacent task per entrare in top 5 quando il CV ha target chiari
- aumentare penalita avoid task solo quando l'avoid deriva da evidenza CV

## Workflow export/import

1. Esporta una risposta reale di `search-jobs` come JSON, senza lanciare scraping o chiamate dalla suite Python.
2. Salvala come fixture:

```bash
py python/evals/run_eval.py insurance_claims_realistic --import-results C:\path\to\search-jobs-output.json
```

3. Rilancia l'eval quando aggiorni `expected_ranking.json` o `jobs.json`:

```bash
py python/evals/run_eval.py insurance_claims_realistic
```

## Aggiungere nuovi CV test

1. Crea una nuova cartella in `fixtures/`, per esempio `fixtures/insurance_claims_ticino/`.
2. Aggiungi `cv_profile.json` con dati anonimi e senza informazioni personali reali.
3. Aggiungi `jobs.json` con i job da valutare, gia ordinati come sono usciti dal ranking.
4. Aggiungi `expected_ranking.json` con:
   - `profile_id`
   - `expected_top_job_ids`
   - `relevant_job_ids`
   - `graded_relevance`, opzionale ma utile per `ndcg_at_k`
   - `minimum_precision_at_k`, per esempio `{ "5": 0.8, "10": 0.7 }`
   - `sanity_checks`, con `wrong_domain_job_id`, `avoid_task_job_id`, `generic_keyword_only_job_id` e `task_domain_specific_job_id`
5. Aggiungi o estendi un test in `tests/` che chiami `load_fixture_bundle(...)`, `compare_rankings(...)` e, se serve, `build_filter_strategy(...)`.

Per definire un expected ranking:

- metti nei primi posti i job che un reviewer umano considera migliori per quel CV.
- tieni `relevant_job_ids` piu largo della top 10 se vuoi misurare recall.
- usa `graded_relevance` con 3 per match forti, 2 per match buoni/adiacenti, 1 per match deboli ma accettabili.
- marca i falsi positivi nel blocco `sanity_checks`, cosi i test proteggono il comportamento universale.

Per lanciare tutti i profili:

```bash
py -m pytest python/evals/tests
```

Per leggere un singolo profilo con metriche, ranking, diagnostica dominio/task e filtri CV-driven:

```bash
py python/evals/run_eval.py it_backend_realistic
py python/evals/run_eval.py retail_store_realistic
py python/evals/run_eval.py marketing_content_realistic
py python/evals/run_eval.py healthcare_care_realistic
```

Questa impostazione aiuta a tenere JobRadar universale perche ogni nuovo CV porta i propri target domain, target task, avoid term e guardrail. Nessun settore, ruolo o task diventa globalmente buono o cattivo: il giudizio resta relativo all'evidenza nel CV.

## Salvare nuovi jobs

Per confrontare risultati reali di JobRadar AI senza chiamate live dal laboratorio:

1. Esegui normalmente `search-jobs` fuori da questa suite.
2. Salva la risposta JSON localmente come `fixtures/<nome_scenario>/jobs.json`.
3. Se il payload contiene `{ "jobs": [...] }`, puoi salvarlo intero: `load_fixture_bundle(...)` estrarra automaticamente l'array.
4. Per ID stabili usa, in ordine di preferenza:
   - `eval_id`, aggiunto solo nella fixture locale se serve
   - `job_id` o `jobId`
   - `id` se e una stringa stabile
   - `url` se l'id numerico e solo l'ordine del run

`normalize_job_ids(...)` gestisce array di job, array di ID e payload con chiave `jobs`.

Puoi anche importare un export JSON gia salvato:

```bash
py python/evals/run_eval.py insurance_claims_realistic --import-results C:\path\to\search-jobs-output.json
```

Questo copia il payload in `python/evals/fixtures/insurance_claims_realistic/jobs.json` e poi esegue subito la valutazione.

Helper disponibili:

```python
from evaluation import load_search_results, save_search_results

payload = load_search_results("insurance_claims_realistic")
save_search_results(payload, "insurance_claims_realistic")
```

## Leggere le metriche

`compare_rankings(...)` restituisce:

- `actual_ranking`: ID normalizzati nel ranking reale.
- `expected_relevant_ids`: ID attesi normalizzati.
- `metrics`: valori come `precision_at_5`, `precision_at_10`, `recall_at_10`, `ndcg_at_10` e `mean_reciprocal_rank`.

Esempio:

```python
from evaluation import compare_rankings, load_fixture_bundle

bundle = load_fixture_bundle("insurance_claims_realistic")
report = compare_rankings(bundle["jobs"], bundle["expected_ranking"], ks=(5, 10))

print(report["metrics"]["precision_at_5"])
print(report["metrics"]["precision_at_10"])
```

## Fixture legacy

1. Aggiungi un profilo anonimo in `fixtures/cv_profiles/`.
2. Aggiungi un set di job finti in `fixtures/jobs/`.
3. Aggiungi un ranking manuale in `fixtures/expected_rankings/` con:
   - `profile_id`
   - `relevant_job_ids`
   - `graded_relevance`, opzionale ma utile per `ndcg_at_k`
   - `ideal_ranking`
4. Crea o estendi un test in `tests/` che carichi le fixture e calcoli le metriche.

## Metriche disponibili

- `precision_at_k`: quota dei risultati top-k che sono rilevanti.
- `recall_at_k`: quota dei job rilevanti trovati nei top-k.
- `ndcg_at_k`: ranking quality con sconto per posizione, binaria o graduata.
- `mean_reciprocal_rank`: media della prima posizione rilevante su una o piu query.
