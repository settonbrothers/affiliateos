type TrendingSignal = 'rising' | 'stable' | 'declining' | null | undefined

interface TrendingBadgeProps {
  signal: TrendingSignal
}

const LABELS: Record<NonNullable<TrendingSignal>, string> = {
  rising:   '↑ Rising',
  stable:   '→ Stable',
  declining: '↓ Declining',
}

export function TrendingBadge({ signal }: TrendingBadgeProps) {
  if (!signal) return null

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: '0',
        background: 'rgba(255,255,255,0.07)',
        padding: '3px 10px',
        fontSize: '10px',
        fontWeight: 600,
        color: 'var(--muted-foreground)',
        letterSpacing: '0.04em',
      }}
    >
      {LABELS[signal]}
    </span>
  )
}
