# DevFleet Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite DevFleet as a visual Claude Code — agents run in-project with full context, users see real-time progress and can intervene.

**Architecture:** Three contracts (context, progress, intervention) replace the workspace cloning layer. `ContextAwarePromptBuilder` gives every agent the same context. `agent.tool_call` messages show users what agents are doing. Phase skipping and retry-with-hint give users control.

**Tech Stack:** TypeScript, Node.js, Claude Agent SDK, Next.js dashboard, Vitest

**Spec:** `docs/superpowers/specs/2026-03-30-devfleet-rewrite-design.md`

---

## Task 0: Fix Pipeline Advancement Bug (Pre-requisite)

**Files:**
- Modify: `src/adapters/plugins/agents/SupervisorPlugin.ts`
- Test: `tests/adapters/SupervisorPlugin.test.ts`

- [ ] **Step 1: Fix the test file so it runs with Vitest**

The existing test file uses `jest.fn()` and missing vitest globals. Fix imports:

```typescript
// tests/adapters/SupervisorPlugin.test.ts — add at top:
import { describe, it, expect, vi } from "vitest"
```

Replace `jest.fn()` with `vi.fn()`:

```typescript
  const mockDetectProjectConfig = {
    execute: vi.fn().mockResolvedValue({
```

Run: `npx vitest run tests/adapters/SupervisorPlugin.test.ts`
Expected: Existing tests pass.

- [ ] **Step 2: Write failing test for pipeline advancement after task failure**

Add to `tests/adapters/SupervisorPlugin.test.ts`:

```typescript
  it("advances pipeline after task.failed", async () => {
    const taskRepo = new InMemoryTaskRepo()
    const goalId = createGoalId("g-1")

    const { createTask } = await import("../../src/entities/Task")
    const { createBudget } = await import("../../src/entities/Budget")

    // Create a code task (will fail) and a review task (should be assigned next)
    await taskRepo.create(createTask({
      id: createTaskId("t-code"), goalId, description: "code task",
      phase: "code", budget: createBudget({ maxTokens: 1000, maxCostUsd: 0.1 }),
      status: "in_progress", branch: "devfleet/task-t-code",
    }))
    await taskRepo.create(createTask({
      id: createTaskId("t-review"), goalId, description: "review task",
      phase: "review", budget: createBudget({ maxTokens: 1000, maxCostUsd: 0.1 }),
    }))

    let assignCalled = false
    let assignedTaskId = ""
    const plugin = createTestPlugin({
      taskRepo,
      discardBranch: { execute: async () => ({ ok: true, value: undefined }) } as any,
      assignTask: {
        execute: async (taskId: any) => {
          assignCalled = true
          assignedTaskId = taskId
          return { ok: true, value: undefined }
        },
      } as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "task.failed",
      taskId: createTaskId("t-code"), agentId: createAgentId("dev-1"),
      reason: "error_max_turns", timestamp: new Date(),
    })

    expect(assignCalled).toBe(true)
    expect(assignedTaskId).toBe("t-review")
  })
```

Run: `npx vitest run tests/adapters/SupervisorPlugin.test.ts`
Expected: FAIL — `assignCalled` is `false`.

- [ ] **Step 3: Implement the fix**

In `src/adapters/plugins/agents/SupervisorPlugin.ts`, extract `advancePipeline` from `handleTaskCompleted` and call it from all failure handlers:

```typescript
  // Extract from handleTaskCompleted (replace lines 201-221):
  private async handleTaskCompleted(taskId: TaskId): Promise<void> {
    const task = await this.deps.taskRepo.findById(taskId)
    if (!task) return

    if (task.status === "in_progress") {
      const completed = { ...task, status: "completed" as const, version: task.version + 1 }
      await this.deps.taskRepo.update(completed)
    }

    if (task.assignedTo) {
      try {
        await this.deps.agentRegistry.updateStatus(task.assignedTo, "idle", null)
      } catch { /* Agent may not exist in test scenarios */ }
    }

    await this.advancePipeline(task.goalId)
  }

  private async handleTaskFailed(taskId: TaskId, reason: string): Promise<void> {
    const task = await this.deps.taskRepo.findById(taskId)
    if (!task) return

    if (task.branch) {
      await this.deps.discardBranch.execute(taskId, reason)
    } else {
      const updated = { ...task, status: "discarded" as const, version: task.version + 1 }
      await this.deps.taskRepo.update(updated)
    }

    if (task.assignedTo) {
      try {
        await this.deps.agentRegistry.updateStatus(task.assignedTo, "idle", null)
      } catch { /* Agent may not exist in test scenarios */ }
    }

    await this.advancePipeline(task.goalId)
  }

  private async advancePipeline(goalId: GoalId): Promise<void> {
    const allTasks = await this.deps.taskRepo.findByGoalId(goalId)
    const phases = this.deps.pipelineConfig.phases
    const queued = allTasks
      .filter(t => t.status === "queued")
      .sort((a, b) => phases.indexOf(a.phase) - phases.indexOf(b.phase))
    const nextTask = queued[0] ?? null

    if (nextTask) {
      const role = roleForPhase(nextTask.phase, this.deps.pipelineConfig)
      if (role) await this.deps.assignTask.execute(nextTask.id, role)
    } else {
      await this.deps.bus.emit({
        id: createMessageId(),
        type: "goal.completed",
        goalId,
        costUsd: 0,
        timestamp: new Date(),
      })
    }
  }
```

