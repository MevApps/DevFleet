export type AgentCapability = "file_access" | "shell"

export interface PhaseTask {
  readonly systemPrompt: string
  readonly taskDescription: string
  readonly workingDir: string
  readonly capabilities: ReadonlyArray<AgentCapability>
  readonly maxTurns?: number
  readonly model?: string
}

export type SessionEvent =
  | { readonly type: "started"; readonly sessionId: string; readonly model: string }
  | { readonly type: "text"; readonly content: string }
  | { readonly type: "turn_completed"; readonly tokensIn: number; readonly tokensOut: number }
  | { readonly type: "completed"; readonly result: string; readonly totalTokensIn: number; readonly totalTokensOut: number; readonly durationMs: number; readonly numTurns: number }
  | { readonly type: "error"; readonly reason: string }
  | { type: "tool_call"; tool: string; target: string }

export interface AgentSession {
  launch(task: PhaseTask, signal: AbortSignal): AsyncIterable<SessionEvent>
}
