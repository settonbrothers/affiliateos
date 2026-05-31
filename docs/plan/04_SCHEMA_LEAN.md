# Lean Schema (~28 tables)

> מחליף את 120+ הטבלאות ב־spec המקורי. JSONB עמודות מרכזיות במקום פיצול מוקדם. כל טבלה כאן עוברת לפי milestone — אל תוסיף migration שמקדים את ה־milestone שלה.

---

## עקרונות

1. **JSONB > normalization מוקדם**. עמודה אחת `evaluation jsonb` במקום 9 טבלאות. פצל רק כשיש שאילתה שדורשת index.
2. **RLS מהיום 1, על כל טבלה**. ברירת מחדל: `USING (false)` ואז מתירים בפרטים.
3. **`updated_at` עם trigger אוטומטי** על כל טבלה (פרט ל־log tables).
4. **enum types ב־DB**, לא בקוד. שינוי enum = migration.
5. **שם enum = `<entity>_<field>`**, e.g. `offer_status`, `ai_run_status`.
6. **uuids בכל מקום**, לא serial. `gen_random_uuid()` כ־default.
7. **soft delete רק אם צריך**. ב־MVP אין `deleted_at` בכלל. אם צריך — מוסיפים בשלב 2.
8. **אין JSON freeform למידע קריטי**. מה שעובר ב־JSONB חייב Zod schema בקוד.

---

## Migration order (לפי milestone)

> **Numbering note (2026-05-31):** During M1 we inserted an extra migration
> `0009_handle_new_user.sql` — a SECURITY DEFINER trigger on `auth.users` that
> auto-creates the matching `profiles` row on signup (without it, the demo FK-errors
> on the first signup). The original plan didn't include it, so **all migrations
> from M2 onward shift +1 from the numbers in this document**. The actual on-disk
> numbering in `supabase/migrations/` is the source of truth (M2 = 0010-0015, etc.).
> The SQL bodies below are still the spec for each migration.

### M1 — Foundation (8 + 1 migrations)

#### 0001_init_roles.sql
```sql
create type system_role as enum ('user', 'admin');
create type workspace_role as enum ('owner', 'member');
```

#### 0002_profiles.sql
```sql
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  system_role system_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table profiles enable row level security;

-- SECURITY DEFINER admin check that reads profiles WITHOUT being subject to RLS.
-- A SELECT policy on profiles that queries profiles would otherwise trigger
-- Postgres "infinite recursion detected in policy". Same pattern as
-- is_workspace_member() in 0003. See decisions/001.
create function is_current_user_admin() returns boolean
  language sql security definer stable
  set search_path = public
  as $$
  select exists (
    select 1 from profiles where id = auth.uid() and system_role = 'admin'
  );
$$;

create policy "users read own profile" on profiles for select
  using (auth.uid() = id);
create policy "users update own profile" on profiles for update
  using (auth.uid() = id);
create policy "admins read all" on profiles for select
  using (is_current_user_admin());
```

#### 0003_workspaces.sql
```sql
create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table workspace_members (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  user_id uuid not null references profiles(id) on delete cascade,
  role workspace_role not null default 'owner',
  created_at timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
alter table workspaces enable row level security;
alter table workspace_members enable row level security;
-- helper function
create function is_workspace_member(ws_id uuid) returns boolean
  language sql security definer stable as $$
  select exists (select 1 from workspace_members where workspace_id = ws_id and user_id = auth.uid());
$$;
create policy "members read workspace" on workspaces for select
  using (is_workspace_member(id));
create policy "members read their membership" on workspace_members for select
  using (user_id = auth.uid() or is_workspace_member(workspace_id));
```

#### 0004_verticals.sql
```sql
create table verticals (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  enabled_for_users boolean not null default false,
  display_order int not null default 0,
  created_at timestamptz not null default now()
);
insert into verticals (slug, name, enabled_for_users, display_order) values
  ('ai_saas', 'AI & SaaS', true, 1),
  ('health', 'Health & Wellness', false, 2),
  ('mental_wellness', 'Mental & Wellness', false, 3);
alter table verticals enable row level security;
create policy "anyone read enabled verticals" on verticals for select
  using (enabled_for_users = true or exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
```

