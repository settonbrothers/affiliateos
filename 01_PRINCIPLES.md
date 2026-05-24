# Principles & Architectural Decisions

> אלה ההחלטות שמכוונות הכל אחר. אם session של Claude סוטה מאחת מהן — עצור והחזר.

---

## 10 ההחלטות הגדולות

| # | החלטה | למה |
|---|---|---|
| 1 | **MVP = 6 milestones, לא 13 sprints** | sprints קלאסיים לא עובדים לסולו עם 7 sessions במקביל. milestones מוגדרים סביב דמו, לא סביב פיצ'רים |
| 2 | **Mock AI מהיום 1, Real AI מ־M3** | מאפשר לבנות 80% של ה־UI/flow בלי לשרוף $ על LLM. כשעוברים ל־real, ה־contracts כבר ייצובו |
| 3 | **5 orchestrators במקום 20 agents** | 20 prompt engineering loops לסולו = burnout. 5 orchestrators כל אחד עם sub-prompts פנימיים אם צריך |
| 4 | **~28 טבלאות עם JSONB ל־evaluation, לא 120+** | אל תפצל offer ל־9 טבלאות לפני שיודעים מה השאילתות. JSONB עכשיו, normalization כשיש pain |
| 5 | **Engine רב־vertical מהיום 1, קטלוג מדורג** | Health/Mental compliance מתווסף ב־M4. עד אז 50 curated AI/SaaS offers בלבד |
| 6 | **Admin-only offer ingestion ב־MVP, אין user-submit** | אתה מדביק URL → AI מחלץ → אתה מאשר. פשוט יותר, איכותי יותר, מתאים ל־stealth launch |
| 7 | **Stealth invite-only ב־launch** | 5-15 משתמשים שאתה מזמין אישית. אין landing page ציבורי ב־MVP, אין waitlist, אין free tier |
| 8 | **Hybrid pricing**: subscription ($) + extra credits | $X/חודש כולל Y credits, extras נמכרים בנפרד. credit_ledger מהיום 1, Stripe metering ב־M5 |
| 9 | **Universal Envelope + Anthropic JSON tool use** | כל agent מחזיר facts/assumptions/estimates/risks/unknowns/missing_data/confidence דרך tool definition. לא JSON חופשי, לא parsing rev-engineered |
| 10 | **Kill switch + DLQ + prompt rollback מהיום 1** | לקח מ־richer-ai-agents-hub. אסור להגיע ל־production בלי 3 אלה |

---

## מה חתכנו מה־spec המקורי, ולמה

| חתך | מה | למה | מתי חוזר |
|---|---|---|---|
| Multi-workspace | טבלאות `workspaces` + `workspace_members` קיימות, אבל 1 user = 1 workspace ב־UI | teams זה complexity של B2B שאין שייכת ל־stealth MVP | M7+ (post-launch) |
| 2 פרסונות | רק Media Buyer. Social Affiliate נדחה | persona זרה לך + הכפלת UI + הכפלת prompts | M7+ אחרי validation |
| Health/Mental verticals | engine תומך, קטלוג ריק | compliance overhead (FDA, Meta) | M4 |
| 9 טבלאות offer detail | offer + 1 עמודת `evaluation jsonb` | פיצול מוקדם = migrations מתישות | כשיש שאילתה שדורשת index |
| 20+ agents | 5 orchestrators (כל אחד יכול לקרוא LLM כמה פעמים internally) | 20 prompt loops לסולו לא scaling | אחרי launch לפי data |
| Discovery Scanner full | רק "Admin Submit URL" → AI extraction | Discovery הוא startup בפני עצמו | M7+ |
| Learning patterns (8 טבלאות) | רק `raw_results` נשמר, אין pattern engine | 0 data ב־6 חודשים הראשונים → dead code | M8+, אחרי 200 results |
| CSV import + assets upload | manual entry בלבד | edge case ל־MVP | M6+ |
| Investment Memo נפרד מ־Test Kit | מסך אחד עם 2 sections | פיצול מלאכותי | אחרי validation |
| Stripe מ־sprint 1 | credit_ledger + admin-grant ב־M1; Stripe ב־M5 | Stripe complexity לא נדרשת לפני שיש מה לחייב | M5 |
| AI providers fallback | Anthropic בלבד | OpenAI fallback הוא feature, לא MVP | אחרי first paying user |
| Reviewer role נפרד | אתה ה־reviewer היחיד | אין צוות | M7+ |
| Multiple plans (basic/growth/scale) | 1 plan ב־MVP | סגמנטציה מוקדמת = guesswork | אחרי 50 משלמים |

