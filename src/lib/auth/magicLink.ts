// Magic-link is a LOGIN path only — signup is invite-only. When sendMagicLink
// uses shouldCreateUser:false, Supabase rejects unknown emails with a
// "Signups not allowed for otp" / otp_disabled error. Map that to an
// invite-aware message instead of leaking that magic-link could be a signup.
export function magicLinkErrorMessage(rawError: string): string {
  const e = rawError.toLowerCase()
  if (e.includes('signups not allowed') || e.includes('otp_disabled')) {
    return 'No account found for that email. Sign up with an invite code first.'
  }
  return rawError
}
