import { Badge } from '@/components/ui/badge'
import type { DiagnosisResponse } from '@/types/agents/diagnosis'

const VERDICT_CLASS: Record<string, string> = {
  below: 'text-red-700',
  within: 'text-green-700',
  above: 'text-amber-700',
}

const METRIC_LABELS: Record<string, string> = {
  ctr: 'CTR %',
  cpc: 'CPC $',
  clickout_rate: 'Clickout %',
  cvr: 'CVR %',
  epc: 'EPC $',
}

export function DiagnosisView({ payload }: { payload: unknown }) {
  const env = payload as DiagnosisResponse | null
  const p = env?.payload
  if (!p) {
    return (
      <p className="text-sm text-red-600">
        Diagnosis payload is malformed — re-run it.
      </p>
    )
  }

  const metrics = Object.entries(p.metric_analysis) as Array<
    [string, { actual: number; expected: [number, number]; verdict: string }]
  >

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge>bottleneck: {p.primary_bottleneck}</Badge>
        <Badge>action: {p.recommended_action}</Badge>
        {p.not_enough_data && <Badge>not enough data</Badge>}
      </div>

      <p className="text-sm">{p.diagnosis_summary}</p>

      <div>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Metrics vs expected
        </h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="py-1 font-medium">Metric</th>
              <th className="py-1 font-medium">Actual</th>
              <th className="py-1 font-medium">Expected</th>
              <th className="py-1 font-medium">Read</th>
            </tr>
          </thead>
          <tbody>
            {metrics.map(([key, mtr]) => (
              <tr key={key} className="border-b border-[var(--color-border)]">
                <td className="py-1">{METRIC_LABELS[key] ?? key}</td>
                <td className="py-1 tabular-nums">{mtr.actual}</td>
                <td className="py-1 tabular-nums text-[var(--color-muted-foreground)]">
                  {mtr.expected[0]}–{mtr.expected[1]}
                </td>
                <td className={`py-1 ${VERDICT_CLASS[mtr.verdict] ?? ''}`}>
                  {mtr.verdict}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {p.specific_recommendations.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Recommendations
          </h3>
          <ul className="flex flex-col gap-2">
            {p.specific_recommendations.map((rec, i) => (
              <li key={i} className="text-sm">
                <span className="font-medium">{rec.area}:</span> {rec.action}
                <span className="block text-xs text-[var(--color-muted-foreground)]">
                  {rec.reasoning}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {p.not_enough_data && p.not_enough_data_reason && (
        <div className="rounded-md border border-yellow-600/50 bg-yellow-50 p-3 text-sm dark:bg-yellow-950/40">
          {p.not_enough_data_reason}
        </div>
      )}
    </div>
  )
}
