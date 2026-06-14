export type RawCandidate = { name: string; url: string | null }

// Normalize a URL to a comparable registered domain: lowercased, no scheme,
// no www, no path. Returns null when there's nothing usable.
export function domainOf(url: string | null): string | null {
  if (!url || !url.trim()) return null
  const withScheme = /^https?:\/\//i.test(url) ? url : `https://${url.trim()}`
  let host: string
  try {
    host = new URL(withScheme).hostname
  } catch {
    return null
  }
  const cleaned = host.toLowerCase().replace(/^www\./, '')
  // Reject inputs that didn't actually parse to a dotted host.
  return cleaned.includes('.') ? cleaned : null
}

// Keep candidates whose domain is new (not in `known`) and not already seen
// earlier in this batch. Candidates with no resolvable domain are dropped.
export function dedupeByDomain<T extends RawCandidate>(
  candidates: T[],
  known: Set<string>
): Array<T & { domain: string }> {
  const seen = new Set(known)
  const out: Array<T & { domain: string }> = []
  for (const c of candidates) {
    const domain = domainOf(c.url)
    if (!domain || seen.has(domain)) continue
    seen.add(domain)
    out.push({ ...c, domain })
  }
  return out
}
