import type { User } from '@supabase/supabase-js'
import { cache } from 'react'

import { createClient } from '@/lib/supabase/server'

// Current authenticated user, memoized per-request via React.cache so repeated
// callers (layout + role/onboarding/credits helpers) share one auth.getUser()
// round-trip instead of each making their own.
export const getSessionUser = cache(async (): Promise<User | null> => {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
})
