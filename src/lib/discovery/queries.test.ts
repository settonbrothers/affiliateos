import { describe, expect, it } from 'vitest'

import { expandQueries } from './queries'

describe('expandQueries', () => {
  it('keeps the base templates', () => {
    const out = expandQueries(['custom base query'], 'AI/SaaS')
    expect(out).toContain('custom base query')
  })

  it('adds vertical-modifier variants', () => {
    const out = expandQueries([], 'AI/SaaS')
    expect(out).toContain('best AI/SaaS affiliate programs')
    expect(out).toContain('AI/SaaS high commission')
    expect(out.length).toBeGreaterThan(3)
  })

  it('dedupes and is deterministic', () => {
    const out = expandQueries(['best AI/SaaS affiliate programs'], 'AI/SaaS')
    const seen = new Set(out)
    expect(seen.size).toBe(out.length)
  })
})