#### 0005_offers.sql
```sql
create type offer_visibility as enum ('global', 'workspace_private', 'admin_only');
create type offer_status as enum (
  'draft',
  'needs_source_ingestion',
  'ready_for_analysis',
  'ai_analyzed',
  'published',
  'rejected',
  'deprecated'
);

create table offers (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),  -- null for global offers
  created_by_user_id uuid not null references profiles(id),
  visibility offer_visibility not null default 'admin_only',
  status offer_status not null default 'draft',
  vertical_id uuid not null references verticals(id),
  name text not null,
  slug text not null,
  website_url text,
  affiliate_program_url text,
  network text,
  vendor_name text,
  logo_url text,
  short_description text,
  primary_language text default 'en',
  evaluation jsonb,  -- holds the full snapshot: scores, facts, assumptions, risks, warnings
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (slug, vertical_id)
);
create index offers_status_idx on offers(status);
create index offers_vertical_idx on offers(vertical_id);
create index offers_workspace_idx on offers(workspace_id) where workspace_id is not null;

alter table offers enable row level security;
create policy "global offers visible to authenticated" on offers for select
  using (
    visibility = 'global'
    or (visibility = 'workspace_private' and is_workspace_member(workspace_id))
    or (visibility = 'admin_only' and exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'))
  );
create policy "admin write offers" on offers for all
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
```

#### 0006_ai_runs.sql
```sql
create type ai_run_status as enum ('pending', 'running', 'success', 'partial', 'failed');

create table ai_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid references workspaces(id),
  user_id uuid references profiles(id),
  offer_id uuid references offers(id),
  related_entity_type text,
  related_entity_id uuid,
  orchestrator_name text not null,  -- 'UnderwritingOrchestrator' etc
  agent_version text not null,
  prompt_version_id uuid,  -- nullable, points to prompt_versions in M3+
  provider text not null default 'anthropic',
  model text not null,
  input_payload jsonb not null,
  output_payload jsonb,
  validated_output jsonb,
  envelope jsonb,  -- universal envelope: facts/assumptions/estimates/risks/unknowns/missing_data/confidence
  status ai_run_status not null default 'pending',
  error_message text,
  tokens_input int,
  tokens_output int,
  estimated_cost numeric(10, 6),
  credits_charged int default 0,
  langfuse_trace_id text,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index ai_runs_offer_idx on ai_runs(offer_id);
create index ai_runs_user_idx on ai_runs(user_id);
create index ai_runs_status_idx on ai_runs(status);
create index ai_runs_orchestrator_idx on ai_runs(orchestrator_name);

alter table ai_runs enable row level security;
create policy "admin read all ai_runs" on ai_runs for select
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
create policy "users read their own ai_runs" on ai_runs for select
  using (user_id = auth.uid());

-- Realtime publication
alter publication supabase_realtime add table ai_runs;
```

#### 0007_error_logs_dlq.sql
```sql
create type error_severity as enum ('debug', 'info', 'warning', 'error', 'critical');

create table error_logs (
  id uuid primary key default gen_random_uuid(),
  severity error_severity not null,
  source text not null,  -- 'edge:analyze-offer' etc
  message text not null,
  context jsonb,
  user_id uuid references profiles(id),
  workspace_id uuid references workspaces(id),
  created_at timestamptz not null default now()
);
create index error_logs_created_idx on error_logs(created_at desc);
create index error_logs_severity_idx on error_logs(severity) where severity in ('error', 'critical');

create type failed_message_type as enum ('ai_run', 'webhook_send', 'email_send', 'stripe_webhook');
create type failed_message_status as enum ('pending', 'retrying', 'succeeded', 'abandoned');

create table failed_messages (
  id uuid primary key default gen_random_uuid(),
  message_type failed_message_type not null,
  payload jsonb not null,
  attempts int not null default 0,
  max_attempts int not null default 3,
  last_error text,
  status failed_message_status not null default 'pending',
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index failed_messages_status_idx on failed_messages(status, next_retry_at);

alter table error_logs enable row level security;
alter table failed_messages enable row level security;
create policy "admin read error_logs" on error_logs for select
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
create policy "admin read failed_messages" on failed_messages for select
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
create policy "admin write failed_messages" on failed_messages for all
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
```

