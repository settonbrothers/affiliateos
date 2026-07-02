type TrendingSignal = 'rising' | 'stable' | 'declining' | null | undefined

interface TrendingBadgeProps {
  signal: TrendingSignal
}

export function TrendingBadge({ signal }: TrendingBadgeProps) {
  if (!signal) return null

  const config = {
    rising: {
      label: '📈 עולה',
      className: 'inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800',
    },
    stable: {
      label: '📊 יציב',
      className: 'inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700',
    },
    declining: {
      label: '📉 יורד',
      className: 'inline-flex items-center rounded-full bg-orange-100 px-2.5 py-0.5 text-xs font-medium text-orange-800',
    },
  } as const

  const { label, className } = config[signal]

  return <span className={className}>{label}</span>
}
