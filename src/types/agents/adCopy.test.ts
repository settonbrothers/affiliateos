import { describe, expect, it } from 'vitest'

import { AdCopyResponseSchema, type AdCopyResponse } from './adCopy'

function validResponse(): AdCopyResponse {
  return {
    orchestrator_name: 'AdCopyOrchestrator',
    agent_version: 'v1',
    status: 'success',
    confidence_score: 80,
    facts: [],
    assumptions: [],
    estimates: [],
    risks: [],
    unknowns: [],
    missing_data: [],
    human_review_required: false,
    human_review_reasons: [],
    payload: {
      product_excavation: {
        real_problem: 'Marketers waste budget on offers that cannot scale.',
        real_solution: 'Underwrite the offer before spending a dollar.',
        why_better: 'Grounded in a 13-dimension scorecard, not vibes.',
        key_differentiators: ['scorecard', 'real results loop'],
      },
      avatar_excavation: {
        who: 'Solo media buyer running paid social.',
        pain_points: ['I keep burning test budget on dead offers.'],
        objections: ['Another AI tool that spits generic copy?'],
        desires: ['Find a winner faster, with less risk.'],
        voice_of_customer: ['dead offer', 'test budget'],
      },
      angles: [
        { name: 'Risk reversal', positioning: 'Know before you spend', rooted_in: 'pain: burning budget' },
        { name: 'Speed', positioning: 'Find winners faster', rooted_in: 'desire: faster winner' },
      ],
      hooks: [
        { text: 'Stop burning test budget.', angle_index: 0, lang: 'en' },
        { text: 'תפסיק לשרוף תקציב בדיקות.', angle_index: 0, lang: 'he' },
        { text: 'Find your next winner faster.', angle_index: 1, lang: 'en' },
        { text: 'מצא את המנצח הבא מהר יותר.', angle_index: 1, lang: 'he' },
      ],
      variants: [
        { lang: 'en', primary_text: 'Most offers fail...', headline: 'Underwrite first', hook: 'Stop burning test budget.', angle_index: 0 },
        { lang: 'he', primary_text: 'רוב האופרים נכשלים...', headline: 'תבדוק לפני', hook: 'תפסיק לשרוף תקציב בדיקות.', angle_index: 0 },
      ],
      judge: {
        principles: [
          { principle: 'product_understanding', verdict: 'pass', reason: 'Starts from the real problem.' },
          { principle: 'eye_level_authentic', verdict: 'pass', reason: 'Speaks plainly, no hype.' },
          { principle: 'depth_without_exaggeration', verdict: 'pass', reason: 'No income claims.' },
        ],
        compliance_ok: true,
        overall: 'advisory',
        calibrated: false,
        notes: 'Judge advisory until calibrated vs Taste Corpus.',
      },
      refine_iterations: 0,
    },
  }
}

describe('AdCopyResponseSchema', () => {
  it('accepts a well-formed bilingual response', () => {
    expect(() => AdCopyResponseSchema.parse(validResponse())).not.toThrow()
  })

  it('rejects an invalid language code', () => {
    const bad = validResponse()
    // @ts-expect-error intentional invalid lang
    bad.payload.variants[0].lang = 'fr'
    expect(() => AdCopyResponseSchema.parse(bad)).toThrow()
  })

  it('rejects refine_iterations above the cap of 2', () => {
    const bad = validResponse()
    bad.payload.refine_iterations = 3
    expect(() => AdCopyResponseSchema.parse(bad)).toThrow()
  })

  it('requires at least two angles', () => {
    const bad = validResponse()
    bad.payload.angles = [bad.payload.angles[0]!]
    expect(() => AdCopyResponseSchema.parse(bad)).toThrow()
  })

  it('requires exactly three judged principles', () => {
    const bad = validResponse()
    bad.payload.judge.principles = bad.payload.judge.principles.slice(0, 2)
    expect(() => AdCopyResponseSchema.parse(bad)).toThrow()
  })
})
