# Deep Offer Research (#10) — Design

> Status: approved (brainstorm, 2026-06-29). Next: implementation plan.

## Goal

Give an operator a "Deep research" action on an existing offer that produces a
comprehensive, research-augmented **dossier** (with evidence + source links) AND
**refreshes the verdict/scorecard** from the new evidence. This goes beyond the
standard underwriting verdict: it actively researches the web + real competitor
ads before the operator commits budget. The user framed it as "burn tokens" —
depth over cost.

Builds on the existing research-augmented discovery deep analysis (page read +
Tavily gap-fill queries + Sonnet rubric scoring), bringing that capability — and
more — to a saved offer.

## What the dossier contains (7 sections + ad examples)

Each claim carries `evidence` + `source_url` (like the existing fact citations):

1. **Economics & payout route** — commission structure, estimated EPC, and
   **which network/route pays the most** for this product.
2. **Competitive landscape** — direct competitors, positioning, market saturation.
3. **Demand & trend** — rising/falling in search, seasonality, lifecycle stage.
4. **Momentum** — funding rounds, acquisitions, growth news.
5. **Reputation & complaints** — does it pay, shaving, affiliate complaints,
   compliance risk.
6. **Paid-traffic policy** — brand bidding, channel policy, restrictions.
7. **Recommended test approach** — starting budget, recommended channel, what to
   verify before scaling.

Plus **ad examples / creatives**: real ad copy + creative thumbnails + "running
for N days" longevity signal, from a spy-tool ad-intelligence adapter.

## Architecture

New edge function **`research-offer`** — background (`EdgeRuntime.waitUntil`),
with the standard guardrails: `requireUser` (matching `analyze-offer` — any
authenticated operator, no admin gate), kill-switch (`assertNotPaused`), credit
reserve/debit/refund, daily-USD cap, `ai_runs` cost recording, DLQ-on-failure.
Same shape as `analyze-offer` / `discover-offers`.

Pipeline (per offer):

1. **Fetch page text** — reuse the existing fetch+strip logic; fall back to the
   offer's latest `source_documents.raw_text` when present.
2. **Web research** — ~8 fixed Tavily gap-fill queries covering the 7 sections
   (economics/networks, competitors, demand/trend, momentum/funding,
   reputation/complaints, paid-traffic policy, ad angles). Real-or-mock via the
   existing `webSearch` adapter (`DISCOVERY_SEARCH_API_KEY`). A failed query
   never blocks synthesis — that section just stays thinner.
3. **Ad intelligence** — new `adIntel` adapter (`runAdIntel(brand, opts)`),
   real-or-mock, targeting a spy tool (AdSpy/BigSpy/Anstrex). Returns ad copy +
   creative image URLs + days-running. The concrete provider's real API is wired
   when the owner subscribes + sets the key (the adapter ships real-or-mock now,
   exactly like Tavily). Gated on an env key (e.g. `AD_INTEL_API_KEY`).
4. **Dossier synthesis** — one Sonnet call (`OfferResearchOrchestrator`,
   `prompts/offer_research/v1.md`) over page + research + ad-intel, producing the
   structured dossier (7 sections + `ad_examples`), each claim with `evidence` +
   `source_url`. Dual Zod contract (Node `src/types/agents/offerResearch.ts` +
   Deno `_shared/types/offerResearch.ts`).
5. **Persist findings as facts** — write the dossier's evidenced claims to
   `extracted_facts` (status `verified`, with `source_quote` + source doc), so
   they feed underwriting and render as citations on Overview.
6. **Verdict refresh** — re-run the existing underwriting orchestrator with the
   enriched facts; updates the verdict/scorecard and advances status to
   `ai_analyzed` (`.in()`-guarded, never demotes).

## Storage

**No migration.**
- Dossier payload → `ai_runs.output_payload` under orchestrator
  `OfferResearchOrchestrator` (read back via the existing
  `getLatestRunByOrchestrator`). Creative image URLs live inside the payload;
  V1 displays the spy tool's URLs directly (no re-hosting).
- Findings → existing `extracted_facts` table.
- Verdict refresh → existing underwriting run + `offers.status`.

## UI

- **`DeepResearchButton`** on the offer page (like `AnalyzeButton`): triggers
  `research-offer`, shows running/cost state. Credit-gated.
- New **"Research"** tab (after Compliance) rendering **`ResearchDossierView`**:
  the 7 sections with evidence + source links, plus an **ad gallery** (creative
  thumbnail + ad copy + "running N days").
- **Hebrew translation works automatically**: the dossier lives in `ai_runs`,
  already covered by the AI-output translation layer (`getTranslatedPayload` +
  `TranslationFiller`, `source_table = 'ai_runs'`).

## Access & cost

- Access: same as Analyze — available to whoever can see the offer, credit-gated.
  (Can be tightened to admin-only if cost control is needed; owner decides.)
- Cost: high — ~8 Tavily queries + spy-tool calls + 2 Sonnet calls (synthesis +
  underwriting refresh). A dedicated (higher) credit price; reserve up front,
  refund on failure, like the other AI actions.

## Components (isolation)

- `_shared/adapters/adIntel.ts` (Deno) — `runAdIntel(brand, opts)`, real-or-mock.
- `_shared/orchestrators/offerResearch.ts` (Deno) — synthesis, real-or-mock.
- `_shared/types/offerResearch.ts` + `src/types/agents/offerResearch.ts` — dual
  Zod contract (KEEP IN SYNC).
- `prompts/offer_research/v1.md` — synthesis prompt.
- `supabase/functions/research-offer/index.ts` — the edge function (pipeline).
- `src/components/offers/DeepResearchButton.tsx`,
  `src/components/offers/ResearchDossierView.tsx` — UI.
- `src/lib/actions/offers.ts` — `startDeepResearch(offerId)` server action
  (invokes the edge fn), mirroring the existing analyze action.

## Error handling

- Each pipeline step is best-effort and degrades open: a failed research/ad-intel
  step yields a thinner dossier, never a crash. The synthesis + underwriting
  calls record `ai_runs` errors and refund credits on failure (existing pattern).
- Ad-intel disabled (no key) → mock data in dev, empty `ad_examples` in prod
  (the section renders "no creatives available yet").

## Testing

- Pure logic unit-tested: the research-query builder and any dedup/normalize
  helpers (Vitest), mirroring the discovery `queries`/`dedup` tests.
- Dual-contract Zod parse tests for the dossier schema.
- Mock-mode manual e2e script (`scripts/test-research-offer-e2e.mjs`) creating +
  cleaning a throwaway offer, asserting a dossier + refreshed verdict land.
- Real-AI run is owner-gated (costs tokens), like the other real orchestrators.

## Out of scope (deferred)

- Real spy-tool API wiring beyond the adapter interface (needs the owner's
  subscription + key; provider chosen then).
- Re-hosting / caching creative images.
- Scheduled / automatic re-research (manual button only for now).
- Google/TikTok ad sources (the adapter can grow to them later).
