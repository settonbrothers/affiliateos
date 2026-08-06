// The DB writes behind approveCandidate. Kept out of the 'use server' module so
// they take a client as an argument: the server action passes the admin's
// session client, and scripts/test-promote-e2e.mts drives the same code with a
// service-role client against a throwaway offer.
//
// Typed loosely on purpose. The columns these touch (offers.trending_*,
// offers.discovery_candidate_id, discovery_candidates.network_analysis) come
// from migrations 0039/0043 and aren't in the generated database.ts until it is
// regenerated on main.
import type { SupabaseClient } from '@supabase/supabase-js'

import {
  PROMOTE_VERIFY_MIN_CONFIDENCE,
  type PromotedFact,
  type PromotedSource,
} from '@/lib/discovery/promote'
import {
  NetworkComparisonSchema,
  trendingScore,
} from '@/types/agents/discoverNetwork'

/**
 * One source_document per provenance, then the facts that cite it.
 *
 * Inserted row by row (at most three or four sources) so each fact gets the
 * right source_document_id without relying on bulk-insert ordering.
 */
export async function writePromotedEvidence(
  db: SupabaseClient,
  offerId: string,
  sources: PromotedSource[],
  facts: PromotedFact[]
): Promise<{ error: string } | void> {
  if (facts.length === 0) return

  const idByKey = new Map<string, string>()
  for (const s of sources) {
    const { data, error } = await db
      .from('source_documents')
      .insert({
        offer_id: offerId,
        url: s.url,
        // No raw_text: this is the model's reading of a page, not a fetch. The
        // page itself is fetched separately by ingest-source.
        doc_type: 'manual_note',
        status: 'extracted',
        source_summary: s.summary,
        source_reliability_score: s.reliability,
        extracted_at: new Date().toISOString(),
      })
      .select('id')
      .single()
    if (error) return { error: `source_documents: ${error.message}` }
    if (data) idByKey.set(s.key, (data as { id: string }).id)
  }

  const { error } = await db.from('extracted_facts').insert(
    facts.map((f) => ({
      offer_id: offerId,
      source_document_id: idByKey.get(f.sourceKey) ?? null,
      fact_type: f.fact_type,
      fact_value: f.fact_value,
      source_quote: f.source_quote,
      confidence_score: f.confidence_score,
      // Same bar ingest-source uses. reviewed_by stays NULL: machine-verified,
      // not hand-checked.
      status:
        f.confidence_score >= PROMOTE_VERIFY_MIN_CONFIDENCE
          ? 'verified'
          : 'proposed',
    }))
  )
  if (error) return { error: `extracted_facts: ${error.message}` }
}

/**
 * Carry the scan's network pass onto the offer.
 *
 * It is parked on the candidate because nothing is promoted while a scan runs,
 * so this is the first chance to attach it to a real offer.
 */
export async function writeNetworkData(
  db: SupabaseClient,
  offerId: string,
  raw: unknown
): Promise<void> {
  const parsed = NetworkComparisonSchema.safeParse(raw)
  if (!parsed.success) return
  const nc = parsed.data

  if (nc.trending_signal) {
    await db
      .from('offers')
      .update({
        trending_signal: nc.trending_signal,
        trending_score: trendingScore(nc.trending_signal),
      })
      .eq('id', offerId)
  }

  if (nc.networks_found.length === 0) return
  await db.from('offer_network_data').upsert(
    nc.networks_found.map((n) => ({
      offer_id: offerId,
      network_name: n.network_name,
      epc_usd: n.estimated_epc_usd ?? null,
      commission_type: n.estimated_commission_type ?? null,
      is_recommended: nc.recommended_network === n.network_name,
      notes: [
        `confidence: ${n.confidence}`,
        nc.recommended_network === n.network_name ? nc.recommended_reason : null,
        // trending_evidence used to be dropped entirely.
        nc.trending_evidence ? `trend: ${nc.trending_evidence}` : null,
      ]
        .filter(Boolean)
        .join(' | '),
    })),
    { onConflict: 'offer_id,network_name', ignoreDuplicates: false }
  )
}
