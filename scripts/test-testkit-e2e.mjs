// End-to-end test of generate-test-kit against the DEPLOYED function:
// (1) no prior verdict -> 400 guard; (2) with a verdict -> real Sonnet
// generation -> a structured test_kits row. Throwaway admin user, cleaned up.
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
const email = `tktest+${stamp}@example.com`
const password = 'Test-Password-123!'
let userId, wsId, offerId
let failures = 0
const ok = (m) => console.log(`  PASS ${m}`)
const bad = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
    .eq('slug', 'ai_saas')
    .single()
  const { data: offer } = await admin
    .from('offers')
    .insert({
      name: `tk-test-${stamp}`,
      slug: `tk-test-${stamp}`,
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
    fetch(`${URL_}/functions/v1/generate-test-kit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ offer_id: offerId }),
    })

  // 1) No verdict yet -> 400 guard.
  const res1 = await invoke()
  const body1 = await res1.json().catch(() => ({}))
  if (res1.status === 400) ok(`no verdict -> 400 guard: ${body1.error}`)
  else bad(`expected 400 without verdict, got ${res1.status}: ${JSON.stringify(body1)}`)

  // Inject a successful underwriting run so the kit has a verdict to build on.
  await admin.from('ai_runs').insert({
    offer_id: offerId,
    workspace_id: wsId,
    user_id: userId,
    orchestrator_name: 'UnderwritingOrchestrator',
    agent_version: 'test-seed',
    model: 'claude-sonnet-4-6',
    input_payload: { seed: true },
    output_payload: {
      payload: {
        verdict: 'strong_test',
        recommended_channel: 'paid_social',
        recommended_geo: ['US', 'CA'],
        recommended_test_budget_usd: 750,
        main_reason_to_test: 'Recurring commission on a trusted brand.',
        kill_criteria: ['CPA above $90 after $300 spend'],
      },
    },
    status: 'success',
    completed_at: new Date().toISOString(),
  })

  // 2) With a verdict -> real generation.
  const res2 = await invoke()
  const body2 = await res2.json().catch(() => ({}))
  if (res2.status === 200 && body2.run_id) ok(`with verdict -> 200, run ${body2.run_id.slice(0, 8)}…`)
  else bad(`expected 200 with verdict, got ${res2.status}: ${JSON.stringify(body2)}`)

  // Poll the run (real Sonnet, large schema — allow up to ~170s).
  let runStatus
  for (let i = 0; i < 85; i++) {
    await sleep(2000)
    const { data } = await admin
      .from('ai_runs')
      .select('status, error_message')
      .eq('id', body2.run_id)
      .maybeSingle()
    runStatus = data
    if (runStatus && ['success', 'failed', 'partial'].includes(runStatus.status)) break
    process.stdout.write(`  …run=${runStatus?.status ?? '?'}\r`)
  }
  console.log()
  if (runStatus?.status === 'success') ok('generation run succeeded')
  else bad(`run did not succeed: ${runStatus?.status} err=${runStatus?.error_message}`)

  const { data: kit } = await admin
    .from('test_kits')
    .select('payload')
    .eq('offer_id', offerId)
    .maybeSingle()
  const p = kit?.payload?.payload
  if (p && Array.isArray(p.angles) && p.angles.length >= 2 && Array.isArray(p.hooks)) {
    ok(`test_kit stored: ${p.angles.length} angles, ${p.hooks.length} hooks, channel=${p.channel_plan?.primary}`)
    console.log(`    objective: ${String(p.test_objective).slice(0, 80)}`)
  } else {
    bad(`test_kit missing/malformed: ${JSON.stringify(kit?.payload)?.slice(0, 120)}`)
  }
} catch (err) {
  bad(`unexpected error: ${err.message ?? err}`)
} finally {
  if (offerId) {
    await admin.from('test_kits').delete().eq('offer_id', offerId)
    await admin.from('ai_runs').delete().eq('offer_id', offerId)
    await admin.from('offers').delete().eq('id', offerId)
  }
  if (wsId) await admin.from('workspaces').delete().eq('id', wsId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('Cleaned up.')
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
