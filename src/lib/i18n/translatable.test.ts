import { describe, expect, it } from 'vitest'

import { applyTranslations, collectStrings } from './translatable'

const payload = {
  overall_score: 78,
  recommended: true,
  network: 'Impact',
  summary: 'Solid recurring program with a strong funnel.',
  hard_filters: {
    economics: { status: 'pass', evidence: 'Pays 20% lifetime on the $149 plan.' },
  },
  key_strengths: ['Recurring commission for twelve months', 'Big'],
}

describe('collectStrings', () => {
  it('collects only prose strings (length + whitespace), skipping enums/short/numbers', () => {
    const paths = collectStrings(payload).map((s) => s.path)
    expect(paths).toContain('summary')
    expect(paths).toContain('hard_filters.economics.evidence')
    expect(paths).toContain('key_strengths.0')
    // skipped: 'pass' (short/no space), 'Impact' (short), 'Big' (short), numbers/bools
    expect(paths).not.toContain('hard_filters.economics.status')
    expect(paths).not.toContain('network')
    expect(paths).not.toContain('key_strengths.1')
  })
})

describe('applyTranslations', () => {
  it('replaces strings at the given paths, leaving the rest intact', () => {
    const out = applyTranslations(payload, {
      summary: 'תוכנית חוזרת איתנה עם פאנל חזק.',
      'hard_filters.economics.evidence': 'משלם 20% לכל החיים על תוכנית ה-$149.',
    }) as typeof payload
    expect(out.summary).toBe('תוכנית חוזרת איתנה עם פאנל חזק.')
    expect(out.hard_filters.economics.evidence).toBe(
      'משלם 20% לכל החיים על תוכנית ה-$149.'
    )
    expect(out.hard_filters.economics.status).toBe('pass')
    expect(out.overall_score).toBe(78)
    // input not mutated
    expect(payload.summary).toBe('Solid recurring program with a strong funnel.')
  })
})
