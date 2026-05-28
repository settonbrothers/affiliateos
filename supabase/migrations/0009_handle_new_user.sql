-- 0009_handle_new_user.sql
-- Auto-create a profiles row whenever a user signs up via Supabase Auth.
-- Without this, signups leave no profile → admin checks fail and any FK to
-- profiles(id) (e.g. offers.created_by_user_id) errors. SECURITY DEFINER so
-- the trigger can insert into public.profiles from the auth trigger context.

create function handle_new_user() returns trigger
  language plpgsql security definer
  set search_path = public
  as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
