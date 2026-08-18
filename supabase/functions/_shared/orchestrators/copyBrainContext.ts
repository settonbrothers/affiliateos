import {
  CopyBrainInputSnapshotV1Schema,
  type CopyBrainInputSnapshotV1,
} from '../types/copyBrain.ts'

const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`
  if (value && typeof value === 'object')
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`
  return JSON.stringify(value)
}

export async function brainSha256(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(stable(value))
  )
  return [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export function verifyPerformanceWinnerProvenance(
  snapshot: CopyBrainInputSnapshotV1
): string[] {
  const refs = new Set(
    snapshot.sources
      .filter(
        (source) => source.source_type === 'campaign_result' && source.verified
      )
      .map((source) => source.source_id)
  )
  return snapshot.performance_winners.flatMap((winner) =>
    !refs.has(winner.source_ref)
      ? [`${winner.winner_id}: winner has no verified campaign_result source`]
      : Object.keys(winner.metrics).length === 0
        ? [`${winner.winner_id}: winner has no metrics`]
        : []
  )
}

export function compileCopyBrainContext(
  raw: CopyBrainInputSnapshotV1,
  maxChars = 45_000
) {
  const snapshot = CopyBrainInputSnapshotV1Schema.parse(raw)
  const errors = verifyPerformanceWinnerProvenance(snapshot)
  if (errors.length) throw new Error(errors.join('; '))
  const summarizedDocuments = snapshot.research_documents.map((document) => ({
    id: document.id ?? null,
    url: document.url ?? null,
    doc_type: document.doc_type ?? null,
    status: document.status ?? null,
    source_reliability_score: document.source_reliability_score ?? null,
    summary:
      document.source_summary ??
      document.summary ??
      (typeof document.raw_text === 'string'
        ? document.raw_text.slice(0, 2_000)
        : null),
  }))
  const context: Record<string, unknown> = {
    snapshot_id: snapshot.snapshot_id,
    offer: snapshot.offer,
    campaign_context: snapshot.campaign_context,
    underwriting: snapshot.underwriting,
    compliance: snapshot.compliance,
    evidence_sources: [...snapshot.sources].sort(
      (a, b) =>
        a.priority - b.priority || a.source_id.localeCompare(b.source_id)
    ),
    research_documents: summarizedDocuments,
    deep_brief: snapshot.deep_brief,
    avatar: snapshot.avatar,
    test_kit: snapshot.test_kit,
    performance_winners: snapshot.performance_winners,
    spy_analyses: snapshot.spy_analyses,
    market_examples: snapshot.market_examples,
    taste_corpus: snapshot.taste_corpus,
    hook_library: snapshot.hook_library,
    creative_hint: snapshot.creative_hint,
    missing_inputs: snapshot.missing_inputs,
  }
  const omitted = [...snapshot.omitted_context]
  if (
    snapshot.research_documents.some(
      (document) => typeof document.raw_text === 'string'
    )
  )
    omitted.push({
      section: 'research_documents.raw_text',
      reason: 'secondary_document_text_summarized_by_context_compiler',
      source_refs: snapshot.research_documents
        .map((document) => String(document.id ?? ''))
        .filter(Boolean),
    })
  for (const section of [
    'taste_corpus',
    'hook_library',
    'market_examples',
    'spy_analyses',
  ]) {
    if (stable(context).length <= maxChars) break
    const items = context[section]
    if (!Array.isArray(items) || items.length === 0) continue
    context[section] = []
    omitted.push({
      section,
      reason: `context_budget_${maxChars}_characters`,
      source_refs: [],
    })
  }
  if (stable(context).length > maxChars)
    throw new Error(
      'Core verified context exceeds the budget; refusing silent truncation.'
    )
  context.omitted_context = omitted
  return { context, omitted }
}
