import { describe, expect, it } from 'vitest'

import { domainOf, dedupeByDomain } from './dedup'

describe('domainOf', () => {
  it('lowercases and strips www + path', () => {
    expect(domainOf('https://WWW.Example.com/affiliates?x=1')).toBe(
      'example.com'
    )
  })

  it('handles bare domains without scheme', () => {
    expect(domainOf('Example.com/x')).toBe('example.com')
  })

  it('returns null for unusable input', () => {
    expect(domainOf('')).toBeNull()
    expect(domainOf('not a url at all ')).toBeNull()
  })
})

describe('dedupeByDomain', () => {
  it('drops candidates whose domain is already known', () => {
    const out = dedupeByDomain(
      [
        { name: 'A', url: 'https://a.com' },
        { name: 'B', url: 'https://b.com' },
      ],
      new Set(['a.com'])
    )
    expect(out.map((c) => c.name)).toEqual(['B'])
  })

  it('drops intra-batch duplicates, keeping the first', () => {
    const out = dedupeByDomain(
      [
        { name: 'first', url: 'https://dup.com/x' },
        { name: 'second', url: 'https://www.dup.com/y' },
      ],
      new Set()
    )
    expect(out.map((c) => c.name)).toEqual(['first'])
  })

  it('drops candidates with no resolvable domain', () => {
    const out = dedupeByDomain([{ name: 'bad', url: 'garbage' }], new Set())
    expect(out).toEqual([])
  })
})
