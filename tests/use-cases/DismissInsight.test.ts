// tests/use-cases/DismissInsight.test.ts
import { DismissInsight } from "@use-cases/DismissInsight"
import { InMemoryInsightRepository } from "@adapters/storage/InMemoryInsightRepository"
import { createInsight } from "@entities/Insight"
import { createInsightId } from "@entities/ids"

describe("DismissInsight", () => {
  it("sets status to dismissed with resolvedAt", async () => {
    const repo = new InMemoryInsightRepository()
    await repo.save(createInsight({ id: createInsightId("i-1"), title: "t", description: "d", evidence: "e", proposedAction: { kind: "process_change", description: "a" } }))
    const uc = new DismissInsight(repo)
    await uc.execute(createInsightId("i-1"))
    const found = await repo.findById(createInsightId("i-1"))
    expect(found?.status).toBe("dismissed")
    expect(found?.resolvedAt).not.toBeNull()
  })
})
