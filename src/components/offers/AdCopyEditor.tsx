'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { triggerSaveCopyEdit } from '@/lib/actions/adCopy'

// One variant's Edit-Loop control: edit the text, add a reason, rate good/bad.
// Saving feeds both ad_copy_edits and the Taste Corpus (the flywheel).
export function AdCopyEditor({
  generationId,
  variantLang,
  variantIndex,
  originalText,
}: {
  generationId: string
  variantLang: 'he' | 'en'
  variantIndex: number
  originalText: string
}) {
  const t = useTranslations('offers')
  const router = useRouter()
  const [text, setText] = useState(originalText)
  const [reason, setReason] = useState('')
  const [saving, setSaving] = useState<false | 'good' | 'bad'>(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save(rating: 'good' | 'bad') {
    setError(null)
    setSaving(rating)
    const result = await triggerSaveCopyEdit({
      generationId,
      variantLang,
      variantIndex,
      originalText,
      editedText: text,
      rating,
      reason: reason.trim() || null,
    })
    setSaving(false)
    if ('error' in result) {
      setError(result.error)
      return
    }
    setSaved(true)
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--color-border)] pt-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        dir={variantLang === 'he' ? 'rtl' : 'ltr'}
        rows={4}
        className="w-full rounded-md border border-[var(--color-border)] bg-transparent p-2 text-sm"
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('copyReasonPlaceholder')}
        className="w-full rounded-md border border-[var(--color-border)] bg-transparent p-2 text-sm"
      />
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          onClick={() => save('good')}
          disabled={saving !== false}
        >
          👍 {t('copyMarkGood')}
        </Button>
        <Button
          variant="outline"
          onClick={() => save('bad')}
          disabled={saving !== false}
        >
          👎 {t('copyMarkBad')}
        </Button>
        {saved && (
          <span className="text-sm text-green-600">{t('copySaved')}</span>
        )}
        {error && <span className="text-sm text-red-600">{error}</span>}
      </div>
    </div>
  )
}
