import { ForbiddenError, requireAdmin, UnauthorizedError } from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { sendEmail } from '../_shared/email.ts'
import { runUnderwriting } from '../_shared/orchestrators/underwriting.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'

// Replays the active Underwriting prompt against the golden set for a vertical,
// compares verdicts, and writes an eval_runs row. Schedulable (pg_cron + pg_net)
// or invokable manually. Runs with modest concurrency to stay in the edge budget.
//
// Auth: a matching `x-cron-secret` header (when CRON_SECRET is set) OR an admin
// JWT. Alerts ADMIN_ALERT_EMAIL when accuracy drops below the threshold.

const CONCURRENCY = 4
const ALERT_BELOW_PCT = 70

// The golden verdicts assume a capable operator; eval with a fixed
// representative context so operator_fit is scored consistently (not the
// no-context default of 70).
const REP_OPERATOR_CONTEXT = {
  experience_level: 'advanced',
  cashflow_tolerance: 'flexible',
  primary_channels: ['paid_social', 'native', 'google_ads'],
  typical_budget_range_usd: [500, 5000] as [number, number],
}

async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let i = 0
  async function worker() {
    while (i < items.length) {
      const idx = i++
      results[idx] = await fn(items[idx])
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

declare const EdgeRuntime: { waitUntil(promise: Promise<unknown>): void }

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  try {
    // Auth: cron secret header OR admin.
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('x-cron-secret')
    if (!(cronSecret && headerSecret && headerSecret === cronSecret)) {
      await requireAdmin(req)
    }

    const body = (await req.json().catch(() => ({}))) as {
      vertical?: string
      trigger?: string
    }
    const verticalSlug = body.vertical ?? 'ai_saas'
    const trigger = body.trigger === 'cron' ? 'cron' : 'manual'

    const admin = getAdminClient()

    const { data: vertical } = await admin
      .from('verticals')
      .select('id')
      .eq('slug', verticalSlug)
      .maybeSingle()
    if (!vertical) return jsonResponse({ error: `Unknown vertical ${verticalSlug}` }, 400)

    const { data: prompt } = await admin
      .from('prompts')
      .select('id, version')
      .eq('orchestrator_name', 'UnderwritingOrchestrator')
      .eq('prompt_type', 'main')
      .eq('is_active', true)
      .is('vertical_id', null)
      .maybeSingle()
    if (!prompt) return jsonResponse({ error: 'No active Underwriting prompt' }, 400)

    const { data: goldens } = await admin
      .from('golden_set_offers')
      .select('id, external_id, offer_name, facts_snapshot, expected_verdict')
      .eq('vertical_id', vertical.id)
      .order('external_id', { ascending: true })
    if (!goldens || goldens.length === 0) {
      return jsonResponse({ error: `No golden offers for ${verticalSlug}` }, 400)
    }

    // The eval is too long for the 150s request limit — run it in the
    // background and write the eval_runs row when done. Callers poll /admin/eval.
    const goldenList = goldens
    EdgeRuntime.waitUntil(
      (async () => {
        const startedAt = new Date()
        const results = await mapPool(goldenList, CONCURRENCY, async (g) => {
          try {
            const r = await runUnderwriting({
              offerId: g.id,
              offerName: g.offer_name,
              verticalSlug,
              facts: (g.facts_snapshot as unknown[] as Array<{
                fact_type: string
                fact_value: string
                source_quote: string | null
                confidence_score: number | null
              }>) ?? [],
              userContext: REP_OPERATOR_CONTEXT,
            })
            const actual =
              (r.output as { payload?: { verdict?: string } }).payload?.verdict ?? null
            return {
              external_id: g.external_id,
              offer_name: g.offer_name,
              expected_verdict: g.expected_verdict,
              actual_verdict: actual,
              verdict_match: actual === g.expected_verdict,
              cost_usd: r.usage?.cost_usd ?? 0,
            }
          } catch (err) {
            return {
              external_id: g.external_id,
              offer_name: g.offer_name,
              expected_verdict: g.expected_verdict,
              actual_verdict: null,
              verdict_match: false,
              error: err instanceof Error ? err.message : String(err),
              cost_usd: 0,
            }
          }
        })

        const matched = results.filter((r) => r.verdict_match).length
        const accuracyPct = Math.round((matched / goldenList.length) * 10000) / 100
        const totalCost = results.reduce((s, r) => s + (r.cost_usd ?? 0), 0)

        await admin.from('eval_runs').insert({
          prompt_id: prompt.id,
          trigger_type: trigger,
          total_offers: goldenList.length,
          matched_verdict_count: matched,
          matched_score_range_count: 0,
          matched_risk_flags_count: 0,
          accuracy_pct: accuracyPct,
          details: { vertical: verticalSlug, prompt_version: prompt.version, results },
          total_cost_usd: totalCost,
          started_at: startedAt.toISOString(),
          completed_at: new Date().toISOString(),
        })

        if (accuracyPct < ALERT_BELOW_PCT) {
          await sendEmail(
            Deno.env.get('ADMIN_ALERT_EMAIL'),
            `[AffiliateOS] Eval accuracy dropped to ${accuracyPct}%`,
            `<p>Underwriting eval on <strong>${verticalSlug}</strong> (prompt ${prompt.version}) ` +
              `matched ${matched}/${goldenList.length} (${accuracyPct}%), below the ${ALERT_BELOW_PCT}% threshold.</p>` +
              `<p>Review at /admin/eval.</p>`
          )
        }
      })()
    )

    return jsonResponse(
      { started: true, vertical: verticalSlug, total: goldenList.length },
      200
    )
  } catch (err) {
    if (err instanceof UnauthorizedError) return jsonResponse({ error: err.message }, 401)
    if (err instanceof ForbiddenError) return jsonResponse({ error: err.message }, 403)
    return jsonResponse({ error: err instanceof Error ? err.message : 'Internal error' }, 500)
  }
})
