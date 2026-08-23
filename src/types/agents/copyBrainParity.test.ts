import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd())

describe('CopyBrainInputSnapshotV1 contract parity', () => {
  it('keeps the signed JSON contract aligned with the Node contract', () => {
    const schema = JSON.parse(
      readFileSync(
        resolve(root, 'brain-contracts/copy-brain-input-v1.schema.json'),
        'utf8'
      )
    ) as {
      required: string[]
      properties: {
        campaign_context: {
          properties: { generation_language: { enum: string[] } }
        }
      }
      $defs: { source: { properties: { source_type: { enum: string[] } } } }
    }
    expect(schema.required).toEqual(
      expect.arrayContaining([
        'research_documents',
        'spy_analyses',
        'performance_winners',
        'avatar',
        'taste_corpus',
        'hook_library',
        'missing_inputs',
        'omitted_context',
        'offer_economics',
      ])
    )
    expect(schema.$defs.source.properties.source_type.enum).toContain(
      'campaign_result'
    )
    expect(
      schema.properties.campaign_context.properties.generation_language.enum
    ).toEqual(['he', 'en'])
  })

  it('keeps all deployment-critical fields in both Node and Deno Zod adapters', () => {
    const node = readFileSync(
      resolve(root, 'src/types/agents/copyBrain.ts'),
      'utf8'
    )
    const deno = readFileSync(
      resolve(root, 'supabase/functions/_shared/types/copyBrain.ts'),
      'utf8'
    )
    for (const token of [
      'copy-brain-input-v1',
      'deep-avatar-v2',
      'research_documents',
      'performance_winners',
      'hook_library',
      'campaign_result',
      'snapshot_sha256',
      'offer_economics',
      "generation_language: z.enum(['he', 'en'])",
    ]) {
      expect(node).toContain(token)
      expect(deno).toContain(token)
    }
  })
})
