import {
  factTypeLabel,
  hostnameOf,
  sortFactsForDisplay,
} from '@/lib/facts/display'
import type { VerifiedFact } from '@/lib/queries/offers'

export function OfferFactsList({ facts }: { facts: VerifiedFact[] }) {
  if (facts.length === 0) {
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        No verified facts yet — the analysis runs on offer details alone until
        sources are ingested.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-3">
      {sortFactsForDisplay(facts).map((f) => (
        <li key={f.id} className="text-sm">
          <span className="font-medium">{factTypeLabel(f.fact_type)}:</span>{' '}
          <span>{f.fact_value}</span>
          {f.source_quote && (
            <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">
              “{f.source_quote}”
            </p>
          )}
          {f.source_documents?.url && (
            <a
              href={f.source_documents.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs underline"
            >
              {hostnameOf(f.source_documents.url)} ↗
            </a>
          )}
        </li>
      ))}
    </ul>
  )
}
