// AdCopyOrchestrator (Execute Layer — Phase 1). One orchestrator, internal
// sequential stages (precedent: discovery deep/mine/triage). One run, one charge.
// Pipeline: productExcavate + avatarExcavate -> angle -> hook -> write(he+en) ->
// judge -> refine(<=2, advisory until judge calibrated), with a per-generation
// USD cost guard accumulated across stages.
//
// Pure logic (cost guard, few-shot selection, refine decision, response assembly)
// lives in ./adCopyLogic.ts so it unit-tests without npm/LLM. This file is the IO
// shell: prompt loading + forced-tool LLM calls + the validated assembly.
import { z } from 'npm:zod@^3.24.0'

import { callAnthropicWithTool } from '../anthropicJson.ts'
import { assertNotPaused } from '../killSwitch.ts'
import { loadActivePrompt } from '../loadActivePrompt.ts'
import { mockAdCopy } from '../mockAi.ts'
import {
  AdCopyAngleSchema,
  AdCopyHookSchema,
  AdCopyJudgeSchema,
  AdCopyResponseSchema,
  AvatarExcavationSchema,
  FacebookAdVariantSchema,
  ProductExcavationSchema,
  type AdCopyJudge,
} from '../types/adCopy.ts'
import {
  assembleResponse,
  buildStageUserMessage,
  isOverCostCap,
  selectFewShot,
  shouldRefine,
  type TasteExample,
} from './adCopyLogic.ts'

// NOTE (locked plan): generation + judging run on Opus. The exact Opus model id
// and its PRICING_USD_PER_MTOK entry are wired + verified against the live API in
// T8 (architecture decision #4: do NOT hardcode an unverified rate). Until then
// this defaults to an already-priced model so cost tracking stays ACCURATE, and
// is overridable via env so T8 can flip it without a code change.
const GENERATION_MODEL = Deno.env.get('AD_COPY_MODEL') ?? 'claude-sonnet-4-6'
const JUDGE_MODEL = Deno.env.get('AD_COPY_JUDGE_MODEL') ?? GENERATION_MODEL

// Per-generation USD ceiling. PLACEHOLDER — finalized in T8 from one real measured
// generation (~2x measured). Overridable via env so the cap can be tuned safely.
export const MAX_USD_PER_GENERATION = Number(
  Deno.env.get('AD_COPY_MAX_USD') ?? '0.75'
)

export type AdCopyInput = {
  offer: {
    id?: string
    name: string
    url?: string | null
    vertical?: string | null
    description?: string | null
  }
  // Grounding context from upstream (underwriting verdict, scorecard, facts).
  productContext?: Record<string, unknown>
  // The human Taste Corpus (few-shot + the standard the judge calibrates to).
  corpus?: TasteExample[]
  verticalSlug?: string
}

export type OrchestratorResult = {
  output: Record<string, unknown>
  usage?: { input_tokens: number; output_tokens: number; cost_usd: number }
  mode: 'real' | 'mock'
}

// Tool wrappers for stages whose output is an array (tool input must be an object).
const AnglesToolSchema = z.object({ angles: z.array(AdCopyAngleSchema).min(2).max(5) })
const HooksToolSchema = z.object({ hooks: z.array(AdCopyHookSchema).min(4) })
const VariantsToolSchema = z.object({ variants: z.array(FacebookAdVariantSchema).min(2) })

async function runStage<T extends z.ZodTypeAny>(
  orchestratorName: string,
  toolName: string,
  toolDescription: string,
  responseSchema: T,
  payload: Record<string, unknown>,
  model: string,
  verticalSlug?: string
): Promise<{ data: z.infer<T>; costUsd: number }> {
  const systemPrompt = await loadActivePrompt(orchestratorName, verticalSlug)
  const result = await callAnthropicWithTool({
    model,
    systemPrompt,
    userMessage: buildStageUserMessage(payload),
    toolName,
    toolDescription,
    responseSchema,
  })
  return { data: result.data, costUsd: result.cost_usd }
}