---

## מה הוספנו לעומת ה־spec המקורי

| מה | למה | מתי נכנס |
|---|---|---|
| **Eval harness + golden dataset** | ה־spec דיבר על "prediction accuracy" אבל לא הסביר איך מודדים. בלי זה, prompt חדש = הימור | M3 (לפני real AI) |
| **Prompt rollback button** | לקח מ־richer-ai-agents-hub. כשמתפוצץ prompt בפרודקציה, צריך undo ב־30 שניות | M3 |
| **Kill switch per-agent + per-workspace** | אם agent הוזה ב־$50/שעה — צריך לעצור ב־1 קליק | M2 |
| **Cost cap per-user-per-day** | $10/day default. בלי זה, bug אחד = $500 ב־24h | M3 |
| **DLQ + admin replay** | לקח מ־richer-ai-agents-hub. AI fails → לא נאבד | M2 |
| **LLM-as-judge על verdict** | Haiku בודק שה־Sonnet לא הבטיח הכנסות / לא הזה facts | M3 |
| **Cron-based eval regression** | כל לילה: רץ את ה־prompt הנוכחי על ה־golden dataset, מודד drift | M4 |
| **Anthropic prompt caching** | system prompts ארוכים → 90% חיסכון אם cache hit | M4 |
| **Realtime UI updates** | analyzing → ready, בלי polling primitive | M2 |

---

## Open risks — דברים שאני רוצה שתעקוב אחריהם

זה ה־reservations שאני סוחב אחריי. אף אחד מהם לא חוסם התחלה, אבל כל אחד יכול לנשוך בהמשך.

### R1. Hybrid pricing זה 2-3 שבועות עבודה

Hybrid (sub + credits) דורש:
- Stripe Subscription (plans + customer portal + webhook לסטטוס)
- Stripe Metered Billing או Credit Top-Up products
- Credit ledger עם 6 סוגי transactions (granted, used, refunded, purchased, expired, adjusted)
- UI להצגת balance + cost per action
- Failure refund logic (refund אם validation נכשל)

**להחלטה ב־M5:** אם אתה רואה שזה גוזל יותר מ־3 שבועות — צמצם ל־subscription בלבד עם limits קשיחים פר־plan. credits נוסיף אחרי.

### R2. Stripe + Next.js 15 App Router webhooks

Webhooks דורשים raw body לאימות signature. Next.js 15 App Router הפך את זה ל־native אבל עדיין יש gotchas (`runtime: 'nodejs'`, לא Edge runtime, ולא לעבד JSON לפני האימות).

**להחלטה ב־M5:** כתוב את ה־webhook handler ב־`/api/stripe/webhook/route.ts` עם `export const runtime = 'nodejs'` ואל תיגע ב־body לפני verify.

### R3. Source ingestion via AI הוא ה־prompt הכי קשה

"חלץ payouts, GEOs, traffic rules, claims מ־URL כלשהו" — סייטים JS-heavy לא נטענים עם fetch פשוט. גם עם headless browser, יש ToS שחוסם crawling, captcha, וכו'.

**להחלטה ב־M2:** התחל עם fetch פשוט + cheerio parsing. fallback: admin מדביק את הטקסט ידנית במקום URL. אם 60%+ מה־URLs לא נחלצים — תקנה ScraperAPI ($49/חודש) לפני M3.

### R4. Universal Envelope JSON parsing

Anthropic JSON tool use פותר 95% מהבעיות, אבל **לא 100%**. לפעמים המודל מחזיר tool_use עם schema פגום. צריך:
- Zod validation אחרי tool response
- אם נכשל → 1 retry עם "fix your JSON" prompt
- אם עדיין נכשל → DLQ + alert לאדמין

**להחלטה ב־M3:** כל קריאה ל־LLM עוברת דרך `_shared/anthropicJson.ts` שמטפל ב־retry + Zod validation. אסור לכתוב Anthropic SDK calls ישירות בקוד הפיצ'ר.

### R5. Verdict-quality bar הוא קריטי

אם המערכת אמרה "small_paid_test" והמשתמש הפסיד $500 — שברת אמון. ב־stealth של 10 משתמשים, אמון רעוע = 0 word-of-mouth = no scale.

**להחלטה ב־M3:** הרצת golden set (20 offers + verdicts ידועים שאתה כותב) חייבת לעבור ב־>75% הסכמה לפני שמשחררים prompt למשתמש. ב־<75% — אסור deploy.

