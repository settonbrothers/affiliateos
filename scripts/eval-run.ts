// scripts/eval-run.ts
// Replay the active Underwriting prompt against the golden set for a vertical,
// compare verdicts, write the result to eval_runs.
//
// Usage:
//   pnpm eval:run                            # UnderwritingOrchestrator vs ai_saas
//   pnpm eval:run --vertical health          # other vertical
//   pnpm eval:run --orchestrator Foo --trigger pre_publish
//
// Requires ANTHROPIC_API_KEY in .env.local (or environment).

import { readFileSync } from 'node:fs'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { UnderwritingResponseSchema } from '../src/types/agents/underwriting'
import type { Database } from '../src/types/database'

type Args = {
  orchestrator: string
  vertical: string
  trigger: 'manual' | 'cron' | 'pre_publish'
  model: string
}

function parseArgs(): Args {
  const out: Args = {
    orchestrator: 'UnderwritingOrchestrator',
    vertical: 'ai_saas',
    trigger: 'manual',
    model: 'claude-sonnet-4-6',
  }
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (flag === '--orchestrator' && value) {
      out.orchestrator = value
      i++
    } else if (flag === '--vertical' && value) {
      out.vertical = value
      i++
    } else if (flag === '--trigger' && value) {
      out.trigger = value as Args['trigger']
      i++
    } else if (flag === '--model' && value) {
      out.model = value
      i++
    }
  }
  return out
}

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {}
  try {
    for (const line of readFileSync('.env.local', 'utf-8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/)
      if (m && m[1] && m[2] !== undefined) env[m[1]] = m[2]
    }
  } catch {
    // .env.local optional; fall back to process.env
  }
  return env
}

const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
}

const args = parseArgs()
const env = loadEnv()

const SUPABASE_URL =
  env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE =
  env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY =
  env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error(
    'eval:run: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required (in .env.local or env)'
  )
  process.exit(1)
}
if (!ANTHROPIC_KEY) {
  console.error(
    'eval:run: ANTHROPIC_API_KEY required (in .env.local or env) — set it to run an eval'
  )
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
})
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })

// Load the active prompt (global vertical only — vertical-specific support
// would require a small extension here).
const { data: prompt, error: promptErr } = await supabase
  .from('prompts')
  .select('id, content, version')
  .eq('orchestrator_name', args.orchestrator)
  .eq('prompt_type', 'main')
  .eq('is_active', true)
  .is('vertical_id', null)
  .maybeSingle()
if (promptErr || !prompt) {
  console.error(`No active prompt for ${args.orchestrator}.`)
  process.exit(1)
}

const { data: vertical } = await supabase
  .from('verticals')
  .select('id')
  .eq('slug', args.vertical)
  .maybeSingle()
if (!vertical) {
  console.error(`Vertical ${args.vertical} not found.`)
  process.exit(1)
}

const { data: goldens } = await supabase
  .from('golden_set_offers')
  .select(
    'id, external_id, offer_name, offer_url, facts_snapshot, expected_verdict'
  )
  .eq('vertical_id', vertical.id)
  .order('external_id', { ascending: true })
if (!goldens || goldens.length === 0) {
  console.error(`No golden offers for vertical ${args.vertical}.`)
  console.error(
    `Seed golden_set_offers via SQL editor or admin UI (TODO) before running eval.`
  )
  process.exit(1)
}

console.log(
  `Eval: ${args.orchestrator} (prompt ${prompt.version}) vs ${goldens.length} golden offer(s) in vertical=${args.vertical} using ${args.model}.`
)

const tool: Anthropic.Tool = {
  name: 'submit_underwriting_decision',
  description:
    'Submit the complete underwriting evaluation for this offer. Call this tool exactly once.',
  input_schema: zodToJsonSchema(UnderwritingResponseSchema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  }) as Anthropic.Tool['input_schema'],
}

