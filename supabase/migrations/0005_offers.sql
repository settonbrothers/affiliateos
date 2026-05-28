-- 0005_offers.sql
-- Lean offers table. The full evaluation (scores, facts, assumptions, risks,
-- warnings) lives in the `evaluation` jsonb column — split into normalized
-- tables only once a query demands an index.

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
  evaluation jsonb,  -- full snapshot: scores, facts, assumptions, risks, warnings
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
