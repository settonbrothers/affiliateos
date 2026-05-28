import { getAdminClient } from './supabaseAdmin.ts'

type FailedMessageType = 'ai_run' | 'webhook_send' | 'email_send' | 'stripe_webhook'

// Dead-letter a failed unit of work so it can be replayed (pg_cron in M2)
// or handled manually from the admin DLQ page.
export async function sendToDlq(args: {
  messageType: FailedMessageType
  payload: Record<string, unknown>
  error: string
  maxAttempts?: number
}): Promise<void> {
  try {
    await getAdminClient()
      .from('failed_messages')
      .insert({
        message_type: args.messageType,
        payload: args.payload,
        last_error: args.error,
        max_attempts: args.maxAttempts ?? 3,
        status: 'pending',
        next_retry_at: new Date(Date.now() + 30_000).toISOString(),
      })
  } catch (err) {
    console.error('sendToDlq failed', args, err)
  }
  // TODO(M2): alert admin (Resend) when messageType === 'ai_run'.
}
