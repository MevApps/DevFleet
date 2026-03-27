// tests/use-cases/AcceptInsight.test.ts
import { AcceptInsight } from "@use-cases/AcceptInsight"
import { InMemoryInsightRepository } from "@adapters/storage/InMemoryInsightRepository"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryBudgetConfigStore } from "@adapters/storage/InMemoryBudgetConfigStore"
import { InMemoryAgentRegistry } from "@adapters/storage/InMemoryAgentRegistry"
import { NoOpNotificationAdapter } from "@adapters/notifications/NoOpNotificationAdapter"
import { createInsight } from "@entities/Insight"
import { createInsightId } from "@entities/ids"
import type { AgentPromptStore } from "@use-cases/ports/AgentPromptStore"
import type { SkillStore } from "@use-cases/ports/SkillStore"

const stubPromptStore: AgentPromptStore = { read: async () => "", update: async () => {} }
const stubSkillStore: SkillStore = { read: async () => "", update: async () => {}, list: async () => [] }

describe("AcceptInsight", () => {
  it("applies budget_tune via BudgetConfigStore and sets status to applied", async () => {
    const insightRepo = new InMemoryInsightRepository()
    const budgetStore = new InMemoryBudgetConfigStore()
    const bus = new InMemoryBus()
    const insight = createInsight({
      id: createInsightId("i-1"), title: "Lower dev budget", description: "d", evidence: "e",
      proposedAction: { kind: "budget_tune", role: "developer", currentMaxTokens: 10000, currentMaxCostUsd: 1.0, newMaxTokens: 7000, newMaxCostUsd: 0.7 },
    })
    await insightRepo.save(insight)
    const uc = new AcceptInsight(insightRepo, stubPromptStore, budgetStore, new InMemoryAgentRegistry(), stubSkillStore, bus, new NoOpNotificationAdapter())
    await uc.execute(createInsightId("i-1"))
    const updated = await insightRepo.findById(createInsightId("i-1"))
    expect(updated?.status).toBe("applied")
    expect(updated?.resolvedAt).not.toBeNull()
    const budget = await budgetStore.read("developer")
    expect(budget.maxTokens).toBe(7000)
  })

  it("throws if insight is not pending", async () => {
    const insightRepo = new InMemoryInsightRepository()
    const insight = { ...createInsight({ id: createInsightId("i-1"), title: "t", description: "d", evidence: "e", proposedAction: { kind: "process_change", description: "a" } }), status: "dismissed" as const, resolvedAt: new Date() }
    await insightRepo.save(insight)
    const uc = new AcceptInsight(insightRepo, stubPromptStore, new InMemoryBudgetConfigStore(), new InMemoryAgentRegistry(), stubSkillStore, new InMemoryBus(), new NoOpNotificationAdapter())
    await expect(uc.execute(createInsightId("i-1"))).rejects.toThrow()
  })
})
