# Agent Roster — 5 Orchestrators

> מחליף את 20+ ה־agents ב־spec המקורי. כל orchestrator יכול לקרוא ל־LLM כמה פעמים פנימה אם צריך, אבל ה־interface שלו הוא יחיד.

---

## למה 5 ולא 20

20 agents נפרדים = 20 לולאות prompt engineering, 20 evals, 20 versioning, 20 monitoring dashboards. בסולו, זה אומר ש־19 מהם יישארו לא־מטופלים והפלט שלהם יהיה גרוע.

5 orchestrators עם הרכבה פנימית = מקום אחד לתחזק, גישה אחת ל־eval, prompt אחד שהוא ה־source of truth. אם בעתיד יש sub-agent ש"רוצה" להיות נפרד — מפצלים אז.

---

## ה־5 Orchestrators

| # | Orchestrator | מודל | תפקיד | M |
|---|---|---|---|---|
| 1 | **SourceExtractionOrchestrator** | Haiku 4.5 | מקבל URL + HTML, מחזיר extracted facts + reliability score | M2 (mock) → M3 (real) |
| 2 | **UnderwritingOrchestrator** | Sonnet 4.6 | מקבל offer + facts, מחזיר scorecard 13-dim + verdict + warnings | M1 (mock) → M3 (real) |
| 3 | **TestKitOrchestrator** | Sonnet 4.6 | מקבל offer + verdict + facts, מחזיר test kit מובנה | M4 |
| 4 | **DiagnosisOrchestrator** | Sonnet 4.6 | מקבל campaign results + test kit, מחזיר diagnosis + recommendations | M4 |
| 5 | **ComplianceCheckOrchestrator** | Haiku 4.5 | מקבל offer + vertical, מחזיר claims + risk + safer framings | M4 |

ה־LLM-as-judge (Haiku) הוא לא orchestrator — הוא layer שעובר *אחרי* כל orchestrator שמחזיר user-facing output.

---

## Universal Envelope (חובה בכל orchestrator)

כל orchestrator מחזיר את ה־envelope הזה כ־top-level structure:

```typescript
// _shared/types/envelope.ts
import { z } from 'zod';

export const UniversalEnvelopeSchema = z.object({
  orchestrator_name: z.string(),
  agent_version: z.string(),
  status: z.enum(['success', 'partial', 'failed']),
  confidence_score: z.number().int().min(0).max(100),
  facts: z.array(z.object({
    statement: z.string(),
    source: z.string().nullable(),  // URL or quote source
    confidence: z.number().int().min(0).max(100),
  })),
  assumptions: z.array(z.string()),
  estimates: z.array(z.object({
    metric: z.string(),
    value: z.string(),  // can be number or range
    basis: z.string(),  // why this estimate
  })),
  risks: z.array(z.object({
    type: z.string(),
    description: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
  })),
  unknowns: z.array(z.string()),
  missing_data: z.array(z.string()),
  human_review_required: z.boolean(),
  human_review_reasons: z.array(z.string()),
});

export type UniversalEnvelope = z.infer<typeof UniversalEnvelopeSchema>;
```

**כל orchestrator מרחיב את ה־envelope עם payload ייעודי** ב־`payload` field נוסף. דוגמה ל־UnderwritingOrchestrator:

