import { DeveloperPlugin, DEVELOPER_TOOLS } from "@adapters/plugins/agents/DeveloperPlugin"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import type { AgentExecutor, AgentEvent, AgentConfig } from "@use-cases/ports/AgentExecutor"
import type { Task } from "@entities/Task"
import { createTask } from "@entities/Task"
import { createTaskId, createGoalId, createAgentId, createProjectId } from "@entities/ids"
import { createBudget } from "@entities/Budget"
import type { Message } from "@entities/Message"
import { createMessageId } from "@entities/ids"

function makeTask(): Task {
  return createTask({
    id: createTaskId("t1"),
    goalId: createGoalId("g1"),
    description: "Implement feature X",
    phase: "dev",
    budget: createBudget({ maxTokens: 5000, maxCostUsd: 5.0 }),
    status: "in_progress",
    version: 1,
  })
}

function makeAssignedMsg(taskId: ReturnType<typeof createTaskId>, agentId: ReturnType<typeof createAgentId>): Message {
  return {
    id: createMessageId(),
    type: "task.assigned",
    taskId,
    agentId,
    timestamp: new Date(),
  }
}

describe("DeveloperPlugin", () => {
  const agentId = createAgentId("dev-1")
  const projectId = createProjectId("proj-1")

  let taskRepo: InMemoryTaskRepo
  let mockExecutor: jest.Mocked<AgentExecutor>
  let plugin: DeveloperPlugin

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo()

    // Create an async generator mock
    async function* emptyGen(): AsyncIterable<AgentEvent> {}
    mockExecutor = {
      run: jest.fn().mockReturnValue(emptyGen()),
    }

    plugin = new DeveloperPlugin({
      agentId,
      projectId,
      executor: mockExecutor,
      taskRepo,
      systemPrompt: "You are a developer",
      model: "claude-3-5-sonnet-20241022",
    })
  })

  describe("identity", () => {
    it("has a unique id incorporating agentId", () => {
      expect(plugin.id).toContain("dev-1")
    })

    it("has correct name, version, and description", () => {
      expect(plugin.name).toBe("developer-agent")
      expect(plugin.version).toBe("1.0.0")
      expect(typeof plugin.description).toBe("string")
    })
  })

  describe("subscriptions", () => {
    it("subscribes to task.assigned", () => {
      const subs = plugin.subscriptions()
      expect(subs).toHaveLength(1)
      expect(subs[0]?.types).toContain("task.assigned")
    })
  })

  describe("handle", () => {
    it("delegates to executor when message is for this agent", async () => {
      const task = makeTask()
      await taskRepo.create(task)

      async function* gen(): AsyncIterable<AgentEvent> {
        yield { type: "task_completed", data: {} }
      }
      mockExecutor.run.mockReturnValue(gen())

      const msg = makeAssignedMsg(task.id, agentId)
      await plugin.handle(msg)

      expect(mockExecutor.run).toHaveBeenCalledTimes(1)
      expect(mockExecutor.run).toHaveBeenCalledWith(
        agentId,
        expect.objectContaining({ model: "claude-3-5-sonnet-20241022" }) as AgentConfig,
        task,
        projectId,
      )
    })

    it("ignores task.assigned for a different agent", async () => {
      const task = makeTask()
      await taskRepo.create(task)

      const otherId = createAgentId("other-agent")
      const msg = makeAssignedMsg(task.id, otherId)
      await plugin.handle(msg)

      expect(mockExecutor.run).not.toHaveBeenCalled()
    })

    it("ignores messages for non-existent tasks", async () => {
      const msg = makeAssignedMsg(createTaskId("no-such-task"), agentId)
      await plugin.handle(msg)

      expect(mockExecutor.run).not.toHaveBeenCalled()
    })

    it("does nothing when message type is not task.assigned", async () => {
      const msg: Message = {
        id: createMessageId(),
        type: "goal.created",
        goalId: createGoalId("g1"),
        description: "A goal",
        timestamp: new Date(),
      }
      await plugin.handle(msg)

      expect(mockExecutor.run).not.toHaveBeenCalled()
    })

    it("consumes the entire iterator returned by executor", async () => {
      const task = makeTask()
      await taskRepo.create(task)

      const events: AgentEvent[] = [
        { type: "turn_completed", data: { turn: 1 } },
        { type: "tool_executed", data: { toolName: "file_write" } },
        { type: "task_completed", data: {} },
      ]
      const consumed: AgentEvent[] = []

      async function* trackingGen(): AsyncIterable<AgentEvent> {
        for (const event of events) {
          consumed.push(event)
          yield event
        }
      }
      mockExecutor.run.mockReturnValue(trackingGen())

      await plugin.handle(makeAssignedMsg(task.id, agentId))

      expect(consumed).toHaveLength(3)
    })
  })

  describe("DEVELOPER_TOOLS", () => {
    it("defines the five expected tools", () => {
      const names = DEVELOPER_TOOLS.map(t => t.name)
      expect(names).toContain("file_read")
      expect(names).toContain("file_write")
      expect(names).toContain("file_edit")
      expect(names).toContain("file_glob")
      expect(names).toContain("shell_run")
    })
  })

  describe("lifecycle", () => {
    it("start resolves without error", async () => {
      await expect(plugin.start()).resolves.toBeUndefined()
    })

    it("stop resolves without error", async () => {
      await expect(plugin.stop()).resolves.toBeUndefined()
    })

    it("healthCheck returns healthy", async () => {
      expect(await plugin.healthCheck()).toBe("healthy")
    })
  })
})
