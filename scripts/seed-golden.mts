// scripts/seed-golden.mts
// Seed the golden set with real, well-known affiliate offers.
//
// For each curated offer it fetches the page, runs the ACTIVE
// SourceExtractionOrchestrator prompt (Haiku) to build a facts_snapshot in the
// same shape as extracted_facts rows, and upserts a golden_set_offers row.
//
// IMPORTANT — methodology:
//   `expected_verdict` here is a *candidate placeholder* (a human-style guess by
//   whoever curated the list), NOT ground truth. The eval measures the
//   UnderwritingOrchestrator against expected_verdict, so a real >75% number is
//   only meaningful AFTER the owner ratifies/corrects each verdict in
//   /admin/eval/golden. Facts are model-extracted; verdicts must be owner-set.
//
// Usage:
//   pnpm tsx scripts/seed-golden.mts                 # seed all (ai_saas)
//   pnpm tsx scripts/seed-golden.mts --limit 5       # first 5 only
//   pnpm tsx scripts/seed-golden.mts --dry-run       # fetch+extract, no DB write
//
// Requires ANTHROPIC_API_KEY + SUPABASE_SERVICE_ROLE_KEY in .env.local (or env).

import { readFileSync } from 'node:fs'

import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

import { UniversalEnvelopeSchema } from '../src/types/agents/envelope'
import type { Database, Json } from '../src/types/database'

// --- Extraction schema (mirrors supabase/functions/_shared/types/sourceExtraction.ts).
// Kept inline so this Node script doesn't import the Deno (npm:zod) module.
const FACT_TYPES = [
  'commission_value',
  'commission_type',
  'payout_delay',
  'cookie_duration',
  'traffic_rule_paid_social',
  'traffic_rule_google',
  'traffic_rule_native',
  'traffic_rule_youtube',
  'traffic_rule_brand_bidding',
  'traffic_rule_direct_link',
  'traffic_rule_email',
  'traffic_rule_seo',
  'traffic_rule_organic_social',
  'allowed_geo',
  'restricted_geo',
  'cap',
  'refund_policy',
  'compliance_claim',
  'pricing_aov',
  'minimum_payout',
  'contact',
  'other',
] as const

const DOC_TYPES = [
  'product_page',
  'pricing_page',
  'affiliate_terms',
  'checkout_page',
  'review_page',
  'ad_example',
  'landing_page',
  'manual_note',
  'unknown',
] as const

const ExtractedFactSchema = z.object({
  fact_type: z.enum(FACT_TYPES),
  fact_value: z.string(),
  source_quote: z.string(),
  confidence_score: z.number().int().min(0).max(100),
})

const SourceExtractionPayloadSchema = z.object({
  doc_type: z.enum(DOC_TYPES),
  source_summary: z.string(),
  language: z.string(),
  source_reliability_score: z.number().int().min(0).max(100),
  facts: z.array(ExtractedFactSchema).max(30),
  detected_claims: z.array(
    z.object({ claim_text: z.string(), claim_type: z.string() })
  ),
})

const SourceExtractionResponseSchema = UniversalEnvelopeSchema.extend({
  payload: SourceExtractionPayloadSchema,
})

// Lenient validation: we only consume `payload` (facts_snapshot). The
// envelope-level `facts` array (different shape) is sometimes returned
// malformed by Haiku and we don't use it here, so validate payload only.
const PayloadOnlySchema = z.object({ payload: SourceExtractionPayloadSchema })

// --- Curated offers. `verdict` is a CANDIDATE placeholder for owner review.
//
// `seed_text` is a concise, publicly-known summary of each program's affiliate
// terms. It is the robust source for fact extraction: affiliate commission /
// cookie / payout terms live on program pages (not marketing homepages), and
// many of those pages block bots or are JS-only shells. We try a live fetch
// first; when it yields < MIN_FACTS facts (thin/marketing page) or fails
// (403/timeout), we extract from `seed_text` instead. Facts are NOT the thing
// under test — the owner ratifies each `verdict` — so curated source text is a
// sound, reliable input for the golden set.
type SeedOffer = {
  external_id: string
  offer_name: string
  url: string
  vertical: string
  verdict: string // placeholder — owner ratifies in /admin/eval/golden
  seed_text: string
}

