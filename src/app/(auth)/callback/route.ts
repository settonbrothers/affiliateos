import { type NextRequest, NextResponse } from 'next/server'

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

// Magic-link / OAuth callback: exchanges the auth code for a session cookie.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/offers'
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/offers'

  // Supabase sends ?error=...&error_description=... when auth fails upstream.
  const oauthError = searchParams.get('error')
  const oauthErrorDescription = searchParams.get('error_description')
  if (oauthError) {
    const message = oauthErrorDescription ?? oauthError
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(message)}`
    )
  }

  if (code) {
    const supabase = await createClient()
    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // FIX 2.5: If the user signed up with email confirmation, credits may not
      // have been granted yet (workspace wasn't ready at signup time). Check for
      // a pending invite_redemptions row (credits_granted = 0 with bonus_credits
      // available on the linked invite code) and apply the grant now.
      const userId = sessionData.user?.id
      if (userId) {
        const admin = createAdminClient()
        const { data: pendingRedemption } = await admin
          .from('invite_redemptions')
          .select('id, invite_code_id, workspace_id, invite_codes(bonus_credits)')
          .eq('user_id', userId)
          .eq('credits_granted', 0)
          .maybeSingle()

        if (pendingRedemption) {
          // Resolve workspace in case it wasn't ready at signup time.
          let workspaceId = pendingRedemption.workspace_id
          if (!workspaceId) {
            const { data: mem } = await admin
              .from('workspace_members')
              .select('workspace_id')
              .eq('user_id', userId)
              .maybeSingle()
            workspaceId = mem?.workspace_id ?? null
          }

          const bonusCredits =
            (pendingRedemption.invite_codes as { bonus_credits: number } | null)
              ?.bonus_credits ?? 0

          if (workspaceId && bonusCredits > 0) {
            await admin.from('credit_ledger').insert({
              workspace_id: workspaceId,
              entry_type: 'granted',
              amount: bonusCredits,
              reason: `Invite bonus (deferred after email confirmation)`,
            })
            await admin
              .from('invite_redemptions')
              .update({ workspace_id: workspaceId, credits_granted: bonusCredits })
              .eq('id', pendingRedemption.id)
          }
        }
      }

      return NextResponse.redirect(`${origin}${safeNext}`)
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`
    )
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent('Authentication failed. Please try again.')}`
  )
}
