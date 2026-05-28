# 6 Milestones to Stealth Launch

> מחליף את Sprint 0-12 ב־spec המקורי. 8-10 שבועות מ־`git init` עד 5 משתמשים stealth משלמים.

---

## עקרונות ה־milestones

1. **כל milestone דמואביל** — בסוף כל אחד אתה יכול לפתוח את האפליקציה ב־browser ולהראות מה היא עושה. אם זה לא דמואביל, זה לא milestone.
2. **כל milestone כולל deployment ל־preview/staging**. בלי "אקריב את ה־deploy לאחר כך".
3. **DoD הוא מפורש**. אם לא כל הפריטים מסומנים — לא עוברים ל־milestone הבא.
4. **כל milestone בנוי ל־~2 שבועות**. אם milestone אחד התארך — עצור, retro, אולי לחתוך scope של הבא.
5. **בין כל שני milestones — 1 יום integration + bugfix**. אל תתחיל את הבא לפני שהקודם stable.

---

## M1 — Foundation + Mock AI Plumbing (שבועיים)

### מטרה
תשתית עובדת מקצה לקצה: `mock UnderwritingAgent` רץ דרך Edge Function ועדכן `ai_runs` table. UI מציג scorecard mock. הכל deployed ל־Vercel preview עם CI ירוק.

### Scope

- Repo + GitHub Actions CI
- Next.js 15 + Tailwind + shadcn setup
- Supabase project + auth flow (email/password + magic link)
- Migrations 0001-0008:
  - `profiles`, `workspaces`, `workspace_members` (1:1 in MVP, struct למילטי בעתיד)
  - `verticals` (seed: AI/SaaS, Health, Mental)
  - `offers` (lean: ~20 columns)
  - `ai_runs` (full schema לפי spec)
  - `error_logs` + `failed_messages` (DLQ)
  - `audit_logs`
- RLS policies על כל הטבלאות
- Edge Function `analyze-offer` עם mock UnderwritingAgent שמחזיר fixture
- UI מסכים:
  - `/login` (email/password + magic link)
  - `/offers` (רשימה ריקה + "Add Offer" CTA)
  - `/offers/new` (form בסיסי: name, vertical, URL)
  - `/offers/[id]` (Overview tab בלבד)
  - `/admin/ai-runs` (רשימת ai_runs לאדמין)
- `_shared/` utilities (מהתחלה!):
  - `logError.ts`, `dlq.ts`, `auth.ts`, `cors.ts`, `truncate.ts`
  - `anthropicJson.ts` (גם אם בינתיים רק mock — interface נכון מהיום 1)
  - `mockAi.ts` עם fixture לכל orchestrator שיתווסף
- Langfuse traces על mock calls (כדי לאמת שה־flow עובד)

### Definition of Done

- [ ] `git clone` → `pnpm install` → `pnpm dev` עובד בכל מחשב
- [ ] CI על PR: typecheck ✓, lint ✓, build ✓, vitest ✓
- [ ] `main` branch protection: PR-only, CI חובה
- [ ] Vercel auto-deploy מ־main → URL חי
- [ ] משתמש יכול: sign up → login → ליצור offer → ללחוץ "Analyze" → לראות mock scorecard
- [ ] `ai_runs` table כולל את הקריאה (mock)
- [ ] `audit_logs` כולל את כל ה־mutations
- [ ] Langfuse מראה את ה־trace
- [ ] קובץ `CLAUDE.md` ברמת הריפו, מבוסס על המסמכים בתיקייה הזאת

### Demo
אתה לבד מול ה־browser:
1. נרשם
2. יוצר offer "Jasper.ai"
3. לוחץ Analyze
4. רואה mock scorecard עם 13 dimensions
5. הופך לאדמין דרך SQL ידני
6. נכנס ל־/admin/ai-runs ורואה את הקריאה
7. נכנס ל־Langfuse ורואה את ה־trace

### מה NOT ב־M1
- Stripe (M5)
- Real AI calls (M3)
- Source ingestion (M2)
- Test kit (M4)
- Health/Mental compliance prompts (M4)
- Multi-user workspace (אף פעם ב־MVP)
- Discovery scanner (post-MVP)

---

