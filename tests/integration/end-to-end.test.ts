import { RunAgentLoop } from "@use-cases/RunAgentLoop"
import { CheckBudget } from "@use-cases/CheckBudget"
import { PromptAgent } from "@use-cases/PromptAgent"
import { ExecuteToolCalls } from "@use-cases/ExecuteToolCalls"
import { RecordTurnMetrics } from "@use-cases/RecordTurnMetrics"
import { EvaluateTurnOutcome } from "@use-cases/EvaluateTurnOutcome"
import { DeveloperPlugin } from "@adapters/plugins/agents/DeveloperPlugin"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { InMemoryMetricRecorder } from "@adapters/storage/InMemoryMetricRecorder"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import type { AICompletionProvider, AIToolProvider, AIToolResponse, ToolDefinition } from "@use-cases/ports/AIProvider"
import type { FileSystem } from "@use-cases/ports/FileSystem"
import type { ShellExecutor } from "@use-cases/ports/ShellExecutor"
import type { TokenBudget } from "@entities/Budget"
import type { AgentPrompt } from "@use-cases/ports/AIProvider"
import { createTask } from "@entities/Task"
import { createTaskId, createGoalId, createAgentId, createProjectId, createMessageId } from "@entities/ids"
import { createBudget } from "@entities/Budget"
import type { Message } from "@entities/Message"

// ---------------------------------------------------------------------------
// Mock AI: call 1 → file_write tool call; call 2 → end_turn
// ---------------------------------------------------------------------------
let aiCallCount = 0

const mockAI: AICompletionProvider & AIToolProvider = {
  capabilities: new Set(["tool_use"] as const),

  complete: async (_prompt: AgentPrompt, _budget: TokenBudget) => {
    return {
      content: "done",
      tokensIn: 10,
      tokensOut: 5,
      stopReason: "end_turn" as const,
    }
  },

  completeWithTools: async (
    _prompt: AgentPrompt,
    _tools: ReadonlyArray<ToolDefinition>,
    _budget: TokenBudget,
  ): Promise<AIToolResponse> => {
    aiCallCount++

    if (aiCallCount === 1) {
      // First call: request a file_write
      return {
        content: "",
        toolCalls: [
          {
            id: "call-1",
            name: "file_write",
            input: { path: "output.txt", content: "Hello from DevFleet" },
          },
        ],
        tokensIn: 100,
        tokensOut: 50,
        stopReason: "tool_use" as const,
      }
    }

    // Second call: end turn
    return {
      content: "Task complete.",
      toolCalls: [],
      tokensIn: 80,
      tokensOut: 30,
      stopReason: "end_turn" as const,
    }
  },
}

// ---------------------------------------------------------------------------
// Mock FileSystem: in-memory
// ---------------------------------------------------------------------------
const fileStore = new Map<string, string>()

const mockFs: FileSystem = {
  async read(path: string): Promise<string> {
    const content = fileStore.get(path)
    if (content === undefined) throw new Error(`File not found: ${path}`)
    return content
  },
  async write(path: string, content: string): Promise<void> {
    fileStore.set(path, content)
  },
  async edit(path: string, oldContent: string, newContent: string): Promise<void> {
    const existing = fileStore.get(path) ?? ""
    fileStore.set(path, existing.replace(oldContent, newContent))
  },
  async glob(_pattern: string): Promise<ReadonlyArray<string>> {
    return Array.from(fileStore.keys())
  },
  async exists(path: string): Promise<boolean> {
    return fileStore.has(path)
  },
}

// ---------------------------------------------------------------------------
// Mock ShellExecutor: no-op
// ---------------------------------------------------------------------------
const mockShell: ShellExecutor = {
  async execute(_command: string, _timeout?: number) {
    return { stdout: "", stderr: "", exitCode: 0 }
  },
}

// ---------------------------------------------------------------------------
// Test
// ---------------------------------------------------------------------------
describe("End-to-end integration: Developer agent writes a file", () => {
  const agentId = createAgentId("developer-e2e")
  const projectId = createProjectId("project-e2e")

  let taskRepo: InMemoryTaskRepo
  let metricRecorder: InMemoryMetricRecorder
  let bus: InMemoryBus
  let taskCompletedMessages: Message[]

  beforeEach(() => {
    aiCallCount = 0
    fileStore.clear()

    taskRepo = new InMemoryTaskRepo()
    metricRecorder = new InMemoryMetricRecorder()
    bus = new InMemoryBus()

    taskCompletedMessages = []
    bus.subscribe({ types: ["task.completed"] }, async msg => {
      taskCompletedMessages.push(msg)
    })
  })

  it("writes a file, emits task.completed, and calls AI twice", async () => {
    // Build task
    const taskId = createTaskId("e2e-task-1")
    const task = createTask({
      id: taskId,
      goalId: createGoalId("e2e-goal-1"),
      description: "Write output.txt with a greeting",
      phase: "implementation",
      budget: createBudget({ maxTokens: 50_000, maxCostUsd: 5.0 }),
      status: "in_progress",
      assignedTo: agentId,
      version: 1,
    })
    await taskRepo.create(task)

    // Wire use cases
    const checkBudget = new CheckBudget(taskRepo)
    const promptAgent = new PromptAgent(mockAI, mockAI)
    const executeToolCalls = new ExecuteToolCalls(mockFs, mockShell)
    const recordTurnMetrics = new RecordTurnMetrics(metricRecorder, taskRepo)
    const evaluateTurnOutcome = new EvaluateTurnOutcome(taskRepo, bus)

    const agentExecutor = new RunAgentLoop(
      checkBudget,
      promptAgent,
      executeToolCalls,
      recordTurnMetrics,
      evaluateTurnOutcome,
      taskRepo,
    )

    const devPlugin = new DeveloperPlugin({
      agentId,
      projectId,
      executor: agentExecutor,
      taskRepo,
      systemPrompt: "You are a developer",
      model: "claude-test",
      bus,
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

    // 1. File was written
    expect(fileStore.has("output.txt")).toBe(true)
    expect(fileStore.get("output.txt")).toBe("Hello from DevFleet")

    // 2. task.completed was emitted
    expect(taskCompletedMessages).toHaveLength(1)
    expect(taskCompletedMessages[0]?.type).toBe("task.completed")

    // 3. AI was called exactly twice
    expect(aiCallCount).toBe(2)
  })
})
