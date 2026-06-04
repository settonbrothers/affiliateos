// End-to-end test of check-compliance against the DEPLOYED function for the
// M4 DoD item: a health offer with a medical claim -> compliance flags it ->
// a verdict cap is recorded. Throwaway admin user, cleaned up.
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
const email = `cxtest+${stamp}@example.com`
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
    .eq('slug', 'health')
    .single()
  const { data: offer } = await admin
    .from('offers')
    .insert({
      name: `LiverDetox Pro ${stamp}`,
      slug: `liverdetox-${stamp}`,
      vertical_id: vertical.id,
      created_by_user_id: userId,
      workspace_id: wsId,
      status: 'draft',
      visibility: 'admin_only',
      operator_notes:
        'Landing page says it detoxifies your liver and reverses fatty liver disease.',
    })
    .select('id')
    .single()
  offerId = offer.id

  // A verified medical claim for the checker to flag.
  await admin.from('extracted_facts').insert({
    offer_id: offerId,
    fact_type: 'compliance_claim',
    fact_value: 'Detoxifies your liver and reverses fatty liver disease in 30 days.',
    source_quote: 'Detoxifies your liver and reverses fatty liver disease.',
    confidence_score: 90,
    status: 'verified',
  })

  const userClient = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { data: signIn } = await userClient.auth.signInWithPassword({ email, password })
  const token = signIn.session.access_token

  const res = await fetch(`${URL_}/functions/v1/check-compliance`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ offer_id: offerId }),
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 200 && body.run_id) ok(`200, run ${body.run_id.slice(0, 8)}…`)
  else bad(`expected 200, got ${res.status}: ${JSON.stringify(body)}`)

  let runStatus
  for (let i = 0; i < 45; i++) {
    await sleep(2000)
    const { data } = await admin
      .from('ai_runs')
      .select('status, error_message')
      .eq('id', body.run_id)
      .maybeSingle()
    runStatus = data
    if (runStatus && ['success', 'failed', 'partial'].includes(runStatus.status)) break
    process.stdout.write(`  …run=${runStatus?.status ?? '?'}\r`)
  }
  console.log()
  if (runStatus?.status === 'success') ok('compliance run succeeded')
  else bad(`run did not succeed: ${runStatus?.status} err=${runStatus?.error_message}`)

  const { data: warn } = await admin
    .from('offer_compliance_warnings')
    .select('overall_risk_level, suggested_verdict_cap, payload')
    .eq('offer_id', offerId)
    .maybeSingle()
  if (warn && ['high', 'critical'].includes(warn.overall_risk_level)) {
    ok(`flagged risk=${warn.overall_risk_level}`)
  } else {
    bad(`expected high/critical risk, got ${warn?.overall_risk_level}`)
  }
  if (warn?.suggested_verdict_cap) {
    ok(`verdict capped to "${warn.suggested_verdict_cap}"`)
  } else {
    bad('no verdict cap recorded for a high-risk health offer')
  }
  const claims = warn?.payload?.payload?.detected_claims ?? []
  if (Array.isArray(claims) && claims.length > 0) {
    ok(`${claims.length} claim(s) detected, first=${claims[0].claim_type}`)
  } else {
    bad('no detected_claims recorded')
  }
} catch (err) {
  bad(`unexpected error: ${err.message ?? err}`)
} finally {
  if (offerId) {
    await admin.from('offer_compliance_warnings').delete().eq('offer_id', offerId)
    await admin.from('extracted_facts').delete().eq('offer_id', offerId)
    await admin.from('ai_runs').delete().eq('offer_id', offerId)
    await admin.from('offers').delete().eq('id', offerId)
  }
  if (wsId) await admin.from('workspaces').delete().eq('id', wsId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('Cleaned up.')
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
