import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import Link from 'next/link'

import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { compileCopyExecutionBriefV2 } from '@/lib/copy/copyExecutionBrief'
import { CopyBrainInputSnapshotV1Schema } from '@/types/agents/copyBrain'

const snapshot = CopyBrainInputSnapshotV1Schema.parse(
  JSON.parse(
    readFileSync(
      resolve(process.cwd(), 'brain-evals/jasper-corrected-v3.snapshot.json'),
      'utf8'
    )
  )
)
const brief = compileCopyExecutionBriefV2(snapshot)

const tone = {
  ready: 'border-emerald-400/35 bg-emerald-400/10 text-emerald-200',
  warning: 'border-amber-300/30 bg-amber-300/[0.08] text-amber-100',
  quiet: 'border-white/15 bg-white/[0.025] text-[#d2d2cf]',
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="border border-white/20 bg-black/25 px-3 py-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-[#c3c3bd]">
      {children}
    </span>
  )
}

function Section({
  number,
  title,
  note,
  children,
}: {
  number: string
  title: string
  note: string
  children: React.ReactNode
}) {
  return (
    <section className="grid gap-7 border-t border-white/15 py-10 lg:grid-cols-[240px_1fr] lg:gap-10 xl:py-12">
      <div>
        <div className="font-mono text-xs font-semibold tracking-[0.2em] text-[#f4bd21]">
          {number}
        </div>
        <h2 className="mt-3 text-2xl font-semibold leading-tight text-white">
          {title}
        </h2>
        <p className="mt-3 max-w-[220px] text-sm leading-6 text-[#a2a29c]">
          {note}
        </p>
      </div>
      <div>{children}</div>
    </section>
  )
}

