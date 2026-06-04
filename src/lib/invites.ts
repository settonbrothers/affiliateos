// Pure invite-code validation, shared by the signup action and admin UI.
// Kept side-effect-free so it can be unit-tested without a DB.

export type InviteCodeRow = {
  id: string
  code: string
  bonus_credits: number
  max_uses: number
  uses: number
  expires_at: string | null
  revoked: boolean
}

export type InviteValidity =
  | { valid: true }
  | { valid: false; reason: string }

export function isInviteCodeValid(
  code: InviteCodeRow | null | undefined,
  now: Date
): InviteValidity {
  if (!code) return { valid: false, reason: 'Invalid invite code.' }
  if (code.revoked) return { valid: false, reason: 'This invite code was revoked.' }
  if (code.expires_at && new Date(code.expires_at) < now) {
    return { valid: false, reason: 'This invite code has expired.' }
  }
  if (code.uses >= code.max_uses) {
    return { valid: false, reason: 'This invite code has been fully used.' }
  }
  return { valid: true }
}

// Short, unambiguous code (no 0/O/1/I). Caller supplies randomness so this
// stays deterministic/testable.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function formatInviteCode(randomBytes: Uint8Array): string {
  let out = ''
  for (const b of randomBytes) out += ALPHABET[b % ALPHABET.length]
  return out
}
