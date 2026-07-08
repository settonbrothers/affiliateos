'use client'

import { useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { triggerSaveCopyEdit } from '@/lib/actions/adCopy'

const lightBtn: React.CSSProperties = {
  fontFamily: 'var(--font-sans)',
  fontWeight: 600,
  fontSize: '13px',
  color: '#1F1B16',
  background: '#FFFFFF',
  border: '1px solid #DED8CB',
  padding: '8px 14px',
  cursor: 'pointer',
}

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
    <div className="flex flex-col gap-2" style={{ borderTop: '1px solid #DED8CB', paddingTop: '12px' }}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        dir={variantLang === 'he' ? 'rtl' : 'ltr'}
        rows={4}
        className="affex-light-field"
      />
      <input
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder={t('copyReasonPlaceholder')}
        className="affex-light-field"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => save('good')}
          disabled={saving !== false}
          style={{ ...lightBtn, opacity: saving !== false ? 0.5 : 1 }}
        >
          {t('copyMarkGood')}
        </button>
        <button
          type="button"
          onClick={() => save('bad')}
          disabled={saving !== false}
          style={{ ...lightBtn, opacity: saving !== false ? 0.5 : 1 }}
        >
          {t('copyMarkBad')}
        </button>
        {saved && <span style={{ fontSize: '13px', color: '#2E6B34' }}>{t('copySaved')}</span>}
        {error && <span style={{ fontSize: '13px', color: '#B23A24' }}>{error}</span>}
      </div>
    </div>
  )
}
