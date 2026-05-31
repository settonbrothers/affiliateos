'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

// Activate a prompt version: deactivate all siblings in the same
// (orchestrator_name, prompt_type, vertical_id) group, then mark the target
// active. RLS allows admin updates; the (admin) layout already enforces role.
export async function activatePrompt(
  promptId: string
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: target, error: lookupErr } = await supabase
    .from('prompts')
    .select('id, orchestrator_name, prompt_type, vertical_id, is_active')
    .eq('id', promptId)
    .maybeSingle()
  if (lookupErr) return { error: lookupErr.message }
  if (!target) return { error: 'Prompt not found.' }
  if (target.is_active) {
    // Nothing to do; treat as success.
    revalidatePath('/admin/prompts')
    return
  }

  let deactivate = supabase
    .from('prompts')
    .update({ is_active: false })
    .eq('orchestrator_name', target.orchestrator_name)
    .eq('prompt_type', target.prompt_type)
    .neq('id', target.id)
  deactivate =
    target.vertical_id !== null
      ? deactivate.eq('vertical_id', target.vertical_id)
      : deactivate.is('vertical_id', null)
  const { error: deactErr } = await deactivate
  if (deactErr) return { error: deactErr.message }

  const { error: actErr } = await supabase
    .from('prompts')
    .update({ is_active: true })
    .eq('id', target.id)
  if (actErr) return { error: actErr.message }

  revalidatePath('/admin/prompts')
  revalidatePath(`/admin/prompts/${target.id}`)
}
