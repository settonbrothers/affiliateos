// Deno-side email via the Resend REST API. Env-guarded + best-effort: no-ops
// when RESEND_API_KEY (a Supabase secret) is absent, and never throws — a mail
// failure must not affect an AI run.
const FROM = Deno.env.get('EMAIL_FROM') ?? 'AffiliateOS <onboarding@resend.dev>'

export async function sendEmail(
  to: string | null | undefined,
  subject: string,
  html: string
): Promise<void> {
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key || !to) return
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: FROM, to, subject, html }),
    })
  } catch {
    // best-effort
  }
}
