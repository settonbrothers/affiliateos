// Expand a source's base query templates into a wider, deduped set so the scan
// surfaces more container pages (to mine) and more program pages. Deterministic.
const MODIFIERS = [
  'high commission',
  'recurring commission',
  'affiliate program review',
  'partner program payout',
]

export function expandQueries(base: string[], vertical: string): string[] {
  const v = vertical.trim()
  const generated = [
    `best ${v} affiliate programs`,
    `top ${v} affiliate programs`,
    ...MODIFIERS.map((m) => `${v} ${m}`),
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const q of [...base, ...generated]) {
    const key = q.trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(q)
  }
  return out
}
