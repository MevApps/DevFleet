import { RunAgentLoop } from "../../src/use-cases/RunAgentLoop"
import type { CheckBudget } from "../../src/use-cases/CheckBudget"
import type { PromptAgent } from "../../src/use-cases/PromptAgent"
import type { ExecuteToolCalls } from "../../src/use-cases/ExecuteToolCalls"
import type { RecordTurnMetrics } from "../../src/use-cases/RecordTurnMetrics"
import type { EvaluateTurnOutcome } from "../../src/use-cases/EvaluateTurnOutcome"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
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
  tools: [],
  model: "claude-opus-4-5",
  budget: createBudget({ maxTokens: 1000, maxCostUsd: 1 }),
}

function makeMocks(opts: {
  canProceed?: boolean
  stopReason?: "end_turn" | "tool_use"
  outcome?: "success" | "budget_exceeded" | "needs_continuation" | "failure"
  taskLookupCount?: { count: number }
} = {}) {
  const task = makeTask()

  const checkBudget = {
    execute: jest.fn().mockResolvedValue({ ok: true, value: { canProceed: opts.canProceed ?? true, remaining: 900, estimatedCost: 100 } }),
  } as unknown as CheckBudget

  const promptAgent = {
    execute: jest.fn().mockResolvedValue({
      ok: true,
      value: {
        content: "I have done the task.",
        toolCalls: [],
        tokensIn: 50,
        tokensOut: 30,
        stopReason: opts.stopReason ?? "end_turn",
      },
    }),
  } as unknown as PromptAgent

  const executeToolCalls = {
    execute: jest.fn().mockResolvedValue([]),
  } as unknown as ExecuteToolCalls

  const recordTurnMetrics = {
    execute: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
  } as unknown as RecordTurnMetrics

  const evaluateTurnOutcome = {
    execute: jest.fn().mockResolvedValue({ ok: true, value: { outcome: opts.outcome ?? "success" } }),
  } as unknown as EvaluateTurnOutcome

  const tasks: TaskRepository = {
    findById: jest.fn().mockResolvedValue(task),
    findByGoalId: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
  }

  return { task, checkBudget, promptAgent, executeToolCalls, recordTurnMetrics, evaluateTurnOutcome, tasks }
}

async function collectEvents(loop: RunAgentLoop, task: ReturnType<typeof makeTask>): Promise<AgentEvent[]> {
  const events: AgentEvent[] = []
  for await (const event of loop.run(agentId, agentConfig, task, projectId)) {
    events.push(event)
  }
  return events
}

describe("RunAgentLoop", () => {
  it("emits turn_completed and then task_completed on successful single turn", async () => {
    const { task, checkBudget, promptAgent, executeToolCalls, recordTurnMetrics, evaluateTurnOutcome, tasks } = makeMocks()
    const loop = new RunAgentLoop(checkBudget, promptAgent, executeToolCalls, recordTurnMetrics, evaluateTurnOutcome, tasks)

    const events = await collectEvents(loop, task)

    expect(events.some(e => e.type === "turn_completed")).toBe(true)
    expect(events.some(e => e.type === "task_completed")).toBe(true)
    expect(events.some(e => e.type === "task_failed")).toBe(false)
  })

  it("emits budget_exceeded when budget check fails (canProceed=false)", async () => {
    const { task, checkBudget, promptAgent, executeToolCalls, recordTurnMetrics, evaluateTurnOutcome, tasks } = makeMocks({ canProceed: false })
    const loop = new RunAgentLoop(checkBudget, promptAgent, executeToolCalls, recordTurnMetrics, evaluateTurnOutcome, tasks)

    const events = await collectEvents(loop, task)

    expect(events.some(e => e.type === "budget_exceeded")).toBe(true)
    expect(events.some(e => e.type === "task_completed")).toBe(false)
  })

  it("loops on needs_continuation and eventually completes", async () => {
    const task = makeTask()
    let callCount = 0

    const checkBudget = {
      execute: jest.fn().mockResolvedValue({ ok: true, value: { canProceed: true, remaining: 900, estimatedCost: 100 } }),
    } as unknown as CheckBudget

    const promptAgent = {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        value: { content: "continuing", toolCalls: [], tokensIn: 50, tokensOut: 30, stopReason: "end_turn" },
      }),
    } as unknown as PromptAgent

    const executeToolCalls = {
      execute: jest.fn().mockResolvedValue([]),
    } as unknown as ExecuteToolCalls

    const recordTurnMetrics = {
      execute: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
    } as unknown as RecordTurnMetrics

    const evaluateTurnOutcome = {
      execute: jest.fn().mockImplementation(async () => {
        callCount++
        if (callCount < 3) {
          return { ok: true, value: { outcome: "needs_continuation" } }
        }
        return { ok: true, value: { outcome: "success" } }
      }),
    } as unknown as EvaluateTurnOutcome

    const tasks: TaskRepository = {
      findById: jest.fn().mockResolvedValue(task),
      findByGoalId: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    }

    const loop = new RunAgentLoop(checkBudget, promptAgent, executeToolCalls, recordTurnMetrics, evaluateTurnOutcome, tasks)
    const events = await collectEvents(loop, task)

    const turnCompleted = events.filter(e => e.type === "turn_completed")
    expect(turnCompleted.length).toBe(3)
    expect(events.some(e => e.type === "task_completed")).toBe(true)
  })

  it("stops after MAX_TURNS and emits task_failed", async () => {
    const task = makeTask()

    const checkBudget = {
      execute: jest.fn().mockResolvedValue({ ok: true, value: { canProceed: true, remaining: 900, estimatedCost: 100 } }),
    } as unknown as CheckBudget

    const promptAgent = {
      execute: jest.fn().mockResolvedValue({
        ok: true,
        value: { content: "still going", toolCalls: [], tokensIn: 10, tokensOut: 5, stopReason: "end_turn" },
      }),
    } as unknown as PromptAgent

    const executeToolCalls = {
      execute: jest.fn().mockResolvedValue([]),
    } as unknown as ExecuteToolCalls

    const recordTurnMetrics = {
      execute: jest.fn().mockResolvedValue({ ok: true, value: undefined }),
    } as unknown as RecordTurnMetrics

    // Always needs_continuation → will hit MAX_TURNS
    const evaluateTurnOutcome = {
      execute: jest.fn().mockResolvedValue({ ok: true, value: { outcome: "needs_continuation" } }),
    } as unknown as EvaluateTurnOutcome

    const tasks: TaskRepository = {
      findById: jest.fn().mockResolvedValue(task),
      findByGoalId: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    }

    const loop = new RunAgentLoop(checkBudget, promptAgent, executeToolCalls, recordTurnMetrics, evaluateTurnOutcome, tasks)
    const events = await collectEvents(loop, task)

    expect(events.some(e => e.type === "task_failed")).toBe(true)
    const failedEvent = events.find(e => e.type === "task_failed")
    expect(failedEvent?.data["reason"]).toMatch(/max turns/i)
  }, 10000)
})