## M2 — Real Source Ingestion + Mock Underwriting on Real Data (שבועיים)

### מטרה
Admin יכול להדביק URL של offer אמיתי, AI (mock כרגע) מחלץ "facts", הם נשמרים, mock UnderwritingAgent מקבל אותם ומחזיר scorecard עם facts אמיתיים שמופיעים ב־UI.

### Scope

- Migrations 0009-0014:
  - `source_documents` (URL + fetched HTML + status)
  - `extracted_facts` (fact_type, value, source_quote, confidence)
  - `source_fetch_jobs`
  - `offer_evaluation_snapshots` (JSONB column: scores + assumptions + warnings)
  - `agent_kill_switches` (per-orchestrator flag)
  - `workspace_credit_caps` (per-day, per-month)
- Edge Function `ingest-source`:
  - fetch URL (timeout 15s)
  - parse with cheerio
  - call mock SourceExtractionAgent
  - store source_document + extracted_facts
  - שמור raw HTML ב־Storage bucket `source-documents`
- Edge Function `analyze-offer` משופר:
  - מקבל extracted_facts → mock UnderwritingAgent → snapshot
- UI מסכים נוספים:
  - `/admin/offers/new` (admin paste URL + מקבל preview)
  - `/admin/offers/[id]/sources` (רואה facts שנחלצו, יכול לאשר/לדחות פר־fact)
  - `/offers/[id]/scorecard` (tab חדש עם 13 dimensions)
  - `/offers/[id]/verdict` (tab חדש)
  - `/admin/kill-switches` (טוגלים לכל orchestrator)
- Supabase Realtime על `ai_runs` (UI מתעדכן כש־background job מסיים)
- DLQ replay button

### Definition of Done

- [ ] Admin מדביק URL של Jasper.ai → רואה ב־30s scorecard עם facts
- [ ] facts שנחלצו מופיעים ב־UI עם source_quote
- [ ] kill switch: admin מכבה Underwriting → ניסיון analyze מחזיר error מסודר
- [ ] credit cap: admin קובע cap=0 ל־user → analyze נחסם
- [ ] DLQ: simulate fail → רואה ב־/admin/failed → replay → עובד
- [ ] Realtime: פותח 2 חלונות, מתחיל analyze בחלון 1, רואה התקדמות בחלון 2

### Demo
1. הדבק URL של Jasper.ai
2. רואה loading state
3. אחרי 20s רואה: payouts, GEOs, traffic rules (כולם mock אבל מעוצבים נכון)
4. רואה scorecard מלא
5. אם משהו נראה לא נכון — לוחץ "reject this fact"

### מה NOT ב־M2
- Anthropic אמיתי (M3)
- Test kit (M4)
- Stripe (M5)
- Email notifications (M5)

---

## M3 — Real AI on Underwriting + Eval Harness (שבועיים)

### מטרה
ה־`UnderwritingAgent` מבצע קריאה אמיתית ל־Anthropic Sonnet 4.6. ה־`SourceExtractionAgent` עובד אמיתי. יש eval harness שמודד אם prompt חדש משפר. יש prompt rollback button.

### Scope

- `_shared/anthropicJson.ts` מלא:
  - tool use forced (לא free-form JSON)
  - Zod validation על output
  - retry על 429/5xx (3 ניסיונות, exp backoff)
  - cost tracking (tokens × pricing → DB)
- Real `SourceExtractionAgent` (Haiku 4.5, cheap)
- Real `UnderwritingAgent` (Sonnet 4.6, reasoning)
- Universal Envelope schema enforced
- Migrations 0015-0019:
  - `prompts` (markdown content versioned in repo, synced to DB)
  - `prompt_versions`
  - `golden_set_offers` (URLs + manual verdicts)
  - `eval_runs` (rerun results vs golden set)
  - `judge_results` (LLM-as-judge على verdict)
- Scripts:
  - `scripts/prompts:sync` (מעדכן DB מקבצי markdown)
  - `scripts/eval:run` (רץ את ה־prompt הפעיל על כל ה־golden set, מחזיר accuracy %)
- LLM-as-judge layer:
  - Haiku 4.5 קורא verdict + Universal Envelope, בודק: hallucination? income promise? off-topic?
  - Result נשמר ב־`judge_results`
