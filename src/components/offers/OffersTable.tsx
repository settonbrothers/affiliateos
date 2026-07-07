'use client'

import Link from 'next/link'
import { useState } from 'react'
import { useTranslations } from 'next-intl'

import { verdictTier, verdictChipStyle, verdictDotColor } from '@/lib/offers/verdict-tier'
import { VERDICT_LABELS } from '@/types/agents/underwriting'
import type { Offer } from '@/types/db'

type FilterKey = 'all' | 'rec' | 'hot' | 'new'

function scoreColor(v: number): string {
  if (v >= 80) return 'var(--primary)'
  if (v >= 65) return '#FFFFFF'
  return '#6E6E6C'
}

const GRID = '40px minmax(120px,1.4fr) 96px 106px 150px 150px'

export function OffersTable({ offers }: { offers: Offer[] }) {
  const t = useTranslations('offers')
  const [filter, setFilter] = useState<FilterKey>('all')

  const isRising = (o: Offer) => (o as { trending_signal?: string }).trending_signal === 'rising'
  const scoreOf = (o: Offer) => o.evaluation?.payload?.weighted_score ?? null

  const passes = (o: Offer) => {
    if (filter === 'all') return true
    if (filter === 'rec') return (scoreOf(o) ?? 0) >= 80
    if (filter === 'hot') return isRising(o)
    return scoreOf(o) == null // 'new'
  }
  const list = offers.filter(passes)

  const filters: { key: FilterKey; label: string; dot?: boolean }[] = [
    { key: 'all', label: t('filterAll') },
    { key: 'rec', label: t('filterRecommended') },
    { key: 'hot', label: t('filterHot'), dot: true },
    { key: 'new', label: t('filterNew') },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 'clamp(18px,2vw,30px)',
          borderBottom: '1px solid var(--border)',
          marginBottom: '4px',
        }}
      >
        {filters.map((f) => {
          const active = filter === f.key
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              style={{
                position: 'relative',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '0 0 14px',
                fontSize: '14px',
                fontWeight: 600,
                color: active ? '#FFFFFF' : '#7A7A78',
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
              }}
            >
              {f.dot && <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--primary)' }} />}
              {f.label}
              {active && (
                <span style={{ position: 'absolute', insetInline: 0, bottom: '-1px', height: '2px', background: 'var(--primary)' }} />
              )}
            </button>
          )
        })}
      </div>

      {list.length === 0 ? (
        <div style={{ padding: '48px 0', textAlign: 'center' }}>
          <p style={{ fontSize: '13px', color: 'var(--muted-foreground)' }}>{t('empty')}</p>
        </div>
      ) : (
        <>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: GRID,
              alignItems: 'center',
              gap: '16px',
              padding: '16px 12px 12px',
              fontFamily: 'var(--font-mono)',
              fontSize: '9.5px',
              letterSpacing: '0.12em',
              color: '#5E5E5C',
            }}
          >
            <span>#</span>
            <span>{t('colName')}</span>
            <span>VERTICAL</span>
            <span>PAYOUT</span>
            <span>VERDICT</span>
            <span style={{ color: 'var(--accent-border)' }}>CRACK SCORE</span>
          </div>

          <div style={{ borderTop: '1px solid var(--border)' }}>
            {list.map((offer, i) => {
              const score = scoreOf(offer)
              const verdict = offer.evaluation?.payload?.verdict ?? null
              const tier = verdict ? verdictTier(verdict) : null
              const vertical = (offer as { vertical?: string }).vertical
              const websiteUrl = (offer as { website_url?: string | null }).website_url
              return (
                <Link
                  key={offer.id}
                  href={`/offers/${offer.id}`}
                  className="prow"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: GRID,
                    alignItems: 'center',
                    gap: '16px',
                    padding: '18px 12px',
                    borderBottom: '1px solid rgba(255,255,255,0.06)',
                    textDecoration: 'none',
                    color: 'inherit',
                  }}
                >
                  <span
                    className="pedge"
                    style={{
                      position: 'absolute',
                      insetInlineStart: 0,
                      top: '10px',
                      bottom: '10px',
                      width: '2px',
                      background: 'var(--primary)',
                      transform: 'scaleY(0)',
                      transformOrigin: 'center',
                      transition: 'transform 0.2s ease',
                    }}
                  />
                  <span dir="ltr" style={{ fontFamily: 'var(--font-mono)', fontSize: '13px', color: i === 0 ? 'var(--primary)' : '#5E5E5C', textAlign: 'right' }}>
                    {String(i + 1).padStart(2, '0')}
                  </span>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span dir="ltr" style={{ fontFamily: 'var(--font-display)', fontSize: '20px', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {offer.name}
                      </span>
                      {isRising(offer) && (
                        <span dir="ltr" style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '8.5px', letterSpacing: '0.06em', color: '#0A0A0A', background: 'var(--primary)', padding: '2px 6px' }}>▲ HOT</span>
                      )}
                      {score == null && (
                        <span dir="ltr" style={{ flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '8.5px', letterSpacing: '0.06em', color: 'var(--primary)', border: '1px solid var(--accent-border)', padding: '2px 6px' }}>NEW</span>
                      )}
                    </div>
                    {websiteUrl && (
                      <div dir="ltr" style={{ marginTop: '4px', fontFamily: 'var(--font-mono)', fontSize: '10.5px', color: '#6E6E6C', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'right' }}>
                        {websiteUrl}
                      </div>
                    )}
                  </div>

                  <span style={{ fontSize: '13px', color: '#9A9A98' }}>{vertical ?? '—'}</span>

                  <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '13px' }}>—</span>

                  {tier && verdict ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', justifySelf: 'start', fontSize: '12px', fontWeight: 600, padding: '5px 11px', whiteSpace: 'nowrap', ...verdictChipStyle(tier) }}>
                      <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: verdictDotColor(tier) }} />
                      {VERDICT_LABELS[verdict]}
                    </span>
                  ) : (
                    <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '13px' }}>—</span>
                  )}

                  <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: '3px' }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: '42px', fontWeight: 600, lineHeight: 0.8, color: score == null ? '#4E4E4C' : scoreColor(score) }}>
                      {score ?? '—'}
                    </span>
                    {score != null && <span style={{ fontFamily: 'var(--font-display)', fontSize: '14px', color: '#4E4E4C' }}>/100</span>}
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