```typescript
export const UnderwritingPayloadSchema = z.object({
  scores: z.object({
    economics: z.number().int().min(0).max(100),
    demand: z.number().int().min(0).max(100),
    competition: z.number().int().min(0).max(100),
    creative_opportunity: z.number().int().min(0).max(100),
    funnel_fit: z.number().int().min(0).max(100),
    compliance: z.number().int().min(0).max(100),
    operator_fit: z.number().int().min(0).max(100),
    data_confidence: z.number().int().min(0).max(100),
    offer_trust: z.number().int().min(0).max(100),
    scale_potential: z.number().int().min(0).max(100),
    cashflow_fit: z.number().int().min(0).max(100),
    high_ceiling_potential: z.number().int().min(0).max(100),
    execution_complexity: z.number().int().min(0).max(100),
  }),
  weighted_score: z.number().int().min(0).max(100),
  verdict: z.enum([
    'reject', 'watch', 'organic_only', 'seo_review_only',
    'small_paid_test', 'strong_test', 'strategic_opportunity', 'high_ceiling_opportunity'
  ]),
  recommended_channel: z.enum(['paid_social', 'google_ads', 'native', 'youtube', 'email', 'seo', 'organic_social']).nullable(),
  recommended_geo: z.array(z.string()),
  minimum_test_budget_usd: z.number().nullable(),
  recommended_test_budget_usd: z.number().nullable(),
  main_reason_to_test: z.string(),
  main_reason_to_avoid: z.string(),
  warnings: z.object({
    trust: z.string().nullable(),
    scale: z.string().nullable(),
    cashflow: z.string().nullable(),
    compliance: z.string().nullable(),
  }),
  kill_criteria: z.array(z.string()),
  scale_criteria: z.array(z.string()),
  verdict_caps_applied: z.array(z.string()),
});

export const UnderwritingResponseSchema = UniversalEnvelopeSchema.extend({
  payload: UnderwritingPayloadSchema,
});
```

ה־Zod schema הזה הוא ה־**source of truth**. הוא נשמר ב־`packages/contracts/` או `src/types/agents/`, ומכל מקום בקוד (server action, edge function, eval harness) מייבאים אותו.

---

## Anthropic Tool Use Pattern

כל orchestrator שולח ל־Anthropic tool definition שמשקף את ה־Zod schema. דוגמה ל־UnderwritingOrchestrator:

```typescript
// supabase/functions/_shared/orchestrators/underwriting.ts
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { UnderwritingResponseSchema } from '../../types/agents/underwriting';

const tool: Anthropic.Tool = {
  name: 'submit_underwriting_decision',
  description: 'Submit the underwriting evaluation for an affiliate offer. You must call this tool exactly once.',
  input_schema: zodToJsonSchema(UnderwritingResponseSchema, { target: 'jsonSchema7' }) as any,
};

export async function runUnderwriting(input: UnderwritingInput): Promise<UnderwritingResponse> {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'submit_underwriting_decision' },
    system: await loadActivePrompt('UnderwritingOrchestrator', input.vertical_slug),
    messages: [
      { role: 'user', content: buildUserMessage(input) },
    ],
  });

  const toolUse = response.content.find((c) => c.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('No tool_use in response');
  }

  // Strict validation
  const parsed = UnderwritingResponseSchema.parse(toolUse.input);
  return parsed;
}
```

**אם Zod parse נכשל:** אחד מאלה:
1. ה־prompt גרוע — תקן את הקונטרקט בקובץ Markdown
2. ה־schema גרוע — תקן את ה־Zod
3. המודל היה בעיה זמנית — retry (כבר במעטפה של `anthropicJson.ts`)

**אסור:** parsing חופשי של תוצאה. אסור `try { return JSON.parse(...) }`.

---

## פירוט פר־orchestrator

### 1. SourceExtractionOrchestrator

**מטרה:** מ־URL/HTML של דף affiliate, חלץ facts מובנים.

**Input:**
```typescript
{
  url: string;
  html: string;  // raw HTML, max 200KB
  doc_type_hint?: 'affiliate_terms' | 'product_page' | 'pricing_page' | 'review_page';
}
```

**Output (payload):**
```typescript
{
  doc_type: SourceDocType;
  source_summary: string;
  language: string;
  source_reliability_score: number;  // 0-100
  facts: Array<{
    fact_type: FactType;
    fact_value: string;
    source_quote: string;  // exact substring from html_text
    confidence_score: number;
  }>;
  detected_claims: Array<{ claim_text: string; claim_type: string }>;
}
```

