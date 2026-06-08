// Create a Stripe webhook endpoint pointing at the production app, for the
// events the handler cares about. Prints ONLY the signing secret to stdout
// (so it can be piped straight into `vercel env add` without ever being shown);
// all human-readable info goes to stderr.
//   node scripts/create-webhook.mjs [url] | npx vercel env add STRIPE_WEBHOOK_SECRET production
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    })
)
const stripe = new Stripe(env.STRIPE_SECRET_KEY)
const url = process.argv[2] || 'https://affiliateos-sooty.vercel.app/api/stripe/webhook'

const ep = await stripe.webhookEndpoints.create({
  url,
  enabled_events: [
    'checkout.session.completed',
    'customer.subscription.created',
    'customer.subscription.updated',
    'customer.subscription.deleted',
    'invoice.paid',
    'invoice.payment_failed',
  ],
  description: 'AffiliateOS production webhook',
})

console.error(`Created webhook endpoint ${ep.id}`)
console.error(`  url: ${ep.url}`)
console.error(`  events: ${ep.enabled_events.length}  status: ${ep.status}`)
console.error('  (signing secret piped to stdout — not displayed)')
process.stdout.write(ep.secret) // ONLY the whsec, no newline