const OFFERS: SeedOffer[] = [
  {
    external_id: 'gold-001',
    offer_name: 'Jasper AI',
    url: 'https://www.jasper.ai/',
    vertical: 'ai_saas',
    verdict: 'small_paid_test',
    seed_text:
      'Jasper AI affiliate program (managed via PartnerStack). Commission: 25% recurring on every paid subscription for the lifetime of the referred customer. Cookie window: 30 days. Payouts: monthly via PayPal or Stripe once the balance clears the $25 minimum, with a net-30 hold. Product: AI writing/marketing copy SaaS; plans roughly $39-125/month, so average order value is mid. Traffic rules: paid search on the "Jasper" brand trademark is prohibited; SEO, YouTube, email and content marketing are allowed. Global program, English-first.',
  },
  {
    external_id: 'gold-002',
    offer_name: 'Surfshark VPN',
    url: 'https://surfshark.com/',
    vertical: 'ai_saas',
    verdict: 'strong_test',
    seed_text:
      'Surfshark VPN affiliate program. Commission: 40% on every new sale plus renewals. Cookie window: 30 days. High average order value because most conversions are 24-month prepaid plans. Payouts via the affiliate network monthly, $100 minimum. Traffic rules: paid social and native ads allowed; bidding on the "Surfshark" brand term in paid search is prohibited; incentivized traffic not allowed. Global program.',
  },
  {
    external_id: 'gold-003',
    offer_name: 'NordVPN',
    url: 'https://nordvpn.com/affiliate-program/',
    vertical: 'ai_saas',
    verdict: 'strong_test',
    seed_text:
      'NordVPN affiliate program (via Impact / in-house). Commission: 40-100% on new subscriptions depending on plan length, plus 30% on renewals. Cookie window: 30 days. Average order value is high on 2-year plans. Payouts monthly via the network. Traffic rules: brand-term bidding in paid search prohibited; coupon/deal and content sites allowed; no incentivized or adult traffic. Global program.',
  },
  {
    external_id: 'gold-004',
    offer_name: 'Semrush',
    url: 'https://www.semrush.com/lp/affiliate-program/en/',
    vertical: 'ai_saas',
    verdict: 'strong_test',
    seed_text:
      'Semrush affiliate program "BeRush" (via Impact). Commission: $200 flat per new subscription sale, plus $10 for every free-trial activation and $0.01 per new signup (last-click). Cookie window: 120 days. Product: SEO/marketing SaaS, plans $139-499/month, high AOV. Payouts monthly via Impact, $50 minimum. Traffic rules: brand bidding on "Semrush" prohibited; SEO, content and YouTube encouraged. Global.',
  },
  {
    external_id: 'gold-005',
    offer_name: 'Hostinger',
    url: 'https://www.hostinger.com/affiliates',
    vertical: 'ai_saas',
    verdict: 'strong_test',
    seed_text:
      'Hostinger affiliate program. Commission: 60% on hosting plan purchases, single-payment plans so payout per sale is solid. Cookie window: 30 days. Payouts via PayPal/bank, $100 minimum, net-45 approval hold. Traffic rules: no brand-term PPC bidding, no self-referrals, no coupon-injection; content/SEO/YouTube allowed. Global program, many languages.',
  },
  {
    external_id: 'gold-006',
    offer_name: 'Grammarly',
    url: 'https://www.grammarly.com/affiliates',
    vertical: 'ai_saas',
    verdict: 'small_paid_test',
    seed_text:
      'Grammarly affiliate program (via CJ Affiliate / PartnerStack). Commission: ~$20 bounty per new Premium upgrade plus ~$0.20 per free account registration. Cookie window: 90 days. Free product with a freemium upsell, so volume is high but per-conversion value is modest. Payouts monthly via the network, $50 minimum. Traffic rules: no brand bidding; content and education sites encouraged. Global, English-first.',
  },
  {
    external_id: 'gold-007',
    offer_name: 'ClickUp',
    url: 'https://clickup.com/affiliate',
    vertical: 'ai_saas',
    verdict: 'small_paid_test',
    seed_text:
      'ClickUp affiliate program. Commission: 20% recurring for the first 12 months of each referred paid workspace. Cookie window: 90 days. Product: project-management SaaS with a generous free tier, paid plans ~$7-19/seat/month, so AOV depends on seat count. Payouts monthly via PayPal, $50 minimum. Traffic rules: no brand-term PPC; content, YouTube and email allowed. Global.',
  },
  {
    external_id: 'gold-008',
    offer_name: 'Shopify',
    url: 'https://www.shopify.com/affiliates',
    vertical: 'ai_saas',
    verdict: 'small_paid_test',
    seed_text:
      'Shopify affiliate program (via Impact). Commission: fixed bounty of roughly $25-150 per merchant who signs up for a paid plan (no recurring). Cookie window: 30 days. High-intent but the referred user must build and launch a store, so approval lag and conversion friction are real. Payouts via Impact bi-weekly, $10 minimum. Traffic rules: brand bidding prohibited; content/education/YouTube allowed; no incentivized signups. Global.',
  },
  {
    external_id: 'gold-009',
    offer_name: 'ElevenLabs',
    url: 'https://elevenlabs.io/affiliates',
    vertical: 'ai_saas',
    verdict: 'small_paid_test',
    seed_text:
      'ElevenLabs affiliate program (via FirstPromoter). Commission: 22% recurring for the first 12 months on referred paid subscriptions. Cookie window: 30 days. Product: AI voice/text-to-speech SaaS, plans $5-99/month, mid AOV, fast-growing niche. Payouts monthly via PayPal, $50 minimum. Traffic rules: no brand bidding; content, YouTube and developer audiences encouraged. Global.',
  },
  {
    external_id: 'gold-010',
    offer_name: 'Fiverr',
    url: 'https://affiliates.fiverr.com/',
    vertical: 'ai_saas',
    verdict: 'small_paid_test',
    seed_text:
      'Fiverr affiliate program. Commission models: dynamic CPA $15-150 per first-time buyer depending on the category purchased, OR a $10 CPA + 10% revenue-share hybrid for 12 months. Cookie window: 30 days, first-time buyers only. Payouts monthly via PayPal/Payoneer, $100 minimum, net-30. Traffic rules: brand bidding restricted; content, YouTube and social allowed; no incentivized clicks. Global marketplace.',
  },
  {
    external_id: 'gold-011',
    offer_name: 'Coursera',
    url: 'https://about.coursera.org/affiliates',
    vertical: 'ai_saas',
    verdict: 'organic_only',
    seed_text:
      'Coursera affiliate program (via Impact / Rakuten). Commission: 10-45% on eligible course and certificate purchases, variable by product. Cookie window: 30 days. Many courses are free to audit, so paid-conversion rate is low and average order value is modest. Payouts via the network, $50 minimum. Traffic rules: no brand bidding; education/content/SEO encouraged. Global.',
  },
  {
    external_id: 'gold-012',
    offer_name: 'Canva',
    url: 'https://www.canva.com/affiliates/',
    vertical: 'ai_saas',
    verdict: 'watch',
    seed_text:
      'Canva affiliate program (via Impact / PartnerStack). Commission: up to $36 for each new Canva Pro subscriber; nothing for free signups. Cookie window: 30 days. Canva is overwhelmingly used on the free tier, so free-to-Pro conversion is low and the effective payout per click is thin. Payouts monthly via the network. Traffic rules: no brand bidding; design/content/education audiences only. Global.',
  },
  {
    external_id: 'gold-013',
    offer_name: 'Notion',
    url: 'https://www.notion.so/affiliates',
    vertical: 'ai_saas',
    verdict: 'watch',
    seed_text:
      'Notion affiliate program. Commission: 50% recurring for the first 12 months on referred paid plans. Cookie window: 90 days. The catch: Notion has a very generous free tier and most users never upgrade, so paid-conversion volume is low despite the headline rate; AOV is also low ($8-15/seat). Payouts monthly via PayPal, $50 minimum. Traffic rules: no brand bidding; content/YouTube/templates encouraged. Global.',
  },
  {
    external_id: 'gold-014',
    offer_name: 'Honeygain',
    url: 'https://www.honeygain.com/affiliates/',
    vertical: 'ai_saas',
    verdict: 'watch',
    seed_text:
      'Honeygain affiliate/referral program. Honeygain is a passive-income app that sells the user\'s unused bandwidth. Reward: $5 credit per referred user plus 10% lifetime revenue-share on what they earn. Cookie/attribution is account-based. The traffic this attracts is heavily incentive-driven and low-quality, and bandwidth-sharing apps draw compliance/abuse scrutiny. Payouts via PayPal/crypto, $20 minimum. Often flagged for fraud risk. Global.',
  },
  {
    external_id: 'gold-015',
    offer_name: 'Coinbase',
    url: 'https://www.coinbase.com/affiliates',
    vertical: 'ai_saas',
    verdict: 'small_paid_test',
    seed_text:
      'Coinbase affiliate program (via Impact). Commission: 50% of the trading fees generated by each referred user for their first 3 months. Cookie window: 30 days. Crypto is a regulated, compliance-sensitive vertical with geo restrictions (program not available in some regions) and high scrutiny on financial-promotion claims. Payouts via Impact in USDC/fiat. Traffic rules: no misleading financial claims, no brand bidding, strict geo gating. Variable.',
  },
  {
    external_id: 'gold-016',
    offer_name: 'Coursera Plus (low-fit example)',
    url: 'https://www.coursera.org/courseraplus',
    vertical: 'ai_saas',
    verdict: 'organic_only',
    seed_text:
      'Coursera Plus is an annual education subscription (~$399/year or ~$59/month) bundled into the Coursera affiliate program (via Impact). Commission: low single-to-double-digit percentage on the subscription. Cookie window: 30 days. Education subscriptions convert slowly and audit-for-free cannibalizes paid intent, so paid-traffic economics are marginal. Payouts via Impact, $50 minimum. Traffic rules: no brand bidding; SEO/content/education only. Global.',
  },
]

