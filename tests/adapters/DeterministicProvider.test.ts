import { DeterministicProvider } from "../../src/adapters/ai-providers/DeterministicProvider"
import { createBudget } from "../../src/entities/Budget"

describe("DeterministicProvider", () => {
  it("returns pre-configured tool calls", async () => {
    const provider = new DeterministicProvider([
      { name: "shell_run", input: { command: "npm run build" } },
      { name: "shell_run", input: { command: "npm test" } },
    ])

    expect(provider.capabilities.has("tool_use")).toBe(true)

    const result = await provider.complete(
      { systemPrompt: "", messages: [], model: "deterministic", maxTokens: 1000 },
      createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }),
    )
    expect(result.stopReason).toBe("tool_use")
    expect(result.content).toBe("")
  })

  it("satisfies AICompletionProvider contract", () => {
    const provider = new DeterministicProvider([])
    expect(provider.capabilities).toBeInstanceOf(Set)
    expect(typeof provider.complete).toBe("function")
  })
})
