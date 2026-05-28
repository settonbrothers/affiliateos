# 002 — Agent contract Zod schemas live in src/types/agents (M1)

## Status

Accepted, 2026-05-28 (provisional — revisit at M3).

## Context

05_AGENT_ROSTER.md says the Universal Envelope + per-orchestrator Zod schemas are
the single source of truth, imported by "server action, edge function, eval
harness". But the consumers span two runtimes: the Next app (Node, `import 'zod'`)
and Supabase Edge Functions (Deno, `npm:zod`). There is no `packages/` workspace yet.

## Decision

For M1 the contracts live in `src/types/agents/` and import `zod` with a bare
specifier. The **Next app** (UI scorecard, future server-side validation) imports
them directly. The **mock edge function** does NOT import them in M1 — it returns
fixtures from `_shared/mockAi.ts`, so no cross-runtime import is needed yet.

When real AI lands (M3) and the edge functions must validate against these schemas,
either (a) add a Deno import map aliasing `zod` and import the same files across the
tree, or (b) extract them to a `packages/contracts/` workspace package. Decide then.

## Consequences

- One source of truth for the UI side now; zero duplication for M1.
- The mock edge function is intentionally schema-free (it cannot drift because it
  only emits fixtures); real validation is a deliberate M3 step.
- A follow-up decision is required before M3 to share these with Deno.
