import { describe, expect, it } from 'vitest'

import {
  copyGatePasses,
  normalizeCopyGateReport,
} from '../../../supabase/functions/_shared/brainContracts/classifyCopyFindings.mjs'

describe('signed copy finding classifier', () => {
  it('keeps craft and rhetorical findings visible without blocking', () => {
    const report = normalizeCopyGateReport({
      overall: 'fail',
      compliance_ok: false,
      kill_flags: [
        'post_peak_value_bridge_partial',
        'rhetorical_counterfactual_stronger_than_source',
      ],
    })

    expect(copyGatePasses(report)).toBe(true)
    expect(report.kill_flags).toEqual([])
    expect(report.quality_findings).toEqual([
      'post_peak_value_bridge_partial',
      'rhetorical_counterfactual_stronger_than_source',
    ])
    expect(report.overall).toBe('advisory')
    expect(report.compliance_ok).toBe(true)
  })

  it('does not restore removed synthetic-character policy blocks', () => {
    const report = normalizeCopyGateReport({
      kill_flags: ['fake_testimonial', 'disclosure_required'],
    })

    expect(copyGatePasses(report)).toBe(true)
    expect(report.kill_flags).toEqual([])
    expect(report.removed_policy_findings).toEqual([
      'fake_testimonial',
      'disclosure_required',
    ])
  })

  it('still blocks direct material falsehoods and system failures', () => {
    expect(
      copyGatePasses({ kill_flags: ['material_claim_fabrication'] })
    ).toBe(false)
    expect(copyGatePasses({ kill_flags: ['objective_mismatch'] })).toBe(false)
  })

  it('routes duplicate hooks and forbidden dashes to automatic repair', () => {
    const report = normalizeCopyGateReport({
      kill_flags: ['hook_body_duplicate', 'forbidden_dash'],
    })

    expect(copyGatePasses(report)).toBe(true)
    expect(report.kill_flags).toEqual([])
    expect(report.auto_fix_findings).toEqual([
      'hook_body_duplicate',
      'forbidden_dash',
    ])
  })
})
