// Vercel sends `Authorization: Bearer <CRON_SECRET>` on scheduled invocations
// when the CRON_SECRET env var is set. Reject anything that doesn't match.
export function isAuthorizedCron(
  authHeader: string | null,
  secret: string | undefined
): boolean {
  if (!secret) return false
  return authHeader === `Bearer ${secret}`
}
