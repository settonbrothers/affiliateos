// Reproduce the production bug and verify the fix: an offer whose LATEST run is
// a non-underwriting one (Diagnosis, no `scores`) must still render the
// scorecard/verdict from the latest UNDERWRITING run — not 500. Synthetic data
// (no AI cost). Requires the local dev server on :3000.
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const BASE = 'http://localhost:3000'
const stamp = `${Date.now()}`
const email = `scfix+${stamp}@example.com`
const password = 'Test-Password-123!'
let userId, wsId, offerId
let pass = 0
const ok = (m) => { pass++; console.log(`  PASS ${m}`) }
const bad = (m) => console.log(`  FAIL ${m}`)

const browser = await chromium.launch()
const page = await browser.newPage()
page.on('response', (r) => { if (r.url().includes('/offers/') && r.status() >= 500) console.log(`  >> ${r.status()} ${r.url()}`) })

try {
  const { data: created } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  userId = created.user.id
  await svc.from('profiles').update({ system_role: 'admin' }).eq('id', userId)
  await svc.from('operator_profiles').upsert({ user_id: userId, onboarded_at: new Date().toISOString() }, { onConflict: 'user_id' })
  const { data: mem } = await svc.from('workspace_members').select('workspace_id').eq('user_id', userId).maybeSingle()
  wsId = mem?.workspace_id

  const { data: vertical } = await svc.from('verticals').select('id').limit(1).single()
  const { data: offer } = await svc.from('offers').insert({
    name: `scfix-${stamp}`, slug: `scfix-${stamp}`, vertical_id: vertical.id,
    created_by_user_id: userId, workspace_id: wsId, status: 'draft', visibility: 'admin_only',
  }).select('id').single()
  offerId = offer.id

  const uw = {
    orchestrator_name: 'UnderwritingOrchestrator', agent_version: 'seed', status: 'success', confidence_score: 80,
    facts: [], assumptions: [], estimates: [], risks: [], unknowns: [], missing_data: [],
    human_review_required: false, human_review_reasons: [],
    payload: {
      scores: { economics: 74, demand: 78, competition: 52, creative_opportunity: 68, funnel_fit: 70, compliance: 88, operator_fit: 70, data_confidence: 60, offer_trust: 86, scale_potential: 75, cashflow_fit: 65, high_ceiling_potential: 72, execution_complexity: 58 },
      weighted_score: 73, verdict: 'small_paid_test', recommended_channel: 'paid_social', recommended_geo: ['US'],
      minimum_test_budget_usd: 300, recommended_test_budget_usd: 750,
      main_reason_to_test: 'Seeded underwriting run.', main_reason_to_avoid: 'Seeded.',
      warnings: { trust: null, scale: null, cashflow: null, compliance: null },
      kill_criteria: ['CPA over $90'], scale_criteria: ['EPC over $1.2'], verdict_caps_applied: [],
    },
  }
  // Older underwriting run (has scores).
  await svc.from('ai_runs').insert({
    offer_id: offerId, workspace_id: wsId, user_id: userId, orchestrator_name: 'UnderwritingOrchestrator',
    agent_version: 'seed', model: 'mock', input_payload: {}, output_payload: uw, status: 'success',
    created_at: new Date(Date.now() - 60000).toISOString(), completed_at: new Date(Date.now() - 60000).toISOString(),
  })
  // LATER diagnosis run (NO scores) — this is what broke the scorecard.
  await svc.from('ai_runs').insert({
    offer_id: offerId, workspace_id: wsId, user_id: userId, orchestrator_name: 'DiagnosisOrchestrator',
    agent_version: 'seed', model: 'mock', input_payload: {},
    output_payload: { payload: { primary_bottleneck: 'landing_page', diagnosis_summary: 'seed' } },
    status: 'success', created_at: new Date().toISOString(), completed_at: new Date().toISOString(),
  })

  const userClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
  const { data: signIn } = await userClient.auth.signInWithPassword({ email, password })
  // Seed the auth cookies into the browser.
  await page.goto(`${BASE}/login`)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/offers', { timeout: 20000 }).catch(() => {})

  const res = await page.goto(`${BASE}/offers/${offerId}?tab=scorecard`, { waitUntil: 'networkidle' })
  const status = res?.status() ?? 0
  const bodyText = await page.locator('body').innerText()
  if (status < 500 && !/Application error|server-side exception/i.test(bodyText)) ok(`scorecard loaded (HTTP ${status}, no server error)`)
  else bad(`scorecard still errors (HTTP ${status})`)
  ;(await page.getByText(/Weighted score/i).isVisible().catch(() => false)) ? ok('scorecard renders the underwriting scores (despite the later diagnosis run)') : bad('Weighted score not visible')

  await page.goto(`${BASE}/offers/${offerId}?tab=verdict`, { waitUntil: 'networkidle' })
  ;(await page.getByText(/small_paid_test|Why test/i).first().isVisible().catch(() => false)) ? ok('verdict tab renders') : bad('verdict did not render')
} catch (err) {
  bad(`error: ${err.message ?? err}`)
} finally {
  await browser.close()
  if (offerId) { await svc.from('ai_runs').delete().eq('offer_id', offerId); await svc.from('offers').delete().eq('id', offerId) }
  if (wsId) { await svc.from('credit_ledger').delete().eq('workspace_id', wsId); await svc.from('operator_profiles').delete().eq('user_id', userId); await svc.from('workspaces').delete().eq('id', wsId) }
  if (userId) await svc.auth.admin.deleteUser(userId)
  console.log(`\n${pass} check(s) passed.`)
}
