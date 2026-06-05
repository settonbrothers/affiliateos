# Runbook: Stripe webhook is failing

**Symptoms:** Customers paid but credits didn't arrive; subscription status not
updating on `/billing`; Stripe Dashboard → Developers → Webhooks shows failed
deliveries to `/api/stripe/webhook`.

## Quick checks
1. **Configured?** The route returns **503 "Billing not configured"** if
   `STRIPE_SECRET_KEY` or `STRIPE_WEBHOOK_SECRET` is missing in the deployment
   env. Set both in Vercel and redeploy.
2. **Signature 400s?** "Invalid signature" means `STRIPE_WEBHOOK_SECRET` doesn't
   match the endpoint's signing secret. Copy the secret from the exact endpoint
   in the Stripe Dashboard (test vs live differ).
3. **Right events?** Subscribe the endpoint to: `checkout.session.completed`,
   `customer.subscription.*`, `invoice.paid`, `invoice.payment_failed`.

## How grants work (so you can verify)
- Credits are granted to `credit_ledger` as `entry_type = 'purchased'`, keyed off
  `metadata.workspace_id` + `metadata.credits` on the checkout session.
- Subscription renewals grant on `invoice.paid` with
  `billing_reason = 'subscription_cycle'` (resolved via `stripe_customers`).
- Every processed event id is stored in `stripe_events` → **idempotent**; a
  re-delivery is a safe no-op.

## Recover missed credits
1. In the Stripe Dashboard, **resend** the failed events — they'll process
   correctly now (idempotency prevents double-grants of already-processed ones).
2. If an event was permanently lost, grant manually: `/billing` (admin "Grant
   credits") or insert a `credit_ledger` `'purchased'` row for the workspace, and
   note it in `reason`.
3. Confirm the workspace's balance on `/billing`.
