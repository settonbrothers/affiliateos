// M1 stub. The `prompts` table + DB-backed versioning arrive in M3; until then
// this returns a placeholder so orchestrator code can call it with the final
// signature and not change when real prompts land.
export function loadActivePrompt(
  orchestratorName: string,
  _verticalSlug?: string
): Promise<string> {
  return Promise.resolve(
    `You are the ${orchestratorName}. (Placeholder prompt — real prompts load from the DB in M3.)`
  )
}
