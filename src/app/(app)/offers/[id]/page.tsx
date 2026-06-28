import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CreateCampaignButton } from '@/components/campaigns/CreateCampaignButton'
import { AnalyzeButton } from '@/components/offers/AnalyzeButton'
import { CheckComplianceButton } from '@/components/offers/CheckComplianceButton'
import { ComplianceView } from '@/components/offers/ComplianceView'
import { GenerateTestKitButton } from '@/components/offers/GenerateTestKitButton'
import { OfferOverview } from '@/components/offers/OfferOverview'
import { OfferScorecard } from '@/components/offers/OfferScorecard'
import { OfferVerdict } from '@/components/offers/OfferVerdict'
import { TestKitView } from '@/components/offers/TestKitView'
import { TranslationFiller } from '@/components/i18n/TranslationFiller'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import {
  getTranslatedPayload,
  shouldTranslate,
} from '@/lib/i18n/translatedPayload'
import {
  getLatestCompliance,
  getLatestRunByOrchestrator,
  getLatestTestKit,
  getOfferById,
  getVerifiedFacts,
  hasSuccessfulUnderwriting,
} from '@/lib/queries/offers'
import { cn } from '@/lib/utils'
import type { UnderwritingResponse } from '@/types/agents/underwriting'

const TAB_KEYS = [
  'overview',
  'scorecard',
  'verdict',
  'test-kit',
  'compliance',
] as const

export default async function OfferDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab } = await searchParams

  const offer = await getOfferById(id)
  if (!offer) notFound()

  // Scorecard/verdict need the latest UNDERWRITING run specifically — not the
  // latest run of any orchestrator (test-kit/diagnosis/compliance payloads have
  // no `scores`, which would crash the scorecard).
  const locale = await getLocale()
  const run = await getLatestRunByOrchestrator(id, 'UnderwritingOrchestrator')
  // Show the verdict/scorecard prose in the viewer's locale (English payload
  // untouched). Only the underwriting run carries a translatable id; the
  // offer.evaluation fallback (legacy inline payload) stays as-is.
  const evaluation = run
    ? ((await getTranslatedPayload(
        'ai_runs',
        run.id,
        locale,
        run.output_payload
      )) as UnderwritingResponse | null)
    : offer.evaluation
  const activeTab =
    tab === 'scorecard' ||
    tab === 'verdict' ||
    tab === 'test-kit' ||
    tab === 'compliance'
      ? tab
      : 'overview'
  const isAdmin = await isCurrentUserAdmin()
  const t = await getTranslations('offers')
  const TAB_LABELS: Record<(typeof TAB_KEYS)[number], string> = {
    overview: t('tabOverview'),
    scorecard: t('tabScorecard'),
    verdict: t('tabVerdict'),
    'test-kit': t('tabTestKit'),
    compliance: t('tabCompliance'),
  }

  // Verified facts feed the Overview's evidence section.
  const facts = activeTab === 'overview' ? await getVerifiedFacts(id) : []

  // Compliance feeds the Compliance tab and the verdict-cap banner on Verdict.
  const compliance =
    activeTab === 'compliance' || activeTab === 'verdict'
      ? await getLatestCompliance(id)
      : null
  const compliancePayload = compliance
    ? await getTranslatedPayload(
        'offer_compliance_warnings',
        compliance.id,
        locale,
        compliance.payload
      )
    : null

  // Test-kit tab needs its own data — only fetch when that tab is active.
  const testKit =
    activeTab === 'test-kit' ? await getLatestTestKit(id) : null
  const testKitRun =
    activeTab === 'test-kit'
      ? await getLatestRunByOrchestrator(id, 'TestKitOrchestrator')
      : null
  const hasVerdict =
    activeTab === 'test-kit' ? await hasSuccessfulUnderwriting(id) : false
  const testKitPayload = testKit
    ? await getTranslatedPayload('test_kits', testKit.id, locale, testKit.payload)
    : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{offer.name}</h1>
          {offer.website_url && (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              {offer.website_url}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href={`/admin/offers/${offer.id}/sources`}
              className="text-sm text-[var(--color-muted-foreground)] underline"
            >
              {t('manageSources')}
            </Link>
          )}
          <AnalyzeButton offerId={offer.id} initialStatus={run?.status ?? null} />
        </div>
      </div>

      <nav className="flex gap-2 border-b border-[var(--color-border)]">
        {TAB_KEYS.map((tabKey) => (
          <Link
            key={tabKey}
            href={`/offers/${offer.id}?tab=${tabKey}`}
            className={cn(
              'px-3 py-2 text-sm',
              activeTab === tabKey
                ? 'border-b-2 border-[var(--color-foreground)] font-medium'
                : 'text-[var(--color-muted-foreground)]'
            )}
          >
            {TAB_LABELS[tabKey]}
          </Link>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <OfferOverview
          offer={offer}
          operatorNotes={offer.operator_notes}
          isAdmin={isAdmin}
          facts={facts}
        />
      )}
      {activeTab === 'scorecard' && (
        <>
          <OfferScorecard evaluation={evaluation} />
          {run && shouldTranslate(locale, run.output_payload) && (
            <TranslationFiller
              sourceTable="ai_runs"
              sourceId={run.id}
              locale={locale}
            />
          )}
        </>
      )}
      {activeTab === 'verdict' && (
        <div className="flex flex-col gap-4">
          {compliance?.suggested_verdict_cap && (
            <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm dark:bg-red-950/40">
              <span className="font-medium">
                Compliance cap: verdict limited to “
                {compliance.suggested_verdict_cap}”.
              </span>{' '}
              See the Compliance tab.
            </div>
          )}
          <OfferVerdict evaluation={evaluation} />
          {run && shouldTranslate(locale, run.output_payload) && (
            <TranslationFiller
              sourceTable="ai_runs"
              sourceId={run.id}
              locale={locale}
            />
          )}
        </div>
      )}
      {activeTab === 'test-kit' && (
        <div className="flex flex-col gap-6">
          <GenerateTestKitButton
            offerId={offer.id}
            initialStatus={testKitRun?.status ?? null}
            hasVerdict={hasVerdict}
            hasKit={!!testKit}
          />
          {testKit ? (
            <>
              <CreateCampaignButton offerId={offer.id} testKitId={testKit.id} />
              <TestKitView payload={testKitPayload} />
              {shouldTranslate(locale, testKit.payload) && (
                <TranslationFiller
                  sourceTable="test_kits"
                  sourceId={testKit.id}
                  locale={locale}
                />
              )}
            </>
          ) : (
            hasVerdict && (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No test kit yet. Generate one from the current verdict.
              </p>
            )
          )}
        </div>
      )}
      {activeTab === 'compliance' && (
        <div className="flex flex-col gap-6">
          <CheckComplianceButton offerId={offer.id} hasReport={!!compliance} />
          {compliance ? (
            <>
              <ComplianceView
                payload={compliancePayload}
                suggestedVerdictCap={compliance.suggested_verdict_cap}
              />
              {shouldTranslate(locale, compliance.payload) && (
                <TranslationFiller
                  sourceTable="offer_compliance_warnings"
                  sourceId={compliance.id}
                  locale={locale}
                />
              )}
            </>
          ) : (
            <p className="text-sm text-[var(--color-muted-foreground)]">
              No compliance check yet. Run one to surface claim risks and safe
              framings.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
