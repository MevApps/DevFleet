import { DeveloperPlugin } from "@adapters/plugins/agents/DeveloperPlugin"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
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
  let bus: InMemoryBus
  let mockWorktree: {
    create: jest.Mock
    commitAll: jest.Mock
    delete: jest.Mock
    merge: jest.Mock
    exists: jest.Mock
    cleanupAll: jest.Mock
  }
  let plugin: DeveloperPlugin

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo()
    bus = new InMemoryBus()

    // Create an async generator mock
    async function* emptyGen(): AsyncIterable<AgentEvent> {}
    mockExecutor = {
      run: jest.fn().mockReturnValue(emptyGen()),
    }

    mockWorktree = {
      create: jest.fn().mockResolvedValue("/tmp/mock-worktree"),
      delete: jest.fn().mockResolvedValue(undefined),
      merge: jest.fn().mockResolvedValue({ success: true, commit: "abc" }),
      exists: jest.fn().mockResolvedValue(false),
      commitAll: jest.fn().mockResolvedValue(true),
      cleanupAll: jest.fn().mockResolvedValue(undefined),
    }

    plugin = new DeveloperPlugin({
      agentId,
      projectId,
      executor: mockExecutor,
      taskRepo,
      systemPrompt: "You are a developer",
      model: "claude-3-5-sonnet-20241022",
      bus,
      worktreeManager: mockWorktree,
      workspaceDir: "/tmp/workspace",
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
    it("delegates to executor with capabilities and workingDir", async () => {
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
        expect.objectContaining({
          model: "claude-3-5-sonnet-20241022",
          capabilities: ["file_access", "shell"],
          workingDir: "/tmp/mock-worktree",
        }) as AgentConfig,
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
        { type: "text", data: { content: "working..." } },
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

  describe("bus emission", () => {
    it("emits code.completed (not task.completed) when executor completes", async () => {
      const emitted: Message[] = []
      bus.subscribe({}, async (msg) => { emitted.push(msg) })

      const task = makeTask()
      await taskRepo.create(task)

      async function* gen(): AsyncIterable<AgentEvent> {
        yield { type: "task_completed", data: {} }
      }
      mockExecutor.run.mockReturnValue(gen())

      await plugin.handle(makeAssignedMsg(task.id, agentId))

      expect(emitted).toHaveLength(1)
      expect(emitted[0]?.type).toBe("code.completed")
    })
  })
})

describe("DeveloperPlugin – worktree isolation", () => {
  it("creates worktree on task.assigned and sets branch on task", async () => {
    const agentId = createAgentId("dev-wt")
    const projectId = createProjectId("proj-wt")
    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-wt"),
      goalId: createGoalId("g-wt"),
      description: "Worktree task",
      phase: "dev",
      budget: createBudget({ maxTokens: 5000, maxCostUsd: 5.0 }),
      status: "in_progress",
      version: 1,
    })
    await taskRepo.create(task)

    const mockWorktree = {
      create: jest.fn().mockImplementation(async (branch: string) => `/tmp/${branch}`),
      delete: jest.fn().mockResolvedValue(undefined),
      merge: jest.fn().mockResolvedValue({ success: true as const, commit: "abc" }),
      exists: jest.fn().mockResolvedValue(false),
      commitAll: jest.fn().mockResolvedValue(true),
      cleanupAll: jest.fn().mockResolvedValue(undefined),
    }

    async function* emptyGen(): AsyncIterable<AgentEvent> {}
    const mockExecutor: jest.Mocked<AgentExecutor> = { run: jest.fn().mockReturnValue(emptyGen()) }
    const bus = new InMemoryBus()

    const pluginWithWorktree = new DeveloperPlugin({
      agentId,
      projectId,
      executor: mockExecutor,
      taskRepo,
      systemPrompt: "You are a developer",
      model: "claude-3-5-sonnet-20241022",
      bus,
      worktreeManager: mockWorktree,
      workspaceDir: "/tmp/workspace",
    })

    await pluginWithWorktree.handle({
      id: createMessageId(),
      type: "task.assigned",
      taskId: task.id,
      agentId,
      timestamp: new Date(),
    })

    expect(mockWorktree.create).toHaveBeenCalledTimes(1)
    const createdBranch = mockWorktree.create.mock.calls[0]?.[0] as string
    expect(createdBranch).toContain("t-wt")

    const updatedTask = await taskRepo.findById(task.id)
    expect(updatedTask?.branch).toBe(createdBranch)

    // executor is called directly with worktree path as workingDir
    expect(mockExecutor.run).toHaveBeenCalledWith(
      agentId,
      expect.objectContaining({ workingDir: `/tmp/${createdBranch}` }),
      task,
      projectId,
    )
  })

  it("always creates a worktree for every task.assigned handle call", async () => {
    const agentId = createAgentId("dev-always")
    const projectId = createProjectId("proj-always")
    const taskRepo = new InMemoryTaskRepo()
    const bus = new InMemoryBus()

    const mockWorktree = {
      create: jest.fn().mockResolvedValue("/tmp/mock-worktree"),
      delete: jest.fn().mockResolvedValue(undefined),
      merge: jest.fn().mockResolvedValue({ success: true as const, commit: "abc" }),
      exists: jest.fn().mockResolvedValue(false),
      commitAll: jest.fn().mockResolvedValue(true),
      cleanupAll: jest.fn().mockResolvedValue(undefined),
    }

    async function* emptyGen(): AsyncIterable<AgentEvent> {}
    const mockExecutor: jest.Mocked<AgentExecutor> = { run: jest.fn().mockReturnValue(emptyGen()) }

    const plugin = new DeveloperPlugin({
      agentId,
      projectId,
      executor: mockExecutor,
      taskRepo,
      systemPrompt: "You are a developer",
      model: "claude-3-5-sonnet-20241022",
      bus,
      worktreeManager: mockWorktree,
      workspaceDir: "/tmp/workspace",
    })

    // Handle two separate tasks
    for (const suffix of ["a", "b"]) {
      const t = createTask({
        id: createTaskId(`t-${suffix}`),
        goalId: createGoalId("g1"),
        description: `Task ${suffix}`,
        phase: "dev",
        budget: createBudget({ maxTokens: 1000, maxCostUsd: 1.0 }),
        status: "in_progress",
        version: 1,
      })
      await taskRepo.create(t)
      mockExecutor.run.mockReturnValue(emptyGen())
      await plugin.handle({ id: createMessageId(), type: "task.assigned", taskId: t.id, agentId, timestamp: new Date() })
    }

    expect(mockWorktree.create).toHaveBeenCalledTimes(2)
  })
})
