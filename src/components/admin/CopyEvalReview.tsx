'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { submitCopyOwnerScore } from '@/lib/actions/copyEval'

const dimensions = [
  ['scroll_stop', 'עצירת גלילה'],
  ['curiosity', 'סקרנות'],
  ['emotional_peak', 'שיא רגשי'],
  ['tangible_need', 'צורך מוחשי'],
  ['causal_solution', 'פתרון סיבתי'],
  ['credibility', 'אמינות'],
  ['power', 'עוצמה'],
  ['publishability', 'יכולת פרסום'],
] as const

export type BlindPair = {
  caseId: string
  caseName: string
  split: string
  repetition: number
  leftId: string
  rightId: string
  leftText: string
  rightText: string
  snapshot: unknown
  alreadyScored: boolean
}

export function CopyEvalReview({
  runId,
  pairs,
}: {
  runId: string
  pairs: BlindPair[]
}) {
  const router = useRouter()
  const [pending, transition] = useTransition()
  const first = Math.max(
    0,
    pairs.findIndex((pair) => !pair.alreadyScored)
  )
  const [index, setIndex] = useState(first)
  const [values, setValues] = useState<Record<string, number>>({})
  const [preference, setPreference] = useState<'left' | 'right' | 'tie'>('tie')
  const [flags, setFlags] = useState<Record<string, boolean>>({})
  const [feedback, setFeedback] = useState('')
  const pair = pairs[index]
  const complete = useMemo(
    () =>
      dimensions.every(
        ([key]) => values[`left_${key}`] && values[`right_${key}`]
      ),
    [values]
  )
  if (!pair)
    return (
      <p className="text-sm text-[var(--color-muted-foreground)]">
        אין עדיין זוג מוכן להצגה.
      </p>
    )

  const submit = () =>
    transition(async () => {
      await submitCopyOwnerScore({
        evalRunId: runId,
        caseId: pair.caseId,
        leftId: pair.leftId,
        rightId: pair.rightId,
        scores: values,
        preference,
        publishabilityLeft: Boolean(flags.publishabilityLeft),
        publishabilityRight: Boolean(flags.publishabilityRight),
        truthRejectLeft: Boolean(flags.truthRejectLeft),
        truthRejectRight: Boolean(flags.truthRejectRight),
        causalityRejectLeft: Boolean(flags.causalityRejectLeft),
        causalityRejectRight: Boolean(flags.causalityRejectRight),
        presentedRepetition: pair.repetition,
        feedback,
      })
      setValues({})
      setFlags({})
      setFeedback('')
      setPreference('tie')
      setIndex((current) => Math.min(current + 1, pairs.length - 1))
      router.refresh()
    })

  return (
    <section className="space-y-5" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{pair.caseName}</h2>
          <p className="text-xs text-[var(--color-muted-foreground)]">
            {pair.split} · זוג {index + 1}/{pairs.length} · חזרה שנקבעה מראש{' '}
            {pair.repetition + 1}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setIndex(Math.max(0, index - 1))}
          >
            הקודם
          </Button>
          <Button
            variant="outline"
            onClick={() => setIndex(Math.min(pairs.length - 1, index + 1))}
          >
            הבא
          </Button>
        </div>
      </div>
      <details className="rounded border p-3 text-sm">
        <summary className="cursor-pointer">
          הצגת קלט המוח החתום (מחקר, claims, Spy, winner, avatar, Test Kit
          וחוסרים)
        </summary>
        <pre
          className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap text-xs"
          dir="ltr"
        >
          {JSON.stringify(pair.snapshot, null, 2)}
        </pre>
      </details>
      <div className="grid gap-4 lg:grid-cols-2">
        {(
          [
            { side: 'left', label: 'A', copy: pair.leftText },
            { side: 'right', label: 'B', copy: pair.rightText },
          ] as const
        ).map(({ side, label, copy }) => (
          <article
            key={side}
            className="rounded border border-[var(--color-border)] p-4"
          >
            <h3 className="mb-3 text-lg font-semibold">{label}</h3>
            <div className="min-h-72 whitespace-pre-wrap leading-7">{copy}</div>
            <div className="mt-5 space-y-2 border-t pt-4">
              {dimensions.map(([key, title]) => (
                <label
                  key={key}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span>{title}</span>
                  <select
                    value={values[`${side}_${key}`] ?? ''}
                    onChange={(event) =>
                      setValues((old) => ({
                        ...old,
                        [`${side}_${key}`]: Number(event.target.value),
                      }))
                    }
                    className="rounded border bg-transparent p-1"
                  >
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <div className="mt-4 space-y-2 text-sm">
              {(
                [
                  [
                    `publishability${side === 'left' ? 'Left' : 'Right'}`,
                    'מוכן לפרסום',
                  ],
                  [
                    `truthReject${side === 'left' ? 'Left' : 'Right'}`,
                    'פסילה בגלל אמת',
                  ],
                  [
                    `causalityReject${side === 'left' ? 'Left' : 'Right'}`,
                    'פסילה בגלל סיבתיות',
                  ],
                ] as const
              ).map(([key, title]) => (
                <label key={key} className="flex gap-2">
                  <input
                    type="checkbox"
                    checked={Boolean(flags[key])}
                    onChange={(event) =>
                      setFlags((old) => ({
                        ...old,
                        [key]: event.target.checked,
                      }))
                    }
                  />
                  {title}
                </label>
              ))}
            </div>
          </article>
        ))}
      </div>
      <div className="flex gap-5 text-sm">
        {(['left', 'right', 'tie'] as const).map((value) => (
          <label key={value} className="flex gap-2">
            <input
              type="radio"
              checked={preference === value}
              onChange={() => setPreference(value)}
            />
            {value === 'left'
              ? 'A עדיף'
              : value === 'right'
                ? 'B עדיף'
                : 'תיקו'}
          </label>
        ))}
      </div>
      <Textarea
        value={feedback}
        onChange={(event) => setFeedback(event.target.value)}
        placeholder="משוב חופשי — נשמר מילה במילה"
      />
      <Button disabled={pending || !complete} onClick={submit}>
        {pair.alreadyScored ? 'עדכון הכרעה' : 'שמירת הכרעה והמשך'}
      </Button>
    </section>
  )
}
