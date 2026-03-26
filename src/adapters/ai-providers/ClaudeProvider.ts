import Anthropic from "@anthropic-ai/sdk"
import type { TokenBudget } from "../../entities/Budget"
import type {
  AICapability,
  AICompletionProvider,
  AIToolProvider,
  AgentPrompt,
  AIResponse,
  AIToolResponse,
  ToolDefinition,
  ToolCall,
} from "../../use-cases/ports/AIProvider"

const CLAUDE_CAPABILITIES: ReadonlySet<AICapability> = new Set<AICapability>([
  "tool_use",
  "vision",
  "streaming",
  "json_mode",
  "extended_context",
])

export class ClaudeProvider implements AICompletionProvider, AIToolProvider {
  readonly capabilities: ReadonlySet<AICapability> = CLAUDE_CAPABILITIES

  private readonly client: Anthropic

  constructor(apiKey?: string) {
    this.client = new Anthropic({ apiKey })
  }

  async complete(prompt: AgentPrompt, _budget: TokenBudget): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: prompt.model,
      max_tokens: prompt.maxTokens,
      system: prompt.systemPrompt,
      messages: prompt.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
    })

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map(b => b.text)
      .join("")

    const stopReason = this.mapStopReason(response.stop_reason)

    return {
      content,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      stopReason,
    }
  }

  async completeWithTools(
    prompt: AgentPrompt,
    tools: ReadonlyArray<ToolDefinition>,
    _budget: TokenBudget,
  ): Promise<AIToolResponse> {
    const response = await this.client.messages.create({
      model: prompt.model,
      max_tokens: prompt.maxTokens,
      system: prompt.systemPrompt,
      messages: prompt.messages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      tools: tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool["input_schema"],
      })),
    })

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map(b => b.text)
      .join("")

    const toolCalls: ToolCall[] = response.content
      .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
      .map(block => ({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      }))

    const stopReason = this.mapStopReason(response.stop_reason)

    return {
      content,
      toolCalls,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      stopReason,
    }
  }

  private mapStopReason(
    reason: string | null,
  ): "end_turn" | "max_tokens" | "tool_use" {
    if (reason === "tool_use") return "tool_use"
    if (reason === "max_tokens") return "max_tokens"
    return "end_turn"
  }
}
