// End-to-end test of the kill-switch: pausing UnderwritingOrchestrator must
// make analyze-offer return 503 before opening an ai_runs row. The switch is
// GLOBAL, so we pause only around the single invoke and restore immediately
// (plus a finally safety-net) to avoid blocking real traffic.
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
const ORCH = 'UnderwritingOrchestrator'
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const stamp = process.env.STAMP ?? 'manual'
const email = `kstest+${stamp}@example.com`
const password = 'Test-Password-123!'
let userId, wsId, offerId
let failures = 0
const ok = (m) => console.log(`  PASS ${m}`)
const bad = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}
const setPaused = (paused) =>
  admin
    .from('agent_kill_switches')
    .update({ is_paused: paused, paused_at: paused ? new Date().toISOString() : null })
    .eq('orchestrator_name', ORCH)

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

  const { data: vertical } = await admin
    .from('verticals')
    .select('id')
    .limit(1)
    .single()
  const { data: offer } = await admin
    .from('offers')
    .insert({
      name: `ks-test-${stamp}`,
      slug: `ks-test-${stamp}`,
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

  // Paused -> expect 503.
  await setPaused(true)
  let res, text
  try {
    res = await invoke()
    text = await res.text()
  } finally {
    await setPaused(false) // restore ASAP — global switch.
  }
  if (res.status === 503) ok(`paused -> 503 as expected: ${text}`)
  else bad(`expected 503 while paused, got ${res.status}: ${text}`)
} catch (err) {
  bad(`unexpected error: ${err.message ?? err}`)
} finally {
  await setPaused(false) // safety net.
  if (offerId) {
    await admin.from('ai_runs').delete().eq('offer_id', offerId)
    await admin.from('offers').delete().eq('id', offerId)
  }
  if (wsId) await admin.from('workspaces').delete().eq('id', wsId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('Cleaned up + kill-switch restored.')
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
