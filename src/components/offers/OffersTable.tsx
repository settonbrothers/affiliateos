import { useTranslations } from 'next-intl'
import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import {
  OFFER_STATUS_BADGE_CLASS,
  OFFER_STATUS_LABELS,
} from '@/lib/offers/status'
import type { Offer } from '@/types/db'

export function OffersTable({ offers }: { offers: Offer[] }) {
  const t = useTranslations('offers')
  if (offers.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        {t('empty')}
      </p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--color-border)] text-start">
          <th className="py-2 font-medium">{t('colName')}</th>
          <th className="py-2 font-medium">{t('colStatus')}</th>
          <th className="py-2 font-medium">{t('colCreated')}</th>
        </tr>
      </thead>
      <tbody>
        {offers.map((offer) => (
          <tr key={offer.id} className="border-b border-[var(--color-border)]">
            <td className="py-2">
              <Link href={`/offers/${offer.id}`} className="underline">
                {offer.name}
              </Link>
            </td>
            <td className="py-2">
              <Badge className={OFFER_STATUS_BADGE_CLASS[offer.status]}>
                {OFFER_STATUS_LABELS[offer.status]}
              </Badge>
            </td>
            <td className="py-2 text-[var(--color-muted-foreground)]">
              {new Date(offer.created_at).toLocaleDateString()}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
