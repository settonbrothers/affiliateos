import { z } from 'npm:zod@^3.24.0'

import { callAnthropicWithTool } from './anthropicJson.ts'
import { logError } from './logError.ts'
import { getAdminClient } from './supabaseAdmin.ts'

const MODEL = 'claude-haiku-4-5-20251001'
const TOOL_NAME = 'submit_judgment'

export const JudgeFindingSchema = z.enum([
  'pass',
  'income_promise',
  'price_leak',
  'ai_disclosure',
  'invented_fact',
  'off_topic',
  'compliance_violation',
  'low_confidence',
])
export type JudgeFinding = z.infer<typeof JudgeFindingSchema>

export const JudgeResultSchema = z.object({
  findings: z.array(JudgeFindingSchema).min(1),
  reasoning: z.string(),
})

// Findings the operator should treat as blocking in M4+ (right now: warn only,
// the user still sees the verdict; admin can review via /admin/ai-runs/[id]).
export const BLOCKING_FINDINGS: readonly JudgeFinding[] = [
  'income_promise',
  'invented_fact',
  'compliance_violation',
]

const SYSTEM_PROMPT = `You are a quality reviewer for AI-generated affiliate-marketing analyses.

Your job: read the orchestrator's INPUT and OUTPUT and decide which (if any) of these findings apply. Multiple findings can apply. If everything is clean, return ['pass'] alone.

# Findings

- pass — output looks clean; no issues worth flagging.
- income_promise — the output promises earnings ("you will make", "guaranteed", "earn $X"). Affiliate compliance forbids this.
- price_leak — currency amounts shown that should be hidden (e.g. internal cost or AOV exposed inappropriately).
- ai_disclosure — output self-discloses as AI ("as an AI", "I'm a language model"). Should be removed.
- invented_fact — output asserts a fact that is NOT present in the INPUT.facts. The Universal Envelope's 'facts' or 'assumptions' MUST be grounded in the input.
- off_topic — output wandered from the affiliate-underwriting brief (chit-chat, irrelevant content).
- compliance_violation — health/medical/financial/regulated claim made or implied (e.g. "cures anxiety", "guaranteed weight loss"). Vertical-specific: in 'ai_saas' the bar is lower than in 'health'.
- low_confidence — the orchestrator's own confidence_score is below 40, AND the output presents itself confidently anyway.

# Output

Submit your judgment via the submit_judgment tool. 'findings' is the array (use ['pass'] when clean — never an empty array). 'reasoning' is one sentence per finding explaining what triggered it.`

type JudgeArgs = {
  aiRunId: string
  orchestratorName: string
  userInput: string
  agentOutput: unknown
}

export type JudgeOutcome = {
  findings: JudgeFinding[]
  reasoning: string | null
  blocking: boolean
  judge_cost_usd: number
  ran: boolean
}

// Degrade-open: returns pass + ran=false if there's no API key OR the judge
// call itself fails. We never want the judge to break user-facing flows; it
// is a defense layer, not a hard gate (M4 may upgrade selected findings to
// block in the edge fn).
export async function judgeOutput(args: JudgeArgs): Promise<JudgeOutcome> {
  if (!Deno.env.get('ANTHROPIC_API_KEY')) {
    return {
      findings: ['pass'],
      reasoning: null,
      blocking: false,
      judge_cost_usd: 0,
      ran: false,
    }
  }

  try {
    const result = await callAnthropicWithTool({
      model: MODEL,
      systemPrompt: SYSTEM_PROMPT,
      userMessage: JSON.stringify(
        {
          orchestrator: args.orchestratorName,
          input: args.userInput,
          output: args.agentOutput,
        },
        null,
        2
      ),
      toolName: TOOL_NAME,
      toolDescription:
        'Submit your judgment of the orchestrator output. Call exactly once.',
      responseSchema: JudgeResultSchema,
      maxRetries: 2,
      maxTokens: 1024,
    })

    const findings = result.data.findings
    const blocking = findings.some((f) => BLOCKING_FINDINGS.includes(f))

    await getAdminClient().from('judge_results').insert({
      ai_run_id: args.aiRunId,
      findings,
      reasoning: result.data.reasoning,
      judge_model: MODEL,
      judge_cost_usd: result.cost_usd,
    })

    return {
      findings,
      reasoning: result.data.reasoning,
      blocking,
      judge_cost_usd: result.cost_usd,
      ran: true,
    }
  } catch (err) {
    await logError({
      severity: 'warning',
      source: `judge:${args.orchestratorName}`,
      message: err instanceof Error ? err.message : String(err),
      context: { ai_run_id: args.aiRunId },
    })
    return {
      findings: ['pass'],
      reasoning: null,
      blocking: false,
      judge_cost_usd: 0,
      ran: false,
    }
  }
}
