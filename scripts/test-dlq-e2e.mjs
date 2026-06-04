// Verifies the DLQ data-access paths the /admin/failed page + replay action
// rely on: an admin user can READ failed_messages (RLS) and UPDATE their
// status (the replay state machine). Does NOT run a billed analyze — the
// re-invoke uses the same functions.invoke path as triggerAnalyze (proven),
// and sendToDlq population is deploy-covered.
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
const email = `dlqtest+${stamp}@example.com`
const password = 'Test-Password-123!'
let userId, msgId
let failures = 0
const ok = (m) => console.log(`  PASS ${m}`)
const bad = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

try {
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })
  if (cErr) throw cErr
  userId = created.user.id
  await admin.from('profiles').update({ system_role: 'admin' }).eq('id', userId)

  // Seed a synthetic dead-lettered ai_run (as sendToDlq would on a real failure).
  const { data: msg, error: insErr } = await admin
    .from('failed_messages')
    .insert({
      message_type: 'ai_run',
      payload: { kind: 'analyze-offer', offer_id: '00000000-0000-0000-0000-000000000000' },
      last_error: 'synthetic: simulated Anthropic 5xx',
      status: 'pending',
      attempts: 0,
      max_attempts: 3,
    })
    .select('id')
    .single()
  if (insErr) throw insErr
  msgId = msg.id

  // Sign in as the admin user — exercise RLS exactly as the page/action do.
  const userClient = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { data: signIn, error: sErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  })
  if (sErr) throw sErr

  // 1) Page read: admin can SELECT the failed message (RLS admin read).
  const { data: readRow } = await userClient
    .from('failed_messages')
    .select('id, message_type, payload, status')
    .eq('id', msgId)
    .maybeSingle()
  if (readRow?.id === msgId) ok('admin can read failed_messages (page query)')
  else bad('admin could NOT read failed_messages — page would be empty')

  // 2) Replay state machine: admin can UPDATE status (RLS admin write).
  const { error: upErr1 } = await userClient
    .from('failed_messages')
    .update({ status: 'retrying' })
    .eq('id', msgId)
  const { error: upErr2 } = await userClient
    .from('failed_messages')
    .update({ status: 'succeeded', attempts: 1 })
    .eq('id', msgId)
  if (!upErr1 && !upErr2) ok('admin can update failed_messages status (replay writes)')
  else bad(`admin update blocked: ${upErr1?.message ?? ''} ${upErr2?.message ?? ''}`)

  const { data: finalRow } = await admin
    .from('failed_messages')
    .select('status, attempts')
    .eq('id', msgId)
    .maybeSingle()
  if (finalRow?.status === 'succeeded' && finalRow?.attempts === 1)
    ok('status transitioned to succeeded (attempts=1)')
  else bad(`unexpected final state: ${JSON.stringify(finalRow)}`)

  // 3) Non-admin must NOT read the DLQ (RLS negative check).
  const { data: anonCreated } = await admin.auth.admin.createUser({
    email: `dlqnoadmin+${stamp}@example.com`,
    password,
    email_confirm: true,
  })
  const plainClient = createClient(URL_, ANON, { auth: { persistSession: false } })
  await plainClient.auth.signInWithPassword({
    email: `dlqnoadmin+${stamp}@example.com`,
    password,
  })
  const { data: leak } = await plainClient
    .from('failed_messages')
    .select('id')
    .eq('id', msgId)
    .maybeSingle()
  if (!leak) ok('non-admin cannot read failed_messages (RLS holds)')
  else bad('RLS LEAK: non-admin read a failed_message')
  if (anonCreated?.user?.id) {
    const ws = await admin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', anonCreated.user.id)
      .maybeSingle()
    if (ws.data?.workspace_id)
      await admin.from('workspaces').delete().eq('id', ws.data.workspace_id)
    await admin.auth.admin.deleteUser(anonCreated.user.id)
  }
} catch (err) {
  bad(`unexpected error: ${err.message ?? err}`)
} finally {
  if (msgId) await admin.from('failed_messages').delete().eq('id', msgId)
  if (userId) {
    const ws = await admin
      .from('workspace_members')
      .select('workspace_id')
      .eq('user_id', userId)
      .maybeSingle()
    if (ws.data?.workspace_id)
      await admin.from('workspaces').delete().eq('id', ws.data.workspace_id)
    await admin.auth.admin.deleteUser(userId)
  }
  console.log('Cleaned up.')
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
