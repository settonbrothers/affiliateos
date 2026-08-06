import { describe, expect, it } from 'vitest'

import { isAnalysisFailed } from './analysisState'

const run = (status: string, created_at: string) =>
  ({ status, created_at }) as Parameters<typeof isAnalysisFailed>[0]

describe('isAnalysisFailed', () => {
  it('is false when there are no runs at all', () => {
    expect(isAnalysisFailed(null, null)).toBe(false)
  })

  it('is false while a run is still in flight', () => {
    expect(isAnalysisFailed(run('running', '2026-08-06T10:00:00Z'), null)).toBe(false)
  })

  it('is false when the latest run succeeded', () => {
    const ok = run('success', '2026-08-06T10:00:00Z')
    expect(isAnalysisFailed(ok, ok)).toBe(false)
  })

  it('is true when the only run failed', () => {
    expect(isAnalysisFailed(run('failed', '2026-08-06T10:00:00Z'), null)).toBe(true)
  })

  it('is true when a failure lands after the last good run — the stale scorecard needs explaining', () => {
    expect(
      isAnalysisFailed(
        run('failed', '2026-08-06T12:00:00Z'),
        run('success', '2026-08-06T10:00:00Z')
      )
    ).toBe(true)
  })

  it('goes quiet once a successful re-run supersedes an older failure', () => {
    // `latest` is status-agnostic, so after a good re-run it IS the success row.
    const ok = run('success', '2026-08-06T14:00:00Z')
    expect(isAnalysisFailed(ok, ok)).toBe(false)
  })
})
