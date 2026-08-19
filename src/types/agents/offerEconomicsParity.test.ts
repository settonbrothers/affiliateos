import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const normalize = (value: string) => value.replace("'npm:zod@^3.24.0'", "'zod'")

describe('offer economics contract parity', () => {
  it('keeps Node and Deno schemas identical', () => {
    const root = resolve(process.cwd())
    const node = normalize(
      readFileSync(resolve(root, 'src/types/agents/offerEconomics.ts'), 'utf8')
    )
    const deno = normalize(
      readFileSync(
        resolve(root, 'supabase/functions/_shared/types/offerEconomics.ts'),
        'utf8'
      )
    )
    expect(deno).toBe(node)
  })
})
