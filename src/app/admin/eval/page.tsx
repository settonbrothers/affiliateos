import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/server'

type EvalRow = {
  id: string
  trigger_type: string
  total_offers: number
  matched_verdict_count: number
  accuracy_pct: number | string
  total_cost_usd: number | string | null
  started_at: string
  completed_at: string | null
  prompts: { orchestrator_name: string; version: string } | null
}

function fmtAccuracy(n: number | string) {
  const x = typeof n === 'string' ? Number(n) : n
  return `${x.toFixed(1)}%`
}

function fmtCost(c: number | string | null) {
  if (c === null) return '—'
  const x = typeof c === 'string' ? Number(c) : c
  return `$${x.toFixed(4)}`
}

export default async function EvalListPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('eval_runs')
    .select(
      'id, trigger_type, total_offers, matched_verdict_count, accuracy_pct, total_cost_usd, started_at, completed_at, prompts(orchestrator_name, version)'
    )
    .order('started_at', { ascending: false })
    .limit(100)
    .returns<EvalRow[]>()

  const rows = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Eval runs</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Each row is one <code>pnpm eval:run</code> against the active prompt.
            Verdict accuracy is the primary metric (plan target ≥ 75%).
          </p>
        </div>
        <Link href="/admin/eval/golden">
          <Button variant="outline">Manage golden set</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No eval runs yet. Seed <code>golden_set_offers</code> via SQL, set
          <code> ANTHROPIC_API_KEY</code> in <code>.env.local</code>, then run{' '}
          <code>pnpm eval:run</code> from the repo root.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="py-2 font-medium">When</th>
              <th className="py-2 font-medium">Prompt</th>
              <th className="py-2 font-medium">Trigger</th>
              <th className="py-2 font-medium">Total</th>
              <th className="py-2 font-medium">Matched</th>
              <th className="py-2 font-medium">Accuracy</th>
              <th className="py-2 font-medium">Cost</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.id}
                className="border-b border-[var(--color-border)]"
              >
                <td className="py-2 text-[var(--color-muted-foreground)]">
                  <Link href={`/admin/eval/${r.id}`} className="underline">
                    {new Date(r.started_at).toLocaleString()}
                  </Link>
                </td>
                <td className="py-2">
                  {r.prompts
                    ? `${r.prompts.orchestrator_name} ${r.prompts.version}`
                    : '—'}
                </td>
                <td className="py-2 text-[var(--color-muted-foreground)]">
                  {r.trigger_type}
                </td>
                <td className="py-2 text-[var(--color-muted-foreground)]">
                  {r.total_offers}
                </td>
                <td className="py-2 text-[var(--color-muted-foreground)]">
                  {r.matched_verdict_count}
                </td>
                <td className="py-2">
                  <Badge>{fmtAccuracy(r.accuracy_pct)}</Badge>
                </td>
                <td className="py-2 text-[var(--color-muted-foreground)]">
                  {fmtCost(r.total_cost_usd)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
