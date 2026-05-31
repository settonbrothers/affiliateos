import Link from 'next/link'

import { AiRunsTable, type AdminAiRunRow } from '@/components/admin/AiRunsTable'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 50

export default async function AdminAiRunsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page } = await searchParams
  const pageNum = Math.max(1, Number(page) || 1)
  const from = (pageNum - 1) * PAGE_SIZE
  const to = from + PAGE_SIZE - 1

  const supabase = await createClient()
  const { data, count } = await supabase
    .from('ai_runs')
    .select(
      'id, orchestrator_name, status, estimated_cost, started_at, completed_at, created_at, profiles(email), offers(name)',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to)
    .returns<AdminAiRunRow[]>()

  const total = count ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">AI Runs</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          {total} total · page {pageNum} of {totalPages}
        </p>
      </div>

      <AiRunsTable rows={data ?? []} />

      <div className="flex gap-4 text-sm">
        {pageNum > 1 && (
          <Link href={`/admin/ai-runs?page=${pageNum - 1}`} className="underline">
            ← Newer
          </Link>
        )}
        {pageNum < totalPages && (
          <Link href={`/admin/ai-runs?page=${pageNum + 1}`} className="underline">
            Older →
          </Link>
        )}
      </div>
    </div>
  )
}
