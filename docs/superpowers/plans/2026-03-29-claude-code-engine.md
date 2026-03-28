# Claude Code Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Anthropic API with the Claude Agent SDK so the engine runs on the Max plan with zero API costs.

**Architecture:** New `AgentSession` port replaces `AICompletionProvider`/`AIToolProvider`. `ClaudeAgentSdkAdapter` wraps the SDK. `RunAgentSession` replaces `RunAgentLoop` for LLM agents. `RunBuildAndTest` replaces the deterministic Ops path. Pipeline orchestration (Supervisor, plugins, keep/discard) is untouched.

**Tech Stack:** TypeScript, `@anthropic-ai/claude-agent-sdk`, Express 5, Jest 30

**Spec:** `docs/superpowers/specs/2026-03-29-claude-code-engine-design.md`

---

## File Structure

### New files
| File | Responsibility |
|---|---|
| `src/use-cases/ports/AgentSession.ts` | Port: `AgentSession`, `PhaseTask`, `SessionEvent`, `AgentCapability` |
| `src/use-cases/RunAgentSession.ts` | Use case: launch session, iterate stream, record metrics, abort on budget |
| `src/use-cases/RunBuildAndTest.ts` | Use case: run build + test shell commands directly |
| `src/use-cases/EvaluateOutcome.ts` | Use case: evaluate session result (replaces `EvaluateTurnOutcome`) |
| `src/adapters/ai-providers/ClaudeAgentSdkAdapter.ts` | Adapter: implements `AgentSession`, wraps SDK `query()` |
| `src/adapters/ai-providers/MockAgentSession.ts` | Mock: implements `AgentSession` for test/demo mode |
| `tests/use-cases/RunAgentSession.test.ts` | Tests for `RunAgentSession` |
| `tests/use-cases/RunBuildAndTest.test.ts` | Tests for `RunBuildAndTest` |
| `tests/use-cases/EvaluateOutcome.test.ts` | Tests for `EvaluateOutcome` |
| `tests/adapters/ClaudeAgentSdkAdapter.test.ts` | Tests for adapter (SDK mocked) |
| `tests/adapters/MockAgentSession.test.ts` | Tests for mock session |

### Deleted files
| File | Reason |
|---|---|
| `src/use-cases/ports/AIProvider.ts` | Old port, no consumers after Ops cleanup |
| `src/use-cases/ports/ScopedExecutorFactory.ts` | Scoping moves to `PhaseTask.workingDir` |
| `src/use-cases/PromptAgent.ts` | No remaining consumers |
| `src/use-cases/ExecuteToolCalls.ts` | Claude Code handles tools |
| `src/use-cases/RunAgentLoop.ts` | Replaced by `RunAgentSession` |
| `src/use-cases/EvaluateTurnOutcome.ts` | Replaced by `EvaluateOutcome` |
| `src/entities/Conversation.ts` | Claude Code manages conversation |
| `src/adapters/ai-providers/ClaudeProvider.ts` | Replaced by `ClaudeAgentSdkAdapter` |
| `src/adapters/ai-providers/DeterministicProvider.ts` | Ops uses `RunBuildAndTest` |
| `tests/use-cases/PromptAgent.test.ts` | Source deleted |
| `tests/use-cases/ExecuteToolCalls.test.ts` | Source deleted |
| `tests/use-cases/RunAgentLoop.test.ts` | Source deleted |
| `tests/use-cases/EvaluateTurnOutcome.test.ts` | Source deleted |
| `tests/adapters/DeterministicProvider.test.ts` | Source deleted |

### Modified files
| File | What changes |
|---|---|
| `src/use-cases/ports/AgentExecutor.ts` | `AgentConfig.tools` → `capabilities`, remove `ToolDefinition` import |
| `src/adapters/plugins/agents/DeveloperPlugin.ts` | Remove `DEVELOPER_TOOLS`, `ScopedExecutorFactory`; pass `workingDir` via config |
| `src/adapters/plugins/agents/ReviewerPlugin.ts` | Remove `REVIEWER_TOOLS`, `ToolDefinition` import; use capabilities |
| `src/adapters/plugins/agents/OpsPlugin.ts` | Use `RunBuildAndTest` instead of `AgentExecutor` |
| `src/adapters/plugins/agents/SupervisorPlugin.ts` | Replace `PromptAgent` with `AgentSession` for decomposition |
| `src/infrastructure/config/composition-root.ts` | Full rewire |
| `src/use-cases/WorkspaceRunManager.ts` | Remove `apiKey`, use `mockMode` |
| `package.json` | Swap `@anthropic-ai/sdk` → `@anthropic-ai/claude-agent-sdk` |
| `tests/adapters/DeveloperPlugin.test.ts` | Update to new config shape |
| `tests/adapters/ReviewerPlugin.test.ts` | Update to new config shape |
| `tests/adapters/OpsPlugin.test.ts` | Update to use `RunBuildAndTest` |
| `tests/adapters/SupervisorPlugin.test.ts` | Update to use `AgentSession` |
| `tests/integration/end-to-end.test.ts` | Update to new wiring |
| `tests/use-cases/WorkspaceRunManager.test.ts` | Remove `apiKey` references |

---

### Task 1: Swap npm Dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Remove old SDK, add new SDK**

```bash
npm uninstall @anthropic-ai/sdk
npm install @anthropic-ai/claude-agent-sdk
```

- [ ] **Step 2: Verify install succeeded**

Run: `ls node_modules/@anthropic-ai/claude-agent-sdk/package.json`
Expected: File exists

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: swap @anthropic-ai/sdk for @anthropic-ai/claude-agent-sdk"
```

---

### Task 2: New Port — `AgentSession`

**Files:**
- Create: `src/use-cases/ports/AgentSession.ts`

- [ ] **Step 1: Create the port file with all types**

```typescript
// src/use-cases/ports/AgentSession.ts

export type AgentCapability = "file_access" | "shell"

export interface PhaseTask {
  readonly systemPrompt: string
  readonly taskDescription: string
  readonly workingDir: string
  readonly capabilities: ReadonlyArray<AgentCapability>
  readonly maxTurns?: number
  readonly model?: string
}

export type SessionEvent =
  | { readonly type: "started"; readonly sessionId: string; readonly model: string }
  | { readonly type: "text"; readonly content: string }
  | { readonly type: "turn_completed"; readonly tokensIn: number; readonly tokensOut: number }
  | { readonly type: "completed"; readonly result: string; readonly totalTokensIn: number; readonly totalTokensOut: number; readonly durationMs: number; readonly numTurns: number }
  | { readonly type: "error"; readonly reason: string }

