import { PipelinePresenter } from "../../../src/adapters/presenters/PipelinePresenter"
import { InMemoryTaskRepo } from "../../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryGoalRepo } from "../../../src/adapters/storage/InMemoryGoalRepo"
import { createTask } from "../../../src/entities/Task"
import { createGoal } from "../../../src/entities/Goal"
import { createBudget } from "../../../src/entities/Budget"
import { createTaskId, createGoalId } from "../../../src/entities/ids"

describe("PipelinePresenter", () => {
  let taskRepo: InMemoryTaskRepo
  let goalRepo: InMemoryGoalRepo
  let presenter: PipelinePresenter

  beforeEach(async () => {
    taskRepo = new InMemoryTaskRepo()
    goalRepo = new InMemoryGoalRepo()
    presenter = new PipelinePresenter(taskRepo, goalRepo, ["spec", "plan", "code", "test", "review"])
    await goalRepo.create(createGoal({ id: createGoalId("g-1"), description: "Build feature", totalBudget: createBudget({ maxTokens: 50_000, maxCostUsd: 5 }), status: "active", taskIds: [createTaskId("t-1"), createTaskId("t-2")] }))
    await taskRepo.create(createTask({ id: createTaskId("t-1"), goalId: createGoalId("g-1"), description: "Write spec", phase: "spec", budget: createBudget({ maxTokens: 5_000, maxCostUsd: 0.5 }), status: "merged" }))
    await taskRepo.create(createTask({ id: createTaskId("t-2"), goalId: createGoalId("g-1"), description: "Create plan", phase: "plan", budget: createBudget({ maxTokens: 5_000, maxCostUsd: 0.5 }), status: "in_progress" }))
  })

  it("groups tasks by phase", async () => {
    const dto = await presenter.present()
    expect(dto.phases).toEqual(["spec", "plan", "code", "test", "review"])
    expect(dto.tasksByPhase["spec"]).toHaveLength(1)
    expect(dto.tasksByPhase["plan"]).toHaveLength(1)
    expect(dto.tasksByPhase["code"]).toHaveLength(0)
    expect(dto.goals).toHaveLength(1)
    expect(dto.goals[0].id).toBe("g-1")
  })
})
