import { InMemoryKeepDiscardRepository } from "@adapters/storage/InMemoryKeepDiscardRepository"
import { createKeepDiscardRecord } from "@entities/KeepDiscardRecord"
import { createTaskId, createGoalId, createAgentId } from "@entities/ids"

function makeRecord(overrides: Record<string, unknown> = {}) {
  return createKeepDiscardRecord({
    taskId: createTaskId(), goalId: createGoalId(), agentId: createAgentId("dev-1"),
    phase: "code", durationMs: 1000, tokensUsed: 500, costUsd: 0.05,
    verdict: "approved", reasons: [], artifactIds: [], commitHash: null, iteration: 1,
    ...overrides,
  })
}

describe("InMemoryKeepDiscardRepository", () => {
  it("saves and retrieves records", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    const record = makeRecord()
    await repo.save(record)
    const all = await repo.findAll()
    expect(all).toHaveLength(1)
    expect(all[0]).toEqual(record)
  })

  it("filters by agentId", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    await repo.save(makeRecord({ agentId: createAgentId("dev-1") }))
    await repo.save(makeRecord({ agentId: createAgentId("dev-2") }))
    const results = await repo.findByAgentId(createAgentId("dev-1"))
    expect(results).toHaveLength(1)
  })

  it("filters by goalId", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    const goalId = createGoalId("g-1")
    await repo.save(makeRecord({ goalId }))
    await repo.save(makeRecord({ goalId: createGoalId("g-2") }))
    const results = await repo.findByGoalId(goalId)
    expect(results).toHaveLength(1)
  })
})
