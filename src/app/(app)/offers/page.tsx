import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { OffersTable } from '@/components/offers/OffersTable'
import { Button } from '@/components/ui/button'
import { listOffers } from '@/lib/queries/offers'

export default async function OffersPage() {
  const offers = await listOffers()
  const t = await getTranslations('offers')

  const analyzedCount = offers.filter(
    (o) => o.evaluation?.payload?.weighted_score != null
  ).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1
            style={{
              fontSize: '22px',
              fontWeight: 600,
              color: 'var(--foreground)',
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            {t('title')}
          </h1>
          <p
            style={{
              fontSize: '12px',
              color: 'var(--muted-foreground)',
              marginTop: '6px',
            }}
          >
            {offers.length} offers
            {analyzedCount > 0 && (
              <> · <span style={{ color: 'var(--primary)' }}>{analyzedCount} scored</span></>
            )}
          </p>
        </div>
        <Button asChild>
          <Link href="/offers/new">{t('addOffer')}</Link>
        </Button>
      </div>

      {/* Table card */}
      <div
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          boxShadow: 'var(--shadow)',
          padding: '0 24px',
        }}
      >
        <OffersTable offers={offers} />
      </div>
    </div>
  )
}
