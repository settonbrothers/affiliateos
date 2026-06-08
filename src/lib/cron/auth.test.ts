import { describe, expect, it } from 'vitest'

import { isAuthorizedCron } from './auth'

describe('isAuthorizedCron', () => {
  it('accepts a matching bearer token', () => {
    expect(isAuthorizedCron('Bearer s3cret', 's3cret')).toBe(true)
  })

  it('rejects a mismatched token', () => {
    expect(isAuthorizedCron('Bearer wrong', 's3cret')).toBe(false)
  })

  it('rejects when no secret is configured', () => {
    expect(isAuthorizedCron('Bearer s3cret', undefined)).toBe(false)
  })

  it('rejects a missing header', () => {
    expect(isAuthorizedCron(null, 's3cret')).toBe(false)
  })
})
