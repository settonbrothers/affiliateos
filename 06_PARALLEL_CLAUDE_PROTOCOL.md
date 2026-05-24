# Parallel Claude Code Protocol

> זה הסעיף הכי קריטי לסיטואציה שלך. 7 sessions של Claude שעובדים על אותו codebase ללא תיאום מפורש = merge hell, drift ארכיטקטוני, ו־prompts סותרים אחרי שבועיים.
>
> כל הנחיה כאן חוזרת על עצמה ב־CLAUDE.md ברמת הריפו. זה לא נחמדות — זה survival.

---

## עקרון הבסיס: אתה ה־integration layer

7 sessions של Claude יודעים לכתוב קוד טוב לכל-אחד-בעצמו. הם **לא** יודעים לתאם ביניהם. אתה זה שמתאם.

תפקידך:
- מחליט איזה task ילך לאיזה session
- מאשר merges ל־main
- שומר שאף שני sessions לא נוגעים באותו קובץ באותו זמן
- קורא diff של כל ה־code לפני שמשחרר ל־main
- מעדכן את ה־documentation (התיקייה הזאת) כשמתקבלות החלטות חדשות

אם אתה לא תעשה את זה — אף Claude לא יעשה את זה במקומך.

---

## חוקי זהב (קריא לפני שאתה פותח session)

### חוק 1: כל session = branch ייעודי

```
feat/m1-foundation-auth        # session A
feat/m1-foundation-rls         # session B
feat/m1-foundation-ai-runs     # session C
```

לעולם אין שני sessions שעובדים על אותו branch.

### חוק 2: כל session = component ייעודי

חלוקה ראשונית פר־מיקום בקוד:
- Session = `src/components/` directory ספציפי
- Session = `supabase/functions/<name>/` ספציפי
- Session = `supabase/migrations/<N>_<name>.sql` יחיד
- Session = `app/<route>/` ספציפי

**אסור** ש־2 sessions ייגעו באותו קובץ.

### חוק 3: רק session אחד כותב migrations בכל רגע נתון

הסיבה: numbering conflicts. אם session A מתחיל `0014_foo.sql` ו־session B מתחיל `0014_bar.sql` במקביל — אחרי merge יש שניהם עם אותו מספר.

תהליך:
1. session שצריך migration כותב הודעה: "I need to add migration 0014_<name>"
2. אתה (אנושית) בודק שאף migration אחר לא בעבודה
3. אם נקי — אתה אומר לו "Go ahead, 0014 is yours"
4. אם תפוס — אומר "Use 0015 instead" או "Wait for 0014 to merge first"

תשתפר זה ב־M3+ עם CI script שמוודא ייחוד מספרים, אבל ב־M1-M2 ידני.

### חוק 4: types regen רק אחרי merge ל־main

```bash
# After PR merged to main:
git checkout main
git pull
bunx supabase gen types typescript --linked > src/types/database.ts
git add src/types/database.ts
git commit -m "chore: regen types after migration X"
git push
```

**אסור:** sessions ירוצו `gen types` ב־branch שלהם. כי אז כל branch מקבל types נפרדים שמתנגשים.

חריג: session שעובד על migration **חייב** להריץ `gen types` ב־branch שלו כדי שהקוד שלו יקמפל. אבל הוא **לא commit את types.ts**. במקום, ה־merge ל־main עושה את ה־regen.

### חוק 5: PR-only ל־main, אין direct push

הגדרה ב־GitHub Settings → Branches → main:
- Require PR before merging: ✓
- Require status checks: typecheck, lint, test, build
- Require linear history: ✓ (rebase only, אין merge commits)
- Include administrators: ✓ (גם אתה)

### חוק 6: PR קטן ייעודי

PR קטן = <500 שורות diff (לא כולל generated files), נושא יחיד.

```
PR #14: feat(m1): add ai_runs table + RLS policy
PR #15: feat(m1): add edge function analyze-offer (mock)
PR #16: feat(m1): UI for /offers list page
```

לא:
```
PR #14: feat(m1): everything M1 needs
```

ב־PR ארוכים אתה מאבד יכולת לעשות review אמיתי.

### חוק 7: review הוא אתה, לא Claude

לא נותנים לסשן Claude לעשות review של PR שכתב Claude אחר. הם יסכימו זה עם זה גם כשטועים.

**Workflow:**
1. Session A מסיים, פותח PR
2. CI עובר
3. **אתה** קורא את ה־diff שורה אחר שורה
4. אם משהו לא ברור — שואל את session A "למה X?"
5. אם מסכים — אתה מ־merge

