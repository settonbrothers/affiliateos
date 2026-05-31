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

const BLOCKING_FINDINGS = new Set([
  'income_promise',
  'invented_fact',
  'compliance_violation',
])

export default async function AdminAiRunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data: run } = await supabase
    .from('ai_runs')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!run) notFound()

  const { data: judgements } = await supabase
    .from('judge_results')
    .select('id, findings, reasoning, judge_model, judge_cost_usd, created_at')
    .eq('ai_run_id', id)
    .order('created_at', { ascending: false })

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/ai-runs"
        className="text-sm text-[var(--color-muted-foreground)] underline"
      >
        ← AI Runs
      </Link>

      <div>
        <h1 className="text-2xl font-semibold">{run.orchestrator_name}</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {new Date(run.created_at).toLocaleString()} · {run.status}
          {run.model ? ` · ${run.model}` : ''}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Input</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded bg-[var(--color-muted)] p-3 text-xs">
            {JSON.stringify(run.input_payload, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Output</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="overflow-auto rounded bg-[var(--color-muted)] p-3 text-xs">
            {JSON.stringify(run.output_payload, null, 2)}
          </pre>
        </CardContent>
      </Card>

      {run.error_message && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-red-600">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded bg-[var(--color-muted)] p-3 text-xs">
              {run.error_message}
            </pre>
          </CardContent>
        </Card>
      )}

      {judgements && judgements.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">LLM-as-judge</CardTitle>
          </CardHeader>
          <CardContent>
            {judgements.map((j) => {
              const findings = (j.findings ?? []) as string[]
              const hasBlocking = findings.some((f) => BLOCKING_FINDINGS.has(f))
              return (
                <div
                  key={j.id}
                  className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3 first:border-t-0 first:pt-0"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    {findings.map((f) => (
                      <Badge
                        key={f}
                        className={
                          hasBlocking && BLOCKING_FINDINGS.has(f)
                            ? 'border-red-600/60 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300'
                            : ''
                        }
                      >
                        {f}
                      </Badge>
                    ))}
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      {j.judge_model} · ${Number(j.judge_cost_usd ?? 0).toFixed(6)} ·{' '}
                      {new Date(j.created_at).toLocaleString()}
                    </span>
                  </div>
                  {j.reasoning && (
                    <p className="text-sm text-[var(--color-muted-foreground)]">
                      {j.reasoning}
                    </p>
                  )}
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
