import Link from 'next/link'

import { DeleteGoldenButton } from '@/components/admin/DeleteGoldenButton'
import { GoldenVerdictSelect } from '@/components/admin/GoldenVerdictSelect'
import { PromoteGoldenButton } from '@/components/admin/PromoteGoldenButton'
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

type DisplayFact = {
  fact_type: string
  fact_value: string
  source_quote: string | null
  confidence: number | null
}

// The fact categories that most drive an underwriting verdict. We surface which
// of these the offer HAS vs is MISSING so the owner can see, at a glance, where
// the evidence is thin before they ratify.
const KEY_CATEGORIES = [
  'commission_value',
  'commission_type',
  'cookie_duration',
  'payout_delay',
  'minimum_payout',
  'pricing_aov',
  'allowed_geo',
  'restricted_geo',
  'cap',
  'refund_policy',
  'compliance_claim',
  'traffic_rule_brand_bidding',
] as const

// facts_snapshot is free-form JSON; pull out just what we display, tolerating
// rows whose facts don't match the extracted_facts shape.
function parseFactList(raw: unknown): DisplayFact[] {
  if (!Array.isArray(raw)) return []
  const out: DisplayFact[] = []
  for (const item of raw) {
    if (item && typeof item === 'object') {
      const rec = item as Record<string, unknown>
      out.push({
        fact_type: typeof rec.fact_type === 'string' ? rec.fact_type : 'fact',
        fact_value:
          typeof rec.fact_value === 'string'
            ? rec.fact_value
            : JSON.stringify(rec.fact_value),
        source_quote:
          typeof rec.source_quote === 'string' && rec.source_quote.trim()
            ? rec.source_quote
            : null,
        confidence:
          typeof rec.confidence_score === 'number' ? rec.confidence_score : null,
      })
    }
  }
  return out
}

type ModelResult = {
  actual_verdict: string
  actual_weighted_score: number | null
  verdict_match: boolean
}

// Build a map from external_id → the model's most recent eval result, so each
// golden offer can show "what the model said last time" as a reference. This is
// a reference only — the owner's expected_verdict is the ground truth.
function parseEvalResults(runs: { details: unknown }[]): Map<string, ModelResult> {
  const map = new Map<string, ModelResult>()
  for (const run of runs) {
    const details = run.details
    if (!details || typeof details !== 'object') continue
    const results = (details as Record<string, unknown>).results
    if (!Array.isArray(results)) continue
    for (const r of results) {
      if (!r || typeof r !== 'object') continue
      const rec = r as Record<string, unknown>
      const extId = rec.external_id
      if (typeof extId !== 'string' || map.has(extId)) continue
      map.set(extId, {
        actual_verdict:
          typeof rec.actual_verdict === 'string' ? rec.actual_verdict : '—',
        actual_weighted_score:
          typeof rec.actual_weighted_score === 'number'
            ? rec.actual_weighted_score
            : null,
        verdict_match: rec.verdict_match === true,
      })
    }
  }
  return map
}

export default async function GoldenSetPage() {
  const supabase = await createClient()
  const [{ data }, { data: evalRuns }] = await Promise.all([
    supabase
      .from('golden_set_offers')
      .select(
        'id, external_id, offer_name, offer_url, expected_verdict, facts_snapshot, notes, verticals(slug, name)'
      )
      .order('external_id', { ascending: true })
      .returns<GoldenRow[]>(),
    supabase
      .from('eval_runs')
      .select('details')
      .order('completed_at', { ascending: false })
      .limit(10)
      .returns<{ details: unknown }[]>(),
  ])

  const rows = data ?? []
  const modelResults = parseEvalResults(evalRuns ?? [])

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
            Hand-labeled offers + their correct verdicts. Set the{' '}
            <strong>expected verdict</strong> (your call) from the facts below;{' '}
            <code>eval:run</code> then scores how often the model agrees (DoD
            target ≥ 75%). The model&apos;s last verdict is shown for reference
            only — never let it set your label.
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
          const facts = parseFactList(r.facts_snapshot)
          const present = new Set(facts.map((f) => f.fact_type))
          const missing = KEY_CATEGORIES.filter((c) => !present.has(c))
          const model = r.external_id
            ? modelResults.get(r.external_id)
            : undefined
          return (
            <Card key={r.id}>
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <CardTitle className="text-base">
                    {r.external_id ? `${r.external_id} · ` : ''}
                    {r.offer_name}
                  </CardTitle>
                  <div className="flex items-start gap-2">
                    <div className="flex flex-col items-end gap-1">
                      <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted-foreground)]">
                        Expected (your call)
                      </span>
                      <GoldenVerdictSelect id={r.id} value={r.expected_verdict} />
                    </div>
                    <DeleteGoldenButton id={r.id} />
                  </div>
                </div>
                <p className="text-xs text-[var(--color-muted-foreground)]">
                  {r.verticals?.slug ?? '—'} · {facts.length} fact(s)
                  {r.offer_url ? ' · ' : ''}
                  {r.offer_url && (
                    <a
                      href={r.offer_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline"
                    >
                      {r.offer_url}
                    </a>
                  )}
                </p>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {model && (
                  <div className="flex flex-wrap items-center gap-2 rounded-none border border-[var(--color-border)] bg-[var(--color-muted)] px-3 py-2 text-sm">
                    <span className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      Model&apos;s last eval (reference)
                    </span>
                    <Badge>{model.actual_verdict}</Badge>
                    {model.actual_weighted_score !== null && (
                      <span className="text-[var(--color-muted-foreground)]">
                        score {model.actual_weighted_score}
                      </span>
                    )}
                    <span
                      className={
                        model.verdict_match ? 'text-green-600' : 'text-amber-600'
                      }
                    >
                      {model.verdict_match
                        ? '✓ agrees with your label'
                        : '✗ disagrees with your label'}
                    </span>
                  </div>
                )}

                {facts.length > 0 && (
                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      Extracted facts
                    </span>
                    <ul className="flex flex-col gap-2 text-sm">
                      {facts.map((f, i) => (
                        <li
                          key={i}
                          className="flex flex-col gap-0.5 border-l-2 border-[var(--color-border)] pl-3"
                        >
                          <div className="flex flex-wrap items-baseline gap-2">
                            <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
                              {f.fact_type}
                            </span>
                            <span className="font-medium">{f.fact_value}</span>
                            {f.confidence !== null && (
                              <span className="text-xs text-[var(--color-muted-foreground)]">
                                {f.confidence}% conf.
                              </span>
                            )}
                          </div>
                          {f.source_quote && (
                            <span className="text-xs italic text-[var(--color-muted-foreground)]">
                              “{f.source_quote}”
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {missing.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium uppercase tracking-wide text-[var(--color-muted-foreground)]">
                      Missing key facts
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {missing.map((c) => (
                        <span
                          key={c}
                          className="rounded border border-dashed border-[var(--color-border)] px-1.5 py-0.5 font-mono text-xs text-[var(--color-muted-foreground)]"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {r.notes && (
                  <p className="text-xs text-[var(--color-muted-foreground)]">
                    {r.notes}
                  </p>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <PromoteGoldenButton id={r.id} />
                  <span className="text-xs text-[var(--color-muted-foreground)]">
                    Opens it as a real offer (with these facts) so you can run the
                    full analysis and inspect every source.
                  </span>
                </div>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
