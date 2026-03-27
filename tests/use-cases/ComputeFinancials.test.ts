import { ComputeFinancials } from "@use-cases/ComputeFinancials"
import { InMemoryEventStore } from "@adapters/storage/InMemoryEventStore"
import { createEventId, createGoalId, createAgentId } from "@entities/ids"
import type { SystemEvent } from "@entities/Event"

function makeEvent(goalId: string, agentId: string, tokens: number, cost: number): SystemEvent {
  return {
    id: createEventId(), type: "task.completed", agentId: createAgentId(agentId),
    taskId: null, goalId: createGoalId(goalId),
    cost: { inputTokens: tokens, outputTokens: 0, totalTokens: tokens, estimatedCostUsd: cost },
    occurredAt: new Date(), payload: {},
  }
}

describe("ComputeFinancials", () => {
  it("aggregates total tokens and cost across events", async () => {
    const eventStore = new InMemoryEventStore()
    await eventStore.append(makeEvent("g1", "dev-1", 100, 0.01))
    await eventStore.append(makeEvent("g1", "dev-2", 200, 0.02))
    const uc = new ComputeFinancials(eventStore)
    const report = await uc.execute()
    expect(report.totalTokensUsed).toBe(300)
    expect(report.totalCostUsd).toBeCloseTo(0.03)
  })

  it("computes cost per goal", async () => {
    const eventStore = new InMemoryEventStore()
    await eventStore.append(makeEvent("g1", "dev-1", 100, 0.01))
    await eventStore.append(makeEvent("g2", "dev-1", 200, 0.02))
    const uc = new ComputeFinancials(eventStore)
    const report = await uc.execute()
    expect(report.costPerGoal).toHaveLength(2)
    const g1 = report.costPerGoal.find(c => c.goalId === createGoalId("g1"))
    expect(g1?.costUsd).toBeCloseTo(0.01)
  })

  it("computes agent token breakdown", async () => {
    const eventStore = new InMemoryEventStore()
    await eventStore.append(makeEvent("g1", "dev-1", 100, 0.01))
    await eventStore.append(makeEvent("g1", "dev-1", 50, 0.005))
    await eventStore.append(makeEvent("g1", "rev-1", 200, 0.02))
    const uc = new ComputeFinancials(eventStore)
    const report = await uc.execute()
    expect(report.agentTokenBreakdown["dev-1"]).toBe(150)
    expect(report.agentTokenBreakdown["rev-1"]).toBe(200)
  })
})
