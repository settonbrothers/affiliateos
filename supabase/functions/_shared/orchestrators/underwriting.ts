import { mockUnderwriting } from '../mockAi.ts'

export class OrchestratorPausedError extends Error {
  constructor(reason = 'Orchestrator is paused') {
    super(reason)
    this.name = 'OrchestratorPausedError'
  }
}

type UnderwritingInput = {
  offerId: string
}

// M1 mock implementation. In M3 this becomes a real Sonnet 4.6 tool-use call
// validated against UnderwritingResponseSchema (see decisions/002). The kill
// switch check is a stub here and goes live in M2.
export function runUnderwriting(
  _input: UnderwritingInput
): Promise<Record<string, unknown>> {
  return Promise.resolve(mockUnderwriting())
}
