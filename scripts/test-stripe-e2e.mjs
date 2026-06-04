// Verifies the DB operations the Stripe webhook performs (schema + constraints),
// without live Stripe: a 'purchased' credit grant, customer/subscription upserts,
// and stripe_events idempotency. The signed-webhook round-trip + planEffects are
// covered by unit tests; live checkout is pending Stripe keys.
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

const stamp = process.env.STAMP ?? 'manual'
const eventId = `evt_test_${stamp}`
let userId, wsId
let failures = 0
const ok = (m) => console.log(`  PASS ${m}`)
const bad = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}
const balance = async () => {
  const { data } = await admin.from('credit_ledger').select('amount').eq('workspace_id', wsId)
  return (data ?? []).reduce((s, r) => s + Number(r.amount), 0)
}

try {
  const { data: created } = await admin.auth.admin.createUser({
    email: `sttest+${stamp}@example.com`,
    password: 'Test-Password-123!',
    email_confirm: true,
  })
  userId = created.user.id
  const { data: mem } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle()
  wsId = mem?.workspace_id
  const before = await balance()

  // Idempotency: first insert wins.
  const { error: e1 } = await admin.from('stripe_events').insert({ event_id: eventId, type: 'checkout.session.completed' })
  if (!e1) ok('stripe_events insert (first delivery)')
  else bad(`stripe_events insert failed: ${e1.message}`)
  const { error: e2 } = await admin.from('stripe_events').insert({ event_id: eventId, type: 'checkout.session.completed' })
  if (e2) ok('duplicate event rejected (idempotency holds)')
  else bad('duplicate event was NOT rejected')

  // 'purchased' grant.
  const { error: ge } = await admin.from('credit_ledger').insert({
    workspace_id: wsId,
    entry_type: 'purchased',
    amount: 30,
    reason: 'Purchased 30 credits',
  })
  if (!ge && (await balance()) === before + 30) ok(`purchased grant applied (+30 -> ${await balance()})`)
  else bad(`purchased grant failed: ${ge?.message ?? `balance ${await balance()}`}`)

  // Customer upsert (onConflict workspace_id).
  await admin.from('stripe_customers').upsert(
    { workspace_id: wsId, stripe_customer_id: `cus_${stamp}` },
    { onConflict: 'workspace_id' }
  )
  await admin.from('stripe_customers').upsert(
    { workspace_id: wsId, stripe_customer_id: `cus_${stamp}` },
    { onConflict: 'workspace_id' }
  )
  const { count: custCount } = await admin
    .from('stripe_customers')
    .select('*', { count: 'exact', head: true })
    .eq('workspace_id', wsId)
  if (custCount === 1) ok('stripe_customers upsert is idempotent (1 row)')
  else bad(`expected 1 customer row, got ${custCount}`)

  // Subscription upsert (onConflict stripe_subscription_id).
  const subId = `sub_${stamp}`
  await admin.from('subscriptions').upsert(
    { workspace_id: wsId, stripe_subscription_id: subId, status: 'active', plan: 'pro' },
    { onConflict: 'stripe_subscription_id' }
  )
  await admin.from('subscriptions').upsert(
    { workspace_id: wsId, stripe_subscription_id: subId, status: 'canceled', plan: 'pro' },
    { onConflict: 'stripe_subscription_id' }
  )
  const { data: sub } = await admin
    .from('subscriptions')
    .select('status')
    .eq('stripe_subscription_id', subId)
    .maybeSingle()
  if (sub?.status === 'canceled') ok('subscription upsert updates status in place')
  else bad(`expected canceled, got ${sub?.status}`)
} catch (err) {
  bad(`unexpected error: ${err.message ?? err}`)
} finally {
  await admin.from('stripe_events').delete().eq('event_id', eventId)
  if (wsId) {
    await admin.from('subscriptions').delete().eq('workspace_id', wsId)
    await admin.from('stripe_customers').delete().eq('workspace_id', wsId)
    await admin.from('credit_ledger').delete().eq('workspace_id', wsId)
    await admin.from('workspaces').delete().eq('id', wsId)
  }
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('Cleaned up.')
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