export interface AgentSession {
  launch(task: PhaseTask, signal: AbortSignal): AsyncIterable<SessionEvent>
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `npx tsc --noEmit src/use-cases/ports/AgentSession.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add src/use-cases/ports/AgentSession.ts
git commit -m "feat: add AgentSession port with PhaseTask and SessionEvent types"
```

---

### Task 3: `EvaluateOutcome` Use Case

**Files:**
- Create: `src/use-cases/EvaluateOutcome.ts`
- Create: `tests/use-cases/EvaluateOutcome.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/use-cases/EvaluateOutcome.test.ts
import { EvaluateOutcome } from "../../src/use-cases/EvaluateOutcome"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"
import { createTaskId, createGoalId, createAgentId } from "../../src/entities/ids"
import { createTask } from "../../src/entities/Task"
import { createBudget } from "../../src/entities/Budget"

function makeTask(tokensUsed = 0, maxTokens = 1000) {
  return createTask({
    id: createTaskId("t1"),
    goalId: createGoalId("g1"),
    description: "test",
    phase: "dev",
    budget: createBudget({ maxTokens, maxCostUsd: 1 }),
    tokensUsed,
    assignedTo: createAgentId("agent-1"),
  })
}

const noOpBus: MessagePort = {
  emit: async () => undefined,
  subscribe: () => () => undefined,
}

const makeTaskRepo = (task: ReturnType<typeof createTask>): TaskRepository => ({
  findById: async () => task,
  findByGoalId: async () => [],
  findAll: async () => [],
  create: async () => undefined,
  update: async () => undefined,
})

describe("EvaluateOutcome", () => {
  it("returns success when session completed normally", async () => {
    const task = makeTask(100, 1000)
    const uc = new EvaluateOutcome(makeTaskRepo(task), noOpBus)

    const result = await uc.execute(task.id, { result: "APPROVED", numTurns: 3 })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcome).toBe("success")
    }
  })

  it("returns budget_exceeded when task is over budget and emits event", async () => {
    const task = makeTask(1001, 1000)
    const emitted: string[] = []
    const bus: MessagePort = {
      emit: async (m) => { emitted.push(m.type) },
      subscribe: () => () => undefined,
    }
    const uc = new EvaluateOutcome(makeTaskRepo(task), bus)

    const result = await uc.execute(task.id, { result: "done", numTurns: 1 })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcome).toBe("budget_exceeded")
    }
    expect(emitted).toContain("budget.exceeded")
  })

  it("returns failure when task not found", async () => {
    const tasks: TaskRepository = {
      findById: async () => null,
      findByGoalId: async () => [],
      findAll: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }
    const uc = new EvaluateOutcome(tasks, noOpBus)
    const result = await uc.execute(createTaskId("missing"), { result: "", numTurns: 0 })
    expect(result.ok).toBe(false)
  })

  it("returns success when session had errors but task is not over budget", async () => {
    const task = makeTask(100, 1000)
    const uc = new EvaluateOutcome(makeTaskRepo(task), noOpBus)

    const result = await uc.execute(task.id, { result: "error occurred", numTurns: 1 })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.outcome).toBe("success")
    }
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/use-cases/EvaluateOutcome.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `EvaluateOutcome`**

```typescript
// src/use-cases/EvaluateOutcome.ts
import type { TaskId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"
import { isOverBudget } from "../entities/Task"
import { createMessageId } from "../entities/ids"

export type SessionOutcomeType = "success" | "failure" | "budget_exceeded"

export interface SessionOutcome {
  readonly outcome: SessionOutcomeType
  readonly reason?: string
}

export interface EvaluateOutcomeInput {
  readonly result: string
  readonly numTurns: number
}

export class EvaluateOutcome {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly bus: MessagePort,
  ) {}

  async execute(taskId: TaskId, input: EvaluateOutcomeInput): Promise<Result<SessionOutcome>> {
    const task = await this.tasks.findById(taskId)
    if (!task) {
      return failure(`Task ${taskId} not found`)
    }

    if (isOverBudget(task)) {
      if (task.assignedTo) {
        await this.bus.emit({
          id: createMessageId(),
          type: "budget.exceeded",
          taskId,
          agentId: task.assignedTo,
          tokensUsed: task.tokensUsed,
          budgetMax: task.budget.maxTokens,
          timestamp: new Date(),
        })
      }
      return success({ outcome: "budget_exceeded", reason: "Token budget exceeded" })
    }

    return success({ outcome: "success" })
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/use-cases/EvaluateOutcome.test.ts --no-cache`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/EvaluateOutcome.ts tests/use-cases/EvaluateOutcome.test.ts
git commit -m "feat: add EvaluateOutcome use case — session-level outcome evaluation"
```

---

### Task 4: `MockAgentSession`

**Files:**
- Create: `src/adapters/ai-providers/MockAgentSession.ts`
- Create: `tests/adapters/MockAgentSession.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/adapters/MockAgentSession.test.ts
import { MockAgentSession } from "../../src/adapters/ai-providers/MockAgentSession"
import type { PhaseTask, SessionEvent } from "../../src/use-cases/ports/AgentSession"

function makeTask(overrides: Partial<PhaseTask> = {}): PhaseTask {
  return {
    systemPrompt: "You are a developer.",
    taskDescription: "Implement a feature",
    workingDir: "/tmp/test",
    capabilities: [],
    ...overrides,
  }
}

async function collectEvents(session: MockAgentSession, task: PhaseTask): Promise<SessionEvent[]> {
  const events: SessionEvent[] = []
  const controller = new AbortController()
  for await (const event of session.launch(task, controller.signal)) {
    events.push(event)
  }
  return events
}

describe("MockAgentSession", () => {
  it("emits started, turn_completed, and completed events", async () => {
    const session = new MockAgentSession()
    const events = await collectEvents(session, makeTask())

    expect(events[0]!.type).toBe("started")
    expect(events.some(e => e.type === "turn_completed")).toBe(true)
    expect(events[events.length - 1]!.type).toBe("completed")
  })

  it("returns role-appropriate content based on system prompt", async () => {
    const session = new MockAgentSession()

    const devEvents = await collectEvents(session, makeTask({ systemPrompt: "You are a developer agent." }))
    const completedDev = devEvents.find(e => e.type === "completed") as Extract<SessionEvent, { type: "completed" }>
    expect(completedDev.result).toContain("Implementation complete")

    const reviewEvents = await collectEvents(session, makeTask({ systemPrompt: "You are a code reviewer agent." }))
    const completedReview = reviewEvents.find(e => e.type === "completed") as Extract<SessionEvent, { type: "completed" }>
    expect(completedReview.result).toContain("APPROVED")
  })

  it("includes token counts in turn_completed", async () => {
    const session = new MockAgentSession()
    const events = await collectEvents(session, makeTask())

    const turnEvent = events.find(e => e.type === "turn_completed") as Extract<SessionEvent, { type: "turn_completed" }>
    expect(turnEvent.tokensIn).toBeGreaterThan(0)
    expect(turnEvent.tokensOut).toBeGreaterThan(0)
  })

  it("includes aggregate stats in completed event", async () => {
    const session = new MockAgentSession()
    const events = await collectEvents(session, makeTask())

    const completed = events.find(e => e.type === "completed") as Extract<SessionEvent, { type: "completed" }>
    expect(completed.totalTokensIn).toBeGreaterThan(0)
    expect(completed.totalTokensOut).toBeGreaterThan(0)
    expect(completed.durationMs).toBeGreaterThanOrEqual(0)
    expect(completed.numTurns).toBe(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/adapters/MockAgentSession.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `MockAgentSession`**

```typescript
// src/adapters/ai-providers/MockAgentSession.ts
import type { AgentSession, PhaseTask, SessionEvent } from "../../use-cases/ports/AgentSession"

export class MockAgentSession implements AgentSession {
  async *launch(task: PhaseTask, _signal: AbortSignal): AsyncIterable<SessionEvent> {
    const startTime = Date.now()

    yield { type: "started", sessionId: `mock-${Date.now()}`, model: "mock" }

    const tokensIn = 10
    const tokensOut = 20

    yield { type: "turn_completed", tokensIn, tokensOut }

    const result = this.generateResponse(task.systemPrompt)

    yield {
      type: "completed",
      result,
      totalTokensIn: tokensIn,
      totalTokensOut: tokensOut,
      durationMs: Date.now() - startTime,
      numTurns: 1,
    }
  }

  private generateResponse(systemPrompt: string): string {
    const lower = systemPrompt.toLowerCase()

    if (lower.includes("decompose") || lower.includes("supervisor")) {
      return JSON.stringify([
        { description: "Write requirement spec", phase: "spec" },
        { description: "Create implementation plan", phase: "plan" },
        { description: "Implement the feature", phase: "code" },
        { description: "Run build and tests", phase: "test" },
        { description: "Review the implementation", phase: "review" },
      ])
    }

    if (lower.includes("product") || lower.includes("requirement")) {
      return "# Requirement Spec\n\n1. The system shall implement the requested feature.\n\nSuccess Criteria:\n- Feature works as described"
    }

    if (lower.includes("architect") || lower.includes("plan")) {
      return "# Implementation Plan\n\n## Step 1: Create module\nCreate the main module.\n\n## Step 2: Add tests\nAdd unit tests."
    }

    if (lower.includes("developer") || lower.includes("implement")) {
      return "Implementation complete. Created the requested feature with tests."
    }

    if (lower.includes("review") || lower.includes("evaluate")) {
      return "APPROVED - Code meets requirements and follows best practices."
    }

    return "Task completed successfully."
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/adapters/MockAgentSession.test.ts --no-cache`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/adapters/ai-providers/MockAgentSession.ts tests/adapters/MockAgentSession.test.ts
git commit -m "feat: add MockAgentSession for test/demo mode"
```

---

### Task 5: `RunAgentSession` Use Case

**Files:**
- Create: `src/use-cases/RunAgentSession.ts`
- Create: `tests/use-cases/RunAgentSession.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/use-cases/RunAgentSession.test.ts
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
    const runner = new RunAgentSession(mockSession, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus)

    const events = await collectEvents(runner, task)

    expect(events.some(e => e.type === "turn_completed")).toBe(true)
    expect(events.some(e => e.type === "task_completed")).toBe(true)
  })

  it("emits budget_exceeded when pre-launch budget check fails", async () => {
    const { task, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus } = makeMocks({ canProceed: false })
    const mockSession = new MockAgentSession()
    const runner = new RunAgentSession(mockSession, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus)

    const events = await collectEvents(runner, task)

    expect(events.some(e => e.type === "budget_exceeded")).toBe(true)
    expect(events.some(e => e.type === "task_completed")).toBe(false)
  })

  it("records turn metrics from turn_completed events", async () => {
    const { task, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus } = makeMocks()
    const mockSession = new MockAgentSession()
    const runner = new RunAgentSession(mockSession, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus)

    await collectEvents(runner, task)

    expect(recordTurnMetrics.execute).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({ tokensIn: expect.any(Number), tokensOut: expect.any(Number) }),
    )
  })

  it("calls evaluateOutcome with session result", async () => {
    const { task, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus } = makeMocks()
    const mockSession = new MockAgentSession()
    const runner = new RunAgentSession(mockSession, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus)

    await collectEvents(runner, task)

    expect(evaluateOutcome.execute).toHaveBeenCalledWith(
      task.id,
      expect.objectContaining({ result: expect.any(String), numTurns: expect.any(Number) }),
    )
  })

  it("includes content in task_completed event", async () => {
    const { task, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus } = makeMocks()
    const mockSession = new MockAgentSession()
    const runner = new RunAgentSession(mockSession, checkBudget, recordTurnMetrics, evaluateOutcome, tasks, bus)

    const events = await collectEvents(runner, task)

    const completedEvent = events.find(e => e.type === "task_completed")
    expect(completedEvent).toBeDefined()
    expect(completedEvent?.data["content"]).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/use-cases/RunAgentSession.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `RunAgentSession`**

```typescript
// src/use-cases/RunAgentSession.ts
import type { Task } from "../entities/Task"
import type { AgentId, ProjectId } from "../entities/ids"
import type { AgentConfig, AgentEvent, AgentExecutor } from "./ports/AgentExecutor"
import type { AgentSession, PhaseTask } from "./ports/AgentSession"
import type { TaskRepository } from "./ports/TaskRepository"
import type { MessagePort } from "./ports/MessagePort"
import type { CheckBudget } from "./CheckBudget"
import type { RecordTurnMetrics } from "./RecordTurnMetrics"
import type { EvaluateOutcome } from "./EvaluateOutcome"
import { createMessageId } from "../entities/ids"

export class RunAgentSession implements AgentExecutor {
  constructor(
    private readonly session: AgentSession,
    private readonly checkBudget: CheckBudget,
    private readonly recordTurnMetrics: RecordTurnMetrics,
    private readonly evaluateOutcome: EvaluateOutcome,
    private readonly tasks: TaskRepository,
    private readonly bus: MessagePort,
  ) {}

  async *run(agentId: AgentId, config: AgentConfig, task: Task, _projectId: ProjectId): AsyncIterable<AgentEvent> {
    // Pre-launch budget check
    const budgetResult = await this.checkBudget.execute(task.id, config.budget.maxTokens / 10)
    if (!budgetResult.ok || !budgetResult.value.canProceed) {
      yield { type: "budget_exceeded", data: { taskId: task.id, agentId } }
      return
    }

    const controller = new AbortController()

    const phaseTask: PhaseTask = {
      systemPrompt: config.systemPrompt,
      taskDescription: task.description,
      workingDir: config.workingDir,
      capabilities: config.capabilities,
      maxTurns: config.budget.maxTokens > 50000 ? 30 : 20,
      model: config.model,
    }

    let lastResult = ""
    let lastNumTurns = 0
    let lastTurnTime = Date.now()

    try {
      for await (const event of this.session.launch(phaseTask, controller.signal)) {
        switch (event.type) {
          case "started":
            lastTurnTime = Date.now()
            await this.bus.emit({
              id: createMessageId(),
              type: "agent.active",
              agentId,
              taskId: task.id,
              sessionId: event.sessionId,
              timestamp: new Date(),
            })
            break

          case "text":
            yield { type: "text", data: { content: event.content } }
            break

          case "turn_completed": {
            const now = Date.now()
            const turnDurationMs = now - lastTurnTime
            lastTurnTime = now

            await this.recordTurnMetrics.execute(task.id, {
              tokensIn: event.tokensIn,
              tokensOut: event.tokensOut,
              durationMs: turnDurationMs,
            })

            yield { type: "turn_completed", data: { tokensIn: event.tokensIn, tokensOut: event.tokensOut } }

            // Mid-session budget check
            const midBudget = await this.checkBudget.execute(task.id, 0)
            if (midBudget.ok && !midBudget.value.canProceed) {
              controller.abort()
              yield { type: "budget_exceeded", data: { taskId: task.id, agentId } }
              return
            }
            break
          }

          case "completed":
            lastResult = event.result
            lastNumTurns = event.numTurns
            break

          case "error":
            yield { type: "task_failed", data: { taskId: task.id, reason: event.reason } }
            return
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        yield { type: "budget_exceeded", data: { taskId: task.id, agentId } }
        return
      }
      const reason = err instanceof Error ? err.message : String(err)
      yield { type: "task_failed", data: { taskId: task.id, reason } }
      return
    }

    // Evaluate the session outcome
    const outcomeResult = await this.evaluateOutcome.execute(task.id, {
      result: lastResult,
      numTurns: lastNumTurns,
    })

    if (!outcomeResult.ok) {
      yield { type: "task_failed", data: { taskId: task.id, reason: outcomeResult.error } }
      return
    }

    if (outcomeResult.value.outcome === "budget_exceeded") {
      yield { type: "budget_exceeded", data: { taskId: task.id, agentId } }
      return
    }

    yield { type: "task_completed", data: { taskId: task.id, turns: lastNumTurns, content: lastResult } }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/use-cases/RunAgentSession.test.ts --no-cache`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/RunAgentSession.ts tests/use-cases/RunAgentSession.test.ts
git commit -m "feat: add RunAgentSession — fire-and-observe agent execution"
```

---

### Task 6: `RunBuildAndTest` Use Case

**Files:**
- Create: `src/use-cases/RunBuildAndTest.ts`
- Create: `tests/use-cases/RunBuildAndTest.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/use-cases/RunBuildAndTest.test.ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/use-cases/RunBuildAndTest.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `RunBuildAndTest`**

```typescript
// src/use-cases/RunBuildAndTest.ts
import type { TaskId } from "../entities/ids"
import type { ShellExecutor } from "./ports/ShellExecutor"
import type { TaskRepository } from "./ports/TaskRepository"
import type { RecordTurnMetrics } from "./RecordTurnMetrics"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"
import { createMessageId } from "../entities/ids"

export interface BuildAndTestResult {
  readonly buildOutput: string
  readonly testOutput: string
}

export class RunBuildAndTest {
  constructor(
    private readonly shell: ShellExecutor,
    private readonly tasks: TaskRepository,
    private readonly recordTurnMetrics: RecordTurnMetrics,
    private readonly bus: MessagePort,
  ) {}

  async execute(taskId: TaskId, buildCommand: string, testCommand: string): Promise<Result<BuildAndTestResult>> {
    const task = await this.tasks.findById(taskId)
    if (!task) return failure(`Task ${taskId} not found`)

    await this.bus.emit({
      id: createMessageId(),
      type: "agent.active",
      agentId: task.assignedTo,
      taskId,
      timestamp: new Date(),
    })

    // Run build
    const buildStart = Date.now()
    const buildParts = this.parseCommand(buildCommand)
    const buildResult = await this.shell.execute(buildParts.command, buildParts.args)
    const buildDurationMs = Date.now() - buildStart

    await this.recordTurnMetrics.execute(taskId, { tokensIn: 0, tokensOut: 0, durationMs: buildDurationMs })

    if (buildResult.exitCode !== 0) {
      await this.bus.emit({
        id: createMessageId(),
        type: "build.failed",
        taskId,
        error: buildResult.stderr || buildResult.stdout,
        timestamp: new Date(),
      })
      return failure(`Build failed: ${buildResult.stderr || buildResult.stdout}`)
    }

    await this.bus.emit({
      id: createMessageId(),
      type: "build.passed",
      taskId,
      durationMs: buildDurationMs,
      timestamp: new Date(),
    })

    // Run tests
    const testStart = Date.now()
    const testParts = this.parseCommand(testCommand)
    const testResult = await this.shell.execute(testParts.command, testParts.args)
    const testDurationMs = Date.now() - testStart

    await this.recordTurnMetrics.execute(taskId, { tokensIn: 0, tokensOut: 0, durationMs: testDurationMs })

    if (testResult.exitCode !== 0) {
      await this.bus.emit({
        id: createMessageId(),
        type: "test.failed",
        taskId,
        error: testResult.stderr || testResult.stdout,
        timestamp: new Date(),
      })
      return failure(`Tests failed: ${testResult.stderr || testResult.stdout}`)
    }

    await this.bus.emit({
      id: createMessageId(),
      type: "test.passed",
      taskId,
      durationMs: testDurationMs,
      timestamp: new Date(),
    })

    return success({
      buildOutput: buildResult.stdout,
      testOutput: testResult.stdout,
    })
  }

  private parseCommand(raw: string): { command: string; args: readonly string[] } {
    const parts = raw.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [raw]
    return {
      command: parts[0]!,
      args: parts.slice(1).map(p => p.replace(/^"|"$/g, "")),
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/use-cases/RunBuildAndTest.test.ts --no-cache`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/RunBuildAndTest.ts tests/use-cases/RunBuildAndTest.test.ts
git commit -m "feat: add RunBuildAndTest — honest Ops, no fake AI"
```

---

### Task 7: `ClaudeAgentSdkAdapter`

**Files:**
- Create: `src/adapters/ai-providers/ClaudeAgentSdkAdapter.ts`
- Create: `tests/adapters/ClaudeAgentSdkAdapter.test.ts`

- [ ] **Step 1: Write the failing tests (SDK is mocked)**

```typescript
// tests/adapters/ClaudeAgentSdkAdapter.test.ts
import { ClaudeAgentSdkAdapter, mapCapabilities } from "../../src/adapters/ai-providers/ClaudeAgentSdkAdapter"
import type { AgentCapability } from "../../src/use-cases/ports/AgentSession"

describe("mapCapabilities", () => {
  it("maps file_access to Read, Write, Edit, Glob, Grep", () => {
    const tools = mapCapabilities(["file_access"])
    expect(tools).toEqual(["Read", "Write", "Edit", "Glob", "Grep"])
  })

  it("maps shell to Bash", () => {
    const tools = mapCapabilities(["shell"])
    expect(tools).toEqual(["Bash"])
  })

  it("maps multiple capabilities without duplicates", () => {
    const tools = mapCapabilities(["file_access", "shell"])
    expect(tools).toEqual(["Read", "Write", "Edit", "Glob", "Grep", "Bash"])
  })

  it("returns empty array for no capabilities", () => {
    const tools = mapCapabilities([])
    expect(tools).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/adapters/ClaudeAgentSdkAdapter.test.ts --no-cache`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `ClaudeAgentSdkAdapter`**

```typescript
// src/adapters/ai-providers/ClaudeAgentSdkAdapter.ts
import { query } from "@anthropic-ai/claude-agent-sdk"
import type { AgentSession, PhaseTask, SessionEvent, AgentCapability } from "../../use-cases/ports/AgentSession"

const CAPABILITY_TO_TOOLS: Record<AgentCapability, readonly string[]> = {
  file_access: ["Read", "Write", "Edit", "Glob", "Grep"],
  shell: ["Bash"],
}

export function mapCapabilities(capabilities: ReadonlyArray<AgentCapability>): string[] {
  const tools: string[] = []
  for (const cap of capabilities) {
    const mapped = CAPABILITY_TO_TOOLS[cap]
    if (mapped) {
      tools.push(...mapped)
    }
  }
  return tools
}

export class ClaudeAgentSdkAdapter implements AgentSession {
  async *launch(task: PhaseTask, signal: AbortSignal): AsyncIterable<SessionEvent> {
    const allowedTools = mapCapabilities(task.capabilities)

    const stream = query({
      prompt: task.taskDescription,
      options: {
        systemPrompt: task.systemPrompt,
        cwd: task.workingDir,
        allowedTools: allowedTools.length > 0 ? allowedTools : undefined,
        maxTurns: task.maxTurns,
        model: task.model,
        includePartialMessages: true,
        abortSignal: signal,
      },
    })

    for await (const message of stream) {
      switch (message.type) {
        case "system":
          if (message.subtype === "init") {
            yield {
              type: "started",
              sessionId: message.session_id,
              model: message.model,
            }
          }
          break

        case "assistant":
          if (message.message?.usage) {
            yield {
              type: "turn_completed",
              tokensIn: message.message.usage.input_tokens,
              tokensOut: message.message.usage.output_tokens,
            }
          }
          break

        case "result":
          if (message.subtype === "success") {
            yield {
              type: "completed",
              result: message.result,
              totalTokensIn: message.usage.input_tokens,
              totalTokensOut: message.usage.output_tokens,
              durationMs: message.duration_ms,
              numTurns: message.num_turns,
            }
          } else {
            yield {
              type: "error",
              reason: message.errors?.join("; ") ?? `Session failed: ${message.subtype}`,
            }
          }
          break
      }
    }
  }
}
```

Note: This adapter intentionally does not parse `stream_event` for `tool_used`/`tool_result` in the initial implementation. That can be added in a follow-up if the dashboard needs real-time tool activity. The critical events (`started`, `turn_completed`, `completed`, `error`) are all present.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/adapters/ClaudeAgentSdkAdapter.test.ts --no-cache`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/adapters/ai-providers/ClaudeAgentSdkAdapter.ts tests/adapters/ClaudeAgentSdkAdapter.test.ts
git commit -m "feat: add ClaudeAgentSdkAdapter — thin wrapper over Agent SDK"
```

---

### Task 8: Update `AgentExecutor` Port

**Files:**
- Modify: `src/use-cases/ports/AgentExecutor.ts`

This is done NOW (right before plugin updates) to avoid a broken intermediate state. The new port and all new use cases are already in place; the consumers are about to be updated in the following tasks.

- [ ] **Step 1: Replace `tools` with `capabilities` in `AgentConfig`**

Replace the entire file content:

```typescript
// src/use-cases/ports/AgentExecutor.ts
import type { Task } from "../../entities/Task"
import type { AgentId, ProjectId } from "../../entities/ids"
import type { AgentRole } from "../../entities/AgentRole"
import type { TokenBudget } from "../../entities/Budget"
import type { AgentCapability } from "./AgentSession"

export interface AgentConfig {
  readonly role: AgentRole
  readonly systemPrompt: string
  readonly capabilities: ReadonlyArray<AgentCapability>
  readonly model: string
  readonly budget: TokenBudget
  readonly workingDir: string
}

export type AgentEventType = "turn_completed" | "text" | "task_completed" | "task_failed" | "budget_exceeded"

export interface AgentEvent {
  readonly type: AgentEventType
  readonly data: Record<string, unknown>
}

export interface AgentExecutor {
  run(agentId: AgentId, config: AgentConfig, task: Task, projectId: ProjectId): AsyncIterable<AgentEvent>
}
```

- [ ] **Step 2: Commit (consumers will be updated in the immediately following tasks)**

```bash
git add src/use-cases/ports/AgentExecutor.ts
git commit -m "feat: update AgentExecutor port — replace tools with capabilities"
```

---

### Task 9: Update Plugins — DeveloperPlugin

**Files:**
- Modify: `src/adapters/plugins/agents/DeveloperPlugin.ts`
- Modify: `tests/adapters/DeveloperPlugin.test.ts`

- [ ] **Step 1: Update `DeveloperPlugin` — remove tools, use capabilities and workingDir**

Replace the full file:

```typescript
// src/adapters/plugins/agents/DeveloperPlugin.ts
import type { AgentId, ProjectId } from "../../../entities/ids"
import { createMessageId, createArtifactId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { AgentExecutor } from "../../../use-cases/ports/AgentExecutor"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { WorktreeManager } from "../../../use-cases/ports/WorktreeManager"
import { ROLES } from "../../../entities/AgentRole"

export interface DeveloperPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly executor: AgentExecutor
  readonly taskRepo: TaskRepository
  readonly systemPrompt: string
  readonly model: string
  readonly bus: MessagePort
  readonly worktreeManager: WorktreeManager
  readonly workspaceDir: string
}

export class DeveloperPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "developer-agent"
  readonly version = "1.0.0"
  readonly description = "Developer agent that implements coding tasks"

  private readonly deps: DeveloperPluginDeps

  constructor(deps: DeveloperPluginDeps) {
    this.deps = deps
    this.id = `developer-${deps.agentId}`
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async healthCheck(): Promise<HealthStatus> { return "healthy" }

  subscriptions(): ReadonlyArray<MessageFilter> {
    return [{ types: ["task.assigned"] }]
  }

  async handle(message: Message): Promise<void> {
    if (message.type !== "task.assigned") return
    if (message.agentId !== this.deps.agentId) return

    const task = await this.deps.taskRepo.findById(message.taskId)
    if (!task) return

    const branchName = `devfleet/task-${task.id}`
    const worktreePath = await this.deps.worktreeManager.create(branchName)
    const updatedTask = { ...task, branch: branchName, version: task.version + 1 }
    await this.deps.taskRepo.update(updatedTask)

    const config = {
      role: ROLES.DEVELOPER,
      systemPrompt: this.deps.systemPrompt,
      capabilities: ["file_access" as const, "shell" as const],
      model: this.deps.model,
      budget: task.budget,
      workingDir: worktreePath,
    }

    for await (const event of this.deps.executor.run(this.deps.agentId, config, task, this.deps.projectId)) {
      if (event.type === "task_completed") {
        await this.deps.bus.emit({
          id: createMessageId(),
          type: "code.completed",
          taskId: message.taskId,
          artifactId: createArtifactId(),
          branch: branchName,
          filesChanged: 0,
          testsWritten: 0,
          timestamp: new Date(),
        })
      }
    }
  }
}
```

- [ ] **Step 2: Update `DeveloperPlugin.test.ts` to match new deps shape**

Read the current test file, then update:
- Remove `ScopedExecutorFactory` from deps
- Remove `DEVELOPER_TOOLS` references
- Add `workspaceDir` to deps
- Update `config` assertions to use `capabilities` instead of `tools`

- [ ] **Step 3: Run the test**

Run: `npx jest tests/adapters/DeveloperPlugin.test.ts --no-cache`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/adapters/plugins/agents/DeveloperPlugin.ts tests/adapters/DeveloperPlugin.test.ts
git commit -m "refactor: DeveloperPlugin — remove tool defs, use capabilities + workingDir"
```

---

### Task 10: Update Plugins — ReviewerPlugin, ProductPlugin, ArchitectPlugin

**Files:**
- Modify: `src/adapters/plugins/agents/ReviewerPlugin.ts`
- Modify: `src/adapters/plugins/agents/ProductPlugin.ts`
- Modify: `src/adapters/plugins/agents/ArchitectPlugin.ts`
- Modify: `tests/adapters/ReviewerPlugin.test.ts`
- Modify: `tests/adapters/ProductPlugin.test.ts`
- Modify: `tests/adapters/ArchitectPlugin.test.ts`

- [ ] **Step 1: Update `ReviewerPlugin`**

Remove `REVIEWER_TOOLS` constant and `ToolDefinition` import. Change config:

```typescript
const config = {
  role: ROLES.REVIEWER,
  systemPrompt: this.deps.systemPrompt + (artifactContext ? `\n\nArtifacts for review:\n${artifactContext}` : ""),
  capabilities: ["file_access" as const, "shell" as const],
  model: this.deps.model,
  budget: task.budget,
  workingDir: this.deps.workspaceDir,
}
```

Add `workspaceDir: string` to `ReviewerPluginDeps`. Remove `ToolDefinition` import from top of file.

- [ ] **Step 2: Update `ProductPlugin`**

Change config:

```typescript
const config = {
  role: ROLES.PRODUCT,
  systemPrompt: this.deps.systemPrompt,
  capabilities: [],
  model: this.deps.model,
  budget: task.budget,
  workingDir: this.deps.workspaceDir,
}
```

Add `workspaceDir: string` to `ProductPluginDeps`.

- [ ] **Step 3: Update `ArchitectPlugin`**

Change config:

```typescript
const config = {
  role: ROLES.ARCHITECT,
  systemPrompt: this.deps.systemPrompt + specContext,
  capabilities: [],
  model: this.deps.model,
  budget: task.budget,
  workingDir: this.deps.workspaceDir,
}
```

Add `workspaceDir: string` to `ArchitectPluginDeps`.

- [ ] **Step 4: Update the three test files**

For each test: add `workspaceDir: "/tmp/test"` to deps, change `tools` assertions to `capabilities` assertions.

- [ ] **Step 5: Run all three plugin tests**

Run: `npx jest tests/adapters/ReviewerPlugin.test.ts tests/adapters/ProductPlugin.test.ts tests/adapters/ArchitectPlugin.test.ts --no-cache`
Expected: All tests pass

- [ ] **Step 6: Commit**

```bash
git add src/adapters/plugins/agents/ReviewerPlugin.ts src/adapters/plugins/agents/ProductPlugin.ts src/adapters/plugins/agents/ArchitectPlugin.ts tests/adapters/ReviewerPlugin.test.ts tests/adapters/ProductPlugin.test.ts tests/adapters/ArchitectPlugin.test.ts
git commit -m "refactor: update Reviewer, Product, Architect plugins — capabilities, no tool defs"
```

---

### Task 11: Update OpsPlugin to Use `RunBuildAndTest`

**Files:**
- Modify: `src/adapters/plugins/agents/OpsPlugin.ts`
- Modify: `tests/adapters/OpsPlugin.test.ts`

- [ ] **Step 1: Rewrite `OpsPlugin`**

```typescript
// src/adapters/plugins/agents/OpsPlugin.ts
import type { AgentId, ProjectId } from "../../../entities/ids"
import { createMessageId, createArtifactId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { ArtifactRepository } from "../../../use-cases/ports/ArtifactRepository"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { CreateArtifactUseCase } from "../../../use-cases/CreateArtifact"
import type { RunBuildAndTest } from "../../../use-cases/RunBuildAndTest"
import { createArtifact } from "../../../entities/Artifact"

export interface OpsPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly runBuildAndTest: RunBuildAndTest
  readonly taskRepo: TaskRepository
  readonly artifactRepo: ArtifactRepository
  readonly createArtifact: CreateArtifactUseCase
  readonly bus: MessagePort
  readonly buildCommand: string
  readonly testCommand: string
}

export class OpsPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "ops-agent"
  readonly version = "1.0.0"
  readonly description = "Ops agent that runs builds and tests deterministically"

  private readonly deps: OpsPluginDeps

  constructor(deps: OpsPluginDeps) {
    this.deps = deps
    this.id = `ops-${deps.agentId}`
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async healthCheck(): Promise<HealthStatus> { return "healthy" }

  subscriptions(): ReadonlyArray<MessageFilter> {
    return [{ types: ["task.assigned"], agentId: this.deps.agentId }]
  }

  async handle(message: Message): Promise<void> {
    if (message.type !== "task.assigned") return
    if (message.agentId !== this.deps.agentId) return

    const task = await this.deps.taskRepo.findById(message.taskId)
    if (!task) return

    const startTime = Date.now()
    const result = await this.deps.runBuildAndTest.execute(task.id, this.deps.buildCommand, this.deps.testCommand)
    const durationMs = Date.now() - startTime

    const buildOutput = result.ok
      ? `${result.value.buildOutput}\n${result.value.testOutput}`
      : result.error

    const passedMatch = buildOutput.match(/(\d+)\s+passed/)
    const failedMatch = buildOutput.match(/(\d+)\s+failed/)
    const passed = passedMatch ? parseInt(passedMatch[1]!, 10) : 0
    const failed = failedMatch ? parseInt(failedMatch[1]!, 10) : 0

    const artifact = createArtifact({
      id: createArtifactId(),
      kind: "test_report",
      format: "json",
      taskId: task.id,
      createdBy: this.deps.agentId,
      content: JSON.stringify({ passed, failed, output: buildOutput }),
      metadata: { passed, failed, coverageDelta: 0 },
    })
    await this.deps.createArtifact.execute(artifact)

    await this.deps.bus.emit({
      id: createMessageId(),
      type: "test.report.created",
      taskId: task.id,
      artifactId: artifact.id,
      timestamp: new Date(),
    })

    await this.deps.bus.emit({
      id: createMessageId(),
      type: "task.completed",
      taskId: task.id,
      agentId: this.deps.agentId,
      timestamp: new Date(),
    })
  }
}
```

- [ ] **Step 2: Update `OpsPlugin.test.ts`**

Update deps to use `runBuildAndTest` mock instead of `executor`. Mock `RunBuildAndTest.execute` to return success/failure results. Remove all `AgentExecutor` references.

- [ ] **Step 3: Run test**

Run: `npx jest tests/adapters/OpsPlugin.test.ts --no-cache`
Expected: All tests pass

- [ ] **Step 4: Commit**

```bash
git add src/adapters/plugins/agents/OpsPlugin.ts tests/adapters/OpsPlugin.test.ts
git commit -m "refactor: OpsPlugin — use RunBuildAndTest, no fake AI"
```

---

### Task 12: Update SupervisorPlugin

**Files:**
- Modify: `src/adapters/plugins/agents/SupervisorPlugin.ts`
- Modify: `tests/adapters/SupervisorPlugin.test.ts`

- [ ] **Step 1: Replace `PromptAgent` with `AgentSession` in SupervisorPlugin**

In `SupervisorPluginDeps`, replace:
```typescript
readonly promptAgent: PromptAgent
```
with:
```typescript
readonly agentSession: AgentSession
readonly workspaceDir: string
```

Add import:
```typescript
import type { AgentSession, PhaseTask } from "../../../use-cases/ports/AgentSession"
```

Remove import of `PromptAgent`.

- [ ] **Step 2: Update `handleGoalCreated` to use `AgentSession`**

Replace the `promptAgent.execute(...)` section in `handleGoalCreated`:

```typescript
private async handleGoalCreated(goalId: GoalId, description: string): Promise<void> {
  const config = await this.deps.detectProjectConfig.execute()
  await this.deps.bus.emit({
    id: createMessageId(),
    type: "project.detected",
    projectId: this.deps.projectId,
    config,
    timestamp: new Date(),
  })

  const phaseTask: PhaseTask = {
    systemPrompt: this.deps.systemPrompt,
    taskDescription: `Decompose this goal into tasks. Return a JSON array of {description, phase} objects.\nPhases available: ${this.deps.pipelineConfig.phases.join(", ")}\n\nGoal: ${description}`,
    workingDir: this.deps.workspaceDir,
    capabilities: [],
    maxTurns: 3,
    model: this.deps.model,
  }

  let content = ""
  const controller = new AbortController()
  try {
    for await (const event of this.deps.agentSession.launch(phaseTask, controller.signal)) {
      if (event.type === "completed") {
        content = event.result
      }
    }
  } catch {
    content = ""
  }

  let taskDefs: Array<{ description: string; phase: string }>
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    taskDefs = jsonMatch ? JSON.parse(jsonMatch[0]) : []
  } catch {
    taskDefs = this.deps.pipelineConfig.phases.map(phase => ({
      description: `${phase}: ${description}`,
      phase,
    }))
  }

  const definitions: TaskDefinition[] = taskDefs.map(def => ({
    id: createTaskId(),
    description: def.description,
    phase: def.phase,
    budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }),
  }))

  await this.deps.decomposeGoal.execute(goalId, definitions)

  if (definitions.length > 0) {
    const firstDef = definitions[0]!
    const role = roleForPhase(firstDef.phase, this.deps.pipelineConfig)
    if (role) {
      await this.deps.assignTask.execute(firstDef.id, role)
    }
  }
}
```

- [ ] **Step 3: Update `SupervisorPlugin.test.ts`**

Replace `promptAgent` mock with `agentSession` mock that implements `launch()` as an async generator yielding `{ type: "completed", result: "..." }`.

- [ ] **Step 4: Run test**

Run: `npx jest tests/adapters/SupervisorPlugin.test.ts --no-cache`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add src/adapters/plugins/agents/SupervisorPlugin.ts tests/adapters/SupervisorPlugin.test.ts
git commit -m "refactor: SupervisorPlugin — use AgentSession instead of PromptAgent"
```

---

### Task 13: Rewire Composition Root + Update CLI Entry Point

**Files:**
- Modify: `src/infrastructure/config/composition-root.ts`
- Modify: `src/use-cases/WorkspaceRunManager.ts`

- [ ] **Step 1: Update `DevFleetConfig`**

Remove `anthropicApiKey`, add `mockMode`:

```typescript
export interface DevFleetConfig {
  readonly workspaceDir: string
  readonly mockMode?: boolean
  readonly developerModel?: string
  readonly supervisorModel?: string
  readonly reviewerModel?: string
  readonly projectId?: string
  readonly pipelineTimeoutMs?: number
  readonly agentTimeoutMs?: number
  readonly maxRetries?: number
  readonly buildCommand?: string
  readonly testCommand?: string
}
```

- [ ] **Step 2: Replace imports and AI provider wiring**

Remove all imports of deleted files (`ClaudeProvider`, `DeterministicProvider`, `PromptAgent`, `ExecuteToolCalls`, `RunAgentLoop`, `AICompletionProvider`, `AIToolProvider`, `AICapability`, `AgentPrompt`, `AIResponse`, `AIToolResponse`, `ToolDefinition`, `TokenBudget`).

Add new imports:

```typescript
import { ClaudeAgentSdkAdapter } from "../../adapters/ai-providers/ClaudeAgentSdkAdapter"
import { MockAgentSession } from "../../adapters/ai-providers/MockAgentSession"
import { RunAgentSession } from "../../use-cases/RunAgentSession"
import { RunBuildAndTest } from "../../use-cases/RunBuildAndTest"
import { EvaluateOutcome } from "../../use-cases/EvaluateOutcome"
import type { AgentSession } from "../../use-cases/ports/AgentSession"
```

- [ ] **Step 3: Replace the AI provider and executor wiring**

Replace sections 2 (infrastructure), 4 (use cases), and 5 (executors) with:

```typescript
// 2. Infrastructure
const bus = new InMemoryBus()
const fileSystem: FileSystem = useMock ? createMockFileSystem() : new NodeFileSystem(config.workspaceDir)
const shell: ShellExecutor = useMock ? createMockShell() : new NodeShellExecutor(config.workspaceDir)
const detectProjectConfig = new DetectProjectConfig(fileSystem)
const worktreeManager = useMock
  ? new InMemoryWorktreeManager()
  : new NodeWorktreeManager(shell, config.workspaceDir)

// 3. Agent session (replaces ClaudeProvider)
const agentSession: AgentSession = useMock
  ? new MockAgentSession()
  : new ClaudeAgentSdkAdapter()

// 4. Use cases
const checkBudget = new CheckBudget(taskRepo)
const recordTurnMetrics = new RecordTurnMetrics(metricRecorder, taskRepo)
const evaluateOutcome = new EvaluateOutcome(taskRepo, bus)
const decomposeGoal = new DecomposeGoal(goalRepo, taskRepo, bus)
const assignTask = new AssignTask(taskRepo, agentRegistry, bus)
const evaluateKeepDiscard = new EvaluateKeepDiscard(taskRepo)
const mergeBranch = new MergeBranch(taskRepo, worktreeManager, bus)
const discardBranch = new DiscardBranch(taskRepo, worktreeManager, bus)
const createArtifact = new CreateArtifactUseCase(artifactRepo, taskRepo)
const detectStuckAgent = new DetectStuckAgent(agentRegistry, bus)
const computeFinancials = new ComputeFinancials(eventStore)
const computeQuality = new ComputeQualityMetrics(keepDiscardRepo)
const computeTimings = new ComputePhaseTimings(eventStore, taskRepo)
const acceptInsight = new AcceptInsight(insightRepo, agentPromptStore, budgetConfigStore, agentRegistry, skillStore, bus, notificationPort)
const dismissInsight = new DismissInsight(insightRepo)

// 5. Executors
const agentExecutor = new RunAgentSession(
  agentSession, checkBudget, recordTurnMetrics, evaluateOutcome, taskRepo, bus,
)

const buildCommand = config.buildCommand ?? "npm run build"
const testCommand = config.testCommand ?? "npm test"
const runBuildAndTest = new RunBuildAndTest(shell, taskRepo, recordTurnMetrics, bus)
```

Where `useMock` changes from `!config.anthropicApiKey` to `config.mockMode ?? false`.

- [ ] **Step 4: Update plugin construction**

Remove `scopedExecutorFactory`. Update all plugin constructors to pass new deps:

For `DeveloperPlugin`: remove `scopedExecutorFactory`, add `workspaceDir: config.workspaceDir`.
For `ReviewerPlugin`, `ProductPlugin`, `ArchitectPlugin`: add `workspaceDir: config.workspaceDir`.
For `SupervisorPlugin`: replace `promptAgent` with `agentSession`, add `workspaceDir: config.workspaceDir`.
For `OpsPlugin`: replace `executor` with `runBuildAndTest`, add `buildCommand`, `testCommand`.

- [ ] **Step 5: Remove `MockAIProvider` class and `createMockFileSystem`/`createMockShell` (keep the mock FS/shell — still needed for Ops test mode)**

Delete the `MockAIProvider` class entirely. Keep `createMockFileSystem` and `createMockShell` since they're used when `mockMode` is true for the file system and shell.

- [ ] **Step 6: Update `WorkspaceRunManager` deps and the `start()` call**

In `WorkspaceRunManager.ts`, replace `apiKey: string` with `mockMode?: boolean` in `WorkspaceRunManagerDeps`. Update the `buildSystem` config construction:

```typescript
const systemConfig: DevFleetConfig = {
  workspaceDir: cloneDir,
  mockMode: this.deps.mockMode,
  supervisorModel: config.supervisorModel,
  developerModel: config.developerModel,
  reviewerModel: config.reviewerModel,
  pipelineTimeoutMs: config.timeoutMs,
  buildCommand: projectConfig.buildCommand,
  testCommand: projectConfig.testCommand,
}
```

Update `composition-root.ts` where `WorkspaceRunManager` is constructed:

```typescript
const workspaceManager = new WorkspaceRunManager({
  repo: workspaceRunRepo,
  isolator: workspaceIsolator,
  fsFactory: (rootPath: string) => new NodeFileSystem(rootPath),
  gitRemote,
  prCreator,
  autoMerge,
  buildSystem,
  mockMode: useMock,
})
```

- [ ] **Step 7: Update CLI entry point (`src/infrastructure/cli/index.ts`)**

Remove `API_KEY` / `ANTHROPIC_API_KEY` reading. Replace with:

```typescript
const MOCK_MODE = process.env["DEVFLEET_MOCK"] === "true"

if (MOCK_MODE) {
  console.log("(Mock mode enabled — using mock AI providers)")
}
```

Update the `buildSystem` call to pass `mockMode: MOCK_MODE` instead of `anthropicApiKey`.

- [ ] **Step 8: Verify the full project compiles**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: rewire composition root + CLI — AgentSession, RunBuildAndTest, no API key"
```

---

### Task 14: Delete Dead Code

**Files:**
- Delete: `src/use-cases/ports/AIProvider.ts`
- Delete: `src/use-cases/ports/ScopedExecutorFactory.ts`
- Delete: `src/use-cases/PromptAgent.ts`
- Delete: `src/use-cases/ExecuteToolCalls.ts`
- Delete: `src/use-cases/RunAgentLoop.ts`
- Delete: `src/use-cases/EvaluateTurnOutcome.ts`
- Delete: `src/entities/Conversation.ts`
- Delete: `src/adapters/ai-providers/ClaudeProvider.ts`
- Delete: `src/adapters/ai-providers/DeterministicProvider.ts`
- Delete: `tests/use-cases/PromptAgent.test.ts`
- Delete: `tests/use-cases/ExecuteToolCalls.test.ts`
- Delete: `tests/use-cases/RunAgentLoop.test.ts`
- Delete: `tests/use-cases/EvaluateTurnOutcome.test.ts`
- Delete: `tests/adapters/DeterministicProvider.test.ts`

- [ ] **Step 1: Delete all dead source files**

```bash
rm src/use-cases/ports/AIProvider.ts
rm src/use-cases/ports/ScopedExecutorFactory.ts
rm src/use-cases/PromptAgent.ts
rm src/use-cases/ExecuteToolCalls.ts
rm src/use-cases/RunAgentLoop.ts
rm src/use-cases/EvaluateTurnOutcome.ts
rm src/entities/Conversation.ts
rm src/adapters/ai-providers/ClaudeProvider.ts
rm src/adapters/ai-providers/DeterministicProvider.ts
```

- [ ] **Step 2: Delete all dead test files**

```bash
rm tests/use-cases/PromptAgent.test.ts
rm tests/use-cases/ExecuteToolCalls.test.ts
rm tests/use-cases/RunAgentLoop.test.ts
rm tests/use-cases/EvaluateTurnOutcome.test.ts
rm tests/adapters/DeterministicProvider.test.ts
```

- [ ] **Step 3: Verify no remaining imports reference deleted files**

Run: `grep -r "from.*AIProvider\|from.*ScopedExecutorFactory\|from.*PromptAgent\|from.*ExecuteToolCalls\|from.*RunAgentLoop\|from.*EvaluateTurnOutcome\|from.*Conversation\|from.*ClaudeProvider\|from.*DeterministicProvider" src/ --include="*.ts"`
Expected: No matches (all references should have been updated in prior tasks)

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete dead code — old AI ports, providers, agent loop, conversation"
```

---

### Task 15: Update Integration Tests

**Files:**
- Modify: `tests/integration/end-to-end.test.ts`
- Modify: `tests/integration/self-test.test.ts`
- Modify: `tests/use-cases/WorkspaceRunManager.test.ts`

- [ ] **Step 1: Update `end-to-end.test.ts`**

Replace `MockAIProvider` references with `MockAgentSession`. Update config to use `mockMode: true` instead of passing no API key. Update any `tools` references to `capabilities`.

- [ ] **Step 2: Update `self-test.test.ts`**

Same pattern: replace mock AI references, use new config shape.

- [ ] **Step 3: Update `WorkspaceRunManager.test.ts`**

Replace `apiKey` references with `mockMode`. Update `WorkspaceRunManagerDeps` mock to match new shape.

- [ ] **Step 4: Run full test suite**

Run: `npx jest --no-cache`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add tests/
git commit -m "test: update integration and workspace tests for new engine"
```

---

### Task 16: Final Typecheck and Full Test Run

- [ ] **Step 1: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Run full test suite**

Run: `npx jest --no-cache`
Expected: All tests pass

- [ ] **Step 3: Verify no references to deleted code remain**

Run: `grep -r "AIProvider\|ClaudeProvider\|DeterministicProvider\|PromptAgent\|ExecuteToolCalls\|RunAgentLoop\|EvaluateTurnOutcome\|Conversation\|ScopedExecutorFactory\|anthropicApiKey\|ANTHROPIC_API_KEY" src/ --include="*.ts" -l`
Expected: No matches

- [ ] **Step 4: Final commit if any loose ends**

```bash
git add -A
git commit -m "chore: final cleanup — verify clean build and test suite"
```
