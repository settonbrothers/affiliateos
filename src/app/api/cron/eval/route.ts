import { NextResponse } from 'next/server'

import { isAuthorizedCron } from '@/lib/cron/auth'

export const runtime = 'nodejs'
// The edge fn runs the eval in the background; we just fan out the triggers.
export const maxDuration = 60

// Verticals to replay nightly. ai_saas is the only one with a labeled golden
// set today; health/mental are triggered too and harmlessly 400 until labeled.
const VERTICALS = ['ai_saas', 'health', 'mental_wellness']

export async function GET(req: Request): Promise<Response> {
  if (
    !isAuthorizedCron(req.headers.get('authorization'), process.env.CRON_SECRET)
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const cronSecret = process.env.CRON_SECRET
  if (!supabaseUrl || !anonKey || !cronSecret) {
    return NextResponse.json({ error: 'Cron not configured' }, { status: 503 })
  }

  const results: Record<string, number> = {}
  for (const vertical of VERTICALS) {
    try {
      const res = await fetch(`${supabaseUrl}/functions/v1/eval-cron`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${anonKey}`,
          'x-cron-secret': cronSecret,
        },
        body: JSON.stringify({ vertical, trigger: 'cron' }),
      })
      results[vertical] = res.status
    } catch {
      results[vertical] = 0
    }
  }

  return NextResponse.json({ triggered: results })
}