- UI:
  - `/admin/prompts` (רשימת versions, rollback button)
  - `/admin/eval` (eval results, golden set management)
- **Golden set: 20 offers + verdicts ידועים** (אתה כותב במהלך השבוע, צמוד לעבודה)
- Cron-based eval (כל לילה ב־03:00): רץ את ה־prompt הנוכחי, התראה אם accuracy ירד

### Definition of Done

- [ ] קריאה אמיתית ל־Anthropic, cost נכון ב־DB
- [ ] verdict על 20 offers ב־golden set: >75% הסכמה עם הציון הידני שלך
- [ ] LLM-as-judge: 0 false negatives על "income promise" ב־100 cases ידועים
- [ ] Prompt rollback button: עובד ב־1 קליק, שינוי נראה ב־UI תוך דקה
- [ ] Cron eval: רץ אוטומטית, שולח email לאדמין אם accuracy < 70%
- [ ] Langfuse trace מראה: input → tool_use call → output → cost
- [ ] Cost cap נאכף: אם user עבר $10 ביום, ה־analyze מחזיר error מסודר

### Demo
1. נכנס לאדמין → eval → רואה accuracy 80% על 20 offers
2. עורך את ה־prompt → מריץ eval → רואה אם השתפר
3. אם השתפר → publish; אם הרע → לא publish (button disabled)
4. מדמה bug: prompt גרוע. accuracy יורד. cron שולח לך email.
5. לוחץ rollback. גרסה הקודמת עולה תוך 30s.

### מה NOT ב־M3
- Test kit (M4)
- Result diagnosis (M4)
- Stripe (M5)
- Multi-vertical (M4 ל־Health/Mental)

---

## M4 — Test Kit + Diagnosis + Health/Mental Compliance (שבועיים)

### מטרה
משתמש יכול לייצר Test Kit, להריץ קמפיין אמיתי שלו, להדביק תוצאות ידנית, ולקבל diagnosis. Health/Mental verticals פתוחים עם compliance prompts.

### Scope

- Migrations 0020-0026:
  - `test_kits` (JSONB עם angles/hooks/ad_copy/landing_structure/kpi_targets/kill_criteria)
  - `campaigns` (offer_id + test_kit_id + status)
  - `campaign_results` (raw results: spend, impressions, clicks, conversions, revenue)
  - `result_diagnoses` (JSONB עם diagnosis + recommendations)
  - `compliance_rules` (per-vertical, per-channel)
  - `offer_compliance_warnings`
- 3 orchestrators נוספים:
  - `TestKitAgent` (Sonnet, מקבל verdict + facts, מחזיר test kit)
  - `ResultDiagnosisAgent` (Sonnet, מקבל results + test_kit, מחזיר diagnosis)
  - `ComplianceCheckAgent` (Haiku, מקבל offer + vertical, מחזיר claims/risks)
- Health/Mental prompts:
  - System prompt עם compliance rules (FDA, Meta health policy)
  - 5 golden offers per vertical (10 total)
- UI:
  - `/offers/[id]/test-kit` (generate + view)
  - `/campaigns` (list + new)
  - `/campaigns/[id]/results` (manual entry form)
  - `/campaigns/[id]/diagnosis` (אחרי analyze)
  - `/admin/compliance` (rules per-vertical)
- Eval harness מורחב:
  - Test Kit eval: 10 offers → human-graded test kit quality (1-5)
  - Diagnosis eval: 10 known-result campaigns → human-graded diagnosis accuracy

### Definition of Done

- [ ] משתמש יוצר offer → analyze → לוחץ "Generate Test Kit" → מקבל test kit מובנה
- [ ] משתמש יוצר campaign על base test kit
- [ ] משתמש מדביק results ידנית (spend $500, 10k imps, 200 clicks, 5 conversions)
- [ ] לוחץ analyze → רואה diagnosis עם recommendations
- [ ] Health vertical: offer של Liver-supplement → ComplianceCheckAgent מסמן "medical_claim" → verdict capped to "small_paid_test" + warning
- [ ] Test Kit eval: 7/10 offers מקבלים 4+ מאשר אתה
- [ ] Diagnosis eval: 8/10 campaigns מקבלים 4+ מאשר אתה

