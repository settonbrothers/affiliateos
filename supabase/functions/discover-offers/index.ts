import { ForbiddenError, requireAdmin, UnauthorizedError } from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { assertNotPaused, OrchestratorPausedError } from '../_shared/killSwitch.ts'
import { runWebSearch } from '../_shared/adapters/webSearch.ts'
import { runDiscoveryMine } from '../_shared/orchestrators/discoveryMine.ts'
import { runDiscoveryTriage } from '../_shared/orchestrators/discoveryTriage.ts'
import { runDiscoveryDeep } from '../_shared/orchestrators/discoveryDeep.ts'
import { recordRunError, recordRunStart, recordRunSuccess } from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { truncate } from '../_shared/truncate.ts'

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

const FETCH_TIMEOUT_MS = 15_000
const MAX_HTML_BYTES = 500_000
const MAX_RAW_TEXT_LEN = 120_000
const TRIAGE_KEEP_MIN_SCORE = 55
const DEEP_ANALYSIS_CAP = 20
const CONTAINER_MINE_CAP = 25 // max container pages to mine per run
const MINED_OFFERS_CAP = 20 // max offers to take from one container
const MINED_TOTAL_CAP = 150 // overall cap on mined candidates (bounds 2nd triage)
const TRIAGE_BATCH_SIZE = 25 // candidates per triage call (a big batch fails)

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

// Breadth → fan-out. queries: how many of a source's templates to use;
// resultsPerQuery: web-search results each.
const BREADTH_PARAMS: Record<string, { queries: number; resultsPerQuery: number }> = {
  quick: { queries: 1, resultsPerQuery: 5 },
  standard: { queries: 3, resultsPerQuery: 10 },
  deep: { queries: 5, resultsPerQuery: 15 },
}

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  try {
    const user = await requireAdmin(req)

    const body = (await req.json().catch(() => ({}))) as {
      vertical_id?: string
      breadth?: string
    }
    if (!body.vertical_id) return jsonResponse({ error: 'vertical_id is required' }, 400)
    const breadth = body.breadth && body.breadth in BREADTH_PARAMS ? body.breadth : 'standard'

    try {
      await assertNotPaused('DiscoveryTriageOrchestrator')
      await assertNotPaused('DiscoveryDeepOrchestrator')
    } catch (err) {
      if (err instanceof OrchestratorPausedError) return jsonResponse({ error: err.message }, 503)
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
          counts: { discovered: 0, triaged: 0, analyzed: 0, approved: 0 },
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
      for (let off = 0; off < cands.length; off += TRIAGE_BATCH_SIZE) {
        const chunk = cands.slice(off, off + TRIAGE_BATCH_SIZE)
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
    for (const ct of containers.slice(0, CONTAINER_MINE_CAP)) {
      if (minedRaw.length >= MINED_TOTAL_CAP) break
      let pageText = ''
      try {
        const html = await fetchWithTimeout(ct.url, FETCH_TIMEOUT_MS)
        pageText = truncate(stripHtml(html.slice(0, MAX_HTML_BYTES)), MAX_RAW_TEXT_LEN)
      } catch {
        continue
      }
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

    // Best triage scores first, so the deep cap takes the strongest survivors.
    survivors.sort((a, b) => b.score - a.score)

    // 3) DEEP — Sonnet on the top survivors (cap), fetching each page.
    await admin.from('discovery_runs').update({ status: 'analyzing' }).eq('id', args.runId)
    const toAnalyze = survivors.slice(0, DEEP_ANALYSIS_CAP)
    let analyzedCount = 0
    for (const s of toAnalyze) {
      let rawText = ''
      try {
        const html = await fetchWithTimeout(s.url ?? '', FETCH_TIMEOUT_MS)
        rawText = truncate(stripHtml(html.slice(0, MAX_HTML_BYTES)), MAX_RAW_TEXT_LEN)
      } catch {
        // no page text — deep analysis still runs on name/url + snippet only
      }

      const deepRunId = await recordRunStart({
        orchestratorName: 'DiscoveryDeepOrchestrator',
        agentVersion: Deno.env.get('ANTHROPIC_API_KEY') ? 'real-v1' : 'mock-v1',
        model: Deno.env.get('ANTHROPIC_API_KEY') ? 'claude-sonnet-4-6' : 'mock',
        inputPayload: { candidate_id: s.id },
        userId: args.userId,
      })
      try {
        const deep = await runDiscoveryDeep({ name: s.name, url: s.url, rawText }, verticalSlug)
        totalCost += deep.usage?.cost_usd ?? 0
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
        analyzedCount++
      } catch (err) {
        await recordRunError(deepRunId, err instanceof Error ? err.message : String(err))
        // leave the candidate at 'triaged' — partial run, not a hard failure
      }
    }

    await admin
      .from('discovery_runs')
      .update({
        status: 'completed',
        counts: {
          discovered: candidates.length + minedTotal,
          triaged: survivors.length,
          analyzed: analyzedCount,
          approved: 0,
        },
        total_cost_usd: totalCost,
        completed_at: new Date().toISOString(),
      })
      .eq('id', args.runId)
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

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<string> {
  if (!url) throw new Error('no url')
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'AffiliateOS-Discovery/1.0' },
    })
    if (!res.ok) throw new Error(`fetch ${url} failed: HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

function stripHtml(s: string): string {
  return s
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}
