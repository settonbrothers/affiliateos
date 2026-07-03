'use server'

import { createClient } from '@/lib/supabase/server'

export async function triggerSpyAnalysis(
  offerId: string,
  inputType: 'text' | 'url' | 'batch' | 'image',
  rawInput: string
): Promise<{ run_id: string } | { error: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('analyze-spy', {
    body: { offer_id: offerId, input_type: inputType, raw_input: rawInput },
  })
  if (error) return { error: error.message }
  if (!data?.run_id) return { error: 'Unexpected response from server' }
  return data as { run_id: string }
}
