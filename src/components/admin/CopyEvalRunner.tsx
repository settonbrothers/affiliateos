'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase/client'
import { retryFailedCopyEvalJobs } from '@/lib/actions/copyEval'

export function CopyEvalRunner({
  runId,
  remaining,
  failed,
  creditPaused,
}: {
  runId: string
  remaining: number
  failed: number
  creditPaused: boolean
}) {
  const router = useRouter()
  const active = useRef(false)
  const [running, setRunning] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(
    () => () => {
      active.current = false
    },
    []
  )

  const pump = async () => {
    const supabase = createClient()
    active.current = true
    setRunning(true)
    setMessage('מעבד עד שני jobs במקביל. אפשר לסגור ולחזור.')
    while (active.current) {
      const results = await Promise.all([
        supabase.functions.invoke('run-copy-eval-job', {
          body: { eval_run_id: runId },
        }),
        supabase.functions.invoke('run-copy-eval-job', {
          body: { eval_run_id: runId },
        }),
      ])
      router.refresh()
      const pauseReason = results
        .map((result) => result.data?.reason)
        .find((reason) =>
          [
            'lean_not_armed',
            'lean_policy_invalid',
            'lean_budget_boundary',
          ].includes(reason)
        )
      if (pauseReason) {
        setMessage(
          pauseReason === 'lean_budget_boundary'
            ? 'העיבוד נעצר בגבול התקציב שנקבע. לא נפתחה קריאת AI נוספת.'
            : 'תכנית ההמשך אינה פעילה או אינה תקינה, ולכן לא נפתחה קריאת AI.'
        )
        break
      }
      if (results.every((result) => result.data?.claimed === false)) {
        const pending = Math.max(
          ...results.map((result) => Number(result.data?.pending ?? 0))
        )
        if (pending === 0) break
        await new Promise((resolve) => setTimeout(resolve, 10000))
      } else {
        await new Promise((resolve) => setTimeout(resolve, 5000))
      }
    }
    active.current = false
    setRunning(false)
    setMessage((current) =>
      current.includes('קריאת AI')
        ? current
        : 'העיבוד נעצר או שאין כרגע jobs פנויים. רענון יציג את המצב העדכני.'
    )
    router.refresh()
  }

  if (creditPaused)
    return (
      <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
        הריצה מושהית כדי לשמור על התקציב לאחר שיתרת Anthropic הסתיימה. אין כרגע
        קריאות AI פעילות, והמשימות שנכשלו לא יוחזרו לתור מהמסך הזה.
      </div>
    )

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button disabled={running || remaining === 0} onClick={pump}>
        המשך עיבוד ({remaining} נותרו)
      </Button>
      <Button
        variant="outline"
        disabled={!running}
        onClick={() => {
          active.current = false
        }}
      >
        עצור תור חדש
      </Button>
      {failed > 0 && (
        <Button
          variant="outline"
          onClick={() => {
            void retryFailedCopyEvalJobs(runId).then(() => router.refresh())
          }}
        >
          החזרת {failed} jobs שנכשלו לתור
        </Button>
      )}
      {message && (
        <span className="text-sm text-[var(--color-muted-foreground)]">
          {message}
        </span>
      )}
    </div>
  )
}
