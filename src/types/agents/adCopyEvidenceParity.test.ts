import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd())
const normalize = (value: string) =>
  value
    .replace("import { z } from 'zod'", "import { z } from 'zod'")
    .replace("import { z } from 'npm:zod@^3.24.0'", "import { z } from 'zod'")
    .replace("from './envelope.ts'", "from './envelope'")

describe('evidence-story deployment package', () => {
  it('keeps Node and Deno contracts in parity', () => {
    const node = normalize(
      readFileSync(resolve(root, 'src/types/agents/adCopyEvidence.ts'), 'utf8')
    )
    const deno = normalize(
      readFileSync(
        resolve(root, 'supabase/functions/_shared/types/adCopyEvidence.ts'),
        'utf8'
      )
    )
    expect(deno).toBe(node)
  })

  it('keeps candidate prompts staged and placeholder-free', () => {
    const files = [
      'prompts/copy_excavate_product/v3.md',
      'prompts/copy_angle/v4.md',
      'prompts/copy_hook/v4.md',
      'prompts/copy_write/v4.md',
      'prompts/copy_reader/v1.md',
      'prompts/copy_critic/v1.md',
      'prompts/copy_judge/v3.md',
    ]
    for (const file of files)
      expect(readFileSync(resolve(root, file), 'utf8')).not.toMatch(
        /\{\{[^}]+\}\}/
      )
    expect(
      JSON.parse(
        readFileSync(resolve(root, 'prompts/copy_angle/_active.json'), 'utf8')
      ).version
    ).toBe('v2')
    expect(
      JSON.parse(
        readFileSync(resolve(root, 'prompts/copy_write/_active.json'), 'utf8')
      ).version
    ).toBe('v2')
    expect(
      JSON.parse(
        readFileSync(
          resolve(root, 'prompts/copy_excavate_product/_active.json'),
          'utf8'
        )
      ).version
    ).toBe('v1')
    expect(
      JSON.parse(
        readFileSync(resolve(root, 'prompts/copy_judge/_active.json'), 'utf8')
      ).version
    ).toBe('v1')
  })
})
