# Runbook: Anthropic is down / erroring

**Symptoms:** AI runs fail; `ai_runs.status = 'failed'`; rows piling up in
`failed_messages` (DLQ); `/admin/failed` filling with `ai_run` entries; users
report "analysis failed". Credits are auto-refunded on failure, so balances are
not affected.

## What's already automatic
- `_shared/anthropicJson.ts` retries 429/5xx 3× with exponential backoff.
- On final failure the run is recorded failed, **credits are refunded**, and the
  work is dead-lettered (`sendToDlq`). No double-charging.

## Triage
1. Check Anthropic status: https://status.anthropic.com.
2. Confirm it's upstream, not us: `GET /api/health` should still be `ok`.
3. Look at `error_logs` (source `anthropic:callWithTool`) and `/admin/failed`.

## Mitigate
- **Stop the bleeding for users:** pause the affected orchestrator at
  `/admin/kill-switches` (e.g. UnderwritingOrchestrator). New runs then return a
  clean 503 instead of failing slowly. Un-pause when Anthropic recovers.
- If only one model is affected, no per-model toggle exists yet — use the
  orchestrator kill switch.

## Recover
1. Once Anthropic is healthy, un-pause the kill switch.
2. Replay dead-lettered work from `/admin/failed` (Replay re-invokes with the
   stored payload). Replays are admin-gated and idempotent per message.
3. Spot-check a fresh analyze end-to-end.

## Notes
- The local CLI eval (`pnpm eval:run`) needs `ANTHROPIC_API_KEY` set locally;
  the edge functions use the Supabase secret. A "401 invalid x-api-key" locally
  is the empty local key, not an outage.
