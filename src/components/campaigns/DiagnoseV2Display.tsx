import { Badge } from '@/components/ui/badge'

type HookType =
  | 'curiosity'
  | 'pain'
  | 'social_proof'
  | 'pattern_interrupt'
  | 'data'
  | 'story'
  | 'challenge'
  | 'benefit'
  | 'fear'
  | 'authority'

type CreativeAnalysisItem = {
  hook: string
  hook_type: HookType
  what_worked: string
  what_didnt: string
  is_winner: boolean
  winner_reason?: string
}

type DiagnoseV2Data = {
  creative_analysis: CreativeAnalysisItem[]
  overall_assessment: string
  next_campaign_recommendations: string[]
  winning_hooks: string[]
}

const HOOK_TYPE_LABELS: Record<HookType, string> = {
  curiosity: 'סקרנות',
  pain: 'כאב',
  social_proof: 'הוכחה חברתית',
  pattern_interrupt: 'שבירת דפוס',
  data: 'נתונים',
  story: 'סיפור',
  challenge: 'אתגר',
  benefit: 'תועלת',
  fear: 'פחד',
  authority: 'סמכות',
}

export function DiagnoseV2Display({
  creativeAnalysis,
  winningHooks,
  winnersAddedToLibrary,
}: {
  creativeAnalysis: unknown
  winningHooks: unknown
  winnersAddedToLibrary?: boolean | null
}) {
  const analysis = creativeAnalysis as DiagnoseV2Data | null

  if (!analysis || !Array.isArray(analysis.creative_analysis)) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        אין ניתוח קריאייטיב זמין עדיין.
      </p>
    )
  }

  const hooks = Array.isArray(winningHooks) ? (winningHooks as string[]) : []

  return (
    <div className="flex flex-col gap-6">
      {/* Overall assessment */}
      <div className="rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/30 p-4">
        <p className="text-sm">{analysis.overall_assessment}</p>
      </div>

      {/* Creative items */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          ניתוח קריאייטיבים
        </h3>
        {analysis.creative_analysis.map((item, i) => (
          <div
            key={i}
            className="rounded-md border border-[var(--color-border)] p-4 flex flex-col gap-3"
          >
            <div className="flex flex-wrap items-center gap-2">
              <Badge>
                {HOOK_TYPE_LABELS[item.hook_type] ?? item.hook_type}
              </Badge>
              {item.is_winner && (
                <Badge className="border-amber-400 bg-amber-500 text-white">
                  Winner
                </Badge>
              )}
            </div>
            <p className="text-sm font-medium">{item.hook}</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-md bg-green-50 p-3 dark:bg-green-950/30">
                <p className="mb-1 text-xs font-semibold text-green-700 dark:text-green-400">
                  מה עבד
                </p>
                <p className="text-sm text-green-800 dark:text-green-300">
                  {item.what_worked}
                </p>
              </div>
              <div className="rounded-md bg-red-50 p-3 dark:bg-red-950/30">
                <p className="mb-1 text-xs font-semibold text-red-700 dark:text-red-400">
                  מה לא עבד
                </p>
                <p className="text-sm text-red-800 dark:text-red-300">
                  {item.what_didnt}
                </p>
              </div>
            </div>
            {item.is_winner && item.winner_reason && (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                {item.winner_reason}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Winning hooks */}
      {hooks.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Winning Hooks
            </h3>
            {winnersAddedToLibrary && (
              <Badge className="text-xs">
                הוסף ל-Hook Library
              </Badge>
            )}
          </div>
          <ul className="flex flex-col gap-2">
            {hooks.map((hook, i) => (
              <li
                key={i}
                className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm dark:border-amber-800 dark:bg-amber-950/30"
              >
                {hook}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Next campaign recommendations */}
      {analysis.next_campaign_recommendations &&
        analysis.next_campaign_recommendations.length > 0 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              המלצות לקמפיין הבא
            </h3>
            <ol className="flex flex-col gap-2">
              {analysis.next_campaign_recommendations.map((rec, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span className="font-semibold text-[var(--color-muted-foreground)]">
                    {i + 1}.
                  </span>
                  {rec}
                </li>
              ))}
            </ol>
          </div>
        )}
    </div>
  )
}
