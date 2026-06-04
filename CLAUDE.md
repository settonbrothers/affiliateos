# CLAUDE.md — affiliateos-claude

## Project Context
- **Project**: AffiliateOS Pro — affiliate underwriting SaaS
- **Owner**: Izak (settonbrothers) · GitHub: `settonbrothers/affiliateos`
- **Current Milestone**: **M2 functionally complete; M3 largely done (2026-06-04)**. M1 verified 2026-05-31. M2 demo loop works end-to-end (offer → ingest sources → real Haiku extraction → facts → analyze → scorecard) with kill-switch, daily-USD cost-cap, and DLQ replay. M3 has real Sonnet underwriting + LLM-judge + eval harness wired; remaining M3 work is owner-gated (label 20 golden offers, run real evals/judge — needs `ANTHROPIC_API_KEY` locally or a cron on the Supabase secret). DoD in `docs/plan/03_MILESTONES.md`.
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
- **Migrations 0001-0021 applied** (local == remote). 0009 = `handle_new_user`; **0021** extended it to also provision a workspace + owner membership + `workspace_credit_caps` row on signup (1 user : 1 workspace) and backfilled existing users/offers/ai_runs. Before 0021, `workspace_id` was always NULL, which silently disabled the daily-USD cost-cap.
- **Edge functions deployed (manual)**: `analyze-offer` (kill-switch + daily-USD cap + LLM-judge + DLQ on failure) and `ingest-source` (fetch → Haiku extraction → facts). Both ACTIVE; redeploy with `pnpm dlx supabase@latest functions deploy <name>` after editing — there's still no CI deploy.
- **Real AI is live**: analyze runs real Sonnet underwriting; ingest runs real Haiku extraction (keys are Supabase secrets). `ANTHROPIC_API_KEY` is **empty in local `.env.local`** → local CLI scripts (`eval:run`) get 401 until set.
- **Admin surfaces**: `/admin/{ai-runs,prompts,eval,eval/golden,kill-switches,failed}`. Offer page → "Manage sources" (admin) → `/admin/offers/[id]/sources`.
- **Eval harness**: `scripts/eval-run.mts` (was `.ts` — renamed to fix a top-level-await/CJS crash) + golden-set UI; needs golden offers labeled + a real key to produce accuracy.
- **Manual integration tests** live in `scripts/test-*-e2e.mjs` (cost-cap 429, ingest, kill-switch 503, DLQ RLS) — they create + clean up throwaway users; run with `node scripts/<name>.mjs`.
- `@supabase/ssr` pinned at **0.10.3**; `src/middleware.ts` early-returns when Supabase env is absent; `src/types/db.ts` derives domain types from generated `database.ts`.
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