**Model:** Haiku 4.5 — extraction tasks, no reasoning.

**Cost target:** <$0.02 per call.

**Prompt skeleton (`prompts/source_extraction/v1.md`):**
```markdown
You are a structured information extractor for affiliate marketing offer pages.

Given the raw text of a webpage related to an affiliate offer, extract:
1. The document type (terms, product, pricing, review, etc.)
2. Up to 30 structured facts (commission, payout terms, traffic rules, GEOs, claims, etc.)
3. A 2-sentence summary
4. A reliability score for this source (0-100): higher for official terms pages, lower for blog posts

Rules:
- NEVER invent facts. If a value is not in the text, leave it out.
- ALWAYS include a `source_quote` — an exact substring (≤200 chars) from the page that supports the fact.
- If a value is ambiguous, set `confidence_score` lower (40-60).
- Use `facts[].fact_type` from the enum exactly: commission_value, payout_delay, traffic_rule_paid_social, ...
- Output via the `submit_extraction` tool only. No commentary.
```

**Failure modes:**
- HTML too large → truncate at 200KB, log warning
- No facts extracted → status='partial', confidence_score=20
- Invalid tool use → DLQ + manual review

---

### 2. UnderwritingOrchestrator

**מטרה:** המוח של המוצר. מקבל offer + facts, מחזיר scorecard מלא + verdict.

**Input:**
```typescript
{
  offer: {
    id: string;
    name: string;
    vertical_slug: 'ai_saas' | 'health' | 'mental_wellness';
    website_url: string;
    affiliate_program_url: string;
    network?: string;
    short_description?: string;
  };
  facts: ExtractedFact[];  // from SourceExtractionOrchestrator
  user_context?: {  // optional, for operator_fit personalization
    primary_channels: TrafficChannel[];
    typical_budget_range_usd: [number, number];
    cashflow_tolerance: 'tight' | 'medium' | 'flexible';
    experience_level: 'student' | 'intermediate' | 'advanced';
  };
}
```

**Output:** `UnderwritingResponseSchema` (פירטתי למעלה).

**Model:** Sonnet 4.6 (reasoning is critical).

**Cost target:** <$0.50 per call.

**Prompt skeleton (`prompts/underwriting/v1.md`):**
```markdown
You are an Underwriting Analyst for affiliate marketing offers. Your job is to score an offer on 13 dimensions and produce a verdict.

You are not a salesperson. You are not a content writer. You are an analyst. Your job is to PROTECT the operator from bad bets.

# Inputs you receive
- offer name, URL, vertical
- A list of extracted facts (commission, payouts, traffic rules, etc.), each with source_quote and confidence
- (Optional) operator context: channels, budget, cashflow tolerance, experience

# 13 Scoring Dimensions
Each scored 0-100 with reasoning:
1. **economics** — payout, cookie, EPC potential, AOV
2. **demand** — market size, growth, seasonality
3. **competition** — saturation, competitor strength
4. **creative_opportunity** — angles/hooks possible
5. **funnel_fit** — landing page → conversion path quality
6. **compliance** — claims, platform risks, geo risks
7. **operator_fit** — alignment to user context (default 70 if no context)
8. **data_confidence** — how solid are the facts (count of "verified" facts ÷ total)
9. **offer_trust** — vendor reputation, time in market, refund policy clarity
10. **scale_potential** — cap, traffic ceiling
11. **cashflow_fit** — payout delay vs operator tolerance
12. **high_ceiling_potential** — can this realistically generate $10K+/month for a top affiliate
13. **execution_complexity** — how hard is it to run well

# Weights
Use the vertical-specific weights provided in the tool input.

# Hard Rules (override weighted score)
- critical compliance issue → verdict = 'reject', regardless of score
- unknown paid traffic rules → no verdict above 'small_paid_test'
- offer_trust < 50 → max verdict = 'watch'
- data_confidence < 50 → max verdict = 'watch'
- health/mental + medium+ compliance risk → human_review_required = true

# What NOT to do
- NEVER invent a payout, EPC, or CPA. If not in facts, mark as unknown.
- NEVER promise earnings. NEVER use phrases like "you will make", "guaranteed", "earn $X".
- NEVER recommend a paid channel if the relevant traffic_rule_<channel> is "forbidden" or "unknown" without a warning.
- NEVER set high-ceiling without explicit cap data and offer_trust >= 80.

# Output
Submit your full evaluation via the `submit_underwriting_decision` tool. Include every field. No commentary outside the tool call.
```

