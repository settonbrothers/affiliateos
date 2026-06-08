// Pure email templates — return { subject, html }. No I/O, so they're
// unit-testable. Keep the HTML simple and inline (no external CSS in email).

export type EmailContent = { subject: string; html: string }

function layout(title: string, body: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111">
<h2 style="margin:0 0 12px">${title}</h2>
${body}
<p style="margin-top:24px;color:#888;font-size:12px">AffiliateOS Pro</p>
</div>`
}

export function welcomeEmail(opts: { bonusCredits: number }): EmailContent {
  return {
    subject: 'Welcome to AffiliateOS',
    html: layout(
      'Welcome to AffiliateOS',
      `<p>Your account is ready. You start with <strong>${100 + opts.bonusCredits} credits</strong> (100 trial${
        opts.bonusCredits > 0 ? ` + ${opts.bonusCredits} invite bonus` : ''
      }).</p>
<p>Add an offer, run an analysis, and generate a test kit to get going.</p>`
    ),
  }
}

export function receiptEmail(opts: {
  credits: number
  amountCents: number
  kind: 'subscription' | 'credits'
}): EmailContent {
  const amount = `$${(opts.amountCents / 100).toFixed(2)}`
  return {
    subject: 'Your AffiliateOS receipt',
    html: layout(
      'Payment received',
      `<p>Thanks! We charged <strong>${amount}</strong> and added <strong>${opts.credits} credits</strong> to your workspace${
        opts.kind === 'subscription' ? ' (Pro subscription).' : '.'
      }</p>`
    ),
  }
}

export function subscriptionCanceledEmail(): EmailContent {
  return {
    subject: 'Your AffiliateOS subscription was canceled',
    html: layout(
      'Subscription canceled',
      `<p>Your Pro subscription has been canceled. You keep any remaining credits, but they won't renew.</p>
<p>You can resubscribe anytime from the billing page.</p>`
    ),
  }
}

export function paymentFailedEmail(): EmailContent {
  return {
    subject: 'Payment failed — action needed',
    html: layout(
      'Payment failed',
      `<p>We couldn't process your latest payment. Please update your payment method in the billing portal to keep your subscription active.</p>`
    ),
  }
}
