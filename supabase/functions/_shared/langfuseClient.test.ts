import { assertAlmostEquals, assertEquals } from 'jsr:@std/assert'

import { computeCostUsd } from './langfuseClient.ts'

Deno.test('computeCostUsd: sonnet 1M in + 1M out = $3 + $15', () => {
  assertAlmostEquals(computeCostUsd('claude-sonnet-4-6', 1_000_000, 1_000_000), 18)
})

Deno.test('computeCostUsd: haiku 500k in + 200k out = $0.5 + $1.0', () => {
  assertAlmostEquals(
    computeCostUsd('claude-haiku-4-5-20251001', 500_000, 200_000),
    1.5
  )
})

Deno.test('computeCostUsd: unknown model returns 0', () => {
  assertEquals(computeCostUsd('some-other-model', 1000, 1000), 0)
})