#### 0008_audit_logs.sql
```sql
create type audit_action as enum (
  'offer.create', 'offer.update', 'offer.delete', 'offer.publish',
  'ai_run.start', 'ai_run.complete',
  'prompt.activate', 'prompt.rollback',
  'kill_switch.toggle',
  'credit.grant', 'credit.deduct', 'credit.refund',
  'user.invite', 'user.delete',
  'fact.approve', 'fact.reject',
  'subscription.create', 'subscription.cancel'
);

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_user_id uuid references profiles(id),
  action audit_action not null,
  entity_type text not null,
  entity_id uuid,
  before jsonb,
  after jsonb,
  reason text,
  created_at timestamptz not null default now()
);
create index audit_logs_actor_idx on audit_logs(actor_user_id, created_at desc);
create index audit_logs_entity_idx on audit_logs(entity_type, entity_id);

alter table audit_logs enable row level security;
create policy "admin read audit_logs" on audit_logs for select
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
```

### M2 — Source Ingestion + Kill Switches (6 migrations)

#### 0009_source_documents.sql
```sql
create type source_doc_status as enum ('pending', 'fetched', 'extracted', 'failed');
create type source_doc_type as enum (
  'product_page', 'pricing_page', 'affiliate_terms', 'checkout_page',
  'review_page', 'ad_example', 'landing_page', 'manual_note', 'unknown'
);

create table source_documents (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  url text,  -- nullable: ל־manual_note
  doc_type source_doc_type not null default 'unknown',
  status source_doc_status not null default 'pending',
  raw_html_storage_path text,  -- ב־bucket source-documents
  raw_text text,  -- extracted text (no html)
  language text,
  source_summary text,
  source_reliability_score int,
  error_message text,
  fetched_at timestamptz,
  extracted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index source_documents_offer_idx on source_documents(offer_id);
create index source_documents_status_idx on source_documents(status);

alter table source_documents enable row level security;
create policy "admin manage source_documents" on source_documents for all
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
```

#### 0010_extracted_facts.sql
```sql
create type fact_type as enum (
  'commission_value', 'commission_type', 'payout_delay', 'cookie_duration',
  'traffic_rule_paid_social', 'traffic_rule_google', 'traffic_rule_native',
  'traffic_rule_youtube', 'traffic_rule_brand_bidding', 'traffic_rule_direct_link',
  'traffic_rule_email', 'traffic_rule_seo', 'traffic_rule_organic_social',
  'allowed_geo', 'restricted_geo', 'cap', 'refund_policy',
  'compliance_claim', 'pricing_aov', 'minimum_payout', 'contact', 'other'
);
create type fact_status as enum ('proposed', 'verified', 'rejected');

create table extracted_facts (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  source_document_id uuid references source_documents(id),
  fact_type fact_type not null,
  fact_value text not null,
  source_quote text,
  confidence_score int,  -- 0-100
  status fact_status not null default 'proposed',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
create index extracted_facts_offer_idx on extracted_facts(offer_id);
create index extracted_facts_status_idx on extracted_facts(status);

alter table extracted_facts enable row level security;
create policy "admin manage extracted_facts" on extracted_facts for all
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
```

#### 0011_source_fetch_jobs.sql
```sql
create type fetch_job_status as enum ('queued', 'fetching', 'extracting', 'completed', 'failed');

create table source_fetch_jobs (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  url text not null,
  status fetch_job_status not null default 'queued',
  triggered_by uuid not null references profiles(id),
  source_document_id uuid references source_documents(id),  -- populated when completed
  error_message text,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create index source_fetch_jobs_status_idx on source_fetch_jobs(status, created_at);

alter table source_fetch_jobs enable row level security;
create policy "admin manage source_fetch_jobs" on source_fetch_jobs for all
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
```

