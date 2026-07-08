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
import { EvidenceBars } from '@/components/crack-score/evidence-bars'
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

// White "Selezione" document surface for deliverable tabs (Deep Brief, Avatar,
// Spy, Test Kit, Ad Copy, Creatives). Mirrors EditorialSurface without breaking
// out of the nested wizard content column.
const docSurface = {
  background: '#F6F4EF',
  color: '#1F1B16',
  padding: 'clamp(28px,4vw,52px) clamp(24px,4vw,48px)',
} as const

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
      <div dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.1em', color: '#A2A2A0' }}>
        ‹ AI PICKS&nbsp;<span style={{ color: '#767674' }}>/</span>&nbsp;<span style={{ color: '#B0B0AE' }}>{offer.name.toUpperCase()}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap' }}>
        <div>
          <h1 dir="ltr" style={{ margin: 0, fontFamily: 'var(--font-display)', fontSize: 'clamp(40px,6vw,72px)', fontWeight: 600, lineHeight: 0.9, letterSpacing: '0.01em', textAlign: 'right' }}>
            {offer.name}
          </h1>
          {offer.website_url && (
            <div dir="ltr" style={{ marginTop: '12px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#B0B0AE' }}>
              {offer.website_url}
            </div>
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

      {evaluation?.payload && (
        <div style={{ border: '1px solid rgba(255,255,255,0.1)', background: 'radial-gradient(90% 130% at 22% 0%, #17140A 0%, #161310 62%)', padding: 'clamp(24px,3vw,40px)' }}>
          <EvidenceBars scores={evaluation.payload.scores} weightedScore={evaluation.payload.weighted_score} />
        </div>
      )}

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
              <div
                style={{
                  borderRadius: '8px',
                  border: '1px solid var(--amber-border)',
                  background: 'var(--amber-bg)',
                  padding: '12px',
                  fontSize: '13px',
                  color: 'var(--amber-text)',
                }}
              >
                <span style={{ fontWeight: 500 }}>
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
          <div className="flex flex-col gap-6" style={docSurface}>
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
                <p className="text-sm" style={{ color: '#6B6459' }}>
                  No test kit yet. Generate one using the Deep Brief.
                </p>
              )
            )}
          </div>
        )}
        {activeTab === 'copy' && (
          <div className="flex flex-col gap-6" style={docSurface}>
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
                <p className="text-sm" style={{ color: '#6B6459' }}>
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
          <div className="flex flex-col gap-6" style={docSurface}>
            <GenerateDeepBriefButton
              offerId={offer.id}
              initialStatus={deepBriefRun?.status ?? null}
              initialRunId={deepBriefRun?.id ?? null}
              hasBrief={!!deepBrief}
            />
            {deepBrief ? (
              <DeepBriefDisplay payload={deepBrief.payload} />
            ) : (
              <p className="text-sm" style={{ color: '#6B6459' }}>
                No deep brief yet. Generate one to get a full marketing brief for this offer.
              </p>
            )}
          </div>
        )}
        {activeTab === 'avatar' && (
          <div className="flex flex-col gap-6" style={docSurface}>
            <GenerateAvatarButton
              offerId={offer.id}
              initialStatus={avatarRun?.status ?? null}
              initialRunId={avatarRun?.id ?? null}
              hasAvatar={!!avatar}
            />
            {avatar ? (
              <AvatarDisplay payload={avatar.payload} />
            ) : (
              <p className="text-sm" style={{ color: '#6B6459' }}>
                No avatar yet. Generate one to build a detailed buyer portrait for this offer.
              </p>
            )}
          </div>
        )}
        {activeTab === 'spy' && (
          <div className="flex flex-col gap-6" style={docSurface}>
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
          <div className="flex flex-col gap-6" style={docSurface}>
            <GenerateCreativesButton
              offerId={offer.id}
              initialStatus={creativesRun?.status ?? null}
              initialRunId={creativesRun?.id ?? null}
              hasCreatives={!!creatives}
            />
            {creatives ? (
              <CreativesDisplay payload={creatives.payload} />
            ) : (
              <p className="text-sm" style={{ color: '#6B6459' }}>
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
