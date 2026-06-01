import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AnalyzeButton } from '@/components/offers/AnalyzeButton'
import { OfferOverview } from '@/components/offers/OfferOverview'
import { OfferScorecard } from '@/components/offers/OfferScorecard'
import { OfferVerdict } from '@/components/offers/OfferVerdict'
import { getLatestRun, getOfferById } from '@/lib/queries/offers'
import { cn } from '@/lib/utils'

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'scorecard', label: 'Scorecard' },
  { key: 'verdict', label: 'Verdict' },
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
    tab === 'scorecard' || tab === 'verdict' ? tab : 'overview'

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
        <AnalyzeButton offerId={offer.id} initialStatus={run?.status ?? null} />
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
    </div>
  )
}