אתה יכול להעזר בסשן נפרד (Claude) ל־review, אבל אתה מקבל החלטה.

### חוק 8: decisions folder

```
decisions/
  001-tech-stack.md
  002-jsonb-vs-normalized.md
  003-prompt-versioning.md
  ...
```

כל החלטה ארכיטקטונית = קובץ markdown:
```markdown
# 003 — Prompt Versioning

## Status
Accepted, 2026-05-25

## Context
Sessions kept asking how to handle prompt updates.

## Decision
Prompts live as markdown files in `prompts/<orchestrator>/<version>.md`.
A `_active.json` per orchestrator points to the active version.
Sync script `scripts/prompts:sync` writes to DB on main merge.
Rollback via DB update (`is_active=true` on older row) is allowed for emergencies.

## Consequences
- Every prompt change is in git history
- Sessions don't need to ask "where does the prompt live"
- Rollback is 30s instead of a deploy
```

Sessions קוראים את `decisions/` לפני שמחליטים מחדש על נושא שהוחלט.

---

## איך מחלקים tasks לסשנים

### דוגמה: M1 בשבועיים, 7 sessions

חלוקה זמן 1 (יום 1-3):

| Session | Branch | מטרה |
|---|---|---|
| A | `feat/m1-bootstrap` | Next.js init + Tailwind + shadcn + ESLint + Prettier + CI |
| B | `feat/m1-supabase-init` | Supabase project setup + env vars + types pipeline + first migration 0001_init_roles |
| (זה הכל — חכה עד שיוצאים ל־main) | | |

חלוקה זמן 2 (יום 4-7), אחרי merge של A + B:

| Session | Branch | מטרה |
|---|---|---|
| A | `feat/m1-auth-ui` | UI ל־login + signup + magic link, באמצעות @supabase/ssr |
| B | `feat/m1-migration-workspaces` | Migration 0003_workspaces + RLS + helper function |
| C | `feat/m1-migration-offers` | Migration 0005_offers + 0006_ai_runs + 0007_error_logs |
| D | `feat/m1-shared-utils` | `_shared/auth.ts`, `_shared/logError.ts`, `_shared/dlq.ts` |
| E | `feat/m1-edge-fn-analyze` | Edge function `analyze-offer` עם mock UnderwritingAgent |
| F | `feat/m1-ui-offers-list` | `/offers` page + table |
| G | `feat/m1-ui-offer-detail` | `/offers/[id]` page + tabs scaffold |

**הערה חשובה:** B,C עובדים על קבצי migration שונים — אסור שהם יעבדו על אותו `0005_offers.sql`.

חלוקה זמן 3 (יום 8-14), אחרי merge של רוב הקודם:

| Session | Branch | מטרה |
|---|---|---|
| A | `feat/m1-langfuse` | `_shared/langfuseClient.ts` + integration ב־edge functions |
| B | `feat/m1-audit-logs` | Migration 0008 + middleware ל־audit logging |
| C | `feat/m1-mock-fixtures` | `_shared/mockAi.ts` עם fixtures מציאותיים ל־UnderwritingAgent |
| D | `feat/m1-admin-ai-runs` | `/admin/ai-runs` page |
| E | `feat/m1-deploy-pipeline` | Vercel project setup + branch deploy rules |
| F | `feat/m1-claude-md` | כתיבת `CLAUDE.md` ברמת הריפו מבוסס על המסמכים האלה |
| G | `feat/m1-readme` | README + docs/setup.md |

---

## מה לעשות כשסשנים מתנגשים

### תרחיש 1: שני sessions פתחו אותו קובץ במקביל

לדוגמה: A פותח `src/lib/queries/offers.ts` כדי להוסיף `getOfferById`. B פותח את אותו קובץ כדי להוסיף `listOffers`.

**פתרון:**
1. ה־PR השני שמגיע ל־merge נכשל ב־conflict
2. אתה אומר ל־session B: "rebase against main, resolve conflict"
3. Session B עושה `git fetch origin main && git rebase origin/main`, פותר conflict, force-push branch שלו
4. PR נפתח מחדש, CI רץ, אתה מ־merge

**אל תעשה:** אל תיתן ל־Claude לעשות force-push לעצמו על main. רק PR-flow.

### תרחיש 2: שני sessions החליטו אחרת על תבנית

