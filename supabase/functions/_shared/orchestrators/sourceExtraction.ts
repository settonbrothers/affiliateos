import { assertNotPaused } from '../killSwitch.ts'
import { mockSourceExtraction } from '../mockAi.ts'

type SourceExtractionInput = {
  offerId: string
  url: string
  rawText: string
}

// M2 mock implementation. In M3 this becomes a real Haiku 4.5 tool-use call
// that takes rawText and returns extracted facts validated against
// SourceExtractionResponseSchema (per docs/plan/05_AGENT_ROSTER.md).
export async function runSourceExtraction(
  _input: SourceExtractionInput
): Promise<Record<string, unknown>> {
  await assertNotPaused('SourceExtractionOrchestrator')
  return mockSourceExtraction()
}
