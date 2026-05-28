# CLAUDE.md — affiliateos-claude

## Project Context
- **Project**: AffiliateOS Pro — affiliate underwriting SaaS
- **Owner**: Izak (settonbrothers)
- **Current Milestone**: M1 (Started 2026-05-25). DoD in [03_MILESTONES.md](file:///c:/Users/97252/.gemini/antigravity/scratch/affiliateos/docs/plan/03_MILESTONES.md)

## Read First
Please read the planning documents in order to understand the architecture, guidelines, and milestone goals:
1. [00_README.md](file:///c:/Users/97252/.gemini/antigravity/scratch/affiliateos/docs/plan/00_README.md) → Background & overview of the repo plan.
2. [01_PRINCIPLES.md](file:///c:/Users/97252/.gemini/antigravity/scratch/affiliateos/docs/plan/01_PRINCIPLES.md) → Architecture principles and what has been trimmed.
3. [02_STACK.md](file:///c:/Users/97252/.gemini/antigravity/scratch/affiliateos/docs/plan/02_STACK.md) → Detailed technology stack & rules.
4. [03_MILESTONES.md](file:///c:/Users/97252/.gemini/antigravity/scratch/affiliateos/docs/plan/03_MILESTONES.md) → Milestones (M1-M6) and Definition of Done.
5. [04_SCHEMA_LEAN.md](file:///c:/Users/97252/.gemini/antigravity/scratch/affiliateos/docs/plan/04_SCHEMA_LEAN.md) → Database schema definitions and migrations.
6. [05_AGENT_ROSTER.md](file:///c:/Users/97252/.gemini/antigravity/scratch/affiliateos/docs/plan/05_AGENT_ROSTER.md) → Agent orchestrators & schema envelopes.
7. [06_PARALLEL_CLAUDE_PROTOCOL.md](file:///c:/Users/97252/.gemini/antigravity/scratch/affiliateos/docs/plan/06_PARALLEL_CLAUDE_PROTOCOL.md) → Protocol for parallel sessions of Claude Code (Crucial!).
8. [07_EVAL_HARNESS.md](file:///c:/Users/97252/.gemini/antigravity/scratch/affiliateos/docs/plan/07_EVAL_HARNESS.md) → Evaluation harness & golden dataset.
9. [08_OBSERVABILITY_OPS.md](file:///c:/Users/97252/.gemini/antigravity/scratch/affiliateos/docs/plan/08_OBSERVABILITY_OPS.md) → Observability, Langfuse, DLQ, & Sentry.
10. [09_FIRST_WEEK_TASKS.md](file:///c:/Users/97252/.gemini/antigravity/scratch/affiliateos/docs/plan/09_FIRST_WEEK_TASKS.md) → Day-by-day task lists for Milestone 1.

## Build, Test and Run Commands
- Run development server: `pnpm dev`
- Build project: `pnpm build`
- Typecheck: `pnpm tsc --noEmit`
- Lint: `pnpm lint`
- Run Deno check (for edge functions): `deno check <file>`
- Supabase migrations list: `supabase db list`
- Supabase migrations push: `supabase db push`

## Hard Rules (Survival Checklist)
- **Branch Strategy**: Every session works on its own dedicated feature branch (e.g. `feat/m1-auth-ui`). Never push directly to `main` or amend pushed commits.
- **Code Style**: 
  - Never use `any`. Use `unknown` + narrow.
  - All form validation must be via React Hook Form + zodResolver.
  - All API responses must be validated with Zod.
  - All Supabase calls must go through `src/lib/supabase/{client,server}.ts` (no ad-hoc `createClient`).
- **Database Rules**:
  - All migrations are admin-coordinated (ask before adding).
  - All new tables must receive RLS policies in the same migration file.
  - Do not auto-regenerate `database.ts` inside a branch — let the maintainer run the regen on `main` merge.
- **Forbidden Packages**: Never use Drizzle, Prisma, tRPC, Redux, Zustand, or LangChain.
- **Supabase Deploy**: Never run `supabase functions deploy` from a local session — deployment is handled exclusively by CI.
- **Linear History**: Rebase only. No merge commits.

## When in Doubt
Stop and ask Izak (settonbrothers). Do not guess.
