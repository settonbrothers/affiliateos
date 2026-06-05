// Recalibrate golden verdicts (reasoned pass) WITHOUT touching facts_snapshot
// (so enriched facts are preserved). strong_test was too optimistic for
// good-but-unproven offers; small_paid_test ("test small first") is the correct
// underwriting verdict absent proven results / exceptional trust signals.
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

const CHANGES = {
  'gold-001': { verdict: 'small_paid_test', why: '30% recurring is good but no proven EPC/trust depth' },
  'gold-002': { verdict: 'small_paid_test', why: 'one-time bounty + demand, unproven by us' },
  'gold-003': { verdict: 'small_paid_test', why: 'strong recurring, unproven' },
  'gold-006': { verdict: 'small_paid_test', why: 'strong payout but saturated + unproven' },
  'gold-007': { verdict: 'small_paid_test', why: '$200/sale + long cookie, unproven' },
}

let updated = 0
for (const [ext, { verdict, why }] of Object.entries(CHANGES)) {
  const { error, count } = await admin
    .from('golden_set_offers')
    .update(
      {
        expected_verdict: verdict,
        notes: `Recalibrated ${ext} -> ${verdict}: ${why}. (Reasoned, not fit to the prompt.)`,
        updated_at: new Date().toISOString(),
      },
      { count: 'exact' }
    )
    .eq('external_id', ext)
  if (error) {
    console.log(`  ${ext}: ERROR ${error.message}`)
  } else {
    updated += count ?? 0
    console.log(`  ${ext} -> ${verdict}`)
  }
}
console.log(`\nRecalibrated ${updated} golden verdicts (facts preserved).`)
