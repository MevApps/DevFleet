import { RunAgentSession } from "@use-cases/RunAgentSession"
import { CheckBudget } from "@use-cases/CheckBudget"
import { RecordTurnMetrics } from "@use-cases/RecordTurnMetrics"
import { EvaluateOutcome } from "@use-cases/EvaluateOutcome"
import { DeveloperPlugin } from "@adapters/plugins/agents/DeveloperPlugin"
import { MockAgentSession } from "@adapters/ai-providers/MockAgentSession"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { InMemoryMetricRecorder } from "@adapters/storage/InMemoryMetricRecorder"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { createTask } from "@entities/Task"
import { createTaskId, createGoalId, createAgentId, createProjectId, createMessageId } from "@entities/ids"
import { createBudget } from "@entities/Budget"
import type { Message } from "@entities/Message"

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------
describe("End-to-end integration: Developer agent completes a task", () => {
  const agentId = createAgentId("developer-e2e")
  const projectId = createProjectId("project-e2e")

  let taskRepo: InMemoryTaskRepo
  let metricRecorder: InMemoryMetricRecorder
  let bus: InMemoryBus
  let codeCompletedMessages: Message[]

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo()
    metricRecorder = new InMemoryMetricRecorder()
    bus = new InMemoryBus()

    codeCompletedMessages = []
    bus.subscribe({ types: ["code.completed"] }, async msg => {
      codeCompletedMessages.push(msg)
    })
  })

  it("completes a task via MockAgentSession and emits code.completed", async () => {
    // Build task
    const taskId = createTaskId("e2e-task-1")
    const task = createTask({
      id: taskId,
      goalId: createGoalId("e2e-goal-1"),
      description: "Implement a greeting feature",
      phase: "implementation",
      budget: createBudget({ maxTokens: 50_000, maxCostUsd: 5.0 }),
      status: "in_progress",
      assignedTo: agentId,
      version: 1,
    })
    await taskRepo.create(task)

    // Wire use cases with MockAgentSession
    const mockSession = new MockAgentSession()
    const checkBudget = new CheckBudget(taskRepo)
    const recordTurnMetrics = new RecordTurnMetrics(metricRecorder, taskRepo)
    const evaluateOutcome = new EvaluateOutcome(taskRepo, bus)

    const agentExecutor = new RunAgentSession(
      mockSession, checkBudget, recordTurnMetrics, evaluateOutcome, bus,
    )

    const mockWorktree = {
      create: jest.fn().mockResolvedValue("/tmp/integration-worktree"),
      commitAll: jest.fn().mockResolvedValue(true),
      delete: jest.fn().mockResolvedValue(undefined),
      merge: jest.fn().mockResolvedValue({ success: true as const, commit: "abc" }),
      exists: jest.fn().mockResolvedValue(false),
      cleanupAll: jest.fn().mockResolvedValue(undefined),
    }

    const devPlugin = new DeveloperPlugin({
      agentId,
      projectId,
      executor: agentExecutor,
      taskRepo,
      systemPrompt: "You are a developer",
      model: "claude-test",
      bus,
      worktreeManager: mockWorktree,
      projectDir: "/tmp/test-project",
    })

    // Trigger via task.assigned message
    await devPlugin.handle({
      id: createMessageId(),
      type: "task.assigned",
      taskId,
      agentId,
      timestamp: new Date(),
    })

    // Wait for async processing
    await new Promise<void>(resolve => setTimeout(resolve, 100))

    // code.completed was emitted (DeveloperPlugin emits code.completed)
    expect(codeCompletedMessages).toHaveLength(1)
    expect(codeCompletedMessages[0]?.type).toBe("code.completed")
  })
})
