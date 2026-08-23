import { z, type ZodTypeAny } from 'npm:zod@^3.24.0'

import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
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
import { compileCopyExecutionBriefV2 } from './copyExecutionBrief.ts'
import type { CopyBrainInputSnapshotV1 } from '../types/copyBrain.ts'
import {
  finalizeDepartmentDecision,
  normalizeCopyGateReport,
  selectCandidateHook,
  selectRevisionCandidate,
  normalizePermittedSyntheticCharacterFlags,
  normalizeTasteKillFlag,
  selectEligibleAngles,
  tasteRequirementStatus as rawTasteRequirementStatus,
  validateAngleDecision,
  validateCandidateClaims,
  validateDepartmentPlan,
  validateHookCoverage as rawValidateHookCoverage,
} from '../brainContracts/validateAgencyContracts.ts'

const MODEL =
  Deno.env.get('AD_COPY_PREP_MODEL') ??
  Deno.env.get('AD_COPY_MODEL') ??
  'claude-sonnet-4-6'
const LEGACY_JUDGE_MODEL = Deno.env.get('AD_COPY_JUDGE_MODEL') ?? MODEL
const STRONG_MODEL = Deno.env.get('AD_COPY_STRONG_MODEL') ?? 'claude-opus-4-6'
const WRITER_MODEL = Deno.env.get('AD_COPY_WRITER_MODEL') ?? STRONG_MODEL
const V6_JUDGE_MODEL = Deno.env.get('AD_COPY_V6_JUDGE_MODEL') ?? STRONG_MODEL
const MAX_USD = Number(Deno.env.get('AD_COPY_MAX_USD') ?? '0.75')
const MAX_REFINE = 2

export type CopyModelProfile = 'production' | 'economy_smoke'

export const resolveEvidenceStageModel = (
  profile: CopyModelProfile | undefined,
  preferredModel: string,
  prepModel = MODEL
) => (profile === 'economy_smoke' ? prepModel : preferredModel)

// CopyAngle v8 returns several nested evidence and causality fields per angle.
// The former 4,096-token default truncated every Sonnet attempt in the smoke
// run (12,288 output tokens across three attempts), leaving an empty tool
// input. Two concise angles preserve a real strategic choice while the larger
// ceiling prevents transport truncation.
export const ANGLE_STAGE_MAX_TOKENS = 8192
export const ANGLE_STAGE_MAX_RETRIES = 2
export const ANGLE_TOOL_DESCRIPTION =
  'Submit exactly 2 concise, materially distinct evidence-licensed angles in one call.'

// Sonnet occasionally submits one valid AngleV8 directly even though the tool
// JSON Schema and prompt both require { angles: [...] }. This adapter repairs
// only that outer transport shape. The angle itself still has to satisfy the
// complete EvidenceAngleSchema and all deterministic angle gates.
export const normalizeAnglesToolInput = (rawInput: unknown): unknown => {
  if (!rawInput || typeof rawInput !== 'object' || Array.isArray(rawInput)) {
    return rawInput
  }
  const record = rawInput as Record<string, unknown>
  if ('angles' in record) return rawInput
  if (
    'angle_id' in record &&
    'is_recommended' in record &&
    'narrative_license' in record
  ) {
    return { angles: [rawInput] }
  }
  return rawInput
}

const AnglesSchema = z.object({
  angles: z.array(EvidenceAngleSchema).min(1).max(5),
})
const HooksSchema = z.object({ hooks: z.array(EvidenceHookSchema).min(10) })
const AgencyV7HookSchema = EvidenceHookSchema.extend({
  candidate_id: z.string().min(1),
  is_recommended: z.boolean(),
})
const AgencyV7HooksSchema = z.object({
  hooks: z.array(AgencyV7HookSchema).min(3),
})
const AgencyV7VariantSchema = AgencyEvidenceVariantSchema.extend({
  consumed_doctrine_lesson_ids: z.array(z.string().min(1)).min(1),
  consumed_taste_example_ids: z.array(z.string().min(1)),
  revision_number: z.number().int().min(0).max(1),
})
type TasteRequirementStatus =
  | 'loaded'
  | 'none_available'
  | 'required_but_not_consumed'
  | 'claimed_but_not_available'
const tasteRequirementStatus = rawTasteRequirementStatus as (
  selection: unknown,
  consumedIds?: string[]
) => TasteRequirementStatus
const validateHookCoverage = rawValidateHookCoverage as (
  plan: unknown,
  hooks: unknown[]
) => { pass: boolean; flags: string[]; details: string[] }

const normalizeRuntimeGateReport = <T extends Record<string, unknown>>(
  report: T,
  status: TasteRequirementStatus
) =>
  normalizeCopyGateReport(
    normalizePermittedSyntheticCharacterFlags(
      normalizeTasteKillFlag(report, status)
    )
  ) as T

const shortHyphens = (value: string) => value.replace(/[—–]/gu, '-')

export const normalizeHookSurface = <T extends { text: string }>(
  hook: T
): T => ({
  ...hook,
  text: shortHyphens(hook.text),
})

const normalizeCandidateSurface = <
  T extends z.infer<typeof AgencyEvidenceVariantSchema>,
>(
  candidate: T
): T => {
  const hook = shortHyphens(candidate.hook).trim()
  let primaryText = shortHyphens(candidate.primary_text).trim()
  if (hook && primaryText.startsWith(hook)) {
    primaryText = primaryText.slice(hook.length).replace(/^\s+/, '')
  }
  return {
    ...candidate,
    hook,
    primary_text: primaryText,
    headline: shortHyphens(candidate.headline),
    subheadline: shortHyphens(candidate.subheadline),
  }
}
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
    objective_type?:
      | 'sale'
      | 'lead'
      | 'donation'
      | 'trial'
      | 'signup'
      | 'affiliate_recruitment'
    desired_action?: string | null
    audience_side?: 'consumer' | 'affiliate_marketer' | 'donor'
  }
  verticalSlug?: string
  brainSnapshot?: CopyBrainInputSnapshotV1
  promptVersions?: Record<string, string>
  promptContents?: Record<string, string>
  modelProfile?: CopyModelProfile
}

export type Usage = {
  input_tokens: number
  output_tokens: number
  cost_usd: number
}

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
  inputNormalizer?: (rawInput: unknown) => unknown
  maxTokens?: number
  maxRetries?: number
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
    inputNormalizer: args.inputNormalizer,
    maxTokens: args.maxTokens,
    maxRetries: args.maxRetries,
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

type ExecutionBriefV2 = ReturnType<typeof compileCopyExecutionBriefV2>

function snapshotWithCampaignInput(input: EvidenceAdCopyInput) {
  if (!input.brainSnapshot) return null
  return {
    ...input.brainSnapshot,
    campaign_context: {
      ...input.brainSnapshot.campaign_context,
      audience:
        input.campaignContext?.audience ??
        input.brainSnapshot.campaign_context.audience,
      objective_type:
        input.campaignContext?.objective_type ??
        input.brainSnapshot.campaign_context.objective_type,
      desired_action:
        input.campaignContext?.desired_action ??
        input.brainSnapshot.campaign_context.desired_action,
      audience_side:
        input.campaignContext?.audience_side ??
        input.brainSnapshot.campaign_context.audience_side,
    },
  }
}

const readinessFlags = (
  brief: ExecutionBriefV2
): z.infer<typeof EvidenceJudgeSchema>['kill_flags'] => {
  const flags: z.infer<typeof EvidenceJudgeSchema>['kill_flags'] = []
  if (brief.critical_missing.includes('campaign_objective'))
    flags.push('objective_unknown')
  if (
    brief.critical_missing.includes('consumer_audience') ||
    brief.critical_missing.includes('avatar_v2')
  )
    flags.push('audience_unknown')
  if (brief.conflicts.length) flags.push('objective_mismatch')
  if (!brief.doctrine_bundle.active_lesson_ids.length)
    flags.push('doctrine_bundle_mismatch')
  // Empty taste is a trace warning, not a block. It becomes a kill flag only
  // when a later stage falsely claims that examples were consumed.
  return [...new Set(flags)]
}

const candidatePreflightFlags = (
  candidate: z.infer<typeof AgencyEvidenceVariantSchema>,
  executionBrief?: ExecutionBriefV2 | null,
  evidence?: z.infer<typeof EvidenceEnvelopeSchema>,
  selectedHook?: z.infer<typeof AgencyV7HookSchema> | null
): z.infer<typeof EvidenceJudgeSchema>['kill_flags'] => {
  const flags: z.infer<typeof EvidenceJudgeSchema>['kill_flags'] = []
  const hook = candidate.hook.replace(/\s+/g, ' ').trim()
  const body = candidate.primary_text.replace(/\s+/g, ' ').trim()
  if (hook && (body === hook || body.startsWith(`${hook} `)))
    flags.push('hook_body_duplicate')
  if (selectedHook && hook !== selectedHook.text.replace(/\s+/g, ' ').trim())
    flags.push('hook_assignment_mismatch')
  if (executionBrief) {
    const doctrineIds = new Set(
      executionBrief.doctrine_bundle.active_lesson_ids
    )
    if (
      !candidate.consumed_doctrine_lesson_ids?.length ||
      candidate.consumed_doctrine_lesson_ids.some(
        (lessonId) => !doctrineIds.has(lessonId)
      )
    )
      flags.push('doctrine_bundle_mismatch')
    const tasteStatus = tasteRequirementStatus(
      executionBrief.taste_selection,
      candidate.consumed_taste_example_ids ?? []
    )
    if (
      tasteStatus === 'required_but_not_consumed' ||
      tasteStatus === 'claimed_but_not_available'
    )
      flags.push('taste_not_loaded')
  }
  if (evidence)
    flags.push(
      ...(validateCandidateClaims(candidate, evidence).flags as z.infer<
        typeof EvidenceJudgeSchema
      >['kill_flags'])
    )
  return [...new Set(flags)]
}

