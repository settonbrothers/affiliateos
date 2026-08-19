import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import {
  CopyBrainInputSnapshotV1Schema,
  type CopyBrainInputSnapshotV1,
} from '@/types/agents/copyBrain'

import {
  COPY_BRAIN_DOCTRINE_V3,
  compileCopyExecutionBriefV2,
  selectRelevantTaste,
} from './copyExecutionBrief'

const sha = 'a'.repeat(64)

const legacyAvatar = {
  who: 'מנהלת שיווק בעסק קטן',
  life_situation: 'עובדת לבד על כמה ערוצים במקביל',
  pain_points: ['קשה לשמור על קול מותג עקבי'],
  objections: ['כבר ניסיתי כלי AI גנריים'],
  desires: ['להפיק קמפיין איכותי מהר יותר'],
  voice_of_customer: ['אני לא רוצה עוד טקסט שנשמע כמו AI'],
  transformation: 'מקמפיין מפוזר לתהליך כתיבה נשלט',
  emotional_trigger: 'הזמן שמתבזבז על גרסאות חלשות',
  trust_signals: ['דוגמאות אמיתיות ותהליך שקוף'],
}

function snapshot(
  overrides: Partial<CopyBrainInputSnapshotV1> = {}
): CopyBrainInputSnapshotV1 {
  return {
    schema_version: 'copy-brain-input-v1',
    snapshot_id: 'fixture:jasper-corrected',
    captured_at: '2026-08-19T00:00:00.000Z',
    origin: 'synthetic_fixture',
    fixture_only: true,
    offer: {
      id: 'jasper',
      name: 'Jasper AI writing software',
      website_url: 'https://example.com/product',
      affiliate_program_url: 'https://example.com/affiliates',
      network: null,
      vendor_name: 'Jasper',
      vertical: 'saas',
      primary_language: 'en',
      description: 'כלי כתיבה לצוותי שיווק',
    },
    campaign_context: {
      channel: 'meta',
      geo: ['IL'],
      audience: 'מנהלות שיווק בעסקים קטנים',
      generation_language: 'he',
      objective_type: 'trial',
      desired_action: 'להתחיל תקופת ניסיון במוצר',
      audience_side: 'consumer',
    },
    underwriting: null,
    compliance: null,
    offer_economics: null,
    sources: [
      {
        source_id: 'product-page',
        source_type: 'first_party_document',
        source_url: 'https://example.com/product',
        source_quote: 'AI writing software for marketing teams.',
        claim: 'המוצר מסייע לצוותי שיווק ליצור תוכן.',
        priority: 3,
        verified: true,
        snapshot_sha256: sha,
      },
    ],
    research_documents: [],
    deep_brief: { product: 'writing software for marketing teams' },
    spy_analyses: [],
    market_examples: [],
    performance_winners: [],
    avatar: legacyAvatar,
    test_kit: null,
    taste_corpus: [
      {
        text: 'דוגמה מאושרת מ־SaaS',
        vertical: 'saas',
        kind: 'approved',
      },
    ],
    hook_library: [],
    creative_hint: null,
    missing_inputs: [],
    omitted_context: [],
    snapshot_sha256: sha,
    ...overrides,
  }
}

describe('CopyExecutionBriefV2', () => {
  it('accepts an existing v1 avatar while preserving the v3 doctrine trace', () => {
    const brief = compileCopyExecutionBriefV2(snapshot())
    expect(brief.readiness_status).toBe('ready_to_write')
    expect(brief.audience.avatar_completeness).toBe(1)
    expect(brief.doctrine_bundle.checksum).toBe(COPY_BRAIN_DOCTRINE_V3.checksum)
    expect(brief.doctrine_bundle.superseded_lesson_ids).toContain(
      'OLD_COMPONENT_CHECKLIST_PASS'
    )
  })

  it('blocks before writing when objective is missing', () => {
    const input = snapshot()
    input.campaign_context.objective_type = undefined
    input.campaign_context.desired_action = null
    const brief = compileCopyExecutionBriefV2(input)
    expect(brief.readiness_status).toBe('needs_objective')
    expect(brief.critical_missing).toContain('campaign_objective')
  })

  it('detects affiliate-program research aimed at a consumer campaign', () => {
    const input = snapshot({
      deep_brief: {
        promise: 'Earn recurring affiliate commission and a large payout',
      },
    })
    const brief = compileCopyExecutionBriefV2(input)
    expect(brief.readiness_status).toBe('objective_conflict')
    expect(brief.conflicts[0]?.code).toBe('affiliate_program_vs_consumer_offer')
  })

  it('does not confuse an explicit affiliate exclusion with the consumer target', () => {
    const input = snapshot({
      deep_brief: {
        consumer_product: 'Marketing writing software',
        objective: 'Start a product trial',
        explicit_non_target: 'Do not recruit affiliates or discuss commission',
      },
    })
    expect(compileCopyExecutionBriefV2(input).readiness_status).toBe(
      'ready_to_write'
    )
  })

  it('accepts the frozen corrected Jasper system snapshot', () => {
    const jasper = CopyBrainInputSnapshotV1Schema.parse(
      JSON.parse(
        readFileSync(
          resolve(
            process.cwd(),
            'brain-evals/jasper-corrected-v3.snapshot.json'
          ),
          'utf8'
        )
      )
    )
    const brief = compileCopyExecutionBriefV2(jasper)
    expect(brief.readiness_status).toBe('ready_to_write')
    expect(brief.campaign_objective).toMatchObject({
      objective_type: 'trial',
      audience_side: 'consumer',
    })
    expect(brief.conflicts).toHaveLength(0)
    expect(brief.upstream_context.performance_winners).toHaveLength(0)
  })
})

describe('relevant Taste Corpus selection', () => {
  it('deduplicates, rejects unexplained negatives, and limits cross-vertical examples to principles', () => {
    const selection = selectRelevantTaste(
      [
        { text: 'טקסט מאושר', vertical: 'saas', kind: 'approved' },
        { text: 'טקסט מאושר', vertical: 'saas', kind: 'approved' },
        { text: 'טקסט חלש', vertical: 'saas', kind: 'rejected' },
        {
          text: 'מבנה רגשי מתרומה',
          vertical: 'donation',
          kind: 'approved',
        },
      ],
      { vertical: 'saas', objective: 'trial' }
    )
    expect(selection.selected).toHaveLength(2)
    expect(selection.excluded.map((item) => item.reason)).toEqual(
      expect.arrayContaining(['duplicate', 'negative_without_reason'])
    )
    expect(
      selection.selected.find(
        (item) =>
          (item.entry as Record<string, unknown>).text === 'מבנה רגשי מתרומה'
      )?.use_mode
    ).toBe('principle_only')
  })
})