**Failure modes:**
- Missing critical facts → confidence_score low + human_review_required=true
- Verdict ≥ strong_test but data_confidence < 60 → automatic cap to 'small_paid_test', warning added to verdict_caps_applied
- LLM-as-judge flags income_promise → status='failed' + alert admin

---

### 3. TestKitOrchestrator

**מטרה:** מ־offer + verdict, צור test kit מעשי שמשתמש יכול להריץ.

**Input:**
```typescript
{
  offer: Offer;
  facts: ExtractedFact[];
  underwriting: UnderwritingResponse;
  user_context?: { ... };
}
```

**Output (payload):**
```typescript
{
  test_objective: string;
  channel_plan: { primary: TrafficChannel; secondary?: TrafficChannel; reasoning: string };
  budget_plan: { minimum_usd: number; recommended_usd: number; max_initial_usd: number; reasoning: string };
  geo_plan: { primary: string[]; secondary?: string[]; reasoning: string };
  audience_direction: string;
  angles: Array<{ name: string; positioning: string; target_audience: string }>;  // exactly 3
  hooks: Array<{ text: string; angle_index: number; format: 'headline' | 'first_line' | 'video_opener' }>;  // at least 5
  ad_copy_variants: Array<{ headline: string; body: string; cta: string; angle_index: number }>;  // 3
  creative_briefs: Array<{ format: string; description: string; key_visual: string; tone: string }>;  // 3-5
  landing_structure: {
    above_fold: string;
    main_argument: string;
    proof_elements: string[];
    cta: string;
    objections_addressed: string[];
  };
  tracking_plan: {
    primary_kpi: string;
    secondary_kpis: string[];
    measurement_tools: string[];
  };
  kpi_targets: {
    ctr_target: number;
    cpc_target: number;
    cvr_target: number;
    epc_target: number;
  };
  kill_criteria: string[];
  scale_criteria: string[];
  compliance_warnings: string[];
}
```

**Model:** Sonnet 4.6 (creative + structured).

**Cost target:** <$0.80 per call.

**Prompt skeleton (`prompts/test_kit/v1.md`):**
```markdown
You are a Test Kit designer for affiliate media buyers. Your job is to give the operator a clear plan to test an offer.

The verdict has already been made. You are not deciding *if* to test, only *how*.

# Constraints
- Use compliant copy only. NEVER medical claims, NEVER income promises, NEVER fake urgency.
- Use the vertical's compliance rules (passed in input).
- Hooks must be specific, not generic ("Discover the secret" is forbidden).
- Angles must be distinct (not 3 variations of the same idea).
- Budget must align with verdict's recommended_test_budget_usd.

# Output
Submit via `submit_test_kit` tool. Exactly 3 angles. At least 5 hooks. Exactly 3 ad copy variants. 3-5 creative briefs.
```

---

### 4. DiagnosisOrchestrator

**מטרה:** מ־results של קמפיין + test kit שעליו ביצעו, החזר diagnosis ומה לעשות הלאה.

**Input:**
```typescript
{
  campaign: { id: string; channel: TrafficChannel; geo: string; ... };
  test_kit: TestKitResponse;
  results: {
    spend_usd: number;
    impressions: number;
    clicks: number;
    landing_views: number;
    conversions: number;
    revenue_usd: number;
    days_running: number;
  };
  data_quality_score: number;  // computed before call
}
```