function assembleInputBlocked(
  brief: ExecutionBriefV2,
  engineVersion:
    | 'evidence-agency-v6'
    | 'evidence-agency-v7'
    | 'evidence-agency-v9' = 'evidence-agency-v6'
): AdCopyEvidenceResponse {
  const flags = readinessFlags(brief)
  const envelope = {
    research_status: 'insufficient' as const,
    real_problem: '',
    real_solution: '',
    sources: [],
    supported_outcomes: [],
    allowed_scene_inventions: [],
    source_required_elements: [],
    forbidden_escalations: [],
    vulnerability_constraints: [],
    missing_data: [
      ...brief.critical_missing,
      ...brief.conflicts.map((item) => item.code),
    ],
  }
  const judge = {
    principles: [
      {
        principle: 'product_understanding' as const,
        verdict: 'fail' as const,
        reason:
          'Consumer offer, audience and objective are not yet a coherent execution target.',
      },
      {
        principle: 'eye_level_authentic' as const,
        verdict: 'fail' as const,
        reason: 'Writing was stopped before generic persona invention.',
      },
      {
        principle: 'depth_without_exaggeration' as const,
        verdict: 'fail' as const,
        reason: 'Missing upstream input was preserved instead of guessed.',
      },
    ],
    compliance_ok: true,
    overall: 'fail' as const,
    calibrated: false as const,
    notes:
      'CopyExecutionBriefV2 readiness gate stopped generation before any model call.',
    kill_flags: flags,
    evidence: envelope.missing_data,
  }
  return AdCopyEvidenceResponseSchema.parse({
    orchestrator_name: 'AdCopyOrchestrator',
    agent_version: engineVersion,
    status: 'partial',
    confidence_score: 20,
    facts: [],
    assumptions: [],
    estimates: [],
    risks: flags.map((flag) => ({
      type: flag,
      description: `Copy input gate flagged ${flag}.`,
      severity: 'high' as const,
    })),
    unknowns: brief.critical_missing,
    missing_data: envelope.missing_data,
    human_review_required: true,
    human_review_reasons: [
      'Complete and freeze the upstream audience, avatar and campaign objective before copy generation.',
    ],
    payload: {
      engine_version: engineVersion,
      output_status: 'blocked',
      evidence_envelope: envelope,
      narrative_license: blockedLicense(
        'Execution brief is not ready to write.'
      ),
      angles: [],
      hooks: [],
      variants: [],
      reader_report: null,
      critic_report: null,
      judge,
      refine_iterations: 0,
      trace: {
        source_snapshot_refs: [],
        selected_angle_index: null,
        execution_brief: brief,
        doctrine_lesson_ids: brief.doctrine_bundle.active_lesson_ids,
        taste_selection_count: brief.taste_selection.selected.length,
        preflight_flags: flags,
        models: {},
      },
      user_message: `הקופי לא נכתב כדי לא להמציא קהל או מטרה. חסר: ${envelope.missing_data.join('; ')}`,
    },
  })
}

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
  engineVersion?:
    | 'evidence-story-v4'
    | 'evidence-agency-v5'
    | 'evidence-agency-v6'
    | 'evidence-agency-v7'
    | 'evidence-agency-v9'
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
  executionBrief: ExecutionBriefV2 | null
  engineVersion:
    | 'evidence-agency-v5'
    | 'evidence-agency-v6'
    | 'evidence-agency-v7'
    | 'evidence-agency-v9'
  envelope: z.infer<typeof EvidenceEnvelopeSchema>
  angles: z.infer<typeof EvidenceAngleSchema>[]
  hooks: z.infer<typeof EvidenceHookSchema>[]
  departmentPlan: z.infer<typeof CopyDepartmentPlanSchema>
  candidates: z.infer<typeof AgencyEvidenceVariantSchema>[]
  reviews: z.infer<typeof CopyCandidateReviewSchema>[]
  portfolio: z.infer<typeof CopyPortfolioDecisionSchema>
  contractTrace?: {
    angle_validation?: Record<string, unknown>
    department_plan_validation?: Record<string, unknown>
    hook_coverage?: Record<string, unknown>
    taste_requirement_status?:
      | 'loaded'
      | 'none_available'
      | 'required_but_not_consumed'
      | 'claimed_but_not_available'
    revision?: Record<string, unknown>
  }
}): AdCopyEvidenceResponse {
  const normalizedReviews = parts.reviews.map((review) => ({
    ...review,
    critic: normalizeCopyGateReport(
      normalizePermittedSyntheticCharacterFlags(review.critic)
    ),
    judge: normalizeCopyGateReport(
      normalizePermittedSyntheticCharacterFlags(review.judge)
    ),
  })) as z.infer<typeof CopyCandidateReviewSchema>[]
  const departmentDecision = finalizeDepartmentDecision(
    parts.candidates,
    normalizedReviews,
    parts.portfolio
  )
  const safeIds = new Set(
    departmentDecision.ready_candidates.map(
      (candidate: { candidate_id: string }) => candidate.candidate_id
    )
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
    normalizedReviews.find(
      (review) => review.candidate_id === recommended?.candidate_id
    ) ?? normalizedReviews[0]
  const selectedAngleIndex = recommended?.angle_index ?? 0
  const selectedAngle = parts.angles[selectedAngleIndex] ?? parts.angles[0]
  const outputStatus =
    ranked.length > 0 ? 'ready_for_user' : 'compliance_review'
  return AdCopyEvidenceResponseSchema.parse({
    orchestrator_name: 'AdCopyOrchestrator',
    agent_version: parts.engineVersion,
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
      engine_version: parts.engineVersion,
      output_status: outputStatus,
      evidence_envelope: parts.envelope,
      narrative_license: selectedAngle.narrative_license,
      angles: parts.angles,
      hooks: parts.hooks,
      variants: ranked,
      department_plan: parts.departmentPlan,
      recommended_candidate_id: recommended?.candidate_id ?? null,
      candidate_reviews: normalizedReviews,
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
        ...(parts.executionBrief
          ? {
              execution_brief: parts.executionBrief,
              doctrine_lesson_ids:
                parts.executionBrief.doctrine_bundle.active_lesson_ids,
              taste_selection_count:
                parts.executionBrief.taste_selection.selected.length,
            }
          : {}),
        preflight_flags: parts.candidates.flatMap((candidate) =>
          candidatePreflightFlags(candidate)
        ),
        models:
          parts.engineVersion === 'evidence-agency-v6' ||
          parts.engineVersion === 'evidence-agency-v7' ||
          parts.engineVersion === 'evidence-agency-v9'
            ? {
                preparation: MODEL,
                hook_and_writers: WRITER_MODEL,
                independent_judges: V6_JUDGE_MODEL,
              }
            : { preparation: MODEL, independent_judges: LEGACY_JUDGE_MODEL },
        ...(parts.contractTrace ?? {}),
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
  const activeDirectorContent =
    input.promptContents?.CopyDirectorOrchestrator ??
    (!input.promptVersions?.CopyDirectorOrchestrator
      ? await loadActivePrompt('CopyDirectorOrchestrator', vertical)
      : null)
  const agencyV9Enabled = Boolean(
    Object.values(input.promptVersions ?? {}).some((version) =>
      version.endsWith('brain-v3.31')
    ) || activeDirectorContent?.includes('LeadEcho v3.30')
  )
  const agencyV7Enabled = Boolean(
    agencyV9Enabled ||
    input.promptVersions?.CopyDirectorOrchestrator === 'v3' ||
    input.promptVersions?.CopyAngleOrchestrator === 'v6' ||
    activeDirectorContent?.includes('Copy Director v3')
  )
  const agencyV6Enabled = Boolean(
    agencyV7Enabled ||
    Deno.env.get('AD_COPY_AGENCY_V6_ENABLED') === 'true' ||
    input.promptVersions?.CopyDirectorOrchestrator === 'v2' ||
    input.promptContents?.CopyDirectorOrchestrator?.includes('Copy Director v2')
  )
  const agencyEnabled = Boolean(
    agencyV6Enabled ||
    Deno.env.get('AD_COPY_AGENCY_V5_ENABLED') === 'true' ||
    input.promptContents?.CopyDirectorOrchestrator ||
    input.promptVersions?.CopyDirectorOrchestrator
  )
  const costCap = agencyEnabled
    ? Number(Deno.env.get('AD_COPY_AGENCY_MAX_USD') ?? '2.25')
    : MAX_USD
  const preparedSnapshot = snapshotWithCampaignInput(input)
  if (agencyV6Enabled && !preparedSnapshot) {
    throw new Error(
      'Copy brain v6+ requires a frozen CopyBrainInputSnapshotV1.'
    )
  }
  const executionBrief = preparedSnapshot
    ? compileCopyExecutionBriefV2(preparedSnapshot)
    : null
  if (
    agencyV6Enabled &&
    executionBrief?.readiness_status !== 'ready_to_write'
  ) {
    return {
      output: assembleInputBlocked(
        executionBrief!,
        agencyV9Enabled
          ? 'evidence-agency-v9'
          : agencyV7Enabled
            ? 'evidence-agency-v7'
            : 'evidence-agency-v6'
      ) as unknown as Record<string, unknown>,
      usage: { input_tokens: 0, output_tokens: 0, cost_usd: 0 },
      mode: 'real',
    }
  }
  const compiled = preparedSnapshot
    ? compileCopyBrainContext(preparedSnapshot)
    : null
  const research = preparedSnapshot
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
      execution_brief: executionBrief,
      verified_context: compiled?.context ?? input.productContext ?? null,
      research_snapshots: research,
      optional_creative_hint: input.creativeHint ?? null,
      campaign_context: input.campaignContext ?? null,
    },
  })
  spend(evidence.usage)

  const frozenAvatar = preparedSnapshot?.avatar ?? null
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
    description: ANGLE_TOOL_DESCRIPTION,
    schema: AnglesSchema,
    inputNormalizer: normalizeAnglesToolInput,
    maxTokens: ANGLE_STAGE_MAX_TOKENS,
    maxRetries: ANGLE_STAGE_MAX_RETRIES,
    version: input.promptVersions?.CopyAngleOrchestrator,
    frozenPromptContent: input.promptContents?.CopyAngleOrchestrator,
    vertical,
    payload: {
      offer: input.offer,
      execution_brief: executionBrief,
      evidence_envelope: evidence.data,
      avatar: avatar.data,
      deep_brief: input.deepBriefContext ?? null,
      test_kit: input.testKit ?? null,
      spy: input.spyContext ?? null,
      optional_creative_hint: input.creativeHint ?? null,
      campaign_context: input.campaignContext ?? null,
      taste_selection: executionBrief?.taste_selection ?? null,
      doctrine_bundle: executionBrief?.doctrine_bundle ?? null,
    },
  })
  spend(angles.usage)

  const angleSelection = agencyV7Enabled
    ? selectEligibleAngles(angles.data.angles, evidence.data)
    : { pass: true, angles: angles.data.angles, rejected: [] }
  const routedAngles = angleSelection.pass
    ? angleSelection.angles
    : angles.data.angles
  const angleValidation = {
    ...validateAngleDecision(routedAngles, evidence.data),
    rejected_angles: angleSelection.rejected,
  }
  const angleContractFlags = agencyV7Enabled
    ? (angleValidation.flags as z.infer<
        typeof EvidenceJudgeSchema
      >['kill_flags'])
    : []
  const selectedIndex = Math.max(
    0,
    routedAngles.findIndex((angle) => angle.is_recommended)
  )
  const selected = routedAngles[selectedIndex]
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
    policyFlags.length > 0 ||
    angleContractFlags.length > 0
  ) {
    const output = assemble({
      envelope: evidence.data,
      angles: routedAngles,
      hooks: [],
      variants: [],
      reader: null,
      critic: null,
      judge: emptyJudge(
        angleContractFlags.length
          ? angleContractFlags
          : policyFlags.length
            ? policyFlags
            : ['evidence_threshold_unmet']
      ),
      selectedIndex,
      refineIterations: 0,
      engineVersion: agencyV9Enabled
        ? 'evidence-agency-v9'
        : agencyV7Enabled
          ? 'evidence-agency-v7'
          : agencyEnabled
            ? 'evidence-agency-v5'
            : 'evidence-story-v4',
    })
    return {
      output: output as unknown as Record<string, unknown>,
      usage: total,
      mode: 'real',
    }
  }

  let hooks: {
    data: z.infer<typeof HooksSchema>
    usage: Usage
  } | null = null
  if (!agencyV7Enabled) {
    const generatedHooks = await stage({
      orchestrator: 'CopyHookOrchestrator',
      tool: 'submit_hooks',
      description:
        'Submit evidence-bound hooks in the campaign delivery language.',
      schema: HooksSchema,
      version: input.promptVersions?.CopyHookOrchestrator,
      frozenPromptContent: input.promptContents?.CopyHookOrchestrator,
      model: agencyV6Enabled ? WRITER_MODEL : undefined,
      vertical,
      payload: {
        angles: routedAngles,
        selected_angle_index: selectedIndex,
        evidence_envelope: evidence.data,
        avatar: avatar.data,
        execution_brief: executionBrief,
        relevant_taste_examples: executionBrief?.taste_selection.selected ?? [],
        doctrine_bundle: executionBrief?.doctrine_bundle ?? null,
      },
    })
    hooks = {
      ...generatedHooks,
      data: {
        ...generatedHooks.data,
        hooks: generatedHooks.data.hooks.map(normalizeHookSurface),
      },
    }
    spend(hooks.usage)
  }

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
        execution_brief: executionBrief,
        evidence_envelope: evidence.data,
        avatar: avatar.data,
        angles: routedAngles,
        angle_validation: angleValidation,
        campaign_context: input.campaignContext ?? null,
        relevant_taste_examples: executionBrief?.taste_selection.selected ?? [],
        doctrine_bundle: executionBrief?.doctrine_bundle ?? null,
        latest_quality_baseline:
          'michael-v5-fundraising-positive / leadecho-v3.30-commercial-positive / round5-negative',
        spy_intelligence: preparedSnapshot
          ? {
              analyses: preparedSnapshot.spy_analyses,
              market_examples: preparedSnapshot.market_examples,
              measured_winners: preparedSnapshot.performance_winners,
            }
          : (input.spyContext ?? null),
      },
    })
    spend(directed.usage)

    const departmentPlanValidation = validateDepartmentPlan(
      directed.data,
      routedAngles,
      evidence.data
    )
    let hookCoverage: {
      pass: boolean
      flags: string[]
      details: string[]
    } = {
      pass: true,
      flags: [],
      details: [],
    }
    if (agencyV7Enabled && !departmentPlanValidation.pass) {
      const rejected = directed.data.candidate_briefs.map((brief) => ({
        candidate_id: brief.candidate_id,
        reason: departmentPlanValidation.flags.join(', '),
      }))
      const output = assembleAgency({
        executionBrief,
        engineVersion: agencyV9Enabled
          ? 'evidence-agency-v9'
          : 'evidence-agency-v7',
        envelope: evidence.data,
        angles: routedAngles,
        hooks: [],
        departmentPlan: directed.data,
        candidates: [],
        reviews: [],
        portfolio: {
          ranked_candidate_ids: [],
          selection_reason: 'Department plan failed deterministic validation.',
          rejected_candidates: rejected,
        },
        contractTrace: {
          angle_validation: angleValidation,
          department_plan_validation: departmentPlanValidation,
          taste_requirement_status:
            executionBrief?.taste_selection.requirement_status ??
            'none_available',
          revision: { attempted: false, completed: false },
        },
      })
      return {
        output: output as unknown as Record<string, unknown>,
        usage: total,
        mode: 'real',
      }
    }

    if (agencyV7Enabled) {
      const generatedHooks = await stage({
        orchestrator: 'CopyHookOrchestrator',
        tool: 'submit_hooks',
        description:
          'Submit a compatible hook pool in the campaign delivery language for every candidate.',
        schema: AgencyV7HooksSchema,
        version: input.promptVersions?.CopyHookOrchestrator,
        frozenPromptContent: input.promptContents?.CopyHookOrchestrator,
        model: resolveEvidenceStageModel(input.modelProfile, WRITER_MODEL),
        vertical,
        payload: {
          angles: routedAngles,
          candidate_briefs: directed.data.candidate_briefs,
          evidence_envelope: evidence.data,
          avatar: avatar.data,
          execution_brief: executionBrief,
          relevant_taste_examples:
            executionBrief?.taste_selection.selected ?? [],
          doctrine_bundle: executionBrief?.doctrine_bundle ?? null,
          angle_validation: angleValidation,
        },
      })
      spend(generatedHooks.usage)
      const normalizedHooks =
        generatedHooks.data.hooks.map(normalizeHookSurface)
      hooks = {
        ...generatedHooks,
        data: { ...generatedHooks.data, hooks: normalizedHooks },
      }
      hookCoverage = validateHookCoverage(directed.data, normalizedHooks)
      if (!hookCoverage.pass) {
        const output = assembleAgency({
          executionBrief,
          engineVersion: agencyV9Enabled
            ? 'evidence-agency-v9'
            : 'evidence-agency-v7',
          envelope: evidence.data,
          angles: routedAngles,
          hooks: normalizedHooks,
          departmentPlan: directed.data,
          candidates: [],
          reviews: [],
          portfolio: {
            ranked_candidate_ids: [],
            selection_reason:
              'Candidate hook coverage failed deterministic validation.',
            rejected_candidates: directed.data.candidate_briefs.map(
              (brief) => ({
                candidate_id: brief.candidate_id,
                reason: hookCoverage.flags.join(', '),
              })
            ),
          },
          contractTrace: {
            angle_validation: angleValidation,
            department_plan_validation: departmentPlanValidation,
            hook_coverage: hookCoverage,
            taste_requirement_status:
              executionBrief?.taste_selection.requirement_status ??
              'none_available',
            revision: { attempted: false, completed: false },
          },
        })
        return {
          output: output as unknown as Record<string, unknown>,
          usage: total,
          mode: 'real',
        }
      }
    }
    if (!hooks) throw new Error('Copy hook stage did not produce a hook pool.')

    const candidates: z.infer<typeof AgencyEvidenceVariantSchema>[] = []
    const reviews: z.infer<typeof CopyCandidateReviewSchema>[] = []
    const writerBySpecialist = {
      storytelling: 'CopyStorytellingWriterOrchestrator',
      direct_response: 'CopyDirectResponseWriterOrchestrator',
      proof_mechanism: 'CopyProofMechanismWriterOrchestrator',
    } as const
    for (const brief of directed.data.candidate_briefs) {
      const angle = routedAngles[brief.angle_index]
      if (!angle) continue
      const narrativePolicyFlags = validateNarrativePolicy(
        evidence.data,
        angle.narrative_license
      )
      if (narrativePolicyFlags.length > 0) continue
      const orchestrator = writerBySpecialist[brief.specialist]
      const selectedHook = agencyV7Enabled
        ? selectCandidateHook(brief, hooks.data.hooks)
        : (hooks.data.hooks.find(
            (hook) => hook.angle_index === brief.angle_index
          ) ?? hooks.data.hooks[0])
      if (!selectedHook) continue
      const written = await stage({
        orchestrator,
        tool: 'submit_copy_candidate',
        description:
          'Submit one specialist candidate in the campaign delivery language.',
        schema: agencyV7Enabled
          ? AgencyV7VariantSchema
          : AgencyEvidenceVariantSchema,
        version: input.promptVersions?.[orchestrator],
        frozenPromptContent: input.promptContents?.[orchestrator],
        model: agencyV6Enabled ? WRITER_MODEL : undefined,
        vertical,
        payload: {
          candidate_brief: brief,
          offer: input.offer,
          execution_brief: executionBrief,
          evidence_envelope: evidence.data,
          narrative_license: angle.narrative_license,
          conversion_spine: angle.conversion_spine,
          avatar: avatar.data,
          selected_hook: selectedHook,
          campaign_context: input.campaignContext ?? null,
          deep_brief: executionBrief?.upstream_context.deep_brief ?? null,
          test_kit: executionBrief?.upstream_context.test_kit ?? null,
          relevant_taste_examples:
            executionBrief?.taste_selection.selected ?? [],
          taste_requirement_status:
            executionBrief?.taste_selection.requirement_status ??
            'none_available',
          doctrine_bundle: executionBrief?.doctrine_bundle ?? null,
          latest_quality_baseline:
            'michael-v5-fundraising-positive / leadecho-v3.30-commercial-positive / round5-negative',
          previous_candidate: null,
          revision_request: null,
        },
      })
      spend(written.usage)
      const candidate = normalizeCandidateSurface(
        AgencyEvidenceVariantSchema.parse({
          ...written.data,
          candidate_id: brief.candidate_id,
          specialist: brief.specialist,
          test_hypothesis: brief.test_hypothesis,
          angle_index: brief.angle_index,
          revision_number: agencyV7Enabled ? 0 : written.data.revision_number,
        })
      )
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
          target_reader: executionBrief?.audience ?? null,
        },
      })
      spend(read.usage)
      const candidateTasteStatus = executionBrief
        ? tasteRequirementStatus(
            executionBrief.taste_selection,
            candidate.consumed_taste_example_ids ?? []
          )
        : 'none_available'
      const critiqued = await stage({
        orchestrator: 'CopyCriticOrchestrator',
        tool: 'submit_critic_report',
        description: 'Submit the evidence critic report.',
        schema: EvidenceCriticSchema,
        version: input.promptVersions?.CopyCriticOrchestrator,
        frozenPromptContent: input.promptContents?.CopyCriticOrchestrator,
        vertical,
        payload: {
          variant: candidate,
          execution_brief: executionBrief,
          evidence_envelope: evidence.data,
          narrative_license: angle.narrative_license,
          conversion_spine: angle.conversion_spine,
          line_purpose_map: candidate.line_purpose_map,
          reader_report: read.data,
          doctrine_bundle: executionBrief?.doctrine_bundle ?? null,
          relevant_taste_examples:
            executionBrief?.taste_selection.selected ?? [],
          taste_requirement_status: candidateTasteStatus,
        },
      })
      spend(critiqued.usage)
      const criticData = normalizeRuntimeGateReport(
        critiqued.data,
        candidateTasteStatus
      )
      const judged = await stage({
        orchestrator: 'CopyJudgeOrchestrator',
        tool: 'submit_copy_judgment',
        description: 'Submit the structured copy judgment.',
        schema: EvidenceJudgeSchema,
        version: input.promptVersions?.CopyJudgeOrchestrator,
        frozenPromptContent: input.promptContents?.CopyJudgeOrchestrator,
        model: agencyV6Enabled ? V6_JUDGE_MODEL : LEGACY_JUDGE_MODEL,
        vertical,
        payload: {
          variant: candidate,
          execution_brief: executionBrief,
          evidence_envelope: evidence.data,
          narrative_license: angle.narrative_license,
          conversion_spine: angle.conversion_spine,
          reader_report: read.data,
          critic_report: criticData,
          campaign_context: input.campaignContext ?? null,
          doctrine_bundle: executionBrief?.doctrine_bundle ?? null,
          deterministic_preflight_flags: candidatePreflightFlags(
            candidate,
            agencyV7Enabled ? executionBrief : null,
            agencyV7Enabled ? evidence.data : undefined,
            agencyV7Enabled
              ? (selectedHook as z.infer<typeof AgencyV7HookSchema>)
              : null
          ),
          taste_requirement_status: candidateTasteStatus,
        },
      })
      spend(judged.usage)
      const deterministicFlags = agencyV6Enabled
        ? candidatePreflightFlags(
            candidate,
            agencyV7Enabled ? executionBrief : null,
            agencyV7Enabled ? evidence.data : undefined,
            agencyV7Enabled
              ? (selectedHook as z.infer<typeof AgencyV7HookSchema>)
              : null
          )
        : []
      const normalizedJudgment = normalizeRuntimeGateReport(
        judged.data,
        candidateTasteStatus
      )
      const judgedData = EvidenceJudgeSchema.parse(
        normalizeRuntimeGateReport(
          deterministicFlags.length
            ? {
                ...normalizedJudgment,
                kill_flags: [
                  ...new Set([
                    ...normalizedJudgment.kill_flags,
                    ...deterministicFlags,
                  ]),
                ],
                evidence: [
                  ...normalizedJudgment.evidence,
                  'Deterministic candidate preflight failed.',
                ],
              }
            : normalizedJudgment,
          candidateTasteStatus
        )
      )
      reviews.push({
        candidate_id: brief.candidate_id,
        revision_number: 0,
        reader: read.data,
        critic: criticData,
        judge: judgedData,
      })
    }

    const revisionTrace: Record<string, unknown> = {
      attempted: false,
      candidate_id: null,
      completed: false,
    }
    if (agencyV7Enabled && executionBrief) {
      const revisionTarget = selectRevisionCandidate(candidates, reviews)
      if (revisionTarget) {
        const previousCandidate = revisionTarget.candidate as z.infer<
          typeof AgencyEvidenceVariantSchema
        >
        const previousReview = revisionTarget.review as z.infer<
          typeof CopyCandidateReviewSchema
        >
        const brief = directed.data.candidate_briefs.find(
          (item) => item.candidate_id === previousCandidate.candidate_id
        )
        const angle = brief ? routedAngles[brief.angle_index] : null
        const selectedHook = brief
          ? selectCandidateHook(brief, hooks.data.hooks)
          : null
        if (brief && angle && selectedHook) {
          revisionTrace.attempted = true
          revisionTrace.candidate_id = brief.candidate_id
          revisionTrace.reason = revisionTarget.flags
          const orchestrator = writerBySpecialist[brief.specialist]
          const revised = await stage({
            orchestrator,
            tool: 'submit_copy_candidate',
            description:
              'Submit one bounded revision of the selected candidate.',
            schema: AgencyV7VariantSchema,
            version: input.promptVersions?.[orchestrator],
            frozenPromptContent: input.promptContents?.[orchestrator],
            model: resolveEvidenceStageModel(input.modelProfile, WRITER_MODEL),
            vertical,
            payload: {
              candidate_brief: brief,
              offer: input.offer,
              execution_brief: executionBrief,
              evidence_envelope: evidence.data,
              narrative_license: angle.narrative_license,
              conversion_spine: angle.conversion_spine,
              avatar: avatar.data,
              selected_hook: selectedHook,
              campaign_context: input.campaignContext ?? null,
              deep_brief: executionBrief.upstream_context.deep_brief,
              test_kit: executionBrief.upstream_context.test_kit,
              relevant_taste_examples: executionBrief.taste_selection.selected,
              taste_requirement_status:
                executionBrief.taste_selection.requirement_status,
              doctrine_bundle: executionBrief.doctrine_bundle,
              latest_quality_baseline:
                'michael-v5-fundraising-positive / leadecho-v3.30-commercial-positive / round5-negative',
              previous_candidate: previousCandidate,
              revision_request: {
                revision_number: 1,
                bounded_kill_flags: revisionTarget.flags,
                reader_report: previousReview.reader,
                critic_report: previousReview.critic,
                judge_report: previousReview.judge,
                may_add_claims_or_sources: false,
              },
            },
          })
          spend(revised.usage)
          const revisedCandidate = normalizeCandidateSurface(
            AgencyEvidenceVariantSchema.parse({
              ...revised.data,
              candidate_id: brief.candidate_id,
              specialist: brief.specialist,
              test_hypothesis: brief.test_hypothesis,
              angle_index: brief.angle_index,
              revision_number: 1,
            })
          )
          const reread = await stage({
            orchestrator: 'CopyReaderOrchestrator',
            tool: 'submit_reader_report',
            description: 'Submit the blind reader report for the revision.',
            schema: BlindReaderSchema,
            version: input.promptVersions?.CopyReaderOrchestrator,
            frozenPromptContent: input.promptContents?.CopyReaderOrchestrator,
            vertical,
            payload: {
              text: revisedCandidate.primary_text,
              block_ids: revisedCandidate.block_ids,
              target_reader: executionBrief.audience,
            },
          })
          spend(reread.usage)
          const revisionTasteStatus = tasteRequirementStatus(
            executionBrief.taste_selection,
            revisedCandidate.consumed_taste_example_ids ?? []
          )
          const recritic = await stage({
            orchestrator: 'CopyCriticOrchestrator',
            tool: 'submit_critic_report',
            description: 'Submit the evidence critic report for the revision.',
            schema: EvidenceCriticSchema,
            version: input.promptVersions?.CopyCriticOrchestrator,
            frozenPromptContent: input.promptContents?.CopyCriticOrchestrator,
            vertical,
            payload: {
              variant: revisedCandidate,
              execution_brief: executionBrief,
              evidence_envelope: evidence.data,
              narrative_license: angle.narrative_license,
              conversion_spine: angle.conversion_spine,
              line_purpose_map: revisedCandidate.line_purpose_map,
              reader_report: reread.data,
              doctrine_bundle: executionBrief.doctrine_bundle,
              relevant_taste_examples: executionBrief.taste_selection.selected,
              taste_requirement_status: revisionTasteStatus,
            },
          })
          spend(recritic.usage)
          const revisionCriticData = normalizeRuntimeGateReport(
            recritic.data,
            revisionTasteStatus
          )
          const revisionPreflight = candidatePreflightFlags(
            revisedCandidate,
            executionBrief,
            evidence.data,
            selectedHook
          )
          const rejudge = await stage({
            orchestrator: 'CopyJudgeOrchestrator',
            tool: 'submit_copy_judgment',
            description: 'Submit the structured judgment for the revision.',
            schema: EvidenceJudgeSchema,
            version: input.promptVersions?.CopyJudgeOrchestrator,
            frozenPromptContent: input.promptContents?.CopyJudgeOrchestrator,
            model: resolveEvidenceStageModel(
              input.modelProfile,
              V6_JUDGE_MODEL
            ),
            vertical,
            payload: {
              variant: revisedCandidate,
              execution_brief: executionBrief,
              evidence_envelope: evidence.data,
              narrative_license: angle.narrative_license,
              conversion_spine: angle.conversion_spine,
              reader_report: reread.data,
              critic_report: revisionCriticData,
              doctrine_bundle: executionBrief.doctrine_bundle,
              deterministic_preflight_flags: revisionPreflight,
              taste_requirement_status: revisionTasteStatus,
              campaign_context: input.campaignContext ?? null,
            },
          })
          spend(rejudge.usage)
          const revisionJudgeData = normalizeRuntimeGateReport(
            rejudge.data,
            revisionTasteStatus
          )
          const revisedJudgment = EvidenceJudgeSchema.parse(
            normalizeRuntimeGateReport(
              {
                ...revisionJudgeData,
                kill_flags: [
                  ...new Set([
                    ...revisionJudgeData.kill_flags,
                    ...revisionPreflight,
                  ]),
                ],
                evidence: revisionPreflight.length
                  ? [
                      ...revisionJudgeData.evidence,
                      `Deterministic preflight failed: ${revisionPreflight.join(', ')}`,
                    ]
                  : rejudge.data.evidence,
              },
              revisionTasteStatus
            )
          )
          const candidateIndex = candidates.findIndex(
            (item) => item.candidate_id === brief.candidate_id
          )
          const reviewIndex = reviews.findIndex(
            (item) => item.candidate_id === brief.candidate_id
          )
          candidates[candidateIndex] = revisedCandidate
          reviews[reviewIndex] = {
            candidate_id: brief.candidate_id,
            revision_number: 1,
            reader: reread.data,
            critic: revisionCriticData,
            judge: revisedJudgment,
          }
          revisionTrace.completed = true
        }
      }
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
            model: agencyV6Enabled ? V6_JUDGE_MODEL : LEGACY_JUDGE_MODEL,
            vertical,
            payload: {
              department_plan: directed.data,
              candidates,
              independent_reviews: reviews,
              evidence_envelope: evidence.data,
              campaign_context: input.campaignContext ?? null,
              execution_brief: executionBrief,
              doctrine_bundle: executionBrief?.doctrine_bundle ?? null,
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
      executionBrief,
      engineVersion: agencyV6Enabled
        ? agencyV9Enabled
          ? 'evidence-agency-v9'
          : agencyV7Enabled
            ? 'evidence-agency-v7'
            : 'evidence-agency-v6'
        : 'evidence-agency-v5',
      envelope: evidence.data,
      angles: routedAngles,
      hooks: hooks.data.hooks,
      departmentPlan: directed.data,
      candidates,
      reviews,
      portfolio: portfolio.data,
      contractTrace: agencyV7Enabled
        ? {
            angle_validation: angleValidation,
            department_plan_validation: departmentPlanValidation,
            hook_coverage: hookCoverage,
            taste_requirement_status:
              executionBrief?.taste_selection.requirement_status ??
              'none_available',
            revision: revisionTrace,
          }
        : undefined,
    })
    return {
      output: output as unknown as Record<string, unknown>,
      usage: total,
      mode: 'real',
    }
  }

  if (!hooks) throw new Error('Legacy copy hook stage did not produce hooks.')
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
      description:
        'Submit one evidence-bound variant in the campaign delivery language.',
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
      model: resolveEvidenceStageModel(input.modelProfile, LEGACY_JUDGE_MODEL),
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
    angles: routedAngles,
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