Also update `handleBudgetExceeded` and `handleAgentStuck`:

```typescript
  private async handleBudgetExceeded(taskId: TaskId): Promise<void> {
    const task = await this.deps.taskRepo.findById(taskId)
    await this.deps.discardBranch.execute(taskId, "budget exceeded")
    if (task) await this.advancePipeline(task.goalId)
  }

  private async handleAgentStuck(taskId: TaskId): Promise<void> {
    const task = await this.deps.taskRepo.findById(taskId)
    await this.deps.discardBranch.execute(taskId, "agent stuck")
    if (task) await this.advancePipeline(task.goalId)
  }
```

And the discard branch in `handleReviewRejected`:

```typescript
    } else if (result.value === "discard") {
      await this.deps.discardBranch.execute(taskId, "max retries exceeded")
      const task = await this.deps.taskRepo.findById(taskId)
      if (task) await this.advancePipeline(task.goalId)
    }
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/adapters/SupervisorPlugin.test.ts`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/plugins/agents/SupervisorPlugin.ts tests/adapters/SupervisorPlugin.test.ts
git commit -m "fix: advance pipeline after task failure, budget exceeded, and agent stuck"
```

---

## Task 1: ProjectContextProvider Port + Implementation

**Files:**
- Create: `src/use-cases/ports/ProjectContextProvider.ts`
- Create: `src/adapters/context/NodeProjectContextProvider.ts`
- Test: `tests/use-cases/ProjectContextProvider.test.ts`

- [ ] **Step 1: Create the port**

```typescript
// src/use-cases/ports/ProjectContextProvider.ts
import type { ProjectConfig } from "../../entities/ProjectConfig"

export interface ProjectContext {
  readonly claudeMd: string
  readonly projectConfig: ProjectConfig
  readonly fileTree: string
}

export interface ProjectContextProvider {
  getContext(): Promise<ProjectContext>
}
```

- [ ] **Step 2: Write failing test**

```typescript
// tests/use-cases/ProjectContextProvider.test.ts
import { describe, it, expect } from "vitest"
import { NodeProjectContextProvider } from "../../src/adapters/context/NodeProjectContextProvider"
import { UNKNOWN_PROJECT_CONFIG } from "../../src/entities/ProjectConfig"
import { tmpdir } from "node:os"
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

describe("NodeProjectContextProvider", () => {
  it("reads CLAUDE.md when present", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"))
    writeFileSync(join(dir, "CLAUDE.md"), "# Project Rules\nUse TypeScript.")
    writeFileSync(join(dir, "package.json"), "{}")
    mkdirSync(join(dir, "src"))
    writeFileSync(join(dir, "src", "index.ts"), "export {}")

    const provider = new NodeProjectContextProvider(dir)
    const ctx = await provider.getContext()

    expect(ctx.claudeMd).toContain("Project Rules")
    expect(ctx.projectConfig.language).toBe("typescript")
    expect(ctx.fileTree).toContain("src")
  })

  it("returns empty claudeMd when no CLAUDE.md exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"))
    writeFileSync(join(dir, "package.json"), "{}")

    const provider = new NodeProjectContextProvider(dir)
    const ctx = await provider.getContext()

    expect(ctx.claudeMd).toBe("")
  })

  it("caches result on second call", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"))
    writeFileSync(join(dir, "package.json"), "{}")

    const provider = new NodeProjectContextProvider(dir)
    const ctx1 = await provider.getContext()
    const ctx2 = await provider.getContext()

    expect(ctx1).toBe(ctx2) // same reference — cached
  })
})
```

Run: `npx vitest run tests/use-cases/ProjectContextProvider.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement NodeProjectContextProvider**

