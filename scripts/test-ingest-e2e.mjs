// End-to-end test of the M2 source-ingestion path against the DEPLOYED
// ingest-source function: admin pastes a URL -> fetch -> Haiku extraction ->
// source_documents + extracted_facts. Uses a throwaway admin user, a real
// bot-friendly URL, polls the job to completion, then cleans everything up.
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
const targetUrl =
  process.env.INGEST_URL ?? 'https://en.wikipedia.org/wiki/Affiliate_marketing'
const email = `ingesttest+${stamp}@example.com`
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
  // ingest-source requires admin (requireAdmin).
  await admin.from('profiles').update({ system_role: 'admin' }).eq('id', userId)
  console.log(`Created admin user ${email}`)

  const { data: mem } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle()
  wsId = mem?.workspace_id
  if (!wsId) bad('no workspace provisioned')

  const { data: vertical } = await admin
    .from('verticals')
    .select('id')
    .limit(1)
    .single()
  const { data: offer, error: oErr } = await admin
    .from('offers')
    .insert({
      name: `ingest-test-${stamp}`,
      slug: `ingest-test-${stamp}`,
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

  const userClient = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { data: signIn, error: sErr } = await userClient.auth.signInWithPassword({
    email,
    password,
  })
  if (sErr) throw sErr
  const token = signIn.session.access_token

  console.log(`Ingesting: ${targetUrl}`)
  const res = await fetch(`${URL_}/functions/v1/ingest-source`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ offer_id: offerId, url: targetUrl }),
  })
  const body = await res.json().catch(() => ({}))
  if (res.status === 200 && body.job_id) ok(`queued job ${body.job_id.slice(0, 8)}…`)
  else bad(`expected 200+job_id, got ${res.status}: ${JSON.stringify(body)}`)

  // Poll the job to a terminal state (background extraction).
  let job
  for (let i = 0; i < 30; i++) {
    await sleep(2000)
    const { data } = await admin
      .from('source_fetch_jobs')
      .select('status, error_message')
      .eq('id', body.job_id)
      .maybeSingle()
    job = data
    if (job && ['completed', 'failed'].includes(job.status)) break
    process.stdout.write(`  …job=${job?.status ?? '?'}\r`)
  }
  console.log()
  if (job?.status === 'completed') ok('job completed')
  else bad(`job did not complete: status=${job?.status} err=${job?.error_message}`)

  const { count: docCount } = await admin
    .from('source_documents')
    .select('*', { count: 'exact', head: true })
    .eq('offer_id', offerId)
  if (docCount > 0) ok(`${docCount} source_document(s) stored`)
  else bad('no source_documents stored')

  const { data: facts, count: factCount } = await admin
    .from('extracted_facts')
    .select('fact_type, fact_value', { count: 'exact' })
    .eq('offer_id', offerId)
    .limit(5)
  console.log(`  extracted ${factCount ?? 0} fact(s)` + (factCount ? ':' : ''))
  for (const f of facts ?? []) console.log(`    - ${f.fact_type}: ${f.fact_value?.slice(0, 60)}`)
} catch (err) {
  bad(`unexpected error: ${err.message ?? err}`)
} finally {
  if (offerId) {
    await admin.from('extracted_facts').delete().eq('offer_id', offerId)
    await admin.from('source_fetch_jobs').delete().eq('offer_id', offerId)
    await admin.from('source_documents').delete().eq('offer_id', offerId)
    await admin.from('ai_runs').delete().eq('offer_id', offerId)
    await admin.from('offers').delete().eq('id', offerId)
  }
  if (wsId) await admin.from('workspaces').delete().eq('id', wsId)
  if (userId) await admin.auth.admin.deleteUser(userId)
  console.log('Cleaned up.')
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
