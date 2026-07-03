import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CampaignResultsForm } from '@/components/campaigns/CampaignResultsForm'
import { DiagnoseButton } from '@/components/campaigns/DiagnoseButton'
import { DiagnoseCreativesForm } from '@/components/campaigns/DiagnoseCreativesForm'
import { DiagnoseV2Display } from '@/components/campaigns/DiagnoseV2Display'
import { DiagnosisView } from '@/components/campaigns/DiagnosisView'
import { TranslationFiller } from '@/components/i18n/TranslationFiller'
import { Badge } from '@/components/ui/badge'
import {
  getTranslatedPayload,
  shouldTranslate,
} from '@/lib/i18n/translatedPayload'
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
          <>
            <DiagnosisView payload={diagnosisPayload} />
            {shouldTranslate(locale, diagnosis.payload) && (
              <TranslationFiller
                sourceTable="result_diagnoses"
                sourceId={diagnosis.id}
                locale={locale}
              />
            )}
          </>
        ) : (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t('diagnosisEmpty')}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">ניתוח קריאייטיבים (V2)</h2>
        <DiagnoseCreativesForm campaignId={campaign.id} />
        {diagnosis?.creative_analysis ? (
          <DiagnoseV2Display
            creativeAnalysis={diagnosis.creative_analysis}
            winningHooks={diagnosis.winning_hooks}
            winnersAddedToLibrary={diagnosis.winners_added_to_library}
          />
        ) : (
          <p className="text-sm text-[var(--color-muted-foreground)]">
            הדבק טקסט מודעות שרצו כדי לנתח קריאייטיבים ולמצוא winning hooks.
          </p>
        )}
      </section>
    </div>
  )
}
