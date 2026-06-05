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

  console.log(`Running eval-cron on ${vertical} (real Sonnet, runs in background)…\n`)
  const t0 = new Date().toISOString()
  const res = await fetch(`${URL_}/functions/v1/eval-cron`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ vertical, trigger: 'manual' }),
  })
  console.log(`HTTP ${res.status}: ${JSON.stringify(await res.json())}`)

  // Poll for the eval_runs row the background task writes when done.
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  let row = null
  for (let i = 0; i < 90; i++) {
    await sleep(2000)
    const { data } = await admin
      .from('eval_runs')
      .select('id, accuracy_pct, matched_verdict_count, total_offers, total_cost_usd, details')
      .gt('started_at', t0)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (data) {
      row = data
      break
    }
    process.stdout.write('  …running\r')
  }
  console.log()
  if (!row) {
    console.log('Timed out waiting for the eval_runs row.')
  } else {
    console.log(
      `accuracy ${row.accuracy_pct}%  (${row.matched_verdict_count}/${row.total_offers})  cost $${row.total_cost_usd}  eval_run ${row.id}`
    )
    console.log('\nPer-offer:')
    for (const r of row.details?.results ?? []) {
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
