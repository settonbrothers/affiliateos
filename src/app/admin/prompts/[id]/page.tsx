import Link from 'next/link'
import { notFound } from 'next/navigation'

import { ActivatePromptButton } from '@/components/admin/ActivatePromptButton'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

type PromptDetail = {
  id: string
  orchestrator_name: string
  prompt_type: string
  version: string
  is_active: boolean
  notes: string | null
  content: string
  created_at: string
  verticals: { slug: string; name: string } | null
}

export default async function PromptDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params

  const supabase = await createClient()
  const { data } = await supabase
    .from('prompts')
    .select(
      'id, orchestrator_name, prompt_type, version, is_active, notes, content, created_at, verticals(slug, name)'
    )
    .eq('id', id)
    .maybeSingle()
    .returns<PromptDetail>()

  if (!data) notFound()

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/admin/prompts"
        className="text-sm text-[var(--color-muted-foreground)] underline"
      >
        ← Prompts
      </Link>

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">
            {data.orchestrator_name} · {data.version}
          </h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            {data.prompt_type} · {data.verticals?.slug ?? 'global'} ·{' '}
            {new Date(data.created_at).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {data.is_active && <Badge>active</Badge>}
          <ActivatePromptButton promptId={data.id} isActive={data.is_active} />
        </div>
      </div>

      {data.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{data.notes}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Content</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="whitespace-pre-wrap rounded bg-[var(--color-muted)] p-3 text-xs">
            {data.content}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}
