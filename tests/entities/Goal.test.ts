import { createGoal } from "../../src/entities/Goal"
import { createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("Goal entity", () => {
  test("createGoal sets defaults", () => {
    const goal = createGoal({
      id: createGoalId("g-1"),
      description: "Build a new feature",
      totalBudget: createBudget({ maxTokens: 10000, maxCostUsd: 10.0 }),
    })
    expect(goal.status).toBe("proposed")
    expect(goal.completedAt).toBeNull()
    expect(goal.taskIds).toEqual([])
    expect(goal.createdAt).toBeInstanceOf(Date)
  })

  test("createGoal uses provided values", () => {
    const createdAt = new Date("2024-01-01")
    const goal = createGoal({
      id: createGoalId("g-2"),
      description: "Another goal",
      totalBudget: createBudget({ maxTokens: 5000, maxCostUsd: 5.0 }),
      createdAt,
    })
    expect(goal.createdAt).toBe(createdAt)
  })
})