export type EvidenceAgencyCheckpoint = {
  stage:
    | 'evidence'
    | 'angles'
    | 'hooks'
    | 'director'
    | 'candidate_write'
    | 'candidate_reader'
    | 'candidate_critic'
    | 'candidate_judge'
    | 'candidate_revision_write'
    | 'candidate_revision_reader'
    | 'candidate_revision_critic'
    | 'candidate_revision_judge'
    | 'portfolio'
  total: Usage
  evidence?: z.infer<typeof EvidenceEnvelopeSchema>
  avatar?: unknown
  angles?: z.infer<typeof EvidenceAngleSchema>[]
  selectedIndex?: number
  hooks?: z.infer<typeof EvidenceHookSchema>[]
  departmentPlan?: z.infer<typeof CopyDepartmentPlanSchema>
  candidates?: z.infer<typeof AgencyEvidenceVariantSchema>[]
  reviews?: z.infer<typeof CopyCandidateReviewSchema>[]
  briefIndex?: number
  currentCandidate?: z.infer<typeof AgencyEvidenceVariantSchema>
  currentReader?: z.infer<typeof BlindReaderSchema>
  currentCritic?: z.infer<typeof EvidenceCriticSchema>
  angleValidation?: Record<string, unknown>
  departmentPlanValidation?: Record<string, unknown>
  hookCoverage?: Record<string, unknown>
  revisionTargetId?: string
  revisionFlags?: string[]
  revisionAttempted?: boolean
}

