import { RunAgentSession } from "../../src/use-cases/RunAgentSession"
import { MockAgentSession } from "../../src/adapters/ai-providers/MockAgentSession"
import type { CheckBudget } from "../../src/use-cases/CheckBudget"
import type { RecordTurnMetrics } from "../../src/use-cases/RecordTurnMetrics"
import type { EvaluateOutcome } from "../../src/use-cases/EvaluateOutcome"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"
import type { AgentConfig, AgentEvent } from "../../src/use-cases/ports/AgentExecutor"
import { createTaskId, createGoalId, createAgentId, createProjectId } from "../../src/entities/ids"
import { createTask } from "../../src/entities/Task"
import { createBudget } from "../../src/entities/Budget"
import { ROLES } from "../../src/entities/AgentRole"

const agentId = createAgentId("agent-1")
const projectId = createProjectId("proj-1")

function makeTask() {
  return createTask({
    id: createTaskId("t1"),
    goalId: createGoalId("g1"),
    description: "implement feature",
    phase: "dev",
    budget: createBudget({ maxTokens: 1000, maxCostUsd: 1 }),
    assignedTo: agentId,
  })
}

const agentConfig: AgentConfig = {
  role: ROLES.DEVELOPER,
  systemPrompt: "You are a developer.",
  capabilities: ["file_access", "shell"],
  model: "mock",
  budget: createBudget({ maxTokens: 1000, maxCostUsd: 1 }),
  workingDir: "/tmp/test",
}

function makeMocks(opts: { canProceed?: boolean; outcome?: "success" | "budget_exceeded" } = {}) {
  const task = makeTask()
  const emitted: string[] = []

  const checkBudget = {
    execute: jest.fn().mockResolvedValue({ ok: true, value: { canProceed: opts.canProceed ?? true, remaining: 900, estimatedCost: 100 } }),
  } as unknown as CheckBudget

  const recordTurnMetrics = {
    execute: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
  } as unknown as RecordTurnMetrics

  const evaluateOutcome = {
    execute: jest.fn().mockResolvedValue({ ok: true, value: { outcome: opts.outcome ?? "success" } }),
  } as unknown as EvaluateOutcome

  const tasks: TaskRepository = {
    findById: jest.fn().mockResolvedValue(task),
    findByGoalId: jest.fn().mockResolvedValue([]),
    findAll: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  }

  const bus: MessagePort = {
    emit: async (m) => { emitted.push(m.type) },
    subscribe: () => () => undefined,
  }

  return { task, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus, emitted }
}

async function collectEvents(session: RunAgentSession, task: ReturnType<typeof makeTask>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = []
  for await (const event of session.run(agentId, agentConfig, task, projectId)) {
    events.push(event)
  }
  return events
}

describe("RunAgentSession", () => {
  it("emits turn_completed and task_completed on successful session", async () => {
    const { task, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus } = makeMocks()
    const mockSession = new MockAgentSession()
    const runner = new RunAgentSession(mockSession, checkBudget, recordTurnMetrics, evaluateOutcome, bus)

    const events = await collectEvents(runner, task)

    expect(events.some(e => e.type === "turn_completed")).toBe(true)
    expect(events.some(e => e.type === "task_completed")).toBe(true)
  })

  it("emits budget_exceeded when pre-launch budget check fails", async () => {
    const { task, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus } = makeMocks({ canProceed: false })
    const mockSession = new MockAgentSession()
    const runner = new RunAgentSession(mockSession, checkBudget, recordTurnMetrics, evaluateOutcome, bus)

    const events = await collectEvents(runner, task)

    expect(events.some(e => e.type === "budget_exceeded")).toBe(true)
    expect(events.some(e => e.type === "task_completed")).toBe(false)
  })

  it("records turn metrics from turn_completed events", async () => {
    const { task, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus } = makeMocks()
    const mockSession = new MockAgentSession()
    const runner = new RunAgentSession(mockSession, checkBudget, recordTurnMetrics, evaluateOutcome, bus)

    await collectEvents(runner, task)

    expect(recordTurnMetrics.execute).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({ tokensIn: expect.any(Number), tokensOut: expect.any(Number) }),
    )
  })

  it("calls evaluateOutcome with session result", async () => {
    const { task, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus } = makeMocks()
    const mockSession = new MockAgentSession()
    const runner = new RunAgentSession(mockSession, checkBudget, recordTurnMetrics, evaluateOutcome, bus)

    await collectEvents(runner, task)

    expect(evaluateOutcome.execute).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({ result: expect.any(String), numTurns: expect.any(Number) }),
    )
  })

  it("includes content in task_completed event", async () => {
    const { task, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus } = makeMocks()
    const mockSession = new MockAgentSession()
    const runner = new RunAgentSession(mockSession, checkBudget, recordTurnMetrics, evaluateOutcome, bus)

    const events = await collectEvents(runner, task)

    const completedEvent = events.find(e => e.type === "task_completed")
    expect(completedEvent).toBeDefined()
    expect(completedEvent?.data["content"]).toBeDefined()
  })
})
