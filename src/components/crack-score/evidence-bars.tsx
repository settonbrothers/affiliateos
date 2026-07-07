'use client'

import { useTranslations } from 'next-intl'

import {
  SCORE_DIMENSION_LABELS,
  type ScoreDimensions,
} from '@/types/agents/underwriting'

interface EvidenceBarsProps {
  scores: ScoreDimensions | null | undefined
  weightedScore: number | null | undefined
  size?: 'full' | 'mini'
}

// Render order = SCORE_DIMENSION_LABELS key order (13 dims).
const DIM_KEYS = Object.keys(SCORE_DIMENSION_LABELS) as (keyof ScoreDimensions)[]

function scoreColor(v: number): string {
  if (v >= 80) return 'var(--primary)'
  if (v >= 65) return '#FFFFFF'
  return '#A2A2A0'
}

export function EvidenceBars({ scores, weightedScore, size = 'full' }: EvidenceBarsProps) {
  const t = useTranslations('dimensions')
  const isMini = size === 'mini'

  if (!scores || weightedScore == null) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', padding: '8px 0' }}>
        Run an analysis to see the Crack Score.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMini ? '16px' : '24px' }}>
      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.22em',
            textTransform: 'uppercase',
            color: 'var(--muted-foreground)',
            marginBottom: '4px',
          }}
        >
          Crack Score
        </div>
        <div dir="ltr" style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
          <span
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: isMini ? '44px' : 'clamp(64px,8vw,110px)',
              fontWeight: 600,
              lineHeight: 0.8,
              letterSpacing: '-0.01em',
              color: scoreColor(weightedScore),
            }}
          >
            {weightedScore}
          </span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: isMini ? '16px' : '28px', color: '#828280' }}>
            /100
          </span>
        </div>
      </div>

      <div>
        <div
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '11px',
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            color: 'var(--muted-foreground)',
            marginBottom: '16px',
          }}
        >
          THE EVIDENCE · 13 DIMENSIONS
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMini ? '1fr' : '1fr 1fr',
            gap: '12px 26px',
          }}
        >
          {DIM_KEYS.map((key) => {
            const v = scores[key]
            const strong = v >= 80
            return (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: '96px',
                    fontSize: '11.5px',
                    color: strong ? 'var(--text-secondary)' : 'var(--muted-foreground)',
                    flexShrink: 0,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {t(key)}
                </span>
                <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.16)', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${v}%`,
                      height: '100%',
                      background: strong ? 'var(--primary)' : '#828280',
                      transition: 'var(--transition)',
                    }}
                  />
                </div>
                <span
                  dir="ltr"
                  style={{
                    width: '26px',
                    textAlign: 'left',
                    fontFamily: 'var(--font-mono)',
                    fontSize: '11px',
                    color: strong ? 'var(--primary)' : 'var(--muted-foreground)',
                    flexShrink: 0,
                  }}
                >
                  {v}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
