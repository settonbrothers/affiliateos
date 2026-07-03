'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { createClient } from '@/lib/supabase/server'
import {
  CampaignResultsSchema,
  type CampaignResultsInput,
} from '@/lib/validations/campaign'

// Create a campaign from an offer's generated test kit, then go to it.
export async function createCampaign(
  offerId: string,
  testKitId: string | null
): Promise<{ error: string } | void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: offer } = await supabase
    .from('offers')
    .select('name, workspace_id')
    .eq('id', offerId)
    .maybeSingle()
  if (!offer) return { error: 'Offer not found.' }

  const { data, error } = await supabase
    .from('campaigns')
    .insert({
      offer_id: offerId,
      test_kit_id: testKitId,
      workspace_id: offer.workspace_id,
      created_by_user_id: user.id,
      name: `${offer.name} — test`,
      status: 'draft',
    })
    .select('id')
    .single()
  if (error) return { error: error.message }

  revalidatePath('/campaigns')
  redirect(`/campaigns/${(data as { id: string }).id}`)
}

export async function saveCampaignResults(
  campaignId: string,
  input: CampaignResultsInput
): Promise<{ error: string } | void> {
  const parsed = CampaignResultsSchema.safeParse(input)
  if (!parsed.success) return { error: parsed.error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join('; ') }

  const supabase = await createClient()
  const now = new Date().toISOString()
  const { error } = await supabase
    .from('campaign_results')
    .upsert(
      { campaign_id: campaignId, ...parsed.data, updated_at: now },
      { onConflict: 'campaign_id' }
    )
  if (error) return { error: error.message }

  // Advance status out of 'draft' once results exist (don't downgrade a
  // previously diagnosed campaign).
  await supabase
    .from('campaigns')
    .update({ status: 'results_entered', updated_at: now })
    .eq('id', campaignId)
    .eq('status', 'draft')

  revalidatePath(`/campaigns/${campaignId}`)
}

export type DiagnoseResult = { run_id: string } | { error: string }

export async function triggerDiagnose(
  campaignId: string
): Promise<DiagnoseResult> {
  const supabase = await createClient()
  const { data, error } = await supabase.functions.invoke('diagnose-results', {
    body: { campaign_id: campaignId },
  })
  if (error) return { error: error.message }
  if (!data?.run_id) return { error: 'Unexpected response from server' }
  return data as { run_id: string }
}
