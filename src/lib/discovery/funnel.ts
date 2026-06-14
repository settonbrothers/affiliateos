export type CandidateStage =
  | 'discovered'
  | 'triaged'
  | 'analyzed'
  | 'rejected'
  | 'approved'
  | 'promoted'

export type CandidateLike = {
  id: string
  stage: CandidateStage
  triage_score: number | null
  deep_score: number | null
  rejection_stage?: CandidateStage | null
}

export const STAGE_LABELS: Record<CandidateStage, string> = {
  discovered: 'Discovered',
  triaged: 'Passed triage',
  analyzed: 'Deep-analyzed',
  rejected: 'Rejected',
  approved: 'Approved',
  promoted: 'Published',
}

export const STAGE_BADGE_CLASS: Record<CandidateStage, string> = {
  discovered: 'border-zinc-300 bg-zinc-100 text-zinc-700',
  triaged: 'border-blue-300 bg-blue-100 text-blue-800',
  analyzed: 'border-violet-300 bg-violet-100 text-violet-800',
  rejected: 'border-red-300 bg-red-100 text-red-800',
  approved: 'border-green-300 bg-green-100 text-green-800',
  promoted: 'border-emerald-400 bg-emerald-100 text-emerald-900',
}

export type FunnelCounts = {
  discovered: number
  triaged: number
  analyzed: number
  approved: number
}

// A candidate "reached deep analysis" if it's at analyzed/approved/promoted, or
// it was rejected AT the analyzed stage. It "passed triage" if it reached deep
// OR was rejected at the analyzed stage (same set in v1, but kept explicit).
function reachedDeep(x: CandidateLike): boolean {
  return (
    x.stage === 'analyzed' ||
    x.stage === 'approved' ||
    x.stage === 'promoted' ||
    (x.stage === 'rejected' && x.rejection_stage === 'analyzed')
  )
}

export function funnelCounts(candidates: CandidateLike[]): FunnelCounts {
  let triaged = 0
  let analyzed = 0
  let approved = 0
  for (const x of candidates) {
    if (reachedDeep(x)) {
      triaged++
      analyzed++
    }
    if (x.stage === 'approved' || x.stage === 'promoted') approved++
  }
  return { discovered: candidates.length, triaged, analyzed, approved }
}

// Candidates that reached deep analysis, best first.
export function rankAnalyzed<T extends CandidateLike>(candidates: T[]): T[] {
  return candidates
    .filter(reachedDeep)
    .sort((a, b) => (b.deep_score ?? 0) - (a.deep_score ?? 0))
}