export type EvidenceAgencyStepResult =
  | { done: false; checkpoint: EvidenceAgencyCheckpoint }
  | {
      done: true
      output: Record<string, unknown>
      usage: Usage
      mode: 'real'
    }

const zeroUsage = (): Usage => ({
  input_tokens: 0,
  output_tokens: 0,
  cost_usd: 0,
})

const addCheckpointUsage = (
  previous: Usage,
  current: Usage,
  cap: number
): Usage => {
  const total = {
    input_tokens: previous.input_tokens + current.input_tokens,
    output_tokens: previous.output_tokens + current.output_tokens,
    cost_usd: previous.cost_usd + current.cost_usd,
  }
  if (total.cost_usd >= cap) {
    throw new Error(
      `Evidence-story generation hit the $${cap.toFixed(2)} cost cap.`
    )
  }
  return total
}

const checkpointEmptyJudge = (
  envelope: z.infer<typeof EvidenceEnvelopeSchema>,
  flags: z.infer<typeof EvidenceJudgeSchema>['kill_flags']
): z.infer<typeof EvidenceJudgeSchema> => ({
  principles: [
    {
      principle: 'product_understanding',
      verdict: 'fail',
      reason: 'Insufficient evidence.',
    },
    {
      principle: 'eye_level_authentic',
      verdict: 'fail',
      reason: 'No publishable copy was generated.',
    },
    {
      principle: 'depth_without_exaggeration',
      verdict: 'fail',
      reason: 'The engine stopped instead of exaggerating.',
    },
  ],
  compliance_ok: true,
  overall: 'fail',
  calibrated: false,
  notes: 'Evidence gate stopped generation.',
  kill_flags: flags,
  evidence: envelope.missing_data.length
    ? envelope.missing_data
    : ['The deterministic narrative policy rejected the selected license.'],
})

