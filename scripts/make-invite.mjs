// Generate an invite code from the CLI (same effect as /admin/invite-codes).
// Usage: BONUS=50 USES=5 DAYS=30 node scripts/make-invite.mjs
import { randomBytes } from 'node:crypto'
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

// Mirrors formatInviteCode() in src/lib/invites.ts (unambiguous alphabet).
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const code = [...randomBytes(10)].map((b) => ALPHABET[b % ALPHABET.length]).join('')

const bonus = Number(process.env.BONUS ?? 50)
const uses = Number(process.env.USES ?? 5)
const days = Number(process.env.DAYS ?? 30)
const expiresAt = days > 0 ? new Date(Date.now() + days * 86_400_000).toISOString() : null

// Attribute to an existing admin if there is one.
const { data: adminProfile } = await admin
  .from('profiles')
  .select('id')
  .eq('system_role', 'admin')
  .limit(1)
  .maybeSingle()

const { error } = await admin.from('invite_codes').insert({
  code,
  bonus_credits: bonus,
  max_uses: uses,
  expires_at: expiresAt,
  created_by: adminProfile?.id ?? null,
})
if (error) {
  console.error('Failed:', error.message)
  process.exit(1)
}

console.log('\n  Invite code generated:\n')
console.log(`    ${code}\n`)
console.log(`  bonus_credits: ${bonus}   max_uses: ${uses}   expires: ${expiresAt ?? 'never'}`)
console.log('\n  Share this with a new user — they enter it on /signup.\n')
