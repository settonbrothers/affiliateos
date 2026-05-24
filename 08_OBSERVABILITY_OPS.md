# Observability + Operations

> שלוש מטרות: (1) לדעת מה קורה כשמשהו נשבר, (2) לעצור עצירה כשמשהו רץ פרא, (3) להחזיר את המערכת לעצמה תוך דקות, לא שעות.

---

## 4 שכבות observability

| שכבה | מה | כלי | M |
|---|---|---|---|
| **AI traces** | כל קריאת LLM: input, output, tokens, cost, latency | Langfuse Cloud | M1 |
| **Application errors** | exceptions ב־Next.js + Edge Functions | Sentry | M1 |
| **Product analytics** | events: signup, analyze_offer, generate_test_kit, churn | PostHog | M5 |
| **Uptime + SLO** | האם האפליקציה למעלה? response time? | Better Stack | M5 |

---

## Langfuse setup (M1)

### Why Langfuse and not LangSmith/Helicone
- אתה כבר מכיר מ־richer-ai-agents-hub (אותו schema)
- free tier מספיק ל־MVP (50K traces/חודש)
- self-hostable אם אי פעם תרצה
- pricing transparent

### Setup
```bash
# 1. צור project ב־cloud.langfuse.com
# 2. קבל 3 keys: PUBLIC, SECRET, HOST
# 3. הוסף ל־Vercel + Supabase secrets:
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_HOST=https://cloud.langfuse.com

# 4. ב־_shared/langfuseClient.ts (זהה ל־richer-ai-agents-hub):
```

```typescript
// supabase/functions/_shared/langfuseClient.ts
import { encode } from 'https://deno.land/std@0.224.0/encoding/base64.ts';

type TraceArgs = {
  name: string;
  userId?: string;
  sessionId?: string;
  metadata?: Record<string, unknown>;
};

type GenerationArgs = {
  traceId: string;
  name: string;
  model: string;
  input: unknown;
  output: unknown;
  promptTokens: number;
  completionTokens: number;
  costUsd: number;
  startTime: Date;
  endTime: Date;
};

const PRICING_USD_PER_MTOK = {
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-haiku-4-5-20251001': { input: 1, output: 5 },
  // update when Anthropic changes
};

export function computeCostUsd(model: string, promptTok: number, completionTok: number): number {
  const p = PRICING_USD_PER_MTOK[model];
  if (!p) return 0;
  return (promptTok / 1_000_000) * p.input + (completionTok / 1_000_000) * p.output;
}

export async function createTrace(args: TraceArgs): Promise<string> {
  const traceId = crypto.randomUUID();
  await postIngest({
    type: 'trace-create',
    body: {
      id: traceId,
      name: args.name,
      userId: args.userId,
      sessionId: args.sessionId,
      metadata: args.metadata,
      timestamp: new Date().toISOString(),
    },
  });
  return traceId;
}

export async function recordGeneration(args: GenerationArgs) {
  await postIngest({
    type: 'generation-create',
    body: {
      id: crypto.randomUUID(),
      traceId: args.traceId,
      name: args.name,
      model: args.model,
      input: args.input,
      output: args.output,
      usage: {
        promptTokens: args.promptTokens,
        completionTokens: args.completionTokens,
        totalCost: args.costUsd,
      },
      startTime: args.startTime.toISOString(),
      endTime: args.endTime.toISOString(),
    },
  });
}

async function postIngest(body: unknown) {
  const auth = encode(`${Deno.env.get('LANGFUSE_PUBLIC_KEY')}:${Deno.env.get('LANGFUSE_SECRET_KEY')}`);
  try {
    await fetch(`${Deno.env.get('LANGFUSE_HOST')}/api/public/ingestion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Basic ${auth}` },
      body: JSON.stringify({ batch: [body] }),
    });
  } catch (err) {
    // fire-and-forget; never block on observability
    console.error('langfuse ingest failed', err);
  }
}
```

