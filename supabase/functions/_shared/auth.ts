import { createClient } from 'npm:@supabase/supabase-js@2'

import { getAdminClient } from './supabaseAdmin.ts'

export class UnauthorizedError extends Error {
  constructor(message = 'Unauthorized') {
    super(message)
    this.name = 'UnauthorizedError'
  }
}

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ForbiddenError'
  }
}

// Resolves the caller from the request's Authorization header, scoped to the
// anon key so RLS still applies to anything this client touches.
export async function requireUser(req: Request) {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) throw new UnauthorizedError('Missing Authorization header')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  )

  const { data, error } = await supabase.auth.getUser()
  if (error || !data.user) throw new UnauthorizedError('Invalid or expired token')
  return data.user
}

export async function requireAdmin(req: Request) {
  const user = await requireUser(req)

  const { data, error } = await getAdminClient()
    .from('profiles')
    .select('system_role')
    .eq('id', user.id)
    .single()

  if (error || data?.system_role !== 'admin') {
    throw new ForbiddenError('Admin role required')
  }
  return user
}
