'use server'

import { createClient } from '@/lib/supabase/server'

export type GenerateTestKitResult = { run_id: string } | { error: string }

export async function triggerGenerateTestKit(
  offerId: string
): Promise<GenerateTestKitResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('generate-test-kit', {
    body: { offer_id: offerId },
  })
  if (error) return { error: error.message }
  return data as { run_id: string }
}
