// Deno mirror of src/lib/i18n/translatable.ts (unit-tested there). Extracts
// prose strings from any AI payload for translation, keyed by path, and applies
// translations back by path. Enums/short labels/URLs/numbers are left canonical.

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
