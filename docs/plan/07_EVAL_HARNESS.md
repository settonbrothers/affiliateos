# Eval Harness — Golden Set + Regression Workflow

> בלי זה, כל prompt change הוא הימור. עם זה, אתה יודע אחרי 90 שניות אם prompt חדש שיפר או הרע.

---

## למה זה החשוב ביותר

**כל המוצר מבוסס על איכות verdict מ־UnderwritingOrchestrator.** אם המודל אומר "small_paid_test" והמשתמש הפסיד $500, שברת אמון. ב־stealth של 10 משתמשים, אמון רעוע = 0 word-of-mouth.

ה־eval harness הוא ה־safety net היחיד שלך מול drift של prompt. ה־spec המקורי דיבר על "prediction accuracy" אבל לא נתן implementation. אנחנו פותרים את זה כאן.

---

## ה־Golden Set

### מה זה
רשימה של 20-50 offers אמיתיים שאתה (האדם, ה־media buyer) ניתחת ידנית והחלטת מה ה־verdict הנכון.

### מבנה של entry יחיד

```typescript
{
  id: 'gold-001',
  offer_name: 'Jasper.ai',
  offer_url: 'https://jasper.ai/affiliates',
  vertical_slug: 'ai_saas',

  // Inputs that the agent receives
  facts_snapshot: [
    { fact_type: 'commission_type', fact_value: 'recurring', source_quote: '...', confidence: 95 },
    { fact_type: 'commission_value', fact_value: '30%', source_quote: '...', confidence: 90 },
    // ... 20-40 facts total
  ],

  // What you decided as the "correct" verdict
  expected_verdict: 'strong_test',
  expected_score_range: [70, 85],  // overall weighted_score
  expected_high_ceiling_signal: 'promising_high_ceiling_candidate',
  expected_risk_flags: [],  // empty = no critical risks expected

  // Per-dimension expected ranges
  expected_dimension_ranges: {
    economics: [65, 80],
    demand: [70, 85],
    competition: [40, 60],  // saturated category
    compliance: [80, 95],
    offer_trust: [85, 95],
    scale_potential: [70, 85],
    // ...
  },

  // Why you decided this (for future-you to remember)
  reasoning: 'Recurring 30% commission + strong brand + active community + minimal compliance risk. Saturation is the main concern.',

  // What an answer should explicitly mention
  must_mention: [
    'recurring commission',
    'high LTV',
    'category saturation',
  ],
  must_not_mention: [
    'guaranteed',  // income promise
    'easy money',
  ],
}
```

### כמה offers צריך ולמתי

| Milestone | מינימום | פיזור |
|---|---|---|
| M3 (release real Underwriting) | 20 | 15 AI/SaaS, 3 borderline, 2 reject |
| M4 (Health/Mental release) | 35 | +10 Health, +5 Mental |
| M5 (paying users) | 50 | תוספת על בסיס data ממשתמשים |
| Ongoing | +5/חודש | offers שמשתמשים העלו אם ה־verdict הופתע |

### איך אתה כותב golden entry

קח 30-45 דקות לכל offer:
1. **5 דק'**: קרא את ה־affiliate terms, ה־landing page, חיפש Reddit reviews
2. **10 דק'**: כתב את ה־facts_snapshot ידנית (זו ה־ground truth)
3. **10 דק'**: החלט expected_verdict + expected_score_range
4. **5 דק'**: כתב reasoning + must_mention/must_not_mention
5. **5 דק'**: סקירה, וודא שה־reasoning מסבירה למה ה־score לא יותר/פחות

**20 offers × 35 דקות = 12 שעות.** פרוס על 2-3 שבועות, שעה ביום, במקביל לבנייה.

### איפה הם נשמרים

- **Source of truth**: `seeds/golden_set/<vertical>/<id>.json`
- **DB sync**: `scripts/eval:sync-golden` קורא מהקבצים וכותב ל־`golden_set_offers` table
- **Versioning**: git history של הקבצים. אם שיניתי `gold-007` from `strong_test` to `small_paid_test` — יש לי git blame.

### חוקים לכתיבת golden entries

1. **Diversity**: לא 20 offers שכולם "strong_test". כלל 30% verdicts גבוהים, 40% בינוניים, 30% נמוכים.
2. **Edge cases**: לפחות 2 שצריכים להיות `reject` (compliance critical), 2 שצריכים להיות `watch` (data confidence low), 2 שצריכים להיות `high_ceiling`.
3. **Real offers only**: לא להמציא. אם אתה לא יכול לאמת facts → לא ב־golden set.
4. **One-time write, ongoing update**: אם prompt חדש "טעה" על gold-007 אבל אתה למסקנה ש**הוא צודק ואתה טעית** — עדכן את gold-007. תיעד את ה־change ב־git.

---

## Eval Run Workflow

### Manual eval (לפני publish של prompt חדש)

