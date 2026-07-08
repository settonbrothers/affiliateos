import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminRow, AdminTable } from '@/components/admin/AdminTable'
import { createClient } from '@/lib/supabase/server'

const COLS = '130px minmax(0,1fr) 90px 70px 80px 90px 90px'
const mono = (color: string) =>
  ({ fontFamily: 'var(--font-mono)', fontSize: '12px', color, textAlign: 'right' as const })

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
      <AdminPageHeader title="EVALS" subtitle={t('evalSubtitle')} />

      <div>
        <Link
          href="/admin/eval/golden"
          style={{ fontFamily: 'var(--font-sans)', fontSize: '13px', color: '#B0B0AE', border: '1px solid rgba(255,255,255,0.16)', padding: '9px 16px', textDecoration: 'none' }}
        >
          {t('manageGoldenSet')} ←
        </Link>
      </div>

      {rows.length === 0 ? (
        <p style={{ fontSize: '14px', color: 'var(--muted-foreground)' }}>{t('evalEmpty')}</p>
      ) : (
        <AdminTable
          cols={COLS}
          columns={[
            { label: 'WHEN', ltr: true },
            { label: 'PROMPT', ltr: true },
            { label: 'TRIGGER', ltr: true },
            { label: 'TOTAL', ltr: true },
            { label: 'MATCHED', ltr: true },
            { label: 'ACCURACY', ltr: true },
            { label: 'COST', ltr: true },
          ]}
        >
          {rows.map((r) => (
            <AdminRow key={r.id} cols={COLS} href={`/admin/eval/${r.id}`}>
              <span dir="ltr" style={mono('#7A7A78')}>{new Date(r.started_at).toLocaleDateString()}</span>
              <span dir="ltr" style={mono('#E4E4E2')}>
                {r.prompts ? `${r.prompts.orchestrator_name} ${r.prompts.version}` : '—'}
              </span>
              <span dir="ltr" style={mono('#8A8A88')}>{r.trigger_type}</span>
              <span dir="ltr" style={mono('#8A8A88')}>{r.total_offers}</span>
              <span dir="ltr" style={mono('#8A8A88')}>{r.matched_verdict_count}</span>
              <span dir="ltr" style={{ ...mono('var(--primary)'), fontWeight: 600 }}>{fmtAccuracy(r.accuracy_pct)}</span>
              <span dir="ltr" style={mono('#C9C9C7')}>{fmtCost(r.total_cost_usd)}</span>
            </AdminRow>
          ))}
        </AdminTable>
      )}
    </div>
  )
}
