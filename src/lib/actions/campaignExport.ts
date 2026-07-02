'use server'

import { getCampaignViewData } from '@/lib/queries/campaignView'

export async function exportCampaignData(
  offerId: string
): Promise<{ data: string } | { error: string }> {
  try {
    const campaignData = await getCampaignViewData(offerId)
    return { data: JSON.stringify(campaignData, null, 2) }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return { error: message }
  }
}