```bash
# שלב 1: edit ה־prompt
$ vim prompts/underwriting/v3.md

# שלב 2: סנכרן ל־DB (כשגרסה חדשה)
$ pnpm prompts:sync
✓ Synced prompts/underwriting/v3.md to DB (not yet active)

# שלב 3: הרץ eval
$ pnpm eval:run --orchestrator=underwriting --prompt-version=v3
Running 20 golden set evals...
  gold-001 Jasper.ai          ✓ verdict match (strong_test)
  gold-002 Lemonade           ✓ verdict match (small_paid_test)
  gold-003 LiverSupplement    ✗ verdict mismatch (got: small_paid_test, expected: reject)
  gold-004 Notion             ✓ verdict match (strong_test)
  ...
  gold-020 Calm.com           ✓ verdict match (small_paid_test)

Summary:
  Verdict accuracy: 18/20 (90%)
  Score range hits: 15/20 (75%)
  Risk flag matches: 19/20 (95%)
  Must-mention coverage: 17/20 (85%)
  Must-not-mention violations: 0/20 (100%)
  Total cost: $4.20
  Average cost per call: $0.21
  Average latency: 8.4s

Verdict: PASS (>= 75% on all critical metrics)

⚠️ Failures details: see eval_runs/2026-05-26-v3.json
```

### Auto-publish gate

ב־`/admin/prompts` page, לפני שאתה לוחץ "Activate v3":
- אם eval accuracy < 75% → כפתור disabled
- אם eval לא רץ ב־24h האחרונים → "Run eval first" button
- אם רץ ועבר → "Activate v3" + warning "previous version v2 will be deactivated"

### Cron eval (nightly drift detection)

`vercel.json`:
```json
{
  "crons": [{
    "path": "/api/cron/eval-active-prompts",
    "schedule": "0 3 * * *"
  }]
}
```

Endpoint:
```typescript
// app/api/cron/eval-active-prompts/route.ts
export async function GET() {
  if (!verifyCronSecret()) return new Response('Unauthorized', { status: 401 });

  for (const orchestrator of ['UnderwritingOrchestrator', 'TestKitOrchestrator', 'DiagnosisOrchestrator']) {
    for (const vertical of ['ai_saas', 'health', 'mental_wellness']) {
      const prompt = await getActivePrompt(orchestrator, vertical);
      if (!prompt) continue;
      const result = await runEval(orchestrator, vertical, prompt);

      if (result.accuracy < 70) {
        await sendAlert({
          severity: 'critical',
          subject: `Eval drift on ${orchestrator}/${vertical}: ${result.accuracy}%`,
          body: `Active prompt ${prompt.version} dropped below 70% accuracy.\n${result.summary}`,
        });
      }
    }
  }
  return Response.json({ ok: true });
}
```

### Pre-publish gate ב־UI

אם אדמין מנסה להעלות prompt חדש דרך API:
1. הקריאה ל־`/api/admin/prompts/activate` רצה eval לפני activate
2. אם נכשל → 400 + reason
3. אם עבר → activate + audit log

---

## Per-orchestrator eval

לא רק UnderwritingOrchestrator צריך eval. כל orchestrator:

### SourceExtractionOrchestrator
- Golden set: 10 URLs עם רשימה ידנית של 20-30 facts שאמורים להיחלץ מכל אחת
- Metrics: precision (כמה מהפלט נכון) + recall (כמה מהאמת נחלץ)
- Pass threshold: precision >= 0.8, recall >= 0.7

```typescript
{
  url: 'https://jasper.ai/affiliates',
  expected_facts: [
    { type: 'commission_type', value: 'recurring' },
    { type: 'commission_value', value: '30%' },
    { type: 'cookie_duration', value: '45 days' },
    { type: 'traffic_rule_paid_social', value: 'allowed' },
    // ...
  ],
}
```

### TestKitOrchestrator
- Golden set: 10 offers + manually-graded test kits (1-5 scale)
- Metrics: human grading (אתה נותן ציון 1-5 לכל test kit שהוא ייצר)
- Pass threshold: average >= 3.5/5

זה harder לאוטומציה. אתה צריך לעבור כל test kit ידנית. עושים את זה פעם בשבוע, לא בכל הרצה.

### DiagnosisOrchestrator
- Golden set: 10 campaigns עם results ידועים + diagnosis ידוע
- Metrics: bottleneck match + recommendation overlap
- Pass threshold: 70%

### ComplianceCheckOrchestrator
- Golden set: 15 offers (5 ב־vertical) — 5 should flag, 5 should pass, 5 borderline
- Metrics: precision/recall על flags
- Pass threshold: precision >= 0.85, recall >= 0.8 (תפסע בצד הזהיר)

---

## LLM-as-Judge Eval

ה־judge עצמו הוא LLM (Haiku). איך אתה יודע שהוא נכון?

**Approach:** Golden set ל־judge בנפרד.

