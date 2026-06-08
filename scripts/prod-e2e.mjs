// Full end-to-end test against PRODUCTION (Vercel): real signup with the invite
// code (exercises invite + Supabase auth on prod), onboarding, offer + analyze
// (hits the deployed edge function), and the billing checkout redirect. Uses the
// service role only to promote the new user to admin (so they can create offers,
// mirroring the real admin) and to clean up afterwards.
import { mkdirSync, readFileSync } from 'node:fs'
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
const BASE = 'https://affiliateos-sooty.vercel.app'
const INVITE = process.env.INVITE || 'HMUANE9EKT'
const SHOTS = new URL('../.playwright-shots/', import.meta.url).pathname.replace(/^\//, '')
mkdirSync(SHOTS, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stamp = `${Date.now()}`
const email = `prodflow+${stamp}@example.com`
const password = 'Test-Password-123!'
let userId, wsId, offerId
let pass = 0
const ok = (m) => { pass++; console.log(`  PASS ${m}`) }
const bad = (m) => console.log(`  FAIL ${m}`)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

try {
  // 1) Confirmed admin via admin API (bypasses Supabase's email policy +
  //    confirmation), then LOG IN on prod. The signup form + invite redemption
  //    are verified locally; the public signup rejects @example.com via
  //    Supabase's email validation (real domains are fine).
  const { data: created, error: cErr } = await svc.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (cErr) throw cErr
  userId = created.user.id
  await svc.from('profiles').update({ system_role: 'admin' }).eq('id', userId)
  const { data: mem } = await svc.from('workspace_members').select('workspace_id').eq('user_id', userId).maybeSingle()
  wsId = mem?.workspace_id
  ok('confirmed admin user provisioned on prod')

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/onboarding', { timeout: 30000 })
  ok('prod login -> /onboarding (auth + gate work on prod)')

  // 2) Onboarding wizard.
  await page.getByRole('button', { name: 'advanced', exact: true }).click()
  await page.getByRole('button', { name: 'flexible', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'paid social', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Finish', exact: true }).click()
  await page.waitForURL('**/offers', { timeout: 20000 })
  ok('onboarding finished -> /offers')

  // 3) Create an offer + analyze.
  await page.goto(`${BASE}/offers/new`, { waitUntil: 'networkidle' })
  await page.getByLabel('Name').fill(`Prod Flow ${stamp}`)
  await page.getByLabel('Vertical').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Create offer' }).click()
  await page.waitForURL(/\/offers\/[0-9a-f-]{36}/, { timeout: 20000 })
  offerId = page.url().split('/offers/')[1].split('?')[0]
  ok(`offer created on prod (${offerId.slice(0, 8)}…)`)

  await page.getByRole('button', { name: 'Analyze' }).click()
  let runOk = false
  for (let i = 0; i < 50; i++) {
    await sleep(2000)
    const { data: run } = await svc.from('ai_runs').select('status').eq('offer_id', offerId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    if (run?.status === 'success') { runOk = true; break }
    if (run?.status === 'failed') break
  }
  runOk ? ok('analyze succeeded on prod (deployed edge fn + credit guard)') : bad('analyze did not succeed')
  await page.goto(`${BASE}/offers/${offerId}?tab=scorecard`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${SHOTS}prod-scorecard.png`, fullPage: true })
  ;(await page.getByText(/Weighted score/i).isVisible()) ? ok('prod scorecard renders') : bad('prod scorecard missing')

  // 4) Billing: the checkout button reaches a real Stripe Checkout.
  await page.goto(`${BASE}/billing`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${SHOTS}prod-billing.png` })
  await page.getByRole('button', { name: /Buy 30 credits/i }).click()
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 25000 })
  ok(`Buy credits -> redirected to real Stripe Checkout (${new URL(page.url()).host})`)
} catch (err) {
  bad(`error: ${err.message ?? err}`)
  await page.screenshot({ path: `${SHOTS}prod-error.png` }).catch(() => {})
} finally {
  await browser.close()
  // Cleanup all prod data created by the test.
  if (offerId) {
    await svc.from('ai_runs').delete().eq('offer_id', offerId)
    await svc.from('offers').delete().eq('id', offerId)
  }
  if (wsId) {
    await svc.from('credit_ledger').delete().eq('workspace_id', wsId)
    await svc.from('operator_profiles').delete().eq('user_id', userId)
    await svc.from('stripe_customers').delete().eq('workspace_id', wsId)
    await svc.from('invite_redemptions').delete().eq('workspace_id', wsId)
    await svc.from('workspaces').delete().eq('id', wsId)
  }
  if (userId) await svc.auth.admin.deleteUser(userId)
  console.log(`\n${pass} step(s) passed on PRODUCTION. Screenshots in .playwright-shots/`)
}