### Demo
1. בחר offer של "Lemonade.com" (insurance affiliate)
2. Generate Test Kit → רואה 3 angles, 5 hooks, 3 ad copy variants
3. הוסף campaign, הזין results מהקמפיין האמיתי שלך
4. Analyze → רואה "primary bottleneck: hook" + 3 recommendations
5. החלף ל־Health vertical, צור offer של supplement → רואה compliance warnings

### מה NOT ב־M4
- Stripe (M5)
- Email (M5)
- Discovery scanner (post-MVP)
- Learning patterns (post-MVP)

---

## M5 — Stripe + Credit System + Invite + Email (שבועיים)

### מטרה
משתמש מקבל invite, נרשם, משלם $50, מקבל 50 credits, משתמש בקרדיט אחד כל פעם שמריץ analyze/test-kit/diagnosis. Emails מסודרים. Billing portal עובד.

### Scope

- Migrations 0027-0033:
  - `plans` (1 plan ב־MVP: `pro` $50/חודש כולל 50 credits)
  - `subscriptions` (Stripe sub_id, status, current_period_end)
  - `stripe_customers`
  - `credit_ledger` (granted, used, refunded, purchased, expired, adjusted)
  - `usage_pricing_rules` (action → credits)
  - `invite_codes` (admin generates, user redeems on signup)
  - `invoices`
- Stripe integration:
  - `/api/stripe/webhook/route.ts` (`runtime: 'nodejs'`, raw body verify)
  - `/api/stripe/checkout/route.ts` (create session)
  - `/api/stripe/portal/route.ts` (customer portal)
  - Subscription lifecycle: created, updated, deleted, payment_failed
- Credit pricing:
  - analyze-offer: 5 credits
  - generate-test-kit: 10 credits
  - analyze-results (diagnosis): 5 credits
  - extra credits purchase: $20 = 30 credits
- Credit guards:
  - Before action: check balance, deduct estimate, reserve
  - After success: confirm deduction
  - After fail (validation): refund
  - After fail (pre-LLM): no charge
- Email (Resend):
  - Welcome email on signup (invite required)
  - Receipt on payment (Stripe webhook → trigger)
  - Credit low warning (< 10 credits)
  - Subscription cancelled
  - Failed payment retry
  - Admin: agent failure alert
- UI:
  - `/billing` (current plan, credits, usage history, manage in Stripe portal)
  - Credit balance ב־header של כל page
  - "Buy more credits" CTA כשנמוך
  - Onboarding flow לאחר signup (4 צעדים: who-are-you, what-vertical, sample-offer, ready)
  - `/admin/invite-codes` (generate + revoke)

### Definition of Done

- [ ] אתה מייצר invite code
- [ ] משתמש נרשם עם code → Stripe Checkout → משלם $50 → מקבל 50 credits
- [ ] משתמש מריץ analyze → 5 credits נחתכים
- [ ] משתמש מקבל "low credits" email כשירד מתחת 10
- [ ] משתמש קונה extra 30 credits → סה"כ 35
- [ ] webhook test mode עובד עם Stripe CLI
- [ ] Failure refund: simulate validation fail → credits מוחזרים
- [ ] Stripe portal: cancel subscription → email + access נחסם בסוף תקופה

### Demo
1. אתה מייצר invite code, שולח לחבר
2. חבר נרשם → אונבורד 4 צעדים → checkout → משלם
3. חבר מריץ analyze על offer → רואה verdict
4. חבר רואה ב־/billing: "45 credits remaining, next billing 30 days"
5. אתה רואה ב־Stripe dashboard את ה־subscription
6. אתה רואה email בתיבה שלך: "John just signed up"

### מה NOT ב־M5
- Discovery scanner (post-MVP)
- Learning patterns (post-MVP)
- Multi-workspace (post-MVP)
- Reviewer role (post-MVP)

---

## M6 — Polish + Hardening + 5 Real Users (שבועיים)

### מטרה
5-15 משתמשים אמיתיים משתמשים במוצר. ה־top-10 bugs נסגרו. observability + alerting פועלים. אתה עוקב על drift של verdict-quality, על cost AI, ועל retention.

