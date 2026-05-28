import { getAdminClient } from './supabaseAdmin.ts'

// Append-only audit trail for user-facing mutations. Fire-and-forget.
export async function recordAuditLog(args: {
  action: string
  entityType: string
  entityId?: string
  actorUserId?: string
  before?: Record<string, unknown>
  after?: Record<string, unknown>
  reason?: string
}): Promise<void> {
  try {
    await getAdminClient()
      .from('audit_logs')
      .insert({
        action: args.action,
        entity_type: args.entityType,
        entity_id: args.entityId ?? null,
        actor_user_id: args.actorUserId ?? null,
        before: args.before ?? null,
        after: args.after ?? null,
        reason: args.reason ?? null,
      })
  } catch (err) {
    console.error('recordAuditLog failed', args, err)
  }
}
