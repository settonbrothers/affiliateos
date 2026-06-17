import { ForbiddenError, requireAdmin, UnauthorizedError } from '../_shared/auth.ts'
import { handleCors, jsonResponse } from '../_shared/cors.ts'
import { OrchestratorPausedError } from '../_shared/killSwitch.ts'
import { runTranslate } from '../_shared/orchestrators/translate.ts'
import { recordRunError, recordRunStart, recordRunSuccess } from '../_shared/recordAiRun.ts'
import { getAdminClient } from '../_shared/supabaseAdmin.ts'
import { collectStrings } from '../_shared/translatable.ts'
import { TranslateResponseSchema } from '../_shared/types/translate.ts'

// Which jsonb column holds the displayed free-text payload for each source.
const SOURCE_PAYLOAD_COLUMN: Record<string, string> = {
  ai_runs: 'output_payload',
  discovery_candidates: 'deep_analysis',
}

// Translation never expands the input, but cap defensively so one giant payload
// can't blow up a single Haiku call.
const MAX_ITEMS = 200

Deno.serve(async (req: Request) => {
  const preflight = handleCors(req)
  if (preflight) return preflight

  try {
    const user = await requireAdmin(req)

    const body = (await req.json().catch(() => ({}))) as {
      source_table?: string
      source_id?: string
      locale?: string
    }
    const sourceTable = body.source_table ?? ''
    const sourceId = body.source_id ?? ''
    const locale = body.locale ?? ''

    if (!(sourceTable in SOURCE_PAYLOAD_COLUMN)) {
      return jsonResponse({ error: 'unsupported source_table' }, 400)
    }
    if (!sourceId) return jsonResponse({ error: 'source_id is required' }, 400)
    if (!locale || locale === 'en') {
      return jsonResponse({ error: 'a non-English target locale is required' }, 400)
    }

    const admin = getAdminClient()

    // Idempotent: if we already cached this (row, locale), return it.
    const { data: existing } = await admin
      .from('content_translations')
      .select('payload')
      .eq('source_table', sourceTable)
      .eq('source_id', sourceId)
      .eq('locale', locale)
      .maybeSingle()
    if (existing) {
      return jsonResponse({ cached: true, payload: existing.payload }, 200)
    }

    const column = SOURCE_PAYLOAD_COLUMN[sourceTable]
    const { data: row, error: rowErr } = await admin
      .from(sourceTable)
      .select(column)
      .eq('id', sourceId)
      .maybeSingle()
    if (rowErr || !row) return jsonResponse({ error: 'source row not found' }, 404)

    const englishPayload = (row as Record<string, unknown>)[column]
    if (englishPayload == null || typeof englishPayload !== 'object') {
      return jsonResponse({ error: 'source row has no payload to translate' }, 404)
    }

    const strings = collectStrings(englishPayload)
    if (strings.length === 0) {
      // Nothing to translate — cache an empty lookup so we never re-try.
      await admin.from('content_translations').upsert({
        source_table: sourceTable,
        source_id: sourceId,
        locale,
        payload: {},
      })
      return jsonResponse({ cached: false, payload: {} }, 200)
    }
    if (strings.length > MAX_ITEMS) {
      return jsonResponse({ error: 'payload too large to translate' }, 413)
    }

    const willCallReal = !!Deno.env.get('ANTHROPIC_API_KEY')
    const runId = await recordRunStart({
      orchestratorName: 'TranslateOrchestrator',
      agentVersion: willCallReal ? 'real-v1' : 'mock-v1',
      model: willCallReal ? 'claude-haiku-4-5-20251001' : 'mock',
      inputPayload: {
        source_table: sourceTable,
        source_id: sourceId,
        locale,
        item_count: strings.length,
      },
      userId: user.id,
    })

    let result
    try {
      result = await runTranslate(
        strings.map((s) => ({ id: s.path, text: s.text })),
        locale
      )
    } catch (err) {
      await recordRunError(runId, err instanceof Error ? err.message : String(err))
      if (err instanceof OrchestratorPausedError) {
        return jsonResponse({ error: err.message }, 503)
      }
      throw err
    }

    const parsed = TranslateResponseSchema.safeParse(result.output)
    if (!parsed.success) {
      await recordRunError(runId, 'translation output failed validation')
      return jsonResponse({ error: 'translation failed' }, 502)
    }

    // Build the flat path -> translated-text lookup that Phase B merges over the
    // English payload. Only keep ids we actually asked for.
    const requested = new Set(strings.map((s) => s.path))
    const lookup: Record<string, string> = {}
    for (const item of parsed.data.items) {
      if (requested.has(item.id)) lookup[item.id] = item.text
    }

    await admin.from('content_translations').upsert({
      source_table: sourceTable,
      source_id: sourceId,
      locale,
      payload: lookup,
    })

    await recordRunSuccess(runId, {
      outputPayload: result.output,
      validatedOutput: parsed.data,
      tokensInput: result.usage?.input_tokens,
      tokensOutput: result.usage?.output_tokens,
      estimatedCost: result.usage?.cost_usd ?? 0,
    })

    return jsonResponse({ cached: false, payload: lookup }, 200)
  } catch (err) {
    if (err instanceof UnauthorizedError) return jsonResponse({ error: err.message }, 401)
    if (err instanceof ForbiddenError) return jsonResponse({ error: err.message }, 403)
    return jsonResponse({ error: 'Internal error' }, 500)
  }
})
