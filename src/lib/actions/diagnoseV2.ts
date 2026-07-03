'use server'

import { createClient } from '@/lib/supabase/server'

export async function triggerDiagnoseCreatives(
  campaignId: string,
  creativeInput: string,
  images?: string[]
): Promise<{ run_id: string } | { error: string }> {
  const supabase = await createClient()
  const body: Record<string, unknown> = {
    campaign_id: campaignId,
  }
  if (images && images.length > 0) {
    body.images = images
  } else {
    body.creative_input = creativeInput
  }
  const { data, error } = await supabase.functions.invoke('diagnose-results', { body })
  if (error) return { error: error.message }
  if (!data?.run_id) return { error: 'Unexpected response from server' }
  return data as { run_id: string }
}
