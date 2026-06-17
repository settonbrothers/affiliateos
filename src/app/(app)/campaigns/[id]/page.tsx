import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CampaignResultsForm } from '@/components/campaigns/CampaignResultsForm'
import { DiagnoseButton } from '@/components/campaigns/DiagnoseButton'
import { DiagnosisView } from '@/components/campaigns/DiagnosisView'
import { Badge } from '@/components/ui/badge'
import { getTranslatedPayload } from '@/lib/i18n/translatedPayload'
import {
  getCampaign,
  getCampaignResults,
  getLatestDiagnosis,
} from '@/lib/queries/campaigns'

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const campaign = await getCampaign(id)
  if (!campaign) notFound()

  const results = await getCampaignResults(id)
  const diagnosis = await getLatestDiagnosis(id)
  const locale = await getLocale()
  const diagnosisPayload = diagnosis
    ? await getTranslatedPayload(
        'result_diagnoses',
        diagnosis.id,
        locale,
        diagnosis.payload
      )
    : null
  const t = await getTranslations('campaigns')

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/campaigns"
          className="text-sm text-[var(--color-muted-foreground)] underline"
        >
          {t('backToCampaigns')}
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{campaign.name}</h1>
          <Badge>{campaign.status}</Badge>
        </div>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {campaign.offers?.name ?? '—'}
          {campaign.channel ? ` · ${campaign.channel}` : ''}
          {campaign.geo ? ` · ${campaign.geo}` : ''}
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('resultsHeading')}</h2>
        <CampaignResultsForm
          campaignId={campaign.id}
          initial={results ?? undefined}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">{t('diagnosisHeading')}</h2>
        <DiagnoseButton
          campaignId={campaign.id}
          hasResults={!!results}
          hasDiagnosis={!!diagnosis}
        />
        {diagnosis ? (
          <DiagnosisView payload={diagnosisPayload} />
        ) : (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t('diagnosisEmpty')}
          </p>
        )}
      </section>
    </div>
  )
}
