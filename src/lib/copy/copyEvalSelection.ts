export type EvalOfferCandidate = {
  offerId: string
  name: string
  vertical: string
  verifiedSourceCount: number
  hasUnderwriting: boolean
  hasDeepBrief: boolean
  hasAvatar: boolean
  hasSpy: boolean
  hasTestKit: boolean
  measuredWinnerCount: number
  complianceRisk: boolean
}

export type EvalSelection = EvalOfferCandidate & {
  profile:
    | 'full_context_with_measured_winner'
    | 'full_context_without_measured_winner'
    | 'good_evidence_missing_optional_upstream'
    | 'thin_conflicting_or_compliance_risk'
    | 'best_available_context'
    | 'verified_evidence_missing_optional_upstream'
    | 'conflicting_vendor_economics'
    | 'thin_health_claims_vendor_only'
  completenessScore: number
}

export type LockedEvalSelector = {
  offerId: string
  profile: EvalSelection['profile']
}

export function completenessScore(candidate: EvalOfferCandidate): number {
  return (
    Math.min(candidate.verifiedSourceCount, 8) * 4 +
    Number(candidate.hasUnderwriting) * 12 +
    Number(candidate.hasDeepBrief) * 10 +
    Number(candidate.hasAvatar) * 10 +
    Number(candidate.hasSpy) * 8 +
    Number(candidate.hasTestKit) * 10 +
    Math.min(candidate.measuredWinnerCount, 3) * 8 -
    Number(candidate.complianceRisk) * 6
  )
}

const complete = (candidate: EvalOfferCandidate) =>
  candidate.verifiedSourceCount >= 3 &&
  candidate.hasUnderwriting &&
  candidate.hasDeepBrief &&
  candidate.hasAvatar &&
  candidate.hasSpy &&
  candidate.hasTestKit

export function selectAffxEvalOffers(
  candidates: EvalOfferCandidate[],
  lockedSelectors: LockedEvalSelector[] = []
): EvalSelection[] {
  if (lockedSelectors.length > 0) {
    if (lockedSelectors.length !== 4) {
      throw new Error('Locked AffX eval suite must contain exactly four offers.')
    }
    const uniqueIds = new Set(lockedSelectors.map((item) => item.offerId))
    if (uniqueIds.size !== lockedSelectors.length) {
      throw new Error('Locked AffX eval suite contains duplicate offer ids.')
    }
    return lockedSelectors.map((selector) => {
      const candidate = candidates.find(
        (item) => item.offerId === selector.offerId
      )
      if (!candidate) {
        throw new Error(
          `Locked AffX eval offer ${selector.offerId} is unavailable; do not substitute a random case.`
        )
      }
      return {
        ...candidate,
        profile: selector.profile,
        completenessScore: completenessScore(candidate),
      }
    })
  }
  const remaining = [...candidates]
  const selected: EvalSelection[] = []
  const usedVerticals = new Set<string>()
  const profiles: Array<{
    profile: EvalSelection['profile']
    match: (candidate: EvalOfferCandidate) => boolean
    preferLow?: boolean
  }> = [
    {
      profile: 'full_context_with_measured_winner',
      match: (candidate) =>
        complete(candidate) && candidate.measuredWinnerCount > 0,
    },
    {
      profile: 'full_context_without_measured_winner',
      match: (candidate) =>
        complete(candidate) && candidate.measuredWinnerCount === 0,
    },
    {
      profile: 'good_evidence_missing_optional_upstream',
      match: (candidate) =>
        candidate.verifiedSourceCount >= 3 &&
        candidate.hasUnderwriting &&
        (!candidate.hasSpy || !candidate.hasTestKit || !candidate.hasAvatar),
    },
    {
      profile: 'thin_conflicting_or_compliance_risk',
      match: (candidate) =>
        candidate.complianceRisk || candidate.verifiedSourceCount < 3,
      preferLow: true,
    },
  ]

  for (const rule of profiles) {
    const pool = remaining.filter(rule.match).sort((left, right) => {
      const scoreDiff = completenessScore(right) - completenessScore(left)
      return (
        (rule.preferLow ? -scoreDiff : scoreDiff) ||
        left.name.localeCompare(right.name)
      )
    })
    const choice = pool.find(
      (candidate) => !usedVerticals.has(candidate.vertical)
    )
    if (!choice) {
      throw new Error(
        `No distinct-vertical AffX offer satisfies ${rule.profile}; do not substitute a random case.`
      )
    }
    selected.push({
      ...choice,
      profile: rule.profile,
      completenessScore: completenessScore(choice),
    })
    usedVerticals.add(choice.vertical)
    remaining.splice(
      remaining.findIndex((candidate) => candidate.offerId === choice.offerId),
      1
    )
  }
  return selected
}
