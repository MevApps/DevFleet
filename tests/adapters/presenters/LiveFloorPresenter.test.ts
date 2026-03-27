import { LiveFloorPresenter } from "../../../src/adapters/presenters/LiveFloorPresenter"
import { InMemoryAgentRegistry } from "../../../src/adapters/storage/InMemoryAgentRegistry"
import { InMemoryTaskRepo } from "../../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryEventStore } from "../../../src/adapters/storage/InMemoryEventStore"
import { createAgent } from "../../../src/entities/Agent"
import { createTask } from "../../../src/entities/Task"
import { createBudget } from "../../../src/entities/Budget"
import { createAgentId, createTaskId, createGoalId, createEventId } from "../../../src/entities/ids"
import { ROLES } from "../../../src/entities/AgentRole"
import type { SystemEvent } from "../../../src/entities/Event"

describe("LiveFloorPresenter", () => {
  let agentRegistry: InMemoryAgentRegistry
  let taskRepo: InMemoryTaskRepo
  let eventStore: InMemoryEventStore
  let presenter: LiveFloorPresenter

  beforeEach(async () => {
    agentRegistry = new InMemoryAgentRegistry()
    taskRepo = new InMemoryTaskRepo()
    eventStore = new InMemoryEventStore()
    presenter = new LiveFloorPresenter(agentRegistry, taskRepo, eventStore)
    await agentRegistry.register(createAgent({ id: createAgentId("dev-1"), role: ROLES.DEVELOPER, model: "sonnet", status: "busy", currentTaskId: createTaskId("t-1") }))
    await agentRegistry.register(createAgent({ id: createAgentId("rev-1"), role: ROLES.REVIEWER, model: "sonnet", status: "idle" }))
    await taskRepo.create(createTask({ id: createTaskId("t-1"), goalId: createGoalId("g-1"), description: "Implement feature", phase: "code", budget: createBudget({ maxTokens: 10_000, maxCostUsd: 1 }), status: "in_progress" }))
    await taskRepo.create(createTask({ id: createTaskId("t-2"), goalId: createGoalId("g-1"), description: "Done task", phase: "review", budget: createBudget({ maxTokens: 5_000, maxCostUsd: 0.5 }), status: "merged" }))
    const event: SystemEvent = { id: createEventId(), type: "task.assigned", agentId: createAgentId("dev-1"), taskId: createTaskId("t-1"), goalId: createGoalId("g-1"), cost: null, occurredAt: new Date(), payload: null }
    await eventStore.append(event)
  })

  it("assembles LiveFloorDTO with agents, active tasks, and recent events", async () => {
    const dto = await presenter.present()
    expect(dto.agents).toHaveLength(2)
    expect(dto.agents.find(a => a.id === "dev-1")!.status).toBe("busy")
    expect(dto.activeTasks).toHaveLength(1)
    expect(dto.activeTasks[0].id).toBe("t-1")
    expect(dto.recentEvents).toHaveLength(1)
    expect(dto.recentEvents[0].type).toBe("task.assigned")
  })
})
