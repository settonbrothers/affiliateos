'use server'

import { createClient } from '@/lib/supabase/server'

export type TriggerGenerateCreativesResult = { run_id: string } | { error: string }

export async function triggerGenerateCreatives(
  offerId: string
): Promise<TriggerGenerateCreativesResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('generate-creative', {
    body: { offer_id: offerId },
  })
  if (error) return { error: error.message }
  if (!data?.run_id) return { error: 'Unexpected response from server' }
  return data as { run_id: string }
}
