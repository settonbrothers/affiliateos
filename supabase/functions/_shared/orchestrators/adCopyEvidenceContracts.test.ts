import { assertEquals, assert } from 'jsr:@std/assert'

import {
  selectCandidateHook,
  selectRevisionCandidate,
  normalizeTasteKillFlag,
  tasteRequirementStatus as rawTasteRequirementStatus,
  validateAngleDecision,
  validateCandidateClaims,
  validateHookCoverage,
} from '../brainContracts/validateAgencyContracts.ts'

const tasteRequirementStatus = rawTasteRequirementStatus as (
  selection: unknown,
  consumedIds?: string[]
) => string

const envelope = {
  real_problem: 'Manual rewriting remains the bottleneck.',
  real_solution: 'Brand context supports more consistent first drafts.',
  sources: [
    {
      source_id: 's1',
      claim: 'Reviewers report faster first drafts.',
      source_quote: 'faster first drafts',
    },
    {
      source_id: 's2',
      claim: 'A 7-day product trial is available.',
      source_quote: null,
    },
  ],
  supported_outcomes: [
    {
      outcome_id: 'o1',
      statement: 'Faster first drafts',
      intensity_ceiling: 'Human editing remains necessary.',
    },
  ],
}

const spine = {
  unmet_need_now: 'More consistent first drafts',
  scene_evidence: 'The content lead rewrites another generic draft.',
  consequence_without_offer: 'The manual bottleneck remains.',
  truth_sources: ['s1'],
  dominant_emotional_peak: 'The lead realizes they are still the workflow.',
  build_to_peak: ['Another rewrite'],
  offer_mechanism: 'Brand context is applied in the drafting workflow.',
  why_offer_is_causal_solution: 'The context stays with the draft.',
  unresolved_at_ask: 'The next campaign still needs first drafts.',
}

Deno.test(
  'angle contract rejects Jasper recommendation and source regressions',
  () => {
    const valid = [
      { is_recommended: true, conversion_spine: spine },
      { is_recommended: false, conversion_spine: null },
    ]
    assertEquals(validateAngleDecision(valid, envelope).pass, true)
    assert(
      validateAngleDecision(
        [valid[0], { is_recommended: true, conversion_spine: null }],
        envelope
      ).flags.includes('angle_recommendation_cardinality')
    )
    assert(
      validateAngleDecision(
        [
          {
            is_recommended: true,
            conversion_spine: { ...spine, truth_sources: ['s1: quote'] },
          },
        ],
        envelope
      ).flags.includes('angle_truth_source_invalid')
    )
  }
)

Deno.test('unsupported Jasper timings fail before judging', () => {
  assertEquals(
    validateCandidateClaims(
      {
        hook: 'הוק',
        primary_text: 'תוך 30 דקות הכול מוכן.',
        headline: 'כותרת',
      },
      envelope
    ).flags,
    ['invented_claim_detail']
  )
})

Deno.test(
  'every routed candidate requires its own hook pool and recommendation',
  () => {
    const plan = {
      candidate_briefs: [
        { candidate_id: 'c1', angle_index: 0 },
        { candidate_id: 'c2', angle_index: 1 },
      ],
    }
    const hooks = [
      ...['a', 'b', 'c'].map((text, index) => ({
        text,
        candidate_id: 'c1',
        angle_index: 0,
        is_recommended: index === 0,
      })),
      ...['d', 'e', 'f'].map((text, index) => ({
        text,
        candidate_id: 'c2',
        angle_index: 1,
        is_recommended: index === 1,
      })),
    ]
    assertEquals(validateHookCoverage(plan, hooks).pass, true)
    assertEquals(
      selectCandidateHook(plan.candidate_briefs[1], hooks)?.text,
      'e'
    )
    assertEquals(
      selectCandidateHook(
        plan.candidate_briefs[1],
        hooks.filter((hook) => hook.candidate_id === 'c1')
      ),
      null
    )
  }
)

Deno.test(
  'empty relevant Taste is valid and bounded revision skips unrepairable candidates',
  () => {
    assertEquals(tasteRequirementStatus({ selected: [] }), 'none_available')
    assertEquals(
      normalizeTasteKillFlag(
        {
          overall: 'fail',
          compliance_ok: true,
          principles: [{ verdict: 'pass' }],
          kill_flags: ['taste_not_loaded'],
        },
        'none_available'
      ),
      {
        overall: 'pass',
        compliance_ok: true,
        principles: [{ verdict: 'pass' }],
        kill_flags: [],
      }
    )
    const selected = selectRevisionCandidate(
      [{ candidate_id: 'c1' }, { candidate_id: 'c2' }],
      [
        {
          candidate_id: 'c1',
          critic: { kill_flags: ['low_momentum'] },
          judge: {
            overall: 'fail',
            compliance_ok: true,
            kill_flags: ['low_momentum'],
          },
        },
        {
          candidate_id: 'c2',
          critic: { kill_flags: ['claim_violation'] },
          judge: {
            overall: 'fail',
            compliance_ok: false,
            kill_flags: ['claim_violation'],
          },
        },
      ]
    )
    assertEquals(selected?.candidate.candidate_id, 'c1')
  }
)

Deno.test(
  'Jasper revision routing prefers a bounded proof repair over a structural rewrite',
  () => {
    const selected = selectRevisionCandidate(
      [
        { candidate_id: 'storytelling-structural-repair' },
        { candidate_id: 'proof-bounded-repair' },
      ],
      [
        {
          candidate_id: 'storytelling-structural-repair',
          critic: {
            kill_flags: ['generic_angle', 'wording_stronger_than_fact'],
          },
          judge: {
            overall: 'fail',
            compliance_ok: false,
            kill_flags: ['low_momentum'],
          },
        },
        {
          candidate_id: 'proof-bounded-repair',
          critic: { kill_flags: ['wording_stronger_than_fact'] },
          judge: {
            overall: 'fail',
            compliance_ok: false,
            kill_flags: ['evidence_threshold_unmet'],
          },
        },
      ]
    )
    assertEquals(selected?.candidate.candidate_id, 'proof-bounded-repair')
  }
)
