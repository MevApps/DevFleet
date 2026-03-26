import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { VersionConflictError } from "@use-cases/ports/TaskRepository"
import { createTask } from "@entities/Task"
import { createTaskId, createGoalId } from "@entities/ids"
import { createBudget } from "@entities/Budget"

function makeTask(overrides: Partial<Parameters<typeof createTask>[0]> = {}) {
  return createTask({
    id: createTaskId(),
    goalId: createGoalId(),
    description: "Test task",
    phase: "dev",
    budget: createBudget({ maxTokens: 1000, maxCostUsd: 1.0 }),
    version: 1,
    ...overrides,
  })
}

describe("InMemoryTaskRepo", () => {
  let repo: InMemoryTaskRepo

  beforeEach(() => {
    repo = new InMemoryTaskRepo()
  })

  describe("create / findById", () => {
    it("returns null when task does not exist", async () => {
      const result = await repo.findById(createTaskId("missing"))
      expect(result).toBeNull()
    })

    it("stores and retrieves a task by id", async () => {
      const task = makeTask()
      await repo.create(task)
      const found = await repo.findById(task.id)
      expect(found).toEqual(task)
    })
  })

  describe("findByGoalId", () => {
    it("returns empty array when no tasks for goal", async () => {
      const results = await repo.findByGoalId(createGoalId("g1"))
      expect(results).toHaveLength(0)
    })

    it("returns only tasks matching the given goalId", async () => {
      const goalId = createGoalId("goal-a")
      const t1 = makeTask({ goalId })
      const t2 = makeTask({ goalId })
      const t3 = makeTask({ goalId: createGoalId("goal-b") })

      await repo.create(t1)
      await repo.create(t2)
      await repo.create(t3)

      const results = await repo.findByGoalId(goalId)
      expect(results).toHaveLength(2)
      expect(results.map(t => t.id)).toContain(t1.id)
      expect(results.map(t => t.id)).toContain(t2.id)
    })
  })

  describe("update with version check", () => {
    it("updates a task when version is incremented by 1", async () => {
      const task = makeTask({ version: 1 })
      await repo.create(task)

      const updated = { ...task, description: "Updated", version: 2 }
      await repo.update(updated)

      const found = await repo.findById(task.id)
      expect(found?.description).toBe("Updated")
      expect(found?.version).toBe(2)
    })

    it("throws VersionConflictError when version does not match", async () => {
      const task = makeTask({ version: 1 })
      await repo.create(task)

      const stale = { ...task, description: "Stale update", version: 3 }
      await expect(repo.update(stale)).rejects.toThrow(VersionConflictError)
    })

    it("throws VersionConflictError with correct taskId", async () => {
      const task = makeTask({ version: 1 })
      await repo.create(task)

      const stale = { ...task, version: 5 }
      await expect(repo.update(stale)).rejects.toMatchObject({
        taskId: task.id,
      })
    })

    it("throws when updating a non-existent task", async () => {
      const task = makeTask({ version: 2 })
      await expect(repo.update(task)).rejects.toThrow("not found")
    })
  })
})
