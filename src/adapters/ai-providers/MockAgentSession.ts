import type { AgentSession, PhaseTask, SessionEvent } from "../../use-cases/ports/AgentSession"

export class MockAgentSession implements AgentSession {
  async *launch(task: PhaseTask, _signal: AbortSignal): AsyncIterable<SessionEvent> {
    const startTime = Date.now()

    yield { type: "started", sessionId: `mock-${Date.now()}`, model: "mock" }

    const tokensIn = 10
    const tokensOut = 20

    yield { type: "turn_completed", tokensIn, tokensOut }

    const result = this.generateResponse(task.systemPrompt)

    yield {
      type: "completed",
      result,
      totalTokensIn: tokensIn,
      totalTokensOut: tokensOut,
      durationMs: Date.now() - startTime,
      numTurns: 1,
    }
  }

  private generateResponse(systemPrompt: string): string {
    const lower = systemPrompt.toLowerCase()

    if (lower.includes("decompose") || lower.includes("supervisor")) {
      return JSON.stringify([
        { description: "Write requirement spec", phase: "spec" },
        { description: "Create implementation plan", phase: "plan" },
        { description: "Implement the feature", phase: "code" },
        { description: "Run build and tests", phase: "test" },
        { description: "Review the implementation", phase: "review" },
      ])
    }

    if (lower.includes("product") || lower.includes("requirement")) {
      return "# Requirement Spec\n\n1. The system shall implement the requested feature.\n\nSuccess Criteria:\n- Feature works as described"
    }

    if (lower.includes("architect") || lower.includes("plan")) {
      return "# Implementation Plan\n\n## Step 1: Create module\nCreate the main module.\n\n## Step 2: Add tests\nAdd unit tests."
    }

    if (lower.includes("developer") || lower.includes("implement")) {
      return "Implementation complete. Created the requested feature with tests."
    }

    if (lower.includes("review") || lower.includes("evaluate")) {
      return "APPROVED - Code meets requirements and follows best practices."
    }

    return "Task completed successfully."
  }
}
