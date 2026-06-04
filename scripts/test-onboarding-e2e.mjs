// Verifies onboarding: existing users are backfilled as onboarded; a new user
// is NOT onboarded; the user can save their own operator_profile (RLS) which
// stores the context and sets onboarded_at.
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
const email = `obtest+${stamp}@example.com`
const password = 'Test-Password-123!'
let userId, wsId
let failures = 0
const ok = (m) => console.log(`  PASS ${m}`)
const bad = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

try {
  // Backfill: existing profiles should have an onboarded row.
  const { count: backfilled } = await admin
    .from('operator_profiles')
    .select('*', { count: 'exact', head: true })
    .not('onboarded_at', 'is', null)
  if ((backfilled ?? 0) >= 1) ok(`existing users backfilled as onboarded (${backfilled})`)
  else bad('no backfilled operator_profiles found')

  const { data: created } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  userId = created.user.id
  const { data: mem } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle()
  wsId = mem?.workspace_id

  // New user has no operator_profile -> not onboarded.
  const { data: row0 } = await admin
    .from('operator_profiles')
    .select('onboarded_at')
    .eq('user_id', userId)
    .maybeSingle()
  if (!row0) ok('new signup is NOT onboarded (no row -> gated to /onboarding)')
  else bad(`new user unexpectedly has a profile: ${JSON.stringify(row0)}`)

  // Save via the USER client (exercises the RLS "manage own" policy).
  const userClient = createClient(URL_, ANON, { auth: { persistSession: false } })
  await userClient.auth.signInWithPassword({ email, password })
  const { error: upErr } = await userClient.from('operator_profiles').upsert(
    {
      user_id: userId,
      experience_level: 'advanced',
      cashflow_tolerance: 'flexible',
      primary_channels: ['paid_social', 'native'],
      budget_min_usd: 500,
      budget_max_usd: 5000,
      onboarded_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  )
  if (!upErr) ok('user saved own operator_profile (RLS allows own)')
  else bad(`user upsert blocked: ${upErr.message}`)

  const { data: row1 } = await admin
    .from('operator_profiles')
    .select('onboarded_at, experience_level, primary_channels, budget_max_usd')
    .eq('user_id', userId)
    .maybeSingle()
  if (
    row1?.onboarded_at &&
    row1.experience_level === 'advanced' &&
    Array.isArray(row1.primary_channels) &&
    row1.primary_channels.length === 2 &&
    row1.budget_max_usd === 5000
  ) {
    ok('profile stored + onboarded (experience=advanced, 2 channels, budget)')
  } else {
    bad(`stored profile wrong: ${JSON.stringify(row1)}`)
  }
} catch (err) {
  bad(`unexpected error: ${err.message ?? err}`)
} finally {
  if (wsId) await admin.from('workspaces').delete().eq('id', wsId)
  if (userId) await admin.auth.admin.deleteUser(userId) // cascades operator_profiles
  console.log('Cleaned up.')
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
