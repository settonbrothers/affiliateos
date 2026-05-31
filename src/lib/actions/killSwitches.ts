'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

export async function toggleKillSwitch(
  orchestratorName: string,
  paused: boolean,
  reason?: string
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('agent_kill_switches')
    .update({
      is_paused: paused,
      paused_by: paused ? user.id : null,
      paused_at: paused ? new Date().toISOString() : null,
      reason: paused ? (reason && reason.trim() ? reason.trim() : null) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('orchestrator_name', orchestratorName)
  if (error) return { error: error.message }

  revalidatePath('/admin/kill-switches')
}
