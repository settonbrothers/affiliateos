import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { DeleteOfferButton } from '@/components/offers/DeleteOfferButton'
import { OfferFactsList } from '@/components/offers/OfferFactsList'
import { OfferStatusSelect } from '@/components/offers/OfferStatusSelect'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  OFFER_STATUS_BADGE_CLASS,
  OFFER_STATUS_LABELS,
} from '@/lib/offers/status'
import type { VerifiedFact } from '@/lib/queries/offers'
import type { Offer } from '@/types/db'

type Props = {
  offer: Offer
  operatorNotes: string | null
  isAdmin: boolean
  facts: VerifiedFact[]
}

export function OfferOverview({ offer, operatorNotes, isAdmin, facts }: Props) {
  const t = useTranslations('offers')
  const tc = useTranslations('common')
  const rows: Array<[string, string | null]> = [
    [t('website'), offer.website_url],
    [t('affiliateProgram'), offer.affiliate_program_url],
    [t('description'), offer.short_description],
  ]

  return (
    <div className="flex flex-col gap-6">
      <dl className="flex flex-col gap-3">
        <div className="flex items-center gap-4">
          <dt className="w-40 text-sm text-[var(--color-muted-foreground)]">
            {t('status')}
          </dt>
          <dd className="text-sm">
            {isAdmin ? (
              <OfferStatusSelect offerId={offer.id} status={offer.status} />
            ) : (
              <Badge className={OFFER_STATUS_BADGE_CLASS[offer.status]}>
                {OFFER_STATUS_LABELS[offer.status]}
              </Badge>
            )}
          </dd>
        </div>
        {rows.map(([label, value]) => (
          <div key={label} className="flex gap-4">
            <dt className="w-40 text-sm text-[var(--color-muted-foreground)]">
              {label}
            </dt>
            <dd className="text-sm break-words">{value ?? '—'}</dd>
          </div>
        ))}
        <div className="flex gap-4">
          <dt className="w-40 text-sm text-[var(--color-muted-foreground)]">
            {t('operatorNotes')}
          </dt>
          <dd className="text-sm whitespace-pre-wrap">
            {operatorNotes ?? (
              <span className="text-[var(--color-muted-foreground)]">—</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="border-t border-[var(--color-border)] pt-4">
        <h3 className="mb-2 text-sm font-medium">
          {t('verifiedFacts')} ({facts.length})
        </h3>
        <OfferFactsList facts={facts} />
      </div>

      <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-4">
        <Button asChild size="sm" variant="outline">
          <Link href={`/offers/${offer.id}/edit`}>{tc('edit')}</Link>
        </Button>
        {isAdmin && (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/admin/offers/${offer.id}/sources`}>
              {t('manageSources')}
            </Link>
          </Button>
        )}
        <div className="flex-1" />
        <DeleteOfferButton offerId={offer.id} offerName={offer.name} />
      </div>
    </div>
  )
}
