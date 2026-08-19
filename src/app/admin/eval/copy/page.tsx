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
      <Link
        href="/admin/eval/copy/readiness"
        className="group grid gap-4 border border-[#f4bd21]/35 bg-[#f4bd21]/[0.045] p-5 no-underline transition-colors hover:bg-[#f4bd21]/[0.075] md:grid-cols-[1fr_auto] md:items-center"
      >
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#f4bd21]">
            Ready for inspection · $0.00
          </div>
          <h2 className="mt-2 text-lg font-semibold text-white">
            תיק Jasper המתוקן מוכן לבדיקה לפני ריצת AI
          </h2>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            מוצר, קהל, מטרה, 7 מקורות, אווטאר עמוק, גבולות אמת ו־trace של התורה
            שתגיע לסוכנים.
          </p>
        </div>
        <span className="font-mono text-xs text-[#f4bd21] transition-transform group-hover:-translate-x-1">
          פתיחת התיק ←
        </span>
      </Link>
      {setupError && (
        <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          המעבדה מותקנת בקוד אך טבלאות הניסוי עדיין לא הותקנו במסד הנתונים.
          הפעולות נעולות עד להחלת ה־migration המאושר.
        </div>
      )}
      <CopyEvalControls
        disabledReason={
          setupError
            ? 'ממתין להתקנת טבלאות הניסוי — אין כתיבה למסד הנתונים.'
            : null
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
