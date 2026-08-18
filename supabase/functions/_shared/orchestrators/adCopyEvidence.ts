import { z, type ZodTypeAny } from 'npm:zod@^3.24.0'

import { callAnthropicWithTool } from '../anthropicJson.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import {
  AdCopyEvidenceResponseSchema,
  BlindReaderSchema,
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
}): Promise<{ data: z.infer<T>; usage: Usage }> {
  const result = await callAnthropicWithTool({
    model: args.model ?? MODEL,
    systemPrompt: await loadActivePrompt(args.orchestrator, args.vertical),
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
    agent_version: 'evidence-story-v4',
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
      engine_version: 'evidence-story-v4',
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

export async function runAdCopyEvidence(
  input: EvidenceAdCopyInput
): Promise<{ output: Record<string, unknown>; usage: Usage; mode: 'real' }> {
  const vertical = input.verticalSlug ?? input.offer.vertical ?? undefined
  const research = await gatherCopyResearch({
    offerName: input.offer.name,
    vertical,
    additionalSourceUrls: input.additionalSourceUrls,
  })
  const total: Usage = { input_tokens: 0, output_tokens: 0, cost_usd: 0 }
  const spend = (usage: Usage) => {
    total.input_tokens += usage.input_tokens
    total.output_tokens += usage.output_tokens
    total.cost_usd += usage.cost_usd
    if (total.cost_usd >= MAX_USD)
      throw new Error(
        `Evidence-story generation hit the $${MAX_USD.toFixed(2)} cost cap.`
      )
  }

  const evidence = await stage({
    orchestrator: 'CopyExcavateProductOrchestrator',
    tool: 'submit_evidence_envelope',
    description: 'Submit the evidence envelope once.',
    schema: EvidenceEnvelopeSchema,
    vertical,
    payload: {
      offer: input.offer,
      verified_context: input.productContext ?? null,
      research_snapshots: research,
      optional_creative_hint: input.creativeHint ?? null,
      campaign_context: input.campaignContext ?? null,
    },
  })
  spend(evidence.usage)

  const avatar = await stage({
    orchestrator: 'CopyExcavateAvatarOrchestrator',
    tool: 'submit_avatar_excavation',
    description: 'Submit the avatar excavation once.',
    schema: AvatarExcavationSchema,
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
    vertical,
    payload: {
      angles: angles.data.angles,
      selected_angle_index: selectedIndex,
      evidence_envelope: evidence.data,
      avatar: avatar.data,
    },
  })
  spend(hooks.usage)

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