type Args = { limit: number; dryRun: boolean; model: string }

function parseArgs(): Args {
  const out: Args = { limit: Infinity, dryRun: false, model: 'claude-haiku-4-5-20251001' }
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i]
    const value = argv[i + 1]
    if (flag === '--limit' && value) {
      out.limit = Number(value)
      i++
    } else if (flag === '--dry-run') {
      out.dryRun = true
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

function stripHtml(s: string): string {
  return s
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const FETCH_TIMEOUT_MS = 15_000
const MAX_RAW_TEXT_FOR_LLM = 100_000

async function fetchText(url: string): Promise<string> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
      },
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

const args = parseArgs()
const env = loadEnv()

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY ?? process.env.ANTHROPIC_API_KEY

if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error('seed-golden: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required.')
  process.exit(1)
}
if (!ANTHROPIC_KEY) {
  console.error('seed-golden: ANTHROPIC_API_KEY required (in .env.local or env).')
  process.exit(1)
}

const supabase = createClient<Database>(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
})
const anthropic = new Anthropic({ apiKey: ANTHROPIC_KEY })

// Load the active SourceExtraction prompt (global vertical).
const { data: prompt, error: promptErr } = await supabase
  .from('prompts')
  .select('content, version')
  .eq('orchestrator_name', 'SourceExtractionOrchestrator')
  .eq('prompt_type', 'main')
  .eq('is_active', true)
  .is('vertical_id', null)
  .maybeSingle()
