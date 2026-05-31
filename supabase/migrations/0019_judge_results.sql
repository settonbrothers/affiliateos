-- 0019_judge_results.sql
-- A Haiku reviewer runs after each user-facing orchestrator call (Underwriting
-- in M3) and flags the output for compliance / hallucination / off-topic issues.
-- One judge_results row per ai_run. Degrade-open: judge failures themselves
-- don't block the user — see _shared/llmJudge.ts.

create type judge_finding as enum (
  'pass',                  -- looks clean
  'income_promise',        -- "you will make $X", "guaranteed earnings"
  'price_leak',            -- inappropriate currency exposure
  'ai_disclosure',         -- "as an AI", model self-reference
  'invented_fact',         -- claim not grounded in the inputs
  'off_topic',             -- wandered from the brief
  'compliance_violation',  -- medical / financial / regulated claim
  'low_confidence'         -- self-reported confidence_score < 40
);

create table judge_results (
  id uuid primary key default gen_random_uuid(),
  ai_run_id uuid not null references ai_runs(id) on delete cascade,
  findings judge_finding[] not null default '{}',
  reasoning text,
  judge_model text not null default 'claude-haiku-4-5-20251001',
  judge_cost_usd numeric(10, 6),
  created_at timestamptz not null default now()
);
create index judge_results_ai_run_idx on judge_results(ai_run_id);

alter table judge_results enable row level security;
create policy "admin read judge_results" on judge_results for select
  using (is_current_user_admin());
-- Inserts via service role only (edge fns), no write policy needed for users.
