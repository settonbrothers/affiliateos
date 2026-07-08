import { getTranslations } from 'next-intl/server'
import Link from 'next/link'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
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
  const t = await getTranslations('discoveryAdmin')

  return (
    <div className="flex flex-col gap-6">
      <AdminPageHeader
        title="AI RUNS"
        subtitle={t('aiRunsPage', { total, page: pageNum, pages: totalPages })}
      />

      <AiRunsTable rows={data ?? []} />

      <div className="flex gap-4 text-sm">
        {pageNum > 1 && (
          <Link href={`/admin/ai-runs?page=${pageNum - 1}`} className="underline">
            {t('newer')}
          </Link>
        )}
        {pageNum < totalPages && (
          <Link href={`/admin/ai-runs?page=${pageNum + 1}`} className="underline">
            {t('older')}
          </Link>
        )}
      </div>
    </div>
  )
}
