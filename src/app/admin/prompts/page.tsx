import Link from 'next/link'

import { Badge } from '@/components/ui/badge'
import { createClient } from '@/lib/supabase/server'

type PromptRow = {
  id: string
  orchestrator_name: string
  prompt_type: string
  version: string
  vertical_id: string | null
  is_active: boolean
  created_at: string
  verticals: { slug: string } | null
}

export default async function PromptsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('prompts')
    .select(
      'id, orchestrator_name, prompt_type, version, vertical_id, is_active, created_at, verticals(slug)'
    )
    .order('orchestrator_name')
    .order('prompt_type')
    .order('created_at', { ascending: false })
    .returns<PromptRow[]>()

  const rows = data ?? []

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Prompts</h1>
        <p className="text-sm text-[var(--color-muted-foreground)]">
          Markdown in <code>prompts/</code> is the source of truth.{' '}
          <code>pnpm prompts:sync</code> upserts new versions; the active row
          here is what edge functions load at call time. Rollback by activating
          an older version (no redeploy needed).
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No prompts in the DB yet. Run <code>pnpm prompts:sync</code> from the
          repo root.
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] text-left">
              <th className="py-2 font-medium">Orchestrator</th>
              <th className="py-2 font-medium">Type</th>
              <th className="py-2 font-medium">Vertical</th>
              <th className="py-2 font-medium">Version</th>
              <th className="py-2 font-medium">Status</th>
              <th className="py-2 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="border-b border-[var(--color-border)]"
              >
                <td className="py-2">
                  <Link href={`/admin/prompts/${p.id}`} className="underline">
                    {p.orchestrator_name}
                  </Link>
                </td>
                <td className="py-2 text-[var(--color-muted-foreground)]">
                  {p.prompt_type}
                </td>
                <td className="py-2 text-[var(--color-muted-foreground)]">
                  {p.verticals?.slug ?? 'global'}
                </td>
                <td className="py-2 font-medium">{p.version}</td>
                <td className="py-2">
                  {p.is_active ? (
                    <Badge>active</Badge>
                  ) : (
                    <span className="text-xs text-[var(--color-muted-foreground)]">
                      —
                    </span>
                  )}
                </td>
                <td className="py-2 text-[var(--color-muted-foreground)]">
                  {new Date(p.created_at).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
