'use server'

import { createClient } from '@/lib/supabase/server'

export type TriggerGenerateCreativesResult = { run_id: string } | { error: string }

export async function triggerGenerateCreatives(
  offerId: string,
  referenceImageBase64?: string
): Promise<TriggerGenerateCreativesResult> {
  const supabase = await createClient()
  const body: Record<string, unknown> = { offer_id: offerId }
  if (referenceImageBase64) body.reference_image_base64 = referenceImageBase64
  const { data, error } = await supabase.functions.invoke('generate-creative', { body })
  if (error) return { error: error.message }
  if (!data?.run_id) return { error: 'Unexpected response from server' }
  return data as { run_id: string }
}
