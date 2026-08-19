import { z, type ZodTypeAny } from 'npm:zod@^3.24.0'

import { callAnthropicWithTool } from '../anthropicJson.ts'
import { loadActivePrompt, loadPromptVersion } from '../loadActivePrompt.ts'
import {
  AdCopyEvidenceResponseSchema,
  BlindReaderSchema,
  AgencyEvidenceVariantSchema,
  CopyCandidateReviewSchema,
  CopyDepartmentPlanSchema,
  CopyPortfolioDecisionSchema,
  EvidenceAngleSchema,
  EvidenceCriticSchema,
  EvidenceEnvelopeSchema,
  EvidenceHookSchema,
  EvidenceJudgeSchema,
  EvidenceVariantSchema,
  type AdCopyEvidenceResponse,
} from '../types/adCopyEvidence.ts'
import { AvatarExcavationSchema } from '../types/adCopy.ts'
import { gatherCopyResearch } from './adCopyEvidenceResearch.ts'
import { validateNarrativePolicy } from './adCopyEvidencePolicy.ts'
import { compileCopyBrainContext } from './copyBrainContext.ts'
import type { CopyBrainInputSnapshotV1 } from '../types/copyBrain.ts'

const MODEL = Deno.env.get('AD_COPY_MODEL') ?? 'claude-sonnet-4-6'
const JUDGE_MODEL = Deno.env.get('AD_COPY_JUDGE_MODEL') ?? MODEL
const MAX_USD = Number(Deno.env.get('AD_COPY_MAX_USD') ?? '0.75')
const MAX_REFINE = 2

const AnglesSchema = z.object({
  angles: z.array(EvidenceAngleSchema).min(1).max(5),
})
const HooksSchema = z.object({ hooks: z.array(EvidenceHookSchema).min(10) })
const VariantsSchema = z.object({
  variants: z.array(EvidenceVariantSchema).length(1),
})

export type EvidenceAdCopyInput = {
  offer: {
    id?: string
    name: string
    url?: string | null
    vertical?: string | null
    description?: string | null
  }
  productContext?: Record<string, unknown>
  deepBriefContext?: Record<string, unknown> | null
  avatarContext?: Record<string, unknown> | null
  spyContext?: Record<string, unknown> | null
  testKit?: unknown
  creativeHint?: string | null
  additionalSourceUrls?: string[]
  campaignContext?: {
    channel?: string | null
    geo?: string | null
    audience?: string | null
  }
  verticalSlug?: string
  brainSnapshot?: CopyBrainInputSnapshotV1
  promptVersions?: Record<string, string>
  promptContents?: Record<string, string>
}

type Usage = { input_tokens: number; output_tokens: number; cost_usd: number }

async function stage<T extends ZodTypeAny>(args: {
  orchestrator: string
  tool: string
  description: string
  schema: T
  payload: Record<string, unknown>
  vertical?: string
  model?: string
  version?: string
  frozenPromptContent?: string
}): Promise<{ data: z.infer<T>; usage: Usage }> {
  const result = await callAnthropicWithTool({
    model: args.model ?? MODEL,
    systemPrompt:
      args.frozenPromptContent ??
      (args.version
        ? await loadPromptVersion(
            args.orchestrator,
            args.version,
            args.vertical
          )
        : await loadActivePrompt(args.orchestrator, args.vertical)),
    userMessage: JSON.stringify(args.payload, null, 2),
    toolName: args.tool,
    toolDescription: args.description,
    responseSchema: args.schema,
  })
  return {
    data: result.data,
    usage: { ...result.usage, cost_usd: result.cost_usd },
  }
}

const blockedLicense = (reason: string) => ({
  mode: 'blocked' as const,
  decision_reason: reason,
  basis_outcome_ids: [] as string[],
  character_status: 'not_applicable' as const,
  voice_mode: 'non_story' as const,
  disclosure_required: false,
  allowed_inventions: [] as string[],
  forbidden_inventions: [
    'No story or result may be invented to fill the evidence gap.',
  ],
  fallback_format: null,
  requirements_met: false,
})

