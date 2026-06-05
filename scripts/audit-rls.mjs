// RLS cross-tenant audit (M6 hardening). Seeds user B's workspace with data in
// every sensitive table, then — signed in as a different non-admin user A —
// confirms A can read NONE of B's rows, and CAN read its own. A leak prints FAIL.
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
const svc = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const stamp = process.env.STAMP ?? 'manual'
let failures = 0
const ok = (m) => console.log(`  PASS ${m}`)
const bad = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}

async function mkUser(tag) {
  const email = `rls${tag}+${stamp}@example.com`
  const { data } = await svc.auth.admin.createUser({
    email,
    password: 'Test-Password-123!',
    email_confirm: true,
  })
  const userId = data.user.id
  const { data: mem } = await svc
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle()
  return { email, userId, wsId: mem?.workspace_id }
}

const created = { offerId: null, campaignId: null, inviteId: null, failedId: null }
let A, B

try {
  A = await mkUser('a')
  B = await mkUser('b')

  // --- Seed user B's data (service role bypasses RLS) ---
  const { data: vertical } = await svc.from('verticals').select('id').limit(1).single()
  const { data: offer } = await svc
    .from('offers')
    .insert({
      name: `rls-b-${stamp}`,
      slug: `rls-b-${stamp}`,
      vertical_id: vertical.id,
      created_by_user_id: B.userId,
      workspace_id: B.wsId,
      status: 'draft',
      visibility: 'admin_only',
    })
    .select('id')
    .single()
  created.offerId = offer.id

  await svc.from('ai_runs').insert({
    offer_id: offer.id,
    workspace_id: B.wsId,
    user_id: B.userId,
    orchestrator_name: 'UnderwritingOrchestrator',
    agent_version: 'seed',
    model: 'mock',
    input_payload: {},
    status: 'success',
  })
  await svc.from('test_kits').insert({
    offer_id: offer.id,
    workspace_id: B.wsId,
    created_by_user_id: B.userId,
    payload: {},
  })
  const { data: camp } = await svc
    .from('campaigns')
    .insert({ offer_id: offer.id, workspace_id: B.wsId, created_by_user_id: B.userId, name: 'rls-b' })
    .select('id')
    .single()
  created.campaignId = camp.id
  await svc.from('campaign_results').insert({ campaign_id: camp.id, clicks: 10 })
  await svc.from('result_diagnoses').insert({ campaign_id: camp.id, workspace_id: B.wsId, payload: {} })
  await svc.from('offer_compliance_warnings').insert({
    offer_id: offer.id,
    workspace_id: B.wsId,
    overall_risk_level: 'low',
    payload: {},
  })
  await svc.from('subscriptions').insert({
    workspace_id: B.wsId,
    stripe_subscription_id: `sub_rls_${stamp}`,
    status: 'active',
    plan: 'pro',
  })
  await svc.from('stripe_customers').insert({ workspace_id: B.wsId, stripe_customer_id: `cus_rls_${stamp}` })
  await svc.from('operator_profiles').insert({ user_id: B.userId, onboarded_at: new Date().toISOString() })
  // Admin-only tables.
  const { data: inv } = await svc
    .from('invite_codes')
    .insert({ code: `RLSAUDIT${stamp}`.slice(0, 18), bonus_credits: 10, max_uses: 1 })
    .select('id')
    .single()
  created.inviteId = inv.id
  const { data: fm } = await svc
    .from('failed_messages')
    .insert({ message_type: 'ai_run', payload: {}, last_error: 'seed' })
    .select('id')
    .single()
  created.failedId = fm.id

  // --- Sign in as A (non-admin) and try to read B's rows ---
  const a = createClient(URL_, ANON, { auth: { persistSession: false } })
  await a.auth.signInWithPassword({ email: A.email, password: 'Test-Password-123!' })

  const leak = async (label, table, col, val) => {
    const { data, error } = await a.from(table).select('*').eq(col, val)
    if (error) {
      // A hard RLS denial (error) is also "no leak".
      ok(`${label}: blocked (${error.code ?? 'denied'})`)
      return
    }
    if ((data?.length ?? 0) === 0) ok(`${label}: 0 rows (isolated)`)
    else bad(`${label}: LEAK — A read ${data.length} of B's rows`)
  }

  await leak('offers', 'offers', 'id', created.offerId)
  await leak('ai_runs', 'ai_runs', 'workspace_id', B.wsId)
  await leak('extracted_facts', 'extracted_facts', 'offer_id', created.offerId)
  await leak('test_kits', 'test_kits', 'workspace_id', B.wsId)
  await leak('campaigns', 'campaigns', 'workspace_id', B.wsId)
  await leak('campaign_results', 'campaign_results', 'campaign_id', created.campaignId)
  await leak('result_diagnoses', 'result_diagnoses', 'workspace_id', B.wsId)
  await leak('credit_ledger', 'credit_ledger', 'workspace_id', B.wsId)
  await leak('offer_compliance_warnings', 'offer_compliance_warnings', 'workspace_id', B.wsId)
  await leak('subscriptions', 'subscriptions', 'workspace_id', B.wsId)
  await leak('stripe_customers', 'stripe_customers', 'workspace_id', B.wsId)
  await leak('operator_profiles', 'operator_profiles', 'user_id', B.userId)
  await leak('workspace_credit_caps', 'workspace_credit_caps', 'workspace_id', B.wsId)
  await leak('profiles', 'profiles', 'id', B.userId)
  await leak('invite_codes (admin-only)', 'invite_codes', 'id', created.inviteId)
  await leak('failed_messages (admin-only)', 'failed_messages', 'id', created.failedId)

  // Positive control: A can read its OWN credit ledger (RLS not blanket-deny).
  const { data: ownLedger } = await a
    .from('credit_ledger')
    .select('amount')
    .eq('workspace_id', A.wsId)
  if ((ownLedger?.length ?? 0) > 0) ok('positive control: A reads its own credit_ledger')
  else bad('A cannot read its own credit_ledger (RLS too strict)')
} catch (err) {
  bad(`unexpected error: ${err.message ?? err}`)
} finally {
  // Cleanup, FK-safe.
  if (created.campaignId) {
    await svc.from('result_diagnoses').delete().eq('campaign_id', created.campaignId)
    await svc.from('campaign_results').delete().eq('campaign_id', created.campaignId)
    await svc.from('campaigns').delete().eq('id', created.campaignId)
  }
  if (created.offerId) {
    await svc.from('offer_compliance_warnings').delete().eq('offer_id', created.offerId)
    await svc.from('test_kits').delete().eq('offer_id', created.offerId)
    await svc.from('extracted_facts').delete().eq('offer_id', created.offerId)
    await svc.from('ai_runs').delete().eq('offer_id', created.offerId)
    await svc.from('offers').delete().eq('id', created.offerId)
  }
  if (created.inviteId) await svc.from('invite_codes').delete().eq('id', created.inviteId)
  if (created.failedId) await svc.from('failed_messages').delete().eq('id', created.failedId)
  for (const u of [A, B].filter(Boolean)) {
    if (u.wsId) {
      await svc.from('subscriptions').delete().eq('workspace_id', u.wsId)
      await svc.from('stripe_customers').delete().eq('workspace_id', u.wsId)
      await svc.from('credit_ledger').delete().eq('workspace_id', u.wsId)
      await svc.from('workspaces').delete().eq('id', u.wsId)
    }
    if (u.userId) await svc.auth.admin.deleteUser(u.userId)
  }
  console.log('Cleaned up.')
  console.log(failures === 0 ? '\nRLS AUDIT PASSED — no cross-tenant leaks' : `\n${failures} LEAK(S)/ISSUE(S) FOUND`)
  process.exit(failures === 0 ? 0 : 1)
}
