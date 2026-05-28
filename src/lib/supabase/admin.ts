import 'server-only'

import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Service-role client for privileged server / edge-function work. BYPASSES RLS.
// `import 'server-only'` turns any client-side import of this file into a build error,
// so the service-role key can never leak to the browser bundle.
// TODO(types): add the <Database> generic once types are generated on main.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
}