/**
 * Runs at most one remote model call for the agency candidate and returns a
 * JSON-serializable checkpoint. Eval workers persist the checkpoint between
 * invocations so the full department is not coupled to one Edge lifetime.
 */
export async function runAdCopyEvidenceAgencyStep(
  input: EvidenceAdCopyInput,
  prior?: EvidenceAgencyCheckpoint | null
): Promise<EvidenceAgencyStepResult> {
  await assertNotPaused('AdCopyOrchestrator')
  if (!input.brainSnapshot) {
    throw new Error('Resumable agency eval requires a frozen brain snapshot')
  }
  const preparedSnapshot = snapshotWithCampaignInput(input)!
  const executionBrief = compileCopyExecutionBriefV2(preparedSnapshot)
  const activeDirectorContent =
    input.promptContents?.CopyDirectorOrchestrator ??
    (!input.promptVersions?.CopyDirectorOrchestrator
      ? await loadActivePrompt(
          'CopyDirectorOrchestrator',
          input.verticalSlug ?? input.offer.vertical ?? undefined
        )
      : null)
  const agencyV9Enabled = Boolean(
    Object.values(input.promptVersions ?? {}).some((version) =>
      version.endsWith('brain-v3.31')
    ) || activeDirectorContent?.includes('LeadEcho v3.30')
  )
  const agencyV7Enabled = Boolean(
    agencyV9Enabled ||
    input.promptVersions?.CopyDirectorOrchestrator === 'v3' ||
    input.promptVersions?.CopyAngleOrchestrator === 'v6' ||
    activeDirectorContent?.includes('Copy Director v3')
  )
  const engineVersion = agencyV9Enabled
    ? ('evidence-agency-v9' as const)
    : agencyV7Enabled
      ? ('evidence-agency-v7' as const)
      : ('evidence-agency-v6' as const)
  if (executionBrief.readiness_status !== 'ready_to_write') {
    return {
      done: true,
      output: assembleInputBlocked(
        executionBrief,
        engineVersion
      ) as unknown as Record<string, unknown>,
      usage: zeroUsage(),
      mode: 'real',
    }
  }
  const vertical = input.verticalSlug ?? input.offer.vertical ?? undefined
  const costCap = Number(Deno.env.get('AD_COPY_AGENCY_MAX_USD') ?? '2.25')
  const checkpoint: EvidenceAgencyCheckpoint = prior ?? {
    stage: 'evidence',
    total: zeroUsage(),
  }
  const next = (
    patch: Partial<EvidenceAgencyCheckpoint>,
    usage: Usage = zeroUsage()
  ): EvidenceAgencyStepResult => ({
    done: false,
    checkpoint: {
      ...checkpoint,
      ...patch,
      total: addCheckpointUsage(checkpoint.total, usage, costCap),
    },
  })

  if (checkpoint.stage === 'evidence') {
    const compiled = compileCopyBrainContext(preparedSnapshot)
    const evidence = await stage({
      orchestrator: 'CopyExcavateProductOrchestrator',
      tool: 'submit_evidence_envelope',
      description: 'Submit the evidence envelope once.',
      schema: EvidenceEnvelopeSchema,
      version: input.promptVersions?.CopyExcavateProductOrchestrator,
      frozenPromptContent:
        input.promptContents?.CopyExcavateProductOrchestrator,
      vertical,
      payload: {
        offer: input.offer,
        execution_brief: executionBrief,
        verified_context: compiled.context,
        research_snapshots: [],
        optional_creative_hint: input.creativeHint ?? null,
        campaign_context: input.campaignContext ?? null,
      },
    })
    return next(
      {
        stage: 'angles',
        evidence: evidence.data,
        avatar: preparedSnapshot.avatar,
      },
      evidence.usage
    )
  }

  const evidence = EvidenceEnvelopeSchema.parse(checkpoint.evidence)
  const avatar = checkpoint.avatar
  if (!avatar) throw new Error('Agency checkpoint lost the frozen avatar')

  if (checkpoint.stage === 'angles') {
    const angles = await stage({
      orchestrator: 'CopyAngleOrchestrator',
      tool: 'submit_angles',
      description: ANGLE_TOOL_DESCRIPTION,
      schema: AnglesSchema,
      inputNormalizer: normalizeAnglesToolInput,
      maxTokens: ANGLE_STAGE_MAX_TOKENS,
      maxRetries: ANGLE_STAGE_MAX_RETRIES,
      version: input.promptVersions?.CopyAngleOrchestrator,
      frozenPromptContent: input.promptContents?.CopyAngleOrchestrator,
      vertical,
      payload: {
        offer: input.offer,
        execution_brief: executionBrief,
        evidence_envelope: evidence,
        avatar,
        deep_brief: input.deepBriefContext ?? null,
        test_kit: input.testKit ?? null,
        spy: input.spyContext ?? null,
        optional_creative_hint: input.creativeHint ?? null,
        campaign_context: input.campaignContext ?? null,
        taste_selection: executionBrief.taste_selection,
        doctrine_bundle: executionBrief.doctrine_bundle,
      },
    })
    const angleSelection = agencyV7Enabled
      ? selectEligibleAngles(angles.data.angles, evidence)
      : { pass: true, angles: angles.data.angles, rejected: [] }
    const routedAngles = angleSelection.pass
      ? angleSelection.angles
      : angles.data.angles
    const selectedIndex = Math.max(
      0,
      routedAngles.findIndex((angle) => angle.is_recommended)
    )
    const selected = routedAngles[selectedIndex]
    const angleValidation = {
      ...validateAngleDecision(routedAngles, evidence),
      rejected_angles: angleSelection.rejected,
    }
    const angleContractFlags = agencyV7Enabled
      ? (angleValidation.flags as z.infer<
          typeof EvidenceJudgeSchema
        >['kill_flags'])
      : []
    const policyFlags = validateNarrativePolicy(
      evidence,
      selected.narrative_license
    ) as z.infer<typeof EvidenceJudgeSchema>['kill_flags']
    const total = addCheckpointUsage(checkpoint.total, angles.usage, costCap)
    if (
      evidence.research_status === 'insufficient' ||
      selected.narrative_license.mode === 'blocked' ||
      policyFlags.length > 0 ||
      angleContractFlags.length > 0
    ) {
      const output = assemble({
        envelope: evidence,
        angles: routedAngles,
        hooks: [],
        variants: [],
        reader: null,
        critic: null,
        judge: checkpointEmptyJudge(
          evidence,
          angleContractFlags.length
            ? angleContractFlags
            : policyFlags.length
              ? policyFlags
              : ['evidence_threshold_unmet']
        ),
        selectedIndex,
        refineIterations: 0,
        engineVersion,
      })
      return {
        done: true,
        output: output as unknown as Record<string, unknown>,
        usage: total,
        mode: 'real',
      }
    }
    return {
      done: false,
      checkpoint: {
        ...checkpoint,
        stage: agencyV7Enabled ? 'director' : 'hooks',
        angles: routedAngles,
        selectedIndex,
        angleValidation,
        total,
      },
    }
  }

  const angles = z.array(EvidenceAngleSchema).min(1).parse(checkpoint.angles)
  const selectedIndex = checkpoint.selectedIndex ?? 0

  if (checkpoint.stage === 'hooks') {
    const departmentPlan = agencyV7Enabled
      ? CopyDepartmentPlanSchema.parse(checkpoint.departmentPlan)
      : null
    const hooks = await stage({
      orchestrator: 'CopyHookOrchestrator',
      tool: 'submit_hooks',
      description:
        'Submit evidence-bound hooks in the campaign delivery language.',
      schema: agencyV7Enabled ? AgencyV7HooksSchema : HooksSchema,
      version: input.promptVersions?.CopyHookOrchestrator,
      frozenPromptContent: input.promptContents?.CopyHookOrchestrator,
      model: resolveEvidenceStageModel(input.modelProfile, WRITER_MODEL),
      vertical,
      payload: {
        angles,
        ...(agencyV7Enabled
          ? { candidate_briefs: departmentPlan!.candidate_briefs }
          : { selected_angle_index: selectedIndex }),
        evidence_envelope: evidence,
        avatar,
        execution_brief: executionBrief,
        relevant_taste_examples: executionBrief.taste_selection.selected,
        doctrine_bundle: executionBrief.doctrine_bundle,
        angle_validation: checkpoint.angleValidation ?? null,
      },
    })
    const normalizedHooks = hooks.data.hooks.map(normalizeHookSurface)
    if (agencyV7Enabled) {
      const hookCoverage = validateHookCoverage(departmentPlan, normalizedHooks)
      return next(
        {
          stage: hookCoverage.pass ? 'candidate_write' : 'portfolio',
          hooks: normalizedHooks,
          hookCoverage,
          candidates: [],
          reviews: [],
          briefIndex: 0,
        },
        hooks.usage
      )
    }
    return next({ stage: 'director', hooks: normalizedHooks }, hooks.usage)
  }

  if (checkpoint.stage === 'director') {
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
        execution_brief: executionBrief,
        evidence_envelope: evidence,
        avatar,
        angles,
        angle_validation: checkpoint.angleValidation ?? null,
        campaign_context: input.campaignContext ?? null,
        spy_intelligence: {
          analyses: preparedSnapshot.spy_analyses,
          market_examples: preparedSnapshot.market_examples,
          measured_winners: preparedSnapshot.performance_winners,
        },
        relevant_taste_examples: executionBrief.taste_selection.selected,
        doctrine_bundle: executionBrief.doctrine_bundle,
        latest_quality_baseline:
          'michael-v5-fundraising-positive / leadecho-v3.30-commercial-positive / round5-negative',
      },
    })
    const departmentPlanValidation = validateDepartmentPlan(
      directed.data,
      angles,
      evidence
    )
    return next(
      {
        stage: agencyV7Enabled
          ? departmentPlanValidation.pass
            ? 'hooks'
            : 'portfolio'
          : 'candidate_write',
        departmentPlan: directed.data,
        departmentPlanValidation,
        candidates: [],
        reviews: [],
        briefIndex: 0,
      },
      directed.usage
    )
  }

  const hooks = z.array(EvidenceHookSchema).parse(checkpoint.hooks ?? [])

  const departmentPlan = CopyDepartmentPlanSchema.parse(
    checkpoint.departmentPlan
  )
  const candidates = z
    .array(AgencyEvidenceVariantSchema)
    .parse(checkpoint.candidates ?? [])
  const reviews = z
    .array(CopyCandidateReviewSchema)
    .parse(checkpoint.reviews ?? [])
  const writerBySpecialist = {
    storytelling: 'CopyStorytellingWriterOrchestrator',
    direct_response: 'CopyDirectResponseWriterOrchestrator',
    proof_mechanism: 'CopyProofMechanismWriterOrchestrator',
  } as const

  if (checkpoint.stage === 'candidate_write') {
    let briefIndex = checkpoint.briefIndex ?? 0
    while (briefIndex < departmentPlan.candidate_briefs.length) {
      const brief = departmentPlan.candidate_briefs[briefIndex]
      const angle = angles[brief.angle_index]
      if (
        angle &&
        validateNarrativePolicy(evidence, angle.narrative_license).length === 0
      ) {
        const orchestrator = writerBySpecialist[brief.specialist]
        const selectedHook = agencyV7Enabled
          ? selectCandidateHook(brief, hooks)
          : (hooks.find((hook) => hook.angle_index === brief.angle_index) ??
            hooks[0])
        if (!selectedHook) {
          briefIndex++
          continue
        }
        const written = await stage({
          orchestrator,
          tool: 'submit_copy_candidate',
          description:
            'Submit one specialist candidate in the campaign delivery language.',
          schema: agencyV7Enabled
            ? AgencyV7VariantSchema
            : AgencyEvidenceVariantSchema,
          version: input.promptVersions?.[orchestrator],
          frozenPromptContent: input.promptContents?.[orchestrator],
          model: resolveEvidenceStageModel(input.modelProfile, WRITER_MODEL),
          vertical,
          payload: {
            candidate_brief: brief,
            offer: input.offer,
            execution_brief: executionBrief,
            deep_brief: executionBrief.upstream_context.deep_brief,
            test_kit: executionBrief.upstream_context.test_kit,
            evidence_envelope: evidence,
            narrative_license: angle.narrative_license,
            conversion_spine: angle.conversion_spine,
            avatar,
            selected_hook: selectedHook,
            campaign_context: input.campaignContext ?? null,
            relevant_taste_examples: executionBrief.taste_selection.selected,
            taste_requirement_status:
              executionBrief.taste_selection.requirement_status,
            doctrine_bundle: executionBrief.doctrine_bundle,
            latest_quality_baseline:
              'michael-v5-fundraising-positive / leadecho-v3.30-commercial-positive / round5-negative',
            previous_candidate: null,
            revision_request: null,
          },
        })
        const candidate = normalizeCandidateSurface(
          AgencyEvidenceVariantSchema.parse({
            ...written.data,
            candidate_id: brief.candidate_id,
            specialist: brief.specialist,
            test_hypothesis: brief.test_hypothesis,
            angle_index: brief.angle_index,
            revision_number: agencyV7Enabled ? 0 : written.data.revision_number,
          })
        )
        return next(
          {
            stage: 'candidate_reader',
            briefIndex,
            currentCandidate: candidate,
          },
          written.usage
        )
      }
      briefIndex++
    }
    if (candidates.length === 0) {
      const portfolio = {
        ranked_candidate_ids: [],
        selection_reason:
          'All routed candidates failed deterministic policy validation.',
        rejected_candidates: departmentPlan.candidate_briefs.map((brief) => ({
          candidate_id: brief.candidate_id,
          reason: 'deterministic_policy_rejection',
        })),
      }
      const output = assembleAgency({
        executionBrief,
        engineVersion,
        envelope: evidence,
        angles,
        hooks,
        departmentPlan,
        candidates,
        reviews,
        portfolio,
        contractTrace: agencyV7Enabled
          ? {
              angle_validation: checkpoint.angleValidation,
              department_plan_validation: checkpoint.departmentPlanValidation,
              hook_coverage: checkpoint.hookCoverage,
              taste_requirement_status:
                executionBrief.taste_selection.requirement_status,
              revision: { attempted: false, completed: false },
            }
          : undefined,
      })
      return {
        done: true,
        output: output as unknown as Record<string, unknown>,
        usage: checkpoint.total,
        mode: 'real',
      }
    }
    if (agencyV7Enabled && !checkpoint.revisionAttempted) {
      const revisionTarget = selectRevisionCandidate(candidates, reviews)
      if (revisionTarget) {
        return next({
          stage: 'candidate_revision_write',
          revisionTargetId: revisionTarget.candidate.candidate_id,
          revisionFlags: revisionTarget.flags,
          revisionAttempted: true,
        })
      }
    }
    return next({ stage: 'portfolio', briefIndex })
  }

  if (checkpoint.stage === 'portfolio') {
    const contractFailure = agencyV7Enabled
      ? [checkpoint.departmentPlanValidation, checkpoint.hookCoverage].find(
          (validation) =>
            validation && (validation as { pass?: boolean }).pass === false
        )
      : null
    if (contractFailure) {
      const flags = (contractFailure as { flags?: string[] }).flags ?? [
        'deterministic_contract_failure',
      ]
      const portfolio = {
        ranked_candidate_ids: [],
        selection_reason: 'Deterministic agency contract blocked generation.',
        rejected_candidates: departmentPlan.candidate_briefs.map((brief) => ({
          candidate_id: brief.candidate_id,
          reason: flags.join(', '),
        })),
      }
      const output = assembleAgency({
        executionBrief,
        engineVersion,
        envelope: evidence,
        angles,
        hooks,
        departmentPlan,
        candidates,
        reviews,
        portfolio,
        contractTrace: {
          angle_validation: checkpoint.angleValidation,
          department_plan_validation: checkpoint.departmentPlanValidation,
          hook_coverage: checkpoint.hookCoverage,
          taste_requirement_status:
            executionBrief.taste_selection.requirement_status,
          revision: { attempted: false, completed: false },
        },
      })
      return {
        done: true,
        output: output as unknown as Record<string, unknown>,
        usage: checkpoint.total,
        mode: 'real',
      }
    }
    const portfolio = await stage({
      orchestrator: 'CopyPortfolioJudgeOrchestrator',
      tool: 'submit_copy_portfolio_decision',
      description: 'Rank only safe and materially distinct copy candidates.',
      schema: CopyPortfolioDecisionSchema,
      version: input.promptVersions?.CopyPortfolioJudgeOrchestrator,
      frozenPromptContent: input.promptContents?.CopyPortfolioJudgeOrchestrator,
      model: resolveEvidenceStageModel(input.modelProfile, V6_JUDGE_MODEL),
      vertical,
      payload: {
        department_plan: departmentPlan,
        candidates,
        independent_reviews: reviews,
        evidence_envelope: evidence,
        execution_brief: executionBrief,
        doctrine_bundle: executionBrief.doctrine_bundle,
        campaign_context: input.campaignContext ?? null,
      },
    })
    const total = addCheckpointUsage(checkpoint.total, portfolio.usage, costCap)
    const output = assembleAgency({
      executionBrief,
      engineVersion,
      envelope: evidence,
      angles,
      hooks,
      departmentPlan,
      candidates,
      reviews,
      portfolio: portfolio.data,
      contractTrace: agencyV7Enabled
        ? {
            angle_validation: checkpoint.angleValidation,
            department_plan_validation: checkpoint.departmentPlanValidation,
            hook_coverage: checkpoint.hookCoverage,
            taste_requirement_status:
              executionBrief.taste_selection.requirement_status,
            revision: {
              attempted: Boolean(checkpoint.revisionAttempted),
              candidate_id: checkpoint.revisionTargetId ?? null,
              completed: reviews.some((review) => review.revision_number === 1),
            },
          }
        : undefined,
    })
    return {
      done: true,
      output: output as unknown as Record<string, unknown>,
      usage: total,
      mode: 'real',
    }
  }

  if (checkpoint.stage === 'candidate_revision_write') {
    const targetId = checkpoint.revisionTargetId
    const previousCandidate = candidates.find(
      (candidate) => candidate.candidate_id === targetId
    )
    const previousReview = reviews.find(
      (review) => review.candidate_id === targetId
    )
    const briefIndex = departmentPlan.candidate_briefs.findIndex(
      (brief) => brief.candidate_id === targetId
    )
    const brief = departmentPlan.candidate_briefs[briefIndex]
    const angle = angles[brief?.angle_index]
    const selectedHook = brief ? selectCandidateHook(brief, hooks) : null
    if (
      !previousCandidate ||
      !previousReview ||
      !brief ||
      !angle ||
      !selectedHook
    )
      throw new Error('Agency revision checkpoint lost its bounded target')
    const orchestrator = writerBySpecialist[brief.specialist]
    const revised = await stage({
      orchestrator,
      tool: 'submit_copy_candidate',
      description: 'Submit one bounded revision of the selected candidate.',
      schema: AgencyV7VariantSchema,
      version: input.promptVersions?.[orchestrator],
      frozenPromptContent: input.promptContents?.[orchestrator],
      model: resolveEvidenceStageModel(input.modelProfile, WRITER_MODEL),
      vertical,
      payload: {
        candidate_brief: brief,
        offer: input.offer,
        execution_brief: executionBrief,
        deep_brief: executionBrief.upstream_context.deep_brief,
        test_kit: executionBrief.upstream_context.test_kit,
        evidence_envelope: evidence,
        narrative_license: angle.narrative_license,
        conversion_spine: angle.conversion_spine,
        avatar,
        selected_hook: selectedHook,
        campaign_context: input.campaignContext ?? null,
        relevant_taste_examples: executionBrief.taste_selection.selected,
        taste_requirement_status:
          executionBrief.taste_selection.requirement_status,
        doctrine_bundle: executionBrief.doctrine_bundle,
        latest_quality_baseline:
          'michael-v5-fundraising-positive / leadecho-v3.30-commercial-positive / round5-negative',
        previous_candidate: previousCandidate,
        revision_request: {
          revision_number: 1,
          bounded_kill_flags: checkpoint.revisionFlags ?? [],
          reader_report: previousReview.reader,
          critic_report: previousReview.critic,
          judge_report: previousReview.judge,
          may_add_claims_or_sources: false,
        },
      },
    })
    const revisedCandidate = normalizeCandidateSurface(
      AgencyEvidenceVariantSchema.parse({
        ...revised.data,
        candidate_id: brief.candidate_id,
        specialist: brief.specialist,
        test_hypothesis: brief.test_hypothesis,
        angle_index: brief.angle_index,
        revision_number: 1,
      })
    )
    return next(
      {
        stage: 'candidate_revision_reader',
        briefIndex,
        currentCandidate: revisedCandidate,
        currentReader: undefined,
        currentCritic: undefined,
      },
      revised.usage
    )
  }

  if (checkpoint.stage === 'candidate_revision_reader') {
    const currentCandidate = AgencyEvidenceVariantSchema.parse(
      checkpoint.currentCandidate
    )
    const read = await stage({
      orchestrator: 'CopyReaderOrchestrator',
      tool: 'submit_reader_report',
      description: 'Submit the blind reader report for the revision.',
      schema: BlindReaderSchema,
      version: input.promptVersions?.CopyReaderOrchestrator,
      frozenPromptContent: input.promptContents?.CopyReaderOrchestrator,
      vertical,
      payload: {
        text: currentCandidate.primary_text,
        block_ids: currentCandidate.block_ids,
        target_reader: executionBrief.audience,
      },
    })
    return next(
      { stage: 'candidate_revision_critic', currentReader: read.data },
      read.usage
    )
  }

  if (checkpoint.stage === 'candidate_revision_critic') {
    const brief = departmentPlan.candidate_briefs[checkpoint.briefIndex ?? -1]
    const angle = angles[brief?.angle_index]
    const currentCandidate = AgencyEvidenceVariantSchema.parse(
      checkpoint.currentCandidate
    )
    const currentReader = BlindReaderSchema.parse(checkpoint.currentReader)
    if (!brief || !angle) throw new Error('Agency revision lost its brief')
    const revisionTasteStatus = tasteRequirementStatus(
      executionBrief.taste_selection,
      currentCandidate.consumed_taste_example_ids ?? []
    )
    const critiqued = await stage({
      orchestrator: 'CopyCriticOrchestrator',
      tool: 'submit_critic_report',
      description: 'Submit the evidence critic report for the revision.',
      schema: EvidenceCriticSchema,
      version: input.promptVersions?.CopyCriticOrchestrator,
      frozenPromptContent: input.promptContents?.CopyCriticOrchestrator,
      vertical,
      payload: {
        variant: currentCandidate,
        execution_brief: executionBrief,
        evidence_envelope: evidence,
        narrative_license: angle.narrative_license,
        conversion_spine: angle.conversion_spine,
        line_purpose_map: currentCandidate.line_purpose_map,
        reader_report: currentReader,
        doctrine_bundle: executionBrief.doctrine_bundle,
        relevant_taste_examples: executionBrief.taste_selection.selected,
        taste_requirement_status: revisionTasteStatus,
      },
    })
    return next(
      {
        stage: 'candidate_revision_judge',
        currentCritic: normalizeRuntimeGateReport(
          critiqued.data,
          revisionTasteStatus
        ),
      },
      critiqued.usage
    )
  }

  if (checkpoint.stage === 'candidate_revision_judge') {
    const brief = departmentPlan.candidate_briefs[checkpoint.briefIndex ?? -1]
    const angle = angles[brief?.angle_index]
    const currentCandidate = AgencyEvidenceVariantSchema.parse(
      checkpoint.currentCandidate
    )
    const currentReader = BlindReaderSchema.parse(checkpoint.currentReader)
    const currentCritic = EvidenceCriticSchema.parse(checkpoint.currentCritic)
    const selectedHook = brief ? selectCandidateHook(brief, hooks) : null
    if (!brief || !angle || !selectedHook)
      throw new Error('Agency revision lost its judgment inputs')
    const deterministicPreflightFlags = candidatePreflightFlags(
      currentCandidate,
      executionBrief,
      evidence,
      selectedHook
    )
    const revisionTasteStatus = tasteRequirementStatus(
      executionBrief.taste_selection,
      currentCandidate.consumed_taste_example_ids ?? []
    )
    const judged = await stage({
      orchestrator: 'CopyJudgeOrchestrator',
      tool: 'submit_copy_judgment',
      description: 'Submit the structured judgment for the revision.',
      schema: EvidenceJudgeSchema,
      version: input.promptVersions?.CopyJudgeOrchestrator,
      frozenPromptContent: input.promptContents?.CopyJudgeOrchestrator,
      model: resolveEvidenceStageModel(input.modelProfile, V6_JUDGE_MODEL),
      vertical,
      payload: {
        variant: currentCandidate,
        execution_brief: executionBrief,
        evidence_envelope: evidence,
        narrative_license: angle.narrative_license,
        conversion_spine: angle.conversion_spine,
        reader_report: currentReader,
        critic_report: currentCritic,
        doctrine_bundle: executionBrief.doctrine_bundle,
        deterministic_preflight_flags: deterministicPreflightFlags,
        taste_requirement_status: revisionTasteStatus,
        campaign_context: input.campaignContext ?? null,
      },
    })
    const normalizedJudgment = normalizeRuntimeGateReport(
      judged.data,
      revisionTasteStatus
    )
    const judgedData = EvidenceJudgeSchema.parse(
      normalizeRuntimeGateReport(
        {
          ...normalizedJudgment,
          kill_flags: Array.from(
            new Set([
              ...normalizedJudgment.kill_flags,
              ...deterministicPreflightFlags,
            ])
          ),
          evidence: deterministicPreflightFlags.length
            ? [
                ...normalizedJudgment.evidence,
                `Deterministic preflight failed: ${deterministicPreflightFlags.join(', ')}`,
              ]
            : judged.data.evidence,
        },
        revisionTasteStatus
      )
    )
    return next(
      {
        stage: 'portfolio',
        candidates: candidates.map((candidate) =>
          candidate.candidate_id === brief.candidate_id
            ? currentCandidate
            : candidate
        ),
        reviews: reviews.map((review) =>
          review.candidate_id === brief.candidate_id
            ? {
                candidate_id: brief.candidate_id,
                revision_number: 1,
                reader: currentReader,
                critic: currentCritic,
                judge: judgedData,
              }
            : review
        ),
        currentCandidate: undefined,
        currentReader: undefined,
        currentCritic: undefined,
      },
      judged.usage
    )
  }

  const briefIndex = checkpoint.briefIndex ?? 0
  const brief = departmentPlan.candidate_briefs[briefIndex]
  const angle = angles[brief?.angle_index]
  const currentCandidate = AgencyEvidenceVariantSchema.parse(
    checkpoint.currentCandidate
  )
  if (!brief || !angle) throw new Error('Agency checkpoint lost its brief')

  if (checkpoint.stage === 'candidate_reader') {
    const read = await stage({
      orchestrator: 'CopyReaderOrchestrator',
      tool: 'submit_reader_report',
      description: 'Submit the blind reader report.',
      schema: BlindReaderSchema,
      version: input.promptVersions?.CopyReaderOrchestrator,
      frozenPromptContent: input.promptContents?.CopyReaderOrchestrator,
      vertical,
      payload: {
        text: currentCandidate.primary_text,
        block_ids: currentCandidate.block_ids,
        target_reader: executionBrief.audience,
      },
    })
    return next(
      { stage: 'candidate_critic', currentReader: read.data },
      read.usage
    )
  }

  const currentReader = BlindReaderSchema.parse(checkpoint.currentReader)

  if (checkpoint.stage === 'candidate_critic') {
    const candidateTasteStatus = tasteRequirementStatus(
      executionBrief.taste_selection,
      currentCandidate.consumed_taste_example_ids ?? []
    )
    const critiqued = await stage({
      orchestrator: 'CopyCriticOrchestrator',
      tool: 'submit_critic_report',
      description: 'Submit the evidence critic report.',
      schema: EvidenceCriticSchema,
      version: input.promptVersions?.CopyCriticOrchestrator,
      frozenPromptContent: input.promptContents?.CopyCriticOrchestrator,
      vertical,
      payload: {
        variant: currentCandidate,
        execution_brief: executionBrief,
        evidence_envelope: evidence,
        narrative_license: angle.narrative_license,
        conversion_spine: angle.conversion_spine,
        line_purpose_map: currentCandidate.line_purpose_map,
        reader_report: currentReader,
        doctrine_bundle: executionBrief.doctrine_bundle,
        relevant_taste_examples: executionBrief.taste_selection.selected,
        taste_requirement_status: candidateTasteStatus,
      },
    })
    return next(
      {
        stage: 'candidate_judge',
        currentCritic: normalizeRuntimeGateReport(
          critiqued.data,
          candidateTasteStatus
        ),
      },
      critiqued.usage
    )
  }

  const currentCritic = EvidenceCriticSchema.parse(checkpoint.currentCritic)

  if (checkpoint.stage === 'candidate_judge') {
    const selectedHook = agencyV7Enabled
      ? selectCandidateHook(brief, hooks)
      : null
    const deterministicPreflightFlags = candidatePreflightFlags(
      currentCandidate,
      agencyV7Enabled ? executionBrief : null,
      agencyV7Enabled ? evidence : undefined,
      selectedHook
    )
    const candidateTasteStatus = tasteRequirementStatus(
      executionBrief.taste_selection,
      currentCandidate.consumed_taste_example_ids ?? []
    )
    const judged = await stage({
      orchestrator: 'CopyJudgeOrchestrator',
      tool: 'submit_copy_judgment',
      description: 'Submit the structured copy judgment.',
      schema: EvidenceJudgeSchema,
      version: input.promptVersions?.CopyJudgeOrchestrator,
      frozenPromptContent: input.promptContents?.CopyJudgeOrchestrator,
      model: resolveEvidenceStageModel(input.modelProfile, V6_JUDGE_MODEL),
      vertical,
      payload: {
        variant: currentCandidate,
        execution_brief: executionBrief,
        evidence_envelope: evidence,
        narrative_license: angle.narrative_license,
        conversion_spine: angle.conversion_spine,
        reader_report: currentReader,
        critic_report: currentCritic,
        doctrine_bundle: executionBrief.doctrine_bundle,
        deterministic_preflight_flags: deterministicPreflightFlags,
        taste_requirement_status: candidateTasteStatus,
        campaign_context: input.campaignContext ?? null,
      },
    })
    const normalizedJudgment = normalizeRuntimeGateReport(
      judged.data,
      candidateTasteStatus
    )
    const judgedData = EvidenceJudgeSchema.parse(
      normalizeRuntimeGateReport(
        {
          ...normalizedJudgment,
          kill_flags: Array.from(
            new Set([
              ...normalizedJudgment.kill_flags,
              ...deterministicPreflightFlags,
            ])
          ),
          evidence:
            deterministicPreflightFlags.length > 0
              ? [
                  ...normalizedJudgment.evidence,
                  `Deterministic preflight failed: ${deterministicPreflightFlags.join(', ')}`,
                ]
              : judged.data.evidence,
        },
        candidateTasteStatus
      )
    )
    return next(
      {
        stage: 'candidate_write',
        candidates: [...candidates, currentCandidate],
        reviews: [
          ...reviews,
          {
            candidate_id: brief.candidate_id,
            revision_number: 0,
            reader: currentReader,
            critic: currentCritic,
            judge: judgedData,
          },
        ],
        briefIndex: briefIndex + 1,
        currentCandidate: undefined,
        currentReader: undefined,
        currentCritic: undefined,
      },
      judged.usage
    )
  }

  throw new Error(`Unsupported agency checkpoint stage: ${checkpoint.stage}`)
}
