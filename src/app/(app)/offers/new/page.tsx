import { getTranslations } from 'next-intl/server'

import { OfferForm } from '@/components/offers/OfferForm'
import { listVerticals } from '@/lib/queries/offers'

export default async function NewOfferPage() {
  const verticals = await listVerticals()
  const t = await getTranslations('offers')

  return (
    <div style={{ maxWidth: '780px', width: '100%', margin: '0 auto' }}>
      <div
        dir="ltr"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.1em',
          color: '#A2A2A0',
          marginBottom: '20px',
        }}
      >
        ‹ AI PICKS&nbsp;<span style={{ color: '#767674' }}>/</span>&nbsp;
        <span style={{ color: '#B0B0AE' }}>NEW OFFER</span>
      </div>

      <div
        dir="ltr"
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          letterSpacing: '0.22em',
          color: 'var(--primary)',
          marginBottom: '14px',
        }}
      >
        ADD OFFER
      </div>
      <h1
        style={{
          margin: '0 0 8px',
          fontFamily: 'var(--font-sans)',
          fontSize: 'clamp(34px,5vw,56px)',
          fontWeight: 800,
          lineHeight: 0.95,
        }}
      >
        {t('newTitle')}
      </h1>
      <p style={{ margin: '0 0 36px', fontSize: '14px', color: 'var(--muted-foreground)' }}>
        {t('newSubtitle')}
      </p>

      <OfferForm verticals={verticals} mode={{ kind: 'create' }} />
    </div>
  )
}