```typescript
// src/adapters/context/NodeProjectContextProvider.ts
import { readFile, readdir, stat } from "node:fs/promises"
import { join, relative } from "node:path"
import type { ProjectContext, ProjectContextProvider } from "../../use-cases/ports/ProjectContextProvider"
import { DetectProjectConfig } from "../../use-cases/DetectProjectConfig"
import { NodeFileSystem } from "../filesystem/NodeFileSystem"

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", ".next", "build", "coverage", ".worktrees"])
const MAX_DEPTH = 3

export class NodeProjectContextProvider implements ProjectContextProvider {
  private cached: ProjectContext | null = null

  constructor(private readonly rootDir: string) {}

  async getContext(): Promise<ProjectContext> {
    if (this.cached) return this.cached

    const claudeMd = await this.readClaudeMd()
    const fs = new NodeFileSystem(this.rootDir)
    const detector = new DetectProjectConfig(fs)
    const projectConfig = await detector.execute()
    const fileTree = await this.buildFileTree()

    this.cached = { claudeMd, projectConfig, fileTree }
    return this.cached
  }

  private async readClaudeMd(): Promise<string> {
    try {
      return await readFile(join(this.rootDir, "CLAUDE.md"), "utf-8")
    } catch {
      return ""
    }
  }

  private async buildFileTree(dir?: string, depth: number = 0): Promise<string> {
    if (depth >= MAX_DEPTH) return ""
    const currentDir = dir ?? this.rootDir
    const lines: string[] = []

    try {
      const entries = await readdir(currentDir, { withFileTypes: true })
      const sorted = entries
        .filter(e => !IGNORED_DIRS.has(e.name) && !e.name.startsWith("."))
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
          return a.name.localeCompare(b.name)
        })

      for (const entry of sorted) {
        const indent = "  ".repeat(depth)
        if (entry.isDirectory()) {
          lines.push(`${indent}${entry.name}/`)
          const subtree = await this.buildFileTree(join(currentDir, entry.name), depth + 1)
          if (subtree) lines.push(subtree)
        } else {
          lines.push(`${indent}${entry.name}`)
        }
      }
    } catch { /* directory not readable */ }

    return lines.join("\n")
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/use-cases/ProjectContextProvider.test.ts`
Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/ports/ProjectContextProvider.ts src/adapters/context/NodeProjectContextProvider.ts tests/use-cases/ProjectContextProvider.test.ts
git commit -m "feat: add ProjectContextProvider — reads CLAUDE.md, detects config, builds file tree"
```

---

## Task 2: ArtifactChain Port + GoalArtifactChain

**Files:**
- Create: `src/use-cases/ports/ArtifactChain.ts`
- Create: `src/use-cases/GoalArtifactChain.ts`
- Test: `tests/use-cases/GoalArtifactChain.test.ts`

- [ ] **Step 1: Create the port**

```typescript
// src/use-cases/ports/ArtifactChain.ts
import type { GoalId } from "../../entities/ids"
import type { ArtifactKind } from "../../entities/Artifact"

export interface PhaseArtifact {
  readonly phase: string
  readonly kind: ArtifactKind
  readonly content: string
}

export interface ArtifactChain {
  gather(goalId: GoalId): Promise<readonly PhaseArtifact[]>
}
```

- [ ] **Step 2: Write failing test**

```typescript
// tests/use-cases/GoalArtifactChain.test.ts
import { describe, it, expect } from "vitest"
import { GoalArtifactChain } from "../../src/use-cases/GoalArtifactChain"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryArtifactRepo } from "../../src/adapters/storage/InMemoryArtifactRepo"
import { createTask } from "../../src/entities/Task"
import { createArtifact } from "../../src/entities/Artifact"
import { createBudget } from "../../src/entities/Budget"
import { createGoalId, createTaskId, createArtifactId, createAgentId } from "../../src/entities/ids"

describe("GoalArtifactChain", () => {
  it("gathers artifacts in pipeline phase order", async () => {
    const taskRepo = new InMemoryTaskRepo()
    const artifactRepo = new InMemoryArtifactRepo()
    const phases = ["spec", "plan", "code", "review"]
    const goalId = createGoalId("g-1")
    const budget = createBudget({ maxTokens: 1000, maxCostUsd: 0.1 })

    // Create tasks in reverse order to test sorting
    const planTaskId = createTaskId("t-plan")
    await taskRepo.create(createTask({
      id: planTaskId, goalId, description: "plan", phase: "plan", budget, status: "completed",
    }))

    const specTaskId = createTaskId("t-spec")
    await taskRepo.create(createTask({
      id: specTaskId, goalId, description: "spec", phase: "spec", budget, status: "completed",
      artifacts: [createArtifactId("a-spec")],
    }))

    // Update plan task with artifact
    const planTask = await taskRepo.findById(planTaskId)
    await taskRepo.update({ ...planTask!, artifacts: [createArtifactId("a-plan")], version: 2 })

    // Create artifacts
    await artifactRepo.create(createArtifact({
      id: createArtifactId("a-spec"), kind: "spec", format: "markdown",
      taskId: specTaskId, createdBy: createAgentId("product-1"),
      content: "Spec content here",
      metadata: { requirementCount: 3, hasSuccessCriteria: true },
    }))

    await artifactRepo.create(createArtifact({
      id: createArtifactId("a-plan"), kind: "plan", format: "markdown",
      taskId: planTaskId, createdBy: createAgentId("architect-1"),
      content: "Plan content here",
      metadata: { stepCount: 5, estimatedTokens: 2000 },
    }))

    const chain = new GoalArtifactChain(taskRepo, artifactRepo, phases)
    const result = await chain.gather(goalId)

    expect(result).toHaveLength(2)
    expect(result[0]!.phase).toBe("spec")
    expect(result[0]!.kind).toBe("spec")
    expect(result[0]!.content).toBe("Spec content here")
    expect(result[1]!.phase).toBe("plan")
    expect(result[1]!.kind).toBe("plan")
  })

  it("returns empty array when no completed tasks exist", async () => {
    const taskRepo = new InMemoryTaskRepo()
    const artifactRepo = new InMemoryArtifactRepo()
    const chain = new GoalArtifactChain(taskRepo, artifactRepo, ["spec", "plan"])

    const result = await chain.gather(createGoalId("g-empty"))
    expect(result).toEqual([])
  })

  it("skips tasks with no artifacts", async () => {
    const taskRepo = new InMemoryTaskRepo()
    const artifactRepo = new InMemoryArtifactRepo()
    const goalId = createGoalId("g-1")
    const budget = createBudget({ maxTokens: 1000, maxCostUsd: 0.1 })

    await taskRepo.create(createTask({
      id: createTaskId("t-spec"), goalId, description: "spec", phase: "spec",
      budget, status: "completed", artifacts: [],
    }))

    const chain = new GoalArtifactChain(taskRepo, artifactRepo, ["spec", "plan"])
    const result = await chain.gather(goalId)
    expect(result).toEqual([])
  })
})
```

Run: `npx vitest run tests/use-cases/GoalArtifactChain.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement GoalArtifactChain**