### R6. Cold start על Operator Fit

`operator_fit` score תלוי ב־user_patterns. אם אין patterns (M1-M6), מה מחזירים? אם מחזירים `null`, ה־verdict יסתמך רק על 12 dimensions במקום 13. אם מחזירים default = 50, מטעים.

**להחלטה ב־M3:** ב־MVP, operator_fit = 70 (neutral-positive) כברירת מחדל. ה־spec יציין "not enough data yet" באדם.

### R7. Multi-vertical scoring weights

ה־spec אומר ש־weights זזות לפי vertical/persona. אבל המבנה של `scoring_weight_sets` לא מוגדר היטב. אם נכניס logic מורכב מ־M1, ה־UI יקרוס סביב weight tuning.

**להחלטה ב־M2:** weights קבועים פר־vertical, מוגדרים בקוד כ־constants (לא DB). אחרי M5 (כשיש משתמשים אמיתיים) נעביר ל־DB-driven.

### R8. 7 parallel Claude sessions = drift ארכיטקטוני

הסכנה הכי גדולה ב־solo execution. כל session מקבל קונטקסט נפרד וגוזר החלטות שונות. אחרי 4 שבועות הקוד הוא mosaic של 7 סגנונות שונים, 3 פטרני error handling, 2 גישות ל־RLS.

**להחלטה מתמשכת:** קרא את `06_PARALLEL_CLAUDE_PROTOCOL.md` והדבק לו. שבועי, קרא diff של כל הקוד החדש בעצמך (לא תן ל־Claude לעשות review של Claude).

### R9. אין eval harness ל־source extraction

קל לבנות eval ל־"verdict matches expected" — אבל איך מודדים "extracted facts are correct"? צריך לבדוק אם הוא מצא את ה־CPA, את ה־GEO, את כל ה־traffic rules.

**להחלטה ב־M3:** golden set ל־source extraction = 10 URLs עם רשימה ידנית של 20 facts שאמורים להיחלץ מכל אחת. בודקים precision + recall.

### R10. Eval golden dataset הוא צוואר בקבוק שלך אישית

אף אחד אחר בעולם לא יכול לכתוב את ה־golden set הזה — אתה היחיד שגם media buyer וגם בונה את המוצר. **20 offers × 30 דקות לכל אחד = 10 שעות עבודה**. אם תדחה את זה ל־M3 על "אעשה בסוף", זה ידחה את כל M3.

**להחלטה:** תקצה לעצמך 2 שעות ביום בשבועות 2-3 לכתיבת golden set, במקביל לבנייה.

---

## איך לקבל החלטות ארכיטקטוניות חדשות

כשמתעורר decision חדש (לדוגמה: "איך מטפלים ב־cache invalidation?"):

1. **לא לבד ב־session**. פתח issue/note ב־`decisions/` folder בריפו.
2. **תיעוד**: בעיה, אלטרנטיבות, החלטה, סיבה.
3. **עדכון של המסמך הרלוונטי כאן**: אם הוספת decision על caching, עדכן את `02_STACK.md` או `08_OBSERVABILITY_OPS.md`.
4. **commit עם הודעה ברורה**: `decision: cache TTL = 5min for scorecards because...`

ה־sessions הבאים יקראו את ה־decisions ולא יעצרו לשאול אותך אותו דבר.

---

## What "good" looks like at each milestone

לעצמך, כדי לדעת אם אתה במסלול:

| Milestone | Test ש"אתה בסדר" |
|---|---|
| M1 (foundation) | Claude session חדש שלא ראה את הריפו מעולם — קורא את ה־README ויודע איך להוסיף migration ולפרוס |
| M2 (mock AI flow) | אתה יוצר offer, לוחץ analyze, רואה scorecard. 5 חברים שלך מבינים מה זה אומר |
| M3 (real AI) | Underwriting agent מחזיר verdict שמתאים לאינטואיציה שלך ב־>75% של 20 ה־offers שב־golden set |
| M4 (test kit + diagnosis) | אתה לוקח test kit מהמערכת, מריץ קמפיין אמיתי שלך, ממלא results, ה־diagnosis אומר משהו שאתה מסכים איתו |
| M5 (billing + invite) | אתה מזמין 5 חברים, הם נרשמים, משלמים $50, רואים scorecard, credits נחים נכון |
| M6 (polish + Health/Mental engine) | אתה יודע מה ה־top-5 bugs ויודע איך לתקן. 3 מ־5 משתמשים ביקשו לחדש |
