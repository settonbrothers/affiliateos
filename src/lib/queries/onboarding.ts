import { getSessionUser } from '@/lib/auth/session'
import { createClient } from '@/lib/supabase/server'

// True once the user has completed (or skipped) onboarding. Used by the (app)
// layout to gate the app. New signups have no row -> false -> /onboarding.
export async function isOnboarded(): Promise<boolean> {
  const user = await getSessionUser()
  if (!user) return false
  const supabase = await createClient()
  const { data } = await supabase
    .from('operator_profiles')
    .select('onboarded_at')
    .eq('user_id', user.id)
    .maybeSingle()
  return !!data?.onboarded_at
}
