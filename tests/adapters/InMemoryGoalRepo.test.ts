import { InMemoryGoalRepo } from "@adapters/storage/InMemoryGoalRepo"
import { createGoal } from "@entities/Goal"
import { createGoalId } from "@entities/ids"
import { createBudget } from "@entities/Budget"

function makeGoal(overrides: Partial<Parameters<typeof createGoal>[0]> = {}) {
  return createGoal({
    id: createGoalId(),
    description: "Test goal",
    totalBudget: createBudget({ maxTokens: 10000, maxCostUsd: 10.0 }),
    ...overrides,
  })
}

describe("InMemoryGoalRepo", () => {
  let repo: InMemoryGoalRepo

  beforeEach(() => {
    repo = new InMemoryGoalRepo()
  })

  describe("create / findById", () => {
    it("returns null when goal does not exist", async () => {
      const result = await repo.findById(createGoalId("missing"))
      expect(result).toBeNull()
    })

    it("stores and retrieves a goal by id", async () => {
      const goal = makeGoal()
      await repo.create(goal)
      const found = await repo.findById(goal.id)
      expect(found).toEqual(goal)
    })

    it("stores multiple goals independently", async () => {
      const g1 = makeGoal({ description: "Goal 1" })
      const g2 = makeGoal({ description: "Goal 2" })
      await repo.create(g1)
      await repo.create(g2)

      expect(await repo.findById(g1.id)).toEqual(g1)
      expect(await repo.findById(g2.id)).toEqual(g2)
    })
  })

  describe("update", () => {
    it("updates an existing goal", async () => {
      const goal = makeGoal()
      await repo.create(goal)

      const updated = { ...goal, description: "Updated description" }
      await repo.update(updated)

      const found = await repo.findById(goal.id)
      expect(found?.description).toBe("Updated description")
    })

    it("throws when updating a non-existent goal", async () => {
      const goal = makeGoal()
      await expect(repo.update(goal)).rejects.toThrow("not found")
    })

    it("persists status changes", async () => {
      const goal = makeGoal({ status: "active" })
      await repo.create(goal)

      const completed = { ...goal, status: "completed" as const, completedAt: new Date() }
      await repo.update(completed)

      const found = await repo.findById(goal.id)
      expect(found?.status).toBe("completed")
    })
  })

  describe("findAll", () => {
    it("returns empty array when no goals exist", async () => {
      expect(await repo.findAll()).toEqual([])
    })
    it("returns all goals", async () => {
      const g1 = makeGoal({ id: createGoalId("g1"), description: "A" })
      const g2 = makeGoal({ id: createGoalId("g2"), description: "B" })
      await repo.create(g1)
      await repo.create(g2)
      const all = await repo.findAll()
      expect(all).toHaveLength(2)
      expect(all.map(g => g.id)).toEqual(expect.arrayContaining(["g1", "g2"]))
    })
  })
})
