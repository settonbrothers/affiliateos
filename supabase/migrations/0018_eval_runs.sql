-- 0018_eval_runs.sql
-- One row per `pnpm eval:run` invocation. `details` jsonb carries per-offer
-- breakdown (expected vs actual verdict, scores, tokens, cost) so the UI can
-- render a drill-down without joining anywhere.

create type eval_run_trigger as enum ('manual', 'cron', 'pre_publish');

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references prompts(id),
  trigger_type eval_run_trigger not null,
  total_offers int not null,
  matched_verdict_count int not null,
  matched_score_range_count int not null,
  matched_risk_flags_count int not null,
  accuracy_pct numeric(5, 2) not null,  -- verdict-match accuracy 0-100
  details jsonb,                         -- per-offer breakdown
  total_cost_usd numeric(10, 4),
  triggered_by uuid references profiles(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index eval_runs_prompt_idx on eval_runs(prompt_id, started_at desc);
create index eval_runs_started_idx on eval_runs(started_at desc);

alter table eval_runs enable row level security;
create policy "admin manage eval_runs" on eval_runs for all
  using (is_current_user_admin());
