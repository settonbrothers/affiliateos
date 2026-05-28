import { assertEquals } from 'jsr:@std/assert'

import { truncate } from './truncate.ts'

Deno.test('truncate: returns value unchanged when within max', () => {
  assertEquals(truncate('hello', 10), 'hello')
  assertEquals(truncate('hello', 5), 'hello')
})

Deno.test('truncate: truncates with an ellipsis', () => {
  assertEquals(truncate('hello world', 5), 'hell…')
})

Deno.test('truncate: zero or negative max returns empty', () => {
  assertEquals(truncate('hello', 0), '')
  assertEquals(truncate('hello', -3), '')
})