### Scope

- **Bug bash שבוע 1 של M6**:
  - שב 4 שעות עם המוצר ככה כמו משתמש. תיעוד כל באג. תיקון.
  - הזמן 2-3 חברים לעשות אותו דבר. אסוף תיעודים.
- **Hardening**:
  - RLS audit: רץ דרך כל endpoint, מוודא ש־user A לא רואה data של user B
  - Secrets rotation script (`scripts/rotate-secrets.sh`)
  - Sentry: source maps + alerting on 5xx > 5/min
  - Better Stack: uptime monitor על `/api/health` (חדש)
  - Cost dashboard: PostHog event לכל AI call, רואה $/user/day
  - Backup: יומי auto של Supabase (built-in ל־Pro plan)
- **Observability for AI quality**:
  - Cron eval רץ נכון (כבר ב־M3)
  - דשבורד PostHog: median accuracy ב־golden set ב־7 ימים אחרונים
  - Alert: אם accuracy ירד 5%+ ביום אחד → SMS via Better Stack
- **Invite + onboard 5-15 משתמשים**:
  - 1 invite ביום, מעקב אישי דרך email
  - שיחת 30 דקות עם כל אחד אחרי שבוע שימוש
- **Documentation**:
  - `README.md` ציבורי (אם הריפו ציבורי) או internal
  - `CLAUDE.md` מעודכן לפי כל מה שלמדנו
  - `docs/runbooks/` עם:
    - "מה לעשות אם Anthropic נופל"
    - "מה לעשות אם Stripe webhook נכשל"
    - "מה לעשות אם DB מלא"
    - "איך לעשות rollback ל־prompt"

### Definition of Done

- [ ] 5+ משתמשים אמיתיים פעילים שבועי
- [ ] 0 critical bugs פתוחים (אסור P0/P1)
- [ ] uptime ב־7 ימים אחרונים: >99.5%
- [ ] median accuracy על golden set: >75% ב־7 ימים אחרונים
- [ ] median cost per analyze: <$0.50 (Anthropic only)
- [ ] חבר אחד לפחות אמר "this is useful" בלי שהוא חייב לך טובה
- [ ] runbook לכל אירוע סביר
- [ ] אתה יודע (במספרים) מה ה־top-3 features שמשתמשים משתמשים בהן

### Demo
זה לא דמו לעצמך — זה דמו למשתמש אמיתי.
1. משתמש נכנס, רואה את ה־offers שלו
2. מריץ analyze על offer חדש
3. רואה scorecard מקצועי
4. מייצר test kit
5. אומר לך: "this saved me 2 hours of research"

---

## אחרי M6 — מה צריך לקבל החלטה לגביו

על בסיס data מ־5-15 משתמשים בפועל:

| תחום | החלטה |
|---|---|
| Discovery Scanner | האם המשתמשים מבקשים יותר offers? אם כן, M7 |
| Learning patterns | האם יש מספיק campaign_results? אם 100+, M8 |
| Social Affiliate persona | האם media buyers אמרו "I have friends who are influencers"? |
| Multi-workspace | האם משתמשים מבקשים teams? |
| Multiple plans | האם יש power users שמוכנים לשלם $200? |
| Public launch | האם conversion rate ב־stealth justifies open signup? |

---

## Cumulative timeline

| שבוע | מי | מה |
|---|---|---|
| 1-2 | M1 | Foundation |
| 3-4 | M2 | Source ingestion + mock orchestrator |
| 5-6 | M3 | Real AI + eval harness |
| 7-8 | M4 | Test kit + diagnosis + Health/Mental |
| 9-10 | M5 | Stripe + invite + email |
| 11-12 | M6 | Polish + 5 real users |

**12 שבועות = 3 חודשים מ־`git init` ל־5 משתמשים stealth משלמים.**

זה ריאלי לסולו + 7 Claude sessions אם:
- חוקי ה־parallel session protocol מוקפדים
- DoD מוקפד לפני מעבר milestone
- אתה כותב golden set במקביל ל־בנייה
- אין החלטות גדולות באמצע (אם אתה משנה stack באמצע M3 — תזיז M4 ל־week 11)