לדוגמה: A הוסיף error handling עם `try/catch` שמחזיר `Result<T, E>` type. B הוסיף error handling שזורק exceptions ונתפס ב־boundary.

**פתרון:**
1. אתה מזהה את זה ב־review
2. כותב decision: `decisions/00X-error-handling-pattern.md`
3. בוחר אחד (לדוגמה: zorck exceptions, boundary catches)
4. אומר ל־session שלא תאם: "Refactor to match decision 00X"
5. אחרי שתואם, merge

**אל תעשה:** אל תיתן לשני סגנונות להיכנס. אחר כך תצטרך לעשות sweep אחיד שכואב.

### תרחיש 3: session נתקע על dependency של session אחר

לדוגמה: E רוצה להשתמש ב־`_shared/auth.ts` שעדיין לא מ־merged.

**פתרון:**
1. Option A (מומלץ): E עוצר ועובר ל־task אחר. ממתין ש־D מ־merged.
2. Option B: E כותב stub מקומי (`function requireUser() { return { id: 'TODO' } }`) עם TODO comment. אחרי ש־D נכנס, E עושה rebase ומחליף.

**אל תעשה:** אל תיתן ל־E להעתיק את הקוד של D ל־branch שלו. אחרי merge יהיו שתי גרסאות.

### תרחיש 4: session החליט שיש דרך טובה יותר

לדוגמה: B הציע "בוא נשתמש ב־Drizzle ORM במקום Supabase client".

**פתרון:**
1. עצור את ה־session
2. בדוק: האם זה תואם ל־`02_STACK.md`?
3. אם לא — אומר "No, we use Supabase client per stack doc"
4. אם כן (נדיר) — דורש PR ל־`decisions/` שמתעדף את ההחלטה, ואחר כך מעדכן את `02_STACK.md`

---

## איך כותבים task לסשן

**Bad task:**
```
Build the auth flow.
```

**Good task:**
```
# Task: M1 — Auth UI components

## Context
We're in milestone M1. The Supabase project is set up.
Migrations 0001-0002 are merged (profiles table exists).

## Files to create
- src/app/(auth)/login/page.tsx
- src/app/(auth)/signup/page.tsx
- src/app/(auth)/callback/route.ts (magic link callback)
- src/components/auth/LoginForm.tsx
- src/components/auth/SignupForm.tsx
- src/lib/supabase/server.ts (if not exists)
- src/lib/supabase/client.ts (if not exists)

## Files NOT to touch
- src/types/database.ts (auto-generated, leave alone)
- supabase/migrations/* (different session owns migrations)
- _shared/auth.ts (different session)

## Decisions to follow
- decisions/001-tech-stack.md (Next 15 App Router, no Pages Router)
- decisions/002-zod-everywhere.md (LoginSchema/SignupSchema with Zod)
- decisions/003-prompt-versioning.md (irrelevant here)

## Definition of Done
- [ ] User can navigate to /login, enter email + password, get logged in
- [ ] User can navigate to /signup, enter email + password, account created in Supabase
- [ ] User can click "Send magic link", receive email, click link, get logged in
- [ ] On error, user sees inline form error message
- [ ] Form uses React Hook Form + zodResolver
- [ ] Branch name: feat/m1-auth-ui
- [ ] PR title: "feat(m1): auth UI (login/signup/magic link)"
- [ ] Tests added in src/components/auth/__tests__/

## How to test
1. Run `pnpm dev`
2. Go to localhost:3000/signup
3. Sign up with a real email
4. Should redirect to /offers (empty state)
5. Logout, go to /login, log back in
6. Logout, request magic link, click link in email, should be logged in

## When you're done
- Commit
- Push branch
- Open PR
- Comment "Ready for review" — I will check.

## What you must NOT do
- Don't add Stripe (M5)
- Don't add MFA (post-MVP)
- Don't add invite-code redemption (M5)
- Don't refactor _shared/auth.ts (different session owns it)
```

ה־task הזה הוא 30 שורות. הוא לוקח ל־Claude 2-3 שעות לבצע. הוא מבטיח שלא יחפור איפה שלא צריך.

---

## CLAUDE.md ברמת הריפו

ה־CLAUDE.md ברמת הריפו (לא במסמכים האלה — בריפו עצמו) חייב לכלול:

