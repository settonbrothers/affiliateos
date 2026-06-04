'use server'

import { createClient } from '@/lib/supabase/server'

export type CheckComplianceResult = { run_id: string } | { error: string }

export async function triggerCheckCompliance(
  offerId: string
): Promise<CheckComplianceResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('check-compliance', {
    body: { offer_id: offerId },
  })
  if (error) return { error: error.message }
  return data as { run_id: string }
}