if (promptErr || !prompt) {
  console.error('seed-golden: no active SourceExtractionOrchestrator prompt. Run `pnpm prompts:sync` first.')
  process.exit(1)
}

// Resolve vertical ids for the slugs we use.
const slugs = [...new Set(OFFERS.map((o) => o.vertical))]
const verticalIdBySlug = new Map<string, string>()
for (const slug of slugs) {
  const { data: v } = await supabase.from('verticals').select('id').eq('slug', slug).maybeSingle()
  if (!v) {
    console.error(`seed-golden: vertical '${slug}' not found.`)
    process.exit(1)
  }
  verticalIdBySlug.set(slug, v.id)
}

const tool: Anthropic.Tool = {
  name: 'submit_extraction',
  description:
    'Submit the structured extraction of facts + summary from the page. Call this tool exactly once.',
  input_schema: zodToJsonSchema(SourceExtractionResponseSchema, {
    target: 'jsonSchema7',
    $refStrategy: 'none',
  }) as Anthropic.Tool['input_schema'],
}

const PRICING_USD_PER_MTOK: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
}

// A live page yielding fewer than this many facts is treated as a thin/marketing
// shell and we fall back to the curated seed_text.
const MIN_FACTS = 2

type ExtractResult = { facts: Json; count: number; cost: number }

