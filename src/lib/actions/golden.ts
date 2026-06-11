'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { isCurrentUserAdmin } from '@/lib/auth/role'
import { createClient } from '@/lib/supabase/server'
import {
  GoldenOfferSchema,
  type GoldenOfferInput,
} from '@/lib/validations/golden'
import { VERDICTS } from '@/types/agents/underwriting'
import type { Json } from '@/types/database'

// Output of JSON.parse is valid JSON by construction, so asserting Json[] is
// sound here (we already checked it's an array).
function parseFacts(
  raw: string | undefined
): { facts: Json[] } | { error: string } {
  if (!raw || !raw.trim()) return { facts: [] }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: 'Facts snapshot must be valid JSON.' }
  }
  if (!Array.isArray(parsed))
    return { error: 'Facts snapshot must be a JSON array.' }
  return { facts: parsed as Json[] }
}

export async function createGoldenOffer(
  input: GoldenOfferInput
): Promise<{ error: string } | void> {
  const parsed = GoldenOfferSchema.safeParse(input)
  if (!parsed.success) return { error: 'Invalid golden offer details.' }
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }

  const facts = parseFacts(parsed.data.facts_snapshot)
  if ('error' in facts) return { error: facts.error }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { error } = await supabase.from('golden_set_offers').insert({
    external_id: parsed.data.external_id || null,
    offer_name: parsed.data.offer_name,
    vertical_id: parsed.data.vertical_id,
    offer_url: parsed.data.offer_url || null,
    expected_verdict: parsed.data.expected_verdict,
    facts_snapshot: facts.facts,
    notes: parsed.data.notes || null,
    created_by: user?.id ?? null,
  })
  if (error) return { error: error.message }

  revalidatePath('/admin/eval/golden')
  redirect('/admin/eval/golden')
}

// Ratify (or correct) a golden offer's expected_verdict in place. This is the
// owner-judgment step: the verdict here is the ground truth the eval scores
// against, so it must be set by the owner, never copied from model output.
export async function updateGoldenVerdict(
  id: string,
  verdict: string
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }
  if (!(VERDICTS as readonly string[]).includes(verdict)) {
    return { error: 'Unknown verdict.' }
  }

  const supabase = await createClient()
  const { error } = await supabase
    .from('golden_set_offers')
    .update({ expected_verdict: verdict })
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/eval/golden')
}

export async function deleteGoldenOffer(
  id: string
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }

  const supabase = await createClient()
  const { error } = await supabase
    .from('golden_set_offers')
    .delete()
    .eq('id', id)
  if (error) return { error: error.message }

  revalidatePath('/admin/eval/golden')
}

const FACT_TYPES: ReadonlySet<string> = new Set([
  'commission_value', 'commission_type', 'payout_delay', 'cookie_duration',
  'traffic_rule_paid_social', 'traffic_rule_google', 'traffic_rule_native',
  'traffic_rule_youtube', 'traffic_rule_brand_bidding', 'traffic_rule_direct_link',
  'traffic_rule_email', 'traffic_rule_seo', 'traffic_rule_organic_social',
  'allowed_geo', 'restricted_geo', 'cap', 'refund_policy',
  'compliance_claim', 'pricing_aov', 'minimum_payout', 'contact', 'other',
])

type FactRow = {
  fact_type: string
  fact_value: string
  source_quote: string | null
  confidence_score: number | null
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function factRowsFromSnapshot(raw: unknown): FactRow[] {
  if (!Array.isArray(raw)) return []
  const out: FactRow[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rec = item as Record<string, unknown>
    const factType = typeof rec.fact_type === 'string' ? rec.fact_type : 'other'
    if (!FACT_TYPES.has(factType)) continue
    if (typeof rec.fact_value !== 'string') continue
    out.push({
      fact_type: factType,
      fact_value: rec.fact_value,
      source_quote:
        typeof rec.source_quote === 'string' ? rec.source_quote : null,
      confidence_score:
        typeof rec.confidence_score === 'number' ? rec.confidence_score : null,
    })
  }
  return out
}

// Promote a golden offer into a real offer so the owner can inspect it with the
// full offer UI (scorecard, verdict, compliance, per-source provenance) and run
// the real analysis. Creates the offer, a single synthetic source_document, and
// the extracted_facts from facts_snapshot, then redirects to the offer page.
export async function promoteGoldenToOffer(
  id: string
): Promise<{ error: string } | void> {
  if (!(await isCurrentUserAdmin())) return { error: 'Admin only.' }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: 'Not authenticated.' }

  const { data: golden, error: gErr } = await supabase
    .from('golden_set_offers')
    .select('external_id, offer_name, offer_url, vertical_id, facts_snapshot')
    .eq('id', id)
    .maybeSingle()
  if (gErr) return { error: gErr.message }
  if (!golden) return { error: 'Golden offer not found.' }

  const { data: membership } = await supabase
    .from('workspace_members')
    .select('workspace_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle()

  const slug = [slugify(golden.offer_name), golden.external_id ?? id.slice(0, 8)]
    .filter(Boolean)
    .join('-')

  const { data: offer, error: oErr } = await supabase
    .from('offers')
    .insert({
      name: golden.offer_name,
      slug,
      vertical_id: golden.vertical_id,
      website_url: golden.offer_url,
      created_by_user_id: user.id,
      workspace_id: membership?.workspace_id ?? null,
      status: 'draft',
      visibility: 'admin_only',
      operator_notes: `Promoted from golden set${golden.external_id ? ` (${golden.external_id})` : ''}.`,
    })
    .select('id')
    .single()
  if (oErr) return { error: oErr.message }
  const offerId = (offer as { id: string }).id

  const facts = factRowsFromSnapshot(golden.facts_snapshot)
  if (facts.length > 0) {
    const { data: doc, error: dErr } = await supabase
      .from('source_documents')
      .insert({
        offer_id: offerId,
        url: golden.offer_url,
        doc_type: 'unknown',
        status: 'extracted',
        source_summary: 'Imported from the golden set facts snapshot.',
      })
      .select('id')
      .single()
    if (dErr) return { error: dErr.message }
    const sourceDocId = (doc as { id: string }).id

    const { error: fErr } = await supabase.from('extracted_facts').insert(
      facts.map((f) => ({
        offer_id: offerId,
        source_document_id: sourceDocId,
        fact_type: f.fact_type as never,
        fact_value: f.fact_value,
        source_quote: f.source_quote,
        confidence_score: f.confidence_score,
      }))
    )
    if (fErr) return { error: fErr.message }
  }

  revalidatePath('/offers')
  redirect(`/offers/${offerId}`)
}
