import { ForbiddenError, requireAdmin, UnauthorizedError } from '../_shared/auth.ts'
import {
  deadlineAfter,
  invokeSelf,
  processInWaves,
  requireAdminOrCron,
} from '../_shared/backgroundWork.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import {
  assertUnderDiscoveryDailyCap,
  DiscoveryCapExceededError,
} from '../_shared/costCap.ts'
import { assertNotPaused, OrchestratorPausedError } from '../_shared/killSwitch.ts'
import { runWebSearch } from '../_shared/adapters/webSearch.ts'
import { runDiscoveryMine } from '../_shared/orchestrators/discoveryMine.ts'
import { runDiscoveryTriage } from '../_shared/orchestrators/discoveryTriage.ts'
import { runDiscoveryDeep } from '../_shared/orchestrators/discoveryDeep.ts'
import { runDiscoveryNetwork } from '../_shared/orchestrators/discoveryNetwork.ts'
import type { NetworkComparison } from '../_shared/types/discoverNetwork.ts'
import { recordRunError, recordRunStart, recordRunSuccess } from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { fetchPageText } from '../_shared/fetchPage.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const UA = 'AffiliateOS-Discovery/1.0'
const TRIAGE_KEEP_MIN_SCORE = 55

// The deep stage lives inside an edge function whose WALL CLOCK it cannot beat:
// no run has ever survived past ~225s, and at ~50s per candidate even 40 of
// them needs several minutes. So the stage no longer tries to finish in one
// invocation — it analyses what fits, then hands off to a fresh clock.
//
// How far a scan goes is a deliberate choice (BREADTH_PARAMS.deepTarget), not
// an accident of when the runtime pulled the plug.
const DEEP_CONCURRENCY = 8 // deep analyses run in parallel waves to cut wall-time
const DEEP_DEADLINE_MS = 150_000
const NETWORK_DEADLINE_MS = 200_000
const MAX_HOPS = 6 // hard ceiling on the self-chain
const MAX_RUN_USD = 8 // a single scan may not spend more than this
const CONTAINER_MINE_CAP = 25 // max container pages to mine per run
const MINED_OFFERS_CAP = 20 // max offers to take from one container
const MINED_TOTAL_CAP = 150 // overall cap on mined candidates (bounds 2nd triage)
const TRIAGE_BATCH_SIZE = 25 // candidates per triage call (a big batch fails)
const TRIAGE_CONCURRENCY = 4 // batches in flight at once
const MINE_CONCURRENCY = 5 // container pages mined at once
const NETWORK_ENRICH_MIN_SCORE = 70 // deep_score threshold for network enrichment (deep_score is 0–100)
const NETWORK_ENRICH_CONCURRENCY = 3 // parallel network enrichment calls

