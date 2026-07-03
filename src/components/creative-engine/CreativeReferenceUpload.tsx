'use client'

import { useRef, useState } from 'react'

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

export function CreativeReferenceUpload({
  onImageChange,
  disabled,
}: {
  onImageChange: (base64: string | null) => void
  disabled?: boolean
}) {
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function handleFile(file: File) {
    setError(null)
    if (!ACCEPTED.includes(file.type)) {
      setError('PNG/JPEG/WEBP only')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('Image must be under 5MB')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      // Strip data URL prefix — we only want the base64 part
      const base64 = result.split(',')[1] ?? null
      setPreview(result) // full data URL for preview
      onImageChange(base64)
    }
    reader.readAsDataURL(file)
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handleDrop(e: React.DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function handleRemove() {
    setPreview(null)
    setError(null)
    onImageChange(null)
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-medium text-[var(--color-muted-foreground)]">
        Reference product image (optional)
      </p>

      {preview ? (
        <div className="relative inline-block w-fit">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Reference preview"
            className="max-h-32 rounded-md object-contain border border-[var(--color-border)]"
          />
          <button
            type="button"
            onClick={handleRemove}
            disabled={disabled}
            aria-label="Remove image"
            className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-foreground)] text-[var(--color-background)] text-xs leading-none hover:opacity-80 disabled:opacity-50"
          >
            &times;
          </button>
        </div>
      ) : (
        <label
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed border-[var(--color-border)] p-4 text-sm text-[var(--color-muted-foreground)] transition-colors hover:border-[var(--color-foreground)] ${disabled ? 'pointer-events-none opacity-50' : ''}`}
        >
          <span className="font-medium">Click or drag to upload reference image</span>
          <span className="text-xs">PNG, JPEG, WEBP &mdash; max 5MB</span>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={disabled}
            onChange={handleInputChange}
            className="sr-only"
          />
        </label>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
