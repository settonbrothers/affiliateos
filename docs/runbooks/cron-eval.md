# Setup: nightly eval cron

The `eval-cron` edge function replays the **active** Underwriting prompt against
the golden set for a vertical, writes an `eval_runs` row (visible at
`/admin/eval`), and emails `ADMIN_ALERT_EMAIL` if accuracy drops below 70%. It
uses the Supabase `ANTHROPIC_API_KEY` secret, so it runs without a local key.

## Run it manually
- From the repo: `node scripts/run-eval-cron.mjs ai_saas` (uses a throwaway
  admin to authenticate; prints accuracy + per-offer results).
- Or POST to `/functions/v1/eval-cron` with an admin JWT or the cron secret
  header (below). Body: `{ "vertical": "ai_saas", "trigger": "cron" }`.

## Schedule it nightly (Supabase pg_cron + pg_net)

1. Enable the **pg_cron** and **pg_net** extensions (Dashboard → Database →
   Extensions).
2. Set a shared secret: add `CRON_SECRET` as a Supabase **Function secret**
   (`pnpm dlx supabase@latest secrets set CRON_SECRET=<random>`). The function
   accepts `x-cron-secret: <CRON_SECRET>` in lieu of an admin JWT.
3. Schedule per vertical (03:00, 03:10, 03:20 UTC) — run in the SQL editor:

```sql
select cron.schedule(
  'eval-ai_saas-nightly', '0 3 * * *',
  $$
  select net.http_post(
    url     := 'https://<project-ref>.supabase.co/functions/v1/eval-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '<CRON_SECRET>'
    ),
    body    := jsonb_build_object('vertical','ai_saas','trigger','cron')
  );
  $$
);
-- repeat for 'health' (3 10 * * *) and 'mental_wellness' (20 3 * * *)
```

> Note: a 12-offer run is ~12 Sonnet calls (~$0.5) and ~30–60s. Keep the per-day
> golden set sized for your AI budget (the daily-USD cap does **not** apply here
> — eval-cron is not workspace-scoped).

## Interpreting results
- `accuracy_pct` = verdicts matching the golden label. It measures **agreement
  with your labels**, so it's only as meaningful as the labels — review/adjust
  them in `/admin/eval/golden`.
- A sudden drop after a prompt change is a **regression signal** → roll back via
  `/admin/prompts` (see prompt-rollback runbook).
- If many offers cap to `watch`/`small_paid_test`, the prompt's data-confidence /
  unknown-paid hard rules are firing — enrich the golden `facts_snapshot` or
  align the labels to the conservative behavior.
