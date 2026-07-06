'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'

import type { Offer } from '@/types/db'

function CrackScoreCell({ offer }: { offer: Offer }) {
  const score = offer.evaluation?.payload?.weighted_score

  if (score == null) {
    return (
      <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '13px' }}>—</span>
    )
  }

  const isHigh = score >= 88
  const isMid = score >= 60

  return (
    <span
      style={{
        fontSize: '14px',
        fontWeight: isHigh ? 700 : isMid ? 600 : 400,
        color: isHigh ? 'var(--primary)' : 'var(--muted-foreground)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {score}
    </span>
  )
}

const HEADER_STYLE: React.CSSProperties = {
  padding: '14px 0',
  fontWeight: 500,
  color: 'var(--muted-foreground)',
  fontSize: '10px',
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const DASH_STYLE: React.CSSProperties = {
  color: 'rgba(255,255,255,0.18)',
  fontSize: '13px',
}

export function OffersTable({ offers }: { offers: Offer[] }) {
  const t = useTranslations('offers')

  if (offers.length === 0) {
    return (
      <div style={{ padding: '48px 0', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>
          {t('empty')}
        </p>
      </div>
    )
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
      <thead>
        <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
          <th style={{ ...HEADER_STYLE, paddingRight: '24px', width: '45%' }}>{t('colName')}</th>
          <th style={{ ...HEADER_STYLE, paddingRight: '24px', width: '18%' }}>Crack Score</th>
          <th style={{ ...HEADER_STYLE, paddingRight: '24px', width: '18%' }}>Payout</th>
          <th style={{ ...HEADER_STYLE, width: '19%' }}>Heat Index</th>
        </tr>
      </thead>
      <tbody>
        {offers.map((offer) => {
          const heatIndex = (offer as { trending_signal?: string }).trending_signal

          return (
            <tr
              key={offer.id}
              className="hover:bg-[rgba(255,255,255,0.02)]"
              style={{ borderBottom: '1px solid var(--border)', transition: 'var(--transition)' }}
            >
              {/* Offer name */}
              <td style={{ padding: '18px 24px 18px 0' }}>
                <Link
                  href={`/offers/${offer.id}`}
                  style={{
                    color: 'var(--foreground)',
                    textDecoration: 'none',
                    fontWeight: 500,
                    fontSize: '13px',
                  }}
                  className="hover:text-[var(--primary)]"
                >
                  {offer.name}
                </Link>
              </td>

              {/* Crack Score */}
              <td style={{ padding: '18px 24px 18px 0' }}>
                <CrackScoreCell offer={offer} />
              </td>

              {/* Payout */}
              <td style={{ padding: '18px 24px 18px 0' }}>
                <span style={DASH_STYLE}>—</span>
              </td>

              {/* Heat Index */}
              <td style={{ padding: '18px 0' }}>
                {heatIndex ? (
                  <span style={{ color: 'var(--text-secondary)', fontSize: '13px' }}>{heatIndex}</span>
                ) : (
                  <span style={DASH_STYLE}>—</span>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
