import { EvaluateOutcome } from "../../src/use-cases/EvaluateOutcome"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"
import { createTaskId, createGoalId, createAgentId } from "../../src/entities/ids"
import { createTask } from "../../src/entities/Task"
import { createBudget } from "../../src/entities/Budget"

function makeTask(tokensUsed = 0, maxTokens = 1000) {
  return createTask({
    id: createTaskId("t1"),
    goalId: createGoalId("g1"),
    description: "test",
    phase: "dev",
    budget: createBudget({ maxTokens, maxCostUsd: 1 }),
    tokensUsed,
    assignedTo: createAgentId("agent-1"),
  })
}

const noOpBus: MessagePort = {
  emit: async () => undefined,
  subscribe: () => () => undefined,
}

const makeTaskRepo = (task: ReturnType<typeof createTask>): TaskRepository => ({
  findById: async () => task,
  findByGoalId: async () => [],
  findAll: async () => [],
  create: async () => undefined,
  update: async () => undefined,
})

describe("EvaluateOutcome", () => {
  it("returns success when session completed normally", async () => {
    const task = makeTask(100, 1000)
    const uc = new EvaluateOutcome(makeTaskRepo(task), noOpBus)

    const result = await uc.execute(task.id, { result: "APPROVED", numTurns: 3 })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcome).toBe("success")
    }
  })

  it("returns budget_exceeded when task is over budget and emits event", async () => {
    const task = makeTask(1001, 1000)
    const emitted: string[] = []
    const bus: MessagePort = {
      emit: async (m) => { emitted.push(m.type) },
      subscribe: () => () => undefined,
    }
    const uc = new EvaluateOutcome(makeTaskRepo(task), bus)

    const result = await uc.execute(task.id, { result: "done", numTurns: 1 })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcome).toBe("budget_exceeded")
    }
    expect(emitted).toContain("budget.exceeded")
  })

  it("returns failure when task not found", async () => {
    const tasks: TaskRepository = {
      findById: async () => null,
      findByGoalId: async () => [],
      findAll: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }
    const uc = new EvaluateOutcome(tasks, noOpBus)
    const result = await uc.execute(createTaskId("missing"), { result: "", numTurns: 0 })
    expect(result.ok).toBe(false)
  })

  it("returns success when session had errors but task is not over budget", async () => {
    const task = makeTask(100, 1000)
    const uc = new EvaluateOutcome(makeTaskRepo(task), noOpBus)

    const result = await uc.execute(task.id, { result: "error occurred", numTurns: 1 })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcome).toBe("success")
    }
  })
})
