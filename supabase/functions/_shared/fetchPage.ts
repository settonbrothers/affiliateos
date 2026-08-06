// Fetch a page and reduce it to plain text for an LLM.
//
// Extracted from discover-offers/index.ts, which had the only copy — so
// underwriting, the analysis that most needs to read a landing page, had no way
// to do it without duplicating the logic a third time.
import { truncate } from './truncate.ts'

export const FETCH_TIMEOUT_MS = 15_000
const MAX_HTML_BYTES = 500_000
const MAX_RAW_TEXT_LEN = 120_000

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = FETCH_TIMEOUT_MS,
  userAgent = 'AffiliateOS/1.0'
): Promise<string> {
  if (!url) throw new Error('no url')
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': userAgent },
    })
    if (!res.ok) throw new Error(`fetch ${url} failed: HTTP ${res.status}`)
    return await res.text()
  } finally {
    clearTimeout(t)
  }
}

export function stripHtml(s: string): string {
  return s
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Fetch + strip in one step, returning '' rather than throwing.
 *
 * Callers treat a missing page as missing evidence, not as a failure: the model
 * still has the extracted facts to work from, and a filter it cannot resolve is
 * supposed to stay unresolved.
 */
export async function fetchPageText(
  url: string | null | undefined,
  userAgent = 'AffiliateOS/1.0'
): Promise<string> {
  if (!url) return ''
  try {
    const html = await fetchWithTimeout(url, FETCH_TIMEOUT_MS, userAgent)
    return truncate(stripHtml(html.slice(0, MAX_HTML_BYTES)), MAX_RAW_TEXT_LEN)
  } catch {
    return ''
  }
}
