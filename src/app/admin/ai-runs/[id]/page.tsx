import Link from 'next/link'
import { notFound } from 'next/navigation'

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

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
    </div>
  )
}
