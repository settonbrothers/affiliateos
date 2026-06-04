import Link from 'next/link'

import { DeleteGoldenButton } from '@/components/admin/DeleteGoldenButton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

type GoldenRow = {
  id: string
  external_id: string | null
  offer_name: string
  offer_url: string | null
  expected_verdict: string
  facts_snapshot: unknown
  notes: string | null
  verticals: { slug: string; name: string } | null
}

export default async function GoldenSetPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('golden_set_offers')
    .select(
      'id, external_id, offer_name, offer_url, expected_verdict, facts_snapshot, notes, verticals(slug, name)'
    )
    .order('external_id', { ascending: true })
    .returns<GoldenRow[]>()

  const rows = data ?? []

  // Per-vertical counts help track progress toward the 20-offer DoD target.
  const counts = new Map<string, number>()
  for (const r of rows) {
    const slug = r.verticals?.slug ?? 'unknown'
    counts.set(slug, (counts.get(slug) ?? 0) + 1)
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/eval"
            className="text-sm text-[var(--color-muted-foreground)] underline"
          >
            ← Eval runs
          </Link>
          <h1 className="text-2xl font-semibold">Golden set</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Hand-labeled offers + their correct verdicts. <code>eval:run</code>{' '}
            replays the active prompt against these and scores agreement (DoD
            target ≥ 75% on 20 offers per vertical).
          </p>
        </div>
        <Link href="/admin/eval/golden/new">
          <Button>Add golden offer</Button>
        </Link>
      </div>

      {counts.size > 0 && (
        <div className="flex flex-wrap gap-2 text-sm">
          {[...counts.entries()].map(([slug, n]) => (
            <Badge key={slug}>
              {slug}: {n}
            </Badge>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No golden offers yet. Click <strong>Add golden offer</strong> to label
          the first one, then run{' '}
          <code>pnpm eval:run --vertical &lt;slug&gt;</code>.
        </p>
      ) : (
        rows.map((r) => {
          const factCount = Array.isArray(r.facts_snapshot)
            ? r.facts_snapshot.length
            : 0
          return (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">
                    {r.external_id ? `${r.external_id} · ` : ''}
                    {r.offer_name}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge>{r.expected_verdict}</Badge>
                    <DeleteGoldenButton id={r.id} />
                  </div>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {r.verticals?.slug ?? '—'} · {factCount} fact(s)
                  {r.offer_url ? ` · ${r.offer_url}` : ''}
                </p>
              </CardHeader>
              {r.notes && (
                <CardContent>
                  <p className="text-sm text-[var(--color-muted-foreground)]">
                    {r.notes}
                  </p>
                </CardContent>
              )}
            </Card>
          )
        })
      )}
    </div>
  )
}
