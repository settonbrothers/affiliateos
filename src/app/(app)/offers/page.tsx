import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { OffersTable } from '@/components/offers/OffersTable'
import { listOffers, listVerticals } from '@/lib/queries/offers'

export default async function OffersPage() {
  const offers = await listOffers()
  const verticals = await listVerticals()
  const verticalNames = Object.fromEntries(verticals.map((v) => [v.id, v.name]))
  const t = await getTranslations('offers')

  const scoredCount = offers.filter((o) => o.evaluation?.payload?.weighted_score != null).length
  const hotCount = offers.filter((o) => (o as { trending_signal?: string }).trending_signal === 'rising').length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '24px', flexWrap: 'wrap', marginBottom: 'clamp(24px,3vw,38px)' }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.22em', color: 'var(--primary)', marginBottom: '12px' }}>
            TODAY&apos;S OPPORTUNITIES
          </div>
          <h1 style={{ margin: 0, fontSize: 'clamp(34px,5vw,56px)', fontWeight: 800, lineHeight: 0.95, letterSpacing: '-0.01em' }}>
            {t('title')}
          </h1>
          <div dir="ltr" style={{ marginTop: '14px', fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#7A7A78', display: 'flex', gap: '14px', justifyContent: 'flex-end' }}>
            <span><span style={{ color: '#C9C9C7' }}>{offers.length}</span> OFFERS</span>
            <span style={{ color: '#3A3A38' }}>·</span>
            <span><span style={{ color: 'var(--primary)' }}>{scoredCount}</span> SCORED</span>
            <span style={{ color: '#3A3A38' }}>·</span>
            <span><span style={{ color: 'var(--primary)' }}>{hotCount}</span> HOT</span>
          </div>
        </div>
        <Link href="/offers/new" style={{ fontFamily: 'var(--font-sans)', fontSize: '14px', fontWeight: 700, color: '#0A0A0A', background: 'var(--primary)', padding: '12px 22px', textDecoration: 'none', whiteSpace: 'nowrap' }}>
          {t('addOffer')} +
        </Link>
      </div>

      <OffersTable offers={offers} verticalNames={verticalNames} />
    </div>
  )
}
