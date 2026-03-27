import { RecordTurnMetrics } from "../../src/use-cases/RecordTurnMetrics"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { MetricRecorder } from "../../src/use-cases/ports/MetricRecorder"
import type { Metric } from "../../src/entities/Metric"
import { createTaskId, createGoalId, createAgentId } from "../../src/entities/ids"
import { createTask } from "../../src/entities/Task"
import { createBudget } from "../../src/entities/Budget"

function makeTask(tokensUsed = 0) {
  return createTask({
    id: createTaskId("t1"),
    goalId: createGoalId("g1"),
    description: "test",
    phase: "dev",
    budget: createBudget({ maxTokens: 1000, maxCostUsd: 1 }),
    tokensUsed,
    assignedTo: createAgentId("agent-1"),
  })
}

describe("RecordTurnMetrics", () => {
  it("records tokens_in, tokens_out, turn_duration_ms metrics and updates task.tokensUsed", async () => {
    const task = makeTask(100)
    const recorded: Metric[] = []
    const updated: ReturnType<typeof createTask>[] = []

    const recorder: MetricRecorder = {
      record: async (m) => { recorded.push(m) },
      findByTaskId: async () => [],
      findByAgentId: async () => [],
      findAll: async () => [],
    }

    const tasks: TaskRepository = {
      findById: async () => task,
      findByGoalId: async () => [],
      findAll: async () => [],
      create: async () => undefined,
      update: async (t) => { updated.push(t) },
    }

    const uc = new RecordTurnMetrics(recorder, tasks)
    const result = await uc.execute(task.id, {
      tokensIn: 50,
      tokensOut: 30,
      durationMs: 1200,
    })

    expect(result.ok).toBe(true)
    expect(recorded).toHaveLength(3)

    const names = recorded.map(m => m.name)
    expect(names).toContain("tokens_in")
    expect(names).toContain("tokens_out")
    expect(names).toContain("turn_duration_ms")

    expect(updated).toHaveLength(1)
    expect(updated[0].tokensUsed).toBe(180) // 100 + 50 + 30
  })

  it("returns failure when task not found", async () => {
    const recorder: MetricRecorder = {
      record: async () => undefined,
      findByTaskId: async () => [],
      findByAgentId: async () => [],
      findAll: async () => [],
    }
    const tasks: TaskRepository = {
      findById: async () => null,
      findByGoalId: async () => [],
      findAll: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }

    const uc = new RecordTurnMetrics(recorder, tasks)
    const result = await uc.execute(createTaskId("missing"), { tokensIn: 10, tokensOut: 5, durationMs: 100 })
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not found/i)
  })

  it("stores agentId on metrics when task is assigned", async () => {
    const task = makeTask(0)
    const recorded: Metric[] = []

    const recorder: MetricRecorder = {
      record: async (m) => { recorded.push(m) },
      findByTaskId: async () => [],
      findByAgentId: async () => [],
      findAll: async () => [],
    }
    const tasks: TaskRepository = {
      findById: async () => task,
      findByGoalId: async () => [],
      findAll: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }

    const uc = new RecordTurnMetrics(recorder, tasks)
    await uc.execute(task.id, { tokensIn: 10, tokensOut: 5, durationMs: 100 })

    expect(recorded.every(m => m.agentId === task.assignedTo)).toBe(true)
  })
})