```typescript
// src/use-cases/GoalArtifactChain.ts
import type { GoalId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import type { ArtifactRepository } from "./ports/ArtifactRepository"
import type { ArtifactChain, PhaseArtifact } from "./ports/ArtifactChain"

export class GoalArtifactChain implements ArtifactChain {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly artifacts: ArtifactRepository,
    private readonly phases: readonly string[],
  ) {}

  async gather(goalId: GoalId): Promise<readonly PhaseArtifact[]> {
    const allTasks = await this.tasks.findByGoalId(goalId)

    const completed = allTasks
      .filter(t => t.status === "completed" || t.status === "merged")
      .filter(t => t.artifacts.length > 0)
      .sort((a, b) => this.phases.indexOf(a.phase) - this.phases.indexOf(b.phase))

    const result: PhaseArtifact[] = []

    for (const task of completed) {
      for (const artifactId of task.artifacts) {
        const artifact = await this.artifacts.findById(artifactId)
        if (artifact) {
          result.push({
            phase: task.phase,
            kind: artifact.kind,
            content: artifact.content,
          })
        }
      }
    }

    return result
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/use-cases/GoalArtifactChain.test.ts`
Expected: All 3 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/ports/ArtifactChain.ts src/use-cases/GoalArtifactChain.ts tests/use-cases/GoalArtifactChain.test.ts
git commit -m "feat: add ArtifactChain — gathers prior phase artifacts in pipeline order"
```

---

## Task 3: ContextAwarePromptBuilder

**Files:**
- Create: `src/use-cases/ports/AgentPromptBuilder.ts`
- Create: `src/use-cases/ContextAwarePromptBuilder.ts`
- Test: `tests/use-cases/ContextAwarePromptBuilder.test.ts`

- [ ] **Step 1: Create the port**

```typescript
// src/use-cases/ports/AgentPromptBuilder.ts
import type { GoalId } from "../../entities/ids"

export interface AgentPromptBuilder {
  build(rolePrompt: string, goalId: GoalId): Promise<string>
}
```

- [ ] **Step 2: Write failing test**

```typescript
// tests/use-cases/ContextAwarePromptBuilder.test.ts
import { describe, it, expect } from "vitest"
import { ContextAwarePromptBuilder } from "../../src/use-cases/ContextAwarePromptBuilder"
import type { ProjectContextProvider, ProjectContext } from "../../src/use-cases/ports/ProjectContextProvider"
import type { ArtifactChain, PhaseArtifact } from "../../src/use-cases/ports/ArtifactChain"
import { createProjectConfig } from "../../src/entities/ProjectConfig"
import { createGoalId } from "../../src/entities/ids"

function fakeContextProvider(ctx: Partial<ProjectContext> = {}): ProjectContextProvider {
  return {
    getContext: async () => ({
      claudeMd: ctx.claudeMd ?? "# Rules\nUse TypeScript.",
      projectConfig: ctx.projectConfig ?? createProjectConfig({
        language: "typescript",
        buildCommand: "npm run build",
        testCommand: "npm test",
        installCommand: "npm install",
        sourceRoots: ["src"],
      }),
      fileTree: ctx.fileTree ?? "src/\n  index.ts",
    }),
  }
}

function fakeArtifactChain(artifacts: PhaseArtifact[] = []): ArtifactChain {
  return { gather: async () => artifacts }
}

describe("ContextAwarePromptBuilder", () => {
  it("combines role prompt, CLAUDE.md, project config, file tree, and artifacts", async () => {
    const builder = new ContextAwarePromptBuilder(
      fakeContextProvider(),
      fakeArtifactChain([
        { phase: "spec", kind: "spec", content: "Build a button component" },
        { phase: "plan", kind: "plan", content: "Step 1: Create button.tsx" },
      ]),
    )

    const prompt = await builder.build("You are a developer.", createGoalId("g-1"))

    expect(prompt).toContain("You are a developer.")
    expect(prompt).toContain("# Rules")
    expect(prompt).toContain("typescript")
    expect(prompt).toContain("src/\n  index.ts")
    expect(prompt).toContain("Build a button component")
    expect(prompt).toContain("Step 1: Create button.tsx")
  })

  it("works with no CLAUDE.md and no prior artifacts", async () => {
    const builder = new ContextAwarePromptBuilder(
      fakeContextProvider({ claudeMd: "" }),
      fakeArtifactChain([]),
    )

    const prompt = await builder.build("You are a reviewer.", createGoalId("g-1"))

    expect(prompt).toContain("You are a reviewer.")
    expect(prompt).toContain("typescript")
    expect(prompt).not.toContain("Prior work")
  })
})
```

Run: `npx vitest run tests/use-cases/ContextAwarePromptBuilder.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement ContextAwarePromptBuilder**

