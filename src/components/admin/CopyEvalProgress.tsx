export function CopyEvalProgress({
  completed,
  failed,
  total,
  active,
}: {
  completed: number
  failed: number
  total: number
  active: boolean
}) {
  const safeTotal = Math.max(1, total)
  const completedPercent = Math.min(100, (completed / safeTotal) * 100)
  const stoppedPercent = Math.min(
    100 - completedPercent,
    (failed / safeTotal) * 100
  )

  return (
    <section className="space-y-2" aria-label="התקדמות ריצת הקופי">
      <div className="flex items-center justify-between text-sm">
        <span>התקדמות</span>
        <span className="text-[var(--color-muted-foreground)]">
          {completed}/{total} תוצרים שמורים
        </span>
      </div>
      <div
        className="flex h-3 overflow-hidden rounded-full bg-[var(--color-muted)]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={completed}
      >
        <div
          className={`bg-emerald-500 transition-all duration-700 ${active ? 'animate-pulse' : ''}`}
          style={{ width: `${completedPercent}%` }}
        />
        <div
          className="bg-amber-300 transition-all duration-700"
          style={{ width: `${stoppedPercent}%` }}
        />
      </div>
      <div className="flex gap-4 text-xs text-[var(--color-muted-foreground)]">
        <span>ירוק: הושלם ונשמר</span>
        {failed > 0 && <span>צהוב: נעצר וניתן להמשך ממוקד</span>}
      </div>
    </section>
  )
}
