'use server'

import { createClient } from '@/lib/supabase/server'

export type TriggerGenerateAvatarResult = { run_id: string } | { error: string }

export async function triggerGenerateAvatar(
  offerId: string
): Promise<TriggerGenerateAvatarResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('generate-avatar', {
    body: { offer_id: offerId },
  })
  if (error) return { error: error.message }
  if (!data?.run_id) return { error: 'Unexpected response from server' }
  return data as { run_id: string }
}
