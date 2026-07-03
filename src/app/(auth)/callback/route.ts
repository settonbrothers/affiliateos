import { type NextRequest, NextResponse } from 'next/server'

import { createClient } from '@/lib/supabase/server'

// Magic-link / OAuth callback: exchanges the auth code for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/offers'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/offers'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${safeNext}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback`)
}
