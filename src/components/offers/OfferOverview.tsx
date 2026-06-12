import Link from 'next/link'

import { DeleteOfferButton } from '@/components/offers/DeleteOfferButton'
import { Button } from '@/components/ui/button'
import type { Offer } from '@/types/db'

type Props = {
  offer: Offer
  operatorNotes: string | null
  isAdmin: boolean
}

export function OfferOverview({ offer, operatorNotes, isAdmin }: Props) {
  const rows: Array<[string, string | null]> = [
    ['Status', offer.status],
    ['Website', offer.website_url],
    ['Affiliate program', offer.affiliate_program_url],
    ['Description', offer.short_description],
  ]

  return (
    <div className="flex flex-col gap-6">
      <dl className="flex flex-col gap-3">
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
            Operator notes
          </dt>
          <dd className="text-sm whitespace-pre-wrap">
            {operatorNotes ?? (
              <span className="text-[var(--color-muted-foreground)]">—</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="flex items-center gap-3 border-t border-[var(--color-border)] pt-4">
        <Button asChild size="sm" variant="outline">
          <Link href={`/offers/${offer.id}/edit`}>Edit</Link>
        </Button>
        {isAdmin && (
          <Button asChild size="sm" variant="ghost">
            <Link href={`/admin/offers/${offer.id}/sources`}>
              Manage sources
            </Link>
          </Button>
        )}
        <div className="flex-1" />
        <DeleteOfferButton offerId={offer.id} offerName={offer.name} />
      </div>
    </div>
  )
}
