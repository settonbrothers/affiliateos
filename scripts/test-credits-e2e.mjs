// End-to-end test of the credit guard against the DEPLOYED analyze-offer:
// (1) signup grants 100 trial credits; (2) zero balance -> 402; (3) with
// balance -> a 5-credit debit is recorded and the run succeeds.
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
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const stamp = process.env.STAMP ?? 'manual'
const email = `crtest+${stamp}@example.com`
const password = 'Test-Password-123!'
let userId, wsId, offerId
let failures = 0
const ok = (m) => console.log(`  PASS ${m}`)
const bad = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const balance = async () => {
  const { data } = await admin
    .from('credit_ledger')
    .select('amount')
    .eq('workspace_id', wsId)
  return (data ?? []).reduce((s, r) => s + Number(r.amount), 0)
}

try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (cErr) throw cErr
  userId = created.user.id
  const { data: mem } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle()
  wsId = mem?.workspace_id

  if ((await balance()) === 100) ok('signup granted 100 trial credits')
  else bad(`expected 100 trial credits, got ${await balance()}`)

  const { data: vertical } = await admin
    .from('verticals')
    .select('id')
    .eq('slug', 'ai_saas')
    .single()
  const { data: offer } = await admin
    .from('offers')
    .insert({
      name: `cr-test-${stamp}`,
      slug: `cr-test-${stamp}`,
      vertical_id: vertical.id,
      created_by_user_id: userId,
      workspace_id: wsId,
      status: 'draft',
      visibility: 'admin_only',
    })
    .select('id')
    .single()
  offerId = offer.id

  const userClient = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { data: signIn } = await userClient.auth.signInWithPassword({ email, password })
  const token = signIn.session.access_token
  const invoke = () =>
    fetch(`${URL_}/functions/v1/analyze-offer`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ offer_id: offerId }),
    })

  // 2) Zero the balance -> expect 402.
  await admin.from('credit_ledger').insert({
    workspace_id: wsId,
    entry_type: 'adjusted',
    amount: -100,
    reason: 'test: zero balance',
  })
  const res1 = await invoke()
  const body1 = await res1.json().catch(() => ({}))
  if (res1.status === 402) ok(`zero balance -> 402: ${body1.error}`)
  else bad(`expected 402 at zero balance, got ${res1.status}: ${JSON.stringify(body1)}`)

  // 3) Restore balance -> a real analyze should debit 5.
  await admin.from('credit_ledger').insert({
    workspace_id: wsId,
    entry_type: 'adjusted',
    amount: 100,
    reason: 'test: restore',
  })
  const before = await balance()
  const res2 = await invoke()
  const body2 = await res2.json().catch(() => ({}))
  if (res2.status === 200 && body2.run_id) ok(`with balance -> 200, run ${body2.run_id.slice(0, 8)}…`)
  else bad(`expected 200 with balance, got ${res2.status}: ${JSON.stringify(body2)}`)

  const afterReserve = await balance()
  if (afterReserve === before - 5) ok(`debited 5 on reserve (${before} -> ${afterReserve})`)
  else bad(`expected debit of 5 (${before} -> ${before - 5}), got ${afterReserve}`)

  // Confirm the run succeeds and the debit is NOT refunded.
  let runStatus
  for (let i = 0; i < 45; i++) {
    await sleep(2000)
    const { data } = await admin
      .from('ai_runs')
      .select('status')
      .eq('id', body2.run_id)
      .maybeSingle()
    runStatus = data
    if (runStatus && ['success', 'failed', 'partial'].includes(runStatus.status)) break
    process.stdout.write(`  …run=${runStatus?.status ?? '?'}\r`)
  }
  console.log()
  if (runStatus?.status === 'success' && (await balance()) === before - 5) {
    ok('run succeeded; debit kept (no refund)')
  } else {
    bad(`run=${runStatus?.status}, balance=${await balance()} (expected ${before - 5})`)
  }
} catch (err) {
  bad(`unexpected error: ${err.message ?? err}`)
} finally {
  if (wsId) await admin.from('credit_ledger').delete().eq('workspace_id', wsId)
  if (offerId) {
    await admin.from('ai_runs').delete().eq('offer_id', offerId)
    await admin.from('offers').delete().eq('id', offerId)
  }
  if (wsId) await admin.from('workspaces').delete().eq('id', wsId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('Cleaned up.')
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
