// Real payment test on PRODUCTION: log in, click "Buy 30 credits", complete the
// Stripe Checkout with test card 4242, and confirm the live webhook grants 30
// 'purchased' credits to the workspace. Cleans up the user + Stripe customer.
import { mkdirSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'
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
const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const BASE = 'https://affiliateos-sooty.vercel.app'
const SHOTS = new URL('../.playwright-shots/', import.meta.url).pathname.replace(/^\//, '')
mkdirSync(SHOTS, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stamp = `${Date.now()}`
const email = `pay+${stamp}@example.com`
const password = 'Test-Password-123!'
let userId, wsId
let pass = 0
const ok = (m) => { pass++; console.log(`  PASS ${m}`) }
const bad = (m) => console.log(`  FAIL ${m}`)
const fillIfVisible = async (page, sel, val) => {
  const el = page.locator(sel)
  if (await el.count() && (await el.first().isVisible().catch(() => false))) {
    await el.first().fill(val); return true
  }
  return false
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

try {
  const { data: created, error } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  userId = created.user.id
  const { data: mem } = await svc.from('workspace_members').select('workspace_id').eq('user_id', userId).maybeSingle()
  wsId = mem?.workspace_id
  const balance = async () => {
    const { data } = await svc.from('credit_ledger').select('amount').eq('workspace_id', wsId)
    return (data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  }
  const before = await balance()
  ok(`workspace provisioned (balance ${before})`)

  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.waitForURL('**/onboarding', { timeout: 30000 })
  // Mark onboarded so we can reach /billing without the wizard.
  await svc.from('operator_profiles').upsert({ user_id: userId, onboarded_at: new Date().toISOString() }, { onConflict: 'user_id' })

  await page.goto(`${BASE}/billing`, { waitUntil: 'networkidle' })
  await page.getByRole('button', { name: /Buy 30 credits/i }).click()
  await page.waitForURL(/checkout\.stripe\.com/, { timeout: 25000 })
  ok('reached Stripe Checkout')
  await sleep(2500)
  await page.screenshot({ path: `${SHOTS}pay-1-checkout.png` })

  // Fill the hosted Checkout form (test card 4242).
  await fillIfVisible(page, '#email', email)
  await page.fill('#cardNumber', '4242 4242 4242 4242')
  await page.fill('#cardExpiry', '12 / 34')
  await page.fill('#cardCvc', '123')
  await fillIfVisible(page, '#billingName', 'Test User')
  // Country first — the ZIP field is required for US and appears after it's set.
  const country = page.locator('#billingCountry')
  if (await country.count()) { await country.selectOption('US').catch(() => {}); await sleep(800) }
  if (!(await fillIfVisible(page, '#billingPostalCode', '10001'))) {
    await page.getByPlaceholder(/ZIP|postal/i).first().fill('10001').catch(() => {})
  }
  await page.screenshot({ path: `${SHOTS}pay-2-filled.png` })

  await page.getByTestId('hosted-payment-submit-button').click()
  ok('submitted payment (test card 4242)')

  // Back to the app on success.
  await page.waitForURL(/affiliateos-sooty\.vercel\.app\/billing/, { timeout: 45000 })
  await page.screenshot({ path: `${SHOTS}pay-3-success.png`, fullPage: true })
  ok('redirected back to /billing after payment')

  // The webhook grants async — poll the ledger for +30.
  let after = before
  for (let i = 0; i < 30; i++) {
    await sleep(2000)
    after = await balance()
    if (after >= before + 30) break
    process.stdout.write(`  …waiting for webhook grant (balance ${after})\r`)
  }
  console.log()
  if (after === before + 30) ok(`✅ webhook granted 30 'purchased' credits (${before} -> ${after})`)
  else bad(`expected +30 (${before} -> ${before + 30}), got ${after}`)

  const { data: led } = await svc.from('credit_ledger').select('entry_type, amount, reason').eq('workspace_id', wsId).eq('entry_type', 'purchased')
  if ((led ?? []).length) ok(`ledger shows: ${led.map((l) => `${l.entry_type} +${l.amount} (${l.reason})`).join('; ')}`)
} catch (err) {
  bad(`error: ${err.message ?? err}`)
  await page.screenshot({ path: `${SHOTS}pay-error.png` }).catch(() => {})
} finally {
  await browser.close()
  if (wsId) {
    const { data: cust } = await svc.from('stripe_customers').select('stripe_customer_id').eq('workspace_id', wsId).maybeSingle()
    if (cust?.stripe_customer_id) await stripe.customers.del(cust.stripe_customer_id).catch(() => {})
    await svc.from('stripe_customers').delete().eq('workspace_id', wsId)
    await svc.from('credit_ledger').delete().eq('workspace_id', wsId)
    await svc.from('operator_profiles').delete().eq('user_id', userId)
    await svc.from('workspaces').delete().eq('id', wsId)
  }
  if (userId) await svc.auth.admin.deleteUser(userId)
  console.log(`\n${pass} step(s) passed. Screenshots in .playwright-shots/`)
}
