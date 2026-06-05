// Seed a starter golden set with AI-DRAFTED, PROVISIONAL verdicts (apply the
// underwriting hard rules to recognizable offers). They make cron drift-detection
// work now; review/adjust them in /admin/eval/golden to turn them into real
// ground truth. Re-runnable: clears prior gold-* rows first.
//   node scripts/seed-golden.mjs          # seed
//   node scripts/seed-golden.mjs clean    # remove gold-* rows
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const NOTE = 'AI-drafted provisional label — review and adjust to make it real ground truth.'
const f = (fact_type, fact_value, source_quote, confidence_score = 80) => ({
  fact_type,
  fact_value,
  source_quote,
  confidence_score,
})

// vertical slug -> offers. Verdicts apply the prompt's hard rules.
const SET = {
  ai_saas: [
    {
      ext: 'gold-001',
      name: 'Jasper.ai',
      verdict: 'small_paid_test',
      facts: [
        f('commission_value', '30% recurring', 'Earn 30% recurring commission'),
        f('cookie_duration', '30 days', '30-day cookie window'),
        f('allowed_geo', 'US, CA, UK, AU', 'Global affiliate program'),
        f('payout_delay', 'net-30', 'Paid net-30'),
      ],
    },
    {
      ext: 'gold-002',
      name: 'Shopify',
      verdict: 'small_paid_test',
      facts: [
        f('commission_value', '$150 one-time bounty', 'Up to $150 per referral'),
        f('cookie_duration', '30 days', '30-day cookie'),
        f('allowed_geo', 'Global', 'Worldwide program', 70),
      ],
    },
    {
      ext: 'gold-003',
      name: 'ClickFunnels',
      verdict: 'small_paid_test',
      facts: [
        f('commission_value', '30% recurring', '30% lifetime recurring'),
        f('cookie_duration', '45 days', '45-day cookie'),
      ],
    },
    {
      ext: 'gold-004',
      name: 'Notion',
      verdict: 'watch',
      facts: [
        f('commission_value', '50% first year, capped', 'Up to 50% in year one'),
        f('cap', 'low conversion to paid (freemium)', 'Generous free tier', 70),
      ],
    },
    {
      ext: 'gold-005',
      name: 'Grammarly',
      verdict: 'small_paid_test',
      facts: [
        f('commission_value', '$20 per sale + $0.20 per signup', '$20 CPA'),
        f('competition', 'highly saturated', 'Very competitive keyword space', 70),
      ],
    },
    {
      ext: 'gold-006',
      name: 'NordVPN',
      verdict: 'small_paid_test',
      facts: [
        f('commission_value', '40-100% first order', 'Up to 100% on first order'),
        f('allowed_geo', 'Global', 'Worldwide', 70),
        f('cookie_duration', '30 days', '30-day cookie'),
      ],
    },
    {
      ext: 'gold-007',
      name: 'Semrush',
      verdict: 'small_paid_test',
      facts: [
        f('commission_value', '$200 per sale', '$200 per new subscription'),
        f('cookie_duration', '120 days', '120-day cookie'),
      ],
    },
    {
      ext: 'gold-008',
      name: 'AI Profit Blueprint (course)',
      verdict: 'reject',
      facts: [
        f('compliance_claim', 'Guaranteed $10k/month', 'Make $10,000/month guaranteed', 90),
        f('commission_value', '50% high-ticket', '50% of $997'),
      ],
      risk: ['income_promise'],
    },
    {
      ext: 'gold-009',
      name: 'Unknown no-name AI tool',
      verdict: 'watch',
      facts: [
        f('offer_trust', 'unknown vendor, no track record', 'New brand, no public reviews', 40),
        f('commission_value', 'unclear', 'Payout not stated', 40),
      ],
    },
    {
      ext: 'gold-010',
      name: 'SaaS with undisclosed paid-traffic rules',
      verdict: 'small_paid_test',
      facts: [
        f('commission_value', '25% recurring', '25% recurring'),
        f('traffic_rule_brand_bidding', 'forbidden', 'No brand bidding allowed'),
        f('traffic_rule_paid_social', 'unknown', 'Paid social rules not specified', 50),
      ],
    },
    {
      ext: 'gold-011',
      name: 'Thin one-time $5 SaaS',
      verdict: 'watch',
      facts: [
        f('commission_value', '$5 one-time', '$5 per sale, one time'),
        f('cookie_duration', '24 hours', '24-hour cookie'),
      ],
    },
    {
      ext: 'gold-012',
      name: 'Webflow',
      verdict: 'small_paid_test',
      facts: [
        f('commission_value', '50% recurring (1 year)', '50% for 12 months'),
        f('competition', 'niche designer audience', 'Designer/agency niche', 70),
      ],
    },
  ],
  health: [
    {
      ext: 'gold-013',
      name: 'LiverDetox Pro',
      verdict: 'reject',
      facts: [
        f('compliance_claim', 'reverses fatty liver disease', 'Detoxifies and reverses fatty liver disease', 90),
        f('commission_value', '40% per sale', '40% commission'),
      ],
      risk: ['medical_claim'],
    },
    {
      ext: 'gold-014',
      name: 'Collagen beauty supplement (cosmetic)',
      verdict: 'small_paid_test',
      facts: [
        f('commission_value', '25% recurring', '25% subscribe & save'),
        f('compliance_claim', 'supports skin/hair (cosmetic, no disease)', 'Supports healthy skin and hair', 70),
      ],
    },
    {
      ext: 'gold-015',
      name: 'Keto Melt (burn fat overnight)',
      verdict: 'reject',
      facts: [
        f('compliance_claim', 'burn fat overnight, before/after', 'Melt fat fast — see before & after', 90),
      ],
      risk: ['weight_loss', 'before_after'],
    },
  ],
  mental_wellness: [
    {
      ext: 'gold-016',
      name: 'BetterMind licensed therapy platform',
      verdict: 'small_paid_test',
      facts: [
        f('commission_value', '$100 per signup', '$100 per subscriber'),
        f('compliance_claim', 'licensed therapists (compliant framing)', 'Connect with licensed therapists', 75),
      ],
    },
    {
      ext: 'gold-017',
      name: 'AnxietyGone supplement (cures anxiety)',
      verdict: 'reject',
      facts: [
        f('compliance_claim', 'cures anxiety and depression', 'Cure your anxiety and depression naturally', 90),
      ],
      risk: ['mental_health', 'anxiety_depression'],
    },
  ],
}

const mode = process.argv[2]

if (mode === 'clean') {
  const { error } = await admin.from('golden_set_offers').delete().like('external_id', 'gold-%')
  if (error) throw error
  console.log('Removed gold-* golden offers.')
  process.exit(0)
}

await admin.from('golden_set_offers').delete().like('external_id', 'gold-%')

let inserted = 0
for (const [slug, offers] of Object.entries(SET)) {
  const { data: v } = await admin.from('verticals').select('id').eq('slug', slug).single()
  const rows = offers.map((o) => ({
    external_id: o.ext,
    vertical_id: v.id,
    offer_name: o.name,
    facts_snapshot: o.facts,
    expected_verdict: o.verdict,
    expected_risk_flags: o.risk ?? null,
    notes: NOTE,
  }))
  const { error } = await admin.from('golden_set_offers').insert(rows)
  if (error) throw error
  inserted += rows.length
  console.log(`  ${slug}: ${rows.length} offers`)
}
console.log(`\nSeeded ${inserted} provisional golden offers. Review in /admin/eval/golden.`)