```markdown
# CLAUDE.md — affiliateos-claude

## Read first
- /docs/principles.md → architectural decisions
- /docs/milestones.md → current milestone + DoD
- /docs/stack.md → stack rules (what to use, what NOT)
- /decisions/*.md → past decisions

## Current milestone
M1 (started 2026-05-25). DoD in /docs/milestones.md.

## Hard rules
- Never use `any`, use `unknown` + narrow
- All forms via React Hook Form + zodResolver
- All API responses validated with Zod
- All Supabase calls go through `src/lib/supabase/{client,server}.ts`, never `createClient` ad-hoc
- All migrations are admin-coordinated (ask before adding)
- All new tables get RLS in the same migration
- Never use Drizzle, Prisma, tRPC, Redux, Zustand, LangChain
- Never auto-regenerate database.ts in a branch — wait for main merge
- Never push directly to main
- Never amend a commit that was pushed
- Never run `supabase functions deploy` from a session — only from CI

## When in doubt
Stop and ask. Don't guess.
```

ה־CLAUDE.md הזה נכתב ב־M1 (Session F בחלוקה הראשונה).

---

## Cadence — מה אתה עושה בכל יום

### בוקר (30 דקות)
1. `git log main --oneline -20` — מה נכנס אתמול
2. בדוק PR open queue — מה ממתין לי
3. בדוק CI status — האם משהו אדום
4. בדוק PostHog dashboard (M5+) — האם משתמשים בפועל הזיזו משהו

### בכל merge (5-10 דקות לכל PR)
1. קרא את ה־diff שורה אחר שורה
2. הרץ את ה־commands שמופיעים ב־test plan
3. בדוק שאין `any`, שאין `console.log`, שאין `TODO` without ticket
4. בדוק שאם נוגע ב־migration, מעודכן `04_SCHEMA_LEAN.md`
5. merge עם squash

### סוף יום (15 דקות)
1. עדכן TaskList של ה־milestone — מה נסגר, מה נשאר
2. אם session נתקע — תיעוד הסיבה
3. אם החלטה חדשה נלקחה — פתח `decisions/00X.md`
4. אם משהו השתנה בארכיטקטורה — עדכן את המסמך הרלוונטי כאן

### סוף שבוע (1 שעה)
1. retro על הסשנים השבוע: איפה היה drift? איזה decision חסר?
2. עדכון של `06_PARALLEL_CLAUDE_PROTOCOL.md` (הקובץ הזה) אם לקחים חדשים
3. תכנון של השבוע הבא: איזה tasks, איזה sessions, איזה dependencies
4. בדיקת AI cost בשבוע: $? לפי orchestrator?

---

## אנטי־patterns להימנע מהם

| אנטי־pattern | למה זה רע | מה לעשות במקום |
|---|---|---|
| "תכתוב את כל M2 בסשן אחד" | סשן יחיד = bottleneck, אין parallelism, וגם לא ייגמר ביום | פצל ל־5-7 sessions שמריצים יחד |
| "תפתח 7 sessions בכל מה שאתה רוצה לעשות" | יתנגשו בקבצים, ב־migrations, ב־types | רק 3-4 פעילים בו זמנית, כל אחד בתחום שלו |
| "תן ל־Claude לעשות review ל־Claude אחר" | מסכימים ב־100% גם כשטועים | אתה review, אנושית |
| "הוסף את זה לטבלה קיימת בלי migration" | DB ידני = drift בין dev ל־prod | רק migrations |
| "שכח מ־RLS, נוסיף בסוף" | אחרי 20 טבלאות אתה תפחד לגעת בזה | RLS באותו migration |
| "תעתיק את הפונקציה מ־session אחר ל־branch שלי" | תהיו 2 גרסאות לאחר merge | חכה ל־merge או עבור ל־task אחר |
| "תעשה rebase של 30 commits" | history אבוד, conflicts מורכבים | rebase של 1-3 commits, או squash before rebase |
| "תרוץ migration בלי לבדוק על dev" | breaks prod | תמיד `supabase db reset` ב־local קודם |

---

## בקרת איכות: שאלות שאתה שואל את עצמך כל שבוע

- האם 7 sessions באמת רצים, או רק 2 בפועל?
- האם merge cadence שלי הוא יומי, או הצטברו 15 PRs?
- האם החלטות חדשות מתועדות ב־`decisions/`, או רק בראש שלי?
- האם הקוד נראה אחיד, או 5 סגנונות שונים?
- האם רוב הזמן שלי הולך על code, או על coordination?

אם רוב הזמן על coordination → צמצם sessions פעילים.
אם הקוד לא אחיד → כתב יותר decisions.
אם merges הצטברו → עצור את הפיתוח, עשה merge sprint.
