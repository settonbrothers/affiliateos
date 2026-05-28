-- 0004_verticals.sql
-- Vertical catalog. Only ai_saas is enabled for users in MVP; health +
-- mental_wellness ship dark until M4 (compliance prompts).

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
  using (
    enabled_for_users = true
    or exists (
      select 1 from profiles where id = auth.uid() and system_role = 'admin'
    )
  );
