import { EvaluateTurnOutcome } from "../../src/use-cases/EvaluateTurnOutcome"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"
import { createTaskId, createGoalId, createAgentId } from "../../src/entities/ids"
import { createTask } from "../../src/entities/Task"
import { createBudget } from "../../src/entities/Budget"
import type { ToolResult } from "../../src/use-cases/ExecuteToolCalls"

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

describe("EvaluateTurnOutcome", () => {
  it("returns success outcome when stopReason is end_turn and no failed tools", async () => {
    const task = makeTask(100, 1000)
    const uc = new EvaluateTurnOutcome(makeTaskRepo(task), noOpBus)

    const result = await uc.execute(task.id, {
      stopReason: "end_turn",
      toolResults: [{ id: "1", name: "file_read", success: true, output: "ok" }],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcome).toBe("success")
    }
  })

  it("returns needs_continuation when stopReason is tool_use", async () => {
    const task = makeTask(100, 1000)
    const uc = new EvaluateTurnOutcome(makeTaskRepo(task), noOpBus)

    const result = await uc.execute(task.id, {
      stopReason: "tool_use",
      toolResults: [],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcome).toBe("needs_continuation")
    }
  })

  it("returns failure when any tool result has success=false", async () => {
    const task = makeTask(100, 1000)
    const uc = new EvaluateTurnOutcome(makeTaskRepo(task), noOpBus)

    const failedTool: ToolResult = { id: "2", name: "shell_run", success: false, output: "", error: "exit 1" }

    const result = await uc.execute(task.id, {
      stopReason: "end_turn",
      toolResults: [failedTool],
    })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcome).toBe("failure")
    }
  })

  it("returns budget_exceeded when task is over budget, and emits budget.exceeded", async () => {
    const task = makeTask(1001, 1000) // over budget
    const emitted: string[] = []
    const bus: MessagePort = {
      emit: async (m) => { emitted.push(m.type) },
      subscribe: () => () => undefined,
    }
    const uc = new EvaluateTurnOutcome(makeTaskRepo(task), bus)

    const result = await uc.execute(task.id, {
      stopReason: "end_turn",
      toolResults: [],
    })

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
    const uc = new EvaluateTurnOutcome(tasks, noOpBus)
    const result = await uc.execute(createTaskId("missing"), { stopReason: "end_turn", toolResults: [] })
    expect(result.ok).toBe(false)
  })
})