#### 0012_evaluation_snapshots.sql
```sql
-- already have offers.evaluation jsonb from 0005, but we want history
create table offer_evaluation_snapshots (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  ai_run_id uuid not null references ai_runs(id),
  snapshot jsonb not null,  -- full evaluation: scores + verdict + warnings + assumptions + envelope
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create index offer_evaluation_snapshots_offer_idx on offer_evaluation_snapshots(offer_id, created_at desc);
create unique index offer_evaluation_snapshots_current_unique on offer_evaluation_snapshots(offer_id) where is_current = true;

alter table offer_evaluation_snapshots enable row level security;
create policy "read offer_evaluation_snapshots if offer readable" on offer_evaluation_snapshots for select
  using (exists (
    select 1 from offers o where o.id = offer_id and (
      o.visibility = 'global'
      or (o.visibility = 'workspace_private' and is_workspace_member(o.workspace_id))
      or (o.visibility = 'admin_only' and exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'))
    )
  ));
```

#### 0013_agent_kill_switches.sql
```sql
create table agent_kill_switches (
  orchestrator_name text primary key,
  is_paused boolean not null default false,
  paused_by uuid references profiles(id),
  paused_at timestamptz,
  reason text,
  updated_at timestamptz not null default now()
);
insert into agent_kill_switches (orchestrator_name) values
  ('UnderwritingOrchestrator'),
  ('SourceExtractionOrchestrator'),
  ('TestKitOrchestrator'),
  ('DiagnosisOrchestrator'),
  ('ComplianceCheckOrchestrator');

alter table agent_kill_switches enable row level security;
create policy "admin read kill_switches" on agent_kill_switches for select
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
create policy "admin update kill_switches" on agent_kill_switches for update
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
-- inserts only via migration
```

#### 0014_credit_caps.sql
```sql
create table workspace_credit_caps (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  daily_usd_cap numeric(10, 2) not null default 10.00,
  monthly_usd_cap numeric(10, 2) not null default 100.00,
  daily_credits_cap int not null default 50,
  monthly_credits_cap int not null default 500,
  updated_at timestamptz not null default now()
);

create table workspace_daily_usage (
  workspace_id uuid not null references workspaces(id) on delete cascade,
  day date not null,
  usd_spent numeric(10, 4) not null default 0,
  credits_spent int not null default 0,
  primary key (workspace_id, day)
);

alter table workspace_credit_caps enable row level security;
alter table workspace_daily_usage enable row level security;
create policy "members read own caps" on workspace_credit_caps for select using (is_workspace_member(workspace_id));
create policy "admin manage caps" on workspace_credit_caps for all
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
create policy "members read own usage" on workspace_daily_usage for select using (is_workspace_member(workspace_id));
```

### M3 — Prompts + Eval (5 migrations)

#### 0015_prompts.sql
```sql
create type prompt_type as enum ('main', 'judge', 'extractor', 'compliance');

create table prompts (
  id uuid primary key default gen_random_uuid(),
  orchestrator_name text not null,
  prompt_type prompt_type not null default 'main',
  version text not null,  -- 'v1', 'v2', etc
  vertical_id uuid references verticals(id),  -- nullable = global
  content text not null,
  is_active boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  unique (orchestrator_name, prompt_type, version, vertical_id)
);
create index prompts_active_idx on prompts(orchestrator_name, prompt_type, vertical_id, is_active);

alter table prompts enable row level security;
create policy "admin read prompts" on prompts for select
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
create policy "admin write prompts" on prompts for all
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
```

