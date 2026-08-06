import type { AiRunStatus } from '@/types/db'

type RunLike = {
  status: AiRunStatus
  created_at: string
} | null

/**
 * Should the offer page tell the operator the analysis failed?
 *
 * The page reads two runs: the latest of any status (so the Analyze button can
 * resume one that is still running) and the latest *successful* one (the
 * scorecard). When the newest run failed, the scorecard silently falls back to
 * an older result — or to nothing at all, rendering as "No verdict yet. Run an
 * analysis first", which reads as "you never ran it" rather than "it broke".
 *
 * True only when the newest run failed AND nothing newer succeeded, so an old
 * failure followed by a good re-run stays quiet.
 */
export function isAnalysisFailed(latest: RunLike, latestSuccess: RunLike): boolean {
  if (latest?.status !== 'failed') return false
  if (!latestSuccess) return true
  return latest.created_at > latestSuccess.created_at
}