```typescript
// src/use-cases/ContextAwarePromptBuilder.ts
import type { GoalId } from "../entities/ids"
import type { AgentPromptBuilder } from "./ports/AgentPromptBuilder"
import type { ProjectContextProvider } from "./ports/ProjectContextProvider"
import type { ArtifactChain } from "./ports/ArtifactChain"

export class ContextAwarePromptBuilder implements AgentPromptBuilder {
  constructor(
    private readonly contextProvider: ProjectContextProvider,
    private readonly artifactChain: ArtifactChain,
  ) {}

  async build(rolePrompt: string, goalId: GoalId): Promise<string> {
    const ctx = await this.contextProvider.getContext()
    const artifacts = await this.artifactChain.gather(goalId)

    const sections: string[] = [rolePrompt]

    if (ctx.claudeMd) {
      sections.push(ctx.claudeMd)
    }

    sections.push([
      `Language: ${ctx.projectConfig.language}`,
      `Build: ${ctx.projectConfig.buildCommand}`,
      `Test: ${ctx.projectConfig.testCommand}`,
      `Source roots: ${ctx.projectConfig.sourceRoots.join(", ")}`,
    ].join("\n"))

    if (ctx.fileTree) {
      sections.push(`File structure:\n${ctx.fileTree}`)
    }

    if (artifacts.length > 0) {
      const artifactSections = artifacts.map(
        a => `### ${a.phase} (${a.kind})\n${a.content}`
      )
      sections.push(`## Prior work\n${artifactSections.join("\n\n")}`)
    }

    return sections.join("\n\n")
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx vitest run tests/use-cases/ContextAwarePromptBuilder.test.ts`
Expected: All 2 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/ports/AgentPromptBuilder.ts src/use-cases/ContextAwarePromptBuilder.ts tests/use-cases/ContextAwarePromptBuilder.test.ts
git commit -m "feat: add ContextAwarePromptBuilder — unified prompt assembly for all agents"
```

---

## Task 4: Add agent.tool_call Message Type

**Files:**
- Modify: `src/entities/Message.ts`

- [ ] **Step 1: Add the message interface and union member**

In `src/entities/Message.ts`, add before the `// Workspace` section (before line 287):

```typescript
// ---------------------------------------------------------------------------
// Agent activity
// ---------------------------------------------------------------------------
interface AgentToolCallMessage extends BaseMessage {
  readonly type: "agent.tool_call"
  readonly agentId: AgentId
  readonly taskId: TaskId
  readonly tool: string
  readonly target: string
}
```

Add `| AgentToolCallMessage` to the Message union type (after `AgentResumedMessage`).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/entities/Message.ts
git commit -m "feat: add agent.tool_call structured message type"
```

---

## Task 5: Parse stream_event in ClaudeAgentSdkAdapter

**Files:**
- Modify: `src/adapters/ai-providers/ClaudeAgentSdkAdapter.ts`
- Modify: `src/use-cases/ports/AgentSession.ts` (add tool_call event)
- Test: `tests/adapters/ClaudeAgentSdkAdapter.test.ts`

- [ ] **Step 1: Add tool_call to SessionEvent**

In `src/use-cases/ports/AgentSession.ts`, add to the `SessionEvent` type:

```typescript
  | { type: "tool_call"; tool: string; target: string }
```

- [ ] **Step 2: Write failing test**

```typescript
// tests/adapters/ClaudeAgentSdkAdapter.test.ts
import { describe, it, expect } from "vitest"
import { mapCapabilities } from "../../src/adapters/ai-providers/ClaudeAgentSdkAdapter"

describe("ClaudeAgentSdkAdapter", () => {
  describe("mapCapabilities", () => {
    it("maps file_access to file tools", () => {
      const tools = mapCapabilities(["file_access"])
      expect(tools).toContain("Read")
      expect(tools).toContain("Write")
      expect(tools).toContain("Edit")
      expect(tools).toContain("Glob")
      expect(tools).toContain("Grep")
    })

    it("maps shell to Bash", () => {
      const tools = mapCapabilities(["shell"])
      expect(tools).toContain("Bash")
    })

    it("combines multiple capabilities", () => {
      const tools = mapCapabilities(["file_access", "shell"])
      expect(tools).toHaveLength(6)
    })
  })
})
```

Run: `npx vitest run tests/adapters/ClaudeAgentSdkAdapter.test.ts`
Expected: Tests pass (testing existing functionality first).

- [ ] **Step 3: Add stream_event parsing to ClaudeAgentSdkAdapter**

In `src/adapters/ai-providers/ClaudeAgentSdkAdapter.ts`, add tool call tracking state before the `for await` loop and a new case in the switch:

Add before `for await (const message of stream)`:

```typescript
    let pendingToolName = ""
    let pendingToolInput = ""