// Deno mirror of src/lib/discovery/queries.ts expandQueries (unit-tested there).
const QUERY_MODIFIERS = [
  'high commission',
  'recurring commission',
  'affiliate program review',
  'partner program payout',
]
function expandQueries(base: string[], vertical: string): string[] {
  const v = vertical.trim()
  const generated = [
    `best ${v} affiliate programs`,
    `top ${v} affiliate programs`,
    ...QUERY_MODIFIERS.map((m) => `${v} ${m}`),
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const q of [...base, ...generated]) {
    const key = q.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out
}

// Breadth → fan-out AND how many survivors get deep-analysed. Measured cost of
// one deep analysis is ~$0.058, so deepTarget is the dial that decides what a
// scan costs: roughly $1 / $2.8 / $6.5. It used to control only the search
// fan-out, while the deep stage silently analysed whatever it managed before
// dying — which is how a "standard" scan produced 8 analyses out of 110.
const BREADTH_PARAMS: Record<
  string,
  { queries: number; resultsPerQuery: number; deepTarget: number }
> = {
  quick: { queries: 1, resultsPerQuery: 5, deepTarget: 15 },
  standard: { queries: 3, resultsPerQuery: 10, deepTarget: 45 },
  deep: { queries: 5, resultsPerQuery: 15, deepTarget: 150 },
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  try {
    const body = (await req.json().catch(() => ({}))) as {
      vertical_id?: string
      breadth?: string
      run_id?: string
      phase?: string
      hop?: number
    }

    // Continue an existing run's deep pass on a fresh clock. Reached two ways:
    // the run chaining to itself (x-cron-secret), or an admin pressing Resume
    // on a run that stalled. Deliberately narrow — it can only continue a run
    // that already exists, never start a scan.
    if (body.run_id && body.phase === 'deep') {
      await requireAdminOrCron(req)
      const runId = body.run_id
      const hop = typeof body.hop === 'number' ? body.hop : 0
      EdgeRuntime.waitUntil(runDeepPhase({ runId, hop }))
      return jsonResponse({ run_id: runId, resumed: true, hop }, 200)
    }

    const user = await requireAdmin(req)
    if (!body.vertical_id) return jsonResponse({ error: 'vertical_id is required' }, 400)
    const breadth = body.breadth && body.breadth in BREADTH_PARAMS ? body.breadth : 'standard'

    try {
      await assertNotPaused('DiscoveryTriageOrchestrator')
      await assertNotPaused('DiscoveryDeepOrchestrator')
    } catch (err) {
      if (err instanceof OrchestratorPausedError) return jsonResponse({ error: err.message }, 503)
      throw err
    }

    try {
      await assertUnderDiscoveryDailyCap()
    } catch (err) {
      if (err instanceof DiscoveryCapExceededError) {
        return jsonResponse({ error: err.message }, 429)
      }
      throw err
    }

    const admin = getAdminClient()

    const { data: runRow, error: runErr } = await admin
      .from('discovery_runs')
      .insert({
        triggered_by: user.id,
        vertical_id: body.vertical_id,
        status: 'queued',
        config: { breadth },
      })
      .select('id')
      .single()
    if (runErr || !runRow) return jsonResponse({ error: 'Failed to create run' }, 500)
    const runId = runRow.id as string

    EdgeRuntime.waitUntil(
      processDiscovery({ runId, verticalId: body.vertical_id, breadth, userId: user.id })
    )

    return jsonResponse({ run_id: runId }, 200)
  } catch (err) {
    if (err instanceof UnauthorizedError) return jsonResponse({ error: err.message }, 401)
    if (err instanceof ForbiddenError) return jsonResponse({ error: err.message }, 403)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})

async function processDiscovery(args: {
  runId: string
  verticalId: string
  breadth: string
  userId: string
}): Promise<void> {
  const admin = getAdminClient()
  const params = BREADTH_PARAMS[args.breadth] ?? BREADTH_PARAMS.standard
  let totalCost = 0
  const runStartedAt = Date.now()
  const elapsed = () => Date.now() - runStartedAt

  try {
    await admin
      .from('discovery_runs')
      .update({ status: 'discovering', started_at: new Date().toISOString() })
      .eq('id', args.runId)

    // Vertical slug for prompt routing.
    const { data: vertical } = await admin
      .from('verticals')
      .select('slug')
      .eq('id', args.verticalId)
      .maybeSingle()
    const verticalSlug = (vertical as { slug?: string } | null)?.slug

    // 1) DISCOVER — run enabled web_search sources for this vertical.
    const { data: sources } = await admin
      .from('discovery_sources')
      .select('id, config')
      .eq('enabled', true)
      .eq('kind', 'web_search')
      .or(`vertical_id.eq.${args.verticalId},vertical_id.is.null`)

    type Raw = { name: string; url: string; snippet: string; sourceId: string }
    const raw: Raw[] = []
    let searchAttempts = 0
    let searchErrors = 0
    let lastSearchError = ''
    for (const s of sources ?? []) {
      const baseTemplates =
        (s.config as { query_templates?: string[] }).query_templates ?? []
      const templates = expandQueries(
        baseTemplates,
        verticalSlug ?? args.verticalId
      ).slice(0, params.queries)
      for (const q of templates) {
        searchAttempts++
        try {
          const found = await runWebSearch(q, params.resultsPerQuery)
          for (const f of found) raw.push({ ...f, sourceId: s.id as string })
        } catch (err) {
          // one failed query shouldn't kill the run — but if they ALL fail
          // (e.g. a bad/missing API key) we surface it below instead of
          // completing with a silent zero.
          searchErrors++
          lastSearchError = err instanceof Error ? err.message : String(err)
        }
      }
    }

    // Dedup against existing offers' domains + within the batch.
    const { data: existingOffers } = await admin
      .from('offers')
      .select('website_url')
    const known = new Set<string>()
    for (const o of existingOffers ?? []) {
      const d = domainOf((o as { website_url: string | null }).website_url)
      if (d) known.add(d)
    }
    const deduped: Array<Raw & { domain: string }> = []
    for (const r of raw) {
      const domain = domainOf(r.url)
      if (!domain || known.has(domain)) continue
      known.add(domain)
      deduped.push({ ...r, domain })
    }

    if (deduped.length === 0) {
      // Every search attempt errored → a config problem (likely the API key),
      // not a genuine "no results". Fail loudly so the admin sees the cause.
      if (searchAttempts > 0 && searchErrors === searchAttempts) {
        throw new Error(`All web-search queries failed: ${lastSearchError}`)
      }
      await admin
        .from('discovery_runs')
        .update({
          status: 'completed',
          counts: { discovered: 0, triaged: 0, analyzed: 0 },
          completed_at: new Date().toISOString(),
        })
        .eq('id', args.runId)
      return
    }

    const { data: candRows } = await admin
      .from('discovery_candidates')
      .insert(
        deduped.map((d) => ({
          run_id: args.runId,
          source_id: d.sourceId,
          vertical_id: args.verticalId,
          name: d.name,
          url: d.url,
          domain: d.domain,
          raw_snippet: d.snippet,
          stage: 'discovered',
        }))
      )
      .select('id, name, url, raw_snippet')
    const candidates = (candRows ?? []) as Array<{
      id: string
      name: string
      url: string | null
      raw_snippet: string | null
    }>

    // 2) TRIAGE (batched — a large candidate set can't go in one Haiku call).
    await admin.from('discovery_runs').update({ status: 'triaging' }).eq('id', args.runId)

    type TriageResult = {
      index: number
      classification: 'offer' | 'container' | 'reject'
      score: number
      reason: string
    }

    // Triage candidates in batches; returns candidateId → result. A failed batch
    // is logged and skipped (its candidates fall through as 'reject') — one bad
    // batch never strands the whole set (the bug that left 150 mined offers at
    // 'discovered' when they all went in one oversized call).
    const triageInBatches = async (
      cands: Array<{ id: string; name: string; url: string | null; snippet: string }>,
      mined: boolean
    ): Promise<Map<string, TriageResult>> => {
      const byId = new Map<string, TriageResult>()
      // Batches are independent, so run them in parallel waves. Sequentially
      // this was ~9.5s x 7 calls = 66s of the run budget spent before deep
      // analysis — the stage that actually matters — got a single second.
      const chunks: Array<typeof cands> = []
      for (let off = 0; off < cands.length; off += TRIAGE_BATCH_SIZE) {
        chunks.push(cands.slice(off, off + TRIAGE_BATCH_SIZE))
      }
      const runChunk = async (chunk: typeof cands): Promise<void> => {
        const batchRunId = await recordRunStart({
          orchestratorName: 'DiscoveryTriageOrchestrator',
          agentVersion: Deno.env.get('ANTHROPIC_API_KEY') ? 'real-v1' : 'mock-v1',
          model: Deno.env.get('ANTHROPIC_API_KEY') ? 'claude-haiku-4-5-20251001' : 'mock',
          inputPayload: { run_id: args.runId, batch_size: chunk.length, mined },
          userId: args.userId,
        })
        try {
          const res = await runDiscoveryTriage(
            chunk.map((c) => ({ name: c.name, url: c.url, snippet: c.snippet })),
            verticalSlug,
            mined ? { mined: true } : undefined
          )
          totalCost += res.usage?.cost_usd ?? 0
          await recordRunSuccess(batchRunId, {
            outputPayload: res.output,
            estimatedCost: res.usage?.cost_usd ?? 0,
            tokensInput: res.usage?.input_tokens,
            tokensOutput: res.usage?.output_tokens,
          })
          const rs = (res.output as { results: TriageResult[] }).results
          for (const r of rs) {
            const c = chunk[r.index]
            if (c) byId.set(c.id, r)
          }
        } catch (err) {
          await recordRunError(batchRunId, err instanceof Error ? err.message : String(err))
        }
      }
      for (let i = 0; i < chunks.length; i += TRIAGE_CONCURRENCY) {
        await Promise.all(chunks.slice(i, i + TRIAGE_CONCURRENCY).map(runChunk))
      }
      return byId
    }

    const survivors: Array<{ id: string; name: string; url: string | null; score: number }> = []
    const containers: Array<{ url: string }> = []

    const applyTriage = async (
      cand: { id: string; name: string; url: string | null },
      r: TriageResult | undefined,
      allowContainer: boolean
    ): Promise<void> => {
      const score = r?.score ?? 0
      const cls = r?.classification ?? 'reject'
      if (cls === 'offer' && score >= TRIAGE_KEEP_MIN_SCORE) {
        await admin
          .from('discovery_candidates')
          .update({ stage: 'triaged', triage_score: score, triage_reason: r?.reason ?? null })
          .eq('id', cand.id)
        survivors.push({ id: cand.id, name: cand.name, url: cand.url, score })
      } else if (cls === 'container' && allowContainer && cand.url) {
        await admin
          .from('discovery_candidates')
          .update({
            stage: 'rejected',
            triage_score: score,
            triage_reason: r?.reason ?? 'Container — mined for offers.',
            rejection_stage: 'triaged',
            rejection_reason:
              'Container (network/directory/listicle) — mined for the offers inside it.',
          })
          .eq('id', cand.id)
        containers.push({ url: cand.url })
      } else {
        await admin
          .from('discovery_candidates')
          .update({
            stage: 'rejected',
            triage_score: score,
            triage_reason: r?.reason ?? 'Below triage threshold.',
            rejection_stage: 'triaged',
            rejection_reason: r?.reason ?? 'Not a concrete offer.',
          })
          .eq('id', cand.id)
      }
    }

    // Pass 1: web-search results.
    const triaged1 = await triageInBatches(
      candidates.map((c) => ({
        id: c.id,
        name: c.name,
        url: c.url,
        snippet: c.raw_snippet ?? '',
      })),
      false
    )
    for (const c of candidates) {
      await applyTriage({ id: c.id, name: c.name, url: c.url }, triaged1.get(c.id), true)
    }

    // MINE containers → extract the individual offers inside them, insert as new
    // candidates, and triage those (one pass; mined containers are not mined
    // again — bounded). dedup reuses the `known` domain set from discovery.
    let minedTotal = 0
    type MinedRaw = { name: string; url: string | null; domain: string | null; parent: string }
    const minedRaw: MinedRaw[] = []
    // Dedup mined offers by domain when present, else by normalized name (many
    // listicles give an offer's name but no clean URL — those are still valid
    // candidates; deep analysis researches them by name).
    const knownNames = new Set<string>()
    // Mining a container is a page fetch plus one Haiku call, all independent
    // of each other — another 45s of the budget that was being spent serially.
    // The dedup sets below are only touched after each call resolves, so
    // running the calls in waves keeps that bookkeeping sequential.
    const mineOne = async (ct: { url: string }): Promise<void> => {
      if (minedRaw.length >= MINED_TOTAL_CAP) return
      const pageText = await fetchPageText(ct.url, UA)
      if (!pageText) return
      const mineRunId = await recordRunStart({
        orchestratorName: 'DiscoveryMineOrchestrator',
        agentVersion: Deno.env.get('ANTHROPIC_API_KEY') ? 'real-v1' : 'mock-v1',
        model: Deno.env.get('ANTHROPIC_API_KEY') ? 'claude-haiku-4-5-20251001' : 'mock',
        inputPayload: { container_url: ct.url },
        userId: args.userId,
      })
      try {
        const mined = await runDiscoveryMine({ url: ct.url, pageText }, verticalSlug)
        totalCost += mined.usage?.cost_usd ?? 0
        await recordRunSuccess(mineRunId, {
          outputPayload: mined.output,
          estimatedCost: mined.usage?.cost_usd ?? 0,
          tokensInput: mined.usage?.input_tokens,
          tokensOutput: mined.usage?.output_tokens,
        })
        const offers = (mined.output as { offers: Array<{ name: string; url: string | null }> })
          .offers
        for (const o of offers.slice(0, MINED_OFFERS_CAP)) {
          if (minedRaw.length >= MINED_TOTAL_CAP) break
          const name = (o.name ?? '').trim()
          if (!name) continue
          const domain = domainOf(o.url)
          if (domain) {
            if (known.has(domain)) continue
            known.add(domain)
          } else {
            const nameKey = name.toLowerCase()
            if (knownNames.has(nameKey)) continue
            knownNames.add(nameKey)
          }
          minedRaw.push({ name, url: o.url, domain, parent: ct.url })
        }
      } catch (err) {
        await recordRunError(mineRunId, err instanceof Error ? err.message : String(err))
      }
    }

    const toMine = containers.slice(0, CONTAINER_MINE_CAP)
    for (let i = 0; i < toMine.length; i += MINE_CONCURRENCY) {
      if (minedRaw.length >= MINED_TOTAL_CAP) break
      await Promise.all(toMine.slice(i, i + MINE_CONCURRENCY).map(mineOne))
    }

    if (minedRaw.length > 0) {
      const { data: minedRows } = await admin
        .from('discovery_candidates')
        .insert(
          minedRaw.map((m) => ({
            run_id: args.runId,
            vertical_id: args.verticalId,
            name: m.name,
            url: m.url,
            domain: m.domain,
            raw_snippet: `[mined from ${m.parent}]`,
            stage: 'discovered',
          }))
        )
        .select('id, name, url, raw_snippet')
      const minedCandidates = (minedRows ?? []) as Array<{
        id: string
        name: string
        url: string | null
        raw_snippet: string | null
      }>
      minedTotal = minedCandidates.length

      if (minedCandidates.length > 0) {
        // Pass 2: triage the mined offers (batched + lenient — they're already
        // extracted concrete offers; the score just ranks them for the deep cap).
        const triaged2 = await triageInBatches(
          minedCandidates.map((c) => ({
            id: c.id,
            name: c.name,
            url: c.url,
            snippet: c.raw_snippet ?? '',
          })),
          true
        )
        for (const c of minedCandidates) {
          // allowContainer=false: a mined item that's itself a container is just
          // rejected (no recursive mining in Phase A).
          await applyTriage({ id: c.id, name: c.name, url: c.url }, triaged2.get(c.id), false)
        }
      }
    }

    // Survivors now sit in the DB at stage='triaged'. The deep phase reads
    // them from there rather than from memory, which is what lets a later
    // invocation pick up exactly where this one ran out of clock.
    await admin.from('discovery_runs').update({
      status: 'analyzing',
      counts: {
        discovered: candidates.length + minedTotal,
        triaged: survivors.length,
        analyzed: 0,
      },
      total_cost_usd: totalCost,
    }).eq('id', args.runId)

    await runDeepPhase({ runId: args.runId, hop: 0, alreadyElapsedMs: elapsed() })
  } catch (err) {
    await admin
      .from('discovery_runs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : String(err),
        total_cost_usd: totalCost,
        completed_at: new Date().toISOString(),
      })
      .eq('id', args.runId)
  }
}

