'use server'

import { createClient } from '@/lib/supabase/server'

export type TriggerGenerateDeepBriefResult = { run_id: string } | { error: string }

export async function triggerGenerateDeepBrief(
  offerId: string
): Promise<TriggerGenerateDeepBriefResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('generate-deep-brief', {
    body: { offer_id: offerId },
  })
  if (error) return { error: error.message }
  if (!data?.run_id) return { error: 'Unexpected response from server' }
  return data as { run_id: string }
}