```

Add to the switch statement, before the closing `}` of the `for await` loop:

```typescript
        case "stream_event": {
          const event = (message as any).event
          if (!event) break

          if (event.type === "content_block_start" && event.content_block?.type === "tool_use") {
            pendingToolName = event.content_block.name ?? ""
            pendingToolInput = ""
          }

          if (event.type === "content_block_delta" && event.delta?.type === "input_json_delta") {
            pendingToolInput += event.delta.partial_json ?? ""
          }

          if (event.type === "content_block_stop" && pendingToolName) {
            let target = ""
            try {
              const parsed = JSON.parse(pendingToolInput)
              target = parsed.file_path ?? parsed.command ?? parsed.pattern ?? parsed.path ?? ""
            } catch { /* partial JSON — best effort */ }

            yield { type: "tool_call" as const, tool: pendingToolName, target }
            pendingToolName = ""
            pendingToolInput = ""
          }
          break
        }
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/ai-providers/ClaudeAgentSdkAdapter.ts src/use-cases/ports/AgentSession.ts tests/adapters/ClaudeAgentSdkAdapter.test.ts
git commit -m "feat: parse stream_event tool calls in ClaudeAgentSdkAdapter"
```

---

## Task 6: Emit agent.tool_call from RunAgentSession

**Files:**
- Modify: `src/use-cases/RunAgentSession.ts`

- [ ] **Step 1: Add tool_call case to the event loop**

In `src/use-cases/RunAgentSession.ts`, add a new case in the `switch (event.type)` block, after the `"text"` case:

```typescript
          case "tool_call":
            await this.bus.emit({
              id: createMessageId(),
              type: "agent.tool_call",
              agentId,
              taskId: task.id,
              tool: event.tool,
              target: event.target,
              timestamp: new Date(),
            })
            break
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/use-cases/RunAgentSession.ts
git commit -m "feat: emit agent.tool_call messages on the bus during agent sessions"
```

---

## Task 7: Add Skip Phases + Retry with Hint

**Files:**
- Modify: `src/use-cases/CreateGoalFromCeo.ts`
- Modify: `src/entities/Message.ts` (add phases to GoalCreatedMessage + TaskRetryMessage)
- Modify: `src/adapters/plugins/agents/SupervisorPlugin.ts`

- [ ] **Step 1: Add phases to CreateGoalInput and GoalCreatedMessage**

In `src/use-cases/CreateGoalFromCeo.ts`, add `phases` to the input:

```typescript
export interface CreateGoalInput {
  readonly description: string
  readonly maxTokens: number
  readonly maxCostUsd: number
  readonly phases?: readonly string[]
}
```

Pass phases through to the `goal.created` message. In the `execute` method, change the `bus.emit` call:

```typescript
    await this.bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId: goal.id,
      description: goal.description,
      phases: input.phases,
      timestamp: new Date(),
    })
