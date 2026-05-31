'use server'

import { revalidatePath } from 'next/cache'

import { createClient } from '@/lib/supabase/server'

export type IngestResult = { job_id: string } | { error: string }

export async function triggerIngestSource(
  offerId: string,
  url: string
): Promise<IngestResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('ingest-source', {
    body: { offer_id: offerId, url },
  })
  if (error) return { error: error.message }
  revalidatePath(`/admin/offers/${offerId}/sources`)
  return data as { job_id: string }
}

async function setFactStatus(
  factId: string,
  offerId: string,
  status: 'verified' | 'rejected'
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { error } = await supabase
    .from('extracted_facts')
    .update({
      status,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', factId)
  if (error) return { error: error.message }

  revalidatePath(`/admin/offers/${offerId}/sources`)
}

export async function approveFact(factId: string, offerId: string) {
  return setFactStatus(factId, offerId, 'verified')
}

export async function rejectFact(factId: string, offerId: string) {
  return setFactStatus(factId, offerId, 'rejected')
}
