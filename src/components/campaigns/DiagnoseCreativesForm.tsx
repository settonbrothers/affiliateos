'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { Button } from '@/components/ui/button'
import { triggerDiagnoseCreatives } from '@/lib/actions/diagnoseV2'
import { createClient } from '@/lib/supabase/client'
import type { AiRunStatus } from '@/types/db'

const TERMINAL: AiRunStatus[] = ['success', 'failed', 'partial']
const MAX_IMAGES = 3
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

type Tab = 'text' | 'images'

export function DiagnoseCreativesForm({ campaignId }: { campaignId: string }) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('text')
  const [creativeInput, setCreativeInput] = useState('')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [status, setStatus] = useState<AiRunStatus | 'idle'>('idle')
  const [runId, setRunId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const isRunning = status === 'pending' || status === 'running'
  const statusRef = useRef(status)
  useEffect(() => { statusRef.current = status }, [status])

  // Generate object URLs for previews; revoke on change
  useEffect(() => {
    const urls = images.map((f) => URL.createObjectURL(f))
    setImagePreviews(urls)
    return () => { urls.forEach((u) => URL.revokeObjectURL(u)) }
  }, [images])

  useEffect(() => {
    if (!runId || !isRunning) return
    const supabase = createClient()
    const channel = supabase
      .channel(`diagnosis_v2_run:${runId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'ai_runs',
          filter: `id=eq.${runId}`,
        },
        (payload) => {
          const next = (payload.new as { status: AiRunStatus }).status
          if (TERMINAL.includes(next)) {
            setStatus(next)
            router.refresh()
          }
        }
      )
      .subscribe((subscribeStatus) => {
        if (subscribeStatus === 'CHANNEL_ERROR' || subscribeStatus === 'TIMED_OUT') {
          setStatus('failed')
          setError('Connection lost. Please refresh and try again.')
        }
      })

    const timeout = setTimeout(() => {
      if (statusRef.current === 'running' || statusRef.current === 'pending') {
        setStatus('failed')
        setError('Timed out. The generation may still be running — refresh to check.')
        void supabase.removeChannel(channel)
      }
    }, 90_000)

    return () => {
      clearTimeout(timeout)
      void supabase.removeChannel(channel)
    }
  }, [runId, isRunning, router])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    const valid = files.filter((f) => ACCEPTED_TYPES.includes(f.type))
    setImages((prev) => [...prev, ...valid].slice(0, MAX_IMAGES))
    // Reset so same file can be re-selected
    e.target.value = ''
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  function readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        // Strip the data URL prefix (e.g. "data:image/png;base64,")
        const base64 = result.split(',')[1] ?? ''
        resolve(base64)
      }
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })
  }

  const canSubmitText = activeTab === 'text' && creativeInput.trim().length > 0
  const canSubmitImages = activeTab === 'images' && images.length > 0
  const canSubmit = !isRunning && (canSubmitText || canSubmitImages)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError(null)
    setStatus('running')
    try {
      let result: Awaited<ReturnType<typeof triggerDiagnoseCreatives>>
      if (activeTab === 'images') {
        const base64Images = await Promise.all(images.map(readFileAsBase64))
        result = await triggerDiagnoseCreatives(campaignId, '', base64Images)
      } else {
        result = await triggerDiagnoseCreatives(campaignId, creativeInput)
      }
      if ('error' in result) {
        setError(result.error)
        setStatus('idle')
        return
      }
      setRunId(result.run_id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unexpected error')
      setStatus('idle')
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      {/* Tabs */}
      <div className="flex gap-1 border border-[#D8D2C6] p-1 w-fit">
        <button
          type="button"
          onClick={() => setActiveTab('text')}
          disabled={isRunning}
          className={`px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            activeTab === 'text'
              ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
              : 'text-[#6B6459] hover:text-[#1F1B16]'
          }`}
        >
          טקסט
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('images')}
          disabled={isRunning}
          className={`px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${
            activeTab === 'images'
              ? 'bg-[var(--color-primary)] text-[var(--color-primary-foreground)]'
              : 'text-[#6B6459] hover:text-[#1F1B16]'
          }`}
        >
          תמונות
        </button>
      </div>

      {/* Text tab */}
      {activeTab === 'text' && (
        <textarea
          value={creativeInput}
          onChange={(e) => setCreativeInput(e.target.value)}
          placeholder="הדבק את טקסט המודעות שרצו"
          rows={8}
          disabled={isRunning}
          className="w-full border border-[#D8D2C6] bg-white text-[#1F1B16] px-3 py-2 text-sm placeholder:text-[#9A8F73] focus:outline-none focus:ring-2 focus:ring-[var(--color-ring)] disabled:opacity-50"
        />
      )}

      {/* Images tab */}
      {activeTab === 'images' && (
        <div className="flex flex-col gap-3">
          {images.length < MAX_IMAGES && (
            <label
              className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed border-[#D8D2C6] p-6 text-center cursor-pointer transition-colors hover:border-[var(--color-ring)] ${isRunning ? 'pointer-events-none opacity-50' : ''}`}
            >
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                multiple
                disabled={isRunning}
                onChange={handleFileChange}
                className="sr-only"
              />
              <span className="text-sm text-[#6B6459]">
                {`גרור תמונות לכאן או לחץ לבחירה · PNG, JPG, WEBP · עד ${MAX_IMAGES} תמונות`}
              </span>
            </label>
          )}

          {imagePreviews.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {imagePreviews.map((src, i) => (
                <div key={src + '-' + i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={src}
                    alt={`Creative ${i + 1}`}
                    className="h-32 w-32 border border-[#D8D2C6] object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    disabled={isRunning}
                    aria-label="הסר תמונה"
                    className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs disabled:opacity-50 hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {images.length >= MAX_IMAGES && (
            <p className="text-xs text-[#6B6459]">
              {`הגעת למקסימום (${MAX_IMAGES} תמונות). הסר תמונה כדי להוסיף אחרת.`}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={!canSubmit}>
          {isRunning ? 'מנתח קריאייטיבים...' : 'נתח קריאייטיבים'}
        </Button>
        {isRunning && (
          <span className="text-sm text-[#6B6459]">
            מעבד...
          </span>
        )}
        {status === 'success' && (
          <span className="text-sm text-green-600">הניתוח הסתיים</span>
        )}
        {status === 'failed' && (
          <span className="text-sm text-red-600">הניתוח נכשל</span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  )
}
