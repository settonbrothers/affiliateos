// Drives the full app flow in a real browser (Playwright/Chromium) against the
// local dev server: login -> onboarding -> create offer -> analyze -> scorecard.
// Pre-creates a confirmed admin (so login works regardless of email-confirm and
// offers RLS allows creation). Screenshots each step; cleans up the user.
import { mkdirSync } from 'node:fs'
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
const SHOTS = new URL('../.playwright-shots/', import.meta.url).pathname.replace(/^\//, '')
mkdirSync(SHOTS, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const stamp = `${Date.now()}`
const email = `flow+${stamp}@example.com`
const password = 'Test-Password-123!'
let userId, wsId, offerId
let pass = 0
const ok = (m) => { pass++; console.log(`  PASS ${m}`) }
const bad = (m) => console.log(`  FAIL ${m}`)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

try {
  // Confirmed admin so login works + offers can be created.
  const { data: created, error } = await svc.auth.admin.createUser({
    email, password, email_confirm: true,
  })
  if (error) throw error
  userId = created.user.id
  await svc.from('profiles').update({ system_role: 'admin' }).eq('id', userId)
  const { data: mem } = await svc.from('workspace_members').select('workspace_id').eq('user_id', userId).maybeSingle()
  wsId = mem?.workspace_id

  // 1) Signup page renders the invite-only form.
  await page.goto(`${BASE}/signup`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${SHOTS}01-signup.png` })
  if (await page.getByLabel('Invite code').isVisible()) ok('signup shows invite-code field (invite-only)')
  else bad('signup invite-code field missing')

  // 2) Login.
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()

  // 3) Gated to onboarding.
  await page.waitForURL('**/onboarding', { timeout: 20000 })
  await page.screenshot({ path: `${SHOTS}02-onboarding.png` })
  ok('login -> redirected to /onboarding (gate works)')

  // Step through the wizard.
  await page.getByRole('button', { name: 'advanced', exact: true }).click()
  await page.getByRole('button', { name: 'flexible', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'paid social', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByRole('button', { name: 'Finish', exact: true }).click()

  // 4) Lands in the app.
  await page.waitForURL('**/offers', { timeout: 20000 })
  await page.screenshot({ path: `${SHOTS}03-offers.png` })
  ok('onboarding finished -> /offers')
  const creditsText = await page.getByText(/Credits/i).first().innerText().catch(() => '')
  console.log(`  sidebar: ${creditsText.replace(/\n/g, ' ')}`)

  // 5) Create an offer.
  await page.goto(`${BASE}/offers/new`, { waitUntil: 'networkidle' })
  await page.getByLabel('Name').fill(`Browser Flow ${stamp}`)
  await page.getByLabel('Vertical').selectOption({ index: 1 })
  await page.getByRole('button', { name: 'Create offer' }).click()
  await page.waitForURL(/\/offers\/[0-9a-f-]{36}/, { timeout: 20000 })
  offerId = page.url().split('/offers/')[1].split('?')[0]
  await page.screenshot({ path: `${SHOTS}04-offer.png` })
  ok(`offer created (${offerId.slice(0, 8)}…)`)

  // 6) Analyze (real Sonnet). Click, then wait for the run to finish.
  await page.getByRole('button', { name: 'Analyze' }).click()
  ok('clicked Analyze')
  let runOk = false
  for (let i = 0; i < 60; i++) {
    await sleep(2000)
    const { data: run } = await svc
      .from('ai_runs')
      .select('status')
      .eq('offer_id', offerId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (run?.status === 'success') { runOk = true; break }
    if (run?.status === 'failed') break
  }
  if (runOk) ok('analyze run succeeded')
  else bad('analyze did not succeed in time')

  // 7) Scorecard renders.
  await page.goto(`${BASE}/offers/${offerId}?tab=scorecard`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${SHOTS}05-scorecard.png`, fullPage: true })
  if (await page.getByText(/Weighted score/i).isVisible()) ok('scorecard renders (Weighted score visible)')
  else bad('scorecard did not render')

  // 8) Verdict tab.
  await page.goto(`${BASE}/offers/${offerId}?tab=verdict`, { waitUntil: 'networkidle' })
  await page.screenshot({ path: `${SHOTS}06-verdict.png`, fullPage: true })
  ok('verdict tab rendered')
} catch (err) {
  bad(`error: ${err.message ?? err}`)
  await page.screenshot({ path: `${SHOTS}99-error.png` }).catch(() => {})
} finally {
  await browser.close()
  if (offerId) {
    await svc.from('ai_runs').delete().eq('offer_id', offerId)
    await svc.from('offers').delete().eq('id', offerId)
  }
  if (wsId) {
    await svc.from('credit_ledger').delete().eq('workspace_id', wsId)
    await svc.from('operator_profiles').delete().eq('user_id', userId)
    await svc.from('workspaces').delete().eq('id', wsId)
  }
  if (userId) await svc.auth.admin.deleteUser(userId)
  console.log(`\n${pass} step(s) passed. Screenshots in .playwright-shots/`)
}
