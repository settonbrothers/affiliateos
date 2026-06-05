// Env-guarded PostHog capture (fetch-based, no SDK). Best-effort: no-ops when
// the key is absent and never throws, so analytics can't affect a user flow.
// Used for product + cost events (the M6 "cost dashboard" feed).

const DEFAULT_HOST = 'https://us.i.posthog.com'

export function isPosthogConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_POSTHOG_KEY
}

// Pure payload builder — unit-tested without network.
export function buildPosthogPayload(
  apiKey: string,
  distinctId: string,
  event: string,
  properties: Record<string, unknown>,
  isoTimestamp: string
) {
  return {
    api_key: apiKey,
    event,
    distinct_id: distinctId,
    properties,
    timestamp: isoTimestamp,
  }
}

export async function capture(
  distinctId: string,
  event: string,
  properties: Record<string, unknown> = {}
): Promise<void> {
  const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY
  if (!apiKey || !distinctId) return
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || DEFAULT_HOST
  try {
    await fetch(`${host.replace(/\/$/, '')}/capture/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        buildPosthogPayload(apiKey, distinctId, event, properties, new Date().toISOString())
      ),
    })
  } catch {
    // best-effort
  }
}
