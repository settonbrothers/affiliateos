# 001 — SECURITY DEFINER helper for admin RLS checks on `profiles`

## Status

Proposed, 2026-05-28 — **pending Izak sign-off** (deviates from `04_SCHEMA_LEAN.md`).

## Context

`04_SCHEMA_LEAN.md` migration `0002_profiles.sql` defines the admin read policy as:

```sql
create policy "admins read all" on profiles for select
  using (exists (select 1 from profiles p2 where p2.id = auth.uid() and p2.system_role = 'admin'));
```

A SELECT policy **on `profiles`** that itself reads **`profiles`** causes Postgres to
re-evaluate the policy recursively → runtime error:
`infinite recursion detected in policy for relation "profiles"`. Every authenticated
read of `profiles` would fail. This only affects policies that query the *same* table
they guard; the inline `exists (... from profiles ...)` checks used on *other* tables
(offers, ai_runs, etc.) are fine and unchanged.

## Decision

Introduce a `SECURITY DEFINER` function `is_current_user_admin()` that reads `profiles`
without being subject to RLS, and use it in the admin policy:

```sql
create function is_current_user_admin() returns boolean
  language sql security definer stable
  set search_path = public
  as $$ select exists (select 1 from profiles where id = auth.uid() and system_role = 'admin'); $$;

create policy "admins read all" on profiles for select using (is_current_user_admin());
```

This mirrors the doc's own `is_workspace_member()` SECURITY DEFINER helper in `0003`,
so it is consistent with the established pattern (and distinct from the banned
SECURITY DEFINER *views*).

## Consequences

- `profiles` reads work for both users and admins; no recursion.
- `04_SCHEMA_LEAN.md` should be updated to match once Izak approves.
- Later migrations may optionally reuse `is_current_user_admin()` instead of repeating
  the inline `exists (... from profiles ...)` admin check.

## To revert

If Izak prefers doc-exact, drop the function and restore the inline `exists` policy —
but the recursion error will then surface the first time `profiles` is read under RLS.
