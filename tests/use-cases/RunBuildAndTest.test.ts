import { RunBuildAndTest } from "../../src/use-cases/RunBuildAndTest"
import type { ShellExecutor } from "../../src/use-cases/ports/ShellExecutor"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { RecordTurnMetrics } from "../../src/use-cases/RecordTurnMetrics"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"
import { createTaskId, createGoalId, createAgentId } from "../../src/entities/ids"
import { createTask } from "../../src/entities/Task"
import { createBudget } from "../../src/entities/Budget"

function makeTask() {
  return createTask({
    id: createTaskId("t1"),
    goalId: createGoalId("g1"),
    description: "run build and test",
    phase: "test",
    budget: createBudget({ maxTokens: 1000, maxCostUsd: 1 }),
    assignedTo: createAgentId("ops-1"),
  })
}

function makeMocks(shellResults: { stdout: string; stderr: string; exitCode: number }[]) {
  let callIndex = 0
  const emitted: Array<{ type: string }> = []

  const shell: ShellExecutor = {
    execute: jest.fn().mockImplementation(async () => {
      const result = shellResults[callIndex] ?? { stdout: "", stderr: "", exitCode: 1 }
      callIndex++
      return result
    }),
  }

  const tasks: TaskRepository = {
    findById: jest.fn().mockResolvedValue(makeTask()),
    findByGoalId: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  }

  const recordTurnMetrics = {
    execute: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
  } as unknown as RecordTurnMetrics

  const bus: MessagePort = {
    emit: async (m) => { emitted.push({ type: m.type }) },
    subscribe: () => () => undefined,
  }

  return { shell, tasks, recordTurnMetrics, bus, emitted }
}

describe("RunBuildAndTest", () => {
  it("runs build and test commands and returns success", async () => {
    const { shell, tasks, recordTurnMetrics, bus, emitted } = makeMocks([
      { stdout: "Build OK", stderr: "", exitCode: 0 },
      { stdout: "10 passed, 0 failed", stderr: "", exitCode: 0 },
    ])
    const uc = new RunBuildAndTest(shell, tasks, recordTurnMetrics, bus)
    const task = makeTask()

    const result = await uc.execute(task.id, "npm run build", "npm test")

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.buildOutput).toBe("Build OK")
      expect(result.value.testOutput).toBe("10 passed, 0 failed")
    }
    expect(emitted.some(e => e.type === "build.passed")).toBe(true)
    expect(emitted.some(e => e.type === "test.passed")).toBe(true)
  })

  it("returns failure and emits build.failed when build fails", async () => {
    const { shell, tasks, recordTurnMetrics, bus, emitted } = makeMocks([
      { stdout: "", stderr: "compile error", exitCode: 1 },
    ])
    const uc = new RunBuildAndTest(shell, tasks, recordTurnMetrics, bus)
    const task = makeTask()

    const result = await uc.execute(task.id, "npm run build", "npm test")

    expect(result.ok).toBe(false)
    expect(emitted.some(e => e.type === "build.failed")).toBe(true)
    expect(emitted.some(e => e.type === "test.passed")).toBe(false)
  })

  it("returns failure and emits test.failed when tests fail", async () => {
    const { shell, tasks, recordTurnMetrics, bus, emitted } = makeMocks([
      { stdout: "Build OK", stderr: "", exitCode: 0 },
      { stdout: "3 passed, 2 failed", stderr: "", exitCode: 1 },
    ])
    const uc = new RunBuildAndTest(shell, tasks, recordTurnMetrics, bus)
    const task = makeTask()

    const result = await uc.execute(task.id, "npm run build", "npm test")

    expect(result.ok).toBe(false)
    expect(emitted.some(e => e.type === "build.passed")).toBe(true)
    expect(emitted.some(e => e.type === "test.failed")).toBe(true)
  })
})
