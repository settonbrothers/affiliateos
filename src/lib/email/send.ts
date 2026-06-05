import 'server-only'

import type { EmailContent } from './templates'

const FROM = process.env.EMAIL_FROM ?? 'AffiliateOS <onboarding@resend.dev>'

export function isEmailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY
}

// Best-effort send via the Resend REST API (no SDK). No-ops when RESEND_API_KEY
// is absent; never throws, so a mail failure can't break the user flow.
export async function sendEmail(
  to: string | null | undefined,
  content: EmailContent
): Promise<{ sent: boolean }> {
  const key = process.env.RESEND_API_KEY
  if (!key || !to) return { sent: false }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM,
        to,
        subject: content.subject,
        html: content.html,
      }),
    })
    return { sent: res.ok }
  } catch {
    return { sent: false }
  }
}