/**
 * One invocation's worth of deep analysis, then either hand off or finish.
 *
 * Reads its work from `discovery_candidates` at stage='triaged' instead of from
 * memory, so any invocation can continue any run. That is the whole trick: the
 * progress was always in the database — candidates move to 'analyzed' one at a
 * time — and nothing was using it.
 *
 * Ends in exactly one of two states, never in limbo: chained to a fresh clock,
 * or finalised with an honest account of what it managed.
 */
async function runDeepPhase(args: {
  runId: string
  hop: number
  /** Time already burnt by discovery/triage/mine in this same invocation. */
  alreadyElapsedMs?: number
}): Promise<void> {
  const admin = getAdminClient()
  const spent = args.alreadyElapsedMs ?? 0
  const pastDeadline = deadlineAfter(Math.max(DEEP_DEADLINE_MS - spent, 15_000))
  let totalCost = 0

  try {
    const { data: run } = await admin
      .from('discovery_runs')
      .select('config, counts, total_cost_usd, vertical_id, triggered_by, status')
      .eq('id', args.runId)
      .maybeSingle()
    // A 'completed' run is still resumable: the deep pass finishes early and
    // marks itself completed whenever it runs out of clock, so refusing that
    // status is refusing every run the Resume button exists for. Only a run
    // that failed outright stays closed.
    if (!run || run.status === 'failed') return

    const counts = (run.counts ?? {}) as Record<string, number>
    const costSoFar = Number(run.total_cost_usd ?? 0)
    const breadth = ((run.config ?? {}) as { breadth?: string }).breadth ?? 'standard'
    const deepTarget = (BREADTH_PARAMS[breadth] ?? BREADTH_PARAMS.standard).deepTarget

    // Stop conditions checked BEFORE spending anything.
    const stop = async (reason: string): Promise<void> => {
      await finaliseRun(admin, args.runId, counts, costSoFar, reason)
    }
    // The kill switch has to be read here, at the hop boundary: inside
    // analyzeOne its throw is swallowed as a per-candidate failure, which
    // degrades a run instead of stopping it.
    try {
      await assertNotPaused('DiscoveryDeepOrchestrator')
    } catch {
      return stop('Stopped: the DiscoveryDeep kill switch was flipped.')
    }
    if (costSoFar >= MAX_RUN_USD) {
      return stop(`Stopped at the $${MAX_RUN_USD} per-run ceiling.`)
    }
    if (args.hop >= MAX_HOPS) {
      return stop(`Stopped after ${MAX_HOPS} continuations.`)
    }

    const budgetLeft = deepTarget - (counts.analyzed ?? 0)
    if (budgetLeft <= 0) return stop('')

    const { data: vertical } = await admin
      .from('verticals')
      .select('slug')
      .eq('id', run.vertical_id)
      .maybeSingle()
    const verticalSlug = (vertical as { slug?: string } | null)?.slug

    const { data: pending } = await admin
      .from('discovery_candidates')
      .select('id, name, url')
      .eq('run_id', args.runId)
      .eq('stage', 'triaged')
      .order('triage_score', { ascending: false })
      .limit(budgetLeft)
    const toAnalyze = (pending ?? []) as Array<{
      id: string
      name: string
      url: string | null
    }>
    if (toAnalyze.length === 0) return stop('')

    // Reopen the run while this hop works, so the page does not read
    // 'completed' next to a funnel that is visibly still moving.
    await admin
      .from('discovery_runs')
      .update({ status: 'analyzing', error_message: null, completed_at: null })
      .eq('id', args.runId)

    const analyzeOne = async (s: {
      id: string
      name: string
      url: string | null
    }): Promise<{ cost: number; analyzed: boolean }> => {
      // No page text is fine: deep analysis still runs on name/url + research.
      const rawText = await fetchPageText(s.url, UA)
      const deepRunId = await recordRunStart({
        orchestratorName: 'DiscoveryDeepOrchestrator',
        agentVersion: Deno.env.get('ANTHROPIC_API_KEY') ? 'real-v1' : 'mock-v1',
        model: Deno.env.get('ANTHROPIC_API_KEY') ? 'claude-sonnet-4-6' : 'mock',
        inputPayload: { candidate_id: s.id, run_id: args.runId, hop: args.hop },
        userId: run.triggered_by ?? undefined,
      })
      try {
        const deep = await runDiscoveryDeep({ name: s.name, url: s.url, rawText }, verticalSlug)
        const payload = deep.output as { overall_score?: number }
        await admin
          .from('discovery_candidates')
          .update({
            stage: 'analyzed',
            deep_analysis: deep.output,
            deep_score: payload.overall_score ?? null,
          })
          .eq('id', s.id)
        await recordRunSuccess(deepRunId, {
          outputPayload: deep.output,
          estimatedCost: deep.usage?.cost_usd ?? 0,
          tokensInput: deep.usage?.input_tokens,
          tokensOutput: deep.usage?.output_tokens,
        })
        return { cost: deep.usage?.cost_usd ?? 0, analyzed: true }
      } catch (err) {
        await recordRunError(deepRunId, err instanceof Error ? err.message : String(err))
        // leave the candidate at 'triaged' — a later hop can retry it
        return { cost: 0, analyzed: false }
      }
    }

    const wave = await processInWaves(toAnalyze, DEEP_CONCURRENCY, pastDeadline, analyzeOne)
    let analyzedThisHop = 0
    for (const r of wave.results) {
      totalCost += r.cost
      if (r.analyzed) analyzedThisHop++
    }

    const newCounts = {
      ...counts,
      analyzed: (counts.analyzed ?? 0) + analyzedThisHop,
    }
    const newCost = costSoFar + totalCost
    await admin
      .from('discovery_runs')
      .update({ counts: newCounts, total_cost_usd: newCost })
      .eq('id', args.runId)

    const { count: stillPending } = await admin
      .from('discovery_candidates')
      .select('*', { count: 'exact', head: true })
      .eq('run_id', args.runId)
      .eq('stage', 'triaged')

    const moreToDo = (stillPending ?? 0) > 0 && newCounts.analyzed < deepTarget
    // A hop that analysed nothing must not chain — that is the guard against a
    // run looping forever on candidates that all fail.
    const worthContinuing =
      moreToDo && analyzedThisHop > 0 && newCost < MAX_RUN_USD && args.hop + 1 < MAX_HOPS

    if (worthContinuing) {
      const handedOff = await invokeSelf('discover-offers', {
        run_id: args.runId,
        phase: 'deep',
        hop: args.hop + 1,
      })
      if (handedOff) return
      // Hand-off refused: finish here rather than strand the run. The Resume
      // button on the run page can pick it up.
      await finaliseRun(
        admin,
        args.runId,
        newCounts,
        newCost,
        `Could not continue automatically after ${newCounts.analyzed} candidates; ${stillPending} still at 'triaged'. Press Resume to carry on.`
      )
      return
    }

    await enrichNetworks(admin, args.runId, (c) => {
      totalCost += c
    })

    await finaliseRun(
      admin,
      args.runId,
      newCounts,
      newCost,
      moreToDo
        ? `Stopped after ${newCounts.analyzed} candidates with ${stillPending} still at 'triaged' — ${
            analyzedThisHop === 0 ? 'the last pass analysed none of them' : `the ${breadth} target of ${deepTarget} was reached`
          }.`
        : ''
    )
  } catch (err) {
    await admin
      .from('discovery_runs')
      .update({
        status: 'failed',
        error_message: err instanceof Error ? err.message : String(err),
        completed_at: new Date().toISOString(),
      })
      .eq('id', args.runId)
  }
}