async function extract(url: string, sourceText: string): Promise<ExtractResult> {
  const userMessage = JSON.stringify(
    { url, raw_text: sourceText.slice(0, MAX_RAW_TEXT_FOR_LLM) },
    null,
    2
  )
  const resp = await anthropic.messages.create({
    model: args.model,
    max_tokens: 4096,
    tools: [tool],
    tool_choice: { type: 'tool', name: tool.name },
    system: prompt.content,
    messages: [{ role: 'user', content: userMessage }],
  })
  const toolUse = resp.content.find((c) => c.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') throw new Error('no tool_use in response')
  const parsed = PayloadOnlySchema.parse(toolUse.input)
  const pricing = PRICING_USD_PER_MTOK[args.model] ?? { input: 0, output: 0 }
  const cost =
    (resp.usage.input_tokens / 1_000_000) * pricing.input +
    (resp.usage.output_tokens / 1_000_000) * pricing.output
  return {
    facts: JSON.parse(JSON.stringify(parsed.payload.facts)) as Json,
    count: parsed.payload.facts.length,
    cost,
  }
}

const todo = OFFERS.slice(0, args.limit === Infinity ? OFFERS.length : args.limit)
console.log(
  `Seeding ${todo.length} golden offer(s) using ${args.model} (prompt ${prompt.version})${args.dryRun ? ' [DRY RUN]' : ''}.`
)

let seeded = 0
let failed = 0
let totalCost = 0

for (const offer of todo) {
  process.stdout.write(`  ${offer.external_id} ${offer.offer_name.padEnd(28)} `)

  // Try the live page first; fall back to curated seed_text when the page is
  // blocked (403/timeout) or too thin, or when it yields too few facts.
  let liveText: string | null = null
  try {
    const t = stripHtml(await fetchText(offer.url))
    if (t.length >= 200) liveText = t
  } catch {
    liveText = null
  }

  // Live attempt is best-effort: a parse error or low yield falls through to
  // the curated seed_text (which itself gets one retry on transient failure).
  let liveResult: ExtractResult | null = null
  if (liveText) {
    try {
      const live = await extract(offer.url, liveText)
      totalCost += live.cost
      if (live.count >= MIN_FACTS) liveResult = live
    } catch {
      liveResult = null
    }
  }

  let payloadFacts: Json
  let factCount = 0
  let source: 'live' | 'seed' = 'seed'
  if (liveResult) {
    payloadFacts = liveResult.facts
    factCount = liveResult.count
    source = 'live'
  } else {
    let seed: ExtractResult | null = null
    for (let attempt = 0; attempt < 2 && !seed; attempt++) {
      try {
        seed = await extract(offer.url, offer.seed_text)
      } catch (err) {
        if (attempt === 1) {
          console.log(`SKIP extract: ${err instanceof Error ? err.message : String(err)}`)
        }
      }
    }
    if (!seed) {
      failed++
      continue
    }
    totalCost += seed.cost
    payloadFacts = seed.facts
    factCount = seed.count
    source = 'seed'
  }

  if (args.dryRun) {
    console.log(`ok (${factCount} facts, ${source}) [dry-run, not written]`)
    seeded++
    continue
  }

  const { error: upErr } = await supabase.from('golden_set_offers').upsert(
    {
      external_id: offer.external_id,
      offer_name: offer.offer_name,
      vertical_id: verticalIdBySlug.get(offer.vertical)!,
      offer_url: offer.url,
      facts_snapshot: payloadFacts,
      expected_verdict: offer.verdict,
      notes:
        `Seeded by scripts/seed-golden.mts. Facts: Haiku-extracted from ${source === 'live' ? 'the live page' : 'curated public affiliate-terms text'}. ` +
        'expected_verdict is a CANDIDATE PLACEHOLDER — owner must ratify/correct it before the accuracy number is meaningful.',
    },
    { onConflict: 'external_id' }
  )
  if (upErr) {
    console.log(`DB ERROR: ${upErr.message}`)
    failed++
    continue
  }
  console.log(`ok (${factCount} facts, ${source}, candidate=${offer.verdict})`)
  seeded++
}

console.log('')
console.log(`Seeded: ${seeded}  Failed/skipped: ${failed}  Extraction cost: $${totalCost.toFixed(4)}`)
if (!args.dryRun && seeded > 0) {
  console.log('Next: ratify expected_verdict in /admin/eval/golden, then run `pnpm eval:run`.')
}
