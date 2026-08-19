import { describe, expect, it } from 'vitest'

import type { CopyBrainInputSnapshotV1 } from '@/types/agents/copyBrain'

import {
  compileCopyBrainContext,
  sealCopyBrainSnapshot,
  verifyPerformanceWinnerProvenance,
} from './copyBrainContext'

const base = (): Omit<CopyBrainInputSnapshotV1, 'snapshot_sha256'> => ({
  schema_version: 'copy-brain-input-v1',
  snapshot_id: 'case-1',
  captured_at: '2026-08-18T00:00:00.000Z',
  origin: 'synthetic_fixture',
  fixture_only: true,
  offer: {
    id: 'o1',
    name: 'Test',
    website_url: null,
    affiliate_program_url: null,
    network: null,
    vendor_name: null,
    vertical: 'saas',
    primary_language: 'en',
    description: null,
  },
  campaign_context: {
    channel: 'paid_social',
    geo: ['US'],
    audience: 'owners',
    generation_language: 'he',
  },
  underwriting: null,
  compliance: null,
  offer_economics: null,
  sources: [
    {
      source_id: 'campaign-1',
      source_type: 'campaign_result',
      source_url: null,
      source_quote: null,
      claim: 'Measured winner',
      priority: 1,
      verified: true,
      snapshot_sha256: 'a'.repeat(64),
    },
  ],
  research_documents: [],
  deep_brief: null,
  spy_analyses: [],
  market_examples: [],
  performance_winners: [
    {
      winner_id: 'w1',
      offer_id: 'o1',
      campaign_id: 'c1',
      creative_id: null,
      hook: 'hook',
      metrics: { roas: 2 },
      decision_rule: 'ROAS above target',
      source_ref: 'campaign-1',
    },
  ],
  avatar: null,
  test_kit: null,
  taste_corpus: [],
  hook_library: [],
  creative_hint: null,
  missing_inputs: [],
  omitted_context: [],
})

describe('copy brain context', () => {
  it('seals and validates a frozen snapshot', () => {
    const sealed = sealCopyBrainSnapshot(base())
    expect(sealed.snapshot_sha256).toMatch(/^[a-f0-9]{64}$/)
    expect(verifyPerformanceWinnerProvenance(sealed)).toEqual([])
  })

  it('rejects a hook-library claim presented as a measured winner', () => {
    const input = base()
    input.performance_winners[0]!.source_ref = 'hook-library'
    const sealed = sealCopyBrainSnapshot(input)
    expect(() => compileCopyBrainContext(sealed)).toThrow(/campaign_result/)
  })

  it('never silently truncates verified evidence', () => {
    const input = base()
    input.sources[0]!.claim = 'x'.repeat(10_000)
    const sealed = sealCopyBrainSnapshot(input)
    expect(() => compileCopyBrainContext(sealed, 200)).toThrow(
      /Core verified context/
    )
  })

  it('keeps full research in the seal but traces prompt-time summarization', () => {
    const input = base()
    input.research_documents = [
      {
        id: 'doc-1',
        doc_type: 'review_page',
        raw_text: 'full source text',
        source_summary: 'bounded summary',
      },
    ]
    const sealed = sealCopyBrainSnapshot(input)
    const compiled = compileCopyBrainContext(sealed)
    expect(sealed.research_documents[0]?.raw_text).toBe('full source text')
    expect(compiled.context.research_documents).toEqual([
      expect.objectContaining({ summary: 'bounded summary' }),
    ])
    expect(compiled.omitted).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ section: 'research_documents.raw_text' }),
      ])
    )
  })

  it('keeps offer economics in the sealed input but out of consumer copy context', () => {
    const input = base()
    input.offer_economics = {
      schema_version: 'offer-economics-v1',
      internal_only: true,
      commission_model: 'fixed_per_conversion',
      commission_event: 'approved_conversion',
      payout_currency: 'USD',
      fixed_payout_per_event: 30,
      revenue_share_rate: null,
      average_order_value: null,
      approval_rate: 0.8,
      reversal_rate: 0.05,
      variable_fee_per_approved_conversion: 0,
      recurring_value: {
        amount_per_period: null,
        period: 'unknown',
        validated_retention_periods: null,
      },
      payout_delay_days: 30,
      network_epc: { amount: null, currency: null, basis: 'unknown' },
      fx_to_reporting_currency: {
        reporting_currency: 'USD',
        rate: 1,
        source: 'network',
        captured_at: null,
      },
      sources: [
        {
          source_id: 'network-commission',
          field: 'fixed_payout_per_event',
          verified: true,
          confidence: 100,
          as_of: null,
        },
      ],
      missing_inputs: [],
    }
    const sealed = sealCopyBrainSnapshot(input)
    const compiled = compileCopyBrainContext(sealed)
    expect(sealed.offer_economics?.fixed_payout_per_event).toBe(30)
    expect(compiled.context).not.toHaveProperty('offer_economics')
    expect(compiled.omitted).toContainEqual(
      expect.objectContaining({
        section: 'offer_economics',
        reason: 'internal_operator_context_not_exposed_to_copy',
      })
    )
  })
})
