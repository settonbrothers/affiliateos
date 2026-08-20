import { assertEquals, assertThrows } from 'jsr:@std/assert'

import { calculateAnthropicCostUsd } from './anthropicJson.ts'

Deno.test('prices Sonnet 4.6 deterministically', () => {
  assertEquals(
    calculateAnthropicCostUsd('claude-sonnet-4-6', {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    }),
    18
  )
})

Deno.test('prices Opus 4.6 deterministically', () => {
  assertEquals(
    calculateAnthropicCostUsd('claude-opus-4-6', {
      input_tokens: 1_000_000,
      output_tokens: 1_000_000,
    }),
    30
  )
})

Deno.test(
  'mixed agency total includes Opus instead of pricing it at zero',
  () => {
    const sonnet = calculateAnthropicCostUsd('claude-sonnet-4-6', {
      input_tokens: 100_000,
      output_tokens: 10_000,
    })
    const opus = calculateAnthropicCostUsd('claude-opus-4-6', {
      input_tokens: 100_000,
      output_tokens: 10_000,
    })
    assertEquals(Number((sonnet + opus).toFixed(2)), 1.2)
  }
)

Deno.test('unknown paid model fails instead of silently reporting zero', () => {
  assertThrows(
    () =>
      calculateAnthropicCostUsd('claude-unknown', {
        input_tokens: 1,
        output_tokens: 1,
      }),
    Error,
    'No verified Anthropic pricing'
  )
})
