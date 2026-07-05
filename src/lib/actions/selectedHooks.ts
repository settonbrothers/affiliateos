'use server'
import { createClient } from '@/lib/supabase/server'

export type SaveSelectedHooksResult = { ok: true } | { error: string }

export async function saveSelectedHooks(
  generationId: string,
  indices: number[]
): Promise<SaveSelectedHooksResult> {
  const supabase = await createClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('ad_copy_generations')
    .update({ selected_hook_indices: indices })
    .eq('id', generationId)
  if (error) return { error: error.message }
  return { ok: true }
}
