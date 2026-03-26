import type {
  AICompletionProvider,
  AIToolProvider,
  AICapability,
  AgentPrompt,
  AIResponse,
  AIToolResponse,
  ToolDefinition,
  ToolCall,
} from "../../use-cases/ports/AIProvider"
import type { TokenBudget } from "../../entities/Budget"

interface DeterministicToolCall {
  readonly name: string
  readonly input: Record<string, unknown>
}

export class DeterministicProvider implements AICompletionProvider, AIToolProvider {
  readonly capabilities: ReadonlySet<AICapability> = new Set(["tool_use"])
  private callIndex = 0

  constructor(private readonly toolCalls: readonly DeterministicToolCall[]) {}

  async complete(_prompt: AgentPrompt, _budget: TokenBudget): Promise<AIResponse> {
    // Return tool_use stop reason so RunAgentLoop will call completeWithTools
    return {
      content: "",
      tokensIn: 0,
      tokensOut: 0,
      stopReason: this.toolCalls.length > 0 ? "tool_use" : "end_turn",
    }
  }

  async completeWithTools(
    _prompt: AgentPrompt,
    _tools: ReadonlyArray<ToolDefinition>,
    _budget: TokenBudget,
  ): Promise<AIToolResponse> {
    if (this.callIndex >= this.toolCalls.length) {
      return { content: "done", toolCalls: [], tokensIn: 0, tokensOut: 0, stopReason: "end_turn" }
    }

    const call = this.toolCalls[this.callIndex]!
    this.callIndex++

    const toolCall: ToolCall = {
      id: `det-${this.callIndex}`,
      name: call.name,
      input: call.input,
    }

    return {
      content: "",
      toolCalls: [toolCall],
      tokensIn: 0,
      tokensOut: 0,
      stopReason: this.callIndex < this.toolCalls.length ? "tool_use" : "end_turn",
    }
  }

  /** Reset the call index (useful for re-running in tests) */
  reset(): void {
    this.callIndex = 0
  }
}
