# CLAUDE.md — affiliateos-claude

## Project Context
- **Project**: AffiliateOS Pro — affiliate underwriting SaaS
- **Owner**: Izak (settonbrothers) · GitHub: `settonbrothers/affiliateos`
- **Current Milestone**: **M1 verified end-to-end (2026-05-31)** — full pipeline confirmed (signup → profile trigger → admin RLS → offers → analyze-offer edge fn → ai_runs). DoD in `docs/plan/03_MILESTONES.md`.
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

## Current State (snapshot)
- Migrations 0001-0009 applied; 0009 is the `handle_new_user` trigger that auto-creates a `profiles` row on signup (the plan's migrations omitted it — required for the demo).
- `@supabase/ssr` is pinned at **0.10.3** (bumped from the plan's 0.5.2 — the older version typed inserts as `never[]` against the new generated-type format).
- `src/middleware.ts` early-returns when Supabase env is absent (pre-setup dev safety).
- `src/types/database.ts` is generated; `src/types/db.ts` derives domain types from it (narrows `evaluation`/`output_payload` jsonb to `UnderwritingResponse`).
- Edge function `analyze-offer` is deployed (one-time manual; no CI deploy job yet).
- Branch protection on `main` is currently OFF.

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
