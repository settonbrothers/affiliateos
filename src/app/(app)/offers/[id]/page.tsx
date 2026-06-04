import Link from 'next/link'
import { notFound } from 'next/navigation'

import { CreateCampaignButton } from '@/components/campaigns/CreateCampaignButton'
import { AnalyzeButton } from '@/components/offers/AnalyzeButton'
import { GenerateTestKitButton } from '@/components/offers/GenerateTestKitButton'
import { OfferOverview } from '@/components/offers/OfferOverview'
import { OfferScorecard } from '@/components/offers/OfferScorecard'
import { OfferVerdict } from '@/components/offers/OfferVerdict'
import { TestKitView } from '@/components/offers/TestKitView'
import { isCurrentUserAdmin } from '@/lib/auth/role'
import {
  getLatestRun,
  getLatestRunByOrchestrator,
  getLatestTestKit,
  getOfferById,
  hasSuccessfulUnderwriting,
} from '@/lib/queries/offers'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'scorecard', label: 'Scorecard' },
  { key: 'verdict', label: 'Verdict' },
  { key: 'test-kit', label: 'Test Kit' },
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

  const run = await getLatestRun(id)
  const evaluation = run?.output_payload ?? offer.evaluation
  const activeTab =
    tab === 'scorecard' || tab === 'verdict' || tab === 'test-kit'
      ? tab
      : 'overview'
  const isAdmin = await isCurrentUserAdmin()

  // Test-kit tab needs its own data — only fetch when that tab is active.
  const testKit =
    activeTab === 'test-kit' ? await getLatestTestKit(id) : null
  const testKitRun =
    activeTab === 'test-kit'
      ? await getLatestRunByOrchestrator(id, 'TestKitOrchestrator')
      : null
  const hasVerdict =
    activeTab === 'test-kit' ? await hasSuccessfulUnderwriting(id) : false

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
              Manage sources
            </Link>
          )}
          <AnalyzeButton offerId={offer.id} initialStatus={run?.status ?? null} />
        </div>
      </div>

      <nav className="flex gap-2 border-b border-[var(--color-border)]">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/offers/${offer.id}?tab=${t.key}`}
            className={cn(
              'px-3 py-2 text-sm',
              activeTab === t.key
                ? 'border-b-2 border-[var(--color-foreground)] font-medium'
                : 'text-[var(--color-muted-foreground)]'
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      {activeTab === 'overview' && (
        <OfferOverview offer={offer} operatorNotes={offer.operator_notes} />
      )}
      {activeTab === 'scorecard' && <OfferScorecard evaluation={evaluation} />}
      {activeTab === 'verdict' && <OfferVerdict evaluation={evaluation} />}
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
              <TestKitView payload={testKit.payload} />
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
    </div>
  )
}
