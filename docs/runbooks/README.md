# Runbooks

Incident playbooks for AffiliateOS. Each is short and specific to this stack
(Next.js on Vercel, Supabase Postgres + Edge Functions, Anthropic, Stripe,
Resend).

- [Anthropic is down / erroring](anthropic-down.md)
- [Stripe webhook is failing](stripe-webhook-failing.md)
- [Database is full / slow](db-full.md)
- [Roll back a bad prompt](prompt-rollback.md)

Health check: `GET /api/health` → `{ "status": "ok", "db": true }` (200) when the
app + DB are reachable; 503 when degraded. Point the uptime monitor here.