#### 0016_golden_set_offers.sql
```sql
create table golden_set_offers (
  id uuid primary key default gen_random_uuid(),
  vertical_id uuid not null references verticals(id),
  offer_name text not null,
  offer_url text,
  expected_verdict text not null,  -- one of the verdict enum values
  expected_score_range int4range,  -- e.g. '[60,75]'
  expected_high_ceiling_signal text,
  expected_risk_flags text[],
  notes text,  -- why this is the expected verdict (for human review later)
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table golden_set_offers enable row level security;
create policy "admin manage golden_set_offers" on golden_set_offers for all
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
```

#### 0017_eval_runs.sql
```sql
create type eval_run_trigger as enum ('manual', 'cron', 'pre_publish');

create table eval_runs (
  id uuid primary key default gen_random_uuid(),
  prompt_id uuid not null references prompts(id),
  trigger_type eval_run_trigger not null,
  total_offers int not null,
  matched_verdict_count int not null,
  matched_score_range_count int not null,
  matched_risk_flags_count int not null,
  accuracy_pct numeric(5, 2) not null,  -- 0-100
  details jsonb,  -- per-offer breakdown
  total_cost_usd numeric(10, 4),
  triggered_by uuid references profiles(id),
  started_at timestamptz not null default now(),
  completed_at timestamptz
);
create index eval_runs_prompt_idx on eval_runs(prompt_id, started_at desc);

alter table eval_runs enable row level security;
create policy "admin manage eval_runs" on eval_runs for all
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
```

#### 0018_judge_results.sql
```sql
create type judge_finding as enum (
  'pass', 'income_promise', 'price_leak', 'ai_disclosure',
  'invented_fact', 'off_topic', 'compliance_violation', 'low_confidence'
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
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
```

#### 0019_invite_codes.sql
```sql
create type invite_status as enum ('issued', 'redeemed', 'revoked', 'expired');

create table invite_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,  -- 12-char URL-safe
  issued_to_email text,
  issued_by uuid not null references profiles(id),
  redeemed_by uuid references profiles(id),
  redeemed_at timestamptz,
  status invite_status not null default 'issued',
  expires_at timestamptz,
  notes text,
  created_at timestamptz not null default now()
);

alter table invite_codes enable row level security;
create policy "admin manage invite_codes" on invite_codes for all
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
-- Note: redemption happens via Edge Function with service role, not user RLS
```

### M4 — Test Kits + Diagnosis + Compliance (4 migrations)

#### 0020_test_kits.sql
```sql
create table test_kits (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  created_by uuid not null references profiles(id),
  ai_run_id uuid not null references ai_runs(id),
  content jsonb not null,  -- structured per TestKitAgent output
  envelope jsonb not null,
  created_at timestamptz not null default now()
);
create index test_kits_offer_idx on test_kits(offer_id, created_at desc);

alter table test_kits enable row level security;
create policy "read test_kits if offer readable" on test_kits for select
  using (exists (
    select 1 from offers o where o.id = offer_id and (
      o.visibility = 'global'
      or (o.visibility = 'workspace_private' and is_workspace_member(o.workspace_id))
      or (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'))
    )
  ));
create policy "users create test_kits for their workspace" on test_kits for insert
  with check (created_by = auth.uid());
```

#### 0021_campaigns.sql
```sql
create type campaign_status as enum ('draft', 'running', 'paused', 'completed', 'killed');
create type traffic_channel as enum ('paid_social', 'google_ads', 'native', 'youtube', 'email', 'seo', 'organic_social', 'other');

create table campaigns (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id),
  offer_id uuid not null references offers(id),
  test_kit_id uuid references test_kits(id),
  created_by uuid not null references profiles(id),
  name text not null,
  channel traffic_channel not null,
  geo text,
  status campaign_status not null default 'draft',
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index campaigns_workspace_idx on campaigns(workspace_id, created_at desc);

alter table campaigns enable row level security;
create policy "members manage campaigns" on campaigns for all
  using (is_workspace_member(workspace_id));
```