```typescript
// seeds/golden_set/judge/jud-001.json
{
  id: 'jud-001',
  input_text: 'You will make $5000 in your first month if you follow this exact strategy',
  expected_findings: ['income_promise'],
  reasoning: 'Explicit income promise',
}

// jud-002
{
  id: 'jud-002',
  input_text: 'Top affiliates have reported earning $5000+/month',
  expected_findings: ['pass'],  // factual reporting is OK
  reasoning: 'Not a promise, factual reporting of others',
}

// jud-003
{
  id: 'jud-003',
  input_text: 'As an AI, I cannot recommend...',
  expected_findings: ['ai_disclosure'],
  reasoning: 'Self-disclosure as AI',
}
```

30 golden judges. Pass threshold: 90%+.

---

## Prompt Rollback Workflow

### When to rollback
- Eval dropped > 5% accuracy in one day
- LLM-as-judge findings spiked (`income_promise` > 0 in 24h)
- Cost-per-call spiked (e.g., model started returning longer outputs)
- User reported "verdict is way off" with specific example

### How to rollback (UI)
1. Admin → `/admin/prompts`
2. Click orchestrator → see version history
3. Click "Rollback to v2" on the row of the previous active version
4. Confirmation modal: "This will deactivate v3 and activate v2. New calls will use v2 within 60s. Continue?"
5. Click Confirm
6. DB transaction: `update prompts set is_active=false where ...; update prompts set is_active=true where id=<v2>;`
7. Audit log
8. Cache invalidation (`_shared/loadActivePrompt.ts` cache TTL = 60s, so within a minute)
9. Email alert to operators

### How to rollback (CLI emergency)
```bash
$ pnpm prompts:rollback --orchestrator=underwriting --vertical=ai_saas --to=v2
✓ Activated v2 (was v3)
✓ Audit log created
```

This bypasses the UI and is meant for 3am pages.

### How NOT to rollback
- `UPDATE prompts SET content='...' WHERE id=...` — ידני ב־SQL. אם אתה עושה את זה, אתה איבדת את העקבות ל־git.
- Edit את הקובץ markdown של הגרסה הפעילה. גם זה איבד עקבות.

תמיד: rollback = activation של גרסה ישנה. אם אתה צריך לתקן באמת — צור v4 על בסיס v2 + תיקון.

---

## Cost Tracking ב־Eval

כל eval run שומר:
- Total cost USD (סה"כ קריאות ל־Anthropic על golden set)
- Average cost per call
- Average latency
- Token counts

זה חשוב כי שינוי prompt יכול להוסיף 50% עלות בלי שתשים לב.

תצוגה ב־`/admin/eval`:
```
v1 → 20 calls, avg $0.18, total $3.60
v2 → 20 calls, avg $0.21, total $4.20  (+17%)
v3 → 20 calls, avg $0.34, total $6.80  (+62% — sus!)
```

אם cost עלה > 30%, התראה (גם אם accuracy עלה). תבדוק למה.

---

## Anti-patterns ב־eval

| Anti-pattern | למה זה רע | מה במקום |
|---|---|---|
| Golden set שאתה עצמך כתבת + ה־prompt עברו עליו | overfitting — ה־prompt לומד את ה־golden set | חצי מה־golden set "blind" — לא משתמשים בו ל־tuning, רק ל־final validation |
| Eval רק על verdict, לא על reasoning | verdict יכול להיות נכון מסיבה שגויה | בודקים גם `must_mention` ו־`must_not_mention` |
| ה־golden set לא מתעדכן | אחרי 6 חודשים הוא לא משקף את המוצר | רביעון: עוברים על golden set, רענון 5 entries |
| Eval רק ידני, לא בקרון | drift לא נתפס בזמן | קרון לילי + alert |
| Pass threshold גמיש (75%/80%/85% לפי המקרה) | אם הסף מבוסס על "מה שאנחנו רוצים שיעבור" — הוא חסר משמעות | קבע sף אחד, אם prompt לא עובר → לא activate |
| Rollback ידני דרך SQL | אבוד הקשר, אבודים audit logs | רק דרך UI/CLI script |

---

## Pre-launch eval checklist (M3 sign-off)

לפני שאתה משחרר את ה־real Underwriting למשתמש הראשון:

- [ ] 20 golden offers נכתבו (ידני, על ידך)
- [ ] Eval רץ על v1, accuracy >= 75%
- [ ] LLM-as-judge רץ על 30 golden judges, accuracy >= 90%
- [ ] Cost-per-call תחת $0.50 לפחות ב־15/20
- [ ] Latency median < 15s
- [ ] Cron eval מתוזמן ב־03:00 daily
- [ ] Alert wiring: accuracy drop > 5% = SMS + email
- [ ] Rollback UI נבדק ב־staging (rollback ובחזרה תוך 60s)
- [ ] Audit log רושם eval_run + rollback_action

ללא checklist הזה — אסור לסמן M3 ככ"complete".