export async function runAdCopy(input: AdCopyInput): Promise<OrchestratorResult> {
  await assertNotPaused('AdCopyOrchestrator')

  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return { output: mockAdCopy(), mode: 'mock' }
  }

  const corpus = input.corpus ?? []
  const offer = input.offer
  const vertical = input.verticalSlug ?? offer.vertical ?? undefined
  let accumUsd = 0
  const spend = (cost: number) => {
    accumUsd += cost
  }
  const guard = () => {
    if (isOverCostCap(accumUsd, MAX_USD_PER_GENERATION)) {
      throw new Error(
        `AdCopy generation hit the per-generation USD cap ` +
          `($${accumUsd.toFixed(4)} / $${MAX_USD_PER_GENERATION.toFixed(2)}).`
      )
    }
  }

  // Stage 1a: product excavation.
  const product = await runStage(
    'CopyExcavateProductOrchestrator',
    'submit_product_excavation',
    'Submit the product excavation. Call exactly once.',
    ProductExcavationSchema,
    { offer, product_context: input.productContext ?? null },
    GENERATION_MODEL,
    vertical
  )
  spend(product.costUsd)
  guard()

  // Stage 1b: avatar excavation (few-shot from corpus avatars).
  const avatar = await runStage(
    'CopyExcavateAvatarOrchestrator',
    'submit_avatar_excavation',
    'Submit the avatar excavation. Call exactly once.',
    AvatarExcavationSchema,
    {
      offer,
      product_excavation: product.data,
      taste_corpus_examples: [
        ...selectFewShot(corpus, 'avatar', 'he'),
        ...selectFewShot(corpus, 'avatar', 'en'),
      ],
    },
    GENERATION_MODEL,
    vertical
  )
  spend(avatar.costUsd)
  guard()

  // Stage 2: angles.
  const angles = await runStage(
    'CopyAngleOrchestrator',
    'submit_angles',
    'Submit 2–5 distinct angles. Call exactly once.',
    AnglesToolSchema,
    { product_excavation: product.data, avatar_excavation: avatar.data, offer },
    GENERATION_MODEL,
    vertical
  )
  spend(angles.costUsd)
  guard()

  // Stage 3: hooks.
  const hooks = await runStage(
    'CopyHookOrchestrator',
    'submit_hooks',
    'Submit at least 4 hooks across the angles, both languages. Call exactly once.',
    HooksToolSchema,
    {
      angles: angles.data.angles,
      avatar_excavation: avatar.data,
      taste_corpus_examples: [
        ...selectFewShot(corpus, 'copy', 'he'),
        ...selectFewShot(corpus, 'copy', 'en'),
      ],
    },
    GENERATION_MODEL,
    vertical
  )
  spend(hooks.costUsd)
  guard()

  // Stage 4 + 5 with refine loop: write -> judge -> (maybe refine).
  const writePayload = (judgeNote?: AdCopyJudge) => ({
    product_excavation: product.data,
    avatar_excavation: avatar.data,
    angles: angles.data.angles,
    hooks: hooks.data.hooks,
    taste_corpus_examples: [
      ...selectFewShot(corpus, 'copy', 'he'),
      ...selectFewShot(corpus, 'copy', 'en'),
    ],
    previous_judgment: judgeNote ?? null,
  })

  let variants = await runStage(
    'CopyWriteOrchestrator',
    'submit_ad_copy',
    'Submit at least 2 variants covering he + en. Call exactly once.',
    VariantsToolSchema,
    writePayload(),
    GENERATION_MODEL,
    vertical
  )
  spend(variants.costUsd)
  guard()

  let judge = await runStage(
    'CopyJudgeOrchestrator',
    'submit_copy_judgment',
    'Judge the copy against the 3 principles + compliance. Call exactly once.',
    AdCopyJudgeSchema,
    {
      variants: variants.data.variants,
      product_excavation: product.data,
      avatar_excavation: avatar.data,
    },
    JUDGE_MODEL,
    vertical
  )
  spend(judge.costUsd)
  guard()

  let refineIterations = 0
  while (
    shouldRefine(judge.data, refineIterations) &&
    !isOverCostCap(accumUsd, MAX_USD_PER_GENERATION)
  ) {
    refineIterations++
    variants = await runStage(
      'CopyWriteOrchestrator',
      'submit_ad_copy',
      'Revise the copy to address the judgment. Call exactly once.',
      VariantsToolSchema,
      writePayload(judge.data),
      GENERATION_MODEL,
      vertical
    )
    spend(variants.costUsd)
    if (isOverCostCap(accumUsd, MAX_USD_PER_GENERATION)) break
    judge = await runStage(
      'CopyJudgeOrchestrator',
      'submit_copy_judgment',
      'Judge the revised copy. Call exactly once.',
      AdCopyJudgeSchema,
      {
        variants: variants.data.variants,
        product_excavation: product.data,
        avatar_excavation: avatar.data,
      },
      JUDGE_MODEL,
      vertical
    )
    spend(judge.costUsd)
  }

  // Assemble, then validate against the contract before returning.
  const output = AdCopyResponseSchema.parse(
    assembleResponse({
      productExcavation: product.data,
      avatarExcavation: avatar.data,
      angles: angles.data.angles,
      hooks: hooks.data.hooks,
      variants: variants.data.variants,
      judge: judge.data,
      refineIterations,
    })
  )

  return {
    output: output as unknown as Record<string, unknown>,
    usage: { input_tokens: 0, output_tokens: 0, cost_usd: accumUsd },
    mode: 'real',
  }
}
