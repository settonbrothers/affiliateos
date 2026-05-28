# First Week Tasks — M1 Day-by-Day

> זה ה־turn-by-turn navigation. ה־destination map הוא `03_MILESTONES.md`.
>
> השבוע הזה הוא קריטי במיוחד: כאן נקבעים תבניות שכל הקוד יבנה עליהן. אם תפתח 7 sessions במקביל ביום 1 — תקבל chaos. אם תתחיל סדרתי ב־3-4 ימים הראשונים ואז תפתח, תקבל יסוד.

---

## Day 0 — Pre-flight (אתה לבד, 2-3 שעות)

לפני שפותחים session ראשון של Claude:

### Step 1: GitHub
```bash
# צור org אם לא קיים
# Settings → Repositories → New repo
# Name: affiliateos-claude
# Visibility: Private
# Don't initialize (we'll do that locally)
```

### Step 2: Local setup
```bash
$ cd /Users/izhaksiton
$ mkdir affiliateos-claude && cd affiliateos-claude
$ git init
$ git remote add origin git@github.com:settonbrothers/affiliateos-claude.git

# העתק את מסמכי התוכנית לתוך הריפו תחת docs/
$ mkdir -p docs/plan
$ cp "/Users/izhaksiton/affiliateos claude/"*.md docs/plan/
$ git add docs/plan/
$ git commit -m "docs: add plan documents"
$ git push -u origin main
```

### Step 3: Supabase project
```bash
# 1. supabase.com/dashboard → New project
#    Name: affiliateos-prod
#    Region: eu-central-1 (Frankfurt)
#    Plan: Pro ($25/mo)
# 2. Wait for provisioning (~2 min)
# 3. Settings → API → copy URL + anon key + service_role key
# 4. Save to 1Password vault "AffiliateOS Prod":
#    - SUPABASE_URL
#    - SUPABASE_ANON_KEY
#    - SUPABASE_SERVICE_ROLE_KEY
```

### Step 4: Vercel project
```bash
# Don't create yet — Session A will do it after Next.js init
# But: ensure account exists, billing set up
```

### Step 5: Anthropic
```bash
# console.anthropic.com → API Keys → New key
# Name: affiliateos-prod
# Save to 1Password
# Add $50 credit (will burn through during golden set + eval testing)
```

### Step 6: Other accounts (can be after M1)
- Langfuse: `cloud.langfuse.com` → new project
- Sentry: `sentry.io` → new project
- Resend: `resend.com` → new project, add domain (DNS verify)
- PostHog: skip until M5
- Better Stack: skip until M5