### What to trace
- **Every orchestrator call**: trace = orchestrator name, generation = LLM call inside
- **Source extraction**: trace = "ingest-source:<url>", generation = Haiku call
- **Underwriting**: trace = "analyze-offer:<offer_id>", generation(s) = each Sonnet call
- **Judge layer**: trace = same as parent, generation = Haiku judge call
- **Eval runs**: trace = "eval:<orchestrator>:<version>", generations = all 20 calls

### Cost dashboard
ב־Langfuse cloud UI:
- Filter by user → ראה $/user
- Filter by orchestrator → ראה $/orchestrator
- 7-day trend → drift detection

**Alert in Langfuse**: $/day > $30 (development), $/day > $200 (production) → SMS via Better Stack webhook.

---

## Sentry setup (M1)

### Why
Frontend errors, backend exceptions, source maps. Free tier (5K events/חודש) מספיק ל־MVP.

### Setup
```bash
$ pnpm add @sentry/nextjs
$ npx @sentry/wizard@latest -i nextjs
# Follow the wizard, gets DSN, creates sentry.client.config.ts + sentry.server.config.ts + sentry.edge.config.ts
```

### What to track
- All unhandled exceptions
- 5xx responses from API routes
- Server actions that throw
- Edge function failures (via integration in `logError.ts`)

### What NOT to track
- 4xx (user errors, expected)
- Anthropic 429 (rate limit, retried)
- Form validation errors

### Alerting
Sentry → Alerts:
- New issue → Email
- Issue regression → Email
- Issue volume spike (10x baseline) → SMS via Better Stack

---

## PostHog setup (M5)

### Why
Product analytics, session replay, feature flags — חבילה אחת. 1M events חינמי.

### Setup
```bash
$ pnpm add posthog-js posthog-node
```

```typescript
// src/lib/posthog.ts
import { PostHog } from 'posthog-node';
export const posthog = new PostHog(process.env.POSTHOG_KEY!, {
  host: 'https://us.i.posthog.com',
  flushAt: 1,  // serverless = no batching
  flushInterval: 0,
});
```

### What to track
- `signup` (email, vertical_interest from onboarding)
- `analyze_offer_start` (offer_id, vertical)
- `analyze_offer_complete` (offer_id, verdict, latency_ms)
- `generate_test_kit` (offer_id)
- `submit_results` (campaign_id)
- `payment_initiated` (plan, amount)
- `payment_succeeded` (plan, amount, mrr_delta)
- `credit_low_warning` (balance)
- `dashboard_visit` (user_id)
- `feature_flag_evaluated` (flag, value)

### Session replay
Enable for all users for first 30 days. After that, sample 10%.

Privacy: mask all `<input>`, mask `[data-sensitive]`.

### Funnels to monitor
- Signup → Analyze first offer → Generate test kit → Submit results → 2nd analyze
- Drop-off at any step > 50% = product problem, investigate

---

## Better Stack (uptime) (M5)

### Why
- Uptime monitor
- Status page (public, חינמי)
- Incident management
- SMS on incident
- Webhook receiver for Langfuse/Sentry/PostHog alerts → consolidated alerts

$30/חודש ב־MVP, אבל worth it כי אתה ה־oncall היחיד.

### Monitors
- `GET /api/health` כל דקה (production)
- `GET /api/health` כל 5 דקות (staging)
- DB connectivity check ב־/api/health (קריאה ל־`select 1`)

### Status page
- public.affiliateos.app/status (auto-generated)
- מודיע למשתמשים אם יש incident
- במהלך stealth זה inv only — אז ה־page לא חיוני, אבל מועיל כאדמין

---

## Error logs (DB-based) (M1)

מעבר ל־Sentry, יש לנו `error_logs` table ב־Postgres. למה כפילות?

- **Sentry** = real-time, exception tracking, source maps. אבל קשה לעשות שאילתות SQL.
- **error_logs** = structured, queryable, agent-aware. אפשר לסנן לפי `orchestrator_name`, `user_id`, וכו'.