**Output (payload):**
```typescript
{
  diagnosis_summary: string;
  data_quality_assessment: string;
  metric_analysis: {
    ctr: { actual: number; expected: [number, number]; verdict: 'below' | 'within' | 'above' };
    cpc: { actual: number; expected: [number, number]; verdict: 'below' | 'within' | 'above' };
    clickout_rate: { actual: number; expected: [number, number]; verdict: 'below' | 'within' | 'above' };
    cvr: { actual: number; expected: [number, number]; verdict: 'below' | 'within' | 'above' };
    epc: { actual: number; expected: [number, number]; verdict: 'below' | 'within' | 'above' };
  };
  primary_bottleneck: 'offer' | 'creative' | 'hook' | 'angle' | 'landing_page' | 'geo' | 'audience' | 'traffic_source' | 'budget' | 'tracking' | 'compliance' | 'cashflow' | 'not_enough_data';
  secondary_bottlenecks: string[];
  recommended_action: 'stop_test' | 'continue_test' | 'change_hook' | 'change_angle' | 'change_geo' | 'change_channel' | 'improve_landing' | 'change_audience' | 'reduce_budget' | 'increase_budget_carefully' | 'move_to_organic' | 'request_human_review' | 'generate_new_test_kit';
  specific_recommendations: Array<{
    area: string;
    action: string;
    reasoning: string;
  }>;
  not_enough_data: boolean;
  not_enough_data_reason?: string;
}
```

**Model:** Sonnet 4.6.

**Cost target:** <$0.40 per call.

---

### 5. ComplianceCheckOrchestrator

**מטרה:** עבור offer, ספציפי ל־vertical, זהה claims, risks, ו־safer framings.

**Input:**
```typescript
{
  offer: Offer;
  facts: ExtractedFact[];
  vertical_slug: 'ai_saas' | 'health' | 'mental_wellness';
}
```

**Output (payload):**
```typescript
{
  overall_risk_level: 'low' | 'medium' | 'high' | 'critical';
  compliance_score: number;  // 0-100
  detected_claims: Array<{
    claim_type: 'medical_cure' | 'disease' | 'mental_health' | 'anxiety_depression' | 'weight_loss' | 'dental_health' | 'supplement' | 'before_after' | 'fake_proof' | 'scarcity' | 'income' | 'platform_policy' | 'geo_specific' | 'other';
    claim_text: string;
    risk_level: 'low' | 'medium' | 'high' | 'critical';
    why_risky: string;
    safe_framing: string;
    forbidden_framing: string;
    requires_disclaimer: boolean;
  }>;
  platform_risks: string[];  // ['meta_health_ads', 'google_personal_health']
  geo_risks: string[];
  tos_risks: string[];
  required_disclaimers: string[];
  paid_traffic_recommendation: 'allowed' | 'not_recommended' | 'blocked_until_review' | 'unknown';
}
```

**Model:** Haiku 4.5 (extraction + classification).

**Cost target:** <$0.05 per call.

---

## LLM-as-judge Layer (לא orchestrator)

**מה:** layer שעובר אחרי כל orchestrator שמחזיר user-facing output (Underwriting, TestKit, Diagnosis), בודק את התוצאה ב־Haiku 4.5 ומתעד findings.

**Implementation:** `_shared/llmJudge.ts` בכל קריאה.

