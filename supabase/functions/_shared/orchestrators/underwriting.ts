import { assertNotPaused } from '../killSwitch.ts'
import { mockUnderwriting } from '../mockAi.ts'

// Re-export so existing callers that imported OrchestratorPausedError from this
// module keep working; the canonical definition now lives in ../killSwitch.ts.
export { OrchestratorPausedError } from '../killSwitch.ts'

type UnderwritingInput = {
  offerId: string
}

// M1 mock implementation. In M3 this becomes a real Sonnet 4.6 tool-use call
// validated against UnderwritingResponseSchema (see decisions/002).
export async function runUnderwriting(
  _input: UnderwritingInput
): Promise<Record<string, unknown>> {
  await assertNotPaused('UnderwritingOrchestrator')
  return mockUnderwriting()
}
