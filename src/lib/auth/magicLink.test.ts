import { describe, expect, it } from 'vitest'

import { magicLinkErrorMessage } from './magicLink'

describe('magicLinkErrorMessage', () => {
  it('maps "Signups not allowed for otp" to an invite-aware message', () => {
    expect(magicLinkErrorMessage('Signups not allowed for otp')).toMatch(
      /invite code/i
    )
  })

  it('maps otp_disabled the same way', () => {
    expect(magicLinkErrorMessage('otp_disabled')).toMatch(/invite code/i)
  })

  it('passes through unrelated errors unchanged', () => {
    expect(magicLinkErrorMessage('Email rate limit exceeded')).toBe(
      'Email rate limit exceeded'
    )
  })
})
