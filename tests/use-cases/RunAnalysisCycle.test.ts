// tests/use-cases/RunAnalysisCycle.test.ts
import { RunAnalysisCycle } from "@use-cases/RunAnalysisCycle"
import { InMemoryInsightRepository } from "@adapters/storage/InMemoryInsightRepository"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryKeepDiscardRepository } from "@adapters/storage/InMemoryKeepDiscardRepository"
import { InMemoryEventStore } from "@adapters/storage/InMemoryEventStore"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { InMemoryBudgetConfigStore } from "@adapters/storage/InMemoryBudgetConfigStore"
import { InMemoryAgentRegistry } from "@adapters/storage/InMemoryAgentRegistry"
import { NoOpNotificationAdapter } from "@adapters/notifications/NoOpNotificationAdapter"
import { ComputeFinancials } from "@use-cases/ComputeFinancials"
import { ComputeQualityMetrics } from "@use-cases/ComputeQualityMetrics"
import { ComputePhaseTimings } from "@use-cases/ComputePhaseTimings"
import type { AICompletionProvider, AgentPrompt, AIResponse } from "@use-cases/ports/AIProvider"
import type { TokenBudget } from "@entities/Budget"

const mockAI: AICompletionProvider = {
  capabilities: new Set(),
  async complete(_prompt: AgentPrompt, _budget: TokenBudget): Promise<AIResponse> {
    return {
      content: JSON.stringify([{
        title: "Lower dev budget",
        description: "Dev consistently underuses budget",
        evidence: "Avg usage 30%",
        confidence: "high",
        proposedAction: { kind: "budget_tune", role: "developer", newMaxTokens: 7000, newMaxCostUsd: 0.7 },
      }]),
      tokensIn: 100, tokensOut: 50, stopReason: "end_turn",
    }
  },
}

describe("RunAnalysisCycle", () => {
  it("creates Insight entities from AI response", async () => {
    const eventStore = new InMemoryEventStore()
    const insightRepo = new InMemoryInsightRepository()
    const uc = new RunAnalysisCycle(
      mockAI, "system prompt", "opus",
      new ComputeFinancials(eventStore),
      new ComputeQualityMetrics(new InMemoryKeepDiscardRepository()),
      new ComputePhaseTimings(eventStore, new InMemoryTaskRepo()),
      insightRepo, new NoOpNotificationAdapter(), new InMemoryBus(),
      { read: async () => "prompt", update: async () => {} },
      new InMemoryBudgetConfigStore(),
      new InMemoryAgentRegistry(),
      { read: async () => "skill", update: async () => {}, list: async () => [] },
    )
    await uc.execute()
    const insights = await insightRepo.findAll()
    expect(insights).toHaveLength(1)
    expect(insights[0]?.title).toBe("Lower dev budget")
    expect(insights[0]?.status).toBe("pending")
    expect(insights[0]?.proposedAction.kind).toBe("budget_tune")
  })

  it("handles empty AI response gracefully", async () => {
    const emptyAI: AICompletionProvider = {
      capabilities: new Set(),
      async complete(): Promise<AIResponse> {
        return { content: "[]", tokensIn: 10, tokensOut: 5, stopReason: "end_turn" }
      },
    }
    const insightRepo = new InMemoryInsightRepository()
    const eventStore = new InMemoryEventStore()
    const uc = new RunAnalysisCycle(
      emptyAI, "system prompt", "opus",
      new ComputeFinancials(eventStore),
      new ComputeQualityMetrics(new InMemoryKeepDiscardRepository()),
      new ComputePhaseTimings(eventStore, new InMemoryTaskRepo()),
      insightRepo, new NoOpNotificationAdapter(), new InMemoryBus(),
      { read: async () => "prompt", update: async () => {} },
      new InMemoryBudgetConfigStore(),
      new InMemoryAgentRegistry(),
      { read: async () => "skill", update: async () => {}, list: async () => [] },
    )
    await uc.execute()
    expect(await insightRepo.findAll()).toHaveLength(0)
  })

  it("handles malformed AI response without crashing", async () => {
    const badAI: AICompletionProvider = {
      capabilities: new Set(),
      async complete(): Promise<AIResponse> {
        return { content: "not json at all", tokensIn: 10, tokensOut: 5, stopReason: "end_turn" }
      },
    }
    const insightRepo = new InMemoryInsightRepository()
    const eventStore = new InMemoryEventStore()
    const uc = new RunAnalysisCycle(
      badAI, "system prompt", "opus",
      new ComputeFinancials(eventStore),
      new ComputeQualityMetrics(new InMemoryKeepDiscardRepository()),
      new ComputePhaseTimings(eventStore, new InMemoryTaskRepo()),
      insightRepo, new NoOpNotificationAdapter(), new InMemoryBus(),
      { read: async () => "prompt", update: async () => {} },
      new InMemoryBudgetConfigStore(),
      new InMemoryAgentRegistry(),
      { read: async () => "skill", update: async () => {}, list: async () => [] },
    )
    await uc.execute()
    expect(await insightRepo.findAll()).toHaveLength(0)
  })
})