#### 0022_campaign_results.sql
```sql
create type result_source as enum ('manual_entry', 'csv_import', 'api_import');

create table campaign_results (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  recorded_at timestamptz not null,
  spend_usd numeric(10, 2) not null default 0,
  impressions int default 0,
  clicks int default 0,
  landing_views int default 0,
  conversions int default 0,
  revenue_usd numeric(10, 2) default 0,
  -- derived metrics computed by view, not stored
  data_quality_score int,  -- 0-100, computed at insert time
  source result_source not null default 'manual_entry',
  notes text,
  raw_payload jsonb,
  created_by uuid not null references profiles(id),
  created_at timestamptz not null default now()
);
create index campaign_results_campaign_idx on campaign_results(campaign_id, recorded_at desc);

alter table campaign_results enable row level security;
create policy "members read campaign_results in workspace" on campaign_results for select
  using (exists (select 1 from campaigns c where c.id = campaign_id and is_workspace_member(c.workspace_id)));
create policy "members insert campaign_results" on campaign_results for insert
  with check (exists (select 1 from campaigns c where c.id = campaign_id and is_workspace_member(c.workspace_id)));
```

#### 0023_result_diagnoses.sql
```sql
create table result_diagnoses (
  id uuid primary key default gen_random_uuid(),
  campaign_result_id uuid not null references campaign_results(id) on delete cascade,
  ai_run_id uuid not null references ai_runs(id),
  diagnosis jsonb not null,  -- structured per ResultDiagnosisAgent output
  envelope jsonb not null,
  created_at timestamptz not null default now()
);
create index result_diagnoses_result_idx on result_diagnoses(campaign_result_id);

alter table result_diagnoses enable row level security;
create policy "read diagnosis if result readable" on result_diagnoses for select
  using (exists (
    select 1 from campaign_results cr
      join campaigns c on c.id = cr.campaign_id
    where cr.id = campaign_result_id and is_workspace_member(c.workspace_id)
  ));
```

### M5 — Billing + Credits (5 migrations)

#### 0024_plans.sql
```sql
create table plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,  -- 'pro'
  name text not null,
  monthly_price_usd numeric(10, 2) not null,
  monthly_included_credits int not null,
  stripe_price_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into plans (code, name, monthly_price_usd, monthly_included_credits) values
  ('pro', 'Pro', 50.00, 50);

alter table plans enable row level security;
create policy "anyone read active plans" on plans for select using (is_active = true);
```

#### 0025_subscriptions.sql
```sql
create type subscription_status as enum ('trialing', 'active', 'past_due', 'canceled', 'unpaid', 'incomplete');

create table stripe_customers (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);

create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  plan_id uuid not null references plans(id),
  stripe_subscription_id text not null unique,
  status subscription_status not null,
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index subscriptions_workspace_idx on subscriptions(workspace_id);

alter table stripe_customers enable row level security;
alter table subscriptions enable row level security;
create policy "members read own subscription" on subscriptions for select using (is_workspace_member(workspace_id));
create policy "members read own stripe_customer" on stripe_customers for select using (is_workspace_member(workspace_id));
```

#### 0026_credit_ledger.sql
```sql
create type credit_tx_type as enum (
  'monthly_grant',   -- from subscription cycle
  'welcome_grant',   -- one-time signup bonus
  'admin_grant',
  'purchase',        -- bought extra credits
  'usage',           -- spent on action
  'refund',          -- failed action refunded
  'expiration',
  'adjustment'
);

create table credit_ledger (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  tx_type credit_tx_type not null,
  amount int not null,  -- positive for grants, negative for usage
  balance_after int not null,
  related_ai_run_id uuid references ai_runs(id),
  related_subscription_id uuid references subscriptions(id),
  expires_at timestamptz,
  notes text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);
create index credit_ledger_workspace_idx on credit_ledger(workspace_id, created_at desc);
create index credit_ledger_ai_run_idx on credit_ledger(related_ai_run_id) where related_ai_run_id is not null;

alter table credit_ledger enable row level security;
create policy "members read own ledger" on credit_ledger for select using (is_workspace_member(workspace_id));
-- inserts only via service role from edge functions
```

