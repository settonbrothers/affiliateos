import type { CSSProperties } from 'react'

import type { Verdict } from '@/types/agents/underwriting'

export type VerdictTier = 'hi' | 'mid' | 'low'

const TIER: Record<Verdict, VerdictTier> = {
  reject: 'low',
  organic_only: 'low',
  seo_review_only: 'low',
  watch: 'mid',
  small_paid_test: 'mid',
  strong_test: 'hi',
  strategic_opportunity: 'hi',
  high_ceiling_opportunity: 'hi',
}

export function verdictTier(verdict: Verdict): VerdictTier {
  return TIER[verdict]
}

/** CSS for a verdict chip by tier (matches AFFEX Lambo mock). */
export function verdictChipStyle(tier: VerdictTier): CSSProperties {
  if (tier === 'hi')
    return { color: 'var(--primary)', border: '1px solid var(--accent-border)', background: 'var(--accent-fill)' }
  if (tier === 'mid')
    return { color: '#E4E4E2', border: '1px solid rgba(255,255,255,0.16)', background: 'transparent' }
  return { color: '#8A8A88', border: '1px solid rgba(255,255,255,0.08)', background: 'transparent' }
}

export function verdictDotColor(tier: VerdictTier): string {
  return tier === 'hi' ? 'var(--primary)' : tier === 'mid' ? '#B0B0AE' : '#5E5E5C'
}
