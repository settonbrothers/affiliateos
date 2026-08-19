type RecordValue = Record<string, unknown>

const record = (value: unknown): RecordValue | null =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : null

const normalized = (value: string) => value.replace(/\s+/g, ' ').trim()

export type RenderedCopyEvalOutput = {
  reviewable: boolean
  text: string
  reason: string | null
}

/**
 * Renders one eval output without showing the hook twice when the writer has
 * already included it at the start of primary_text. A blocked/no-copy result
 * is diagnostic state, not a blind-review candidate.
 */
export function renderCopyEvalOutput(output: unknown): RenderedCopyEvalOutput {
  const payload = record(record(output)?.payload)
  const variants = Array.isArray(payload?.variants) ? payload.variants : []
  const variantRecords = variants.map(record).filter(Boolean) as RecordValue[]
  const hebrew =
    variantRecords.find((item) => item.lang === 'he') ?? variantRecords[0]

  if (!hebrew) {
    const message =
      typeof payload?.user_message === 'string'
        ? payload.user_message
        : 'המנוע עצר לפני יצירת קופי.'
    return {
      reviewable: false,
      text: message,
      reason:
        typeof payload?.output_status === 'string'
          ? payload.output_status
          : 'no_copy_variant',
    }
  }

  const hook = typeof hebrew.hook === 'string' ? hebrew.hook.trim() : ''
  const body =
    typeof hebrew.primary_text === 'string' ? hebrew.primary_text.trim() : ''
  const headline =
    typeof hebrew.headline === 'string' ? hebrew.headline.trim() : ''
  const bodyAlreadyContainsHook =
    Boolean(hook && body) &&
    (normalized(body) === normalized(hook) ||
      normalized(body).startsWith(`${normalized(hook)} `))
  const text = [bodyAlreadyContainsHook ? '' : hook, body, headline]
    .filter(Boolean)
    .join('\n\n')

  return text
    ? { reviewable: true, text, reason: null }
    : {
        reviewable: false,
        text: 'המנוע לא החזיר טקסט להצגה.',
        reason: 'empty_copy_variant',
      }
}
