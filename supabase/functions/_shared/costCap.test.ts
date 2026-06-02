import { assertEquals } from 'jsr:@std/assert'

import { isOverDailyCap } from './costCap.ts'

Deno.test('isOverDailyCap: under cap is allowed', () => {
  assertEquals(isOverDailyCap(3, 10), false)
  assertEquals(isOverDailyCap(0, 10), false)
})

Deno.test('isOverDailyCap: exactly at cap is blocked', () => {
  assertEquals(isOverDailyCap(10, 10), true)
})

Deno.test('isOverDailyCap: over cap is blocked', () => {
  assertEquals(isOverDailyCap(12.5, 10), true)
})

Deno.test('isOverDailyCap: cap of 0 blocks even at zero spend (M2 cap=0 case)', () => {
  assertEquals(isOverDailyCap(0, 0), true)
})