function assemble(parts: {
  envelope: z.infer<typeof EvidenceEnvelopeSchema>
  angles: z.infer<typeof EvidenceAngleSchema>[]
  hooks: z.infer<typeof EvidenceHookSchema>[]
  variants: z.infer<typeof EvidenceVariantSchema>[]
  reader: z.infer<typeof BlindReaderSchema> | null
  critic: z.infer<typeof EvidenceCriticSchema> | null
  judge: z.infer<typeof EvidenceJudgeSchema>
  selectedIndex: number | null
  refineIterations: number
  engineVersion?: 'evidence-story-v4' | 'evidence-agency-v5'
}): AdCopyEvidenceResponse {
  const selected =
    parts.selectedIndex === null ? null : parts.angles[parts.selectedIndex]
  const license =
    selected?.narrative_license ?? blockedLicense('No eligible angle exists.')
  const outputStatus =
    parts.envelope.research_status === 'insufficient'
      ? 'needs_evidence'
      : license.mode === 'blocked'
        ? 'blocked'
        : !parts.judge.compliance_ok || parts.judge.overall !== 'pass'
          ? 'compliance_review'
          : 'ready_for_user'
  const review = outputStatus !== 'ready_for_user'
  return AdCopyEvidenceResponseSchema.parse({
    orchestrator_name: 'AdCopyOrchestrator',
    agent_version: parts.engineVersion ?? 'evidence-story-v4',
    status: outputStatus === 'ready_for_user' ? 'success' : 'partial',
    confidence_score:
      outputStatus === 'ready_for_user'
        ? 90
        : outputStatus === 'compliance_review'
          ? 55
          : 25,
    facts: parts.envelope.supported_outcomes.map((outcome) => ({
      statement: outcome.statement,
      source: outcome.source_ids.join(','),
      confidence: outcome.typicality === 'representative' ? 90 : 70,
    })),
    assumptions:
      license.character_status === 'synthetic'
        ? [
            'Character and non-claim scene details are synthetic inside the evidence envelope.',
          ]
        : [],
    estimates: [],
    risks: parts.judge.kill_flags.map((flag) => ({
      type: flag,
      description: `Copy gate flagged ${flag}.`,
      severity: [
        'fake_testimonial',
        'claim_violation',
        'vulnerability_stack',
      ].includes(flag)
        ? 'critical'
        : 'high',
    })),
    unknowns: [],
    missing_data: parts.envelope.missing_data,
    human_review_required: review,
    human_review_reasons: review
      ? [
          outputStatus === 'needs_evidence'
            ? 'More evidence is required before honest conversion copy can be written.'
            : `Output status is ${outputStatus}.`,
        ]
      : [],
    payload: {
      engine_version: parts.engineVersion ?? 'evidence-story-v4',
      output_status: outputStatus,
      evidence_envelope: parts.envelope,
      narrative_license: license,
      angles: parts.angles,
      hooks: parts.hooks,
      variants: parts.variants,
      reader_report: parts.reader,
      critic_report: parts.critic,
      judge: parts.judge,
      refine_iterations: parts.refineIterations,
      trace: {
        source_snapshot_refs: parts.envelope.sources.map(
          (source) => source.snapshot_sha256
        ),
        selected_angle_index: parts.selectedIndex,
      },
      user_message:
        outputStatus === 'ready_for_user'
          ? 'הקופי מוכן לעבודה.'
          : outputStatus === 'needs_evidence'
            ? `חסרות ראיות: ${parts.envelope.missing_data.join('; ')}`
            : 'הקופי נשמר לבדיקה ולא סומן כמוכן לפרסום.',
    },
  })
}

function tokenSimilarity(left: string, right: string): number {
  const words = (value: string) =>
    new Set(
      value
        .toLowerCase()
        .split(/\s+/)
        .filter((word) => word.length > 2)
    )
  const a = words(left)
  const b = words(right)
  if (a.size === 0 || b.size === 0) return 0
  const intersection = [...a].filter((word) => b.has(word)).length
  return intersection / (a.size + b.size - intersection)
}

