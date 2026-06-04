'use server'

import { revalidatePath } from 'next/cache'

import { isCurrentUserAdmin } from '@/lib/auth/role'
import { getCurrentWorkspaceId } from '@/lib/queries/credits'
import { createClient } from '@/lib/supabase/server'

// Admin-only manual grant to the admin's own workspace. Stripe purchases and
// invite-redemption grants (later M5 slices) write the same ledger.
export async function grantCredits(
  amount: number
): Promise<{ error: string } | void> {
  if (!Number.isInteger(amount) || amount <= 0 || amount > 100000) {
    return { error: 'Enter a positive whole number of credits.' }
  }
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }

  const workspaceId = await getCurrentWorkspaceId()
  if (!workspaceId) return { error: 'No workspace.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('credit_ledger').insert({
    workspace_id: workspaceId,
    entry_type: 'granted',
    amount,
    reason: 'Admin manual grant',
    created_by: user?.id ?? null,
  })
  if (error) return { error: error.message }

  revalidatePath('/billing')
}
