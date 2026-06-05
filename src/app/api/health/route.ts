import { NextResponse } from 'next/server'

import { captureException } from '@/lib/observability/sentry'
import { createAdminClient } from '@/lib/supabase/admin'

// Unauthenticated liveness/readiness probe for an uptime monitor (Better Stack,
// etc.). 200 = app + DB reachable; 503 = degraded. Never throws.
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const admin = createAdminClient()
    // Cheap reachability check against a tiny seeded table.
    const { error } = await admin
      .from('verticals')
      .select('id', { head: true, count: 'exact' })
    if (error) {
      return NextResponse.json({ status: 'degraded', db: false }, { status: 503 })
    }
    return NextResponse.json({ status: 'ok', db: true })
  } catch (err) {
    await captureException(err, { tags: { route: 'health' } })
    return NextResponse.json({ status: 'down', db: false }, { status: 503 })
  }
}
