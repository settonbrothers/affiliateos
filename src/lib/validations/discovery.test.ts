import { describe, expect, it } from 'vitest'

import { DiscoverySourceSchema, StartScanSchema } from './discovery'

describe('StartScanSchema', () => {
  it('accepts a vertical + valid breadth', () => {
    const r = StartScanSchema.safeParse({
      vertical_id: '11111111-1111-1111-1111-111111111111',
      breadth: 'standard',
    })
    expect(r.success).toBe(true)
  })

  it('defaults breadth to standard when omitted', () => {
    const r = StartScanSchema.safeParse({
      vertical_id: '11111111-1111-1111-1111-111111111111',
    })
    expect(r.success && r.data.breadth).toBe('standard')
  })

  it('rejects a non-uuid vertical', () => {
    expect(StartScanSchema.safeParse({ vertical_id: 'nope' }).success).toBe(
      false
    )
  })
})

describe('DiscoverySourceSchema', () => {
  it('accepts a web_search source with query templates', () => {
    const r = DiscoverySourceSchema.safeParse({
      name: 'Web search — AI/SaaS',
      kind: 'web_search',
      query_templates: ['best ai saas affiliate programs'],
      enabled: true,
    })
    expect(r.success).toBe(true)
  })

  it('rejects an empty name', () => {
    expect(
      DiscoverySourceSchema.safeParse({ name: '', kind: 'web_search' }).success
    ).toBe(false)
  })
})
