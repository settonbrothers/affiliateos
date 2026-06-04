import { describe, expect, it } from 'vitest'

import { formatInviteCode, isInviteCodeValid, type InviteCodeRow } from './invites'

const base: InviteCodeRow = {
  id: 'x',
  code: 'ABCD1234',
  bonus_credits: 50,
  max_uses: 1,
  uses: 0,
  expires_at: null,
  revoked: false,
}
const now = new Date('2026-06-04T00:00:00Z')

describe('isInviteCodeValid', () => {
  it('accepts a fresh code', () => {
    expect(isInviteCodeValid(base, now).valid).toBe(true)
  })

  it('rejects a missing code', () => {
    expect(isInviteCodeValid(null, now).valid).toBe(false)
  })

  it('rejects a revoked code', () => {
    expect(isInviteCodeValid({ ...base, revoked: true }, now).valid).toBe(false)
  })

  it('rejects an expired code', () => {
    expect(
      isInviteCodeValid({ ...base, expires_at: '2026-06-01T00:00:00Z' }, now).valid
    ).toBe(false)
  })

  it('rejects a fully-used code', () => {
    expect(isInviteCodeValid({ ...base, uses: 1, max_uses: 1 }, now).valid).toBe(false)
  })

  it('allows a multi-use code with uses remaining', () => {
    expect(isInviteCodeValid({ ...base, uses: 2, max_uses: 5 }, now).valid).toBe(true)
  })
})

describe('formatInviteCode', () => {
  it('maps bytes into the unambiguous alphabet', () => {
    const code = formatInviteCode(new Uint8Array([0, 1, 2, 3]))
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$/)
  })
})
