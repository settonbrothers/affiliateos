# Discovery v2 — Concrete-Offer Unit + Multi-Signal Deep Research — Design

> Status: approved design (2026-06-16). Next: implementation plan (Phase A first) via writing-plans.

## Goal

Make the scanner surface only **concrete, individual affiliate offers** (one
advertiser + one product) — never affiliate networks, directories, or listicles
— at the volume and quality an advanced affiliate needs: scan many offers
(target hundreds-to-1000+), mine the places that aggregate them, and enrich each
survivor with the signals a media buyer actually uses (where it pays most, proof
it's run at scale, demand trend, funding momentum) before scoring against the
hard-filter rubric.

## Background / current state

- Discovery v1 + the quality rubric are live: web-search → Haiku triage (rejects
  directories/listicles) → research-augmented Sonnet deep analysis (4 hard
  filters) → admin approve → offer.
- Two quality failures observed in testing: (1) a real scan surfaced an
  **affiliate network** (a container of many offers) as if it were one offer;
  (2) generic "best X programs" queries return listicles, which the rubric
  correctly rejects — so a normal scan found ~20 candidates and 0 recommended.
- Root cause: the unit of discovery is "a web page", and the queries surface
  aggregators, not individual program pages.

## Locked decisions (from brainstorming)

1. **Unit = a concrete offer.** Networks, directories, listicles, aggregators are
   never surfaced as the unit — they are *mined* for the offers inside them.
2. **Sources now:** free/public (Google Trends proxy, news/funding, web search)
   + public marketplaces (ClickBank/Digistore: product listings + gravity).
   **Later (same adapter seam):** affiliate-network APIs (CJ/Impact/PartnerStack),
   paid spy tools, Meta Ad Library.
3. **#4 proof-of-scale = proxy signals now** (affiliate-review mentions, active
   affiliate recruiting, marketplace gravity); real ad-intel later.
4. **Verticals are expandable** (vertical is a parameter; adding one = adding its
   query templates + compliance rules) — but quality comes first; we don't
   broaden recklessly.
5. **Cost:** triage (Haiku) on all 1000+ (cheap); full deep-research on the top
   survivors by triage score (default cap ~50); soft per-scan cost ceiling.

## The model

- **Candidate = a concrete offer:** a single advertiser's own program (in-house
  or via a named network) OR a single product listing on a marketplace. It is
  something you can sign up to promote and get a tracked link for.
- **Gate 0 (legitimacy) — expanded:** reject as the unit anything that is a
  *container* — an affiliate **network/marketplace itself** (ClickBank the
  platform, Impact, PartnerStack), a **directory/review/comparison site**, a
  **listicle/roundup**, a blog/forum/news page. These are inputs to mine, not
  offers to surface.

## Sources & adapters

A source adapter returns raw concrete-offer candidates. Three kinds now:

1. **web_search** (existing, improved queries): individual-program-page-oriented
   queries + sub-niche/network/modifier expansion for volume.
2. **marketplace** (new, public): ClickBank/Digistore public marketplace —
   each product is a candidate; gravity/popularity is captured as a
   proof-of-scale signal.
3. **container mining** (new): when discovery hits a container page (directory /
   listicle / network landing / "top N" post), a cheap LLM step **extracts the
   individual offers listed inside** (name + link). Each extracted offer becomes
   a candidate; the container is never itself surfaced.

Future adapters (network APIs, spy tools, Meta Ad Library) plug into the same
interface; out of scope for this design.

## Funnel v2

1. **Discover** — run enabled source adapters → raw concrete-offer candidates.
2. **Mine** — for container pages, extract the inner individual offers.
3. **Dedup** — by product/advertiser/domain across all sources.
4. **Triage** (Haiku, on all) — is this a single concrete offer (Gate 0)? rough
   promise. Containers/listicles/networks → rejected here.
5. **Deep research + enrich** (top ~50 survivors by triage score): the existing
   gap-fill research PLUS the enrichment signals (below), then score against the
   rubric (4 hard filters + the v2 factors).
6. **Rank & surface** — only concrete offers, ranked, with full evidence.

## Enrichment signals (Phase B), attached per candidate

A `signals` object (folded into the existing `deep_analysis` jsonb — no schema
change), each with `value`, `confidence` (`high|medium|low|unknown`), `source`:

- **demand_trend** (#5): Google Trends proxy + news volume → rising / flat /
  declining + lifecycle stage (emerging / scaling / saturated / declining).
- **scale_proxy** (#4): affiliate-review mentions + active recruiting +
  marketplace gravity → is it being run at scale (proxy, until real spy).
- **momentum** (#6): recent funding round / acquisition / notable launch from
  news/Crunchbase → could blow the product up.
- **best_payout_route** (#2): which networks/in-house list the product and the
  stated commission/terms; the best route found; unresolved → `unknown_verify`.

## Rubric additions (on top of the 4 hard filters)

Scoring factors gain: lifecycle stage/timing (proven-but-not-burned beats
saturated), advertiser funnel/conversion quality, recurring durability (churn)
for SaaS, geo/language fit + payout currency, seasonality.

## Output per offer

Concrete offer (advertiser + product) · best_payout_route · scale_proxy ·
demand_trend + lifecycle stage · momentum events · the 4 hard-filter verdicts
(pass/fail/unknown_verify + evidence) · estimated_epc_band ·
must_verify_before_budget · recommended.

## Data model impact

No migration. The richer object (signals + the existing rubric payload) fits in
`discovery_candidates.deep_analysis` (untyped jsonb). The dual Zod contracts
gain the `signals` shape and stay in sync.

## Phasing

- **Phase A (build first):** concrete-offer unit + Gate-0 reject containers +
  container mining + marketplace adapter + improved/expanded queries. Fixes the
  surfaced-network bug and delivers volume of real offers. Demoable on its own.
- **Phase B:** the enrichment signals (#2/#4/#5/#6) + the v2 rubric factors.
  Builds on A; each signal is independently testable.

## Cost model

Triage (Haiku) scales cheaply to 1000+ (~$5-15). Full deep-research on the top
~50 survivors (~$0.10-0.20 each) ≈ $5-15. Soft per-scan ceiling stops research
when hit. Container mining is a cheap Haiku call per container page.

## Out of scope (future)

Affiliate-network API adapters (CJ/Impact/PartnerStack inside), paid spy tools,
Meta Ad Library integration, scheduled auto-scans, re-running research on
approved offers.

## Success criteria

- A network/directory/listicle is never surfaced as an offer — only mined.
- A standard scan yields many concrete-offer candidates (not ~20 listicles), and
  recommended ones are genuine individual programs with resolved hard filters.
- Each surfaced offer carries the buyer-grade signals (best payout, scale proxy,
  trend, momentum) with explicit confidence.
- Cost per scan stays within the soft ceiling.
