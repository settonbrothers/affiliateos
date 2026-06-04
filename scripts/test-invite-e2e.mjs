// End-to-end test of the invite-code redemption mechanics the signup action
// performs: a valid code grants bonus credits on top of the trial, increments
// uses, records a redemption, and is then used-up. (The signup server action
// itself is build-covered; isInviteCodeValid is unit-tested.)
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
const admin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
)

const stamp = process.env.STAMP ?? 'manual'
const codeStr = `TEST${stamp}`.toUpperCase().slice(0, 18)
let codeId, userId, wsId
let failures = 0
const ok = (m) => console.log(`  PASS ${m}`)
const bad = (m) => {
  failures++
  console.log(`  FAIL ${m}`)
}
const balance = async () => {
  const { data } = await admin.from('credit_ledger').select('amount').eq('workspace_id', wsId)
  return (data ?? []).reduce((s, r) => s + Number(r.amount), 0)
}

try {
  const { data: code, error: ce } = await admin
    .from('invite_codes')
    .insert({ code: codeStr, bonus_credits: 50, max_uses: 1, uses: 0 })
    .select('id, bonus_credits, max_uses, uses')
    .single()
  if (ce) throw ce
  codeId = code.id

  // Simulate the signup action: create the account (trigger grants 100 trial),
  // then redeem the code.
  const { data: created, error: ue } = await admin.auth.admin.createUser({
    email: `invtest+${stamp}@example.com`,
    password: 'Test-Password-123!',
    email_confirm: true,
  })
  if (ue) throw ue
  userId = created.user.id
  const { data: mem } = await admin
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', userId)
    .maybeSingle()
  wsId = mem?.workspace_id

  if ((await balance()) === 100) ok('trial grant present (100)')
  else bad(`expected 100 trial, got ${await balance()}`)

  // Redeem.
  await admin.from('credit_ledger').insert({
    workspace_id: wsId,
    entry_type: 'granted',
    amount: code.bonus_credits,
    reason: `Invite bonus (${codeStr})`,
  })
  await admin.from('invite_redemptions').insert({
    invite_code_id: codeId,
    user_id: userId,
    workspace_id: wsId,
    credits_granted: code.bonus_credits,
  })
  await admin.from('invite_codes').update({ uses: code.uses + 1 }).eq('id', codeId)

  if ((await balance()) === 150) ok('bonus applied -> balance 150 (100 trial + 50 bonus)')
  else bad(`expected 150 after bonus, got ${await balance()}`)

  const { data: after } = await admin
    .from('invite_codes')
    .select('uses, max_uses')
    .eq('id', codeId)
    .single()
  if (after.uses === 1) ok('uses incremented to 1')
  else bad(`expected uses=1, got ${after.uses}`)
  if (after.uses >= after.max_uses) ok('code now used-up (would reject further signups)')
  else bad('code should be used-up')

  const { count } = await admin
    .from('invite_redemptions')
    .select('*', { count: 'exact', head: true })
    .eq('invite_code_id', codeId)
  if (count === 1) ok('redemption recorded')
  else bad(`expected 1 redemption, got ${count}`)
} catch (err) {
  bad(`unexpected error: ${err.message ?? err}`)
} finally {
  if (codeId) await admin.from('invite_redemptions').delete().eq('invite_code_id', codeId)
  if (wsId) {
    await admin.from('credit_ledger').delete().eq('workspace_id', wsId)
    await admin.from('workspaces').delete().eq('id', wsId)
  }
  if (userId) await admin.auth.admin.deleteUser(userId)
  if (codeId) await admin.from('invite_codes').delete().eq('id', codeId)
  console.log('Cleaned up.')
  console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`)
  process.exit(failures === 0 ? 0 : 1)
}