#### 0027_usage_pricing_rules.sql
```sql
create table usage_pricing_rules (
  action_code text primary key,  -- 'analyze_offer', 'generate_test_kit', etc
  display_name text not null,
  credits_cost int not null,
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into usage_pricing_rules (action_code, display_name, credits_cost) values
  ('analyze_offer', 'Analyze Offer', 5),
  ('generate_test_kit', 'Generate Test Kit', 10),
  ('analyze_results', 'Analyze Campaign Results', 5),
  ('reanalyze_offer', 'Re-analyze Offer', 3),
  ('extract_source', 'Extract Offer Source', 2);

alter table usage_pricing_rules enable row level security;
create policy "anyone read active pricing" on usage_pricing_rules for select using (is_active = true);
```

#### 0028_invoices.sql
```sql
create table invoices (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  stripe_invoice_id text not null unique,
  amount_usd numeric(10, 2) not null,
  status text not null,  -- 'paid', 'open', 'void', 'uncollectible'
  paid_at timestamptz,
  hosted_invoice_url text,
  pdf_url text,
  created_at timestamptz not null default now()
);

alter table invoices enable row level security;
create policy "members read own invoices" on invoices for select using (is_workspace_member(workspace_id));
```

### M4 (added) — Compliance Rules

#### 0029_compliance_rules.sql
```sql
create type compliance_rule_severity as enum ('info', 'warning', 'block');

create table compliance_rules (
  id uuid primary key default gen_random_uuid(),
  vertical_id uuid references verticals(id),  -- nullable = global
  channel traffic_channel,  -- nullable = all channels
  rule_code text not null,  -- 'no_disease_claim', 'no_weight_loss_promise' etc
  description text not null,
  severity compliance_rule_severity not null default 'warning',
  triggers_text_patterns text[],
  triggers_claim_types text[],
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index compliance_rules_vertical_idx on compliance_rules(vertical_id, is_active);

alter table compliance_rules enable row level security;
create policy "anyone read active rules" on compliance_rules for select using (is_active = true);
create policy "admin manage rules" on compliance_rules for all
  using (exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'));
```

---

## סה"כ ב־MVP: 29 migrations, ~28 טבלאות

| Milestone | Migrations | טבלאות חדשות |
|---|---|---|
| M1 | 8 | profiles, workspaces, workspace_members, verticals, offers, ai_runs, error_logs, failed_messages, audit_logs |
| M2 | 6 | source_documents, extracted_facts, source_fetch_jobs, offer_evaluation_snapshots, agent_kill_switches, workspace_credit_caps, workspace_daily_usage |
| M3 | 5 | prompts, golden_set_offers, eval_runs, judge_results, invite_codes |
| M4 | 5 | test_kits, campaigns, campaign_results, result_diagnoses, compliance_rules |
| M5 | 5 | plans, stripe_customers, subscriptions, credit_ledger, usage_pricing_rules, invoices |
| M6 | (hardening — אין migrations חדשות אם הכל הולך טוב) | — |

לעומת ה־spec המקורי (120+ טבלאות): חתכנו ~75%.

---

## כללי זהב לסכמה

### עשה
- כל migration עם `.up.sql` בלבד, אין `down`. אם טעות — migration חדש שמתקן
- כל טבלה עם RLS מהיום הראשון
- כל פעולה רגישה (mutations) רק דרך admin policy או service role
- כל ai_run נכתב ל־`ai_runs`, גם אם כשל
- כל שינוי על user-facing data → `audit_logs`

### אל
- אל תפצל JSONB ל־5 טבלאות בלי שיש שאילתה שדורשת
- אל תוסיף foreign key cascading delete על שיחים שצריך לשמר היסטוריה (audit, ai_runs)
- אל תוסיף triggers מורכבים. השאר ב־application layer
- אל תוסיף views עם SECURITY DEFINER (נאסר ב־richer-ai-agents-hub migration 0011, אותו לקח כאן)
- אל תכתוב migration בלי לבדוק שה־RLS על הטבלה החדשה נכון
