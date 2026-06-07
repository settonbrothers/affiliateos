// Verify the Stripe integration locally without a public webhook endpoint:
//  A) create real test Checkout sessions (proves the secret key + price_data),
//  B) self-sign a checkout.session.completed event and POST it to the running
//     dev server's /api/stripe/webhook -> confirms signature verify + that a
//     payment grants 'purchased' credits, plus idempotency.
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'
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
const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const whsec = env.STRIPE_WEBHOOK_SECRET
const svc = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const stamp = `${Date.now()}`
let pass = 0, fail = 0
const ok = (m) => { pass++; console.log(`  PASS ${m}`) }
const bad = (m) => { fail++; console.log(`  FAIL ${m}`) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let userId, wsId
const eventId = `evt_verify_${stamp}`

try {
  // A) Real test Checkout sessions (subscription + credit pack).
  const urls = 'https://example.com'
  const sub = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 5000, recurring: { interval: 'month' }, product_data: { name: 'AffiliateOS Pro' } } }],
    metadata: { workspace_id: 'verify', credits: '50' },
    success_url: `${urls}/s`, cancel_url: `${urls}/c`,
  })
  sub.url ? ok(`subscription checkout session created (${sub.id.slice(0, 12)}…)`) : bad('subscription session no url')
  const pack = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [{ quantity: 1, price_data: { currency: 'usd', unit_amount: 2000, product_data: { name: '30 credit pack' } } }],
    metadata: { workspace_id: 'verify', credits: '30' },
    success_url: `${urls}/s`, cancel_url: `${urls}/c`,
  })
  pack.url ? ok(`credit-pack checkout session created (${pack.id.slice(0, 12)}…)`) : bad('pack session no url')

  // B) Webhook -> credit grant. Throwaway workspace (starts at 100 trial).
  const { data: created } = await svc.auth.admin.createUser({
    email: `stripeverify+${stamp}@example.com`, password: 'Test-Password-123!', email_confirm: true,
  })
  userId = created.user.id
  const { data: mem } = await svc.from('workspace_members').select('workspace_id').eq('user_id', userId).maybeSingle()
  wsId = mem?.workspace_id
  const balance = async () => {
    const { data } = await svc.from('credit_ledger').select('amount').eq('workspace_id', wsId)
    return (data ?? []).reduce((s, r) => s + Number(r.amount), 0)
  }
  const before = await balance()

  const payload = JSON.stringify({
    id: eventId, object: 'event', type: 'checkout.session.completed',
    data: { object: { mode: 'payment', customer: `cus_verify_${stamp}`, amount_total: 2000, metadata: { workspace_id: wsId, credits: '30' } } },
  })
  const header = stripe.webhooks.generateTestHeaderString({ payload, secret: whsec })
  const post = () => fetch('http://localhost:3000/api/stripe/webhook', {
    method: 'POST', headers: { 'stripe-signature': header, 'content-type': 'application/json' }, body: payload,
  })

  const res = await post()
  const body = await res.json().catch(() => ({}))
  if (res.status === 200) ok(`webhook accepted signed event: ${JSON.stringify(body)}`)
  else bad(`webhook rejected: HTTP ${res.status} ${JSON.stringify(body)}`)

  await sleep(1500)
  const after = await balance()
  if (after === before + 30) ok(`payment granted 30 credits (${before} -> ${after})`)
  else bad(`expected +30 (${before} -> ${before + 30}), got ${after}`)

  // Idempotency: same event id again -> no double grant.
  const res2 = await post()
  const body2 = await res2.json().catch(() => ({}))
  await sleep(1000)
  const after2 = await balance()
  if (body2.duplicate && after2 === after) ok('duplicate delivery ignored (idempotent, balance unchanged)')
  else bad(`idempotency failed: ${JSON.stringify(body2)} balance ${after2}`)
} catch (err) {
  bad(`error: ${err.message ?? err}`)
} finally {
  await svc.from('stripe_events').delete().eq('event_id', eventId)
  if (wsId) {
    await svc.from('stripe_customers').delete().eq('workspace_id', wsId)
    await svc.from('credit_ledger').delete().eq('workspace_id', wsId)
    await svc.from('workspaces').delete().eq('id', wsId)
  }
  if (userId) await svc.auth.admin.deleteUser(userId)
  console.log(`\n${pass} passed, ${fail} failed.`)
  process.exit(fail === 0 ? 0 : 1)
}
