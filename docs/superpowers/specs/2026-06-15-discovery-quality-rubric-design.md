# Discovery Quality Rubric + Research-Augmented Deep Analysis — Design

> Status: approved design (2026-06-15). Next: implementation plan via writing-plans.

## Goal

Make the Discovery Scanner judge affiliate-program quality at a standard a **very
advanced affiliate** would trust. Today the deep-analysis stage uses a thin,
generic prompt ("commission clarity, category momentum, credibility") that
misjudged quality — e.g. it surfaced a directory page (affiliate.watch) as a
legitimate offer. This design replaces that with an expert-grade rubric and a
research-augmented analysis that fills missing data before scoring, so the
system does not misjudge what a real, good program is.

## Background / current state

- Discovery v1 funnel: web-search discovery → Haiku triage (keep ≥55, now also
  rejects directories/listicles) → single thin Sonnet "deep" call on the top
  survivors → admin approve → offer. (`supabase/functions/discover-offers/`,
  `_shared/orchestrators/discoveryTriage.ts`, `discoveryDeep.ts`.)
- The mature quality model already lives in **UnderwritingOrchestrator**
  (`prompts/underwriting/v3.md`): 13 scored dimensions + hard rules. Discovery
  must speak the SAME language so a program's discovery verdict and its later
  underwriting verdict never contradict.

## Decisions (locked during brainstorming)

1. **Four hard filters, all binding** — economics/EPC, paid-traffic allowance,
   monetization integrity (no shaving / pays on time), scale ceiling.
2. **Unknown hard-filter data → automatic deep research** (targeted follow-up
   searches) to resolve it, rather than rejecting or guessing.
3. **Full research on ALL triage survivors** (not just a top slice).

## The rubric: "a real and good affiliate program"

### Gate 0 — Legitimacy (must pass to be a candidate at all)
- A SINGLE advertiser's own affiliate/partner program you can actually join —
  in-house or via a named network (Impact, PartnerStack, CJ, ShareASale, Awin,
  Rakuten, ClickBank, Tune, …).
- NOT a directory / listicle / review / blog / forum / news page (the triage
  stage enforces this).
- A real operating business with a live product sits behind it.
- Failing Gate 0 → rejected, never surfaced.

### The 4 hard filters
Resolution rule for each: **confirmed-bad → disqualify** (low score, not
recommended); **unknown from the page → resolve via research**; **still unknown
after research → cap the score and flag `unknown_verify`** ("verify before
budget"), never silently pass.

| # | Hard filter | What "good" means | Underwriting dimension(s) |
|---|---|---|---|
| 1 | **Economics / EPC potential** | payout × realistic CVR × AOV → competitive EPC; recurring/lifetime rev-share is a strong positive; trivial payout on a cheap product fails | `economics`, `high_ceiling_potential` |
| 2 | **Paid-traffic allowance** | permits the paid channels a media buyer uses (paid social, search, native); brand-bidding + direct-link policy noted; all-paid-forbidden fails | traffic rules, `compliance` |
| 3 | **Monetization integrity** | sane net terms (net-30/60), reasonable minimum payout, real payout methods, and NO reputation for shaving/scrubbing or late/non-payment | `offer_trust`, `cashflow_fit` |
| 4 | **Scale ceiling** | no punitive cap; advertiser can absorb real volume; category demand supports $10K+/mo for a top operator | `scale_potential`, `demand` |

### Scoring factors (move the 0-100 score; not deal-breakers)
Cookie window / attribution model; market demand & momentum (`demand`);
competition / saturation — is it "burned"? (`competition`); funnel / conversion
quality of the advertiser's own page (`funnel_fit`); creative / angle
opportunity & differentiation (`creative_opportunity`); compliance / platform
risk (`compliance`); advertiser trust / longevity / community reputation
(`offer_trust`); execution complexity (`execution_complexity`).

### Per-vertical nuance
Compliance weight and hard-rule strictness adapt per vertical (health /
mental_wellness → compliance weighted up, mirroring underwriting's
vertical-routed prompts and the `human_review_required` rule).

### Output per candidate (deep-analysis payload)
- `overall_score` 0-100
- `hard_filters`: for each of the 4 — `{ status: 'pass'|'fail'|'unknown_verify', evidence: string, source_url: string|null }`
- `must_verify_before_budget`: string[] (the unresolved items)
- `recommended`: boolean — true only if all 4 hard filters are `pass` AND `overall_score` ≥ 55 (matches the existing run-page `RECOMMENDED_MIN_SCORE` gate)
- `estimated_epc_band`: string|null (e.g. "$0.50–1.50 EPC est.") when derivable
- `network`: string|null (Impact / PartnerStack / in-house / …)
- `summary`, `key_strengths`, `key_risks` (kept from today's payload)

## Architecture: research-augmented deep analysis

Replace the single thin Sonnet call with a 3-step process **per triage
survivor** (runs on all of them):

1. **Fetch** the candidate's program/affiliate page (existing fetch+strip).
2. **Gap-fill research** — a Sonnet step identifies which of the 4 hard filters
   are unresolved from the page text, then the orchestrator runs targeted
   web searches (reusing the Tavily adapter) and fetches the top result pages:
   - `<program> affiliate program terms commission payout`
   - `<program> affiliate review does it pay / shaving`
   - `<advertiser> affiliate paid traffic / brand bidding policy`
   - network detection (which network hosts the program)
   Bounded: up to ~3 follow-up searches and ~3 fetched result pages per
   candidate, to contain cost and latency.
3. **Score** — a final Sonnet call scores against the rubric and emits the
   structured payload above.

Each AI call and each search is recorded (cost visible in the run's
`total_cost_usd` and in `ai_runs`). The strict triage keeps the survivor count
low, which bounds the cost of "research on all survivors".

### Funnel + UI changes
- Funnel label: Discovered → Passed triage → **Researched & scored** → Approved.
- Run page: per candidate, show the 4 hard-filter verdicts (pass/fail/verify)
  with evidence, the `must_verify_before_budget` list, the estimated EPC band,
  and the network — expert-grade transparency. Keep the existing "Top
  candidates / low-confidence / dropped" split, now driven by `recommended` +
  score.

### Data
- `discovery_candidates.deep_analysis` (existing jsonb) holds the richer payload
  — no schema change required (the column is untyped jsonb). The dual Zod
  contracts (`src/types/agents/discovery.ts` + `_shared/types/discovery.ts`)
  get the expanded `DeepAnalysis` schema and stay in sync.
- A new prompt version for the deep stage (`prompts/discovery_deep/v2.md`)
  encoding the rubric; the triage prompt (`discovery_triage`) already rejects
  non-programs and stays.

## Alignment with underwriting
The rubric is the underwriting 13-dimension model applied at discovery time with
research to fill gaps. The deep prompt reuses underwriting's vocabulary and
hard-rule philosophy so the two stages are consistent, not two competing
definitions of "good".

## Out of scope (future)
- Directory-as-source extraction (mining a page like affiliate.watch for its
  listed programs) — separate Phase-2 feature.
- Affiliate-network API adapters (Impact/CJ via keys).
- Scheduled auto-scans.
- Re-running research on already-approved offers.

## Success criteria
- A directory/listicle never reaches "recommended".
- A surfaced "recommended" candidate has all 4 hard filters resolved to `pass`
  with evidence, or is clearly flagged with `must_verify_before_budget`.
- The discovery score and a subsequent underwriting verdict on the same offer
  are directionally consistent.
- Cost per scan stays bounded (a few dollars) thanks to strict triage.
