import { runWebSearch } from '../adapters/webSearch.ts'

export type CopyResearchSnapshot = {
  source_id: string
  publisher_id: string
  source_url: string
  snapshot_text: string
  snapshot_sha256: string
  source_type_hint: 'customer_review' | 'study' | 'manual_url'
}

const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')

export async function sha256Text(value: string): Promise<string> {
  return hex(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
  )
}

function publisherId(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return 'unknown-publisher'
  }
}

export async function gatherCopyResearch(input: {
  offerName: string
  vertical?: string | null
  additionalSourceUrls?: string[]
}): Promise<CopyResearchSnapshot[]> {
  // Never let deterministic mock search results become evidence. When search is
  // unavailable, verified facts still reach excavation and the model chooses a
  // non-story fallback or asks for evidence.
  if (!Deno.env.get('DISCOVERY_SEARCH_API_KEY')) return []

  const vertical = input.vertical ? ` ${input.vertical}` : ''
  const queries: Array<{
    query: string
    hint: CopyResearchSnapshot['source_type_hint']
  }> = [
    {
      query: `"${input.offerName}" customer reviews experience${vertical}`,
      hint: 'customer_review',
    },
    {
      query: `"${input.offerName}" study research results${vertical}`,
      hint: 'study',
    },
  ]
  for (const rawUrl of input.additionalSourceUrls ?? []) {
    try {
      const url = new URL(rawUrl)
      if (!['http:', 'https:'].includes(url.protocol)) continue
      queries.push({
        query: `"${input.offerName}" site:${url.hostname} ${url.pathname}`,
        hint: 'manual_url',
      })
    } catch {
      // Invalid optional hints are ignored; they never become evidence.
    }
  }

  const batches = await Promise.all(
    queries.map(async ({ query, hint }) => ({
      hint,
      results: await runWebSearch(query, 5, {
        depth: 'advanced',
        maxSnippetChars: 2_000,
      }),
    }))
  )

  const byUrl = new Map<string, CopyResearchSnapshot>()
  for (const batch of batches) {
    for (const result of batch.results) {
      const snapshotText = result.snippet.trim()
      if (!snapshotText || byUrl.has(result.url)) continue
      const digest = await sha256Text(`${result.url}\n${snapshotText}`)
      byUrl.set(result.url, {
        source_id: `research-${digest.slice(0, 16)}`,
        publisher_id: publisherId(result.url),
        source_url: result.url,
        snapshot_text: snapshotText,
        snapshot_sha256: digest,
        source_type_hint: batch.hint,
      })
    }
  }
  return [...byUrl.values()]
}
