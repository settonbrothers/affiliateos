// End-to-end test of (1) workspace auto-provisioning on signup and (2) the
// daily-USD-cap 429 enforcement, against the DEPLOYED analyze-offer function.
// Creates a throwaway user, sets their cap to 0, expects a 429, then cleans up.
// The cap guard returns 429 BEFORE opening an ai_runs row, so no AI call / cost.
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
const email = `captest+${stamp}@example.com`
const password = 'Test-Password-123!'
let userId, wsId, offerId
let failures = 0
const ok = (m) => console.log(`  PASS ${m}`)
const bad = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

try {
  // 1) Create user -> trigger should provision workspace + membership + caps.
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (cErr) throw cErr
  userId = created.user.id
  console.log(`Created user ${email} (${userId})`)

  const { data: mem } = await admin
    .from('workspace_members')
    .select('workspace_id, role')
    .eq('user_id', userId)
    .maybeSingle()
  if (mem?.workspace_id) ok(`signup provisioned a workspace (role=${mem.role})`)
  else bad('signup did NOT provision a workspace')
  wsId = mem?.workspace_id

  const { data: caps } = await admin
    .from('workspace_credit_caps')
    .select('daily_usd_cap')
    .eq('workspace_id', wsId)
    .maybeSingle()
  if (caps) ok(`credit-caps row exists (default daily_usd_cap=${caps.daily_usd_cap})`)
  else bad('no credit-caps row provisioned')

  // 2) An offer in that workspace (insert via service role; mirrors createOffer).
  const { data: vertical } = await admin
    .from('verticals')
    .select('id')
    .limit(1)
    .single()
  const { data: offer, error: oErr } = await admin
    .from('offers')
    .insert({
      name: `cap-test-${stamp}`,
      slug: `cap-test-${stamp}`,
      vertical_id: vertical.id,
      created_by_user_id: userId,
      workspace_id: wsId,
      status: 'draft',
      visibility: 'admin_only',
    })
    .select('id')
    .single()
  if (oErr) throw oErr
  offerId = offer.id

  // 3) Set the daily cap to 0 -> any analyze must be blocked.
  await admin
    .from('workspace_credit_caps')
    .update({ daily_usd_cap: 0 })
    .eq('workspace_id', wsId)

  // 4) Sign in as the user to get a real JWT, then call the deployed function.
  const userClient = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { data: signIn, error: sErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  })
  if (sErr) throw sErr
  const token = signIn.session.access_token

  const res = await fetch(`${URL_}/functions/v1/analyze-offer`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ offer_id: offerId }),
  })
  const text = await res.text()
  if (res.status === 429) ok(`cap=0 -> 429 as expected: ${text}`)
  else bad(`expected 429, got ${res.status}: ${text}`)
} catch (err) {
  bad(`unexpected error: ${err.message ?? err}`)
} finally {
  // Cleanup in FK-safe order: offer/ai_runs -> workspace (cascades members/caps)
  // -> user (cascades profile, now unreferenced by any workspace).
  if (offerId) await admin.from('offers').delete().eq('id', offerId)
  if (wsId) {
    await admin.from('ai_runs').delete().eq('workspace_id', wsId)
    await admin.from('workspaces').delete().eq('id', wsId)
  }
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('Cleaned up test user + workspace + offer.')
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
