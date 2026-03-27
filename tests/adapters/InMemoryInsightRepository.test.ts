import { InMemoryInsightRepository } from "@adapters/storage/InMemoryInsightRepository"
import { createInsight } from "@entities/Insight"
import { createInsightId } from "@entities/ids"

describe("InMemoryInsightRepository", () => {
  it("saves and finds by id", async () => {
    const repo = new InMemoryInsightRepository()
    const insight = createInsight({ id: createInsightId("i-1"), title: "Test", description: "d", evidence: "e", proposedAction: { kind: "process_change", description: "advice" } })
    await repo.save(insight)
    const found = await repo.findById(createInsightId("i-1"))
    expect(found).toEqual(insight)
  })

  it("filters by status", async () => {
    const repo = new InMemoryInsightRepository()
    const i1 = createInsight({ id: createInsightId("i-1"), title: "A", description: "d", evidence: "e", proposedAction: { kind: "process_change", description: "a" } })
    const i2 = { ...createInsight({ id: createInsightId("i-2"), title: "B", description: "d", evidence: "e", proposedAction: { kind: "process_change", description: "b" } }), status: "applied" as const, resolvedAt: new Date() }
    await repo.save(i1)
    await repo.save(i2)
    const pending = await repo.findByStatus("pending")
    expect(pending).toHaveLength(1)
    expect(pending[0]?.title).toBe("A")
  })

  it("updates insight in place", async () => {
    const repo = new InMemoryInsightRepository()
    const insight = createInsight({ id: createInsightId("i-1"), title: "Test", description: "d", evidence: "e", proposedAction: { kind: "process_change", description: "a" } })
    await repo.save(insight)
    await repo.update({ ...insight, status: "dismissed", resolvedAt: new Date() })
    const found = await repo.findById(createInsightId("i-1"))
    expect(found?.status).toBe("dismissed")
  })
})
