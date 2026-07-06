import type { ScoreDimensions } from '@/types/agents/underwriting'

interface EvidenceBarsProps {
  scores: ScoreDimensions | null | undefined
  weightedScore: number | null | undefined
  size?: 'full' | 'mini'
}

const EVIDENCE_BARS = [
  { label: 'Demand',      key: 'demand',               invert: false },
  { label: 'Momentum',    key: 'scale_potential',       invert: false },
  { label: 'History',     key: 'data_confidence',       invert: false },
  { label: 'Competition', key: 'competition',           invert: false },
  { label: 'Fatigue',     key: 'creative_opportunity',  invert: true  },
] as const satisfies ReadonlyArray<{ label: string; key: keyof ScoreDimensions; invert: boolean }>

function verbalLabel(value: number): string {
  if (value >= 75) return 'High'
  if (value >= 50) return 'Strong'
  if (value >= 30) return 'Low'
  return 'Very Low'
}

export function EvidenceBars({ scores, weightedScore, size = 'full' }: EvidenceBarsProps) {
  const isMini = size === 'mini'

  if (!scores || weightedScore == null) {
    return (
      <p style={{ fontSize: '13px', color: 'var(--muted-foreground)', padding: '8px 0' }}>
        Run an analysis to see the Crack Score.
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isMini ? '12px' : '20px' }}>
      {/* Score number */}
      <div>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--muted-foreground)',
            marginBottom: '4px',
          }}
        >
          Crack Score
        </div>
        <div
          style={{
            fontSize: isMini ? '32px' : '64px',
            fontWeight: 800,
            lineHeight: 1,
            color: 'var(--primary)',
          }}
        >
          {weightedScore}
        </div>
      </div>

      {/* Evidence bars */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div
          style={{
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.07em',
            textTransform: 'uppercase',
            color: 'var(--muted-foreground)',
            marginBottom: '2px',
          }}
        >
          Here&apos;s the evidence:
        </div>

        {EVIDENCE_BARS.map(({ label, key, invert }) => {
          const raw = scores[key]
          const value = invert ? 100 - raw : raw

          return (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Dimension name */}
              <span
                style={{
                  width: '88px',
                  fontSize: '11px',
                  color: 'var(--muted-foreground)',
                  flexShrink: 0,
                }}
              >
                {label}
              </span>

              {/* Bar track */}
              <div
                style={{
                  flex: 1,
                  height: '4px',
                  borderRadius: '2px',
                  background: 'rgba(255,255,255,0.06)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${value}%`,
                    height: '100%',
                    borderRadius: '2px',
                    background: 'rgba(255,255,255,0.20)',
                    transition: 'var(--transition)',
                  }}
                />
              </div>

              {/* Verbal label */}
              <span
                style={{
                  width: '60px',
                  fontSize: '11px',
                  color: 'var(--muted-foreground)',
                  textAlign: 'right',
                  flexShrink: 0,
                }}
              >
                {verbalLabel(value)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
