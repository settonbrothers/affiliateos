-- 0031_content_translations.sql
-- Cache of Hebrew (or other-locale) translations of AI-output free-text fields.
-- The canonical English payload stays in ai_runs / discovery_candidates; this
-- table holds the translated free-text fields (same paths) per (row, locale),
-- computed once on first view. Keeps the eval/judge/golden set on English.

create table content_translations (
  source_table text not null,   -- 'ai_runs' | 'discovery_candidates'
  source_id uuid not null,
  locale text not null,         -- e.g. 'he'
  payload jsonb not null,       -- translated free-text fields, keyed by path
  created_at timestamptz not null default now(),
  primary key (source_table, source_id, locale)
);

alter table content_translations enable row level security;

-- Read mirrors the source tables, which are admin-readable today (ai_runs via
-- admin tooling, discovery_candidates admin-only). Widen alongside offer
-- visibility when user-facing AI surfaces need translated content. Writes are
-- service-role only (edge functions); no client write policy.
create policy "admin read content_translations" on content_translations
  for select using (is_current_user_admin());
