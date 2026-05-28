# AffiliateOS Pro — Build Plan (Claude Code Edition)

> מסמך זה מחליף את `affiliateos_pro_build_spec/11_BUILD_PLAN_CLAUDE_CODE.md` המקורי. הוא נכתב **אחרי** קריאת כל ה־spec וההכרות עם הסיטואציה הספציפית: מבצע סולו עם Claude Code כ־"7 מפתחים במקביל", בעל ידע domain עמוק (media buyer בעצמו), עם פרודקציה אחת כבר באוויר (richer-ai-agents-hub) שמלמדת מה עובד.
>
> ה־spec המקורי תקף כ־**reference למוצר הסופי (V3)**. המסמכים בתיקייה הזאת מגדירים **איך להגיע לשם** — דרך MVP מצומצם, שלבים שמושיגים תוצאה דמואבילית, וחתכים מודעים שניתן להוסיף בחזרה אחרי השקה.

---

## למי המסמך הזה

- **אתה (Izak)** — האדם שמוביל את הבנייה.
- **Claude Code sessions** — כל session חדש שתפתח קורא את הקבצים האלה כדי לדעת את ההקשר. הם מחליפים את ה־CLAUDE.md ברמת הפרויקט עד שתעתיק את הרלוונטי לריפו עצמו.

המסמך לא כתוב לקורא חיצוני (משקיע, יועץ). הוא כתוב כדי לבצע.

---

## איך לקרוא את התיקייה

קרא לפי הסדר הזה:

| # | קובץ | מה תקבל |
|---|---|---|
| 00 | `00_README.md` (זה) | הסבר על מבנה התיקייה |
| 01 | `01_PRINCIPLES.md` | החלטות ארכיטקטוניות, מה חתכנו, פתוחים שאני מבקש שתעקוב אחריהם |
| 02 | `02_STACK.md` | tech stack מלא עם רציונל לכל בחירה |
| 03 | `03_MILESTONES.md` | 6 milestones (M1-M6) שמחליפים את 13 ה־sprints. כל אחד עם DoD ודמו |
| 04 | `04_SCHEMA_LEAN.md` | ה־schema המצומצם (~28 טבלאות במקום 120+) עם migration order |
| 05 | `05_AGENT_ROSTER.md` | 5 orchestrators (במקום 20 agents) עם input/output schemas |
| 06 | `06_PARALLEL_CLAUDE_PROTOCOL.md` | איך מריצים 7 sessions מקבילים בלי merge hell |
| 07 | `07_EVAL_HARNESS.md` | golden dataset + regression workflow + prompt rollback |
| 08 | `08_OBSERVABILITY_OPS.md` | Langfuse, Sentry, DLQ, kill switches, cost caps, alerts |
| 09 | `09_FIRST_WEEK_TASKS.md` | שבוע 1 מפורק לטסקים קונקרטיים לסשנים מקבילים |

קרא את 01-03 לפני שאתה כותב שורת קוד אחת. את 04-08 קרא בזמן M1. את 09 תפתח באחרון.

---

## ה־TL;DR של התוכנית

- **8-10 שבועות** ל־MVP בידי soft launch ל־5-15 משתמשים stealth.
- **6 milestones**, לא 13 sprints — כל אחד דמואביל.
- **~28 טבלאות** (מצומצם מ־120+ בעזרת JSONB עמודות evaluation).
- **5 AI orchestrators** (מצומצם מ־20+ agents נפרדים), כולם תחת Universal Envelope.
- **Mock AI מהיום 1**, real AI ב־M3 (לא M12).
- **Eval harness מ־M3**, לפני שמשחררים prompt חדש.
- **Kill switch, DLQ, prompt rollback** מ־M1 — לקח מ־richer-ai-agents-hub.
- **Stealth launch**: invite-only, 5-15 משתמשים שאתה מזמין אישית.
- **3 verticals תומכי engine מהיום 1**, אבל קטלוג מתחיל ב־AI/SaaS, Health/Mental ב־M4.

ההחלטות נסגרו בשיחה עם המשתמש ב־24 במאי 2026.

---

## מה זה לא

- **לא תוכנית "סופית, סגורה לחלוטין"**. כל milestone צריך retro ועדכון של המסמכים האלה.
- **לא תוכנית מוצר**. המסמך הזה הוא execution-focused. החלטות מוצר (מה ה־UX של verdict, איזה verticals אחר כך, איזו עוד persona) מבוססות על למידה ממשתמשים אמיתיים ולא על אינטואיציה ב־vacuum.
- **לא בלתי משתנה**. אם משהו במסמכים האלה התברר כשגוי תוך כדי, **עדכן אותם**. אתה וה־sessions קוראים אותם כ־ground truth.

---

## הקשר ל־richer-ai-agents-hub

החלטות שלקחנו מהפרויקט הקיים:
- מבנה edge functions עם `_shared/` ל־utilities (`logError`, `dlq`, `anthropicRetry`, `judgeReply`, וכו')
- Prompt versioning כ־markdown files בריפו + sync script + rollback button
- LLM-as-judge layer
- `is_paused` per-agent kill switch
- `failed_messages` + admin replay button
- Langfuse trace על כל קריאה
- RLS admin-only reads על data רגיש
- Migrations only, אין עריכה ב־Studio

**שינוי משמעותי לעומת richer-ai-agents-hub:** כאן Mock AI מהיום 1 (ב־hub התחלת ב־real מיד, וזה הקשה על debugging). וכאן Eval harness מ־M3 (ב־hub זה הגיע מאוחר).

---

## משוב מהיר על המסמכים האלה

המסמכים יותעדכנו אחרי כל milestone. אם תוך כדי M1 אתה רואה שמשהו ב־`04_SCHEMA_LEAN.md` לא נכון — עדכן את הקובץ ועשה commit. ה־sessions הבאים יקראו את הגרסה החדשה.
