-- 0024_compliance.sql
-- M4: per-vertical compliance rules (reference data shown in /admin/compliance
-- and available to the ComplianceCheckOrchestrator) and the warnings produced
-- for a specific offer.

create table compliance_rules (
  id uuid primary key default gen_random_uuid(),
  vertical_id uuid references verticals(id),
  channel text,            -- null = applies to all channels
  rule_type text not null, -- forbidden_claim | required_disclaimer | platform_policy | geo
  title text not null,
  detail text not null,
  severity text not null default 'medium', -- low | medium | high | critical
  created_at timestamptz not null default now()
);
create index compliance_rules_vertical_idx on compliance_rules(vertical_id);

create table offer_compliance_warnings (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  ai_run_id uuid references ai_runs(id),
  workspace_id uuid references workspaces(id),
  overall_risk_level text not null,        -- low | medium | high | critical
  compliance_score int,                    -- 0-100
  -- When health/mental + high/critical risk, the verdict the operator should
  -- not exceed until cleared (e.g. 'small_paid_test'). null = no cap.
  suggested_verdict_cap text,
  payload jsonb not null,                  -- full ComplianceResponse
  created_at timestamptz not null default now()
);
create index offer_compliance_warnings_offer_idx on offer_compliance_warnings(offer_id);

alter table compliance_rules enable row level security;
alter table offer_compliance_warnings enable row level security;

create policy "admin manage compliance_rules" on compliance_rules for all
  using (is_current_user_admin());
create policy "authenticated read compliance_rules" on compliance_rules for select
  using (auth.uid() is not null);

create policy "admin manage offer_compliance_warnings" on offer_compliance_warnings for all
  using (is_current_user_admin());
create policy "members read own offer_compliance_warnings" on offer_compliance_warnings for select
  using (workspace_id is not null and is_workspace_member(workspace_id));

-- Seed a starter rule set. The orchestrator prompt carries the operative
-- guidance; these rows make the rules visible/editable in /admin/compliance.
insert into compliance_rules (vertical_id, rule_type, title, detail, severity)
select id, 'forbidden_claim', 'No disease cure/treatment claims',
  'Never claim a product cures, treats, or prevents a disease. FDA/FTC violation; Meta will reject.',
  'critical'
from verticals where slug = 'health';
insert into compliance_rules (vertical_id, rule_type, title, detail, severity)
select id, 'forbidden_claim', 'No before/after or guaranteed results',
  'Avoid before/after imagery and guaranteed weight-loss or outcome claims.', 'high'
from verticals where slug = 'health';
insert into compliance_rules (vertical_id, rule_type, title, detail, severity)
select id, 'required_disclaimer', 'Supplement disclaimer',
  'Supplement claims require a "not evaluated by the FDA" style disclaimer.', 'medium'
from verticals where slug = 'health';
insert into compliance_rules (vertical_id, rule_type, title, detail, severity)
select id, 'platform_policy', 'Meta personal-health policy',
  'Do not imply knowledge of personal health attributes (anxiety, depression, conditions).',
  'high'
from verticals where slug = 'mental_wellness';
insert into compliance_rules (vertical_id, rule_type, title, detail, severity)
select id, 'forbidden_claim', 'No clinical mental-health claims',
  'Avoid claims to treat anxiety, depression, or any clinical condition.', 'critical'
from verticals where slug = 'mental_wellness';
insert into compliance_rules (vertical_id, rule_type, title, detail, severity)
select id, 'forbidden_claim', 'No income promises',
  'Never promise earnings ("make $X"), guaranteed ROI, or easy money.', 'high'
from verticals where slug = 'ai_saas';
