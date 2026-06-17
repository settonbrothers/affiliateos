import { getTranslations } from 'next-intl/server'
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
  const t = await getTranslations('discoveryAdmin')

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('evalTitle')}</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {t('evalSubtitle')}
          </p>
        </div>
        <Link href="/admin/eval/golden">
          <Button variant="outline">{t('manageGoldenSet')}</Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {t('evalEmpty')}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-start">
              <th className="py-2 font-medium">{t('colWhen')}</th>
              <th className="py-2 font-medium">{t('colPrompt')}</th>
              <th className="py-2 font-medium">{t('colTrigger')}</th>
              <th className="py-2 font-medium">{t('colTotal')}</th>
              <th className="py-2 font-medium">{t('colMatched')}</th>
              <th className="py-2 font-medium">{t('colAccuracy')}</th>
              <th className="py-2 font-medium">{t('colCost')}</th>
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
