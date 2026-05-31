# 003 — Deno-side Zod schemas are duplicated from the Node-side contracts

## Status

Accepted, 2026-05-31. Re-evaluate at M5 (or earlier if a 3rd consumer appears).

## Context

Decision-002 deferred how to share `src/types/agents/{envelope,underwriting}.ts`
with the Deno edge functions. At M3 the edge functions must validate Anthropic
tool_use output against these schemas, so the deferral expires.

Two real options:
- **A. Cross-tree import via Deno import map** — `supabase/functions/deno.json`
  aliases `zod` (and a `@contracts/` path) to `npm:zod@^3.24.0` and to
  `../../src/types/agents/`. Single source of truth, but Deno requires `.ts`
  extensions on relative imports; Node tolerates them but the current files
  use extensionless imports (`./envelope`). Retrofitting `.ts` extensions
  across the whole `src/` tree is annoying and noisy.
- **B. Duplicate** the schemas under `supabase/functions/_shared/types/`,
  importing `zod` via `npm:zod@^3.24.0`. Two parallel definitions; risk of
  drift if either side changes without the other. Cheap and self-contained.

## Decision

**Take B (duplicate).** Each runtime owns a self-contained schema file. The
shapes must stay in sync — when the Node-side schema changes, mirror it in the
Deno copy in the same commit. There is exactly one second consumer right now;
the maintenance cost is small.

## Consequences

- The Deno schema lives at `supabase/functions/_shared/types/{envelope,underwriting}.ts`
  and imports `zod` via `npm:`.
- The Anthropic tool's `input_schema` is generated from the Deno copy via
  `zod-to-json-schema`.
- If we ever ship a `packages/contracts/` workspace package (M5+, when there's
  a 3rd consumer — eval harness, prompt UI, etc.), this duplication goes away.

## How to apply

Treat changes to `src/types/agents/{envelope,underwriting}.ts` and
`supabase/functions/_shared/types/{envelope,underwriting}.ts` as a paired edit.
PR description should note both files were updated.
