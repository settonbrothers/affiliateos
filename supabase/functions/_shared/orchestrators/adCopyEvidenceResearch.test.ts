import { assertEquals, assertMatch } from 'jsr:@std/assert@1'

import { sha256Text } from './adCopyEvidenceResearch.ts'

Deno.test('sha256Text is deterministic and manifest-safe', async () => {
  const first = await sha256Text('https://example.test/review\nbounded result')
  const second = await sha256Text('https://example.test/review\nbounded result')
  assertEquals(first, second)
  assertMatch(first, /^[a-f0-9]{64}$/)
})
