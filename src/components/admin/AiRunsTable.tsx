import Link from 'next/link'

import { Badge } from '@/components/ui/badge'

export type AdminAiRunRow = {
  id: string
  orchestrator_name: string
  status: string
  estimated_cost: string | number | null
  started_at: string
  completed_at: string | null
  created_at: string
  profiles: { email: string } | null
  offers: { name: string } | null
}

function formatLatency(started: string, completed: string | null) {
  if (!completed) return '—'
  const ms = new Date(completed).getTime() - new Date(started).getTime()
  return ms < 1000 ? `${ms}ms` : `${(ms / 1000).toFixed(1)}s`
}

function formatCost(c: string | number | null) {
  if (c === null || c === undefined) return '—'
  const n = typeof c === 'string' ? Number(c) : c
  return `$${n.toFixed(4)}`
}

export function AiRunsTable({ rows }: { rows: AdminAiRunRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No AI runs yet.
      </p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--color-border)] text-left">
          <th className="py-2 font-medium">Created</th>
          <th className="py-2 font-medium">User</th>
          <th className="py-2 font-medium">Offer</th>
          <th className="py-2 font-medium">Orchestrator</th>
          <th className="py-2 font-medium">Status</th>
          <th className="py-2 font-medium">Cost</th>
          <th className="py-2 font-medium">Latency</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="border-b border-[var(--color-border)]">
            <td className="py-2 text-[var(--color-muted-foreground)]">
              <Link href={`/admin/ai-runs/${r.id}`} className="underline">
                {new Date(r.created_at).toLocaleString()}
              </Link>
            </td>
            <td className="py-2">{r.profiles?.email ?? '—'}</td>
            <td className="py-2">{r.offers?.name ?? '—'}</td>
            <td className="py-2">{r.orchestrator_name}</td>
            <td className="py-2">
              <Badge>{r.status}</Badge>
            </td>
            <td className="py-2 text-[var(--color-muted-foreground)]">
              {formatCost(r.estimated_cost)}
            </td>
            <td className="py-2 text-[var(--color-muted-foreground)]">
              {formatLatency(r.started_at, r.completed_at)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
