// Generic extraction of free-text fields from an AI payload (any shape) for
// translation. We translate only PROSE — strings long enough and containing a
// space — so enum tokens ("pass", "in-house"), short labels, URLs, and
// numbers/booleans are left as canonical. Keying by path lets us put the
// translated text back exactly where it came from.

export type TranslatableString = { path: string; text: string }

function isProse(s: string): boolean {
  const t = s.trim()
  return t.length >= 12 && /\s/.test(t) && !/^https?:\/\//i.test(t)
}

export function collectStrings(
  value: unknown,
  path = ''
): TranslatableString[] {
  if (typeof value === 'string') {
    return isProse(value) ? [{ path, text: value }] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((v, i) =>
      collectStrings(v, path ? `${path}.${i}` : String(i))
    )
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>).flatMap(([k, v]) =>
      collectStrings(v, path ? `${path}.${k}` : k)
    )
  }
  return []
}

// Return a deep copy with the strings at the given paths replaced. Paths not in
// the lookup are left untouched. The input is not mutated.
export function applyTranslations(
  value: unknown,
  lookup: Record<string, string>,
  path = ''
): unknown {
  if (typeof value === 'string') {
    return path in lookup ? lookup[path] : value
  }
  if (Array.isArray(value)) {
    return value.map((v, i) =>
      applyTranslations(v, lookup, path ? `${path}.${i}` : String(i))
    )
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = applyTranslations(v, lookup, path ? `${path}.${k}` : k)
    }
    return out
  }
  return value
}
