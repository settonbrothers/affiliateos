# AffiliateOS Pro

Affiliate offer underwriting SaaS for media buyers. Solo build, Claude Code assisted.

> Planning lives in [`docs/plan/`](docs/plan/). Read `00_README.md` → `01_PRINCIPLES.md`
> → `02_STACK.md` → `03_MILESTONES.md` → `06_PARALLEL_CLAUDE_PROTOCOL.md` before
> writing code. Current milestone: **M1 — Foundation + Mock AI Plumbing**.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript strict · Tailwind v4 · shadcn/ui ·
Supabase (Postgres + Auth + Storage + Realtime) · Anthropic (Sonnet 4.6 / Haiku 4.5) ·
Vercel. See `docs/plan/02_STACK.md` for the full list and forbidden packages.

## Getting started

```bash
pnpm install
cp .env.example .env.local   # then fill in the values
pnpm dev                     # http://localhost:3000
```

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run the dev server |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm lint` | ESLint (next lint) |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm test` | Run Vitest |
| `pnpm format` | Prettier write |

## Conventions

- TypeScript strict — never `any`, use `unknown` + narrow.
- Forms via React Hook Form + Zod resolver; API responses validated with Zod.
- All Supabase access goes through `src/lib/supabase/{client,server}.ts`.
- Migrations only (no Studio edits); every new table gets RLS in the same migration.
- Feature branches + PR to `main`; never push directly to `main`.

See `CLAUDE.md` for the full rules every contributor (human or agent) must follow.
