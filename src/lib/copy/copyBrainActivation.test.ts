import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd())
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('copy brain v3.31 activation contract', () => {
  it('uses the new brain by default while retaining explicit baseline rollback', () => {
    const source = read('supabase/functions/_shared/orchestrators/adCopy.ts')

    expect(source).toContain("input.engineOverride === 'candidate'")
    expect(source).toContain("input.engineOverride !== 'baseline'")
    expect(source).toContain("AD_COPY_BRAIN_V331_ENABLED') !== 'false'")
  })

  it('requires a signed owner decision when the eight-case eval is deferred', () => {
    const release = read('scripts/release-copy-brain.mts')

    expect(release).toContain('--confirm-eight-case-eval-deferred')
    expect(release).toContain(
      'owner_approved_full_affx_activation_pending_smoke'
    )
    expect(release).toContain("required_before_external_users !==\n      'clean_8_case_eval'")
    expect(release).toContain('Activation failed and previous prompts were restored')
  })

  it('limits staging and activation to the owned copy department', () => {
    const scope = read('scripts/copy-brain-scope.mts')
    const stage = read('scripts/stage-copy-brain.mts')
    const release = read('scripts/release-copy-brain.mts')

    expect(scope).toContain('CopyDirectorOrchestrator')
    expect(scope).toContain('CopyPortfolioJudgeOrchestrator')
    expect(scope).not.toContain('DiagnosisOrchestrator')
    expect(scope).not.toContain('AvatarBuilderOrchestrator')
    expect(stage).toContain('isCopyBrainRuntimeOrchestrator')
    expect(release).toContain('isCopyBrainRuntimeOrchestrator')
  })

  it('keeps a separate explicit rollback command', () => {
    const rollback = read('scripts/rollback-copy-brain.mts')

    expect(rollback).toContain('--confirm-rollback')
    expect(rollback).toContain('copy-brain-rollback-v1')
    expect(rollback).toContain('ROLLBACK COMPLETE')
  })
})
