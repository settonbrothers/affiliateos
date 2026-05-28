import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

// Service-role client for edge functions. Bypasses RLS — use only server-side.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-injected into edge functions.
export function getAdminClient(): SupabaseClient {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