### Step 7: Branch protection
On GitHub → Settings → Branches → Add rule for `main`:
- Require PR before merging ✓
- Require approvals: 0 (you'll approve via merge)
- Require status checks: (we'll add after CI exists)
- Restrict pushes: include administrators ✓
- Require linear history ✓

### Step 8: Local tooling
```bash
$ which pnpm || npm i -g pnpm@9
$ which node || # install Node 22 via brew or nvm
$ which supabase || brew install supabase/tap/supabase
```

### Step 9: Read the plan
- `docs/plan/00_README.md`
- `docs/plan/01_PRINCIPLES.md`
- `docs/plan/02_STACK.md`
- `docs/plan/03_MILESTONES.md` (M1 section)
- `docs/plan/06_PARALLEL_CLAUDE_PROTOCOL.md`

עם זה אתה מוכן לפתוח את ה־session הראשון.

---

## Day 1 — Foundation, sequential (sessions A only)

**עיקרון:** ביום הראשון רק session אחד פעיל. כי כל מה שהוא עושה — כל ה־sessions הבאים יבנו עליו.

### Task 1.1 — Next.js init + tooling

**Session A, branch `feat/m1-bootstrap`**

Briefing ל־session:

```
# Task: Bootstrap Next.js 15 + tooling

## Context
We're starting affiliateos-claude. Read docs/plan/02_STACK.md for stack rules.
This is the FIRST commit — bootstrap of everything.

## Goal
After this PR, anyone can clone, pnpm install, pnpm dev and see a Next.js 15 app at localhost:3000.

## Files to create
- package.json
- pnpm-lock.yaml
- next.config.ts
- tsconfig.json
- tailwind.config.ts (Tailwind v4 syntax, postcss.config.js)
- postcss.config.js
- .gitignore (Next default + .env.local + .vercel)
- .env.example (with comments for every env var we'll need)
- src/app/layout.tsx (RootLayout with Heebo font and html lang="en")
- src/app/page.tsx (placeholder home: "AffiliateOS" + a button to /login)
- src/app/globals.css (Tailwind v4 directives)
- src/components/ui/ (initial shadcn setup — Button, Card)
- .eslintrc.json (Next + TS + import order)
- .prettierrc (single quotes, no semi)
- .github/workflows/ci.yml (typecheck + lint + build on PR)
- README.md (basic — "this is AffiliateOS, see docs/plan/")
- CLAUDE.md (project root — see template in docs/plan/06_PARALLEL_CLAUDE_PROTOCOL.md)

## Decisions to follow
- Use pnpm (not bun, not npm)
- Use Next 15 App Router (no Pages Router)
- Use Tailwind v4 (not v3)
- Use shadcn (manual copy, no CLI registry)
- TypeScript strict: true
- Don't add: Drizzle, tRPC, Redux, anything not in 02_STACK.md

## Versions to pin (from 02_STACK.md)
- next: ^15.1.0
- react: ^19.0.0
- typescript: ^5.7.0
- tailwindcss: ^4.0.0

## Definition of Done
- [ ] pnpm install succeeds
- [ ] pnpm dev shows Next.js at localhost:3000
- [ ] pnpm build succeeds
- [ ] pnpm tsc --noEmit succeeds
- [ ] pnpm lint succeeds
- [ ] GitHub Actions CI passes
- [ ] Branch: feat/m1-bootstrap
- [ ] PR title: "feat(m1): bootstrap Next.js 15 + tooling"

## When done
- Push branch
- Open PR
- I'll review and merge before opening more sessions
```

**זמן משוער:** 3-4 שעות.

**אחרי merge — אתה (אנושית) עושה:**
```bash
$ git checkout main
$ git pull
$ pnpm install
$ pnpm dev  # אמת שכל עובד
# Connect Vercel:
$ npx vercel link
# Create Vercel project, set production branch = main
# Add env vars (placeholders, fill ב־Step 2)
```

### Task 1.2 — Supabase init + first migration (אותו session, אחרי merge)

**Session A, branch `feat/m1-supabase-init`**

```
# Task: Supabase init + migrations 0001 + 0002

## Context
Next.js is set up. Now we add Supabase client setup + first migrations.

## Files to create
- supabase/config.toml (initialized via `supabase init`)
- supabase/migrations/0001_init_roles.sql (see docs/plan/04_SCHEMA_LEAN.md exact SQL)
- supabase/migrations/0002_profiles.sql (see docs/plan/04_SCHEMA_LEAN.md exact SQL)
- src/lib/supabase/client.ts (browser client via @supabase/ssr)
- src/lib/supabase/server.ts (server client via @supabase/ssr, uses cookies)
- src/lib/supabase/admin.ts (service role client for edge fn use)
- src/types/database.ts (generated via `supabase gen types`)
- Add to .env.example:
  - NEXT_PUBLIC_SUPABASE_URL
  - NEXT_PUBLIC_SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY

## Workflow
1. supabase init (creates supabase/ dir)
2. supabase link --project-ref <ref>  (you the human do this — needs interactive auth)
3. Create migration 0001 — copy SQL from docs/plan/04_SCHEMA_LEAN.md exactly
4. Create migration 0002 — copy SQL from docs/plan/04_SCHEMA_LEAN.md exactly
5. supabase db push (apply to remote)
6. supabase gen types typescript --linked > src/types/database.ts

## Definition of Done
- [ ] `supabase migration list` shows 0001 + 0002 applied
- [ ] src/types/database.ts contains `profiles` table types
- [ ] src/lib/supabase/{client,server}.ts compile + work
- [ ] CI passes

## What NOT to do
- Don't add other migrations beyond 0001 + 0002 in this PR
- Don't add auth UI (that's task 1.3)
- Don't add RLS policies beyond what's in 0002 (already includes them)
```

**זמן משוער:** 2-3 שעות.

**יום 1 סיכום:** סיימת bootstrap + Supabase. main branch כולל Next.js עובד עם Supabase מחובר. CI ירוק.

---

## Day 2-3 — Foundation, 2-3 parallel sessions

עכשיו אפשר לפתוח sessions במקביל. אבל **רק 3**, לא 7. רוצים מומנטום, לא chaos.

### Task 2.1 — Auth UI

**Session A, branch `feat/m1-auth-ui`**

Briefing (כפי שמופיע בדוגמה ב־`06_PARALLEL_CLAUDE_PROTOCOL.md`):

קצרה גרסה:
```
Goal: User can signup, login, magic-link, logout.

Files:
- src/app/(auth)/login/page.tsx
- src/app/(auth)/signup/page.tsx
- src/app/(auth)/callback/route.ts
- src/components/auth/LoginForm.tsx
- src/components/auth/SignupForm.tsx
- src/middleware.ts (redirect to /login if not auth on protected routes)

NOT to touch:
- supabase/migrations/* (different session)
- _shared/* (different session)

DoD:
- /login, /signup work
- magic link works
- middleware blocks unauthenticated access to /offers
- Form uses React Hook Form + zodResolver
```

### Task 2.2 — Migrations 0003-0006

**Session B, branch `feat/m1-migrations-core`**

```
Goal: Add migrations for workspaces, verticals, offers, ai_runs.

Files:
- supabase/migrations/0003_workspaces.sql
- supabase/migrations/0004_verticals.sql
- supabase/migrations/0005_offers.sql
- supabase/migrations/0006_ai_runs.sql

Workflow:
- Copy SQL from docs/plan/04_SCHEMA_LEAN.md exactly
- Each migration in its own file with its own number
- supabase db push to apply
- Run gen types ONLY locally for compile checks; DO NOT commit database.ts (will be regenerated after merge by Session A maintainer)

DoD:
- All 4 migrations applied to remote
- RLS policies in each migration verified by running supabase db push then trying to query as anon (should return empty)
- CI passes (note: src/types/database.ts will be regenerated by maintainer after merge)
```

### Task 2.3 — _shared utilities skeleton

**Session C, branch `feat/m1-shared-utils`**

```
Goal: Set up the _shared/ directory in supabase/functions/ with utility skeletons.

Files:
- supabase/functions/_shared/auth.ts (requireUser, requireAdmin via JWT)
- supabase/functions/_shared/cors.ts (corsHeaders constant + handleCors function)
- supabase/functions/_shared/logError.ts (insert to error_logs, fire-and-forget Sentry)
- supabase/functions/_shared/dlq.ts (insert to failed_messages)
- supabase/functions/_shared/truncate.ts (safe truncate strings for DB columns)
- supabase/functions/_shared/validation.ts (zod helpers)
- supabase/functions/_shared/anthropicJson.ts (stub for now, full impl in M3)
- supabase/functions/_shared/loadActivePrompt.ts (stub: returns hardcoded prompt until M3)
- supabase/functions/_shared/recordAiRun.ts (insert ai_runs with start + update)
- supabase/functions/_shared/recordAuditLog.ts
- supabase/functions/_shared/langfuseClient.ts (full impl per docs/plan/08_OBSERVABILITY_OPS.md)
- supabase/functions/_shared/mockAi.ts (fixtures for each orchestrator, used in M1+M2)

For each, write minimal types + the interface. Implementations can be stubbed for M1.

DoD:
- All files compile in Deno (run `deno check` on each)
- Type-only exports look complete (you can plug in real impl later without changing callers)
- Unit tests for langfuseClient.computeCostUsd
- Unit tests for truncate

NOT to do:
- Don't implement anthropicJson logic (M3)
- Don't add edge functions (different session)
- Don't touch migrations (Session B)
```

**יום 2-3 סיכום:** 3 PRs merged. Auth עובד, sccpopulating offers ב־UI עוד לא ניתן (אין endpoint), אבל יש בסיס.

---

## Day 4-5 — Edge function + UI scaffold (3-4 parallel sessions)

### Task 4.1 — Edge function analyze-offer (mock)

**Session A, branch `feat/m1-edge-analyze`**

```
Goal: Edge function that takes offer_id, returns mock UnderwritingOrchestrator output.

Files:
- supabase/functions/analyze-offer/index.ts
- supabase/functions/_shared/orchestrators/underwriting.ts (mock impl)
- supabase/functions/_shared/types/envelope.ts (UniversalEnvelopeSchema from docs/plan/05_AGENT_ROSTER.md)
- supabase/functions/_shared/types/underwriting.ts (UnderwritingResponseSchema)

Behavior:
- POST /functions/v1/analyze-offer with { offer_id }
- Auth: must be authenticated, must have access to offer
- Mock impl: 
  - Sleep 8 seconds (simulate latency)
  - Return a realistic fixture matching UnderwritingResponseSchema
  - Insert ai_runs entry with status='success'
- Use EdgeRuntime.waitUntil for the sleep+insert
- Return 200 immediately with { run_id }, UI polls or uses Realtime

Cost cap check (stub for now, real in M2): always pass.
Kill switch check (stub for now, real in M2): always not paused.

DoD:
- Deploy via supabase functions deploy
- POST returns { run_id } in <100ms
- 8 sec later, ai_runs row appears with mock UnderwritingResponseSchema in output_payload
- Langfuse trace created (with mock generation)
- audit_log entry: 'ai_run.start' + 'ai_run.complete'
```

### Task 4.2 — Offers list + create UI

**Session B, branch `feat/m1-ui-offers`**

```
Goal: User can list offers, click "Add Offer" to create one.

Files:
- src/app/(app)/offers/page.tsx (list)
- src/app/(app)/offers/new/page.tsx (form)
- src/app/(app)/layout.tsx (sidebar with nav: Offers, Settings)
- src/components/offers/OffersTable.tsx
- src/components/offers/CreateOfferForm.tsx
- src/lib/queries/offers.ts (server-side fetchers)
- src/lib/actions/createOffer.ts (server action)

Behavior:
- /offers shows table of offers user has access to (RLS filters)
- "Add Offer" → /offers/new
- Form: name, vertical (dropdown of verticals), website_url, affiliate_program_url
- Submit → creates offer with status='draft', visibility='admin_only' (M1: only admin can really see), redirects to /offers/[id]

DoD:
- /offers loads in <500ms
- Creating offer works
- Form validation via Zod
- TypeScript strict, no `any`

NOT to do:
- Don't add Analyze button (next task)
- Don't add scorecard UI (next task)
```

### Task 4.3 — Offer detail + Analyze button

**Session C, branch `feat/m1-ui-offer-detail`**

```
Goal: User can open an offer, click "Analyze", see mock scorecard.

Files:
- src/app/(app)/offers/[id]/page.tsx (overview + tabs)
- src/components/offers/OfferOverview.tsx
- src/components/offers/OfferScorecard.tsx (renders UnderwritingResponseSchema scores)
- src/components/offers/OfferVerdict.tsx
- src/components/offers/AnalyzeButton.tsx
- src/lib/actions/triggerAnalyze.ts (server action that calls edge function)

Behavior:
- /offers/[id] shows tabs: Overview, Scorecard, Verdict
- Overview shows offer metadata
- Scorecard tab: if no ai_run yet → "Run analysis" CTA; if running → spinner; if complete → 13 dimension cards
- Verdict tab: similar
- Click Analyze → triggers edge function → polls ai_runs table every 2s until status='success'
- (M2 will replace polling with Realtime)

DoD:
- Click Analyze on a new offer → see scorecard after 8s
- Each of 13 dimensions shown with score + reasoning
- Verdict shown
- TypeScript strict
- Loading state, error state, empty state for each tab

NOT to do:
- Don't add Test Kit tab (M4)
- Don't add real-time updates (M2)
- Don't add streaming (we chose polling per docs/plan/02_STACK.md)
```

### Task 4.4 — /admin/ai-runs page

**Session D, branch `feat/m1-admin-ai-runs`**

```
Goal: Admin can see all ai_runs across all users.

Files:
- src/app/(admin)/layout.tsx (admin sidebar)
- src/app/(admin)/ai-runs/page.tsx
- src/components/admin/AiRunsTable.tsx
- src/middleware.ts update: require system_role='admin' on /admin/*

Behavior:
- /admin/ai-runs shows table: created_at, user, offer, orchestrator, status, cost, latency
- Filter: by orchestrator, by status, by date range
- Click row → modal with full input/output JSON

DoD:
- Only admin can access (others get 403)
- Pagination works
- Sort by created_at desc default
```

**יום 4-5 סיכום:** end-to-end flow עובד. אתה (כאדמין) יוצר offer, לוחץ analyze, רואה scorecard, רואה את הקריאה ב־/admin/ai-runs.

---

## Day 6-7 — Polish + DoD verification

### Task 6.1 — error_logs + audit_logs migrations

**Session A, branch `feat/m1-error-audit`**

```
Goal: Add migrations 0007 (error_logs + failed_messages) and 0008 (audit_logs).

Copy SQL from docs/plan/04_SCHEMA_LEAN.md.

DoD:
- Migrations applied
- Insert from _shared/logError.ts works (verify with admin select)
- Insert from _shared/recordAuditLog.ts works
```

### Task 6.2 — Realtime subscription proof of concept

**Session B, branch `feat/m1-realtime-poc`**

```
Goal: Replace polling on ai_runs status with Supabase Realtime.

Files modified:
- src/components/offers/AnalyzeButton.tsx
- src/lib/queries/aiRuns.ts (add useAiRunRealtime hook)

Behavior:
- After clicking Analyze, subscribe to ai_runs UPDATE where id=<run_id>
- When status changes to success/failed, refetch and update UI
- Cleanup subscription on unmount

DoD:
- Open 2 browser tabs, start analyze in tab 1
- Tab 2 (if showing same offer) sees status change without refresh
- No memory leak (verify in DevTools)

NOT to do:
- Don't change polling to Realtime everywhere — just on AnalyzeButton
```

### Task 6.3 — CLAUDE.md ברמת הריפו

**Session C, branch `feat/m1-claude-md`**

```
Goal: Write CLAUDE.md that every future session will read first.

Files:
- CLAUDE.md (root)

Content (template):
- Project: AffiliateOS Pro v1.0 — affiliate underwriting SaaS
- Owner: Izak (settonbrothers)
- Current milestone: M1 (week 1-2)
- Read first: docs/plan/00_README.md → docs/plan/01_PRINCIPLES.md → docs/plan/02_STACK.md → docs/plan/06_PARALLEL_CLAUDE_PROTOCOL.md
- Stack pinned (see docs/plan/02_STACK.md)
- Hard rules (copy from 06_PARALLEL_CLAUDE_PROTOCOL.md)
- Commands: pnpm dev / pnpm test / pnpm build / supabase db push / supabase functions deploy
- Local dev setup steps
- Where to find things (file structure)
- "When in doubt, ask Izak" — give your Slack / phone

DoD:
- File comprehensive, <250 lines
- Any future session that reads only this + 01/02/06 can write quality code
```

### Task 6.4 — Manual end-to-end test (אתה, אנושית)

ביום 7:
1. `git pull`, `pnpm install`, `pnpm dev`
2. נכנס ל־localhost:3000 בכרום incognito
3. Sign up
4. Verify email (Supabase Auth)
5. נכנס ל־/offers
6. צור offer "Jasper.ai", vertical AI/SaaS
7. נכנס ל־/offers/[id]
8. לחץ Analyze
9. ראה loading 8s
10. ראה scorecard עם 13 dims + verdict
11. דרך SQL: עדכן system_role של ה־user שלך ל־'admin'
12. רענן → ראה sidebar admin
13. נכנס ל־/admin/ai-runs
14. ראה את הקריאה שלך
15. לחץ row → ראה full payload
16. בדוק Langfuse cloud → ראה trace
17. בדוק Supabase Studio → ראה rows ב־ai_runs, audit_logs

אם כל ה־15-17 עובדים → **M1 DoD verified**, מ־merge ל־main + tag `v0.1.0`.

---

## חוקי "מתי להפסיק" ביום נתון

אם בסוף יום:
- Session נתקע > 2 שעות על אותה בעיה → סגור אותו, פתח חדש עם briefing מעודכן
- 4 PRs כבר open ולא ראית אותם → עצור הכל, סגור את ה־queue
- אתה רץ אחרי 6 sessions = הזמן ל־coordination > הזמן ל־code
- מצא bug critical (deploy broken) → עצור הכל, תקן, חזור
- היה לך 8 שעות סשנים → לך לישון. delegation לא מחליפה שינה

---

## בסוף שבוע 1

DoD של M1 חייב להיות מסומן 100% לפני שאתה פותח שבוע 2 (M2). אל תיכנס למלכודת של "M1 99%, נמשיך ונחזור" — זה לעולם לא חוזר.

**אם M1 לא נגמר בשבוע 1:**
- אל תכנס לפאניקה
- היה ה־scope גדול מדי או הקצב איטי?
- אם scope: חתוך עוד (לדוגמה: דחה realtime ל־M2)
- אם קצב: פחות sessions, יותר תיאום
- חזור על הלקח ב־`06_PARALLEL_CLAUDE_PROTOCOL.md`

**אם M1 נגמר ביום 5:**
- מצוין. השתמש בימים 6-7 ל־:
  - כתיבת 5 golden set entries (מתחילים עם 5, נגיע ל־20 ב־M3)
  - retro: מה היה איטי, מה היה מהיר?
  - עדכון של המסמכים אם משהו השתנה

---

## אזהרה אחת לסיום

ביום 1 תרצה לפתוח 7 sessions ולהריץ הכל. **אל תעשה את זה.** התשתית של היום הראשון (Next config, Supabase client, _shared utilities, types) חייבת להיות מתואמת. אם תפתח 7 במקביל ביום 1, תקבל 7 גרסאות שונות של אותה תשתית.

הקצב הנכון:
- יום 1: 1 session (foundation)
- יום 2-3: 3 sessions (auth + migrations + utilities)
- יום 4-5: 4 sessions (edge function + UI x3)
- יום 6-7: 3 sessions (polish + tests)

**7 sessions במקביל זה תאורטי — בפועל אופטימום הוא 3-4 בו זמנית.**
