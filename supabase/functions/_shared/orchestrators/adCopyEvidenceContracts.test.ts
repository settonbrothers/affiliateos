import { assertEquals, assert } from 'jsr:@std/assert'

import {
  selectCandidateHook,
  selectRevisionCandidate,
  normalizeTasteKillFlag,
  tasteRequirementStatus as rawTasteRequirementStatus,
  validateAngleDecision,
  validateCandidateClaims,
  validateDepartmentPlan,
  validateHookCoverage,
} from '../brainContracts/validateAgencyContracts.ts'
import {
  normalizeAnglesToolInput,
  resolveEvidenceStageModel,
} from './adCopyEvidence.ts'

Deno.test(
  'lone angle transport is wrapped without changing semantic fields',
  () => {
    const angle = {
      angle_id: 'angle-1',
      is_recommended: true,
      narrative_license: { mode: 'non_story' },
      positioning: 'Keep this exact semantic payload.',
    }
    assertEquals(normalizeAnglesToolInput(angle), { angles: [angle] })
    const alreadyWrapped = { angles: [angle] }
    assertEquals(normalizeAnglesToolInput(alreadyWrapped), alreadyWrapped)
    assertEquals(normalizeAnglesToolInput({ angle_id: 'incomplete' }), {
      angle_id: 'incomplete',
    })
  }
)

Deno.test(
  'economy smoke uses Sonnet without changing production models',
  () => {
    assertEquals(
      resolveEvidenceStageModel(
        'economy_smoke',
        'claude-opus-4-6',
        'claude-sonnet-4-6'
      ),
      'claude-sonnet-4-6'
    )
    assertEquals(
      resolveEvidenceStageModel(
        'production',
        'claude-opus-4-6',
        'claude-sonnet-4-6'
      ),
      'claude-opus-4-6'
    )
  }
)

const tasteRequirementStatus = rawTasteRequirementStatus as (
  selection: unknown,
  consumedIds?: string[]
) => string
const validateDepartmentPlanV4 = validateDepartmentPlan as (
  plan: unknown,
  angles: unknown,
  envelope: unknown,
  executionBrief?: unknown
) => { pass: boolean; flags: string[]; details: string[] }
const validateHookCoverageV7 = validateHookCoverage as (
  plan: unknown,
  hooks: unknown,
  envelope?: unknown
) => { pass: boolean; flags: string[]; details: string[] }

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
  causal_dependency_test: {
    removed_offer_mechanism:
      'Stored brand context is removed from the drafting workflow.',
    reader_problem_still_resolves: false,
    explanation:
      'Without stored context, the manual rewrite bottleneck remains.',
  },
}

const positiveDifferentiation = {
  offer_strength: 'Jasper applies stored brand context during drafting.',
  offer_strength_source_ids: ['s1'],
  market_claim_mode: 'offer_only',
  market_claim: '',
  market_claim_evidence_ids: [],
  competitor_denigration_used: false,
}

Deno.test(
  'angle contract rejects Jasper recommendation and source regressions',
  () => {
    const valid = [
      {
        is_recommended: true,
        conversion_spine: spine,
        positive_differentiation: positiveDifferentiation,
      },
      {
        is_recommended: false,
        conversion_spine: spine,
        positive_differentiation: positiveDifferentiation,
      },
    ]
    assertEquals(validateAngleDecision(valid, envelope).pass, true)
    assert(
      validateAngleDecision(
        [valid[0], { ...valid[1], is_recommended: true }],
        envelope
      ).flags.includes('angle_recommendation_cardinality')
    )
    assert(
      validateAngleDecision(
        [
          {
            is_recommended: true,
            conversion_spine: { ...spine, truth_sources: ['s1: quote'] },
            positive_differentiation: positiveDifferentiation,
          },
        ],
        envelope
      ).flags.includes('angle_truth_source_invalid')
    )
  }
)

Deno.test('unsupported Jasper timings are classified before judging', () => {
  assertEquals(
    validateCandidateClaims(
      {
        hook: 'הוק',
        primary_text: 'תוך 30 דקות הכול מוכן.',
        headline: 'כותרת',
      },
      envelope
    ).flags,
    ['unsupported_scene_detail']
  )
})

Deno.test(
  'unsupported Hebrew-word timings and forbidden dashes are classified',
  () => {
    assertEquals(
      validateCandidateClaims(
        {
          hook: 'הוק',
          primary_text: 'שלושים שניות — ויש טיוטה.',
          headline: 'כותרת',
        },
        envelope
      ).flags,
      ['unsupported_scene_detail', 'forbidden_dash']
    )
  }
)

Deno.test('digits inside G2 are not treated as invented measurements', () => {
  assertEquals(
    validateCandidateClaims(
      {
        hook: 'G2',
        primary_text: 'ביקורות G2 וניסיון של 7 ימים.',
        headline: 'בדיקה',
      },
      {
        ...envelope,
        sources: [
          ...envelope.sources,
          {
            source_id: 'trial',
            claim: 'A 7-day product trial is available.',
            source_quote: null,
          },
        ],
      }
    ).pass,
    true
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

Deno.test('unsupported category hooks and domain bleed fail upstream', () => {
  const plan = {
    routing_reason: 'The causal funding dependence is established.',
    candidate_briefs: [
      {
        candidate_id: 'c1',
        angle_index: 0,
        evidence_anchor_ids: ['s1'],
      },
    ],
  }
  const angles = [{ is_recommended: true, conversion_spine: spine }]
  assert(
    validateDepartmentPlanV4(plan, angles, envelope, {
      campaign_objective: { objective_type: 'trial' },
    }).flags.includes('department_objective_domain_bleed')
  )
  const hooks = ['a', 'b', 'c'].map((text, index) => ({
    text:
      index === 0
        ? 'הבעיה עם כלי כתיבה גנריים היא מה שהם שוכחים בין משימות.'
        : text,
    candidate_id: 'c1',
    angle_index: 0,
    is_recommended: index === 0,
  }))
  assert(
    validateHookCoverageV7(plan, hooks, envelope).flags.includes(
      'hook_unsupported_category_claim'
    )
  )
})

Deno.test('unsupported category behavior fails at the angle gate', () => {
  const unsupportedAngle = {
    is_recommended: true,
    positioning: 'The AI never retained what the content lead taught it.',
    conversion_spine: {
      ...spine,
      dominant_emotional_peak:
        'The recognition that the AI is stateless and never retained the brand context.',
      swap_test: {
        replacement_offer: 'Generic standalone AI writing tool',
        story_still_works: false,
        conclusion: 'A generic tool does not store persistent brand memory.',
      },
    },
  }

  assert(
    validateAngleDecision([unsupportedAngle], envelope).flags.includes(
      'angle_unsupported_category_claim'
    )
  )

  const disguisedComparison = {
    is_recommended: true,
    conversion_spine: {
      ...spine,
      swap_test: {
        replacement_offer:
          'A general-purpose AI writing tool that does not include persistent brand voice storage',
        story_still_works: false,
        conclusion:
          'The replacement does not include that stored-context mechanism.',
      },
    },
  }
  assert(
    validateAngleDecision([disguisedComparison], envelope).flags.includes(
      'angle_unsupported_category_claim'
    )
  )
})

Deno.test(
  'empty relevant Taste is valid and quality-only findings stay non-blocking',
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
    assertEquals(selected, null)
  }
)

Deno.test(
  'Jasper quality findings remain visible without forcing a revision',
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
    assertEquals(selected, null)
  }
)
