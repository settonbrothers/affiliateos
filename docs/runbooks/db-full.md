# Runbook: Database is full / slow

**Symptoms:** `/api/health` returns 503; writes failing; Supabase Dashboard
shows disk or connection-pool near limit; slow queries.

## Triage
1. Supabase Dashboard → Database → Disk usage & connection count.
2. `/api/health` distinguishes app-up/DB-down (503 with `db:false`).
3. Check for a runaway writer: the biggest churn tables are `ai_runs`,
   `error_logs`, `failed_messages`, `credit_ledger`, `source_documents`
   (raw_text). `source_documents.raw_text` is the heaviest column.

## Immediate relief
- **Connections exhausted:** ensure server code uses the shared Supabase clients
  (`src/lib/supabase/{server,admin}.ts`) — no ad-hoc `createClient` (a Hard Rule).
  Restart/redeploy to drop leaked connections.
- **Disk:** prune old rows safely (none are user-facing history except
  `credit_ledger` — never delete that):
  - `error_logs` older than 30 days.
  - `failed_messages` with `status = 'succeeded'`.
  - `source_documents.raw_text` for old `extracted` docs (keep the row + facts,
    null out `raw_text`).
- Upgrade the Supabase plan/disk if structural.

## Prevent
- `ingest-source` already truncates HTML (500KB) and raw_text (200KB).
- Add a scheduled cleanup (pg_cron) for `error_logs` / succeeded
  `failed_messages` if growth is steady.
- Daily backups are on (Supabase Pro) — verify before any bulk delete.

## Never
- Don't delete from `credit_ledger`, `invite_redemptions`, `subscriptions`, or
  `audit_logs` — they're financial/audit records.
