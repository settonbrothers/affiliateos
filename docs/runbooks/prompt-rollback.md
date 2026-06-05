# Runbook: Roll back a bad prompt

**Symptoms:** Verdict/test-kit/diagnosis quality dropped after a prompt change;
eval accuracy fell (`/admin/eval`); users report nonsense output.

## One-click rollback
1. Go to `/admin/prompts`.
2. Open the orchestrator (e.g. UnderwritingOrchestrator). You'll see every
   version; the active one is marked.
3. Click **Activate this version** on the last-known-good version. `activatePrompt`
   deactivates the siblings and activates the target in one transaction — the
   change is live for new runs within seconds (orchestrators load the active
   prompt per call via `loadActivePrompt`).

No deploy needed — prompts are read from the `prompts` table at runtime.

## Confirm it worked
- `/admin/prompts` shows the intended version active.
- Run a quick analyze and eyeball the output, or run `pnpm eval:run --vertical
  <slug>` (needs `ANTHROPIC_API_KEY` locally) and check `/admin/eval` accuracy.

## How prompts get into the DB (so you don't lose history)
- Prompts live as markdown in `prompts/<orchestrator>/<version>.md`.
- `pnpm prompts:sync` upserts them into the `prompts` table; a brand-new
  orchestrator's first version is auto-activated, existing actives are never
  silently flipped.
- **Hard Rule:** never edit a prompt directly in the DB — change the markdown +
  re-sync, so rollback targets always exist in version control.

## If a bad prompt also caused failures
- Failed runs are in `/admin/failed`; replay them after activating the good
  prompt.
