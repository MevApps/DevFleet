// Stub for @anthropic-ai/claude-agent-sdk — used only by tests that don't exercise
// the real SDK (e.g. ClaudeAgentSdkAdapter unit tests that only test mapCapabilities).
export function query(_params: unknown): never {
  throw new Error("claude-agent-sdk stub: query() must not be called in unit tests")
}
