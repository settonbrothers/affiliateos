// End-to-end test of diagnose-results against the DEPLOYED function:
// (1) no results -> 400 guard; (2) with results -> real Sonnet diagnosis ->
// a result_diagnoses row with metric_analysis + a primary_bottleneck.
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
const email = `dxtest+${stamp}@example.com`
const password = 'Test-Password-123!'
let userId, wsId, offerId, campaignId
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
      name: `dx-test-${stamp}`,
      slug: `dx-test-${stamp}`,
      vertical_id: vertical.id,
      created_by_user_id: userId,
      workspace_id: wsId,
      status: 'draft',
      visibility: 'admin_only',
    })
    .select('id')
    .single()
  offerId = offer.id

  const { data: campaign } = await admin
    .from('campaigns')
    .insert({
      offer_id: offerId,
      workspace_id: wsId,
      created_by_user_id: userId,
      name: `dx-campaign-${stamp}`,
      channel: 'paid_social',
      geo: 'US',
      status: 'draft',
    })
    .select('id')
    .single()
  campaignId = campaign.id

  const userClient = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { data: signIn } = await userClient.auth.signInWithPassword({ email, password })
  const token = signIn.session.access_token
  const invoke = () =>
    fetch(`${URL_}/functions/v1/diagnose-results`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ campaign_id: campaignId }),
    })

  // 1) No results -> 400 guard.
  const res1 = await invoke()
  const body1 = await res1.json().catch(() => ({}))
  if (res1.status === 400) ok(`no results -> 400 guard: ${body1.error}`)
  else bad(`expected 400 without results, got ${res1.status}: ${JSON.stringify(body1)}`)

  // Enter results (enough volume for a real read).
  await admin.from('campaign_results').insert({
    campaign_id: campaignId,
    spend_usd: 500,
    impressions: 100000,
    clicks: 900,
    landing_views: 800,
    conversions: 6,
    revenue_usd: 420,
    days_running: 5,
  })

  // 2) With results -> real diagnosis.
  const res2 = await invoke()
  const body2 = await res2.json().catch(() => ({}))
  if (res2.status === 200 && body2.run_id) ok(`with results -> 200, run ${body2.run_id.slice(0, 8)}…`)
  else bad(`expected 200 with results, got ${res2.status}: ${JSON.stringify(body2)}`)

  let runStatus
  for (let i = 0; i < 60; i++) {
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
  if (runStatus?.status === 'success') ok('diagnosis run succeeded')
  else bad(`run did not succeed: ${runStatus?.status} err=${runStatus?.error_message}`)

  const { data: diag } = await admin
    .from('result_diagnoses')
    .select('payload')
    .eq('campaign_id', campaignId)
    .maybeSingle()
  const p = diag?.payload?.payload
  if (p && p.metric_analysis && p.primary_bottleneck) {
    ok(`diagnosis stored: bottleneck=${p.primary_bottleneck}, action=${p.recommended_action}`)
    console.log(`    summary: ${String(p.diagnosis_summary).slice(0, 80)}`)
  } else {
    bad(`diagnosis missing/malformed: ${JSON.stringify(diag?.payload)?.slice(0, 120)}`)
  }
} catch (err) {
  bad(`unexpected error: ${err.message ?? err}`)
} finally {
  if (campaignId) await admin.from('result_diagnoses').delete().eq('campaign_id', campaignId)
  if (offerId) {
    await admin.from('ai_runs').delete().eq('offer_id', offerId)
    await admin.from('offers').delete().eq('id', offerId) // cascades campaigns + results
  }
  if (wsId) await admin.from('workspaces').delete().eq('id', wsId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('Cleaned up.')
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
