import { DecomposeGoal, type TaskDefinition } from "../../src/use-cases/DecomposeGoal"
import type { GoalRepository } from "../../src/use-cases/ports/GoalRepository"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"
import { createGoalId, createTaskId } from "../../src/entities/ids"
import { createGoal } from "../../src/entities/Goal"
import { createBudget } from "../../src/entities/Budget"
import { InMemoryGoalRepo } from "../../src/adapters/storage/InMemoryGoalRepo"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"

function makeGoal(status: "active" | "completed" | "abandoned" = "active") {
  return createGoal({
    id: createGoalId("g1"),
    description: "build feature",
    totalBudget: createBudget({ maxTokens: 5000, maxCostUsd: 5 }),
    status,
  })
}

describe("DecomposeGoal", () => {
  it("creates tasks, updates goal with taskIds, emits task.created for each", async () => {
    const goal = makeGoal()
    const created: ReturnType<typeof import("../../src/entities/Task").createTask>[] = []
    const updatedGoals: ReturnType<typeof createGoal>[] = []
    const emitted: string[] = []

    const goals: GoalRepository = {
      findById: async () => goal,
      create: async () => undefined,
      update: async (g) => { updatedGoals.push(g) },
    }
    const tasks: TaskRepository = {
      findById: async () => null,
      findByGoalId: async () => [],
      create: async (t) => { created.push(t) },
      update: async () => undefined,
    }
    const bus: MessagePort = {
      emit: async (m) => { emitted.push(m.type) },
      subscribe: () => () => undefined,
    }

    const defs: TaskDefinition[] = [
      { id: createTaskId("t1"), description: "write spec", phase: "spec", budget: createBudget({ maxTokens: 500, maxCostUsd: 0.5 }) },
      { id: createTaskId("t2"), description: "implement", phase: "dev", budget: createBudget({ maxTokens: 2000, maxCostUsd: 2 }) },
    ]

    const uc = new DecomposeGoal(goals, tasks, bus)
    const result = await uc.execute(goal.id, defs)

    expect(result.ok).toBe(true)
    expect(created).toHaveLength(2)
    expect(updatedGoals).toHaveLength(1)
    expect(updatedGoals[0].status).toBe("active")
    expect(updatedGoals[0].taskIds).toHaveLength(2)
    expect(emitted.filter(t => t === "task.created")).toHaveLength(2)
  })

  it("returns failure when goal not found", async () => {
    const goals: GoalRepository = {
      findById: async () => null,
      create: async () => undefined,
      update: async () => undefined,
    }
    const tasks: TaskRepository = {
      findById: async () => null,
      findByGoalId: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }
    const bus: MessagePort = {
      emit: async () => undefined,
      subscribe: () => () => undefined,
    }

    const uc = new DecomposeGoal(goals, tasks, bus)
    const result = await uc.execute(createGoalId("missing"), [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not found/i)
  })

  it("returns failure when goal is not active", async () => {
    const goal = makeGoal("completed")
    const goals: GoalRepository = {
      findById: async () => goal,
      create: async () => undefined,
      update: async () => undefined,
    }
    const tasks: TaskRepository = {
      findById: async () => null,
      findByGoalId: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }
    const bus: MessagePort = {
      emit: async () => undefined,
      subscribe: () => () => undefined,
    }

    const uc = new DecomposeGoal(goals, tasks, bus)
    const result = await uc.execute(goal.id, [])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not active/i)
  })
})

describe("DecomposeGoal – Phase 2 enhancements", () => {
  let goalRepo: InMemoryGoalRepo
  let taskRepo: InMemoryTaskRepo
  let bus: MessagePort
  let useCase: DecomposeGoal

  beforeEach(() => {
    goalRepo = new InMemoryGoalRepo()
    taskRepo = new InMemoryTaskRepo()
    bus = {
      emit: jest.fn().mockResolvedValue(undefined),
      subscribe: () => () => undefined,
    }
    useCase = new DecomposeGoal(goalRepo, taskRepo, bus)
  })

  it("creates tasks with correct phases from pipeline config", async () => {
    const goal = createGoal({ id: createGoalId("g-1"), description: "Add auth", status: "active", totalBudget: createBudget({ maxTokens: 50000, maxCostUsd: 5 }) })
    await goalRepo.create(goal)

    const defs: TaskDefinition[] = [
      { id: createTaskId("t-spec"), description: "Write auth spec", phase: "spec", budget: createBudget({ maxTokens: 5000, maxCostUsd: 0.5 }) },
      { id: createTaskId("t-plan"), description: "Design auth flow", phase: "plan", budget: createBudget({ maxTokens: 5000, maxCostUsd: 0.5 }) },
      { id: createTaskId("t-code"), description: "Implement JWT", phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }) },
      { id: createTaskId("t-review"), description: "Review implementation", phase: "review", budget: createBudget({ maxTokens: 5000, maxCostUsd: 0.5 }) },
    ]

    const result = await useCase.execute(createGoalId("g-1"), defs)
    expect(result.ok).toBe(true)

    const specTask = await taskRepo.findById(createTaskId("t-spec"))
    expect(specTask?.phase).toBe("spec")
    const codeTask = await taskRepo.findById(createTaskId("t-code"))
    expect(codeTask?.phase).toBe("code")
  })
})
