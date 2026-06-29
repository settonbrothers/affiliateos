import { assertEquals } from 'jsr:@std/assert'

import {
  assembleResponse,
  buildStageUserMessage,
  isOverCostCap,
  selectFewShot,
  shouldRefine,
  type TasteExample,
} from './adCopyLogic.ts'
import type { AdCopyJudge } from '../types/adCopy.ts'

function judge(overrides: Partial<AdCopyJudge> = {}): AdCopyJudge {
  return {
    principles: [
      { principle: 'product_understanding', verdict: 'pass', reason: 'ok' },
      { principle: 'eye_level_authentic', verdict: 'pass', reason: 'ok' },
      { principle: 'depth_without_exaggeration', verdict: 'pass', reason: 'ok' },
    ],
    compliance_ok: true,
    overall: 'advisory',
    calibrated: false,
    notes: 'n',
    ...overrides,
  }
}

const corpus: TasteExample[] = [
  { kind: 'copy', lang: 'he', text: 'he-good-1', label: 'good' },
  { kind: 'copy', lang: 'he', text: 'he-bad-1', label: 'bad' },
  { kind: 'copy', lang: 'en', text: 'en-good-1', label: 'good' },
  { kind: 'avatar', lang: 'he', text: 'av-he-good', label: 'good' },
]

const baseParts = () => ({
  productExcavation: {
    real_problem: 'p',
    real_solution: 's',
    why_better: 'w',
    key_differentiators: ['d'],
  },
  avatarExcavation: {
    who: 'w',
    pain_points: ['pain'],
    objections: [],
    desires: ['desire'],
    voice_of_customer: [],
  },
  angles: [
    { name: 'a', positioning: 'p', rooted_in: 'r' },
    { name: 'b', positioning: 'p', rooted_in: 'r' },
  ],
  hooks: [
    { text: 'h1', angle_index: 0, lang: 'en' as const },
    { text: 'h2', angle_index: 0, lang: 'he' as const },
    { text: 'h3', angle_index: 1, lang: 'en' as const },
    { text: 'h4', angle_index: 1, lang: 'he' as const },
  ],
  variants: [
    { lang: 'en' as const, primary_text: 't', headline: 'h', hook: 'h1', angle_index: 0 },
    { lang: 'he' as const, primary_text: 't', headline: 'h', hook: 'h2', angle_index: 0 },
  ],
})

Deno.test('isOverCostCap: at/over cap blocks, under allows', () => {
  assertEquals(isOverCostCap(0.5, 0.75), false)
  assertEquals(isOverCostCap(0.75, 0.75), true)
  assertEquals(isOverCostCap(0.9, 0.75), true)
})

Deno.test('selectFewShot: filters by kind+lang, good before bad, respects limit', () => {
  const he = selectFewShot(corpus, 'copy', 'he')
  assertEquals(he.map((e) => e.text), ['he-good-1', 'he-bad-1'])
  assertEquals(he[0].label, 'good')
  assertEquals(selectFewShot(corpus, 'avatar', 'he').map((e) => e.text), ['av-he-good'])
  assertEquals(selectFewShot(corpus, 'copy', 'he', 1).length, 1)
})

Deno.test('shouldRefine: refines on failed principle / compliance, stops at cap', () => {
  assertEquals(shouldRefine(judge(), 0), false)
  const failed = judge({
    principles: [
      { principle: 'product_understanding', verdict: 'fail', reason: 'thin' },
      { principle: 'eye_level_authentic', verdict: 'pass', reason: 'ok' },
      { principle: 'depth_without_exaggeration', verdict: 'pass', reason: 'ok' },
    ],
  })
  assertEquals(shouldRefine(failed, 0), true)
  assertEquals(shouldRefine(judge({ compliance_ok: false }), 0), true)
  assertEquals(shouldRefine(failed, 2), false)
})

Deno.test('buildStageUserMessage: stable pretty JSON', () => {
  assertEquals(buildStageUserMessage({ a: 1 }), '{\n  "a": 1\n}')
})

Deno.test('assembleResponse: all principles pass -> success, confidence 100, no review', () => {
  const out = assembleResponse({ ...baseParts(), judge: judge(), refineIterations: 1 })
  assertEquals(out.confidence_score, 100)
  assertEquals(out.status, 'success')
  assertEquals(out.human_review_required, false)
  assertEquals(out.risks.length, 0)
  assertEquals(out.payload.refine_iterations, 1)
  assertEquals(out.orchestrator_name, 'AdCopyOrchestrator')
})

Deno.test('assembleResponse: one failed principle -> confidence drops, review required', () => {
  const out = assembleResponse({
    ...baseParts(),
    judge: judge({
      principles: [
        { principle: 'product_understanding', verdict: 'fail', reason: 'thin' },
        { principle: 'eye_level_authentic', verdict: 'pass', reason: 'ok' },
        { principle: 'depth_without_exaggeration', verdict: 'pass', reason: 'ok' },
      ],
    }),
    refineIterations: 2,
  })
  assertEquals(out.confidence_score, 67)
  assertEquals(out.human_review_required, true)
  // compliance still ok -> status stays success even with an advisory fail
  assertEquals(out.status, 'success')
})

Deno.test('assembleResponse: compliance miss -> partial status + review + risk', () => {
  const out = assembleResponse({
    ...baseParts(),
    judge: judge({ compliance_ok: false }),
    refineIterations: 0,
  })
  assertEquals(out.status, 'partial')
  assertEquals(out.human_review_required, true)
  assertEquals(out.risks.length, 1)
  assertEquals(out.risks[0].severity, 'high')
})
