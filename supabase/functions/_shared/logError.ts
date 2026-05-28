import { getAdminClient } from './supabaseAdmin.ts'

type Severity = 'debug' | 'info' | 'warning' | 'error' | 'critical'

// Structured, queryable error log (Postgres). Fire-and-forget: never throws.
// TODO(M1): forward error/critical to Sentry once the Deno Sentry SDK is wired.
export async function logError(args: {
  severity: Severity
  source: string
  message: string
  context?: Record<string, unknown>
  userId?: string
  workspaceId?: string
}): Promise<void> {
  try {
    await getAdminClient()
      .from('error_logs')
      .insert({
        severity: args.severity,
        source: args.source,
        message: args.message,
        context: args.context ?? null,
        user_id: args.userId ?? null,
        workspace_id: args.workspaceId ?? null,
      })
  } catch (err) {
    console.error('logError failed', args, err)
  }
}
