import { getLocale, getTranslations } from 'next-intl/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CreateCampaignButton } from '@/components/campaigns/CreateCampaignButton'
import { AvatarDisplay } from '@/components/avatar-builder/AvatarDisplay'
import { GenerateAvatarButton } from '@/components/avatar-builder/GenerateAvatarButton'
import { DeepBriefDisplay } from '@/components/deep-brief/DeepBriefDisplay'
import { GenerateDeepBriefButton } from '@/components/deep-brief/GenerateDeepBriefButton'
import { AdCopyView } from '@/components/offers/AdCopyView'
import { AnalyzeButton } from '@/components/offers/AnalyzeButton'
import { CheckComplianceButton } from '@/components/offers/CheckComplianceButton'
import { ComplianceView } from '@/components/offers/ComplianceView'
import { ExecuteCopyButton } from '@/components/offers/ExecuteCopyButton'
import { GenerateTestKitButton } from '@/components/offers/GenerateTestKitButton'
import { OfferOverview } from '@/components/offers/OfferOverview'
import { OfferScorecard } from '@/components/offers/OfferScorecard'
import { OfferVerdict } from '@/components/offers/OfferVerdict'
import { TestKitView } from '@/components/offers/TestKitView'
import { SpyInputForm } from '@/components/spy-analysis/SpyInputForm'
import { SpyAnalysisDisplay } from '@/components/spy-analysis/SpyAnalysisDisplay'
import { GenerateCreativesButton } from '@/components/creative-engine/GenerateCreativesButton'
import { CreativesDisplay } from '@/components/creative-engine/CreativesDisplay'
import { CampaignView } from '@/components/campaign-view/CampaignView'
import { CampaignWizard } from '@/components/wizard/CampaignWizard'
import type { WizardStep } from '@/components/wizard/CampaignWizard'
import { NetworkComparisonCard } from '@/components/offers/NetworkComparisonCard'
import { TrendingBadge } from '@/components/offers/TrendingBadge'
import { TranslationFiller } from '@/components/i18n/TranslationFiller'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import {
  getTranslatedPayload,
  shouldTranslate,
} from '@/lib/i18n/translatedPayload'
import {
  getLatestAdCopy,
  getLatestAvatar,
  getLatestCompliance,
  getLatestCreatives,
  getLatestDeepBrief,
  getLatestRunByOrchestrator,
  getLatestSpyAnalysis,
  getLatestTestKit,
  getOfferById,
  getVerifiedFacts,
} from '@/lib/queries/offers'
import type { UnderwritingResponse } from '@/types/agents/underwriting'

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

  const locale = await getLocale()
  const run = await getLatestRunByOrchestrator(id, 'UnderwritingOrchestrator')
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
    tab === 'copy' ||
    tab === 'compliance' ||
    tab === 'deep-brief' ||
    tab === 'avatar' ||
    tab === 'spy' ||
    tab === 'creatives' ||
    tab === 'campaign-view'
      ? tab
      : 'overview'
  const isAdmin = await isCurrentUserAdmin()
  const t = await getTranslations('offers')

  const facts = activeTab === 'overview' ? await getVerifiedFacts(id) : []

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

  // Always fetch these upfront for wizard step lock computation
  const deepBrief = await getLatestDeepBrief(id)
  const avatar = await getLatestAvatar(id)
  const testKit = await getLatestTestKit(id)
  const adCopy = await getLatestAdCopy(id)
  const creatives = await getLatestCreatives(id)
  const spyAnalysis = await getLatestSpyAnalysis(id)

  // Fetch runs only when the relevant tab is active
  const testKitRun =
    activeTab === 'test-kit'
      ? await getLatestRunByOrchestrator(id, 'TestKitOrchestrator')
      : null
  const adCopyRun =
    activeTab === 'copy'
      ? await getLatestRunByOrchestrator(id, 'AdCopyOrchestrator')
      : null
  const deepBriefRun =
    activeTab === 'deep-brief'
      ? await getLatestRunByOrchestrator(id, 'DeepBriefOrchestrator')
      : null
  const avatarRun =
    activeTab === 'avatar'
      ? await getLatestRunByOrchestrator(id, 'AvatarBuilderOrchestrator')
      : null
  const creativesRun =
    activeTab === 'creatives'
      ? await getLatestRunByOrchestrator(id, 'CreativeEngineOrchestrator')
      : null

  // Translated payloads for active tab
  const testKitPayload = testKit
    ? await getTranslatedPayload('test_kits', testKit.id, locale, testKit.payload)
    : null

  // Compute wizard steps
  const wizardSteps: WizardStep[] = [
    { key: 'overview', label: t('tabOverview'), isComplete: true, isLocked: false, isSkippable: false, isActive: activeTab === 'overview', href: `/offers/${offer.id}?tab=overview` },
    { key: 'deep-brief', label: t('tabDeepBrief'), isComplete: !!deepBrief, isLocked: false, isSkippable: false, isActive: activeTab === 'deep-brief', href: `/offers/${offer.id}?tab=deep-brief` },
    { key: 'avatar', label: t('tabAvatar'), isComplete: !!avatar, isLocked: !deepBrief, isSkippable: false, isActive: activeTab === 'avatar', href: `/offers/${offer.id}?tab=avatar` },
    { key: 'spy', label: t('tabSpy'), isComplete: !!spyAnalysis, isLocked: !avatar, isSkippable: true, isActive: activeTab === 'spy', href: `/offers/${offer.id}?tab=spy` },
    { key: 'test-kit', label: t('tabTestKit'), isComplete: !!testKit, isLocked: !avatar, isSkippable: false, isActive: activeTab === 'test-kit', href: `/offers/${offer.id}?tab=test-kit` },
    { key: 'copy', label: t('tabCopy'), isComplete: !!adCopy, isLocked: !testKit, isSkippable: false, isActive: activeTab === 'copy', href: `/offers/${offer.id}?tab=copy` },
    { key: 'creatives', label: t('tabCreatives'), isComplete: !!creatives, isLocked: !adCopy || !adCopy.selected_hook_indices?.length, isSkippable: false, isActive: activeTab === 'creatives', href: `/offers/${offer.id}?tab=creatives` },
    { key: 'campaign-view', label: t('tabCampaignView'), isComplete: false, isLocked: !creatives, isSkippable: false, isActive: activeTab === 'campaign-view', href: `/offers/${offer.id}?tab=campaign-view` },
  ]
  const completedCount = wizardSteps.filter(s => s.isComplete).length

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
          <AnalyzeButton offerId={offer.id} initialStatus={run?.status ?? null} initialRunId={run?.id ?? null} />
        </div>
      </div>

      <CampaignWizard steps={wizardSteps} completedCount={completedCount} totalCount={wizardSteps.length}>
        {activeTab === 'overview' && (
          <>
            <div className="flex items-center gap-2">
              <TrendingBadge signal={(offer as unknown as Record<string, unknown>).trending_signal as 'rising' | 'stable' | 'declining' | null | undefined} />
            </div>
            <NetworkComparisonCard offerId={offer.id} />
            <OfferOverview
              offer={offer}
              operatorNotes={offer.operator_notes}
              isAdmin={isAdmin}
              facts={facts}
            />
          </>
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
                  Compliance cap: verdict limited to &quot;
                  {compliance.suggested_verdict_cap}&quot;.
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
              initialRunId={testKitRun?.id ?? null}
              hasBrief={!!deepBrief}
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
              !!deepBrief && (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  No test kit yet. Generate one using the Deep Brief.
                </p>
              )
            )}
          </div>
        )}
        {activeTab === 'copy' && (
          <div className="flex flex-col gap-6">
            <ExecuteCopyButton
              offerId={offer.id}
              initialStatus={adCopyRun?.status ?? null}
              initialRunId={adCopyRun?.id ?? null}
              hasVerdict={!!testKit}
              hasCopy={!!adCopy}
            />
            {adCopy ? (
              <AdCopyView
                payload={adCopy.payload}
                generationId={adCopy.id}
                initialSelectedIndices={adCopy.selected_hook_indices ?? null}
              />
            ) : (
              !!testKit && (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {t('copyEmpty')}
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
        {activeTab === 'deep-brief' && (
          <div className="flex flex-col gap-6">
            <GenerateDeepBriefButton
              offerId={offer.id}
              initialStatus={deepBriefRun?.status ?? null}
              initialRunId={deepBriefRun?.id ?? null}
              hasBrief={!!deepBrief}
            />
            {deepBrief ? (
              <DeepBriefDisplay payload={deepBrief.payload} />
            ) : (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No deep brief yet. Generate one to get a full marketing brief for this offer.
              </p>
            )}
          </div>
        )}
        {activeTab === 'avatar' && (
          <div className="flex flex-col gap-6">
            <GenerateAvatarButton
              offerId={offer.id}
              initialStatus={avatarRun?.status ?? null}
              initialRunId={avatarRun?.id ?? null}
              hasAvatar={!!avatar}
            />
            {avatar ? (
              <AvatarDisplay payload={avatar.payload} />
            ) : (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No avatar yet. Generate one to build a detailed buyer portrait for this offer.
              </p>
            )}
          </div>
        )}
        {activeTab === 'spy' && (
          <div className="flex flex-col gap-6">
            <SpyInputForm
              offerId={offer.id}
              hasExistingAnalysis={!!spyAnalysis}
            />
            {spyAnalysis && (
              <SpyAnalysisDisplay payload={spyAnalysis.payload} />
            )}
          </div>
        )}
        {activeTab === 'creatives' && (
          <div className="flex flex-col gap-6">
            <GenerateCreativesButton
              offerId={offer.id}
              initialStatus={creativesRun?.status ?? null}
              initialRunId={creativesRun?.id ?? null}
              hasCreatives={!!creatives}
            />
            {creatives ? (
              <CreativesDisplay payload={creatives.payload} />
            ) : (
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No creatives yet. Generate 7 ad image concepts powered by DALL-E 3.
              </p>
            )}
          </div>
        )}
        {activeTab === 'campaign-view' && (
          <CampaignView offerId={offer.id} offerName={offer.name} />
        )}
      </CampaignWizard>
    </div>
  )
}