```typescript
export const JudgeFindingSchema = z.enum([
  'pass',
  'income_promise',      // 'you will make $X'
  'price_leak',          // mentioned currency amounts
  'ai_disclosure',       // 'as an AI' or similar
  'invented_fact',       // claimed something not in inputs
  'off_topic',           // wandered from the brief
  'compliance_violation', // medical/financial claim
  'low_confidence',      // self-reported confidence < 40
]);

export async function judgeOutput(args: {
  orchestrator: string;
  user_input: string;
  agent_output: string;  // stringified envelope+payload
  vertical_slug: string;
}): Promise<{ findings: z.infer<typeof JudgeFindingSchema>[]; reasoning: string; cost: number }> {
  const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! });
  const tool: Anthropic.Tool = { /* schema with findings + reasoning */ };

  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    tools: [tool],
    tool_choice: { type: 'tool', name: 'submit_judgment' },
    system: judgePromptForOrchestrator(args.orchestrator, args.vertical_slug),
    messages: [
      { role: 'user', content: `INPUT: ${args.user_input}\n\nOUTPUT TO JUDGE:\n${args.agent_output}` },
    ],
  });
  // parse, save to judge_results, return
}
```

**Behavior on findings:**
- `pass` → ok, save to judge_results, return original output
- `low_confidence` → save, mark output for review in UI ("AI not confident, review carefully")
- `compliance_violation` / `income_promise` / `invented_fact` → **block** output from user, send to DLQ, alert admin
- `price_leak` / `ai_disclosure` / `off_topic` → return output but with warning to user

**Degrade-open:** If judge call itself fails (Haiku down) → log warning, return original output. We don't want a single judge failure to block users. ב־richer-ai-agents-hub זה אותו pattern.

---

## Shared utilities (M1-M3)

מבנה תחת `supabase/functions/_shared/`:

```
_shared/
  auth.ts                  # requireUser, requireAdmin
  cors.ts                  # CORS headers
  logError.ts              # insert to error_logs
  dlq.ts                   # insert to failed_messages
  truncate.ts              # safe truncation for DB columns
  validation.ts            # generic Zod helpers
  anthropicJson.ts         # wrap Anthropic with tool use + Zod validation + retry
  llmJudge.ts              # judge layer
  loadActivePrompt.ts      # fetch active prompt from DB by orchestrator+vertical
  recordAiRun.ts           # write to ai_runs (start + complete + error)
  recordAuditLog.ts        # write to audit_logs
  langfuseClient.ts        # HTTP client + cost compute
  costCap.ts               # check workspace_credit_caps before LLM call
  orchestrators/
    underwriting.ts
    sourceExtraction.ts
    testKit.ts
    diagnosis.ts
    complianceCheck.ts
  types/
    envelope.ts
    underwriting.ts
    sourceExtraction.ts
    testKit.ts
    diagnosis.ts
    complianceCheck.ts
    fact.ts
    offer.ts
```

---

## Prompt versioning workflow

1. Prompts חיים כ־markdown ב־`prompts/<orchestrator>/<version>.md`
2. `_active.json` בכל orchestrator folder מציין מה הגרסה הפעילה
3. `scripts/prompts:sync` רץ ב־CI אחרי merge ל־main, מסנכרן ל־DB
4. UI ל־`/admin/prompts` מאפשר rollback ב־1 קליק (מעדכן `is_active` ב־DB ישירות)
5. כל ai_run שומר `prompt_version_id` כדי שתוכל לזהות איזה גרסה ייצרה איזו תוצאה

**אסור:** לעדכן prompt ב־DB ידנית בלי PR שמעדכן את ה־markdown. אחרת תאבד את היכולת לחזור.

---

## Cost budget per orchestrator

| Orchestrator | Per call target | אם עובר |
|---|---|---|
| SourceExtraction (Haiku) | $0.02 | alert at $0.05, hard cap $0.20 |
| Underwriting (Sonnet) | $0.50 | alert at $1.00, hard cap $2.00 |
| TestKit (Sonnet) | $0.80 | alert at $1.50, hard cap $3.00 |
| Diagnosis (Sonnet) | $0.40 | alert at $0.80, hard cap $1.50 |
| ComplianceCheck (Haiku) | $0.05 | alert at $0.10, hard cap $0.30 |
| Judge (Haiku) | $0.01 | alert at $0.05 |

ה־hard cap מבוטח על ידי `max_tokens` בקריאה + cost check אחרי כל קריאה ב־`recordAiRun.ts`.
