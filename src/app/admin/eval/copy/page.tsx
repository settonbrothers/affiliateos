import Link from 'next/link'
import type { SupabaseClient } from '@supabase/supabase-js'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { CopyEvalControls } from '@/components/admin/CopyEvalControls'
import { createClient } from '@/lib/supabase/server'

export default async function CopyEvalPage() {
  const db = (await createClient()) as SupabaseClient
  const [casesResult, runsResult] = await Promise.all([
    db
      .from('copy_eval_cases')
      .select('id', { count: 'exact', head: true })
      .like('external_id', 'copy-brain-v5:%'),
    db
      .from('copy_eval_runs')
      .select('id,status,engine_version,started_at,total_cost_usd')
      .order('started_at', { ascending: false })
      .limit(20),
  ])
  const setupError = casesResult.error ?? runsResult.error
  const caseCount = casesResult.count
  const runs = runsResult.data
  const runRows = (runs ?? []) as Array<{
    id: string
    status: string
    engine_version: string
    started_at: string
    total_cost_usd: number | string | null
  }>
  return (
    <div className="flex flex-col gap-6" dir="rtl">
      <AdminPageHeader
        title="COPY BRAIN EVAL LAB"
        subtitle="8 מבחנים חתומים · 48 jobs · 8 הכרעות A/B עיוורות"
      />
      <p className="text-sm text-[var(--color-muted-foreground)]">
        המקרים במעבדה: {caseCount ?? 0}/8. Fixtures מסומנים ואינם ניתנים לפרסום.
        הריצות אינן יוצרות offers ואינן מעדכנות Taste Corpus.
      </p>
      {setupError && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          המעבדה מותקנת בקוד אך טבלאות הניסוי עדיין לא הותקנו במסד הנתונים.
          הפעולות נעולות עד להחלת ה־migration המאושר.
        </div>
      )}
      <CopyEvalControls
        disabledReason={
          setupError ? 'ממתין להתקנת טבלאות הניסוי — אין כתיבה למסד הנתונים.' : null
        }
      />
      <div className="space-y-2">
        {runRows.map((run) => (
          <Link
            key={run.id}
            href={`/admin/eval/copy/${run.id}`}
            className="flex justify-between rounded border p-3 no-underline"
          >
            <span>
              {new Date(run.started_at).toLocaleString('he-IL')} ·{' '}
              {run.engine_version}
            </span>
            <span>
              {run.status} · ${Number(run.total_cost_usd ?? 0).toFixed(4)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}
