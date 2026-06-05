import { sendEmail } from './email.ts'
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

  // Alert the admin on agent failures (best-effort; no-op without the keys).
  if (args.messageType === 'ai_run') {
    const adminEmail = Deno.env.get('ADMIN_ALERT_EMAIL')
    const kind = String((args.payload as { kind?: string }).kind ?? 'ai_run')
    await sendEmail(
      adminEmail,
      `[AffiliateOS] ${kind} failed`,
      `<p><strong>${kind}</strong> failed and was dead-lettered.</p>` +
        `<pre style="background:#f5f5f5;padding:8px;border-radius:6px;white-space:pre-wrap">${args.error}</pre>` +
        `<p>Replay from /admin/failed once the cause clears.</p>`
    )
  }
}
