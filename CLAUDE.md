# CLAUDE.md — affiliateos-claude

## Project Context
- **Project**: AffiliateOS Pro — affiliate underwriting SaaS
- **Owner**: Izak (settonbrothers) · GitHub: `settonbrothers/affiliateos`
- **Current Milestone**: **M4 functionally complete (2026-06-04)**. M1 verified 2026-05-31. Full operator journey works end-to-end: offer → ingest sources → real Haiku extraction → analyze (real Sonnet) → scorecard/verdict → Generate Test Kit → create campaign → paste results → Diagnosis → Compliance check (caps verdict for risky health/mental offers). All **5 orchestrators are real**. Guardrails throughout (kill-switch, daily-USD cost-cap, DLQ-on-failure, LLM-judge). Remaining work is owner-gated: label golden sets + run real evals/judge (needs `ANTHROPIC_API_KEY` locally or a cron on the Supabase secret); test-kit/diagnosis quality evals. DoD in `docs/plan/03_MILESTONES.md`.
- **Supabase project**: `affiliateos-prod` (ref `pfuwahtntsnlprjqlwcn`, region `eu-central-1`).

## Read First
Read in order before writing code:
1. `docs/plan/00_README.md` — overview of the doc set
2. `docs/plan/01_PRINCIPLES.md` — locked architectural decisions
3. `docs/plan/02_STACK.md` — tech stack + forbidden packages
4. `docs/plan/03_MILESTONES.md` — milestones + DoD
5. `docs/plan/04_SCHEMA_LEAN.md` — DB schema + migration order
6. `docs/plan/05_AGENT_ROSTER.md` — 5 orchestrators + Universal Envelope
7. `docs/plan/06_PARALLEL_CLAUDE_PROTOCOL.md` — branch/PR discipline
8. `docs/plan/07_EVAL_HARNESS.md` — golden set + regression
9. `docs/plan/08_OBSERVABILITY_OPS.md` — Langfuse/Sentry/DLQ
10. `docs/plan/09_FIRST_WEEK_TASKS.md` — M1 day-by-day (now mostly done)

Past decisions: `decisions/001-admin-rls-helper.md`, `decisions/002-agent-contract-location.md`.

## Commands
- Dev server: `pnpm dev`
- Build: `pnpm build`
- Typecheck: `pnpm typecheck`
- Lint: `pnpm lint`
- Tests (Vitest): `pnpm test`
- Format: `pnpm format`
- Supabase CLI (no install — uses dlx): `pnpm dlx supabase@latest <cmd>`
- Apply migrations: `pnpm dlx supabase@latest db push`
- Regenerate DB types: `pnpm dlx supabase@latest gen types typescript --linked | Out-File src/types/database.ts -Encoding utf8`
- Deploy edge fn: `pnpm dlx supabase@latest functions deploy <name>`

