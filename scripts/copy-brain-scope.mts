export const COPY_BRAIN_RUNTIME_ORCHESTRATORS = new Set([
  'CopyExcavateProductOrchestrator',
  'CopyAngleOrchestrator',
  'CopyHookOrchestrator',
  'CopyWriteOrchestrator',
  'CopyReaderOrchestrator',
  'CopyCriticOrchestrator',
  'CopyJudgeOrchestrator',
  'CopyDirectorOrchestrator',
  'CopyStorytellingWriterOrchestrator',
  'CopyDirectResponseWriterOrchestrator',
  'CopyProofMechanismWriterOrchestrator',
  'CopyPortfolioJudgeOrchestrator',
])

export const isCopyBrainRuntimeOrchestrator = (name: string | undefined) =>
  Boolean(name && COPY_BRAIN_RUNTIME_ORCHESTRATORS.has(name))
