// Deno-side PostHog capture (fetch-based). Env-guarded via Supabase secrets
// (POSTHOG_KEY / POSTHOG_HOST); best-effort + never throws.
const DEFAULT_HOST = 'https://us.i.posthog.com'

export function isPosthogConfigured(): boolean {
  return !!Deno.env.get('POSTHOG_KEY')
}

export async function capture(
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  const apiKey = Deno.env.get('POSTHOG_KEY')
  if (!apiKey || !distinctId) return
  const host = Deno.env.get('POSTHOG_HOST') || DEFAULT_HOST
  try {
    await fetch(`${host.replace(/\/$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        event,
        distinct_id: distinctId,
        properties,
        timestamp: new Date().toISOString(),
      }),
    })
  } catch {
    // best-effort
  }
}