function assembleAgency(parts: {
  envelope: z.infer<typeof EvidenceEnvelopeSchema>
  angles: z.infer<typeof EvidenceAngleSchema>[]
  hooks: z.infer<typeof EvidenceHookSchema>[]
  departmentPlan: z.infer<typeof CopyDepartmentPlanSchema>
  candidates: z.infer<typeof AgencyEvidenceVariantSchema>[]
  reviews: z.infer<typeof CopyCandidateReviewSchema>[]
  portfolio: z.infer<typeof CopyPortfolioDecisionSchema>
}): AdCopyEvidenceResponse {
  const safeIds = new Set(
    parts.reviews
      .filter(
        (review) =>
          review.judge.overall === 'pass' &&
          review.judge.compliance_ok &&
          review.judge.kill_flags.length === 0 &&
          review.critic.kill_flags.length === 0
      )
      .map((review) => review.candidate_id)
  )
  const ranked: z.infer<typeof AgencyEvidenceVariantSchema>[] = []
  for (const candidateId of parts.portfolio.ranked_candidate_ids) {
    const candidate = parts.candidates.find(
      (item) => item.candidate_id === candidateId && safeIds.has(candidateId)
    )
    if (!candidate) continue
    if (
      ranked.some(
        (existing) =>
          existing.test_hypothesis === candidate.test_hypothesis ||
          tokenSimilarity(existing.primary_text, candidate.primary_text) >= 0.8
      )
    )
      continue
    ranked.push(candidate)
    if (ranked.length === 3) break
  }
  const recommended = ranked[0] ?? null
  const topReview =
    parts.reviews.find(
      (review) => review.candidate_id === recommended?.candidate_id
    ) ?? parts.reviews[0]
  const selectedAngleIndex = recommended?.angle_index ?? 0
  const selectedAngle = parts.angles[selectedAngleIndex] ?? parts.angles[0]
  const outputStatus =
    ranked.length > 0 ? 'ready_for_user' : 'compliance_review'
  return AdCopyEvidenceResponseSchema.parse({
    orchestrator_name: 'AdCopyOrchestrator',
    agent_version: 'evidence-agency-v5',
    status: outputStatus === 'ready_for_user' ? 'success' : 'partial',
    confidence_score: outputStatus === 'ready_for_user' ? 90 : 45,
    facts: parts.envelope.supported_outcomes.map((outcome) => ({
      statement: outcome.statement,
      source: outcome.source_ids.join(','),
      confidence: outcome.typicality === 'representative' ? 90 : 70,
    })),
    assumptions:
      selectedAngle.narrative_license.character_status === 'synthetic'
        ? [
            'Character and non-claim scene details are synthetic inside the evidence envelope.',
          ]
        : [],
    estimates: [],
    risks: (topReview?.judge.kill_flags ?? []).map((flag) => ({
      type: flag,
      description: `Copy gate flagged ${flag}.`,
      severity: 'high',
    })),
    unknowns: [],
    missing_data: parts.envelope.missing_data,
    human_review_required: outputStatus !== 'ready_for_user',
    human_review_reasons:
      outputStatus === 'ready_for_user'
        ? []
        : [
            'No safe, materially distinct candidate passed every independent gate.',
          ],
    payload: {
      engine_version: 'evidence-agency-v5',
      output_status: outputStatus,
      evidence_envelope: parts.envelope,
      narrative_license: selectedAngle.narrative_license,
      angles: parts.angles,
      hooks: parts.hooks,
      variants: ranked,
      department_plan: parts.departmentPlan,
      recommended_candidate_id: recommended?.candidate_id ?? null,
      candidate_reviews: parts.reviews,
      portfolio_decision: {
        ...parts.portfolio,
        ranked_candidate_ids: ranked.map((candidate) => candidate.candidate_id),
      },
      reader_report: topReview?.reader ?? null,
      critic_report: topReview?.critic ?? null,
      judge: topReview?.judge ?? {
        principles: [
          {
            principle: 'product_understanding',
            verdict: 'fail',
            reason: 'No candidate passed.',
          },
          {
            principle: 'eye_level_authentic',
            verdict: 'fail',
            reason: 'No candidate passed.',
          },
          {
            principle: 'depth_without_exaggeration',
            verdict: 'fail',
            reason: 'No candidate passed.',
          },
        ],
        compliance_ok: false,
        overall: 'fail',
        calibrated: false,
        notes: 'No candidate passed.',
        kill_flags: ['boring'],
        evidence: ['Portfolio has no publishable candidate.'],
      },
      refine_iterations: 0,
      trace: {
        source_snapshot_refs: parts.envelope.sources.map(
          (source) => source.snapshot_sha256
        ),
        selected_angle_index: recommended ? selectedAngleIndex : null,
        candidate_ids: parts.candidates.map(
          (candidate) => candidate.candidate_id
        ),
      },
      user_message:
        outputStatus === 'ready_for_user'
          ? `נבחרה מודעה מובילה ונשמרו ${Math.max(0, ranked.length - 1)} חלופות שבודקות השערות שונות.`
          : 'לא נמצאה חלופה בטוחה ומובחנת שמוכנה לפרסום.',
    },
  })
}

