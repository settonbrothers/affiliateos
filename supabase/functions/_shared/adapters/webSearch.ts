// Web-search adapter. Real Tavily call when DISCOVERY_SEARCH_API_KEY is set;
// otherwise a deterministic mock so the funnel is dev-runnable cost-free.
// Returns lightweight candidates; the funnel dedupes + triages them downstream.

export type SearchCandidate = {
  name: string
  url: string
  snippet: string
}

/**
 * Per-caller search tuning.
 *
 * Everything used to run at `basic` depth with a 500-character snippet, which
 * is the right trade for the discovery sweep (it only needs names and URLs)
 * and far too thin for the calls that have to JUDGE something from what comes
 * back — underwriting scoring offer_trust, or deep analysis resolving a
 * hard filter. Defaults are unchanged, so a caller opts in deliberately.
 *
 * Note `advanced` costs roughly twice a basic search, and snippet length feeds
 * straight into model input tokens: DiscoveryDeep runs this five times per
 * candidate across up to a hundred candidates, so its budget is not the same
 * as underwriting's one-offer budget.
 */
export type SearchOptions = {
  depth?: 'basic' | 'advanced'
  maxSnippetChars?: number
}

const DEFAULT_SNIPPET_CHARS = 500

const MOCK_CANDIDATES: SearchCandidate[] = [
  {
    name: 'Base44',
    url: 'https://base44.com/affiliates',
    snippet: 'AI app builder affiliate program — recurring commission.',
  },
  {
    name: 'Higgsfield',
    url: 'https://higgsfield.ai/partners',
    snippet: 'Generative video platform partner program.',
  },
  {
    name: 'Example Saturated Tool',
    url: 'https://example-old-tool.com',
    snippet: 'Long-standing tool, thin affiliate terms.',
  },
]

export async function runWebSearch(
  query: string,
  maxResults: number,
  options: SearchOptions = {}
): Promise<SearchCandidate[]> {
  const apiKey = Deno.env.get('DISCOVERY_SEARCH_API_KEY')
  if (!apiKey) {
    return MOCK_CANDIDATES.slice(0, maxResults)
  }
  const depth = options.depth ?? 'basic'
  const maxSnippetChars = options.maxSnippetChars ?? DEFAULT_SNIPPET_CHARS

  // Tavily search API. Auth is a Bearer token in the Authorization header
  // (the legacy body `api_key` is deprecated). Returns results[].{title,url,content}.
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: maxResults,
      search_depth: depth,
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    throw new Error(`web search failed: HTTP ${res.status} ${detail.slice(0, 200)}`)
  }
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>
  }
  return (data.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      name: r.title?.trim() || r.url!,
      url: r.url!,
      snippet: r.content?.slice(0, maxSnippetChars) ?? '',
    }))
}
