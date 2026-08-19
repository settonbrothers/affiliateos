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
    <span className="border border-white/15 bg-black/20 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#a8a8a3]">
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
    <section className="grid gap-5 border-t border-white/15 py-7 md:grid-cols-[180px_1fr]">
      <div>
        <div className="font-mono text-[11px] tracking-[0.22em] text-[#f4bd21]">
          {number}
        </div>
        <h2 className="mt-2 text-lg font-semibold text-white">{title}</h2>
        <p className="mt-2 text-xs leading-5 text-[#83837f]">{note}</p>
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
    <main
      className="mx-auto flex w-full max-w-6xl flex-col gap-0 pb-16"
      dir="rtl"
    >
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <AdminPageHeader
          title="JASPER / READINESS PACK"
          subtitle="תיק הקלט המלא לפני ריצת המוח · ללא שימוש ב-AI"
        />
        <Link
          href="/admin/eval/copy"
          className="border border-white/20 px-4 py-2 font-mono text-xs text-[#cfcfcb] no-underline transition-colors hover:border-[#f4bd21] hover:text-[#f4bd21]"
        >
          חזרה למעבדה ←
        </Link>
      </div>

      <div className="grid border border-white/15 bg-[#0d0d0c] md:grid-cols-[1.45fr_1fr]">
        <div className="relative overflow-hidden p-7 md:p-10">
          <div className="absolute -left-10 top-0 h-px w-64 rotate-[-18deg] bg-[#f4bd21]/60" />
          <div className="mb-5 flex flex-wrap gap-2">
            <Tag>copy-brain-release-v3</Tag>
            <Tag>fixture only</Tag>
            <Tag>cost $0.00</Tag>
          </div>
          <p className="max-w-3xl text-2xl font-semibold leading-[1.35] text-white md:text-4xl">
            לא מוכרים “עוד כלי AI”. בודקים אם Jasper יכול להוציא מנהל תוכן ממעגל
            השכתוב הידני.
          </p>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-[#aaa9a4]">
            התיק הזה נבנה כדי לתקן את טעות הריצה הקודמת: הקמפיין פונה למשתמש
            במוצר ומוביל לניסיון של 7 ימים. תוכנית השותפים והעמלה נשארות מידע
            פנימי בלבד.
          </p>
        </div>
        <div className="grid grid-cols-2 border-t border-white/15 md:border-r md:border-t-0">
          <div className="border-b border-l border-white/15 p-5">
            <div className="font-mono text-[10px] tracking-widest text-[#777772]">
              STATUS
            </div>
            <div className="mt-2 text-lg font-semibold text-emerald-300">
              READY
            </div>
          </div>
          <div className="border-b border-white/15 p-5">
            <div className="font-mono text-[10px] tracking-widest text-[#777772]">
              SOURCES
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {snapshot.sources.length}
            </div>
          </div>
          <div className="border-l border-white/15 p-5">
            <div className="font-mono text-[10px] tracking-widest text-[#777772]">
              AVATAR
            </div>
            <div className="mt-2 text-lg font-semibold text-white">
              {Math.round(brief.audience.avatar_completeness * 100)}%
            </div>
          </div>
          <div className="p-5">
            <div className="font-mono text-[10px] tracking-widest text-[#777772]">
              AI CALLS
            </div>
            <div className="mt-2 text-lg font-semibold text-white">0</div>
          </div>
        </div>
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
            <div key={label} className="bg-[#0b0b0a] p-5">
              <div className="font-mono text-[10px] tracking-widest text-[#f4bd21]">
                {label}
              </div>
              <h3 className="mt-3 font-semibold text-white">{title}</h3>
              <p className="mt-2 text-xs leading-6 text-[#979792]">{body}</p>
            </div>
          ))}
        </div>
        <div className={`mt-3 border p-4 text-sm ${tone.ready}`}>
          אין ערבוב קהלים: הקופי מוכר את Jasper למשתמש במוצר. תוכנית השותפים
          מסומנת internal-only ולא תיכנס כהוכחה או כמסר.
        </div>
      </Section>

      <Section
        number="02 / CAUSAL CHAIN"
        title="ליבת ההמרה"
        note="הבעיה, המנגנון והתוצאה חייבים להיות אותה שרשרת."
      >
        <div className="grid gap-3 md:grid-cols-2">
          {[
            ['האדם', conversionSpine.person],
            ['הצורך הפתוח', conversionSpine.unmet_need],
            ['מה קורה בלי פתרון', conversionSpine.consequence_without_offer],
            ['למה Jasper הוא פתרון סיבתי', conversionSpine.causal_solution],
          ].map(([label, value]) => (
            <div key={String(label)} className={`border p-4 ${tone.quiet}`}>
              <div className="text-[11px] font-semibold text-white">
                {String(label)}
              </div>
              <p className="mt-2 text-sm leading-6 text-[#a9a9a4]">
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
              className="grid gap-3 p-4 md:grid-cols-[44px_150px_1fr] md:items-start"
            >
              <span className="font-mono text-xs text-[#63635f]">
                {String(index + 1).padStart(2, '0')}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wide text-[#d2a91f]">
                {source.source_type.replaceAll('_', ' ')}
              </span>
              <div>
                <p className="text-sm leading-6 text-[#dededa]">
                  {source.claim}
                </p>
                <a
                  href={source.source_url ?? '#'}
                  className="mt-2 inline-block text-[11px] text-[#777772] underline decoration-white/20 underline-offset-4"
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.source_id}
                </a>
              </div>
            </div>
          ))}
        </div>
        <div className={`mt-3 border p-4 text-sm leading-6 ${tone.warning}`}>
          גבול האמת: מותר לדבר על first drafts מהירים יותר ועל עקביות טובה יותר
          לפי הביקורות. אסור להבטיח הכנסות, שיפור המרות, דיוק מוחלט או עבודה ללא
          עריכה ובדיקת עובדות.
        </div>
      </Section>

      <Section
        number="04 / AVATAR"
        title="מי אמור להרגיש שזה נכתב אליו"
        note="האווטאר מוקפא לפני הכתיבה ואינו מומצא מחדש בכל ריצה."
      >
        <blockquote className="border-r-2 border-[#f4bd21] pr-5 text-xl leading-8 text-white">
          {deepAvatar?.summary.central_problem_in_their_words}
        </blockquote>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
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
              <h3 className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#777772]">
                {String(label)}
              </h3>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-[#b8b8b3]">
                {(values as string[]).map((value) => (
                  <li key={value} className="border-r border-white/20 pr-3">
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
          <div className={`border p-5 ${tone.quiet}`}>
            <h3 className="font-semibold text-white">נתיב המודלים</h3>
            <dl className="mt-4 space-y-3 text-sm">
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
          <div className={`border p-5 ${tone.quiet}`}>
            <h3 className="font-semibold text-white">גרסת התורה</h3>
            <dl className="mt-4 space-y-3 text-sm">
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
        <details className="mt-3 border border-white/15 p-4">
          <summary className="cursor-pointer text-sm text-[#d6d6d1]">
            הצג את 23 מזהי הלקחים שייטענו
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
        <div className={`border p-5 ${tone.warning}`}>
          <ul className="space-y-3 text-sm leading-6">
            {snapshot.omitted_context.map((item) => (
              <li key={item.section}>
                <strong className="text-white">{item.section}:</strong>{' '}
                {item.reason}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 border border-dashed border-white/20 p-5 text-sm leading-6 text-[#94948f]">
          התיק מוכן לריצת איכות אחת, אך אינו טוען שיש לנו Spy או מודעה מנצחת.
          הוא גם לא נכנס ל־Taste Corpus. הפעלת AI נשארת נעולה עד החלטה נפרדת.
        </div>
      </Section>
    </main>
  )
}
