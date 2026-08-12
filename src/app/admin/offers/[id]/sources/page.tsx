import Link from 'next/link'
import { notFound } from 'next/navigation'

import { AddSourceForm } from '@/components/admin/AddSourceForm'
import {
  ExtractedFactsTable,
  type FactRow,
} from '@/components/admin/ExtractedFactsTable'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function OfferSourcesPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: offer } = await supabase
    .from('offers')
    .select('id, name')
    .eq('id', id)
    .maybeSingle()
  if (!offer) notFound()

  const { data: sources } = await supabase
    .from('source_documents')
    .select(
      'id, url, status, doc_type, source_reliability_score, source_summary, error_message, created_at'
    )
    .eq('offer_id', id)
    .order('created_at', { ascending: false })

  const { data: facts } = await supabase
    .from('extracted_facts')
    .select(
      'id, source_document_id, fact_type, fact_value, source_quote, confidence_score, status'
    )
    .eq('offer_id', id)
    .order('created_at', { ascending: false })

  // Ingest jobs that never produced a document — the fetch itself failed, or it
  // is still running. These were invisible: source_fetch_jobs holds the real
  // error and was rendered nowhere, so pasting a URL that 404s looked exactly
  // like pasting nothing at all.
  const { data: orphanJobs } = await supabase
    .from('source_fetch_jobs')
    .select('id, url, status, error_message, created_at')
    .eq('offer_id', id)
    .is('source_document_id', null)
    .order('created_at', { ascending: false })
    .limit(10)

  const factsBySource = new Map<string, FactRow[]>()
  for (const f of facts ?? []) {
    if (!f.source_document_id) continue
    const arr = factsBySource.get(f.source_document_id) ?? []
    arr.push(f)
    factsBySource.set(f.source_document_id, arr)
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href={`/offers/${offer.id}`}
          className="text-sm text-[var(--color-muted-foreground)] underline"
        >
          ← {offer.name}
        </Link>
        <h1 className="text-2xl font-semibold">Sources</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Fetch a new source</CardTitle>
        </CardHeader>
        <CardContent>
          <AddSourceForm offerId={offer.id} />
        </CardContent>
      </Card>

      {(orphanJobs ?? []).length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Fetches that produced nothing</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {(orphanJobs ?? []).map((j) => (
              <div key={j.id} className="flex flex-col gap-1 text-sm">
                <div className="flex items-center gap-2">
                  <Badge>{j.status}</Badge>
                  <span className="break-all">{j.url}</span>
                </div>
                {j.error_message && (
                  <p className="text-xs text-red-600">{j.error_message}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {(sources ?? []).length === 0 ? (
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No sources yet. Paste a URL above to fetch and extract facts.
        </p>
      ) : (
        (sources ?? []).map((s) => (
          <Card key={s.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-3">
                <CardTitle className="text-base">
                  {s.url ?? '(manual note)'}
                </CardTitle>
                <Badge>{s.status}</Badge>
              </div>
              {s.source_summary && (
                <p className="text-sm text-[var(--color-muted-foreground)]">
                  {s.source_summary}
                </p>
              )}
              <p className="text-xs text-[var(--color-muted-foreground)]">
                {s.doc_type ?? '—'} · reliability{' '}
                {s.source_reliability_score ?? '—'} ·{' '}
                {new Date(s.created_at).toLocaleString()}
              </p>
              {s.error_message && (
                <p className="text-sm text-red-600">{s.error_message}</p>
              )}
            </CardHeader>
            <CardContent>
              <ExtractedFactsTable
                facts={factsBySource.get(s.id) ?? []}
                offerId={offer.id}
              />
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
