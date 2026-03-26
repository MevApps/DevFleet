import type { TokenBudget } from "../../entities/Budget"

export type AICapability = "tool_use" | "vision" | "streaming" | "json_mode" | "extended_context"

export interface AgentPrompt {
  readonly systemPrompt: string
  readonly messages: ReadonlyArray<{ readonly role: "user" | "assistant"; readonly content: string }>
  readonly model: string
  readonly maxTokens: number
}

export interface AIResponse {
  readonly content: string
  readonly tokensIn: number
  readonly tokensOut: number
  readonly stopReason: "end_turn" | "max_tokens" | "tool_use"
}

export interface ToolDefinition {
  readonly name: string
  readonly description: string
  readonly inputSchema: Record<string, unknown>
}

export interface ToolCall {
  readonly id: string
  readonly name: string
  readonly input: Record<string, unknown>
}

export interface AIToolResponse {
  readonly content: string
  readonly toolCalls: ReadonlyArray<ToolCall>
  readonly tokensIn: number
  readonly tokensOut: number
  readonly stopReason: "end_turn" | "max_tokens" | "tool_use"
}

export interface AICompletionProvider {
  complete(prompt: AgentPrompt, budget: TokenBudget): Promise<AIResponse>
  readonly capabilities: ReadonlySet<AICapability>
}

export interface AIToolProvider {
  completeWithTools(prompt: AgentPrompt, tools: ReadonlyArray<ToolDefinition>, budget: TokenBudget): Promise<AIToolResponse>
}
