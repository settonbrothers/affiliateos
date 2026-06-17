import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE, resolveLocale } from './locale'

describe('resolveLocale', () => {
  it('honors an explicit he cookie', () => {
    expect(resolveLocale('he', 'en-US,en;q=0.9')).toBe('he')
  })

  it('honors an explicit en cookie over a Hebrew browser', () => {
    expect(resolveLocale('en', 'he-IL,he;q=0.9')).toBe('en')
  })

  it('falls back to Hebrew when the browser prefers it and no cookie', () => {
    expect(resolveLocale(undefined, 'he-IL,he;q=0.9,en;q=0.8')).toBe('he')
  })

  it('falls back to English for a non-Hebrew browser', () => {
    expect(resolveLocale(undefined, 'en-US,en;q=0.9')).toBe('en')
  })

  it('defaults to English when nothing is provided', () => {
    expect(resolveLocale(undefined, null)).toBe(DEFAULT_LOCALE)
    expect(DEFAULT_LOCALE).toBe('en')
  })

  it('ignores a junk cookie value and uses the browser', () => {
    expect(resolveLocale('fr', 'he-IL,he')).toBe('he')
  })
})
