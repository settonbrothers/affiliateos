'use server'

import { createClient } from '@/lib/supabase/server'

export async function triggerDiagnoseCreatives(
  campaignId: string,
  creativeInput: string
): Promise<{ run_id: string } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('diagnose-results', {
    body: { campaign_id: campaignId, creative_input: creativeInput },
  })
  if (error) return { error: error.message }
  return data as { run_id: string }
}