```typescript
// _shared/logError.ts
export async function logError(args: {
  severity: 'debug' | 'info' | 'warning' | 'error' | 'critical';
  source: string;
  message: string;
  context?: Record<string, unknown>;
  userId?: string;
  workspaceId?: string;
}) {
  const supabase = createClient(/* service role */);
  try {
    await supabase.from('error_logs').insert({
      severity: args.severity,
      source: args.source,
      message: args.message,
      context: args.context,
      user_id: args.userId,
      workspace_id: args.workspaceId,
    });
  } catch {
    // never throw from logError. fire-and-forget.
    console.error('logError failed', args);
  }

  // also send to Sentry if error/critical
  if (args.severity === 'error' || args.severity === 'critical') {
    Sentry.captureMessage(args.message, {
      level: args.severity,
      extra: args.context,
    });
  }
}
```

---

## DLQ — Dead Letter Queue (M2)

### Why
- Anthropic returns 5xx
- HTML fetch fails (timeout, network)
- Zod validation fails after 3 retries
- Stripe webhook signature verification fails (rare but happens)

In all these cases — אנחנו לא רוצים לאבד את העבודה. ה־user פתח request, אנחנו צריכים או להחזיר אחרי או להגיד "we'll handle this manually".

### Pattern (from richer-ai-agents-hub)

```typescript
// _shared/dlq.ts
export async function sendToDlq(args: {
  messageType: 'ai_run' | 'webhook_send' | 'email_send' | 'stripe_webhook';
  payload: Record<string, unknown>;
  error: string;
  maxAttempts?: number;
}) {
  const supabase = createClient(/* service role */);
  await supabase.from('failed_messages').insert({
    message_type: args.messageType,
    payload: args.payload,
    last_error: args.error,
    max_attempts: args.maxAttempts ?? 3,
    status: 'pending',
    next_retry_at: new Date(Date.now() + 30_000).toISOString(),  // first retry in 30s
  });

  // alert admin if critical
  if (args.messageType === 'ai_run') {
    await alertAdmin({
      subject: `AI run failed for ${args.payload.orchestrator}`,
      body: args.error,
    });
  }
}
```

### Replay
- pg_cron כל 5 דקות → scan failed_messages WHERE status='pending' AND next_retry_at < now
- For each: increment attempts, set status='retrying', try
- On success: status='succeeded'
- On fail: increment attempts, if >= max_attempts → status='abandoned' + alert admin

### Admin UI
`/admin/dlq`:
- List all `pending` + `abandoned` messages
- Click → see payload, error
- "Replay manually" button (for abandoned)
- "Mark resolved" (if handled manually outside)

---

## Kill switches (M2)

### Per-orchestrator

```sql
-- already in migration 0013_agent_kill_switches.sql
create table agent_kill_switches (
  orchestrator_name text primary key,
  is_paused boolean not null default false,
  paused_by uuid references profiles(id),
  paused_at timestamptz,
  reason text,
  updated_at timestamptz not null default now()
);
```

### Check (in every orchestrator call)

```typescript
// _shared/orchestrators/underwriting.ts
export async function runUnderwriting(input: UnderwritingInput): Promise<UnderwritingResponse> {
  const switchState = await getKillSwitch('UnderwritingOrchestrator');
  if (switchState.is_paused) {
    throw new OrchestratorPausedError(switchState.reason);
  }
  // ... rest of the call
}
```

### UI
`/admin/kill-switches` (table view, toggle per row):
| Orchestrator | Status | Paused by | When | Reason | Action |
|---|---|---|---|---|---|
| Underwriting | ✅ Active | — | — | — | [Pause] |
| TestKit | ⏸ Paused | Izak | 10:34 | "Sonnet returning bad JSON" | [Resume] |

### When to pause
- Eval drift detected (cron alert)
- Cost spike (>$5/call avg)
- User complaints about specific orchestrator
- Maintenance / migration

### Behavior when paused
- New requests for that orchestrator → error: "Service temporarily paused, please try again later"
- UI shows the message gracefully (banner: "Test Kit generation is temporarily disabled — we're tuning the system")
- Credits NOT deducted
- audit_log entry created