/**
 * Which networks carry the top candidates, and are they trending.
 *
 * Additive: a failure here degrades the result, it never fails the run. Runs
 * once, on the last hop, because it only makes sense over the finished set.
 */
async function enrichNetworks(
  admin: ReturnType<typeof getAdminClient>,
  runId: string,
  addCost: (usd: number) => void
): Promise<void> {
  const pastDeadline = deadlineAfter(NETWORK_DEADLINE_MS - DEEP_DEADLINE_MS)
  try {
    const { data: topCands } = await admin
      .from('discovery_candidates')
      .select('id, name, url, deep_score, promoted_offer_id')
      .eq('run_id', runId)
      .eq('stage', 'analyzed')
      .gte('deep_score', NETWORK_ENRICH_MIN_SCORE)
      .limit(20)

    await processInWaves(
      (topCands ?? []) as Array<{
        id: string
        name: string
        url: string | null
        promoted_offer_id: string | null
      }>,
      NETWORK_ENRICH_CONCURRENCY,
      pastDeadline,
      async (cand) => {
        try {
          const networkResult = await runDiscoveryNetwork({
            offer: { id: cand.promoted_offer_id ?? undefined, name: cand.name, url: cand.url },
          })
          const nc = networkResult.output as NetworkComparison
          addCost(networkResult.usage?.cost_usd ?? 0)

          // Park it on the candidate regardless. Every write here used to be
          // gated on promoted_offer_id, which is null for the whole scan, so
          // this Haiku call was paid for and discarded every single time.
          await admin
            .from('discovery_candidates')
            .update({ network_analysis: nc })
            .eq('id', cand.id)

          if (cand.promoted_offer_id) {
            const signal = nc.trending_signal ?? null
            await admin
              .from('offers')
              .update({
                trending_signal: signal,
                trending_score:
                  signal === 'rising' ? 2 : signal === 'stable' ? 1 : signal === 'declining' ? -1 : 0,
              })
              .eq('id', cand.promoted_offer_id)

            if (nc.networks_found.length > 0) {
              await admin.from('offer_network_data').upsert(
                nc.networks_found.map((n) => ({
                  offer_id: cand.promoted_offer_id as string,
                  network_name: n.network_name,
                  epc_usd: n.estimated_epc_usd ?? null,
                  commission_type: n.estimated_commission_type ?? null,
                  is_recommended: nc.recommended_network === n.network_name,
                  notes: [
                    `confidence: ${n.confidence}`,
                    nc.recommended_network === n.network_name ? nc.recommended_reason : null,
                    nc.trending_evidence ? `trend: ${nc.trending_evidence}` : null,
                  ]
                    .filter(Boolean)
                    .join(' | '),
                })),
                { onConflict: 'offer_id,network_name', ignoreDuplicates: false }
              )
            }
          }
        } catch {
          // individual enrichment failure is non-fatal
        }
      }
    )
  } catch {
    // enrichment block failure must never fail the run
  }
}

async function finaliseRun(
  admin: ReturnType<typeof getAdminClient>,
  runId: string,
  counts: Record<string, number>,
  totalCost: number,
  note: string
): Promise<void> {
  await admin
    .from('discovery_runs')
    .update({
      status: 'completed',
      counts,
      total_cost_usd: totalCost,
      completed_at: new Date().toISOString(),
      error_message: note || null,
    })
    .eq('id', runId)
}

// Local copy of the dedup domain normalizer (the Node helper in
// src/lib/discovery/dedup.ts is the unit-tested source of truth; this mirrors
// it for the Deno runtime).
function domainOf(url: string | null): string | null {
  if (!url || !url.trim()) return null
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url.trim()}`
  try {
    const host = new URL(withScheme).hostname.toLowerCase().replace(/^www\./, '')
    return host.includes('.') ? host : null
  } catch {
    return null
  }
}

