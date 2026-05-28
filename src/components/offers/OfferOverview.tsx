import type { Offer } from '@/types/db'

export function OfferOverview({ offer }: { offer: Offer }) {
  const rows: Array<[string, string | null]> = [
    ['Status', offer.status],
    ['Website', offer.website_url],
    ['Affiliate program', offer.affiliate_program_url],
    ['Description', offer.short_description],
  ]

  return (
    <dl className="flex flex-col gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex gap-4">
          <dt className="w-40 text-sm text-[var(--color-muted-foreground)]">
            {label}
          </dt>
          <dd className="text-sm">{value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}
