-- 0013_offer_evaluation_snapshots.sql
-- Append-only history of an offer's full evaluation (scores + verdict + warnings
-- + assumptions + envelope). offers.evaluation holds the latest pointer-style
-- jsonb; this table keeps every snapshot ever produced.
-- A partial unique index enforces a single is_current=true row per offer.

create table offer_evaluation_snapshots (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references offers(id) on delete cascade,
  ai_run_id uuid not null references ai_runs(id),
  snapshot jsonb not null,
  is_current boolean not null default true,
  created_at timestamptz not null default now()
);
create index offer_evaluation_snapshots_offer_idx on offer_evaluation_snapshots(offer_id, created_at desc);
create unique index offer_evaluation_snapshots_current_unique
  on offer_evaluation_snapshots(offer_id) where is_current = true;

alter table offer_evaluation_snapshots enable row level security;

-- A snapshot is readable iff the underlying offer is readable to the caller.
create policy "read offer_evaluation_snapshots if offer readable" on offer_evaluation_snapshots for select
  using (exists (
    select 1 from offers o where o.id = offer_id and (
      o.visibility = 'global'
      or (o.visibility = 'workspace_private' and is_workspace_member(o.workspace_id))
      or (o.visibility = 'admin_only' and is_current_user_admin())
    )
  ));