## Current State (snapshot, 2026-06-04)
- **Migrations 0001-0026 applied** (local == remote). 0009 = `handle_new_user`; **0021** extended it to also provision a workspace + owner membership + `workspace_credit_caps` on signup (1 user : 1 workspace) and backfilled existing rows — before 0021 `workspace_id` was always NULL, silently disabling the daily-USD cost-cap. **0022** test_kits, **0023** campaigns/campaign_results/result_diagnoses, **0024** compliance_rules (seeded) + offer_compliance_warnings, **0025** usage_pricing_rules + credit_ledger (trigger now also grants 100 trial credits), **0026** invite_codes + invite_redemptions.
- **M5 (in progress)**: credit economy is live — every AI action reserves/debits credits (`_shared/credits.ts`; **402** when short, refund on failure), `/billing` + sidebar balance. **Signup is now invite-only** — the signup action requires + redeems an `invite_codes` code (grants bonus credits); generate them at `/admin/invite-codes` or `node scripts/make-invite.mjs`. **The DB starts with 0 invite codes, so new signups are blocked until an admin generates one.** Magic-link signup is NOT yet gated. **Stripe billing is built but env-guarded** (migration 0027; `lib/stripe/*`, `/api/stripe/webhook`, `/billing` buttons): inactive until `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / publishable key are set and a Stripe webhook endpoint points at `/api/stripe/webhook`. Purchases grant `credit_ledger` 'purchased'. The live checkout/webhook round-trip is unverified pending keys; planEffects + DB ops are tested. **Transactional email is built but env-guarded** (`src/lib/email/*` Node + `_shared/email.ts` Deno, Resend via fetch, best-effort no-op): welcome (signup), receipt/cancellation/payment-failed (Stripe webhook), low-credit (edge, debit crossing 10), admin agent-failure alert (DLQ → `ADMIN_ALERT_EMAIL`). Inactive until `RESEND_API_KEY` is set (Node) / added as a Supabase secret (edge). **Onboarding** (migration 0028): new signups are gated to `/onboarding` (4-step operator profile); existing users backfilled as onboarded. Migrations now run **0001-0028**.
- **5 edge functions deployed (manual)**, all with auth + kill-switch + daily-USD cap + DLQ-on-failure: `analyze-offer` (Sonnet underwriting + judge), `ingest-source` (Haiku extraction), `generate-test-kit` (Sonnet, needs a prior verdict), `diagnose-results` (Sonnet, needs saved results), `check-compliance` (Haiku, sets a verdict cap). Redeploy with `pnpm dlx supabase@latest functions deploy <name>` — still no CI deploy.
- **Real AI is live** (keys are Supabase secrets). `ANTHROPIC_API_KEY` is **empty in local `.env.local`** → local CLI scripts (`eval:run`) get 401 until set.
- **Orchestrators** (`supabase/functions/_shared/orchestrators/`): underwriting, sourceExtraction, testKit, diagnosis, complianceCheck — each real-or-mock, dual Zod contracts (Node `src/types/agents/*` + Deno `_shared/types/*`, KEEP IN SYNC), prompt in `prompts/<name>/` synced via `pnpm prompts:sync`.
- **App surfaces**: Offers + Campaigns (sidebar). Offer page tabs: Overview/Scorecard/Verdict/Test Kit/Compliance, plus admin "Manage sources". Admin: `/admin/{ai-runs,prompts,eval,eval/golden,kill-switches,failed,compliance}`.
- **Manual integration tests**: `scripts/test-*-e2e.mjs` (cap 429, ingest, kill-switch 503, DLQ RLS, testkit, diagnosis, compliance) — create + clean up throwaway users; `node scripts/<name>.mjs` (real-AI ones cost a little). Note: TestKit/Diagnosis Sonnet runs take ~40-90s.
- `@supabase/ssr` pinned at **0.10.3**; `src/middleware.ts` early-returns when Supabase env is absent; `src/types/db.ts` derives domain types from generated `database.ts` (regen on `main` after a migration: `pnpm dlx supabase@latest gen types typescript --linked | Out-File src/types/database.ts -Encoding utf8`).
- Branch protection on `main` is currently OFF (this session merged feature branches via `--ff-only` + push).

## Hard Rules
- **Branching**: feature branches (`feat/m1-...`); never push directly to `main` once branch protection is enabled. Rebase only — no merge commits.
- **TypeScript**: never `any`; use `unknown` + narrow. Project is strict + `noUncheckedIndexedAccess`.
- **Forms**: React Hook Form + zodResolver. **API/agent boundaries**: validate with Zod.
- **Supabase access**: only through `src/lib/supabase/{client,server,admin}.ts` — no ad-hoc `createClient`.
- **DB rules**:
  - All migrations admin-coordinated (ask before adding).
  - New tables ship RLS in the same migration.
  - Don't regenerate `database.ts` from a feature branch — regen on `main` after merge.
- **Forbidden packages**: Drizzle, Prisma, tRPC, Redux, Zustand, LangChain.
- **Secrets**: `.env.local` is gitignored — never commit it; never paste secrets into code or chat. `SUPABASE_SERVICE_ROLE_KEY` is server-only (`admin.ts` uses `import 'server-only'`).
- **Edge fn deploys**: should move to CI before regular use; until then, a manual `supabase functions deploy` is acceptable (note in PR).

## Windows / dev gotchas
- After switching branches, clean the stale Next build cache: `Remove-Item -Recurse -Force .next` — Next leaks route validator types across branches and `tsc` complains.
- PowerShell `>` redirect writes UTF-16 (breaks TS files). Use `| Out-File -Encoding utf8`.
- Supabase CLI: use `pnpm dlx supabase@latest <cmd>` — `winget` does not carry a `Supabase.CLI` package; the npm/dlx route is documented and avoids a global install.

## When in doubt
Stop and ask Izak. Do not guess.
