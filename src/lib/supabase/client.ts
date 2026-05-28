import { createBrowserClient } from '@supabase/ssr'

// Browser Supabase client for use in Client Components.
// TODO(types): add the <Database> generic once `supabase gen types typescript
// --linked` has been run on main (06 protocol rule 4: types regen on merge).
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
