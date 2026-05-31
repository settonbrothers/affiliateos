import Link from 'next/link'
import { notFound } from 'next/navigation'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

type PerOfferResult = {
  golden_id: string
  external_id?: string | null
  offer_name: string
  expected_verdict: string
  actual_verdict?: string
  actual_weighted_score?: number
  verdict_match?: boolean
  input_tokens?: number
  output_tokens?: number
  cost_usd?: number
  error?: string
}

type EvalDetail = {
  id: string
  trigger_type: string
  total_offers: number
  matched_verdict_count: number
  accuracy_pct: number | string
  total_cost_usd: number | string | null
  details: {
    vertical?: string
    orchestrator?: string
    model?: string
    prompt_version?: string
    tokens_input?: number
    tokens_output?: number
    results?: PerOfferResult[]
  } | null
  started_at: string
  completed_at: string | null
  prompts: { id: string; orchestrator_name: string; version: string } | null
}

export default async function EvalDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data } = await supabase
    .from('eval_runs')
    .select(
      'id, trigger_type, total_offers, matched_verdict_count, accuracy_pct, total_cost_usd, details, started_at, completed_at, prompts(id, orchestrator_name, version)'
    )
    .eq('id', id)
    .maybeSingle()
    .returns<EvalDetail>()

  if (!data) notFound()

  const results = data.details?.results ?? []
  const accuracy =
    typeof data.accuracy_pct === 'string'
      ? Number(data.accuracy_pct)
      : data.accuracy_pct
  const cost =
    data.total_cost_usd === null
      ? null
      : typeof data.total_cost_usd === 'string'
        ? Number(data.total_cost_usd)
        : data.total_cost_usd

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/eval"
        className="text-sm text-[var(--color-muted-foreground)] underline"
      >
        ← Eval runs
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">
          {data.prompts
            ? `${data.prompts.orchestrator_name} · ${data.prompts.version}`
            : 'Eval run'}
        </h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {new Date(data.started_at).toLocaleString()} · {data.trigger_type} ·{' '}
          vertical {data.details?.vertical ?? '—'} · model{' '}
          {data.details?.model ?? '—'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Total" value={String(data.total_offers)} />
        <Stat
          label="Verdict matched"
          value={`${data.matched_verdict_count}/${data.total_offers}`}
        />
        <Stat label="Accuracy" value={`${accuracy.toFixed(1)}%`} />
        <Stat label="Cost" value={cost === null ? '—' : `$${cost.toFixed(4)}`} />
      </div>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Per-offer results</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left">
                  <th className="py-2 font-medium">Offer</th>
                  <th className="py-2 font-medium">Expected</th>
                  <th className="py-2 font-medium">Actual</th>
                  <th className="py-2 font-medium">Score</th>
                  <th className="py-2 font-medium">Match</th>
                  <th className="py-2 font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr
                    key={r.golden_id}
                    className="border-b border-[var(--color-border)] align-top"
                  >
                    <td className="py-2">
                      {r.external_id ? `${r.external_id} · ` : ''}
                      {r.offer_name}
                    </td>
                    <td className="py-2 text-[var(--color-muted-foreground)]">
                      {r.expected_verdict}
                    </td>
                    <td className="py-2">
                      {r.error ? (
                        <span className="text-red-600">{r.error}</span>
                      ) : (
                        r.actual_verdict ?? '—'
                      )}
                    </td>
                    <td className="py-2 text-[var(--color-muted-foreground)]">
                      {r.actual_weighted_score ?? '—'}
                    </td>
                    <td className="py-2">
                      {r.error ? (
                        <Badge>error</Badge>
                      ) : r.verdict_match ? (
                        <Badge>✓</Badge>
                      ) : (
                        <Badge>✗</Badge>
                      )}
                    </td>
                    <td className="py-2 text-[var(--color-muted-foreground)]">
                      {r.cost_usd !== undefined
                        ? `$${r.cost_usd.toFixed(4)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)] p-3">
      <div className="text-xs text-[var(--color-muted-foreground)]">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}