```

In `src/entities/Message.ts`, add `phases` to `GoalCreatedMessage`:

```typescript
interface GoalCreatedMessage extends BaseMessage {
  readonly type: "goal.created"
  readonly goalId: GoalId
  readonly description: string
  readonly phases?: readonly string[]
}
```

- [ ] **Step 2: Update SupervisorPlugin to use phases**

In `SupervisorPlugin.handleGoalCreated`, accept phases and filter task definitions. Change the method signature:

```typescript
  private async handleGoalCreated(goalId: GoalId, description: string, phases?: readonly string[]): Promise<void> {
```

Update the `handle` method call site:

```typescript
      case "goal.created":
        void this.handleGoalCreated(message.goalId, message.description, message.phases).catch(err =>
```

After parsing `taskDefs`, filter by requested phases:

```typescript
    // Filter to requested phases (if specified)
    const requestedPhases = phases ?? this.deps.pipelineConfig.phases
    const filteredDefs = taskDefs.filter(def => requestedPhases.includes(def.phase))
```

Use `filteredDefs` instead of `taskDefs` when creating `definitions`.

- [ ] **Step 3: Add retry-with-hint to SupervisorPlugin**

Add `"task.retry"` to the subscriptions list and add a handler:

In `subscriptions()`:
```typescript
    return [{
      types: [
        "goal.created", "task.completed", "task.failed", "task.retry",
        "code.completed",
        "review.approved", "review.rejected",
        "budget.exceeded", "agent.stuck",
      ],
    }]
```

In `handle()`:
```typescript
      case "task.retry":
        return this.handleTaskRetry(message.taskId, message.hint)
```

Add the handler:
```typescript
  private async handleTaskRetry(taskId: TaskId, hint: string): Promise<void> {
    const task = await this.deps.taskRepo.findById(taskId)
    if (!task) return

    const updatedDescription = `${task.description}\n\nUser hint: ${hint}`
    const retried = {
      ...task,
      description: updatedDescription,
      status: "queued" as const,
      assignedTo: null,
      retryCount: task.retryCount + 1,
      version: task.version + 1,
    }
    await this.deps.taskRepo.update(retried)

    const role = roleForPhase(task.phase, this.deps.pipelineConfig)
    if (role) await this.deps.assignTask.execute(taskId, role)
  }
```

Add the message type to `src/entities/Message.ts`:

```typescript
interface TaskRetryMessage extends BaseMessage {
  readonly type: "task.retry"
  readonly taskId: TaskId
  readonly hint: string
}
```

Add `| TaskRetryMessage` to the Message union.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors (or only composition-root errors from Task 7).

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/CreateGoalFromCeo.ts src/entities/Message.ts src/adapters/plugins/agents/SupervisorPlugin.ts
git commit -m "feat: add skip-phases and retry-with-hint intervention controls"
```

---

## Task 8: Delete Workspace Layer

**Files:**
- Delete: 14 workspace-related files
- Modify: `src/entities/Message.ts` (remove workspace messages)

- [ ] **Step 1: Delete workspace files**

```bash
rm src/use-cases/WorkspaceRunManager.ts
rm src/adapters/workspace/GitCloneIsolator.ts
rm src/use-cases/ports/WorkspaceIsolator.ts
rm src/entities/WorkspaceRun.ts
rm src/use-cases/ports/WorkspaceRunRepository.ts
rm src/adapters/storage/InMemoryWorkspaceRunRepository.ts
rm src/use-cases/CleanupWorkspace.ts
rm src/use-cases/GetWorkspaceRunStatus.ts
rm src/use-cases/StopWorkspace.ts
rm src/infrastructure/http/routes/workspaceRoutes.ts
rm src/adapters/git/NodeGitRemote.ts
rm src/use-cases/ports/GitRemote.ts
rm src/adapters/git/GitHubPullRequestCreator.ts
rm src/use-cases/ports/PullRequestCreator.ts
```

- [ ] **Step 2: Remove workspace messages from Message.ts**

Remove the `WorkspaceGoalDeliveredMessage`, `WorkspaceGoalFailedMessage`, `WorkspaceStatusChangedMessage` interfaces and their union members.

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "refactor: delete workspace cloning layer — 14 files removed"
```

---

## Task 9: Update Plugins + Rewire composition-root

This is the critical task — plugins and wiring change together so every commit compiles.

**Files:**
- Modify: `src/adapters/plugins/agents/ProductPlugin.ts`
- Modify: `src/adapters/plugins/agents/ArchitectPlugin.ts`
- Modify: `src/adapters/plugins/agents/DeveloperPlugin.ts`
- Modify: `src/adapters/plugins/agents/ReviewerPlugin.ts`
- Modify: `src/infrastructure/config/composition-root.ts`
- Modify: `src/infrastructure/http/createServer.ts`

- [ ] **Step 1: Update ProductPlugin**

Add to `ProductPluginDeps`:
```typescript
  readonly promptBuilder: AgentPromptBuilder
```

Add import:
```typescript
import type { AgentPromptBuilder } from "../../../use-cases/ports/AgentPromptBuilder"
```

Replace the config object in `handle()`:

```typescript
    const systemPrompt = await this.deps.promptBuilder.build(this.deps.systemPrompt, task.goalId)

    const config = {
      role: ROLES.PRODUCT,
      systemPrompt,
      capabilities: [] as const,
      model: this.deps.model,
      budget: task.budget,
      workingDir: this.deps.workspaceDir,
    }
```

- [ ] **Step 2: Update ArchitectPlugin**

Add `promptBuilder: AgentPromptBuilder` to deps, add import. Remove `artifactRepo` from deps.

Remove the manual artifact lookup (lines 54-59) and replace:

```typescript
    const systemPrompt = await this.deps.promptBuilder.build(this.deps.systemPrompt, task.goalId)

    const config = {
      role: ROLES.ARCHITECT,
      systemPrompt,
      capabilities: [] as const,
      model: this.deps.model,
      budget: task.budget,
      workingDir: this.deps.workspaceDir,
    }
```

Keep the artifact creation code — the architect still produces artifacts. It still needs `artifactRepo` and `createArtifact` for writing, but no longer reads artifacts directly.

- [ ] **Step 3: Update DeveloperPlugin**

Add `promptBuilder: AgentPromptBuilder` to deps, add import.

Replace the config object in `handle()`:

```typescript
    const systemPrompt = await this.deps.promptBuilder.build(this.deps.systemPrompt, task.goalId)

    const config = {
      role: ROLES.DEVELOPER,
      systemPrompt,
      capabilities: ["file_access" as const, "shell" as const],
      model: this.deps.model,
      budget: task.budget,
      workingDir: worktreePath,
    }
```

- [ ] **Step 4: Update ReviewerPlugin**

Add `promptBuilder: AgentPromptBuilder` to deps, add import. Remove `artifactRepo` from deps (for reading — keep `createArtifact` for writing review artifacts).

Remove the manual artifact lookup (lines 54-55) and replace:

```typescript
    const systemPrompt = await this.deps.promptBuilder.build(this.deps.systemPrompt, task.goalId)

    const config = {
      role: ROLES.REVIEWER,
      systemPrompt,
      capabilities: ["file_access" as const, "shell" as const],
      model: this.deps.model,
      budget: task.budget,
      workingDir: this.deps.workspaceDir,
    }
```

Keep the artifact creation code and review verdict logic.

- [ ] **Step 5: Rewire composition-root.ts**

Remove workspace imports:
```typescript
// DELETE these imports:
import { WorkspaceRunManager } from "../../use-cases/WorkspaceRunManager"
import { GitCloneIsolator } from "../../adapters/workspace/GitCloneIsolator"
import { NodeGitRemote } from "../../adapters/git/NodeGitRemote"
import { GitHubPullRequestCreator } from "../../adapters/git/GitHubPullRequestCreator"
import { InMemoryWorkspaceRunRepository } from "../../adapters/storage/InMemoryWorkspaceRunRepository"
```

Add new imports:
```typescript
import { NodeProjectContextProvider } from "../../adapters/context/NodeProjectContextProvider"
import { GoalArtifactChain } from "../../use-cases/GoalArtifactChain"
import { ContextAwarePromptBuilder } from "../../use-cases/ContextAwarePromptBuilder"
```

Remove section 10b (workspace run management — lines 444-461).

Remove `workspaceManager` and `workspaceRunRepo` from `dashboardDeps`.

Remove `await workspaceManager.stopAll()` from the `stop()` function.

Add after use-case instantiations:
```typescript
  const contextProvider = new NodeProjectContextProvider(config.workspaceDir)
  const artifactChain = new GoalArtifactChain(taskRepo, artifactRepo, DEFAULT_PIPELINE.phases)
  const promptBuilder = new ContextAwarePromptBuilder(contextProvider, artifactChain)
```

Add `promptBuilder` to every agent plugin's deps:
```typescript
  // In ProductPlugin deps:
  promptBuilder,

  // In ArchitectPlugin deps:
  promptBuilder,

  // In DeveloperPlugin deps:
  promptBuilder,

  // In ReviewerPlugin deps:
  promptBuilder,
```

- [ ] **Step 6: Clean up createServer.ts**

Remove `workspaceManager` and `workspaceRunRepo` from `DashboardDeps` interface.

Remove the workspace route:
```typescript
  app.use("/api/workspace", workspaceRoutes(...))
```

Remove workspace references from goal routes (the `ws = deps.workspaceManager.getActiveSystem()` calls). Goals now run on the main system directly.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors. Every plugin has `promptBuilder`, every dep is wired.

- [ ] **Step 8: Run all tests**

Run: `npx vitest run`
Expected: All backend tests pass.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "refactor: unify all agent plugins with ContextAwarePromptBuilder, remove workspace wiring"
```

---

## Task 10: Update CLI to Dashboard-Only Mode

**Files:**
- Modify: `src/infrastructure/cli/index.ts`

- [ ] **Step 1: Remove readline prompt, show dashboard URL**

Replace the CLI's `main()` function to start the server without a readline prompt:

```typescript
async function main(): Promise<void> {
  console.log("DevFleet — Visual Claude Code")
  console.log("=============================")

  const system = await buildSystem({
    workspaceDir: WORKSPACE_DIR,
    mockMode: MOCK_MODE,
    developerModel: process.env["DEVELOPER_MODEL"] ?? "claude-sonnet-4-20250514",
    supervisorModel: process.env["SUPERVISOR_MODEL"] ?? "claude-sonnet-4-20250514",
    reviewerModel: process.env["REVIEWER_MODEL"] ?? "claude-sonnet-4-20250514",
    pipelineTimeoutMs: parseInt(process.env["PIPELINE_TIMEOUT_MS"] ?? "300000", 10),
    maxRetries: parseInt(process.env["MAX_RETRIES"] ?? "2", 10),
  })

  await system.start()

  const httpPort = parseInt(process.env["HTTP_PORT"] ?? "3100", 10)
  const app = createServer(system.dashboardDeps)
  const server = http.createServer(app)
  server.listen(httpPort, () => {
    console.log(`\n  Dashboard: http://localhost:${httpPort}\n`)
  })

  // Keep existing progress logging subscription (bus.subscribe for progressTypes)

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\nShutting down...")
    server.close()
    await system.stop()
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}
```

Remove the `readline` import, `question` helper, goal creation logic, and completion/timeout waiters. Goals are now created through the dashboard only.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/cli/index.ts
git commit -m "refactor: CLI starts dashboard server only — no readline prompt"
```

