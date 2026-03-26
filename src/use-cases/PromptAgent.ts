import type { TokenBudget } from "../entities/Budget"
import type {
  AICompletionProvider,
  AIToolProvider,
  AgentPrompt,
  ToolDefinition,
  ToolCall,
} from "./ports/AIProvider"
import { success, failure, type Result } from "./Result"

export interface PromptResult {
  readonly content: string
  readonly toolCalls: ReadonlyArray<ToolCall>
  readonly tokensIn: number
  readonly tokensOut: number
  readonly stopReason: "end_turn" | "max_tokens" | "tool_use"
}

export class PromptAgent {
  constructor(
    private readonly aiCompletion: AICompletionProvider,
    private readonly aiTool: AIToolProvider,
  ) {}

  async execute(
    prompt: AgentPrompt,
    tools: ReadonlyArray<ToolDefinition>,
    budget: TokenBudget,
  ): Promise<Result<PromptResult>> {
    try {
      const useTools = tools.length > 0 && this.aiCompletion.capabilities.has("tool_use")

      if (useTools) {
        const res = await this.aiTool.completeWithTools(prompt, tools, budget)
        return success({
          content: res.content,
          toolCalls: res.toolCalls,
          tokensIn: res.tokensIn,
          tokensOut: res.tokensOut,
          stopReason: res.stopReason,
        })
      } else {
        const res = await this.aiCompletion.complete(prompt, budget)
        return success({
          content: res.content,
          toolCalls: [],
          tokensIn: res.tokensIn,
          tokensOut: res.tokensOut,
          stopReason: res.stopReason,
        })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return failure(msg)
    }
  }
}