---

## Cost caps (M2)

### Per workspace, per day + per month

```sql
-- already in migration 0014_credit_caps.sql
create table workspace_credit_caps (
  workspace_id uuid primary key references workspaces(id) on delete cascade,
  daily_usd_cap numeric(10, 2) not null default 10.00,
  monthly_usd_cap numeric(10, 2) not null default 100.00,
  daily_credits_cap int not null default 50,
  monthly_credits_cap int not null default 500,
  updated_at timestamptz not null default now()
);
```

### Check
```typescript
// _shared/costCap.ts
export async function checkCostCap(workspaceId: string): Promise<{ ok: boolean; reason?: string }> {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);

  const { data: usage } = await supabase
    .from('workspace_daily_usage')
    .select('usd_spent, credits_spent, day')
    .eq('workspace_id', workspaceId)
    .gte('day', `${month}-01`);

  const dailyUsd = usage?.find(u => u.day === today)?.usd_spent ?? 0;
  const monthlyUsd = (usage ?? []).reduce((s, u) => s + u.usd_spent, 0);

  const { data: caps } = await supabase
    .from('workspace_credit_caps')
    .select('daily_usd_cap, monthly_usd_cap')
    .eq('workspace_id', workspaceId)
    .single();

  if (dailyUsd >= caps.daily_usd_cap) return { ok: false, reason: 'daily_usd_cap_reached' };
  if (monthlyUsd >= caps.monthly_usd_cap) return { ok: false, reason: 'monthly_usd_cap_reached' };
  return { ok: true };
}
```

### After every LLM call
```typescript
// _shared/recordAiRun.ts
export async function recordCompletedRun(args: { ... }) {
  await supabase.from('ai_runs').insert({ ... });
  await supabase.rpc('increment_daily_usage', {
    p_workspace_id: args.workspaceId,
    p_day: new Date().toISOString().slice(0, 10),
    p_usd: args.costUsd,
    p_credits: args.creditsCharged,
  });
}
```

### Defaults
- Free user (admin grant, before payment): $1/day, $10/month
- Paid user: $10/day, $100/month
- Override: admin can raise per-workspace

### Alert
PostHog event `cost_cap_warning` when >= 80% of cap. Email user "you're approaching your daily limit".

---

## Anthropic-specific operational concerns

### Rate limits
Default tier: 50 RPM, 50K tokens/min. Monitor in Langfuse.

If hitting limits in MVP:
1. Reduce concurrency (max 5 parallel orchestrator calls per workspace)
2. Request rate increase from Anthropic
3. Add caching (prompt caching reduces tokens/min)

### Outages
Anthropic API has had outages (~99.9% uptime). Plan:
1. Status page check at https://status.anthropic.com
2. If down > 5 min → display banner: "AI services are temporarily unavailable, your data is safe"
3. Don't fallback to OpenAI in MVP (different prompt tuning required)
4. Failed runs go to DLQ, replay when service returns

### Prompt caching (M4)
For system prompts > 1024 tokens:
```typescript
system: [
  {
    type: 'text',
    text: longSystemPrompt,  // includes facts injection, vertical-specific rules
    cache_control: { type: 'ephemeral' },
  },
],
```
Saves 90% on cached tokens. 5-min TTL.

---

## Email alerts (M2-M5)

### Who gets paged for what

| Event | Who | How |
|---|---|---|
| Anthropic down > 10 min | Admin (you) | SMS via Better Stack |
| 5xx > 5/min for 5 min | Admin | SMS |
| Eval accuracy drop > 5% | Admin | Email + SMS |
| Cost spike $/day > 2x baseline | Admin | Email |
| User support request | Admin | Email (Resend → your inbox) |
| Failed payment (Stripe webhook) | Admin + User | Email |
| Subscription cancelled | Admin | Email (so you can followup) |
| Credit cap reached | User | Email |
| New signup (M5) | Admin | Email (so you can welcome personally) |