export default function CopyBrainReadinessPage() {
  const avatar = snapshot.avatar
  const deepAvatar =
    avatar &&
    'schema_version' in avatar &&
    avatar.schema_version === 'deep-avatar-v2'
      ? avatar
      : null
  const deepBrief = snapshot.deep_brief ?? {}
  const conversionSpine =
    typeof deepBrief.conversion_spine === 'object' &&
    deepBrief.conversion_spine !== null
      ? (deepBrief.conversion_spine as Record<string, unknown>)
      : {}

  return (
    <>
      <style>{`
        main:has(> main[data-readiness-page]) {
          max-width: 1728px !important;
        }
      `}</style>
      <main
        className="mx-auto flex w-full max-w-[1600px] flex-col gap-0 px-4 pb-20 sm:px-6 xl:px-8"
        data-readiness-page
        dir="rtl"
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-5 pt-2">
          <AdminPageHeader
            title="JASPER / READINESS PACK"
            subtitle="תיק הקלט המלא לפני ריצת המוח · ללא שימוש ב-AI"
          />
          <Link
            href="/admin/eval/copy"
            className="border border-white/25 px-5 py-3 font-mono text-sm text-[#e0e0db] no-underline transition-colors hover:border-[#f4bd21] hover:text-[#f4bd21]"
          >
            חזרה למעבדה ←
          </Link>
        </div>

        <div className="grid border border-white/20 bg-[#0d0d0c] shadow-[0_24px_80px_rgba(0,0,0,0.22)] lg:grid-cols-[1.55fr_1fr]">
          <div className="relative overflow-hidden p-7 sm:p-9 lg:p-12 xl:p-14">
            <div className="absolute -left-10 top-0 h-px w-64 rotate-[-18deg] bg-[#f4bd21]/60" />
            <div className="mb-7 flex flex-wrap gap-2.5">
              <Tag>copy-brain-release-v3.5</Tag>
              <Tag>fixture only</Tag>
              <Tag>cost $0.00</Tag>
            </div>
            <p className="max-w-4xl text-3xl font-semibold leading-[1.35] text-white sm:text-4xl xl:text-[44px]">
              לא מוכרים “עוד כלי AI”. בודקים אם Jasper יכול להוציא מנהל תוכן
              ממעגל השכתוב הידני.
            </p>
            <p className="mt-6 max-w-3xl text-base leading-8 text-[#c2c1bb] xl:text-lg">
              התיק הזה נבנה כדי לתקן את טעות הריצה הקודמת: הקמפיין פונה למשתמש
              במוצר ומוביל לניסיון של 7 ימים. תוכנית השותפים והעמלה נשארות מידע
              פנימי בלבד.
            </p>
          </div>
          <div className="grid grid-cols-2 border-t border-white/15 lg:border-r lg:border-t-0">
            <div className="flex min-h-36 flex-col justify-center border-b border-l border-white/15 p-7">
              <div className="font-mono text-xs font-semibold tracking-widest text-[#92928c]">
                STATUS
              </div>
              <div className="mt-3 text-3xl font-semibold text-emerald-300">
                INPUT READY
              </div>
            </div>
            <div className="flex min-h-36 flex-col justify-center border-b border-white/15 p-7">
              <div className="font-mono text-xs font-semibold tracking-widest text-[#92928c]">
                SOURCES
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {snapshot.sources.length}
              </div>
            </div>
            <div className="flex min-h-36 flex-col justify-center border-l border-white/15 p-7">
              <div className="font-mono text-xs font-semibold tracking-widest text-[#92928c]">
                AVATAR
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">
                {Math.round(brief.audience.avatar_completeness * 100)}%
              </div>
            </div>
            <div className="flex min-h-36 flex-col justify-center p-7">
              <div className="font-mono text-xs font-semibold tracking-widest text-[#92928c]">
                AI CALLS
              </div>
              <div className="mt-3 text-3xl font-semibold text-white">0</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid gap-4 border border-amber-300/35 bg-amber-300/[0.07] p-5 text-amber-50 md:grid-cols-[190px_1fr] md:items-start xl:p-6">
          <div>
            <div className="font-mono text-xs font-semibold uppercase tracking-[0.18em] text-amber-300">
              OUTPUT STATUS
            </div>
            <div className="mt-2 text-xl font-semibold">חסום לבדיקה חוזרת</div>
          </div>
          <p className="text-base leading-8 text-amber-50/85">
            תיק הקלט מוכן, אבל עדיין אין קופי שמוכן לשיפוט בעלים. מועמד v3.3
            עבר את סוכני הבקרה ונפסל בבדיקה הטכנית האחרונה בגלל משך זמן שלא
            הופיע במקורות. v3.5 מתקנת את השער הזה וגם מסנכרנת למסלול ההרצה את
            כל 26 הלקחים הפעילים. היא ממתינה לריצה חדשה ואינה פעילה במערכת.
          </p>
        </div>

        <Section
          number="01 / TARGET"
          title="מה מוכרים ולמי"
          note="השער הזה חייב להיות חד לפני כתיבת מילה אחת."
        >
          <div className="grid gap-px bg-white/10 md:grid-cols-3">
            {[
              [
                'המוצר',
                brief.consumer_offer.name,
                brief.consumer_offer.description,
              ],
              ['הקהל', 'מנהלי תוכן Hands-on', brief.audience.summary],
              [
                'הפעולה',
                'ניסיון Pro ל־7 ימים',
                brief.campaign_objective.desired_action,
              ],
            ].map(([label, title, body]) => (
              <div key={label} className="min-h-52 bg-[#0b0b0a] p-6 xl:p-7">
                <div className="font-mono text-xs font-semibold tracking-widest text-[#f4bd21]">
                  {label}
                </div>
                <h3 className="mt-4 text-xl font-semibold text-white">
                  {title}
                </h3>
                <p
                  className="mt-3 text-left text-sm leading-7 text-[#b1b1ab] xl:text-base"
                  dir="ltr"
                >
                  {body}
                </p>
              </div>
            ))}
          </div>
          <div className={`mt-4 border p-5 text-base leading-7 ${tone.ready}`}>
            אין ערבוב קהלים: הקופי מוכר את Jasper למשתמש במוצר. תוכנית השותפים
            מסומנת internal-only ולא תיכנס כהוכחה או כמסר.
          </div>
        </Section>

        <Section
          number="02 / CAUSAL CHAIN"
          title="ליבת ההמרה"
          note="הבעיה, המנגנון והתוצאה חייבים להיות אותה שרשרת."
        >
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ['האדם', conversionSpine.person],
              ['הצורך הפתוח', conversionSpine.unmet_need],
              ['מה קורה בלי פתרון', conversionSpine.consequence_without_offer],
              ['למה Jasper הוא פתרון סיבתי', conversionSpine.causal_solution],
            ].map(([label, value]) => (
              <div
                key={String(label)}
                className={`min-h-36 border p-6 ${tone.quiet}`}
              >
                <div className="text-sm font-semibold text-white">
                  {String(label)}
                </div>
                <p
                  className="mt-3 text-left text-base leading-7 text-[#c0c0ba]"
                  dir="ltr"
                >
                  {String(value ?? '—')}
                </p>
              </div>
            ))}
          </div>
        </Section>

        <Section
          number="03 / EVIDENCE"
          title="מה מותר להבטיח"
          note="מקור רשמי מסביר מנגנון; ביקורות עצמאיות תוחמות את התוצאה."
        >
          <div className="divide-y divide-white/10 border border-white/15">
            {snapshot.sources.map((source, index) => (
              <div
                key={source.source_id}
                className="grid gap-4 p-5 md:grid-cols-[52px_180px_1fr] md:items-start xl:p-6"
              >
                <span className="font-mono text-sm text-[#81817b]">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="font-mono text-xs uppercase tracking-wide text-[#e0b82b]">
                  {source.source_type.replaceAll('_', ' ')}
                </span>
                <div className="text-left" dir="ltr">
                  <p className="text-base leading-7 text-[#e5e5e0]">
                    {source.claim}
                  </p>
                  <a
                    href={source.source_url ?? '#'}
                    className="mt-3 inline-block text-xs text-[#9b9b95] underline decoration-white/25 underline-offset-4 hover:text-[#f4bd21]"
                    target="_blank"
                    rel="noreferrer"
                  >
                    {source.source_id}
                  </a>
                </div>
              </div>
            ))}
          </div>
          <div
            className={`mt-4 border p-5 text-base leading-7 ${tone.warning}`}
          >
            גבול האמת: מותר לדבר על first drafts מהירים יותר ועל עקביות טובה
            יותר לפי הביקורות. אסור להבטיח הכנסות, שיפור המרות, דיוק מוחלט או
            עבודה ללא עריכה ובדיקת עובדות.
          </div>
        </Section>

        <Section
          number="04 / AVATAR"
          title="מי אמור להרגיש שזה נכתב אליו"
          note="האווטאר מוקפא לפני הכתיבה ואינו מומצא מחדש בכל ריצה."
        >
          <blockquote
            className="max-w-5xl border-l-2 border-[#f4bd21] py-1 pl-6 text-left text-2xl font-medium leading-10 text-white xl:text-3xl xl:leading-[1.5]"
            dir="ltr"
          >
            {deepAvatar?.summary.central_problem_in_their_words}
          </blockquote>
          <div className="mt-8 grid gap-7 md:grid-cols-3">
            {[
              ['כאבים', deepAvatar?.summary.pains ?? []],
              ['מניעים', deepAvatar?.summary.psychological_drivers ?? []],
              [
                'VoC מאומת',
                deepAvatar?.action_fields.voc_lines.map((item) => item.line) ??
                  [],
              ],
            ].map(([label, values]) => (
              <div key={String(label)}>
                <h3 className="font-mono text-xs font-semibold uppercase tracking-[0.16em] text-[#9c9c96]">
                  {String(label)}
                </h3>
                <ul
                  className="mt-4 space-y-3 text-left text-base leading-7 text-[#cecec8]"
                  dir="ltr"
                >
                  {(values as string[]).map((value) => (
                    <li key={value} className="border-l border-white/20 pl-3">
                      {value}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Section>

        <Section
          number="05 / BRAIN TRACE"
          title="מה יגיע לכל סוכן"
          note="המסך מציג את החיבור בפועל, לא רק את מה שקיים בתיקייה."
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className={`border p-6 ${tone.quiet}`}>
              <h3 className="text-lg font-semibold text-white">נתיב המודלים</h3>
              <dl className="mt-5 space-y-4 text-base">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#858580]">מחקר והכנת תדריך</dt>
                  <dd className="font-mono text-[#d6d6d1]">Sonnet 4.6</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#858580]">הוקים וכתיבה סופית</dt>
                  <dd className="font-mono text-[#d6d6d1]">Opus 4.6</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#858580]">שיפוט עצמאי</dt>
                  <dd className="font-mono text-[#d6d6d1]">Opus 4.6</dd>
                </div>
              </dl>
            </div>
            <div className={`border p-6 ${tone.quiet}`}>
              <h3 className="text-lg font-semibold text-white">גרסת התורה</h3>
              <dl className="mt-5 space-y-4 text-base">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#858580]">חבילת ידע</dt>
                  <dd className="font-mono text-[#d6d6d1]">latest-owner-v3</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#858580]">לקחים פעילים</dt>
                  <dd className="font-mono text-[#d6d6d1]">
                    {brief.doctrine_bundle.active_lesson_ids.length}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-[#858580]">קו איכות</dt>
                  <dd className="font-mono text-[#d6d6d1]">Michael v5</dd>
                </div>
              </dl>
            </div>
          </div>
          <details className="mt-4 border border-white/15 p-5">
            <summary className="cursor-pointer text-base font-medium text-[#e2e2dc]">
              הצג את {brief.doctrine_bundle.active_lesson_ids.length} מזהי הלקחים שייטענו
            </summary>
            <div className="mt-4 flex flex-wrap gap-2">
              {brief.doctrine_bundle.active_lesson_ids.map((lesson) => (
                <Tag key={lesson}>{lesson}</Tag>
              ))}
            </div>
          </details>
        </Section>

        <Section
          number="06 / GAPS"
          title="מה עדיין חסר"
          note="חוסר גלוי נשאר חוסר; המוח לא ממלא אותו בדמיון."
        >
          <div className={`border p-6 ${tone.warning}`}>
            <ul className="space-y-4 text-base leading-7">
              {snapshot.omitted_context.map((item) => (
                <li key={item.section} className="text-left" dir="ltr">
                  <strong className="text-white">{item.section}:</strong>{' '}
                  {item.reason}
                </li>
              ))}
            </ul>
          </div>
          <div className="mt-4 border border-dashed border-white/25 p-6 text-base leading-7 text-[#afafa9]">
            התיק מוכן לריצת איכות אחת, אך אינו טוען שיש לנו Spy או מודעה מנצחת.
            הוא גם לא נכנס ל־Taste Corpus. הפעלת AI נשארת נעולה עד החלטה נפרדת.
          </div>
        </Section>
      </main>
    </>
  )
}
