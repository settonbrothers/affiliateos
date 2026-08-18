import {
  CopyBrainInputSnapshotV1Schema,
  type CopyBrainInputSnapshotV1,
} from '../types/copyBrain.ts'
import { brainSha256 } from './copyBrainContext.ts'

export type CopyBrainSnapshotParts = Omit<
  CopyBrainInputSnapshotV1,
  'schema_version' | 'snapshot_sha256'
>

export async function createCopyBrainSnapshot(
  parts: CopyBrainSnapshotParts
): Promise<CopyBrainInputSnapshotV1> {
  const unsigned = {
    ...parts,
    schema_version: 'copy-brain-input-v1' as const,
    snapshot_sha256: '0'.repeat(64),
  }
  const sealed = { ...unsigned, snapshot_sha256: await brainSha256(unsigned) }
  return CopyBrainInputSnapshotV1Schema.parse(sealed)
}

export function missingCopyBrainInputs(parts: {
  sources: unknown[]
  underwriting: unknown
  deepBrief: unknown
  avatar: unknown
  testKit: unknown
  spy: unknown[]
}): string[] {
  const missing: string[] = []
  if (parts.sources.length === 0) missing.push('verified_sources')
  if (!parts.underwriting) missing.push('underwriting')
  if (!parts.deepBrief) missing.push('deep_brief')
  if (!parts.avatar) missing.push('avatar')
  if (!parts.testKit) missing.push('test_kit')
  if (parts.spy.length === 0) missing.push('spy_analyses')
  return missing
}
