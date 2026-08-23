import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const root = resolve(process.cwd())
const read = (path: string) => readFileSync(resolve(root, path), 'utf8')

describe('resumable production ad-copy pipeline', () => {
  it('persists a durable checkpoint and credit hold', () => {
    const migration = read('supabase/migrations/0048_ad_copy_jobs.sql')
    expect(migration).toContain('ai_run_id uuid not null unique')
    expect(migration).toContain('input_payload jsonb not null')
    expect(migration).toContain('checkpoint jsonb')
    expect(migration).toContain('credit_hold jsonb')
    expect(migration).toContain('lease_expires_at timestamptz')
    expect(migration).toContain(
      "status in ('queued', 'running', 'completed', 'failed')"
    )
  })

  it('freezes active prompts before creating the job', () => {
    const entry = read('supabase/functions/generate-ad-copy/index.ts')
    expect(entry).toContain('COPY_PROMPT_ORCHESTRATORS')
    expect(entry).toContain("'CopyStorytellingWriterOrchestrator'")
    expect(entry).toContain("'CopyDirectResponseWriterOrchestrator'")
    expect(entry).toContain("'CopyProofMechanismWriterOrchestrator'")
    expect(entry).toContain('promptVersions[orchestrator] = selected.version')
    expect(entry).toContain('promptContents[orchestrator] = selected.content')
    expect(entry).toContain(".from('ad_copy_jobs')")
    expect(entry).toContain("invokeSelf('run-ad-copy-job'")
  })

  it('runs one checkpointed model stage and hands off to a fresh invocation', () => {
    const worker = read('supabase/functions/run-ad-copy-job/index.ts')
    expect(worker).toContain('runAdCopyEvidenceAgencyStep(')
    expect(worker).toContain('checkpoint: step.checkpoint')
    expect(worker).toContain("invokeSelf('run-ad-copy-job'")
    expect(worker).toContain('recordRunSuccess(job.ai_run_id')
    expect(worker).not.toContain('runAdCopy(')
  })

  it('keeps an active smoke fixture instead of deleting its live job', () => {
    const smoke = read('scripts/smoke-copy-brain-v331.mts')
    expect(smoke).toContain('if (!cleanupSafe)')
    expect(smoke).toContain('if (cleanupSafe && offerId)')
  })
})
