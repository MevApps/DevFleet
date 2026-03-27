import { CreateGoalFromCeo } from "../../src/use-cases/CreateGoalFromCeo"
import { InMemoryGoalRepo } from "../../src/adapters/storage/InMemoryGoalRepo"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import type { Message } from "../../src/entities/Message"

describe("CreateGoalFromCeo", () => {
  let goalRepo: InMemoryGoalRepo
  let bus: InMemoryBus
  let useCase: CreateGoalFromCeo

  beforeEach(() => {
    goalRepo = new InMemoryGoalRepo()
    bus = new InMemoryBus()
    useCase = new CreateGoalFromCeo(goalRepo, bus)
  })

  it("creates a goal and emits goal.created", async () => {
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })
    const result = await useCase.execute({ description: "Build login page", maxTokens: 50_000, maxCostUsd: 5.0 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const stored = await goalRepo.findById(result.value.id)
    expect(stored).not.toBeNull()
    expect(stored!.description).toBe("Build login page")
    expect(stored!.status).toBe("active")
    expect(stored!.totalBudget.maxTokens).toBe(50_000)
    expect(emitted).toHaveLength(1)
    expect(emitted[0].type).toBe("goal.created")
    if (emitted[0].type === "goal.created") {
      expect(emitted[0].goalId).toBe(result.value.id)
      expect(emitted[0].description).toBe("Build login page")
    }
  })

  it("rejects empty description", async () => {
    const result = await useCase.execute({ description: "   ", maxTokens: 50_000, maxCostUsd: 5.0 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toContain("description")
  })

  it("rejects zero or negative budget", async () => {
    const result = await useCase.execute({ description: "Valid", maxTokens: 0, maxCostUsd: 5.0 })
    expect(result.ok).toBe(false)
  })
})
