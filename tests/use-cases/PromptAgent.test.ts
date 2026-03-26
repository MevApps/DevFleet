import { PromptAgent } from "../../src/use-cases/PromptAgent"
import type { AICompletionProvider, AIToolProvider, AgentPrompt, ToolDefinition } from "../../src/use-cases/ports/AIProvider"
import { createBudget } from "../../src/entities/Budget"

const budget = createBudget({ maxTokens: 1000, maxCostUsd: 1 })

const prompt: AgentPrompt = {
  systemPrompt: "You are a developer agent.",
  messages: [{ role: "user", content: "Write hello world" }],
  model: "claude-opus-4-5",
  maxTokens: 100,
}

const tools: ToolDefinition[] = [
  { name: "file_read", description: "Read a file", inputSchema: { type: "object", properties: { path: { type: "string" } } } },
]

describe("PromptAgent", () => {
  it("uses completeWithTools when tools provided and AI has tool_use capability", async () => {
    let toolCallCount = 0
    let completionCallCount = 0

    const aiCompletion: AICompletionProvider = {
      complete: async () => {
        completionCallCount++
        return { content: "done", tokensIn: 10, tokensOut: 5, stopReason: "end_turn" }
      },
      capabilities: new Set(["tool_use"] as const),
    }

    const aiTool: AIToolProvider = {
      completeWithTools: async () => {
        toolCallCount++
        return { content: "done with tools", toolCalls: [], tokensIn: 10, tokensOut: 5, stopReason: "end_turn" }
      },
    }

    const uc = new PromptAgent(aiCompletion, aiTool)
    const result = await uc.execute(prompt, tools, budget)

    expect(result.ok).toBe(true)
    expect(toolCallCount).toBe(1)
    expect(completionCallCount).toBe(0)
    if (result.ok) {
      expect(result.value.content).toBe("done with tools")
    }
  })

  it("falls back to complete when AI does not have tool_use capability", async () => {
    let completionCallCount = 0

    const aiCompletion: AICompletionProvider = {
      complete: async () => {
        completionCallCount++
        return { content: "fallback", tokensIn: 10, tokensOut: 5, stopReason: "end_turn" }
      },
      capabilities: new Set([]),
    }

    const aiTool: AIToolProvider = {
      completeWithTools: async () => {
        return { content: "tools", toolCalls: [], tokensIn: 10, tokensOut: 5, stopReason: "end_turn" }
      },
    }

    const uc = new PromptAgent(aiCompletion, aiTool)
    const result = await uc.execute(prompt, tools, budget)

    expect(result.ok).toBe(true)
    expect(completionCallCount).toBe(1)
    if (result.ok) {
      expect(result.value.content).toBe("fallback")
      expect(result.value.toolCalls).toEqual([])
    }
  })

  it("falls back to complete when no tools provided", async () => {
    let completionCallCount = 0

    const aiCompletion: AICompletionProvider = {
      complete: async () => {
        completionCallCount++
        return { content: "no tools", tokensIn: 10, tokensOut: 5, stopReason: "end_turn" }
      },
      capabilities: new Set(["tool_use"] as const),
    }

    const aiTool: AIToolProvider = {
      completeWithTools: async () => {
        return { content: "with tools", toolCalls: [], tokensIn: 10, tokensOut: 5, stopReason: "end_turn" }
      },
    }

    const uc = new PromptAgent(aiCompletion, aiTool)
    const result = await uc.execute(prompt, [], budget)

    expect(result.ok).toBe(true)
    expect(completionCallCount).toBe(1)
  })

  it("returns failure when AI throws", async () => {
    const aiCompletion: AICompletionProvider = {
      complete: async () => { throw new Error("AI error") },
      capabilities: new Set([]),
    }
    const aiTool: AIToolProvider = {
      completeWithTools: async () => { throw new Error("AI error") },
    }

    const uc = new PromptAgent(aiCompletion, aiTool)
    const result = await uc.execute(prompt, [], budget)

    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("AI error")
  })
})
