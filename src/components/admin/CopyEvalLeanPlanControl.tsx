'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'
import { prepareLeanCopyEvalResume } from '@/lib/actions/copyEval'

export function CopyEvalLeanPlanControl({
  runId,
  initiallyLocked,
}: {
  runId: string
  initiallyLocked: boolean
}) {
  const router = useRouter()
  const [locked, setLocked] = useState(initiallyLocked)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  if (locked)
    return (
      <p className="font-medium text-emerald-700">
        התוכנית ננעלה, אך אינה מופעלת. הפעלתה תדרוש פעולה נפרדת.
      </p>
    )

  return (
    <div className="space-y-2">
      <Button
        className="mt-2"
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          setError('')
          startTransition(async () => {
            try {
              await prepareLeanCopyEvalResume(runId)
              setLocked(true)
              router.refresh()
            } catch (cause) {
              setError(
                cause instanceof Error ? cause.message : 'שמירת התוכנית נכשלה'
              )
            }
          })
        }}
      >
        {pending ? 'נועל את התוכנית…' : 'נעל את התוכנית ללא הפעלת AI'}
      </Button>
      {error && <p className="text-sm text-red-700">שגיאה: {error}</p>}
    </div>
  )
}
