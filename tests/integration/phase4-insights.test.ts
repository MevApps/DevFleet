import { InMemoryInsightRepository } from "@adapters/storage/InMemoryInsightRepository"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryBudgetConfigStore } from "@adapters/storage/InMemoryBudgetConfigStore"
import { InMemoryAgentRegistry } from "@adapters/storage/InMemoryAgentRegistry"
import { NoOpNotificationAdapter } from "@adapters/notifications/NoOpNotificationAdapter"
import { AcceptInsight } from "@use-cases/AcceptInsight"
import { DismissInsight } from "@use-cases/DismissInsight"
import { createInsight } from "@entities/Insight"
import { createInsightId } from "@entities/ids"
import type { Message } from "@entities/Message"

describe("Phase 4 — Insight lifecycle", () => {
  it("accept insight applies budget change and emits audit message", async () => {
    const insightRepo = new InMemoryInsightRepository()
    const budgetStore = new InMemoryBudgetConfigStore()
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({ types: ["insight.accepted"] }, async (m) => { emitted.push(m) })

    const insight = createInsight({
      id: createInsightId("i-1"), title: "Tune budget", description: "d", evidence: "e",
      proposedAction: { kind: "budget_tune", role: "developer", currentMaxTokens: 10000, currentMaxCostUsd: 1, newMaxTokens: 7000, newMaxCostUsd: 0.7 },
    })
    await insightRepo.save(insight)

    const accept = new AcceptInsight(insightRepo, { read: async () => "", update: async () => {} }, budgetStore, new InMemoryAgentRegistry(), { read: async () => "", update: async () => {}, list: async () => [] }, bus, new NoOpNotificationAdapter())
    await accept.execute(createInsightId("i-1"))

    const updated = await insightRepo.findById(createInsightId("i-1"))
    expect(updated?.status).toBe("applied")
    const budget = await budgetStore.read("developer")
    expect(budget.maxTokens).toBe(7000)
    expect(emitted).toHaveLength(1)
  })

  it("dismiss insight sets status without applying changes", async () => {
    const insightRepo = new InMemoryInsightRepository()
    const insight = createInsight({
      id: createInsightId("i-2"), title: "Bad idea", description: "d", evidence: "e",
      proposedAction: { kind: "process_change", description: "don't" },
    })
    await insightRepo.save(insight)

    const dismiss = new DismissInsight(insightRepo)
    await dismiss.execute(createInsightId("i-2"))

    const updated = await insightRepo.findById(createInsightId("i-2"))
    expect(updated?.status).toBe("dismissed")
  })
})
