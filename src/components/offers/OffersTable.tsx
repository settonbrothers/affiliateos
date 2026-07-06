'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import type { Offer } from '@/types/db'

function CrackScoreCell({ offer }: { offer: Offer }) {
  const score = offer.evaluation?.payload?.weighted_score

  if (score == null) {
    return (
      <span style={{ color: 'var(--muted-foreground)', fontSize: '13px' }}>—</span>
    )
  }

  const isHigh = score >= 88
  const isMid = score >= 60

  return (
    <span
      style={{
        fontSize: '13px',
        fontWeight: isHigh ? 700 : isMid ? 600 : 400,
        color: isHigh ? 'var(--primary)' : 'var(--muted-foreground)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {score}
    </span>
  )
}

export function OffersTable({ offers }: { offers: Offer[] }) {
  const t = useTranslations('offers')

  if (offers.length === 0) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
        {t('empty')}
      </p>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr
          style={{
            borderBottom: '1px solid var(--border)',
            textAlign: 'left',
          }}
        >
          <th style={{ padding: '10px 0', fontWeight: 500, color: 'var(--muted-foreground)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            {t('colName')}
          </th>
          <th style={{ padding: '10px 0', fontWeight: 500, color: 'var(--muted-foreground)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Crack Score
          </th>
          <th style={{ padding: '10px 0', fontWeight: 500, color: 'var(--muted-foreground)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Payout
          </th>
          <th style={{ padding: '10px 0', fontWeight: 500, color: 'var(--muted-foreground)', fontSize: '11px', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Heat Index
          </th>
        </tr>
      </thead>
      <tbody>
        {offers.map((offer) => {
          const heatIndex = (offer as { trending_signal?: string }).trending_signal

          return (
            <tr
              key={offer.id}
              style={{
                borderBottom: '1px solid var(--border)',
                minHeight: '56px',
              }}
            >
              {/* Offer name */}
              <td style={{ padding: '16px 0', paddingRight: '24px' }}>
                <Link
                  href={`/offers/${offer.id}`}
                  style={{
                    color: 'var(--foreground)',
                    textDecoration: 'none',
                    fontWeight: 500,
                    transition: 'var(--transition)',
                  }}
                >
                  {offer.name}
                </Link>
              </td>

              {/* Crack Score */}
              <td style={{ padding: '16px 0', paddingRight: '24px' }}>
                <CrackScoreCell offer={offer} />
              </td>

              {/* Payout — manual entry only */}
              <td style={{ padding: '16px 0', paddingRight: '24px', color: 'var(--muted-foreground)' }}>
                —
              </td>

              {/* Heat Index */}
              <td style={{ padding: '16px 0', color: 'var(--muted-foreground)' }}>
                {heatIndex ?? '—'}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