const startedAt = new Date()
const results: Array<Record<string, unknown>> = []
let matchedVerdict = 0
let totalCost = 0
let totalInputTokens = 0
let totalOutputTokens = 0

for (const g of goldens) {
  const label = g.external_id ?? g.offer_name
  process.stdout.write(`  ${label.padEnd(30)} `)

  const userMessage = JSON.stringify(
    {
      offer_id: g.id,
      offer_name: g.offer_name,
      offer_url: g.offer_url,
      vertical: args.vertical,
      facts: g.facts_snapshot,
    },
    null,
    2
  )

  try {
    const resp = await anthropic.messages.create({
      model: args.model,
      max_tokens: 4096,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      system: prompt.content,
      messages: [{ role: 'user', content: userMessage }],
    })

    const toolUse = resp.content.find((c) => c.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new Error('No tool_use in response')
    }
    const parsed = UnderwritingResponseSchema.parse(toolUse.input)

    const verdictMatch = parsed.payload.verdict === g.expected_verdict
    if (verdictMatch) matchedVerdict++

    const pricing = PRICING_USD_PER_MTOK[args.model] ?? { input: 0, output: 0 }
    const cost =
      (resp.usage.input_tokens / 1_000_000) * pricing.input +
      (resp.usage.output_tokens / 1_000_000) * pricing.output
    totalCost += cost
    totalInputTokens += resp.usage.input_tokens
    totalOutputTokens += resp.usage.output_tokens

    results.push({
      golden_id: g.id,
      external_id: g.external_id,
      offer_name: g.offer_name,
      expected_verdict: g.expected_verdict,
      actual_verdict: parsed.payload.verdict,
      actual_weighted_score: parsed.payload.weighted_score,
      verdict_match: verdictMatch,
      input_tokens: resp.usage.input_tokens,
      output_tokens: resp.usage.output_tokens,
      cost_usd: cost,
    })

    console.log(
      `${verdictMatch ? '✓' : '✗'} got=${parsed.payload.verdict} expected=${g.expected_verdict}  $${cost.toFixed(4)}`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.log(`ERROR: ${msg}`)
    results.push({
      golden_id: g.id,
      external_id: g.external_id,
      offer_name: g.offer_name,
      expected_verdict: g.expected_verdict,
      error: msg,
    })
  }
}

const accuracyPct =
  goldens.length > 0
    ? Math.round((matchedVerdict / goldens.length) * 10000) / 100
    : 0

console.log('')
console.log(`Verdict accuracy: ${matchedVerdict}/${goldens.length} (${accuracyPct}%)`)
console.log(`Tokens: ${totalInputTokens} in / ${totalOutputTokens} out`)
console.log(`Total cost: $${totalCost.toFixed(4)}`)

// Round-trip through JSON so the typed `details: Json | undefined` insert is
// happy with our nested Record<string, unknown>[] results.
const detailsJson = JSON.parse(
  JSON.stringify({
    vertical: args.vertical,
    orchestrator: args.orchestrator,
    model: args.model,
    prompt_version: prompt.version,
    tokens_input: totalInputTokens,
    tokens_output: totalOutputTokens,
    results,
  })
)

const { data: inserted, error: insErr } = await supabase
  .from('eval_runs')
  .insert({
    prompt_id: prompt.id,
    trigger_type: args.trigger,
    total_offers: goldens.length,
    matched_verdict_count: matchedVerdict,
    matched_score_range_count: 0, // TODO: parse expected_score_range, compare
    matched_risk_flags_count: 0, // TODO: compare expected_risk_flags
    accuracy_pct: accuracyPct,
    details: detailsJson,
    total_cost_usd: totalCost,
    started_at: startedAt.toISOString(),
    completed_at: new Date().toISOString(),
  })
  .select('id')
  .single()

if (insErr) {
  console.error(`eval_runs insert failed: ${insErr.message}`)
  process.exit(1)
}
console.log(`eval_runs row written: ${inserted.id}`)
