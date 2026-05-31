'use client'

import { useTransition } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { approveFact, rejectFact } from '@/lib/actions/sources'

export type FactRow = {
  id: string
  fact_type: string
  fact_value: string
  source_quote: string | null
  confidence_score: number | null
  status: string
}

export function ExtractedFactsTable({
  facts,
  offerId,
}: {
  facts: FactRow[]
  offerId: string
}) {
  if (facts.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No facts extracted from this source.
      </p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-[var(--color-border)] text-left">
          <th className="py-2 font-medium">Type</th>
          <th className="py-2 font-medium">Value</th>
          <th className="py-2 font-medium">Source quote</th>
          <th className="py-2 font-medium">Conf.</th>
          <th className="py-2 font-medium">Status</th>
          <th className="py-2 text-right font-medium">Actions</th>
        </tr>
      </thead>
      <tbody>
        {facts.map((f) => (
          <Row key={f.id} fact={f} offerId={offerId} />
        ))}
      </tbody>
    </table>
  )
}

function Row({ fact, offerId }: { fact: FactRow; offerId: string }) {
  const [isPending, startTransition] = useTransition()

  return (
    <tr className="border-b border-[var(--color-border)] align-top">
      <td className="py-2">{fact.fact_type}</td>
      <td className="py-2 font-medium">{fact.fact_value}</td>
      <td className="py-2 text-xs text-[var(--color-muted-foreground)]">
        {fact.source_quote ?? '—'}
      </td>
      <td className="py-2 text-[var(--color-muted-foreground)]">
        {fact.confidence_score ?? '—'}
      </td>
      <td className="py-2">
        <Badge>{fact.status}</Badge>
      </td>
      <td className="py-2 text-right">
        {fact.status === 'proposed' && (
          <div className="flex justify-end gap-1">
            <Button
              size="sm"
              variant="outline"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await approveFact(fact.id, offerId)
                })
              }
            >
              Approve
            </Button>
            <Button
              size="sm"
              variant="ghost"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await rejectFact(fact.id, offerId)
                })
              }
            >
              Reject
            </Button>
          </div>
        )}
      </td>
    </tr>
  )
}
