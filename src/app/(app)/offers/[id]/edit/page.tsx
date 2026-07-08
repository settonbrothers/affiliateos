import { getTranslations } from 'next-intl/server'
import { notFound } from 'next/navigation'

import { OfferForm } from '@/components/offers/OfferForm'
import { getOfferById, listVerticals } from '@/lib/queries/offers'

export default async function EditOfferPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const offer = await getOfferById(id)
  if (!offer) notFound()

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
        <span style={{ color: '#9A9A98' }}>{offer.name.toUpperCase()}</span>&nbsp;
        <span style={{ color: '#767674' }}>/</span>&nbsp;
        <span style={{ color: '#B0B0AE' }}>EDIT</span>
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
        EDIT OFFER
      </div>
      <h1
        style={{
          margin: '0 0 36px',
          fontFamily: 'var(--font-sans)',
          fontSize: 'clamp(34px,5vw,56px)',
          fontWeight: 800,
          lineHeight: 0.95,
        }}
      >
        {t('editTitle')}
      </h1>

      <OfferForm
        verticals={verticals}
        mode={{ kind: 'edit', offerId: id }}
        initial={{
          name: offer.name,
          vertical_id: offer.vertical_id,
          website_url: offer.website_url ?? '',
          affiliate_program_url: offer.affiliate_program_url ?? '',
          operator_notes: offer.operator_notes ?? '',
        }}
      />
    </div>
  )
}