export async function runAdCopyEvidence(
  input: EvidenceAdCopyInput
): Promise<{ output: Record<string, unknown>; usage: Usage; mode: 'real' }> {
  const vertical = input.verticalSlug ?? input.offer.vertical ?? undefined
  const agencyEnabled = Boolean(
    Deno.env.get('AD_COPY_AGENCY_V5_ENABLED') === 'true' ||
    input.promptContents?.CopyDirectorOrchestrator ||
    input.promptVersions?.CopyDirectorOrchestrator
  )
  const costCap = agencyEnabled
    ? Number(Deno.env.get('AD_COPY_AGENCY_MAX_USD') ?? '2.25')
    : MAX_USD
  const compiled = input.brainSnapshot
    ? compileCopyBrainContext(input.brainSnapshot)
    : null
  const research = input.brainSnapshot
    ? []
    : await gatherCopyResearch({
        offerName: input.offer.name,
        vertical,
        additionalSourceUrls: input.additionalSourceUrls,
      })
  const total: Usage = { input_tokens: 0, output_tokens: 0, cost_usd: 0 }
  const spend = (usage: Usage) => {
    total.input_tokens += usage.input_tokens
    total.output_tokens += usage.output_tokens
    total.cost_usd += usage.cost_usd
    if (total.cost_usd >= costCap)
      throw new Error(
        `Evidence-story generation hit the $${costCap.toFixed(2)} cost cap.`
      )
  }

  const evidence = await stage({
    orchestrator: 'CopyExcavateProductOrchestrator',
    tool: 'submit_evidence_envelope',
    description: 'Submit the evidence envelope once.',
    schema: EvidenceEnvelopeSchema,
    version: input.promptVersions?.CopyExcavateProductOrchestrator,
    frozenPromptContent: input.promptContents?.CopyExcavateProductOrchestrator,
    vertical,
    payload: {
      offer: input.offer,
      verified_context: compiled?.context ?? input.productContext ?? null,
      research_snapshots: research,
      optional_creative_hint: input.creativeHint ?? null,
      campaign_context: input.campaignContext ?? null,
    },
  })
  spend(evidence.usage)

  const frozenAvatar = input.brainSnapshot?.avatar ?? null
  const avatar = frozenAvatar
    ? {
        data: frozenAvatar,
        usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
      }
    : await stage({
        orchestrator: 'CopyExcavateAvatarOrchestrator',
        tool: 'submit_avatar_excavation',
        description: 'Submit the avatar excavation once.',
        schema: AvatarExcavationSchema,
        version: input.promptVersions?.CopyExcavateAvatarOrchestrator,
        frozenPromptContent:
          input.promptContents?.CopyExcavateAvatarOrchestrator,
        vertical,
        payload: {
          offer: input.offer,
          evidence_envelope: evidence.data,
          upstream_avatar: input.avatarContext ?? null,
          deep_brief: input.deepBriefContext ?? null,
        },
      })
  spend(avatar.usage)

  const angles = await stage({
    orchestrator: 'CopyAngleOrchestrator',
    tool: 'submit_angles',
    description: 'Submit evidence-licensed angles once.',
    schema: AnglesSchema,
    version: input.promptVersions?.CopyAngleOrchestrator,
    frozenPromptContent: input.promptContents?.CopyAngleOrchestrator,
    vertical,
    payload: {
      offer: input.offer,
      evidence_envelope: evidence.data,
      avatar: avatar.data,
      deep_brief: input.deepBriefContext ?? null,
      test_kit: input.testKit ?? null,
      spy: input.spyContext ?? null,
      optional_creative_hint: input.creativeHint ?? null,
      campaign_context: input.campaignContext ?? null,
    },
  })
  spend(angles.usage)

  const selectedIndex = Math.max(
    0,
    angles.data.angles.findIndex((angle) => angle.is_recommended)
  )
  const selected = angles.data.angles[selectedIndex]
  const policyFlags = validateNarrativePolicy(
    evidence.data,
    selected.narrative_license
  ) as z.infer<typeof EvidenceJudgeSchema>['kill_flags']
  const emptyJudge = (
    flags: z.infer<typeof EvidenceJudgeSchema>['kill_flags']
  ) => ({
    principles: [
      {
        principle: 'product_understanding' as const,
        verdict: 'fail' as const,
        reason: 'Insufficient evidence.',
      },
      {
        principle: 'eye_level_authentic' as const,
        verdict: 'fail' as const,
        reason: 'No publishable copy was generated.',
      },
      {
        principle: 'depth_without_exaggeration' as const,
        verdict: 'fail' as const,
        reason: 'The engine stopped instead of exaggerating.',
      },
    ],
    compliance_ok: true,
    overall: 'fail' as const,
    calibrated: false as const,
    notes: 'Evidence gate stopped generation.',
    kill_flags: flags,
    evidence: evidence.data.missing_data.length
      ? evidence.data.missing_data
      : ['The deterministic narrative policy rejected the selected license.'],
  })
  if (
    evidence.data.research_status === 'insufficient' ||
    selected.narrative_license.mode === 'blocked' ||
    policyFlags.length > 0
  ) {
    const output = assemble({
      envelope: evidence.data,
      angles: angles.data.angles,
      hooks: [],
      variants: [],
      reader: null,
      critic: null,
      judge: emptyJudge(
        policyFlags.length ? policyFlags : ['evidence_threshold_unmet']
      ),
      selectedIndex,
      refineIterations: 0,
      engineVersion: agencyEnabled ? 'evidence-agency-v5' : 'evidence-story-v4',
    })
    return {
      output: output as unknown as Record<string, unknown>,
      usage: total,
      mode: 'real',
    }
  }

  const hooks = await stage({
    orchestrator: 'CopyHookOrchestrator',
    tool: 'submit_hooks',
    description: 'Submit Hebrew evidence-bound hooks once.',
    schema: HooksSchema,
    version: input.promptVersions?.CopyHookOrchestrator,
    frozenPromptContent: input.promptContents?.CopyHookOrchestrator,
    vertical,
    payload: {
      angles: angles.data.angles,
      selected_angle_index: selectedIndex,
      evidence_envelope: evidence.data,
      avatar: avatar.data,
    },
  })
  spend(hooks.usage)

  if (agencyEnabled) {
    const directed = await stage({
      orchestrator: 'CopyDirectorOrchestrator',
      tool: 'submit_copy_department_plan',
      description:
        'Route distinct evidence-bound candidates to specialist writers.',
      schema: CopyDepartmentPlanSchema,
      version: input.promptVersions?.CopyDirectorOrchestrator,
      frozenPromptContent: input.promptContents?.CopyDirectorOrchestrator,
      vertical,
      payload: {
        offer: input.offer,
        evidence_envelope: evidence.data,
        avatar: avatar.data,
        angles: angles.data.angles,
        campaign_context: input.campaignContext ?? null,
        spy_intelligence: input.brainSnapshot
          ? {
              analyses: input.brainSnapshot.spy_analyses,
              market_examples: input.brainSnapshot.market_examples,
              measured_winners: input.brainSnapshot.performance_winners,
            }
          : (input.spyContext ?? null),
      },
    })
    spend(directed.usage)

    const candidates: z.infer<typeof AgencyEvidenceVariantSchema>[] = []
    const reviews: z.infer<typeof CopyCandidateReviewSchema>[] = []
    const writerBySpecialist = {
      storytelling: 'CopyStorytellingWriterOrchestrator',
      direct_response: 'CopyDirectResponseWriterOrchestrator',
      proof_mechanism: 'CopyProofMechanismWriterOrchestrator',
    } as const
    for (const brief of directed.data.candidate_briefs) {
      const angle = angles.data.angles[brief.angle_index]
      if (!angle) continue
      const deterministicFlags = validateNarrativePolicy(
        evidence.data,
        angle.narrative_license
      )
      if (deterministicFlags.length > 0) continue
      const orchestrator = writerBySpecialist[brief.specialist]
      const written = await stage({
        orchestrator,
        tool: 'submit_copy_candidate',
        description: 'Submit one Hebrew specialist candidate.',
        schema: AgencyEvidenceVariantSchema,
        version: input.promptVersions?.[orchestrator],
        frozenPromptContent: input.promptContents?.[orchestrator],
        vertical,
        payload: {
          candidate_brief: brief,
          offer: input.offer,
          evidence_envelope: evidence.data,
          narrative_license: angle.narrative_license,
          conversion_spine: angle.conversion_spine,
          avatar: avatar.data,
          selected_hook:
            hooks.data.hooks.find(
              (hook) => hook.angle_index === brief.angle_index
            ) ?? hooks.data.hooks[0],
          campaign_context: input.campaignContext ?? null,
        },
      })
      spend(written.usage)
      const candidate = AgencyEvidenceVariantSchema.parse({
        ...written.data,
        candidate_id: brief.candidate_id,
        specialist: brief.specialist,
        test_hypothesis: brief.test_hypothesis,
        angle_index: brief.angle_index,
      })
      candidates.push(candidate)

      const read = await stage({
        orchestrator: 'CopyReaderOrchestrator',
        tool: 'submit_reader_report',
        description: 'Submit the blind reader report.',
        schema: BlindReaderSchema,
        version: input.promptVersions?.CopyReaderOrchestrator,
        frozenPromptContent: input.promptContents?.CopyReaderOrchestrator,
        vertical,
        payload: {
          text: candidate.primary_text,
          block_ids: candidate.block_ids,
        },
      })
      spend(read.usage)
      const critiqued = await stage({
        orchestrator: 'CopyCriticOrchestrator',
        tool: 'submit_critic_report',
        description: 'Submit the evidence critic report.',
        schema: EvidenceCriticSchema,
        version: input.promptVersions?.CopyCriticOrchestrator,
        frozenPromptContent: input.promptContents?.CopyCriticOrchestrator,
        vertical,
        payload: {
          evidence_envelope: evidence.data,
          narrative_license: angle.narrative_license,
          conversion_spine: angle.conversion_spine,
          line_purpose_map: candidate.line_purpose_map,
          reader_report: read.data,
        },
      })
      spend(critiqued.usage)
      const judged = await stage({
        orchestrator: 'CopyJudgeOrchestrator',
        tool: 'submit_copy_judgment',
        description: 'Submit the structured copy judgment.',
        schema: EvidenceJudgeSchema,
        version: input.promptVersions?.CopyJudgeOrchestrator,
        frozenPromptContent: input.promptContents?.CopyJudgeOrchestrator,
        model: JUDGE_MODEL,
        vertical,
        payload: {
          variant: candidate,
          evidence_envelope: evidence.data,
          narrative_license: angle.narrative_license,
          conversion_spine: angle.conversion_spine,
          reader_report: read.data,
          critic_report: critiqued.data,
          campaign_context: input.campaignContext ?? null,
        },
      })
      spend(judged.usage)
      reviews.push({
        candidate_id: brief.candidate_id,
        reader: read.data,
        critic: critiqued.data,
        judge: judged.data,
      })
    }

    const portfolio =
      candidates.length > 0
        ? await stage({
            orchestrator: 'CopyPortfolioJudgeOrchestrator',
            tool: 'submit_copy_portfolio_decision',
            description:
              'Rank only safe and materially distinct copy candidates.',
            schema: CopyPortfolioDecisionSchema,
            version: input.promptVersions?.CopyPortfolioJudgeOrchestrator,
            frozenPromptContent:
              input.promptContents?.CopyPortfolioJudgeOrchestrator,
            model: JUDGE_MODEL,
            vertical,
            payload: {
              department_plan: directed.data,
              candidates,
              independent_reviews: reviews,
              evidence_envelope: evidence.data,
              campaign_context: input.campaignContext ?? null,
            },
          })
        : {
            data: {
              ranked_candidate_ids: [],
              selection_reason:
                'All routed candidates failed deterministic policy validation.',
              rejected_candidates: directed.data.candidate_briefs.map(
                (brief) => ({
                  candidate_id: brief.candidate_id,
                  reason: 'deterministic_policy_rejection',
                })
              ),
            },
            usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
          }
    spend(portfolio.usage)
    const output = assembleAgency({
      envelope: evidence.data,
      angles: angles.data.angles,
      hooks: hooks.data.hooks,
      departmentPlan: directed.data,
      candidates,
      reviews,
      portfolio: portfolio.data,
    })
    return {
      output: output as unknown as Record<string, unknown>,
      usage: total,
      mode: 'real',
    }
  }

  let variants: z.infer<typeof VariantsSchema>
  let reader: z.infer<typeof BlindReaderSchema>
  let critic: z.infer<typeof EvidenceCriticSchema>
  let judge: z.infer<typeof EvidenceJudgeSchema>
  let refineIterations = 0
  let previousJudgment: z.infer<typeof EvidenceJudgeSchema> | null = null

  do {
    const written = await stage({
      orchestrator: 'CopyWriteOrchestrator',
      tool: 'submit_ad_copy',
      description: 'Submit one Hebrew evidence-bound variant.',
      schema: VariantsSchema,
      version: input.promptVersions?.CopyWriteOrchestrator,
      frozenPromptContent: input.promptContents?.CopyWriteOrchestrator,
      vertical,
      payload: {
        offer: input.offer,
        evidence_envelope: evidence.data,
        narrative_license: selected.narrative_license,
        conversion_spine: selected.conversion_spine,
        avatar: avatar.data,
        selected_hook:
          hooks.data.hooks.find((hook) => hook.is_recommended) ??
          hooks.data.hooks[0],
        campaign_context: input.campaignContext ?? null,
        previous_judgment: previousJudgment,
      },
    })
    spend(written.usage)
    variants = written.data

    const read = await stage({
      orchestrator: 'CopyReaderOrchestrator',
      tool: 'submit_reader_report',
      description: 'Submit the blind reader report.',
      schema: BlindReaderSchema,
      version: input.promptVersions?.CopyReaderOrchestrator,
      frozenPromptContent: input.promptContents?.CopyReaderOrchestrator,
      vertical,
      payload: {
        text: variants.variants[0].primary_text,
        block_ids: variants.variants[0].block_ids,
      },
    })
    spend(read.usage)
    reader = read.data

    const critiqued = await stage({
      orchestrator: 'CopyCriticOrchestrator',
      tool: 'submit_critic_report',
      description: 'Submit the evidence critic report.',
      schema: EvidenceCriticSchema,
      version: input.promptVersions?.CopyCriticOrchestrator,
      frozenPromptContent: input.promptContents?.CopyCriticOrchestrator,
      vertical,
      payload: {
        evidence_envelope: evidence.data,
        narrative_license: selected.narrative_license,
        conversion_spine: selected.conversion_spine,
        line_purpose_map: variants.variants[0].line_purpose_map,
        reader_report: reader,
      },
    })
    spend(critiqued.usage)
    critic = critiqued.data

    const judged = await stage({
      orchestrator: 'CopyJudgeOrchestrator',
      tool: 'submit_copy_judgment',
      description: 'Submit the structured copy judgment.',
      schema: EvidenceJudgeSchema,
      version: input.promptVersions?.CopyJudgeOrchestrator,
      frozenPromptContent: input.promptContents?.CopyJudgeOrchestrator,
      model: JUDGE_MODEL,
      vertical,
      payload: {
        variant: variants.variants[0],
        evidence_envelope: evidence.data,
        narrative_license: selected.narrative_license,
        conversion_spine: selected.conversion_spine,
        reader_report: reader,
        critic_report: critic,
        campaign_context: input.campaignContext ?? null,
      },
    })
    spend(judged.usage)
    judge = judged.data
    previousJudgment = judge
    if (judge.overall === 'pass' || refineIterations >= MAX_REFINE) break
    refineIterations++
  } while (true)

  const output = assemble({
    envelope: evidence.data,
    angles: angles.data.angles,
    hooks: hooks.data.hooks,
    variants: variants!.variants,
    reader: reader!,
    critic: critic!,
    judge: judge!,
    selectedIndex,
    refineIterations,
  })
  return {
    output: output as unknown as Record<string, unknown>,
    usage: total,
    mode: 'real',
  }
}
