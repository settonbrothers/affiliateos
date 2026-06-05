// Invoke the deployed eval-cron function (admin-auth) to run the underwriting
// eval against the golden set, using the Supabase ANTHROPIC secret. Prints the
// accuracy and the eval_runs id (visible at /admin/eval). Uses a throwaway
// admin to authenticate, then cleans it up. Leaves the eval_runs row.
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

const vertical = process.argv[2] ?? 'ai_saas'
const stamp = `${Date.now()}`
let userId, wsId

try {
  const { data: created } = await admin.auth.admin.createUser({
    email: `evalcron+${stamp}@example.com`,
    password: 'Test-Password-123!',
    email_confirm: true,
  })
  userId = created.user.id
  await admin.from('profiles').update({ system_role: 'admin' }).eq('id', userId)
  const { data: mem } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle()
  wsId = mem?.workspace_id

  const userClient = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { data: signIn } = await userClient.auth.signInWithPassword({
    email: `evalcron+${stamp}@example.com`,
    password: 'Test-Password-123!',
  })
  const token = signIn.session.access_token

  console.log(`Running eval-cron on ${vertical} (real Sonnet over the golden set)…\n`)
  const res = await fetch(`${URL_}/functions/v1/eval-cron`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vertical, trigger: 'manual' }),
  })
  const out = await res.json()
  console.log(`HTTP ${res.status}`)
  console.log(JSON.stringify(out, null, 2))

  if (out.eval_run_id) {
    const { data: details } = await admin
      .from('eval_runs')
      .select('details')
      .eq('id', out.eval_run_id)
      .maybeSingle()
    console.log('\nPer-offer:')
    for (const r of details?.details?.results ?? []) {
      console.log(
        `  ${r.verdict_match ? '✓' : '✗'} ${String(r.external_id).padEnd(9)} ${String(r.offer_name).padEnd(34)} got=${r.actual_verdict ?? 'ERR'} expected=${r.expected_verdict}`
      )
    }
  }
} catch (err) {
  console.error('error:', err.message ?? err)
} finally {
  if (wsId) await admin.from('workspaces').delete().eq('id', wsId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('\n(cleaned up the throwaway admin; the eval_runs row remains in /admin/eval)')
}
