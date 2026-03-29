import type { AgentSession, PhaseTask, SessionEvent, AgentCapability } from "../../use-cases/ports/AgentSession"

const CAPABILITY_TO_TOOLS: Record<AgentCapability, readonly string[]> = {
  file_access: ["Read", "Write", "Edit", "Glob", "Grep"],
  shell: ["Bash"],
}

export function mapCapabilities(capabilities: ReadonlyArray<AgentCapability>): string[] {
  const tools: string[] = []
  for (const cap of capabilities) {
    const mapped = CAPABILITY_TO_TOOLS[cap]
    if (mapped) {
      tools.push(...mapped)
    }
  }
  return tools
}

export class ClaudeAgentSdkAdapter implements AgentSession {
  async *launch(task: PhaseTask, signal: AbortSignal): AsyncIterable<SessionEvent> {
    // Dynamic import required: the SDK is ESM-only while this project is CJS
    let query: (...args: any[]) => AsyncIterable<any>
    try {
      const mod = await (Function('return import("@anthropic-ai/claude-agent-sdk")')() as Promise<{ query: (...args: any[]) => AsyncIterable<any> }>)
      query = mod.query
    } catch (importErr) {
      console.error("[ClaudeAgentSdkAdapter] SDK import FAILED:", importErr instanceof Error ? importErr.message : importErr)
      yield { type: "error", reason: `SDK import failed: ${importErr instanceof Error ? importErr.message : importErr}` }
      return
    }

    const allowedTools = mapCapabilities(task.capabilities)

    const abortController = new AbortController()
    signal.addEventListener("abort", () => abortController.abort(signal.reason))

    const stream = query({
      prompt: task.taskDescription,
      options: {
        systemPrompt: task.systemPrompt,
        cwd: task.workingDir,
        tools: allowedTools.length > 0 ? allowedTools : [],
        allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
        maxTurns: task.maxTurns,
        model: task.model,
        includePartialMessages: true,
        abortController,
      },
    })

    for await (const message of stream) {
      switch (message.type) {
        case "system":
          if (message.subtype === "init") {
            yield {
              type: "started",
              sessionId: message.session_id,
              model: message.model,
            }
          }
          break

        case "assistant":
          if (message.message?.usage) {
            yield {
              type: "turn_completed",
              tokensIn: message.message.usage.input_tokens ?? 0,
              tokensOut: message.message.usage.output_tokens ?? 0,
            }
          }
          break

        case "result":
          if (message.subtype === "success") {
            yield {
              type: "completed",
              result: message.result,
              totalTokensIn: message.usage.input_tokens,
              totalTokensOut: message.usage.output_tokens,
              durationMs: message.duration_ms,
              numTurns: message.num_turns,
            }
          } else {
            console.error(`[ClaudeAgentSdkAdapter] session FAILED: ${message.subtype}`, message.errors ?? "")
            yield {
              type: "error",
              reason: message.errors?.join("; ") ?? `Session failed: ${message.subtype}`,
            }
          }
          break
      }
    }
  }
}
