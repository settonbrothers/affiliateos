import type { FunnelCounts } from '@/lib/discovery/funnel'

export function FunnelBar({ counts }: { counts: FunnelCounts }) {
  const stages: Array<[string, number]> = [
    ['Discovered', counts.discovered],
    ['Passed triage', counts.triaged],
    ['Deep-analyzed', counts.analyzed],
    ['Approved', counts.approved],
  ]
  return (
    <div className="flex flex-wrap gap-3">
      {stages.map(([label, n]) => (
        <div
          key={label}
          className="flex min-w-28 flex-col rounded-md border border-[var(--color-border)] p-3"
        >
          <span className="text-2xl font-semibold">{n}</span>
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
