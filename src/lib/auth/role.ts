import { createClient } from '@/lib/supabase/server'

// Returns the current user's system_role, or null if unauthenticated.
// Reads profiles directly (RLS lets a user read their own row); mirrors the
// check previously inlined in the /admin layout.
export async function getCurrentUserRole(): Promise<
  'admin' | 'user' | null
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileError) {
    console.error('role.ts: failed to fetch profile', profileError)
    return null
  }

  return (profile?.system_role as 'admin' | 'user' | undefined) ?? null
}

export async function isCurrentUserAdmin(): Promise<boolean> {
  return (await getCurrentUserRole()) === 'admin'
}
