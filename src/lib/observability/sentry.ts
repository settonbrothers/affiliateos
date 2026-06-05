// Env-guarded Sentry error capture via the minimal "store" ingestion endpoint
// (no SDK, no build integration). Best-effort: no-ops without a DSN and never
// throws. Verified by unit tests for DSN parsing + event shape; live delivery
// is pending a real NEXT_PUBLIC_SENTRY_DSN.

export type ParsedDsn = { storeUrl: string; publicKey: string }

// DSN: https://<publicKey>@<host>/<projectId>
export function parseDsn(dsn: string | undefined | null): ParsedDsn | null {
  if (!dsn) return null
  try {
    const u = new URL(dsn)
    const projectId = u.pathname.replace(/^\//, '')
    if (!u.username || !projectId) return null
    return {
      storeUrl: `${u.protocol}//${u.host}/api/${projectId}/store/`,
      publicKey: u.username,
    }
  } catch {
    return null
  }
}

export type ErrorContext = {
  tags?: Record<string, string>
  extra?: Record<string, unknown>
}

// Pure Sentry event payload (legacy store format).
export function buildSentryEvent(
  error: unknown,
  ctx: ErrorContext,
  eventId: string,
  isoTimestamp: string
) {
  const err = error instanceof Error ? error : new Error(String(error))
  return {
    event_id: eventId,
    timestamp: isoTimestamp,
    platform: 'node',
    level: 'error',
    environment: process.env.VERCEL_ENV ?? 'production',
    exception: {
      values: [{ type: err.name || 'Error', value: err.message || String(error) }],
    },
    tags: ctx.tags ?? {},
    extra: ctx.extra ?? {},
  }
}

export function isSentryConfigured(): boolean {
  return !!parseDsn(process.env.NEXT_PUBLIC_SENTRY_DSN)
}

export async function captureException(
  error: unknown,
  ctx: ErrorContext = {}
): Promise<void> {
  const dsn = parseDsn(process.env.NEXT_PUBLIC_SENTRY_DSN)
  if (!dsn) return
  try {
    const eventId = crypto.randomUUID().replace(/-/g, '')
    await fetch(dsn.storeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=affiliateos/1.0, sentry_key=${dsn.publicKey}`,
      },
      body: JSON.stringify(buildSentryEvent(error, ctx, eventId, new Date().toISOString())),
    })
  } catch {
    // best-effort
  }
}
