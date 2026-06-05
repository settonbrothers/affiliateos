import { describe, expect, it } from 'vitest'

import { buildPosthogPayload } from './posthog'
import { buildSentryEvent, parseDsn } from './sentry'

describe('posthog payload', () => {
  it('shapes a capture body', () => {
    const p = buildPosthogPayload('phc_x', 'ws_1', 'ai_run_completed', { cost_usd: 0.05 }, 'TS')
    expect(p).toEqual({
      api_key: 'phc_x',
      distinct_id: 'ws_1',
      event: 'ai_run_completed',
      properties: { cost_usd: 0.05 },
      timestamp: 'TS',
    })
  })
})

describe('sentry parseDsn', () => {
  it('parses a standard DSN into store url + key', () => {
    const r = parseDsn('https://abc123@o42.ingest.sentry.io/1234')
    expect(r).toEqual({
      storeUrl: 'https://o42.ingest.sentry.io/api/1234/store/',
      publicKey: 'abc123',
    })
  })

  it('returns null for empty/garbage', () => {
    expect(parseDsn('')).toBeNull()
    expect(parseDsn(undefined)).toBeNull()
    expect(parseDsn('not-a-dsn')).toBeNull()
  })
})

describe('sentry event', () => {
  it('captures the error type + message', () => {
    const e = buildSentryEvent(new TypeError('boom'), { tags: { route: 'webhook' } }, 'eid', 'TS')
    expect(e.exception.values[0]).toEqual({ type: 'TypeError', value: 'boom' })
    expect(e.tags).toEqual({ route: 'webhook' })
    expect(e.event_id).toBe('eid')
  })

  it('coerces non-Error throwables', () => {
    const e = buildSentryEvent('plain string', {}, 'eid', 'TS')
    expect(e.exception.values[0]?.value).toBe('plain string')
  })
})
