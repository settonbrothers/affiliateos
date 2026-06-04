// Seeds/cleans a tiny DEMO golden set (ai_saas) to prove the eval harness runs
// end-to-end. These labels are placeholders — NOT real ground truth.
//   node scripts/golden-demo.mjs seed
//   node scripts/golden-demo.mjs clean            # removes demo-* golden rows
//   node scripts/golden-demo.mjs clean-eval <id>  # also delete an eval_runs row
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

const mode = process.argv[2]

const { data: vertical } = await admin
  .from('verticals')
  .select('id')
  .eq('slug', 'ai_saas')
  .single()

if (mode === 'seed') {
  const rows = [
    {
      external_id: 'demo-001',
      vertical_id: vertical.id,
      offer_name: 'DEMO Recurring SaaS tool',
      expected_verdict: 'strong_test',
      facts_snapshot: [
        { fact_type: 'commission_value', fact_value: '30% recurring lifetime', source_quote: '30% lifetime recurring commission', confidence_score: 90 },
        { fact_type: 'cookie_duration', fact_value: '90 days', source_quote: '90-day cookie', confidence_score: 85 },
        { fact_type: 'payout_delay', fact_value: 'net-30', source_quote: 'paid net-30', confidence_score: 80 },
        { fact_type: 'allowed_geo', fact_value: 'US, CA, UK, AU', source_quote: 'global program', confidence_score: 70 },
      ],
      notes: 'DEMO placeholder — delete. Not real ground truth.',
    },
    {
      external_id: 'demo-002',
      vertical_id: vertical.id,
      offer_name: 'DEMO Thin one-time payout',
      expected_verdict: 'reject',
      facts_snapshot: [
        { fact_type: 'commission_value', fact_value: '$5 one-time', source_quote: '$5 per sale, one time', confidence_score: 90 },
        { fact_type: 'cookie_duration', fact_value: '24 hours', source_quote: '24-hour cookie', confidence_score: 85 },
        { fact_type: 'restricted_geo', fact_value: 'most of the world; US only', source_quote: 'US traffic only', confidence_score: 80 },
      ],
      notes: 'DEMO placeholder — delete. Not real ground truth.',
    },
  ]
  const { error } = await admin.from('golden_set_offers').insert(rows)
  if (error) throw error
  console.log('Seeded demo-001, demo-002 in ai_saas.')
} else if (mode === 'clean') {
  const { error } = await admin
    .from('golden_set_offers')
    .delete()
    .like('external_id', 'demo-%')
  if (error) throw error
  console.log('Removed demo-* golden offers.')
} else if (mode === 'clean-eval') {
  const id = process.argv[3]
  if (!id) throw new Error('clean-eval needs an eval_runs id')
  const { error } = await admin.from('eval_runs').delete().eq('id', id)
  if (error) throw error
  console.log(`Removed eval_runs ${id}.`)
} else {
  console.error('usage: node scripts/golden-demo.mjs seed|clean|clean-eval <id>')
  process.exit(1)
}