### Implementation
```typescript
// _shared/alertOperator.ts
import { Resend } from 'resend';
const resend = new Resend(Deno.env.get('RESEND_API_KEY')!);

export async function alertAdmin(args: { subject: string; body: string; severity?: 'info' | 'warning' | 'critical' }) {
  await resend.emails.send({
    from: 'AffiliateOS Alerts <alerts@affiliateos.app>',
    to: 'izak.cmo@richerltd.com',
    subject: `[${args.severity ?? 'info'}] ${args.subject}`,
    text: args.body,
  });
}
```

---

## Backups + DR (M5-M6)

### Supabase Pro = daily backups automatic
- Retention: 7 days (default)
- Point-in-time recovery: 7 days (Pro feature)
- Test restore quarterly (you don't want to discover restore is broken at 3am)

### Critical tables backup הוא mission-critical
- `credit_ledger` — אם נמחק = פלילי
- `audit_logs` — חוקי
- `prompts` (active versions)
- `golden_set_offers`

**Extra safety:** weekly dump of these 4 tables ל־S3 (Cloudflare R2 or similar) via cron.

### Disaster scenarios

| תרחיש | Recovery time | Recovery plan |
|---|---|---|
| Vercel deploy broken | <5 min | revert to previous deployment ב־Vercel UI |
| Bad migration in prod | <30 min | restore Supabase from latest backup, replay missing |
| Anthropic key compromised | <15 min | rotate via Supabase secrets + Vercel env, redeploy |
| DB corruption | <2 hours | point-in-time restore + replay events from `audit_logs` |
| Region outage | depends | Vercel auto-failover (multi-region), Supabase region failover |
| Mass data deletion | <4 hours | PIT restore + manual review |

Document these ב־`docs/runbooks/disaster-recovery.md` ב־M6.

---

## Health endpoint (M1)

```typescript
// app/api/health/route.ts
export async function GET() {
  const checks = {
    db: false,
    anthropic_key: !!process.env.ANTHROPIC_API_KEY,
    deploy_sha: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7),
  };

  try {
    const supabase = createClient(/* service role, anon read */);
    await supabase.from('verticals').select('id').limit(1);
    checks.db = true;
  } catch {
    // db down
  }

  const ok = checks.db && checks.anthropic_key;
  return Response.json(checks, { status: ok ? 200 : 503 });
}
```

Better Stack pings this every 60s. If it returns 503, alert.

---

## Secrets management

### Stored where
- Vercel env vars (production + preview)
- Supabase secrets (for edge functions)
- `.env.local` (local dev only, never committed)
- `.env.example` (committed, all keys with empty values + comments)

### Rotation cadence
- Anthropic key: every 90 days, or immediately if leaked
- Stripe webhook secret: every 90 days
- Supabase service role: every 180 days (it's a big rotation, careful)
- Langfuse keys: every 180 days

### Rotation script
```bash
# scripts/rotate-secrets.sh
# Usage: ./scripts/rotate-secrets.sh <SECRET_NAME> <NEW_VALUE>
# Updates Vercel + Supabase + your password manager (1Password)
```

### Secret leak protocol
1. Rotate immediately (within 15 min)
2. Audit log: who else had access?
3. Sentry/Langfuse: scan recent traces for the leaked key string
4. If was committed to git: `git filter-repo` + force push + force pull
5. Email all collaborators (if any)

---

## On-call (M5+)

### Solo on-call reality
אתה ה־on-call היחיד 24/7. תאר לעצמך משמרות:
- **Working hours (10-18 IL)** — response time 15 min
- **Off-hours (18-10 IL)** — best effort, response time 2-4h
- **Weekend** — best effort, response 8h

### Status communication
- Status page: `status.affiliateos.app`
- אם יש incident — דחה ה־status page לפני שאתה מתחיל לתקן
- אחרי incident — postmortem ב־`docs/incidents/<date>.md`

### Backup human
ל־MVP אין. אם אתה הולך לחופש לשבוע — שים MAINTENANCE banner על האפליקציה, השבת את AI agents (kill switches), חזור.
