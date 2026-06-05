# AffiliateOS Pro

Affiliate-offer underwriting SaaS for media buyers. You paste an offer, the
system ingests its sources, an AI analyst scores it on 13 dimensions and returns
a verdict, then generates a runnable test kit, diagnoses your real campaign
results, and flags compliance risk — all metered by credits.

> Planning lives in [`docs/plan/`](docs/plan/); incident playbooks in
> [`docs/runbooks/`](docs/runbooks/). The authoritative rules for contributors
> (human or agent) are in [`CLAUDE.md`](CLAUDE.md).

## What it does (the loop)

`invite code → signup → onboarding → add offer → ingest sources (Haiku extraction)
→ analyze (Sonnet underwriting, 13-dim scorecard + verdict) → compliance check
→ generate test kit → create campaign → enter results → diagnosis`

Every AI action spends credits; failed runs auto-refund. Billing (Stripe) tops up
credits; transactional email (Resend) covers welcome/receipts/alerts. Five
orchestrators (Underwriting, SourceExtraction, TestKit, Diagnosis, Compliance)
run as Supabase Edge Functions with shared guardrails: per-orchestrator kill
switches, a daily-USD cost cap, a credit guard, an LLM-as-judge pass, and a
dead-letter queue with admin replay.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict (`noUncheckedIndexedAccess`)
· Tailwind v4 · shadcn/ui · Supabase (Postgres + Auth + Storage + Realtime + Edge
Functions) · Anthropic (Sonnet 4.6 / Haiku 4.5) · Stripe · Resend · Vercel.
See `docs/plan/02_STACK.md` for the full list + forbidden packages.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # fill in values (see below)
pnpm dev                     # http://localhost:3000
```

Signup is **invite-only** — generate a code at `/admin/invite-codes` (or
`node scripts/make-invite.mjs`) before sharing the app.

### Environment

Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY` (the last is a Supabase secret
for edge functions; local CLI eval needs it in `.env.local` too).

Optional (features degrade gracefully when absent):
`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
(billing), `RESEND_API_KEY` (email; also a Supabase secret for edge emails,
plus `ADMIN_ALERT_EMAIL`), `NEXT_PUBLIC_POSTHOG_KEY`/`_HOST` &
`POSTHOG_KEY`/`POSTHOG_HOST` (analytics; the latter pair as Supabase secrets),
`NEXT_PUBLIC_SENTRY_DSN` (error capture), `LANGFUSE_*` (tracing).

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` / `build` / `start` | Dev server / prod build / serve |
| `pnpm lint` / `typecheck` / `test` / `format` | ESLint / `tsc` / Vitest / Prettier |
| `pnpm prompts:sync` | Sync `prompts/<orchestrator>/*.md` → `prompts` table |
| `pnpm eval:run --vertical <slug>` | Replay the active prompt vs the golden set |

Operational / integration scripts (`node scripts/<name>.mjs`, service-role):
`make-invite` (generate an invite code), `audit-rls` (cross-tenant RLS audit),
and `test-*-e2e` (cost-cap, ingest, kill-switch, DLQ, testkit, diagnosis,
compliance, credits, invite, stripe, onboarding) — each creates and cleans up
throwaway data. The real-AI ones cost a little.

## Supabase

```bash
pnpm dlx supabase@latest db push                       # apply migrations
pnpm dlx supabase@latest functions deploy <name>       # deploy an edge function
pnpm dlx supabase@latest gen types typescript --linked | Out-File src/types/database.ts -Encoding utf8
```

Regenerate `database.ts` on `main` after a migration. There is no CI deploy yet —
edge functions are deployed manually.

## Conventions

- TypeScript strict — never `any`; `unknown` + narrow.
- Forms: React Hook Form + Zod resolver; agent/API boundaries validated with Zod.
- All Supabase access via `src/lib/supabase/{client,server,admin}.ts`.
- Migrations only (no Studio edits); every new table ships RLS in the same migration.
- Orchestrator contracts are dual Zod copies (`src/types/agents/*` + edge
  `_shared/types/*`) — keep them in sync.
- Feature branches, rebase-only; never push directly to `main` once protection is on.

Full rules: `CLAUDE.md`. Observability and instrumentation are env-guarded —
nothing breaks if a key is missing.
