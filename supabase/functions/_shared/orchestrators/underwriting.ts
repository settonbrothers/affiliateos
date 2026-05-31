import { assertNotPaused } from '../killSwitch.ts'
import { mockUnderwriting, type UnderwritingFactInput } from '../mockAi.ts'

// Re-export so existing callers that imported OrchestratorPausedError from this
// module keep working; the canonical definition now lives in ../killSwitch.ts.
export { OrchestratorPausedError } from '../killSwitch.ts'

type UnderwritingInput = {
  offerId: string
  facts?: UnderwritingFactInput[]
}

// M1 mock implementation. In M3 this becomes a real Sonnet 4.6 tool-use call
// validated against UnderwritingResponseSchema (see decisions/002). Facts are
// the offer's *verified* extracted_facts and shape the envelope + verdict.
export async function runUnderwriting(
  input: UnderwritingInput
): Promise<Record<string, unknown>> {
  await assertNotPaused('UnderwritingOrchestrator')
  return mockUnderwriting(input.facts ?? [])
}