---

## Task 11: Add Retry API Endpoint

**Files:**
- Modify: `src/infrastructure/http/createServer.ts` (or appropriate route file)

- [ ] **Step 1: Add POST /api/tasks/:taskId/retry endpoint**

In the task routes, add:

```typescript
  app.post("/api/tasks/:taskId/retry", async (req, res) => {
    const { taskId } = req.params
    const { hint } = req.body as { hint?: string }

    if (!hint || !hint.trim()) {
      return res.status(400).json({ error: "hint is required" })
    }

    const message: Message = {
      id: createMessageId(),
      type: "task.retry",
      taskId,
      hint: hint.trim(),
      timestamp: new Date(),
    }
    await deps.bus.emit(message)

    res.json({ ok: true })
  })
```

Import `createMessageId` and `Message` at the top of the file if not already imported. Note: no `as any` — `task.retry` is a proper member of the Message union (added in Task 7).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/http/createServer.ts
git commit -m "feat: add POST /api/tasks/:taskId/retry endpoint for retry-with-hint"
```

---

## Task 12: Final Verification

**Files:**
- Modify: `src/use-cases/index.ts` (exports)
- Run: full test suite + type check + dead reference scan

- [ ] **Step 1: Add exports for new modules**

In `src/use-cases/index.ts`, add:

```typescript
export * from "./GoalArtifactChain"
export * from "./ContextAwarePromptBuilder"
```

- [ ] **Step 2: Scan for dead references to deleted files**

```bash
grep -r "WorkspaceRunManager\|GitCloneIsolator\|WorkspaceIsolator\|WorkspaceRun\|NodeGitRemote\|GitHubPullRequestCreator" src/ --include="*.ts"
```

Expected: No matches. If any remain, remove them.

- [ ] **Step 3: Type-check entire project**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Run full test suite**

Run: `npx vitest run`
Expected: All backend tests pass.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: final cleanup — exports, dead reference scan, full verification"
```
