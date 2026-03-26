import { AssignTask } from "../../src/use-cases/AssignTask"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { AgentRegistry } from "../../src/use-cases/ports/AgentRegistry"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"
import { createTaskId, createGoalId, createAgentId } from "../../src/entities/ids"
import { createTask } from "../../src/entities/Task"
import { createAgent } from "../../src/entities/Agent"
import { createBudget } from "../../src/entities/Budget"
import { ROLES } from "../../src/entities/AgentRole"

function makeTask(status: "queued" | "in_progress" = "queued") {
  return createTask({
    id: createTaskId("t1"),
    goalId: createGoalId("g1"),
    description: "implement feature",
    phase: "dev",
    budget: createBudget({ maxTokens: 1000, maxCostUsd: 1 }),
    status,
  })
}

function makeAgent() {
  return createAgent({
    id: createAgentId("agent-1"),
    role: ROLES.DEVELOPER,
    model: "claude-opus-4-5",
  })
}

describe("AssignTask", () => {
  it("assigns a queued task to an available agent and emits task.assigned", async () => {
    const task = makeTask("queued")
    const agent = makeAgent()
    const updated: ReturnType<typeof createTask>[] = []
    const emitted: string[] = []

    const tasks: TaskRepository = {
      findById: async () => task,
      findByGoalId: async () => [],
      create: async () => undefined,
      update: async (t) => { updated.push(t) },
    }

    const registry: AgentRegistry = {
      findAvailable: async () => agent,
      findById: async () => agent,
      register: async () => undefined,
      updateStatus: async () => undefined,
      findAll: async () => [],
    }

    const bus: MessagePort = {
      emit: async (m) => { emitted.push(m.type) },
      subscribe: () => () => undefined,
    }

    const uc = new AssignTask(tasks, registry, bus)
    const result = await uc.execute(task.id, ROLES.DEVELOPER)

    expect(result.ok).toBe(true)
    expect(updated).toHaveLength(1)
    expect(updated[0].status).toBe("in_progress")
    expect(updated[0].assignedTo).toBe(agent.id)
    expect(updated[0].version).toBe(task.version + 1)
    expect(emitted).toContain("task.assigned")
  })

  it("returns failure when task not found", async () => {
    const tasks: TaskRepository = {
      findById: async () => null,
      findByGoalId: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }
    const registry: AgentRegistry = {
      findAvailable: async () => makeAgent(),
      findById: async () => makeAgent(),
      register: async () => undefined,
      updateStatus: async () => undefined,
      findAll: async () => [],
    }
    const bus: MessagePort = {
      emit: async () => undefined,
      subscribe: () => () => undefined,
    }

    const uc = new AssignTask(tasks, registry, bus)
    const result = await uc.execute(createTaskId("missing"), ROLES.DEVELOPER)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not found/i)
  })

  it("returns failure when task is not queued", async () => {
    const task = makeTask("in_progress")
    const tasks: TaskRepository = {
      findById: async () => task,
      findByGoalId: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }
    const registry: AgentRegistry = {
      findAvailable: async () => makeAgent(),
      findById: async () => makeAgent(),
      register: async () => undefined,
      updateStatus: async () => undefined,
      findAll: async () => [],
    }
    const bus: MessagePort = {
      emit: async () => undefined,
      subscribe: () => () => undefined,
    }

    const uc = new AssignTask(tasks, registry, bus)
    const result = await uc.execute(task.id, ROLES.DEVELOPER)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/not queued/i)
  })

  it("returns failure when no agent available", async () => {
    const task = makeTask("queued")
    const tasks: TaskRepository = {
      findById: async () => task,
      findByGoalId: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }
    const registry: AgentRegistry = {
      findAvailable: async () => null,
      findById: async () => null,
      register: async () => undefined,
      updateStatus: async () => undefined,
      findAll: async () => [],
    }
    const bus: MessagePort = {
      emit: async () => undefined,
      subscribe: () => () => undefined,
    }

    const uc = new AssignTask(tasks, registry, bus)
    const result = await uc.execute(task.id, ROLES.DEVELOPER)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.error).toMatch(/no agent/i)
  })
})
