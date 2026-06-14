// Web-search adapter. Real Tavily call when DISCOVERY_SEARCH_API_KEY is set;
// otherwise a deterministic mock so the funnel is dev-runnable cost-free.
// Returns lightweight candidates; the funnel dedupes + triages them downstream.

export type SearchCandidate = {
  name: string
  url: string
  snippet: string
}

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
  maxResults: number
): Promise<SearchCandidate[]> {
  const apiKey = Deno.env.get('DISCOVERY_SEARCH_API_KEY')
  if (!apiKey) {
    return MOCK_CANDIDATES.slice(0, maxResults)
  }

  // Tavily search API. Returns results[].{title,url,content}.
  const res = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      max_results: maxResults,
      search_depth: 'basic',
    }),
  })
  if (!res.ok) throw new Error(`web search failed: HTTP ${res.status}`)
  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>
  }
  return (data.results ?? [])
    .filter((r) => r.url)
    .map((r) => ({
      name: r.title?.trim() || r.url!,
      url: r.url!,
      snippet: r.content?.slice(0, 500) ?? '',
    }))
}
