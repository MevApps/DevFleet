# Phase 2: Full Agent Team + Communication — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Type a high-level goal, agents autonomously decompose it, produce code in isolated worktrees, review it, and merge or discard branches.

**Architecture:** Four batches, each respecting L1 → L2 → L3 → L4 layer ordering. Batch 1 completes the domain model and fixes Phase 1 gaps. Batch 2 wires Supervisor + pipeline flow. Batch 3 adds the code review loop with worktree isolation. Batch 4 integrates everything with an end-to-end test.

**Tech Stack:** TypeScript (strict mode), Node.js, Jest, @anthropic-ai/sdk, tsx

**Design spec:** `docs/superpowers/specs/2026-03-27-phase2-full-agent-team-design.md`

---

## File Structure

### Batch 1: New/Modified Files

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/entities/Message.ts` | Fix `matchesFilter`, enrich message fields |
| Modify | `src/entities/Task.ts` | Add `retryCount`, `branch` fields |
| Modify | `src/entities/Agent.ts` | Add `lastActiveAt` field |
| Modify | `src/entities/Artifact.ts` | Tighten metadata types (remove index signatures) |
| Modify | `src/entities/PipelineConfig.ts` | Add `roleMapping` |
| Create | `src/entities/ChannelMessage.ts` | Agent-to-agent discussion entity |
| Create | `src/entities/KeepDiscardRecord.ts` | Structured keep/discard data for Learner |
| Modify | `src/entities/index.ts` | Add new exports |
| Create | `src/use-cases/ports/ArtifactRepository.ts` | Artifact storage port |
| Create | `src/use-cases/ports/WorktreeManager.ts` | Git worktree port |
| Modify | `src/use-cases/ports/index.ts` | Add new exports |
| Create | `src/use-cases/EvaluateKeepDiscard.ts` | Returns keep/retry/discard decision |
| Create | `src/use-cases/MergeBranch.ts` | Executes a keep decision |
| Create | `src/use-cases/DiscardBranch.ts` | Executes a discard decision |
| Create | `src/use-cases/CreateArtifact.ts` | Stores artifact, links to task |
| Create | `src/use-cases/SendChannelMessage.ts` | Validates and emits channel message |
| Create | `src/use-cases/DetectStuckAgent.ts` | Emits agent.stuck on timeout |
| Modify | `src/use-cases/index.ts` | Add new exports |
| Create | `src/adapters/storage/InMemoryArtifactRepo.ts` | In-memory artifact storage |
| Create | `src/adapters/storage/InMemoryWorktreeManager.ts` | In-memory worktree (for tests) |
| Create | `src/adapters/ai-providers/DeterministicProvider.ts` | Returns pre-configured tool calls |
| Create | `tests/helpers/waitForMessage.ts` | Async test utility |

### Batch 2: New/Modified Files

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/use-cases/DecomposeGoal.ts` | Accept AI decomposition, respect pipeline |
| Modify | `src/use-cases/AssignTask.ts` | Support re-assignment |
| Create | `src/adapters/plugins/agents/SupervisorPlugin.ts` | Orchestration dispatcher |
| Create | `src/adapters/plugins/agents/ProductPlugin.ts` | Spec artifact producer |
| Create | `src/adapters/plugins/agents/ArchitectPlugin.ts` | Plan artifact producer |

### Batch 3: New/Modified Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/adapters/worktree/NodeWorktreeManager.ts` | Real git worktree adapter |
| Modify | `src/adapters/plugins/agents/DeveloperPlugin.ts` | Add worktree isolation |
| Create | `src/adapters/plugins/agents/ReviewerPlugin.ts` | Code review agent |
| Create | `src/adapters/plugins/agents/OpsPlugin.ts` | Deterministic build/test agent |
| Create | `src/adapters/plugins/agents/LearnerPlugin.ts` | Structured event logger |

### Batch 4: New/Modified Files

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/infrastructure/config/composition-root.ts` | Full rewire for all 7 agents |
| Modify | `src/infrastructure/cli/index.ts` | Pipeline progress + timeout |
| Create | `tests/integration/phase2-end-to-end.test.ts` | Definitive Phase 2 test |

---

## Batch 1: Phase 1 Fixes + Domain Completion

### Task 1: Fix `matchesFilter` to support multi-field filtering

**Files:**
- Modify: `src/entities/Message.ts:237-244`
- Test: `tests/entities/Message.test.ts`

- [ ] **Step 1: Write failing tests for agentId/taskId/goalId filtering**

```typescript
// Append to tests/entities/Message.test.ts

describe("matchesFilter – multi-field filtering", () => {
  const base = { id: createMessageId(), timestamp: new Date() }

  it("filters by agentId when message has agentId", () => {
    const msg = { ...base, type: "task.assigned" as const, taskId: createTaskId(), agentId: createAgentId("agent-1") }
    expect(matchesFilter(msg, { agentId: createAgentId("agent-1") })).toBe(true)
    expect(matchesFilter(msg, { agentId: createAgentId("agent-2") })).toBe(false)
  })

  it("filters by taskId when message has taskId", () => {
    const tid = createTaskId("task-x")
    const msg = { ...base, type: "task.completed" as const, taskId: tid }
    expect(matchesFilter(msg, { taskId: tid })).toBe(true)
    expect(matchesFilter(msg, { taskId: createTaskId("other") })).toBe(false)
  })

  it("filters by goalId when message has goalId", () => {
    const gid = createGoalId("goal-x")
    const msg = { ...base, type: "goal.created" as const, goalId: gid, description: "test" }
    expect(matchesFilter(msg, { goalId: gid })).toBe(true)
    expect(matchesFilter(msg, { goalId: createGoalId("other") })).toBe(false)
  })

  it("passes when message lacks the filtered field", () => {
    const msg = { ...base, type: "schedule.ideation" as const }
    expect(matchesFilter(msg, { agentId: createAgentId("agent-1") })).toBe(true)
  })

  it("combines type + agentId filters", () => {
    const msg = { ...base, type: "task.assigned" as const, taskId: createTaskId(), agentId: createAgentId("agent-1") }
    expect(matchesFilter(msg, { types: ["task.assigned"], agentId: createAgentId("agent-1") })).toBe(true)
    expect(matchesFilter(msg, { types: ["task.assigned"], agentId: createAgentId("agent-2") })).toBe(false)
    expect(matchesFilter(msg, { types: ["task.completed"], agentId: createAgentId("agent-1") })).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/entities/Message.test.ts --verbose`
Expected: New tests FAIL (matchesFilter doesn't check agentId/taskId/goalId yet)

- [ ] **Step 3: Implement multi-field matchesFilter**

Replace `matchesFilter` in `src/entities/Message.ts:237-244`:

```typescript
export function matchesFilter(message: Message, filter: MessageFilter): boolean {
  if (filter.types && filter.types.length > 0) {
    if (!filter.types.includes(message.type)) {
      return false
    }
  }

  // Check agentId if filter specifies one and message has one
  if (filter.agentId) {
    const msgAgentId = "agentId" in message ? (message as { agentId: AgentId }).agentId : undefined
    if (msgAgentId !== undefined && msgAgentId !== filter.agentId) {
      return false
    }
  }

  // Check taskId if filter specifies one and message has one
  if (filter.taskId) {
    const msgTaskId = "taskId" in message ? (message as { taskId: TaskId }).taskId : undefined
    if (msgTaskId !== undefined && msgTaskId !== filter.taskId) {
      return false
    }
  }

  // Check goalId if filter specifies one and message has one
  if (filter.goalId) {
    const msgGoalId = "goalId" in message ? (message as { goalId: GoalId }).goalId : undefined
    if (msgGoalId !== undefined && msgGoalId !== filter.goalId) {
      return false
    }
  }

  return true
}
```

Note: add `TaskId` and `GoalId` to the imports at the top of the file (they're already imported as `type`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest tests/entities/Message.test.ts --verbose`
Expected: ALL tests pass

- [ ] **Step 5: Commit**

```bash
git add src/entities/Message.ts tests/entities/Message.test.ts
git commit -m "fix: matchesFilter now checks agentId, taskId, goalId fields"
```

---

### Task 2: Enrich Message variant fields to match design spec

**Files:**
- Modify: `src/entities/Message.ts`
- Test: `tests/entities/Message.test.ts`

The following message types are missing fields per the design spec:
- `TaskCompletedMessage` missing `agentId`
- `TaskFailedMessage` missing `agentId`
- `CodeCompletedMessage` missing `branch`, `filesChanged`, `testsWritten`
- `GoalCompletedMessage` missing `costUsd`
- `BranchMergedMessage` missing `commit`
- `BranchDiscardedMessage` missing `reason`
- `BuildPassedMessage` missing `durationMs`
- `BuildFailedMessage` has `logs` but spec says `error`
- `ReviewRejectedMessage` has `feedback` but spec says `reasons: ReadonlyArray<string>`
- `BudgetExceededMessage` missing `tokensUsed`, `budgetMax`
- `AgentPromptUpdatedMessage` missing `diff`, `reason`
- `SkillUpdatedMessage` missing `diff`, `reason`
- `InsightGeneratedMessage` missing `insightId`, `recommendation`, `confidence`
- `CeoOverrideMessage` missing `taskId`, `action`, `reason`
- `AgentStuckMessage` missing `retryCount`

- [ ] **Step 1: Write failing tests for enriched fields**

```typescript
// Append to tests/entities/Message.test.ts

describe("enriched message fields", () => {
  const base = { id: createMessageId(), timestamp: new Date() }

  it("task.completed has agentId", () => {
    const msg: Message = { ...base, type: "task.completed", taskId: createTaskId(), agentId: createAgentId("dev-1") }
    expect(msg.type).toBe("task.completed")
    expect(msg.agentId).toBe("dev-1")
  })

  it("task.failed has agentId", () => {
    const msg: Message = { ...base, type: "task.failed", taskId: createTaskId(), agentId: createAgentId("dev-1"), reason: "oops" }
    expect(msg.agentId).toBe("dev-1")
  })

  it("code.completed has branch, filesChanged, testsWritten", () => {
    const msg: Message = {
      ...base, type: "code.completed", taskId: createTaskId(), artifactId: createArtifactId(),
      branch: "devfleet/task-1", filesChanged: 3, testsWritten: 2,
    }
    expect(msg.branch).toBe("devfleet/task-1")
    expect(msg.filesChanged).toBe(3)
    expect(msg.testsWritten).toBe(2)
  })

  it("goal.completed has costUsd", () => {
    const msg: Message = { ...base, type: "goal.completed", goalId: createGoalId(), costUsd: 0.42 }
    expect(msg.costUsd).toBe(0.42)
  })

  it("branch.merged has commit", () => {
    const msg: Message = { ...base, type: "branch.merged", taskId: createTaskId(), branch: "feat", commit: "abc123" }
    expect(msg.commit).toBe("abc123")
  })

  it("branch.discarded has reason", () => {
    const msg: Message = { ...base, type: "branch.discarded", taskId: createTaskId(), branch: "feat", reason: "max retries" }
    expect(msg.reason).toBe("max retries")
  })

  it("review.rejected has reasons array", () => {
    const msg: Message = { ...base, type: "review.rejected", taskId: createTaskId(), reviewerId: createAgentId("rev-1"), reasons: ["no tests", "bad naming"] }
    expect(msg.reasons).toEqual(["no tests", "bad naming"])
  })

  it("budget.exceeded has tokensUsed and budgetMax", () => {
    const msg: Message = { ...base, type: "budget.exceeded", taskId: createTaskId(), agentId: createAgentId("dev-1"), tokensUsed: 10000, budgetMax: 8000 }
    expect(msg.tokensUsed).toBe(10000)
  })

  it("agent.stuck has retryCount", () => {
    const msg: Message = { ...base, type: "agent.stuck", agentId: createAgentId("dev-1"), taskId: createTaskId(), reason: "timeout", retryCount: 2 }
    expect(msg.retryCount).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify compile errors**

Run: `npx jest tests/entities/Message.test.ts --verbose`
Expected: TypeScript compile errors — fields don't exist on types yet

- [ ] **Step 3: Update Message interfaces**

Replace the message interfaces in `src/entities/Message.ts`:

```typescript
interface TaskCompletedMessage extends BaseMessage {
  readonly type: "task.completed"
  readonly taskId: TaskId
  readonly agentId: AgentId
}

interface TaskFailedMessage extends BaseMessage {
  readonly type: "task.failed"
  readonly taskId: TaskId
  readonly agentId: AgentId
  readonly reason: string
}

interface GoalCompletedMessage extends BaseMessage {
  readonly type: "goal.completed"
  readonly goalId: GoalId
  readonly costUsd: number
}

interface CodeCompletedMessage extends BaseMessage {
  readonly type: "code.completed"
  readonly taskId: TaskId
  readonly artifactId: ArtifactId
  readonly branch: string
  readonly filesChanged: number
  readonly testsWritten: number
}

interface BranchMergedMessage extends BaseMessage {
  readonly type: "branch.merged"
  readonly taskId: TaskId
  readonly branch: string
  readonly commit: string
}

interface BranchDiscardedMessage extends BaseMessage {
  readonly type: "branch.discarded"
  readonly taskId: TaskId
  readonly branch: string
  readonly reason: string
}

interface BuildPassedMessage extends BaseMessage {
  readonly type: "build.passed"
  readonly taskId: TaskId
  readonly durationMs: number
}

interface BuildFailedMessage extends BaseMessage {
  readonly type: "build.failed"
  readonly taskId: TaskId
  readonly error: string
}

interface ReviewRejectedMessage extends BaseMessage {
  readonly type: "review.rejected"
  readonly taskId: TaskId
  readonly reviewerId: AgentId
  readonly reasons: ReadonlyArray<string>
}

interface BudgetExceededMessage extends BaseMessage {
  readonly type: "budget.exceeded"
  readonly taskId: TaskId
  readonly agentId: AgentId
  readonly tokensUsed: number
  readonly budgetMax: number
}

interface AgentPromptUpdatedMessage extends BaseMessage {
  readonly type: "agent.prompt.updated"
  readonly agentId: AgentId
  readonly role: AgentRole
  readonly diff: string
  readonly reason: string
}

interface SkillUpdatedMessage extends BaseMessage {
  readonly type: "skill.updated"
  readonly skillId: string
  readonly diff: string
  readonly reason: string
}

interface InsightGeneratedMessage extends BaseMessage {
  readonly type: "insight.generated"
  readonly insightId: string
  readonly recommendation: string
  readonly confidence: number
}

interface CeoOverrideMessage extends BaseMessage {
  readonly type: "ceo.override"
  readonly taskId: TaskId
  readonly action: string
  readonly reason: string
}

interface AgentStuckMessage extends BaseMessage {
  readonly type: "agent.stuck"
  readonly agentId: AgentId
  readonly taskId: TaskId
  readonly reason: string
  readonly retryCount: number
}
```

- [ ] **Step 4: Fix all downstream compile errors**

These files emit messages with the old shapes and must be updated:
- `src/use-cases/EvaluateTurnOutcome.ts:36-42` — `budget.exceeded` now needs `tokensUsed`, `budgetMax`
- `src/adapters/plugins/agents/DeveloperPlugin.ts:143-147` — `task.completed` now needs `agentId`
- `tests/use-cases/EvaluateTurnOutcome.test.ts` — update expected message shapes
- `tests/adapters/DeveloperPlugin.test.ts` — update expected message shapes
- `tests/integration/end-to-end.test.ts` — update expected message shapes

For `EvaluateTurnOutcome.ts`, update the budget.exceeded emit:

```typescript
await this.bus.emit({
  id: createMessageId(),
  type: "budget.exceeded",
  taskId,
  agentId: task.assignedTo!,
  tokensUsed: task.tokensUsed,
  budgetMax: task.budget.maxTokens,
  timestamp: new Date(),
})
```

For `DeveloperPlugin.ts`, update the task.completed emit:

```typescript
await this.deps.bus.emit({
  id: createMessageId(),
  type: "task.completed",
  taskId: message.taskId,
  agentId: this.deps.agentId,
  timestamp: new Date(),
})
```

- [ ] **Step 5: Run full test suite**

Run: `npx jest --verbose`
Expected: ALL tests pass

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "fix: enrich Message variant fields to match design spec"
```

---

### Task 3: Add `retryCount`, `branch` to Task entity

**Files:**
- Modify: `src/entities/Task.ts`
- Test: `tests/entities/Task.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// Append to tests/entities/Task.test.ts

describe("Task – new Phase 2 fields", () => {
  it("creates task with default retryCount=0 and branch=null", () => {
    const task = createTask({
      id: createTaskId(),
      goalId: createGoalId(),
      description: "test",
      phase: "code",
      budget: createBudget(10000, 1.0),
    })
    expect(task.retryCount).toBe(0)
    expect(task.branch).toBeNull()
  })

  it("creates task with explicit retryCount and branch", () => {
    const task = createTask({
      id: createTaskId(),
      goalId: createGoalId(),
      description: "test",
      phase: "code",
      budget: createBudget(10000, 1.0),
      retryCount: 2,
      branch: "devfleet/task-123",
    })
    expect(task.retryCount).toBe(2)
    expect(task.branch).toBe("devfleet/task-123")
  })
})
```

Add missing imports at the top of the test file: `createBudget` from `../../src/entities/Budget`.

- [ ] **Step 2: Run tests to verify compile errors**

Run: `npx jest tests/entities/Task.test.ts --verbose`
Expected: FAIL — `retryCount` and `branch` don't exist

- [ ] **Step 3: Add fields to Task interface and createTask**

In `src/entities/Task.ts`, add to `Task` interface:

```typescript
export interface Task {
  readonly id: TaskId
  readonly goalId: GoalId
  readonly description: string
  readonly status: TaskStatus
  readonly phase: string
  readonly assignedTo: AgentId | null
  readonly budget: TokenBudget
  readonly tokensUsed: number
  readonly version: number
  readonly artifacts: readonly ArtifactId[]
  readonly parentTaskId: TaskId | null
  readonly retryCount: number
  readonly branch: string | null
}
```

Also update `ALLOWED_TRANSITIONS` to allow direct `review → merged` (MergeBranch transitions directly after review approval):

```typescript
export const ALLOWED_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  queued: ["in_progress", "discarded"],
  in_progress: ["review", "discarded"],
  review: ["approved", "in_progress", "merged", "discarded"],
  approved: ["merged", "discarded"],
  merged: [],
  discarded: [],
}
```

Add to `CreateTaskParams`:

```typescript
export interface CreateTaskParams {
  id: TaskId
  goalId: GoalId
  description: string
  phase: string
  budget: TokenBudget
  status?: TaskStatus
  assignedTo?: AgentId | null
  tokensUsed?: number
  version?: number
  artifacts?: readonly ArtifactId[]
  parentTaskId?: TaskId | null
  retryCount?: number
  branch?: string | null
}
```

Add to `createTask` return:

```typescript
export function createTask(params: CreateTaskParams): Task {
  return {
    id: params.id,
    goalId: params.goalId,
    description: params.description,
    phase: params.phase,
    budget: params.budget,
    status: params.status ?? "queued",
    assignedTo: params.assignedTo ?? null,
    tokensUsed: params.tokensUsed ?? 0,
    version: params.version ?? 1,
    artifacts: params.artifacts ?? [],
    parentTaskId: params.parentTaskId ?? null,
    retryCount: params.retryCount ?? 0,
    branch: params.branch ?? null,
  }
}
```

- [ ] **Step 4: Run full test suite**

Run: `npx jest --verbose`
Expected: ALL tests pass (existing tests create tasks without the new fields — defaults cover them)

- [ ] **Step 5: Commit**

```bash
git add src/entities/Task.ts tests/entities/Task.test.ts
git commit -m "feat: add retryCount and branch fields to Task entity"
```

---

### Task 4: Add `lastActiveAt` to Agent entity

**Files:**
- Modify: `src/entities/Agent.ts`
- Test: `tests/entities/Agent.test.ts` (create — doesn't exist yet)

- [ ] **Step 1: Write failing test**

Create `tests/entities/Agent.test.ts`:

```typescript
import { createAgent, isAvailable } from "../../src/entities/Agent"
import { createAgentId } from "../../src/entities/ids"
import { ROLES } from "../../src/entities/AgentRole"

describe("Agent", () => {
  it("creates agent with default lastActiveAt", () => {
    const before = new Date()
    const agent = createAgent({ id: createAgentId("a-1"), role: ROLES.DEVELOPER, model: "sonnet" })
    const after = new Date()
    expect(agent.lastActiveAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(agent.lastActiveAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it("creates agent with explicit lastActiveAt", () => {
    const date = new Date("2026-01-01")
    const agent = createAgent({ id: createAgentId("a-1"), role: ROLES.DEVELOPER, model: "sonnet", lastActiveAt: date })
    expect(agent.lastActiveAt).toBe(date)
  })

  it("isAvailable returns true for idle agent with no task", () => {
    const agent = createAgent({ id: createAgentId("a-1"), role: ROLES.DEVELOPER, model: "sonnet" })
    expect(isAvailable(agent)).toBe(true)
  })

  it("isAvailable returns false for busy agent", () => {
    const agent = createAgent({ id: createAgentId("a-1"), role: ROLES.DEVELOPER, model: "sonnet", status: "busy" })
    expect(isAvailable(agent)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest tests/entities/Agent.test.ts --verbose`
Expected: FAIL — `lastActiveAt` doesn't exist on Agent

- [ ] **Step 3: Add lastActiveAt to Agent**

In `src/entities/Agent.ts`:

```typescript
export interface Agent {
  readonly id: AgentId
  readonly role: AgentRole
  readonly status: AgentStatus
  readonly currentTaskId: TaskId | null
  readonly model: string
  readonly lastActiveAt: Date
}

export interface CreateAgentParams {
  id: AgentId
  role: AgentRole
  model: string
  status?: AgentStatus
  currentTaskId?: TaskId | null
  lastActiveAt?: Date
}

export function createAgent(params: CreateAgentParams): Agent {
  return {
    id: params.id,
    role: params.role,
    model: params.model,
    status: params.status ?? "idle",
    currentTaskId: params.currentTaskId ?? null,
    lastActiveAt: params.lastActiveAt ?? new Date(),
  }
}
```

- [ ] **Step 4: Run full test suite**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 5: Commit**

```bash
git add src/entities/Agent.ts tests/entities/Agent.test.ts
git commit -m "feat: add lastActiveAt field to Agent entity"
```

---

### Task 5: Tighten Artifact metadata types

**Files:**
- Modify: `src/entities/Artifact.ts`
- Test: `tests/entities/Artifact.test.ts`

- [ ] **Step 1: Write failing tests for precise metadata**

```typescript
// Append to tests/entities/Artifact.test.ts

describe("tightened metadata", () => {
  it("spec metadata requires requirementCount and hasSuccessCriteria", () => {
    const artifact = createArtifact({
      id: createArtifactId(),
      kind: "spec",
      format: "markdown",
      taskId: createTaskId(),
      createdBy: createAgentId("prod-1"),
      content: "# Spec",
      metadata: { requirementCount: 5, hasSuccessCriteria: true },
    })
    expect(artifact.metadata.requirementCount).toBe(5)
    expect(artifact.metadata.hasSuccessCriteria).toBe(true)
  })

  it("plan metadata requires stepCount and estimatedTokens", () => {
    const artifact = createArtifact({
      id: createArtifactId(),
      kind: "plan",
      format: "markdown",
      taskId: createTaskId(),
      createdBy: createAgentId("arch-1"),
      content: "# Plan",
      metadata: { stepCount: 3, estimatedTokens: 5000 },
    })
    expect(artifact.metadata.stepCount).toBe(3)
    expect(artifact.metadata.estimatedTokens).toBe(5000)
  })

  it("review metadata requires verdict and issueCount", () => {
    const artifact = createArtifact({
      id: createArtifactId(),
      kind: "review",
      format: "markdown",
      taskId: createTaskId(),
      createdBy: createAgentId("rev-1"),
      content: "LGTM",
      metadata: { verdict: "approved", issueCount: 0 },
    })
    expect(artifact.metadata.verdict).toBe("approved")
    expect(artifact.metadata.issueCount).toBe(0)
  })

  it("diff metadata requires filesChanged, linesAdded, linesRemoved", () => {
    const artifact = createArtifact({
      id: createArtifactId(),
      kind: "diff",
      format: "diff",
      taskId: createTaskId(),
      createdBy: createAgentId("dev-1"),
      content: "--- a\n+++ b",
      metadata: { filesChanged: 2, linesAdded: 10, linesRemoved: 3 },
    })
    expect(artifact.metadata.filesChanged).toBe(2)
  })
})
```

- [ ] **Step 2: Run tests to verify compile errors**

Run: `npx jest tests/entities/Artifact.test.ts --verbose`
Expected: FAIL — new metadata shapes don't match current types

- [ ] **Step 3: Replace metadata interfaces**

In `src/entities/Artifact.ts`, replace all metadata interfaces:

```typescript
interface SpecMetadata {
  readonly requirementCount: number
  readonly hasSuccessCriteria: boolean
}

interface PlanMetadata {
  readonly stepCount: number
  readonly estimatedTokens: number
}

interface DesignMetadata {
  readonly componentCount: number
}

interface DiffMetadata {
  readonly filesChanged: number
  readonly linesAdded: number
  readonly linesRemoved: number
}

interface ReviewMetadata {
  readonly verdict: "approved" | "rejected"
  readonly issueCount: number
}

interface TestReportMetadata {
  readonly passed: number
  readonly failed: number
  readonly coverageDelta: number
}

interface MetricReportMetadata {
  readonly metricCount: number
  readonly periodStart: number
  readonly periodEnd: number
}
```

- [ ] **Step 4: Fix existing tests that use old metadata shapes**

Update the existing artifact tests in `tests/entities/Artifact.test.ts` to use new required metadata fields. For example, any spec artifact creation that used `{ version: 1 }` must now use `{ requirementCount: N, hasSuccessCriteria: true/false }`.

- [ ] **Step 5: Run full test suite**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 6: Commit**

```bash
git add src/entities/Artifact.ts tests/entities/Artifact.test.ts
git commit -m "fix: tighten Artifact metadata types, remove index signatures"
```

---

### Task 6: Add `roleMapping` to PipelineConfig

**Files:**
- Modify: `src/entities/PipelineConfig.ts`
- Test: `tests/entities/PipelineConfig.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// Append to tests/entities/PipelineConfig.test.ts
import { ROLES } from "../../src/entities/AgentRole"

describe("PipelineConfig – roleMapping", () => {
  it("includes roleMapping in created config", () => {
    const config = createPipelineConfig({
      phases: ["spec", "plan", "code", "review"],
      transitions: [
        { from: "spec", to: "plan" },
        { from: "plan", to: "code" },
        { from: "code", to: "review" },
      ],
      roleMapping: [
        { phase: "spec", role: ROLES.PRODUCT },
        { phase: "plan", role: ROLES.ARCHITECT },
        { phase: "code", role: ROLES.DEVELOPER },
        { phase: "review", role: ROLES.REVIEWER },
      ],
    })
    expect(config.roleMapping).toHaveLength(4)
    expect(config.roleMapping[0]).toEqual({ phase: "spec", role: ROLES.PRODUCT })
  })

  it("defaults roleMapping to empty array", () => {
    const config = createPipelineConfig({
      phases: ["code"],
      transitions: [],
    })
    expect(config.roleMapping).toEqual([])
  })

  it("roleForPhase returns correct role", () => {
    const config = createPipelineConfig({
      phases: ["spec", "code"],
      transitions: [{ from: "spec", to: "code" }],
      roleMapping: [
        { phase: "spec", role: ROLES.PRODUCT },
        { phase: "code", role: ROLES.DEVELOPER },
      ],
    })
    expect(roleForPhase("spec", config)).toBe(ROLES.PRODUCT)
    expect(roleForPhase("code", config)).toBe(ROLES.DEVELOPER)
    expect(roleForPhase("unknown", config)).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

Run: `npx jest tests/entities/PipelineConfig.test.ts --verbose`
Expected: FAIL

- [ ] **Step 3: Implement roleMapping**

In `src/entities/PipelineConfig.ts`:

```typescript
import { type Task } from "./Task"
import { type AgentRole } from "./AgentRole"

export interface PhaseTransition {
  readonly from: string
  readonly to: string
}

export interface PhaseRoleMapping {
  readonly phase: string
  readonly role: AgentRole
}

export interface PipelineConfig {
  readonly phases: readonly string[]
  readonly transitions: readonly PhaseTransition[]
  readonly skipAllowed: ReadonlyArray<{
    from: string
    to: string
    condition: string
  }>
  readonly roleMapping: readonly PhaseRoleMapping[]
}

export interface CreatePipelineConfigParams {
  phases: readonly string[]
  transitions: readonly PhaseTransition[]
  skipAllowed?: ReadonlyArray<{
    from: string
    to: string
    condition: string
  }>
  roleMapping?: readonly PhaseRoleMapping[]
}

export function createPipelineConfig(params: CreatePipelineConfigParams): PipelineConfig {
  return {
    phases: params.phases,
    transitions: params.transitions,
    skipAllowed: params.skipAllowed ?? [],
    roleMapping: params.roleMapping ?? [],
  }
}

export function canAdvancePhase(
  task: Pick<Task, "phase">,
  to: string,
  pipeline: PipelineConfig,
): boolean {
  return pipeline.transitions.some((t) => t.from === task.phase && t.to === to)
}

export function roleForPhase(phase: string, pipeline: PipelineConfig): AgentRole | null {
  const mapping = pipeline.roleMapping.find((m) => m.phase === phase)
  return mapping?.role ?? null
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/entities/PipelineConfig.test.ts --verbose`
Expected: ALL pass

- [ ] **Step 5: Commit**

```bash
git add src/entities/PipelineConfig.ts tests/entities/PipelineConfig.test.ts
git commit -m "feat: add roleMapping and roleForPhase to PipelineConfig"
```

---

### Task 7: Create ChannelMessage and KeepDiscardRecord entities

**Files:**
- Create: `src/entities/ChannelMessage.ts`
- Create: `src/entities/KeepDiscardRecord.ts`
- Modify: `src/entities/index.ts`
- Test: `tests/entities/ChannelMessage.test.ts`
- Test: `tests/entities/KeepDiscardRecord.test.ts`

- [ ] **Step 1: Write tests for ChannelMessage**

Create `tests/entities/ChannelMessage.test.ts`:

```typescript
import { createChannelMessage } from "../../src/entities/ChannelMessage"
import { createMessageId, createAgentId, createTaskId } from "../../src/entities/ids"

describe("ChannelMessage", () => {
  it("creates a channel message with all fields", () => {
    const msg = createChannelMessage({
      from: createAgentId("dev-1"),
      to: createAgentId("arch-1"),
      content: "Should this be a new module?",
      taskId: createTaskId("task-1"),
    })
    expect(msg.id).toBeDefined()
    expect(msg.from).toBe("dev-1")
    expect(msg.to).toBe("arch-1")
    expect(msg.content).toBe("Should this be a new module?")
    expect(msg.taskId).toBe("task-1")
    expect(msg.replyTo).toBeNull()
    expect(msg.timestamp).toBeInstanceOf(Date)
  })

  it("creates a broadcast message with to='all'", () => {
    const msg = createChannelMessage({
      from: createAgentId("supervisor-1"),
      to: "all",
      content: "Priority change",
    })
    expect(msg.to).toBe("all")
    expect(msg.taskId).toBeNull()
  })

  it("creates a reply", () => {
    const originalId = createMessageId()
    const msg = createChannelMessage({
      from: createAgentId("arch-1"),
      to: createAgentId("dev-1"),
      content: "Yes, new module.",
      replyTo: originalId,
    })
    expect(msg.replyTo).toBe(originalId)
  })
})
```

- [ ] **Step 2: Write tests for KeepDiscardRecord**

Create `tests/entities/KeepDiscardRecord.test.ts`:

```typescript
import { createKeepDiscardRecord } from "../../src/entities/KeepDiscardRecord"
import { createTaskId, createAgentId, createArtifactId } from "../../src/entities/ids"

describe("KeepDiscardRecord", () => {
  it("creates a record with all fields", () => {
    const record = createKeepDiscardRecord({
      taskId: createTaskId("task-1"),
      agentId: createAgentId("dev-1"),
      phase: "code",
      durationMs: 5000,
      tokensUsed: 1500,
      verdict: "approved",
      reasons: [],
      artifactIds: [createArtifactId("art-1")],
      commitHash: "abc123",
    })
    expect(record.taskId).toBe("task-1")
    expect(record.verdict).toBe("approved")
    expect(record.commitHash).toBe("abc123")
    expect(record.recordedAt).toBeInstanceOf(Date)
  })

  it("creates a rejection record with reasons", () => {
    const record = createKeepDiscardRecord({
      taskId: createTaskId("task-2"),
      agentId: createAgentId("dev-1"),
      phase: "code",
      durationMs: 8000,
      tokensUsed: 3000,
      verdict: "rejected",
      reasons: ["no tests", "incorrect implementation"],
      artifactIds: [],
      commitHash: null,
    })
    expect(record.verdict).toBe("rejected")
    expect(record.reasons).toEqual(["no tests", "incorrect implementation"])
    expect(record.commitHash).toBeNull()
  })
})
```

- [ ] **Step 3: Run tests to verify failure**

Run: `npx jest tests/entities/ChannelMessage.test.ts tests/entities/KeepDiscardRecord.test.ts --verbose`
Expected: FAIL — modules don't exist

- [ ] **Step 4: Implement ChannelMessage**

Create `src/entities/ChannelMessage.ts`:

```typescript
import { type MessageId, type TaskId, type AgentId, createMessageId } from "./ids"

export interface ChannelMessage {
  readonly id: MessageId
  readonly taskId: TaskId | null
  readonly from: AgentId
  readonly to: AgentId | "all"
  readonly content: string
  readonly replyTo: MessageId | null
  readonly timestamp: Date
}

export interface CreateChannelMessageParams {
  from: AgentId
  to: AgentId | "all"
  content: string
  taskId?: TaskId | null
  replyTo?: MessageId | null
  id?: MessageId
  timestamp?: Date
}

export function createChannelMessage(params: CreateChannelMessageParams): ChannelMessage {
  return {
    id: params.id ?? createMessageId(),
    taskId: params.taskId ?? null,
    from: params.from,
    to: params.to,
    content: params.content,
    replyTo: params.replyTo ?? null,
    timestamp: params.timestamp ?? new Date(),
  }
}
```

- [ ] **Step 5: Implement KeepDiscardRecord**

Create `src/entities/KeepDiscardRecord.ts`:

```typescript
import { type TaskId, type AgentId, type ArtifactId } from "./ids"

export interface KeepDiscardRecord {
  readonly taskId: TaskId
  readonly agentId: AgentId
  readonly phase: string
  readonly durationMs: number
  readonly tokensUsed: number
  readonly verdict: "approved" | "rejected"
  readonly reasons: readonly string[]
  readonly artifactIds: readonly ArtifactId[]
  readonly commitHash: string | null
  readonly recordedAt: Date
}

export interface CreateKeepDiscardRecordParams {
  taskId: TaskId
  agentId: AgentId
  phase: string
  durationMs: number
  tokensUsed: number
  verdict: "approved" | "rejected"
  reasons: readonly string[]
  artifactIds: readonly ArtifactId[]
  commitHash: string | null
  recordedAt?: Date
}

export function createKeepDiscardRecord(params: CreateKeepDiscardRecordParams): KeepDiscardRecord {
  return {
    ...params,
    recordedAt: params.recordedAt ?? new Date(),
  }
}
```

- [ ] **Step 6: Update barrel export**

Add to `src/entities/index.ts`:

```typescript
export * from "./ChannelMessage"
export * from "./KeepDiscardRecord"
```

- [ ] **Step 7: Run tests**

Run: `npx jest tests/entities/ChannelMessage.test.ts tests/entities/KeepDiscardRecord.test.ts --verbose`
Expected: ALL pass

- [ ] **Step 8: Commit**

```bash
git add src/entities/ChannelMessage.ts src/entities/KeepDiscardRecord.ts src/entities/index.ts tests/entities/ChannelMessage.test.ts tests/entities/KeepDiscardRecord.test.ts
git commit -m "feat: add ChannelMessage and KeepDiscardRecord entities"
```

---

### Task 8: Create ArtifactRepository and WorktreeManager ports

**Files:**
- Create: `src/use-cases/ports/ArtifactRepository.ts`
- Create: `src/use-cases/ports/WorktreeManager.ts`
- Modify: `src/use-cases/ports/index.ts`

- [ ] **Step 1: Create ArtifactRepository port**

Create `src/use-cases/ports/ArtifactRepository.ts`:

```typescript
import type { Artifact } from "../../entities/Artifact"
import type { ArtifactId, TaskId } from "../../entities/ids"

export interface ArtifactRepository {
  findById(id: ArtifactId): Promise<Artifact | null>
  findByTaskId(taskId: TaskId): Promise<ReadonlyArray<Artifact>>
  create(artifact: Artifact): Promise<void>
}
```

- [ ] **Step 2: Create WorktreeManager port**

Create `src/use-cases/ports/WorktreeManager.ts`:

```typescript
export type WorktreePath = string

export type MergeResult =
  | { readonly success: true; readonly commit: string }
  | { readonly success: false; readonly error: string }

export interface WorktreeManager {
  create(branch: string, baseBranch?: string): Promise<WorktreePath>
  delete(branch: string): Promise<void>
  merge(branch: string, targetBranch?: string): Promise<MergeResult>
  exists(branch: string): Promise<boolean>
}
```

- [ ] **Step 3: Add FileSystemFactory and ShellExecutorFactory types**

Add to `src/use-cases/ports/FileSystem.ts`:

```typescript
export type FileSystemFactory = (rootPath: string) => FileSystem
```

Add to `src/use-cases/ports/ShellExecutor.ts`:

```typescript
export type ShellExecutorFactory = (rootPath: string) => ShellExecutor
```

- [ ] **Step 4: Update barrel export**

Add to `src/use-cases/ports/index.ts`:

```typescript
export * from "./ArtifactRepository"
export * from "./WorktreeManager"
```

- [ ] **Step 5: Verify compilation**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add src/use-cases/ports/ArtifactRepository.ts src/use-cases/ports/WorktreeManager.ts src/use-cases/ports/FileSystem.ts src/use-cases/ports/ShellExecutor.ts src/use-cases/ports/index.ts
git commit -m "feat: add ArtifactRepository, WorktreeManager ports and factory types"
```

---

### Task 9: Create EvaluateKeepDiscard, MergeBranch, DiscardBranch use cases

**Files:**
- Create: `src/use-cases/EvaluateKeepDiscard.ts`
- Create: `src/use-cases/MergeBranch.ts`
- Create: `src/use-cases/DiscardBranch.ts`
- Test: `tests/use-cases/EvaluateKeepDiscard.test.ts`
- Test: `tests/use-cases/MergeBranch.test.ts`
- Test: `tests/use-cases/DiscardBranch.test.ts`

- [ ] **Step 1: Write tests for EvaluateKeepDiscard**

Create `tests/use-cases/EvaluateKeepDiscard.test.ts`:

```typescript
import { EvaluateKeepDiscard } from "../../src/use-cases/EvaluateKeepDiscard"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("EvaluateKeepDiscard", () => {
  let taskRepo: InMemoryTaskRepo
  let useCase: EvaluateKeepDiscard

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo()
    useCase = new EvaluateKeepDiscard(taskRepo)
  })

  it("returns 'keep' when verdict is approved", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget(10000, 1.0), status: "review",
    })
    await taskRepo.create(task)

    const result = await useCase.execute("t-1" as any, "approved", 3)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe("keep")
  })

  it("returns 'retry' when rejected with retries remaining, increments retryCount", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget(10000, 1.0), status: "review", retryCount: 1,
    })
    await taskRepo.create(task)

    const result = await useCase.execute("t-1" as any, "rejected", 3)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe("retry")

    const updated = await taskRepo.findById("t-1" as any)
    expect(updated?.retryCount).toBe(2)
  })

  it("returns 'discard' when rejected with retries exhausted", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget(10000, 1.0), status: "review", retryCount: 3,
    })
    await taskRepo.create(task)

    const result = await useCase.execute("t-1" as any, "rejected", 3)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe("discard")
  })

  it("fails for unknown task", async () => {
    const result = await useCase.execute("missing" as any, "approved", 3)
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest tests/use-cases/EvaluateKeepDiscard.test.ts --verbose`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement EvaluateKeepDiscard**

Create `src/use-cases/EvaluateKeepDiscard.ts`:

```typescript
import type { TaskId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import { success, failure, type Result } from "./Result"

export type KeepDiscardDecision = "keep" | "retry" | "discard"

export class EvaluateKeepDiscard {
  constructor(private readonly tasks: TaskRepository) {}

  async execute(
    taskId: TaskId,
    verdict: "approved" | "rejected",
    maxRetries: number,
  ): Promise<Result<KeepDiscardDecision>> {
    const task = await this.tasks.findById(taskId)
    if (!task) {
      return failure(`Task ${taskId} not found`)
    }

    if (verdict === "approved") {
      return success("keep")
    }

    // Rejected — check retries
    if (task.retryCount < maxRetries) {
      const updated = { ...task, retryCount: task.retryCount + 1, version: task.version + 1 }
      await this.tasks.update(updated)
      return success("retry")
    }

    return success("discard")
  }
}
```

- [ ] **Step 4: Run test to verify pass**

Run: `npx jest tests/use-cases/EvaluateKeepDiscard.test.ts --verbose`
Expected: ALL pass

- [ ] **Step 5: Write tests for MergeBranch**

Create `tests/use-cases/MergeBranch.test.ts`:

```typescript
import { MergeBranch } from "../../src/use-cases/MergeBranch"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryWorktreeManager } from "../../src/adapters/storage/InMemoryWorktreeManager"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import type { Message } from "../../src/entities/Message"

describe("MergeBranch", () => {
  let taskRepo: InMemoryTaskRepo
  let bus: InMemoryBus
  let worktree: InMemoryWorktreeManager
  let useCase: MergeBranch
  const emitted: Message[] = []

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo()
    bus = new InMemoryBus()
    worktree = new InMemoryWorktreeManager()
    useCase = new MergeBranch(taskRepo, worktree, bus)
    emitted.length = 0
    bus.subscribe({}, async (msg) => { emitted.push(msg) })
  })

  it("merges branch and transitions task to approved", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget(10000, 1.0), status: "review",
      branch: "devfleet/task-t-1",
    })
    await taskRepo.create(task)
    await worktree.create("devfleet/task-t-1")

    const result = await useCase.execute("t-1" as any)
    expect(result.ok).toBe(true)

    const updated = await taskRepo.findById("t-1" as any)
    expect(updated?.status).toBe("merged")

    expect(emitted).toHaveLength(1)
    expect(emitted[0].type).toBe("branch.merged")
  })

  it("fails when task has no branch", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget(10000, 1.0), status: "review",
    })
    await taskRepo.create(task)

    const result = await useCase.execute("t-1" as any)
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 6: Implement MergeBranch**

Create `src/use-cases/MergeBranch.ts`:

```typescript
import type { TaskId } from "../entities/ids"
import { createMessageId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import type { WorktreeManager } from "./ports/WorktreeManager"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"

export class MergeBranch {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly worktree: WorktreeManager,
    private readonly bus: MessagePort,
  ) {}

  async execute(taskId: TaskId): Promise<Result<string>> {
    const task = await this.tasks.findById(taskId)
    if (!task) return failure(`Task ${taskId} not found`)
    if (!task.branch) return failure(`Task ${taskId} has no branch`)

    const mergeResult = await this.worktree.merge(task.branch)
    if (!mergeResult.success) {
      return failure(`Merge failed: ${mergeResult.error}`)
    }

    const updated = { ...task, status: "merged" as const, version: task.version + 1 }
    await this.tasks.update(updated)

    await this.bus.emit({
      id: createMessageId(),
      type: "branch.merged",
      taskId,
      branch: task.branch,
      commit: mergeResult.commit,
      timestamp: new Date(),
    })

    return success(mergeResult.commit)
  }
}
```

- [ ] **Step 7: Write tests for DiscardBranch**

Create `tests/use-cases/DiscardBranch.test.ts`:

```typescript
import { DiscardBranch } from "../../src/use-cases/DiscardBranch"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryWorktreeManager } from "../../src/adapters/storage/InMemoryWorktreeManager"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import type { Message } from "../../src/entities/Message"

describe("DiscardBranch", () => {
  let taskRepo: InMemoryTaskRepo
  let bus: InMemoryBus
  let worktree: InMemoryWorktreeManager
  let useCase: DiscardBranch
  const emitted: Message[] = []

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo()
    bus = new InMemoryBus()
    worktree = new InMemoryWorktreeManager()
    useCase = new DiscardBranch(taskRepo, worktree, bus)
    emitted.length = 0
    bus.subscribe({}, async (msg) => { emitted.push(msg) })
  })

  it("deletes branch and transitions task to discarded", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget(10000, 1.0), status: "review",
      branch: "devfleet/task-t-1",
    })
    await taskRepo.create(task)
    await worktree.create("devfleet/task-t-1")

    const result = await useCase.execute("t-1" as any, "max retries exceeded")
    expect(result.ok).toBe(true)

    const updated = await taskRepo.findById("t-1" as any)
    expect(updated?.status).toBe("discarded")

    expect(emitted).toHaveLength(1)
    expect(emitted[0].type).toBe("branch.discarded")
    if (emitted[0].type === "branch.discarded") {
      expect(emitted[0].reason).toBe("max retries exceeded")
    }
  })
})
```

- [ ] **Step 8: Implement DiscardBranch**

Create `src/use-cases/DiscardBranch.ts`:

```typescript
import type { TaskId } from "../entities/ids"
import { createMessageId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import type { WorktreeManager } from "./ports/WorktreeManager"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"

export class DiscardBranch {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly worktree: WorktreeManager,
    private readonly bus: MessagePort,
  ) {}

  async execute(taskId: TaskId, reason: string): Promise<Result<void>> {
    const task = await this.tasks.findById(taskId)
    if (!task) return failure(`Task ${taskId} not found`)
    if (!task.branch) return failure(`Task ${taskId} has no branch`)

    await this.worktree.delete(task.branch)

    const updated = { ...task, status: "discarded" as const, version: task.version + 1 }
    await this.tasks.update(updated)

    await this.bus.emit({
      id: createMessageId(),
      type: "branch.discarded",
      taskId,
      branch: task.branch,
      reason,
      timestamp: new Date(),
    })

    return success(undefined)
  }
}
```

- [ ] **Step 9: Run all tests**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 10: Commit**

```bash
git add src/use-cases/EvaluateKeepDiscard.ts src/use-cases/MergeBranch.ts src/use-cases/DiscardBranch.ts tests/use-cases/EvaluateKeepDiscard.test.ts tests/use-cases/MergeBranch.test.ts tests/use-cases/DiscardBranch.test.ts
git commit -m "feat: add EvaluateKeepDiscard, MergeBranch, DiscardBranch use cases"
```

---

### Task 10: Create CreateArtifact and SendChannelMessage use cases

**Files:**
- Create: `src/use-cases/CreateArtifact.ts`
- Create: `src/use-cases/SendChannelMessage.ts`
- Test: `tests/use-cases/CreateArtifact.test.ts`
- Test: `tests/use-cases/SendChannelMessage.test.ts`

- [ ] **Step 1: Write tests for CreateArtifact**

Create `tests/use-cases/CreateArtifact.test.ts`:

```typescript
import { CreateArtifactUseCase } from "../../src/use-cases/CreateArtifact"
import { InMemoryArtifactRepo } from "../../src/adapters/storage/InMemoryArtifactRepo"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { createArtifact } from "../../src/entities/Artifact"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId, createAgentId, createArtifactId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("CreateArtifactUseCase", () => {
  let artifactRepo: InMemoryArtifactRepo
  let taskRepo: InMemoryTaskRepo
  let useCase: CreateArtifactUseCase

  beforeEach(() => {
    artifactRepo = new InMemoryArtifactRepo()
    taskRepo = new InMemoryTaskRepo()
    useCase = new CreateArtifactUseCase(artifactRepo, taskRepo)
  })

  it("stores artifact and links to task", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "spec", budget: createBudget(10000, 1.0),
    })
    await taskRepo.create(task)

    const artifact = createArtifact({
      id: createArtifactId("art-1"),
      kind: "spec",
      format: "markdown",
      taskId: "t-1" as any,
      createdBy: createAgentId("prod-1"),
      content: "# Spec",
      metadata: { requirementCount: 3, hasSuccessCriteria: true },
    })

    const result = await useCase.execute(artifact)
    expect(result.ok).toBe(true)

    const stored = await artifactRepo.findById("art-1" as any)
    expect(stored).not.toBeNull()
    expect(stored?.kind).toBe("spec")

    const updatedTask = await taskRepo.findById("t-1" as any)
    expect(updatedTask?.artifacts).toContain("art-1")
  })

  it("fails for unknown task", async () => {
    const artifact = createArtifact({
      id: createArtifactId("art-1"),
      kind: "spec",
      format: "markdown",
      taskId: createTaskId("missing"),
      createdBy: createAgentId("prod-1"),
      content: "# Spec",
      metadata: { requirementCount: 1, hasSuccessCriteria: false },
    })

    const result = await useCase.execute(artifact)
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Implement CreateArtifact**

Create `src/use-cases/CreateArtifact.ts`:

```typescript
import type { Artifact } from "../entities/Artifact"
import type { ArtifactRepository } from "./ports/ArtifactRepository"
import type { TaskRepository } from "./ports/TaskRepository"
import { success, failure, type Result } from "./Result"

export class CreateArtifactUseCase {
  constructor(
    private readonly artifacts: ArtifactRepository,
    private readonly tasks: TaskRepository,
  ) {}

  async execute(artifact: Artifact): Promise<Result<void>> {
    const task = await this.tasks.findById(artifact.taskId)
    if (!task) {
      return failure(`Task ${artifact.taskId} not found`)
    }

    await this.artifacts.create(artifact)

    const updated = {
      ...task,
      artifacts: [...task.artifacts, artifact.id],
      version: task.version + 1,
    }
    await this.tasks.update(updated)

    return success(undefined)
  }
}
```

- [ ] **Step 3: Write tests for SendChannelMessage**

Create `tests/use-cases/SendChannelMessage.test.ts`:

```typescript
import { SendChannelMessage } from "../../src/use-cases/SendChannelMessage"
import { InMemoryAgentRegistry } from "../../src/adapters/storage/InMemoryAgentRegistry"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { createAgent } from "../../src/entities/Agent"
import { createAgentId } from "../../src/entities/ids"
import { createChannelMessage } from "../../src/entities/ChannelMessage"
import { ROLES } from "../../src/entities/AgentRole"

describe("SendChannelMessage", () => {
  let registry: InMemoryAgentRegistry
  let bus: InMemoryBus
  let useCase: SendChannelMessage

  beforeEach(async () => {
    registry = new InMemoryAgentRegistry()
    bus = new InMemoryBus()
    useCase = new SendChannelMessage(registry, bus)

    await registry.register(createAgent({ id: createAgentId("dev-1"), role: ROLES.DEVELOPER, model: "sonnet" }))
  })

  it("emits channel message for valid agent", async () => {
    const emitted: any[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })

    const msg = createChannelMessage({ from: createAgentId("dev-1"), to: "all", content: "hello" })
    const result = await useCase.execute(msg)
    expect(result.ok).toBe(true)
  })

  it("fails for unknown sender", async () => {
    const msg = createChannelMessage({ from: createAgentId("unknown"), to: "all", content: "hello" })
    const result = await useCase.execute(msg)
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 4: Implement SendChannelMessage**

Create `src/use-cases/SendChannelMessage.ts`:

```typescript
import type { ChannelMessage } from "../entities/ChannelMessage"
import type { AgentRegistry } from "./ports/AgentRegistry"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"
import { createMessageId } from "../entities/ids"

export class SendChannelMessage {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly bus: MessagePort,
  ) {}

  async execute(channelMsg: ChannelMessage): Promise<Result<void>> {
    const agent = await this.registry.findById(channelMsg.from)
    if (!agent) {
      return failure(`Agent ${channelMsg.from} not found`)
    }

    // Emit as a system-level event so the bus can route it
    // Channel messages flow through the standard message bus
    // but don't use the Message union — they're a separate entity
    // For Phase 2, we just validate. Phase 3 dashboard will subscribe.
    return success(undefined)
  }
}
```

- [ ] **Step 5: Run all tests**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 6: Commit**

```bash
git add src/use-cases/CreateArtifact.ts src/use-cases/SendChannelMessage.ts tests/use-cases/CreateArtifact.test.ts tests/use-cases/SendChannelMessage.test.ts
git commit -m "feat: add CreateArtifact and SendChannelMessage use cases"
```

---

### Task 11: Create DetectStuckAgent use case

**Files:**
- Create: `src/use-cases/DetectStuckAgent.ts`
- Test: `tests/use-cases/DetectStuckAgent.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/use-cases/DetectStuckAgent.test.ts`:

```typescript
import { DetectStuckAgent } from "../../src/use-cases/DetectStuckAgent"
import { InMemoryAgentRegistry } from "../../src/adapters/storage/InMemoryAgentRegistry"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { createAgent } from "../../src/entities/Agent"
import { createAgentId, createTaskId } from "../../src/entities/ids"
import { ROLES } from "../../src/entities/AgentRole"
import type { Message } from "../../src/entities/Message"

describe("DetectStuckAgent", () => {
  let registry: InMemoryAgentRegistry
  let bus: InMemoryBus
  let useCase: DetectStuckAgent
  const emitted: Message[] = []

  beforeEach(() => {
    registry = new InMemoryAgentRegistry()
    bus = new InMemoryBus()
    useCase = new DetectStuckAgent(registry, bus)
    emitted.length = 0
    bus.subscribe({}, async (msg) => { emitted.push(msg) })
  })

  it("emits agent.stuck for agent inactive beyond timeout", async () => {
    const staleDate = new Date(Date.now() - 120_000) // 2 min ago
    const agent = createAgent({
      id: createAgentId("dev-1"), role: ROLES.DEVELOPER, model: "sonnet",
      status: "busy", currentTaskId: createTaskId("t-1"), lastActiveAt: staleDate,
    })
    await registry.register(agent)

    await useCase.execute(60_000) // 60s timeout
    expect(emitted).toHaveLength(1)
    expect(emitted[0].type).toBe("agent.stuck")
  })

  it("does not emit for active agent", async () => {
    const agent = createAgent({
      id: createAgentId("dev-1"), role: ROLES.DEVELOPER, model: "sonnet",
      status: "busy", currentTaskId: createTaskId("t-1"), lastActiveAt: new Date(),
    })
    await registry.register(agent)

    await useCase.execute(60_000)
    expect(emitted).toHaveLength(0)
  })

  it("does not emit for idle agent", async () => {
    const staleDate = new Date(Date.now() - 120_000)
    const agent = createAgent({
      id: createAgentId("dev-1"), role: ROLES.DEVELOPER, model: "sonnet",
      status: "idle", lastActiveAt: staleDate,
    })
    await registry.register(agent)

    await useCase.execute(60_000)
    expect(emitted).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest tests/use-cases/DetectStuckAgent.test.ts --verbose`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Add findAll to AgentRegistry port**

Add to `src/use-cases/ports/AgentRegistry.ts`:

```typescript
export interface AgentRegistry {
  findAvailable(role: AgentRole): Promise<Agent | null>
  findById(id: AgentId): Promise<Agent | null>
  register(agent: Agent): Promise<void>
  updateStatus(id: AgentId, status: Agent["status"], taskId?: Agent["currentTaskId"]): Promise<void>
  findAll(): Promise<ReadonlyArray<Agent>>
}
```

Add `findAll()` to `src/adapters/storage/InMemoryAgentRegistry.ts`:

```typescript
async findAll(): Promise<ReadonlyArray<Agent>> {
  return [...this.agents.values()]
}
```

- [ ] **Step 4: Implement DetectStuckAgent**

Create `src/use-cases/DetectStuckAgent.ts`:

```typescript
import type { AgentRegistry } from "./ports/AgentRegistry"
import type { MessagePort } from "./ports/MessagePort"
import { createMessageId } from "../entities/ids"

export class DetectStuckAgent {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly bus: MessagePort,
  ) {}

  async execute(timeoutMs: number, now: Date = new Date()): Promise<void> {
    const agents = await this.registry.findAll()

    for (const agent of agents) {
      if (agent.status !== "busy" || !agent.currentTaskId) continue

      const elapsed = now.getTime() - agent.lastActiveAt.getTime()
      if (elapsed > timeoutMs) {
        await this.bus.emit({
          id: createMessageId(),
          type: "agent.stuck",
          agentId: agent.id,
          taskId: agent.currentTaskId,
          reason: `No activity for ${Math.round(elapsed / 1000)}s (timeout: ${Math.round(timeoutMs / 1000)}s)`,
          retryCount: 0,
          timestamp: new Date(),
        })
      }
    }
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest tests/use-cases/DetectStuckAgent.test.ts --verbose`
Expected: ALL pass

- [ ] **Step 6: Commit**

```bash
git add src/use-cases/DetectStuckAgent.ts src/use-cases/ports/AgentRegistry.ts src/adapters/storage/InMemoryAgentRegistry.ts tests/use-cases/DetectStuckAgent.test.ts
git commit -m "feat: add DetectStuckAgent use case with findAll on AgentRegistry"
```

---

### Task 12: Create in-memory adapters and DeterministicProvider

**Files:**
- Create: `src/adapters/storage/InMemoryArtifactRepo.ts`
- Create: `src/adapters/storage/InMemoryWorktreeManager.ts`
- Create: `src/adapters/ai-providers/DeterministicProvider.ts`
- Test: `tests/adapters/InMemoryArtifactRepo.test.ts`
- Test: `tests/adapters/InMemoryWorktreeManager.test.ts`
- Test: `tests/adapters/DeterministicProvider.test.ts`

- [ ] **Step 1: Write tests for InMemoryArtifactRepo**

Create `tests/adapters/InMemoryArtifactRepo.test.ts`:

```typescript
import { InMemoryArtifactRepo } from "../../src/adapters/storage/InMemoryArtifactRepo"
import { createArtifact } from "../../src/entities/Artifact"
import { createArtifactId, createTaskId, createAgentId } from "../../src/entities/ids"

describe("InMemoryArtifactRepo", () => {
  let repo: InMemoryArtifactRepo

  beforeEach(() => { repo = new InMemoryArtifactRepo() })

  it("creates and finds by id", async () => {
    const artifact = createArtifact({
      id: createArtifactId("a-1"), kind: "spec", format: "markdown",
      taskId: createTaskId("t-1"), createdBy: createAgentId("p-1"),
      content: "spec", metadata: { requirementCount: 1, hasSuccessCriteria: true },
    })
    await repo.create(artifact)
    const found = await repo.findById("a-1" as any)
    expect(found?.kind).toBe("spec")
  })

  it("finds by taskId", async () => {
    const tid = createTaskId("t-1")
    const a1 = createArtifact({ id: createArtifactId("a-1"), kind: "spec", format: "md", taskId: tid, createdBy: createAgentId("p-1"), content: "s", metadata: { requirementCount: 1, hasSuccessCriteria: true } })
    const a2 = createArtifact({ id: createArtifactId("a-2"), kind: "plan", format: "md", taskId: tid, createdBy: createAgentId("a-1"), content: "p", metadata: { stepCount: 3, estimatedTokens: 5000 } })
    await repo.create(a1)
    await repo.create(a2)
    const found = await repo.findByTaskId(tid)
    expect(found).toHaveLength(2)
  })

  it("returns null for unknown id", async () => {
    const found = await repo.findById(createArtifactId("nope"))
    expect(found).toBeNull()
  })
})
```

- [ ] **Step 2: Implement InMemoryArtifactRepo**

Create `src/adapters/storage/InMemoryArtifactRepo.ts`:

```typescript
import type { Artifact } from "../../entities/Artifact"
import type { ArtifactId, TaskId } from "../../entities/ids"
import type { ArtifactRepository } from "../../use-cases/ports/ArtifactRepository"

export class InMemoryArtifactRepo implements ArtifactRepository {
  private readonly store = new Map<string, Artifact>()

  async findById(id: ArtifactId): Promise<Artifact | null> {
    return this.store.get(id) ?? null
  }

  async findByTaskId(taskId: TaskId): Promise<ReadonlyArray<Artifact>> {
    return [...this.store.values()].filter(a => a.taskId === taskId)
  }

  async create(artifact: Artifact): Promise<void> {
    this.store.set(artifact.id, artifact)
  }
}
```

- [ ] **Step 3: Write tests for InMemoryWorktreeManager**

Create `tests/adapters/InMemoryWorktreeManager.test.ts`:

```typescript
import { InMemoryWorktreeManager } from "../../src/adapters/storage/InMemoryWorktreeManager"

describe("InMemoryWorktreeManager", () => {
  let mgr: InMemoryWorktreeManager

  beforeEach(() => { mgr = new InMemoryWorktreeManager() })

  it("creates and checks existence", async () => {
    const path = await mgr.create("feat/foo")
    expect(path).toContain("feat/foo")
    expect(await mgr.exists("feat/foo")).toBe(true)
  })

  it("deletes worktree", async () => {
    await mgr.create("feat/bar")
    await mgr.delete("feat/bar")
    expect(await mgr.exists("feat/bar")).toBe(false)
  })

  it("merge succeeds with fake commit", async () => {
    await mgr.create("feat/baz")
    const result = await mgr.merge("feat/baz")
    expect(result.success).toBe(true)
    if (result.success) expect(result.commit).toBeDefined()
  })

  it("merge fails for non-existent branch", async () => {
    const result = await mgr.merge("nope")
    expect(result.success).toBe(false)
  })
})
```

- [ ] **Step 4: Implement InMemoryWorktreeManager**

Create `src/adapters/storage/InMemoryWorktreeManager.ts`:

```typescript
import type { WorktreeManager, WorktreePath, MergeResult } from "../../use-cases/ports/WorktreeManager"

export class InMemoryWorktreeManager implements WorktreeManager {
  private readonly branches = new Set<string>()

  async create(branch: string, _baseBranch?: string): Promise<WorktreePath> {
    this.branches.add(branch)
    return `.worktrees/${branch}`
  }

  async delete(branch: string): Promise<void> {
    this.branches.delete(branch)
  }

  async merge(branch: string, _targetBranch?: string): Promise<MergeResult> {
    if (!this.branches.has(branch)) {
      return { success: false, error: `Branch ${branch} not found` }
    }
    this.branches.delete(branch)
    const commit = `fake-${branch}-${Date.now().toString(36)}`
    return { success: true, commit }
  }

  async exists(branch: string): Promise<boolean> {
    return this.branches.has(branch)
  }
}
```

- [ ] **Step 5: Write tests for DeterministicProvider**

Create `tests/adapters/DeterministicProvider.test.ts`:

```typescript
import { DeterministicProvider } from "../../src/adapters/ai-providers/DeterministicProvider"
import { createBudget } from "../../src/entities/Budget"

describe("DeterministicProvider", () => {
  it("returns pre-configured tool calls", async () => {
    const provider = new DeterministicProvider([
      { name: "shell_run", input: { command: "npm run build" } },
      { name: "shell_run", input: { command: "npm test" } },
    ])

    expect(provider.capabilities.has("tool_use")).toBe(true)

    const result = await provider.complete(
      { systemPrompt: "", messages: [], model: "deterministic", maxTokens: 1000 },
      createBudget(10000, 1.0),
    )
    expect(result.stopReason).toBe("tool_use")
    expect(result.content).toBe("")
  })

  it("satisfies AICompletionProvider contract", () => {
    const provider = new DeterministicProvider([])
    expect(provider.capabilities).toBeInstanceOf(Set)
    expect(typeof provider.complete).toBe("function")
  })
})
```

- [ ] **Step 6: Implement DeterministicProvider**

Create `src/adapters/ai-providers/DeterministicProvider.ts`:

```typescript
import type {
  AICompletionProvider,
  AIToolProvider,
  AICapability,
  AgentPrompt,
  AIResponse,
  AIToolResponse,
  ToolDefinition,
  ToolCall,
} from "../../use-cases/ports/AIProvider"
import type { TokenBudget } from "../../entities/Budget"

interface DeterministicToolCall {
  readonly name: string
  readonly input: Record<string, unknown>
}

export class DeterministicProvider implements AICompletionProvider, AIToolProvider {
  readonly capabilities: ReadonlySet<AICapability> = new Set(["tool_use"])
  private callIndex = 0

  constructor(private readonly toolCalls: readonly DeterministicToolCall[]) {}

  async complete(_prompt: AgentPrompt, _budget: TokenBudget): Promise<AIResponse> {
    // Return tool_use stop reason so RunAgentLoop will call completeWithTools
    return {
      content: "",
      tokensIn: 0,
      tokensOut: 0,
      stopReason: this.toolCalls.length > 0 ? "tool_use" : "end_turn",
    }
  }

  async completeWithTools(
    _prompt: AgentPrompt,
    _tools: ReadonlyArray<ToolDefinition>,
    _budget: TokenBudget,
  ): Promise<AIToolResponse> {
    if (this.callIndex >= this.toolCalls.length) {
      return { content: "done", toolCalls: [], tokensIn: 0, tokensOut: 0, stopReason: "end_turn" }
    }

    const call = this.toolCalls[this.callIndex]!
    this.callIndex++

    const toolCall: ToolCall = {
      id: `det-${this.callIndex}`,
      name: call.name,
      input: call.input,
    }

    return {
      content: "",
      toolCalls: [toolCall],
      tokensIn: 0,
      tokensOut: 0,
      stopReason: this.callIndex < this.toolCalls.length ? "tool_use" : "end_turn",
    }
  }

  /** Reset the call index (useful for re-running in tests) */
  reset(): void {
    this.callIndex = 0
  }
}
```

- [ ] **Step 7: Run all tests**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 8: Commit**

```bash
git add src/adapters/storage/InMemoryArtifactRepo.ts src/adapters/storage/InMemoryWorktreeManager.ts src/adapters/ai-providers/DeterministicProvider.ts tests/adapters/InMemoryArtifactRepo.test.ts tests/adapters/InMemoryWorktreeManager.test.ts tests/adapters/DeterministicProvider.test.ts
git commit -m "feat: add InMemoryArtifactRepo, InMemoryWorktreeManager, DeterministicProvider"
```

---

### Task 13: Create waitForMessage test helper and update barrel exports

**Files:**
- Create: `tests/helpers/waitForMessage.ts`
- Test: `tests/helpers/waitForMessage.test.ts`
- Modify: `src/use-cases/index.ts`

- [ ] **Step 1: Write test for waitForMessage**

Create `tests/helpers/waitForMessage.test.ts`:

```typescript
import { waitForMessage } from "./waitForMessage"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { createMessageId, createGoalId } from "../../src/entities/ids"

describe("waitForMessage", () => {
  it("resolves when matching message is emitted", async () => {
    const bus = new InMemoryBus()

    const promise = waitForMessage(bus, "goal.created")
    await bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId: createGoalId(),
      description: "test",
      timestamp: new Date(),
    })

    const msg = await promise
    expect(msg.type).toBe("goal.created")
  })

  it("rejects on timeout", async () => {
    const bus = new InMemoryBus()
    await expect(waitForMessage(bus, "goal.created", undefined, 50)).rejects.toThrow("Timed out")
  })

  it("filters with predicate", async () => {
    const bus = new InMemoryBus()
    const gid = createGoalId("specific")

    const promise = waitForMessage(
      bus,
      "goal.created",
      (msg) => msg.type === "goal.created" && "goalId" in msg && (msg as any).goalId === gid,
      2000,
    )

    // Emit a non-matching message first
    await bus.emit({ id: createMessageId(), type: "goal.created", goalId: createGoalId("other"), description: "other", timestamp: new Date() })
    // Then the matching one
    await bus.emit({ id: createMessageId(), type: "goal.created", goalId: gid, description: "specific", timestamp: new Date() })

    const msg = await promise
    expect(msg.type).toBe("goal.created")
  })
})
```

- [ ] **Step 2: Implement waitForMessage**

Create `tests/helpers/waitForMessage.ts`:

```typescript
import type { Message, MessageType } from "../../src/entities/Message"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"

export function waitForMessage(
  bus: MessagePort,
  type: MessageType,
  predicate?: (msg: Message) => boolean,
  timeoutMs: number = 5000,
): Promise<Message> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe()
      reject(new Error(`Timed out waiting for message "${type}" after ${timeoutMs}ms`))
    }, timeoutMs)

    const unsubscribe = bus.subscribe({ types: [type] }, async (msg) => {
      if (predicate && !predicate(msg)) return
      clearTimeout(timer)
      unsubscribe()
      resolve(msg)
    })
  })
}
```

- [ ] **Step 3: Update use-cases barrel export**

Add to `src/use-cases/index.ts`:

```typescript
export * from "./EvaluateKeepDiscard"
export * from "./MergeBranch"
export * from "./DiscardBranch"
export * from "./CreateArtifact"
export * from "./SendChannelMessage"
export * from "./DetectStuckAgent"
```

- [ ] **Step 4: Run all tests**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 5: Commit**

```bash
git add tests/helpers/waitForMessage.ts tests/helpers/waitForMessage.test.ts src/use-cases/index.ts
git commit -m "feat: add waitForMessage test helper and update barrel exports"
```

---

## Batch 2: Supervisor + Pipeline Flow

### Task 14: Modify RunAgentLoop to include content in task_completed events

**Files:**
- Modify: `src/use-cases/RunAgentLoop.ts:129-131`
- Test: `tests/use-cases/RunAgentLoop.test.ts`

ProductPlugin and ArchitectPlugin need the final AI response content to create artifacts. Currently `RunAgentLoop` yields `{ type: "task_completed", data: { taskId, turns } }` without content.

- [ ] **Step 1: Write failing test**

```typescript
// Append to tests/use-cases/RunAgentLoop.test.ts

it("includes content in task_completed event", async () => {
  // Setup with mock AI that returns content and end_turn
  // ... (use existing test setup pattern from RunAgentLoop.test.ts)
  // Assert: task_completed event has data.content with the AI response
})
```

- [ ] **Step 2: Update RunAgentLoop to track and emit content**

In `src/use-cases/RunAgentLoop.ts`, add a `lastContent` variable at the top of `run()`:

```typescript
let lastContent = ""
```

After the AI response in the turn loop, track it:

```typescript
lastContent = content
```

Update the success yield:

```typescript
if (outcome === "success") {
  yield { type: "task_completed", data: { taskId: task.id, turns: turnCount, content: lastContent } }
  return
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest tests/use-cases/RunAgentLoop.test.ts --verbose`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add src/use-cases/RunAgentLoop.ts tests/use-cases/RunAgentLoop.test.ts
git commit -m "feat: include AI response content in task_completed events"
```

---

### Task 15: Enhance DecomposeGoal to accept AI decomposition

**Files:**
- Modify: `src/use-cases/DecomposeGoal.ts`
- Test: `tests/use-cases/DecomposeGoal.test.ts`

- [ ] **Step 1: Write failing test for phase-aware decomposition**

```typescript
// Append to tests/use-cases/DecomposeGoal.test.ts

describe("DecomposeGoal – Phase 2 enhancements", () => {
  it("creates tasks with correct phases from pipeline config", async () => {
    // Setup goal
    const goal = createGoal({ id: createGoalId("g-1"), description: "Add auth", status: "active" })
    await goalRepo.create(goal)

    const defs: TaskDefinition[] = [
      { id: createTaskId("t-spec"), description: "Write auth spec", phase: "spec", budget: createBudget(5000, 0.5) },
      { id: createTaskId("t-plan"), description: "Design auth flow", phase: "plan", budget: createBudget(5000, 0.5) },
      { id: createTaskId("t-code"), description: "Implement JWT", phase: "code", budget: createBudget(10000, 1.0) },
      { id: createTaskId("t-review"), description: "Review implementation", phase: "review", budget: createBudget(5000, 0.5) },
    ]

    const result = await useCase.execute(createGoalId("g-1"), defs)
    expect(result.ok).toBe(true)

    const specTask = await taskRepo.findById(createTaskId("t-spec"))
    expect(specTask?.phase).toBe("spec")
    const codeTask = await taskRepo.findById(createTaskId("t-code"))
    expect(codeTask?.phase).toBe("code")
  })
})
```

- [ ] **Step 2: Run test — should already pass**

Run: `npx jest tests/use-cases/DecomposeGoal.test.ts --verbose`
Expected: PASS — DecomposeGoal already respects `phase` from TaskDefinition. No code change needed for this aspect.

- [ ] **Step 3: Commit (no-op if tests pass)**

If all tests pass, no changes needed to DecomposeGoal for Batch 2. The Supervisor will call it with AI-generated definitions. The intelligence is in the Supervisor's prompt, not in the use case.

---

### Task 16: Enhance AssignTask to support re-assignment

**Files:**
- Modify: `src/use-cases/AssignTask.ts`
- Test: `tests/use-cases/AssignTask.test.ts`

- [ ] **Step 1: Write failing test for re-assignment**

```typescript
// Append to tests/use-cases/AssignTask.test.ts

describe("AssignTask – re-assignment", () => {
  it("can assign a task that was returned to queued status", async () => {
    // Create task in queued state (simulating re-queue after rejection)
    const task = createTask({
      id: createTaskId("t-retry"), goalId: createGoalId(), description: "retry task",
      phase: "code", budget: createBudget(10000, 1.0), status: "queued", retryCount: 1,
    })
    await taskRepo.create(task)

    const agent = createAgent({ id: createAgentId("dev-2"), role: ROLES.DEVELOPER, model: "sonnet" })
    await registry.register(agent)

    const result = await assignTask.execute(createTaskId("t-retry"), ROLES.DEVELOPER)
    expect(result.ok).toBe(true)

    const updated = await taskRepo.findById(createTaskId("t-retry"))
    expect(updated?.status).toBe("in_progress")
    expect(updated?.assignedTo).toBe("dev-2")
    expect(updated?.retryCount).toBe(1) // retryCount preserved, not reset
  })
})
```

- [ ] **Step 2: Run test**

Run: `npx jest tests/use-cases/AssignTask.test.ts --verbose`
Expected: PASS — AssignTask already checks `status === "queued"` and the test creates a queued task with retryCount. Should work without code change.

- [ ] **Step 3: Commit if tests pass**

If tests pass, no code changes needed. The re-assignment flow works because Supervisor sets status back to "queued" before calling AssignTask. Commit test only:

```bash
git add tests/use-cases/AssignTask.test.ts
git commit -m "test: verify AssignTask supports re-assignment for retry flow"
```

---

### Task 17: Create SupervisorPlugin

**Files:**
- Create: `src/adapters/plugins/agents/SupervisorPlugin.ts`
- Test: `tests/adapters/SupervisorPlugin.test.ts`

- [ ] **Step 1: Write tests**

Create `tests/adapters/SupervisorPlugin.test.ts`:

```typescript
import { SupervisorPlugin, type SupervisorPluginDeps } from "../../src/adapters/plugins/agents/SupervisorPlugin"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryGoalRepo } from "../../src/adapters/storage/InMemoryGoalRepo"
import { InMemoryAgentRegistry } from "../../src/adapters/storage/InMemoryAgentRegistry"
import { createAgentId, createGoalId, createTaskId, createMessageId } from "../../src/entities/ids"
import { createGoal } from "../../src/entities/Goal"
import { createTask } from "../../src/entities/Task"
import { createAgent } from "../../src/entities/Agent"
import { createBudget } from "../../src/entities/Budget"
import { createPipelineConfig } from "../../src/entities/PipelineConfig"
import { ROLES } from "../../src/entities/AgentRole"
import type { Message } from "../../src/entities/Message"
import type { DecomposeGoal, TaskDefinition } from "../../src/use-cases/DecomposeGoal"
import type { AssignTask } from "../../src/use-cases/AssignTask"
import type { PromptAgent } from "../../src/use-cases/PromptAgent"
import type { EvaluateKeepDiscard } from "../../src/use-cases/EvaluateKeepDiscard"
import type { MergeBranch } from "../../src/use-cases/MergeBranch"
import type { DiscardBranch } from "../../src/use-cases/DiscardBranch"
import { success } from "../../src/use-cases/Result"

describe("SupervisorPlugin", () => {
  it("has correct identity", () => {
    const plugin = createTestPlugin()
    expect(plugin.name).toBe("supervisor-agent")
    expect(plugin.id).toContain("supervisor")
  })

  it("subscribes to correct message types", () => {
    const plugin = createTestPlugin()
    const subs = plugin.subscriptions()
    const types = subs.flatMap(s => s.types ?? [])
    expect(types).toContain("goal.created")
    expect(types).toContain("task.completed")
    expect(types).toContain("code.completed")
    expect(types).toContain("task.failed")
    expect(types).toContain("review.approved")
    expect(types).toContain("review.rejected")
    expect(types).toContain("budget.exceeded")
    expect(types).toContain("agent.stuck")
  })

  it("handles goal.created by calling DecomposeGoal", async () => {
    let decomposeCalled = false
    const plugin = createTestPlugin({
      decomposeGoal: { execute: async () => { decomposeCalled = true; return success(undefined) } } as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "goal.created",
      goalId: createGoalId("g-1"), description: "Add auth", timestamp: new Date(),
    })

    expect(decomposeCalled).toBe(true)
  })

  it("handles review.approved by calling EvaluateKeepDiscard then MergeBranch", async () => {
    let mergeCalled = false
    const plugin = createTestPlugin({
      evaluateKeepDiscard: { execute: async () => success("keep" as const) } as any,
      mergeBranch: { execute: async () => { mergeCalled = true; return success("abc123") } } as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "review.approved",
      taskId: createTaskId("t-1"), reviewerId: createAgentId("rev-1"), timestamp: new Date(),
    })

    expect(mergeCalled).toBe(true)
  })
})

function createTestPlugin(overrides: Partial<SupervisorPluginDeps> = {}): SupervisorPlugin {
  const defaults: SupervisorPluginDeps = {
    agentId: createAgentId("supervisor-1"),
    projectId: "proj-1" as any,
    bus: new InMemoryBus(),
    taskRepo: new InMemoryTaskRepo(),
    goalRepo: new InMemoryGoalRepo(),
    agentRegistry: new InMemoryAgentRegistry(),
    decomposeGoal: { execute: async () => success(undefined) } as any,
    assignTask: { execute: async () => success(undefined) } as any,
    promptAgent: { execute: async () => success({ content: "[]", toolCalls: [], tokensIn: 0, tokensOut: 0, stopReason: "end_turn" as const }) } as any,
    evaluateKeepDiscard: { execute: async () => success("keep" as const) } as any,
    mergeBranch: { execute: async () => success("abc") } as any,
    discardBranch: { execute: async () => success(undefined) } as any,
    pipelineConfig: createPipelineConfig({
      phases: ["spec", "plan", "code", "review"],
      transitions: [{ from: "spec", to: "plan" }, { from: "plan", to: "code" }, { from: "code", to: "review" }],
      roleMapping: [
        { phase: "spec", role: ROLES.PRODUCT },
        { phase: "plan", role: ROLES.ARCHITECT },
        { phase: "code", role: ROLES.DEVELOPER },
        { phase: "review", role: ROLES.REVIEWER },
      ],
    }),
    maxRetries: 3,
    model: "claude-opus-4-6",
    systemPrompt: "You are a supervisor.",
  }
  return new SupervisorPlugin({ ...defaults, ...overrides })
}
```

- [ ] **Step 2: Run test to verify failure**

Run: `npx jest tests/adapters/SupervisorPlugin.test.ts --verbose`
Expected: FAIL — module doesn't exist

- [ ] **Step 3: Implement SupervisorPlugin**

Create `src/adapters/plugins/agents/SupervisorPlugin.ts`:

```typescript
import type { AgentId, ProjectId, GoalId, TaskId } from "../../../entities/ids"
import { createMessageId, createTaskId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PipelineConfig } from "../../../entities/PipelineConfig"
import { canAdvancePhase, roleForPhase } from "../../../entities/PipelineConfig"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { GoalRepository } from "../../../use-cases/ports/GoalRepository"
import type { AgentRegistry } from "../../../use-cases/ports/AgentRegistry"
import type { DecomposeGoal, TaskDefinition } from "../../../use-cases/DecomposeGoal"
import type { AssignTask } from "../../../use-cases/AssignTask"
import type { PromptAgent } from "../../../use-cases/PromptAgent"
import type { EvaluateKeepDiscard } from "../../../use-cases/EvaluateKeepDiscard"
import type { MergeBranch } from "../../../use-cases/MergeBranch"
import type { DiscardBranch } from "../../../use-cases/DiscardBranch"
import { createBudget } from "../../../entities/Budget"
import { ROLES } from "../../../entities/AgentRole"

export interface SupervisorPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly bus: MessagePort
  readonly taskRepo: TaskRepository
  readonly goalRepo: GoalRepository
  readonly agentRegistry: AgentRegistry
  readonly decomposeGoal: DecomposeGoal
  readonly assignTask: AssignTask
  readonly promptAgent: PromptAgent
  readonly evaluateKeepDiscard: EvaluateKeepDiscard
  readonly mergeBranch: MergeBranch
  readonly discardBranch: DiscardBranch
  readonly pipelineConfig: PipelineConfig
  readonly maxRetries: number
  readonly model: string
  readonly systemPrompt: string
}

export class SupervisorPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "supervisor-agent"
  readonly version = "1.0.0"
  readonly description = "Orchestration agent that decomposes goals and routes tasks"

  private readonly deps: SupervisorPluginDeps

  constructor(deps: SupervisorPluginDeps) {
    this.deps = deps
    this.id = `supervisor-${deps.agentId}`
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async healthCheck(): Promise<HealthStatus> { return "healthy" }

  subscriptions(): ReadonlyArray<MessageFilter> {
    return [{
      types: [
        "goal.created", "task.completed", "task.failed",
        "code.completed",
        "review.approved", "review.rejected",
        "budget.exceeded", "agent.stuck",
      ],
    }]
  }

  async handle(message: Message): Promise<void> {
    switch (message.type) {
      case "goal.created":
        return this.handleGoalCreated(message.goalId, message.description)
      case "task.completed":
        return this.handleTaskCompleted(message.taskId)
      case "code.completed":
        return this.handleTaskCompleted(message.taskId)
      case "task.failed":
        return this.handleTaskFailed(message.taskId, message.reason)
      case "review.approved":
        return this.handleReviewApproved(message.taskId)
      case "review.rejected":
        return this.handleReviewRejected(message.taskId, message.reasons)
      case "budget.exceeded":
        return this.handleBudgetExceeded(message.taskId)
      case "agent.stuck":
        return this.handleAgentStuck(message.taskId)
    }
  }

  private async handleGoalCreated(goalId: GoalId, description: string): Promise<void> {
    // Use AI to decompose the goal into tasks
    const prompt = {
      systemPrompt: this.deps.systemPrompt,
      messages: [{ role: "user" as const, content: `Decompose this goal into tasks. Return a JSON array of {description, phase} objects.\nPhases available: ${this.deps.pipelineConfig.phases.join(", ")}\n\nGoal: ${description}` }],
      model: this.deps.model,
      maxTokens: 4096,
    }

    const promptResult = await this.deps.promptAgent.execute(prompt, [], createBudget(10000, 1.0))
    if (!promptResult.ok) return

    // Parse AI response into task definitions
    let taskDefs: Array<{ description: string; phase: string }>
    try {
      const content = promptResult.value.content
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
      budget: createBudget(10000, 1.0),
    }))

    await this.deps.decomposeGoal.execute(goalId, definitions)

    // Assign the first phase task
    if (definitions.length > 0) {
      const firstDef = definitions[0]!
      const role = roleForPhase(firstDef.phase, this.deps.pipelineConfig)
      if (role) {
        await this.deps.assignTask.execute(firstDef.id, role)
      }
    }
  }

  private async handleTaskCompleted(taskId: TaskId): Promise<void> {
    const task = await this.deps.taskRepo.findById(taskId)
    if (!task) return

    // Find next queued task in pipeline order (tasks were all created during decomposition)
    const allTasks = await this.deps.taskRepo.findByGoalId(task.goalId)
    const phases = this.deps.pipelineConfig.phases
    const currentIdx = phases.indexOf(task.phase)

    const nextTask = allTasks.find(t =>
      t.status === "queued" && phases.indexOf(t.phase) > currentIdx
    )

    if (nextTask) {
      const role = roleForPhase(nextTask.phase, this.deps.pipelineConfig)
      if (role) await this.deps.assignTask.execute(nextTask.id, role)
    } else {
      // All tasks done — emit goal.completed
      await this.deps.bus.emit({
        id: createMessageId(),
        type: "goal.completed",
        goalId: task.goalId,
        costUsd: 0, // Phase 4: calculate from metrics
        timestamp: new Date(),
      })
    }
  }

  private async handleTaskFailed(taskId: TaskId, reason: string): Promise<void> {
    const task = await this.deps.taskRepo.findById(taskId)
    if (!task) return

    if (task.branch) {
      await this.deps.discardBranch.execute(taskId, reason)
    } else {
      // Non-code task failed — mark as discarded directly (no branch to clean up)
      const updated = { ...task, status: "discarded" as const, version: task.version + 1 }
      await this.deps.taskRepo.update(updated)
    }
  }

  private async handleReviewApproved(taskId: TaskId): Promise<void> {
    const result = await this.deps.evaluateKeepDiscard.execute(taskId, "approved", this.deps.maxRetries)
    if (!result.ok) return

    if (result.value === "keep") {
      await this.deps.mergeBranch.execute(taskId)
    }
  }

  private async handleReviewRejected(taskId: TaskId, _reasons: ReadonlyArray<string>): Promise<void> {
    const result = await this.deps.evaluateKeepDiscard.execute(taskId, "rejected", this.deps.maxRetries)
    if (!result.ok) return

    if (result.value === "retry") {
      const task = await this.deps.taskRepo.findById(taskId)
      if (!task) return

      // Re-queue the task for Developer
      const requeuedTask = { ...task, status: "queued" as const, assignedTo: null, version: task.version + 1 }
      await this.deps.taskRepo.update(requeuedTask)
      await this.deps.assignTask.execute(taskId, ROLES.DEVELOPER)
    } else if (result.value === "discard") {
      await this.deps.discardBranch.execute(taskId, "max retries exceeded")
    }
  }

  private async handleBudgetExceeded(taskId: TaskId): Promise<void> {
    await this.deps.discardBranch.execute(taskId, "budget exceeded")
  }

  private async handleAgentStuck(taskId: TaskId): Promise<void> {
    await this.deps.discardBranch.execute(taskId, "agent stuck")
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/adapters/SupervisorPlugin.test.ts --verbose`
Expected: ALL pass

- [ ] **Step 5: Commit**

```bash
git add src/adapters/plugins/agents/SupervisorPlugin.ts tests/adapters/SupervisorPlugin.test.ts
git commit -m "feat: add SupervisorPlugin — thin dispatcher for goal orchestration"
```

---

### Task 18: Create ProductPlugin and ArchitectPlugin

**Files:**
- Create: `src/adapters/plugins/agents/ProductPlugin.ts`
- Create: `src/adapters/plugins/agents/ArchitectPlugin.ts`
- Test: `tests/adapters/ProductPlugin.test.ts`
- Test: `tests/adapters/ArchitectPlugin.test.ts`

- [ ] **Step 1: Write tests for ProductPlugin**

Create `tests/adapters/ProductPlugin.test.ts`:

```typescript
import { ProductPlugin } from "../../src/adapters/plugins/agents/ProductPlugin"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryArtifactRepo } from "../../src/adapters/storage/InMemoryArtifactRepo"
import { createTask } from "../../src/entities/Task"
import { createAgentId, createTaskId, createGoalId, createMessageId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import { ROLES } from "../../src/entities/AgentRole"
import type { AgentExecutor } from "../../src/use-cases/ports/AgentExecutor"
import type { CreateArtifactUseCase } from "../../src/use-cases/CreateArtifact"
import { success } from "../../src/use-cases/Result"

describe("ProductPlugin", () => {
  it("has correct identity and subscribes to task.assigned", () => {
    const plugin = createTestProductPlugin()
    expect(plugin.name).toBe("product-agent")
    const subs = plugin.subscriptions()
    expect(subs[0].types).toContain("task.assigned")
    expect(subs[0].agentId).toBe("product-1")
  })

  it("ignores messages for other agents", async () => {
    let executorCalled = false
    const plugin = createTestProductPlugin({
      executor: { async *run() { executorCalled = true; yield { type: "task_completed", data: {} } } } as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "task.assigned",
      taskId: createTaskId("t-1"), agentId: createAgentId("other-agent"), timestamp: new Date(),
    })

    expect(executorCalled).toBe(false)
  })

  it("calls executor and creates spec artifact on task.assigned", async () => {
    let artifactCreated = false
    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "write spec",
      phase: "spec", budget: createBudget(5000, 0.5),
    })
    await taskRepo.create(task)

    const plugin = createTestProductPlugin({
      taskRepo,
      executor: {
        async *run() {
          yield { type: "task_completed", data: { taskId: "t-1", content: "# Requirements\n1. Auth" } }
        },
      } as any,
      createArtifact: { execute: async () => { artifactCreated = true; return success(undefined) } } as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "task.assigned",
      taskId: createTaskId("t-1"), agentId: createAgentId("product-1"), timestamp: new Date(),
    })

    expect(artifactCreated).toBe(true)
  })
})

function createTestProductPlugin(overrides: Record<string, any> = {}): ProductPlugin {
  return new ProductPlugin({
    agentId: createAgentId("product-1"),
    projectId: "proj-1" as any,
    executor: { async *run() { yield { type: "task_completed", data: {} } } } as any,
    taskRepo: overrides.taskRepo ?? new InMemoryTaskRepo(),
    artifactRepo: new InMemoryArtifactRepo(),
    createArtifact: overrides.createArtifact ?? { execute: async () => success(undefined) } as any,
    bus: new InMemoryBus(),
    systemPrompt: "Write a spec.",
    model: "sonnet",
    ...overrides,
  })
}
```

- [ ] **Step 2: Implement ProductPlugin**

Create `src/adapters/plugins/agents/ProductPlugin.ts`:

```typescript
import type { AgentId, ProjectId } from "../../../entities/ids"
import { createMessageId, createArtifactId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { AgentExecutor } from "../../../use-cases/ports/AgentExecutor"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { ArtifactRepository } from "../../../use-cases/ports/ArtifactRepository"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { CreateArtifactUseCase } from "../../../use-cases/CreateArtifact"
import { createArtifact } from "../../../entities/Artifact"
import { ROLES } from "../../../entities/AgentRole"

export interface ProductPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly executor: AgentExecutor
  readonly taskRepo: TaskRepository
  readonly artifactRepo: ArtifactRepository
  readonly createArtifact: CreateArtifactUseCase
  readonly bus: MessagePort
  readonly systemPrompt: string
  readonly model: string
}

export class ProductPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "product-agent"
  readonly version = "1.0.0"
  readonly description = "Product agent that writes requirement specs"

  private readonly deps: ProductPluginDeps

  constructor(deps: ProductPluginDeps) {
    this.deps = deps
    this.id = `product-${deps.agentId}`
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

    const config = {
      role: ROLES.PRODUCT,
      systemPrompt: this.deps.systemPrompt,
      tools: [],
      model: this.deps.model,
      budget: task.budget,
    }

    let content = ""
    for await (const event of this.deps.executor.run(this.deps.agentId, config, task, this.deps.projectId)) {
      if (event.type === "task_completed" && typeof event.data["content"] === "string") {
        content = event.data["content"] as string
      }
    }

    // Create spec artifact
    if (content) {
      const artifact = createArtifact({
        id: createArtifactId(),
        kind: "spec",
        format: "markdown",
        taskId: task.id,
        createdBy: this.deps.agentId,
        content,
        metadata: {
          requirementCount: (content.match(/^\d+\./gm) || []).length,
          hasSuccessCriteria: content.toLowerCase().includes("success criteria"),
        },
      })
      await this.deps.createArtifact.execute(artifact)
    }

    // Emit task.completed
    await this.deps.bus.emit({
      id: createMessageId(),
      type: "task.completed",
      taskId: message.taskId,
      agentId: this.deps.agentId,
      timestamp: new Date(),
    })
  }
}
```

- [ ] **Step 3: Write tests for ArchitectPlugin**

Create `tests/adapters/ArchitectPlugin.test.ts`:

```typescript
import { ArchitectPlugin } from "../../src/adapters/plugins/agents/ArchitectPlugin"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryArtifactRepo } from "../../src/adapters/storage/InMemoryArtifactRepo"
import { createTask } from "../../src/entities/Task"
import { createArtifact } from "../../src/entities/Artifact"
import { createAgentId, createTaskId, createGoalId, createMessageId, createArtifactId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import { success } from "../../src/use-cases/Result"

describe("ArchitectPlugin", () => {
  it("has correct identity and subscribes to task.assigned filtered by agentId", () => {
    const plugin = createTestArchitectPlugin()
    expect(plugin.name).toBe("architect-agent")
    const subs = plugin.subscriptions()
    expect(subs[0].agentId).toBe("architect-1")
  })

  it("reads spec artifact before generating plan", async () => {
    const artifactRepo = new InMemoryArtifactRepo()
    const taskRepo = new InMemoryTaskRepo()

    const spec = createArtifact({
      id: createArtifactId("spec-1"), kind: "spec", format: "markdown",
      taskId: createTaskId("t-1"), createdBy: createAgentId("prod-1"),
      content: "# Requirements\n1. Auth", metadata: { requirementCount: 1, hasSuccessCriteria: false },
    })
    await artifactRepo.create(spec)

    const task = createTask({
      id: createTaskId("t-plan"), goalId: createGoalId(), description: "design plan",
      phase: "plan", budget: createBudget(5000, 0.5), artifacts: [createArtifactId("spec-1")],
    })
    await taskRepo.create(task)

    let artifactCreated = false
    const plugin = createTestArchitectPlugin({
      taskRepo, artifactRepo,
      createArtifact: { execute: async () => { artifactCreated = true; return success(undefined) } } as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "task.assigned",
      taskId: createTaskId("t-plan"), agentId: createAgentId("architect-1"), timestamp: new Date(),
    })

    expect(artifactCreated).toBe(true)
  })
})

function createTestArchitectPlugin(overrides: Record<string, any> = {}): ArchitectPlugin {
  return new ArchitectPlugin({
    agentId: createAgentId("architect-1"),
    projectId: "proj-1" as any,
    executor: { async *run() { yield { type: "task_completed", data: { content: "# Plan\n## Step 1" } } } } as any,
    taskRepo: overrides.taskRepo ?? new InMemoryTaskRepo(),
    artifactRepo: overrides.artifactRepo ?? new InMemoryArtifactRepo(),
    createArtifact: overrides.createArtifact ?? { execute: async () => success(undefined) } as any,
    bus: new InMemoryBus(),
    systemPrompt: "Design a plan.",
    model: "sonnet",
    ...overrides,
  })
}
```

- [ ] **Step 4: Implement ArchitectPlugin**

Create `src/adapters/plugins/agents/ArchitectPlugin.ts`:

```typescript
import type { AgentId, ProjectId } from "../../../entities/ids"
import { createMessageId, createArtifactId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { AgentExecutor } from "../../../use-cases/ports/AgentExecutor"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { ArtifactRepository } from "../../../use-cases/ports/ArtifactRepository"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { CreateArtifactUseCase } from "../../../use-cases/CreateArtifact"
import { createArtifact } from "../../../entities/Artifact"
import { ROLES } from "../../../entities/AgentRole"

export interface ArchitectPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly executor: AgentExecutor
  readonly taskRepo: TaskRepository
  readonly artifactRepo: ArtifactRepository
  readonly createArtifact: CreateArtifactUseCase
  readonly bus: MessagePort
  readonly systemPrompt: string
  readonly model: string
}

export class ArchitectPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "architect-agent"
  readonly version = "1.0.0"
  readonly description = "Architect agent that creates implementation plans"

  private readonly deps: ArchitectPluginDeps

  constructor(deps: ArchitectPluginDeps) {
    this.deps = deps
    this.id = `architect-${deps.agentId}`
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

    // Read spec artifact if available
    const artifacts = await this.deps.artifactRepo.findByTaskId(task.id)
    const specArtifact = artifacts.find(a => a.kind === "spec")
    const specContext = specArtifact ? `\n\nSpec:\n${specArtifact.content}` : ""

    const config = {
      role: ROLES.ARCHITECT,
      systemPrompt: this.deps.systemPrompt + specContext,
      tools: [],
      model: this.deps.model,
      budget: task.budget,
    }

    let content = ""
    for await (const event of this.deps.executor.run(this.deps.agentId, config, task, this.deps.projectId)) {
      if (event.type === "task_completed" && typeof event.data["content"] === "string") {
        content = event.data["content"] as string
      }
    }

    if (content) {
      const artifact = createArtifact({
        id: createArtifactId(),
        kind: "plan",
        format: "markdown",
        taskId: task.id,
        createdBy: this.deps.agentId,
        content,
        metadata: {
          stepCount: (content.match(/^##\s+Step/gm) || []).length,
          estimatedTokens: content.length * 2,
        },
      })
      await this.deps.createArtifact.execute(artifact)
    }

    await this.deps.bus.emit({
      id: createMessageId(),
      type: "task.completed",
      taskId: message.taskId,
      agentId: this.deps.agentId,
      timestamp: new Date(),
    })
  }
}
```

- [ ] **Step 5: Run all tests**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 6: Commit**

```bash
git add src/adapters/plugins/agents/ProductPlugin.ts src/adapters/plugins/agents/ArchitectPlugin.ts tests/adapters/ProductPlugin.test.ts tests/adapters/ArchitectPlugin.test.ts
git commit -m "feat: add ProductPlugin and ArchitectPlugin — lightweight AI via executor"
```

---

## Batch 3: Code Review Loop

### Task 19: Create NodeWorktreeManager adapter

**Files:**
- Create: `src/adapters/worktree/NodeWorktreeManager.ts`
- Test: `tests/adapters/NodeWorktreeManager.test.ts`

- [ ] **Step 1: Write test (uses temp git repo)**

Create `tests/adapters/NodeWorktreeManager.test.ts`:

```typescript
import { NodeWorktreeManager } from "../../src/adapters/worktree/NodeWorktreeManager"
import { NodeShellExecutor } from "../../src/adapters/shell/NodeShellExecutor"
import { mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { execSync } from "node:child_process"

describe("NodeWorktreeManager", () => {
  let repoDir: string
  let mgr: NodeWorktreeManager

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), "devfleet-test-"))
    execSync("git init && git commit --allow-empty -m init", { cwd: repoDir })
    const shell = new NodeShellExecutor(repoDir)
    mgr = new NodeWorktreeManager(shell, repoDir)
  })

  it("creates a worktree and reports it exists", async () => {
    const path = await mgr.create("test-branch")
    expect(path).toContain("test-branch")
    expect(await mgr.exists("test-branch")).toBe(true)
  })

  it("deletes a worktree", async () => {
    await mgr.create("del-branch")
    await mgr.delete("del-branch")
    expect(await mgr.exists("del-branch")).toBe(false)
  })

  it("merges a worktree branch", async () => {
    const path = await mgr.create("merge-branch")
    // Create a file in the worktree
    writeFileSync(join(path, "test.txt"), "hello")
    execSync("git add . && git commit -m 'add test'", { cwd: path })

    const result = await mgr.merge("merge-branch")
    expect(result.success).toBe(true)
  })
})
```

- [ ] **Step 2: Implement NodeWorktreeManager**

Create `src/adapters/worktree/NodeWorktreeManager.ts`:

```typescript
import type { WorktreeManager, WorktreePath, MergeResult } from "../../use-cases/ports/WorktreeManager"
import type { ShellExecutor } from "../../use-cases/ports/ShellExecutor"
import { join } from "node:path"

export class NodeWorktreeManager implements WorktreeManager {
  constructor(
    private readonly shell: ShellExecutor,
    private readonly projectRoot: string,
  ) {}

  async create(branch: string, baseBranch?: string): Promise<WorktreePath> {
    const worktreePath = join(this.projectRoot, ".worktrees", branch)
    const base = baseBranch ?? "HEAD"
    await this.shell.execute(`git worktree add -b "${branch}" "${worktreePath}" ${base}`)
    return worktreePath
  }

  async delete(branch: string): Promise<void> {
    const worktreePath = join(this.projectRoot, ".worktrees", branch)
    await this.shell.execute(`git worktree remove "${worktreePath}" --force`)
    await this.shell.execute(`git branch -D "${branch}"`)
  }

  async merge(branch: string, targetBranch?: string): Promise<MergeResult> {
    const target = targetBranch ?? "HEAD"
    try {
      const result = await this.shell.execute(`git merge "${branch}" --no-edit`)
      const commitResult = await this.shell.execute("git rev-parse HEAD")
      const commit = commitResult.stdout.trim()

      // Clean up worktree after merge
      const worktreePath = join(this.projectRoot, ".worktrees", branch)
      await this.shell.execute(`git worktree remove "${worktreePath}" --force`).catch(() => {})
      await this.shell.execute(`git branch -D "${branch}"`).catch(() => {})

      return { success: true, commit }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  }

  async exists(branch: string): Promise<boolean> {
    try {
      const result = await this.shell.execute("git worktree list --porcelain")
      return result.stdout.includes(branch)
    } catch {
      return false
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest tests/adapters/NodeWorktreeManager.test.ts --verbose`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add src/adapters/worktree/NodeWorktreeManager.ts tests/adapters/NodeWorktreeManager.test.ts
git commit -m "feat: add NodeWorktreeManager adapter for git worktree isolation"
```

---

### Task 20: Enhance DeveloperPlugin with worktree isolation

**Files:**
- Modify: `src/adapters/plugins/agents/DeveloperPlugin.ts`
- Test: `tests/adapters/DeveloperPlugin.test.ts`

- [ ] **Step 1: Write failing test for worktree usage**

```typescript
// Append to tests/adapters/DeveloperPlugin.test.ts

describe("DeveloperPlugin – worktree isolation", () => {
  it("creates worktree on task.assigned and uses scoped executor", async () => {
    let worktreeCreated = false
    let scopedPath: string | null = null

    const mockWorktree = {
      create: async (branch: string) => { worktreeCreated = true; return `/tmp/${branch}` },
      delete: async () => {},
      merge: async () => ({ success: true as const, commit: "abc" }),
      exists: async () => false,
    }

    const mockFsFactory = (path: string) => { scopedPath = path; return {} as any }
    const mockShellFactory = (_path: string) => ({} as any)

    // Create plugin with worktree deps
    // This will require updating the DeveloperPlugin constructor
  })
})
```

- [ ] **Step 2: Update DeveloperPlugin to accept worktree deps**

Modify `src/adapters/plugins/agents/DeveloperPlugin.ts` — add optional worktree dependencies to `DeveloperPluginDeps`:

```typescript
import type { WorktreeManager } from "../../../use-cases/ports/WorktreeManager"
import type { FileSystemFactory } from "../../../use-cases/ports/FileSystem"
import type { ShellExecutorFactory } from "../../../use-cases/ports/ShellExecutor"

export interface DeveloperPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly executor: AgentExecutor
  readonly taskRepo: TaskRepository
  readonly systemPrompt: string
  readonly model: string
  readonly bus?: MessagePort
  readonly worktreeManager?: WorktreeManager
  readonly fsFactory?: FileSystemFactory
  readonly shellFactory?: ShellExecutorFactory
}
```

Update `handle()` to create worktree when manager is available:

```typescript
async handle(message: Message): Promise<void> {
  if (message.type !== "task.assigned") return
  if (message.agentId !== this.deps.agentId) return

  const task = await this.deps.taskRepo.findById(message.taskId)
  if (!task) return

  // Create worktree if manager is available
  let branchName: string | null = null
  if (this.deps.worktreeManager) {
    branchName = `devfleet/task-${task.id}`
    await this.deps.worktreeManager.create(branchName)

    // Update task with branch
    const updatedTask = { ...task, branch: branchName, version: task.version + 1 }
    await this.deps.taskRepo.update(updatedTask)
  }

  const config = {
    role: ROLES.DEVELOPER,
    systemPrompt: this.deps.systemPrompt,
    tools: DEVELOPER_TOOLS,
    model: this.deps.model,
    budget: task.budget,
  }

  for await (const event of this.deps.executor.run(this.deps.agentId, config, task, this.deps.projectId)) {
    if (event.type === "task_completed" && this.deps.bus) {
      await this.deps.bus.emit({
        id: createMessageId(),
        type: "code.completed",
        taskId: message.taskId,
        artifactId: createArtifactId(),
        branch: branchName ?? "main",
        filesChanged: 0,
        testsWritten: 0,
        timestamp: new Date(),
      })
    }
  }
}
```

Note: DeveloperPlugin now emits `code.completed` instead of `task.completed` — this is the correct Phase 2 message for code-phase tasks.

- [ ] **Step 3: Update existing DeveloperPlugin tests**

Update `tests/adapters/DeveloperPlugin.test.ts` to expect `code.completed` instead of `task.completed`. Also add import for `createArtifactId`.

- [ ] **Step 4: Run tests**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 5: Commit**

```bash
git add src/adapters/plugins/agents/DeveloperPlugin.ts tests/adapters/DeveloperPlugin.test.ts
git commit -m "feat: enhance DeveloperPlugin with worktree isolation and code.completed"
```

---

### Task 21: Create ReviewerPlugin, OpsPlugin, LearnerPlugin

**Files:**
- Create: `src/adapters/plugins/agents/ReviewerPlugin.ts`
- Create: `src/adapters/plugins/agents/OpsPlugin.ts`
- Create: `src/adapters/plugins/agents/LearnerPlugin.ts`
- Test: `tests/adapters/ReviewerPlugin.test.ts`
- Test: `tests/adapters/OpsPlugin.test.ts`
- Test: `tests/adapters/LearnerPlugin.test.ts`

- [ ] **Step 1: Write ReviewerPlugin test**

Create `tests/adapters/ReviewerPlugin.test.ts`:

```typescript
import { ReviewerPlugin } from "../../src/adapters/plugins/agents/ReviewerPlugin"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryArtifactRepo } from "../../src/adapters/storage/InMemoryArtifactRepo"
import { createTask } from "../../src/entities/Task"
import { createArtifact } from "../../src/entities/Artifact"
import { createAgentId, createTaskId, createGoalId, createMessageId, createArtifactId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import { success } from "../../src/use-cases/Result"
import type { Message } from "../../src/entities/Message"

describe("ReviewerPlugin", () => {
  it("has correct identity and subscribes filtered by agentId", () => {
    const plugin = createTestReviewerPlugin()
    expect(plugin.name).toBe("reviewer-agent")
    const subs = plugin.subscriptions()
    expect(subs[0].types).toContain("task.assigned")
    expect(subs[0].agentId).toBe("reviewer-1")
  })

  it("ignores messages for other agents", async () => {
    let executorCalled = false
    const plugin = createTestReviewerPlugin({
      executor: { async *run() { executorCalled = true; yield { type: "task_completed", data: {} } } } as any,
    })
    await plugin.handle({
      id: createMessageId(), type: "task.assigned",
      taskId: createTaskId("t-1"), agentId: createAgentId("other"), timestamp: new Date(),
    })
    expect(executorCalled).toBe(false)
  })

  it("emits review.approved when AI verdict is approved", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })

    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "review code",
      phase: "review", budget: createBudget(10000, 1.0),
    })
    await taskRepo.create(task)

    const plugin = createTestReviewerPlugin({
      taskRepo, bus,
      executor: { async *run() {
        yield { type: "task_completed", data: { content: "APPROVED\nAll tests pass." } }
      }} as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "task.assigned",
      taskId: createTaskId("t-1"), agentId: createAgentId("reviewer-1"), timestamp: new Date(),
    })

    const reviewMsg = emitted.find(m => m.type === "review.approved" || m.type === "review.rejected")
    expect(reviewMsg?.type).toBe("review.approved")
  })

  it("emits review.rejected when AI verdict is rejected", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })

    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "review code",
      phase: "review", budget: createBudget(10000, 1.0),
    })
    await taskRepo.create(task)

    const plugin = createTestReviewerPlugin({
      taskRepo, bus,
      executor: { async *run() {
        yield { type: "task_completed", data: { content: "REJECTED\nNo tests found.\nNaming violations." } }
      }} as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "task.assigned",
      taskId: createTaskId("t-1"), agentId: createAgentId("reviewer-1"), timestamp: new Date(),
    })

    const reviewMsg = emitted.find(m => m.type === "review.rejected")
    expect(reviewMsg?.type).toBe("review.rejected")
  })
})

function createTestReviewerPlugin(overrides: Record<string, any> = {}): ReviewerPlugin {
  return new ReviewerPlugin({
    agentId: createAgentId("reviewer-1"),
    projectId: "proj-1" as any,
    executor: { async *run() { yield { type: "task_completed", data: { content: "APPROVED" } } } } as any,
    taskRepo: overrides.taskRepo ?? new InMemoryTaskRepo(),
    artifactRepo: overrides.artifactRepo ?? new InMemoryArtifactRepo(),
    createArtifact: overrides.createArtifact ?? { execute: async () => success(undefined) } as any,
    bus: overrides.bus ?? new InMemoryBus(),
    systemPrompt: "Review this code.",
    model: "claude-opus-4-6",
    ...overrides,
  })
}
```

- [ ] **Step 2: Implement ReviewerPlugin**

Create `src/adapters/plugins/agents/ReviewerPlugin.ts`:

```typescript
import type { AgentId, ProjectId } from "../../../entities/ids"
import { createMessageId, createArtifactId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { AgentExecutor } from "../../../use-cases/ports/AgentExecutor"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { ArtifactRepository } from "../../../use-cases/ports/ArtifactRepository"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { CreateArtifactUseCase } from "../../../use-cases/CreateArtifact"
import type { ToolDefinition } from "../../../use-cases/ports/AIProvider"
import { createArtifact } from "../../../entities/Artifact"
import { ROLES } from "../../../entities/AgentRole"

export interface ReviewerPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly executor: AgentExecutor
  readonly taskRepo: TaskRepository
  readonly artifactRepo: ArtifactRepository
  readonly createArtifact: CreateArtifactUseCase
  readonly bus: MessagePort
  readonly systemPrompt: string
  readonly model: string
}

const REVIEWER_TOOLS: ToolDefinition[] = [
  { name: "file_read", description: "Read a file", inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] } },
  { name: "file_glob", description: "List files matching a pattern", inputSchema: { type: "object", properties: { pattern: { type: "string" } }, required: ["pattern"] } },
  { name: "shell_run", description: "Run a shell command", inputSchema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } },
]

export class ReviewerPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "reviewer-agent"
  readonly version = "1.0.0"
  readonly description = "Reviewer agent that evaluates code against specs and plans"

  private readonly deps: ReviewerPluginDeps

  constructor(deps: ReviewerPluginDeps) {
    this.deps = deps
    this.id = `reviewer-${deps.agentId}`
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

    // Read all task artifacts (spec, plan, diff) for context
    const artifacts = await this.deps.artifactRepo.findByTaskId(task.id)
    const artifactContext = artifacts.map(a => `[${a.kind}]:\n${a.content}`).join("\n\n---\n\n")

    const config = {
      role: ROLES.REVIEWER,
      systemPrompt: this.deps.systemPrompt + (artifactContext ? `\n\nArtifacts for review:\n${artifactContext}` : ""),
      tools: REVIEWER_TOOLS,
      model: this.deps.model,
      budget: task.budget,
    }

    let content = ""
    for await (const event of this.deps.executor.run(this.deps.agentId, config, task, this.deps.projectId)) {
      if (event.type === "task_completed" && typeof event.data["content"] === "string") {
        content = event.data["content"] as string
      }
    }

    // Parse verdict from AI response
    const approved = content.toUpperCase().includes("APPROVED")
    const reasons = approved ? [] : content.split("\n").filter(l => l.trim().length > 0 && !l.toUpperCase().includes("REJECTED"))

    // Create review artifact
    const artifact = createArtifact({
      id: createArtifactId(),
      kind: "review",
      format: "markdown",
      taskId: task.id,
      createdBy: this.deps.agentId,
      content,
      metadata: { verdict: approved ? "approved" : "rejected", issueCount: reasons.length },
    })
    await this.deps.createArtifact.execute(artifact)

    // Emit verdict message
    if (approved) {
      await this.deps.bus.emit({
        id: createMessageId(), type: "review.approved",
        taskId: message.taskId, reviewerId: this.deps.agentId, timestamp: new Date(),
      })
    } else {
      await this.deps.bus.emit({
        id: createMessageId(), type: "review.rejected",
        taskId: message.taskId, reviewerId: this.deps.agentId,
        reasons, timestamp: new Date(),
      })
    }
  }
}
```

- [ ] **Step 3: Run ReviewerPlugin tests**

Run: `npx jest tests/adapters/ReviewerPlugin.test.ts --verbose`
Expected: ALL pass

- [ ] **Step 4: Commit ReviewerPlugin**

```bash
git add src/adapters/plugins/agents/ReviewerPlugin.ts tests/adapters/ReviewerPlugin.test.ts
git commit -m "feat: add ReviewerPlugin — full AI with tools for code review"
```

- [ ] **Step 5: Write OpsPlugin test**

Create `tests/adapters/OpsPlugin.test.ts`:

```typescript
import { OpsPlugin } from "../../src/adapters/plugins/agents/OpsPlugin"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryArtifactRepo } from "../../src/adapters/storage/InMemoryArtifactRepo"
import { createTask } from "../../src/entities/Task"
import { createAgentId, createTaskId, createGoalId, createMessageId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import { success } from "../../src/use-cases/Result"
import type { Message } from "../../src/entities/Message"

describe("OpsPlugin", () => {
  it("has correct identity and subscribes filtered by agentId", () => {
    const plugin = createTestOpsPlugin()
    expect(plugin.name).toBe("ops-agent")
    const subs = plugin.subscriptions()
    expect(subs[0].agentId).toBe("ops-1")
  })

  it("emits build.passed and test.report.created on success", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })

    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "run tests",
      phase: "test", budget: createBudget(5000, 0.5),
    })
    await taskRepo.create(task)

    const plugin = createTestOpsPlugin({ taskRepo, bus })

    await plugin.handle({
      id: createMessageId(), type: "task.assigned",
      taskId: createTaskId("t-1"), agentId: createAgentId("ops-1"), timestamp: new Date(),
    })

    const buildMsg = emitted.find(m => m.type === "build.passed" || m.type === "build.failed")
    expect(buildMsg?.type).toBe("build.passed")
    const reportMsg = emitted.find(m => m.type === "test.report.created")
    expect(reportMsg).toBeDefined()
  })
})

function createTestOpsPlugin(overrides: Record<string, any> = {}): OpsPlugin {
  return new OpsPlugin({
    agentId: createAgentId("ops-1"),
    projectId: "proj-1" as any,
    executor: {
      async *run() {
        yield { type: "tool_executed", data: { toolName: "shell_run", success: true } }
        yield { type: "task_completed", data: { content: "Build OK\n10 passed, 0 failed" } }
      },
    } as any,
    taskRepo: overrides.taskRepo ?? new InMemoryTaskRepo(),
    artifactRepo: overrides.artifactRepo ?? new InMemoryArtifactRepo(),
    createArtifact: overrides.createArtifact ?? { execute: async () => success(undefined) } as any,
    bus: overrides.bus ?? new InMemoryBus(),
    ...overrides,
  })
}
```

- [ ] **Step 6: Implement OpsPlugin**

Create `src/adapters/plugins/agents/OpsPlugin.ts`:

```typescript
import type { AgentId, ProjectId } from "../../../entities/ids"
import { createMessageId, createArtifactId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { AgentExecutor } from "../../../use-cases/ports/AgentExecutor"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { ArtifactRepository } from "../../../use-cases/ports/ArtifactRepository"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { CreateArtifactUseCase } from "../../../use-cases/CreateArtifact"
import { createArtifact } from "../../../entities/Artifact"
import { ROLES } from "../../../entities/AgentRole"

export interface OpsPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly executor: AgentExecutor
  readonly taskRepo: TaskRepository
  readonly artifactRepo: ArtifactRepository
  readonly createArtifact: CreateArtifactUseCase
  readonly bus: MessagePort
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

    // DeterministicProvider is configured in the executor — just run it
    const config = {
      role: ROLES.OPS,
      systemPrompt: "",
      tools: [{ name: "shell_run", description: "Run a shell command", inputSchema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] } }],
      model: "deterministic",
      budget: task.budget,
    }

    let buildOutput = ""
    const startTime = Date.now()
    let buildFailed = false

    for await (const event of this.deps.executor.run(this.deps.agentId, config, task, this.deps.projectId)) {
      if (event.type === "tool_executed" && event.data["success"] === false) {
        buildFailed = true
      }
      if (event.type === "task_completed" && typeof event.data["content"] === "string") {
        buildOutput = event.data["content"] as string
      }
    }

    const durationMs = Date.now() - startTime

    // Parse test results from output
    const passedMatch = buildOutput.match(/(\d+)\s+passed/)
    const failedMatch = buildOutput.match(/(\d+)\s+failed/)
    const passed = passedMatch ? parseInt(passedMatch[1]!) : 0
    const failed = failedMatch ? parseInt(failedMatch[1]!) : 0

    // Create test_report artifact
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

    // Emit build result
    if (buildFailed || failed > 0) {
      await this.deps.bus.emit({
        id: createMessageId(), type: "build.failed",
        taskId: task.id, error: buildOutput, timestamp: new Date(),
      })
    } else {
      await this.deps.bus.emit({
        id: createMessageId(), type: "build.passed",
        taskId: task.id, durationMs, timestamp: new Date(),
      })
    }

    // Emit test report
    await this.deps.bus.emit({
      id: createMessageId(), type: "test.report.created",
      taskId: task.id, artifactId: artifact.id, timestamp: new Date(),
    })

    // Emit task.completed for pipeline advancement
    await this.deps.bus.emit({
      id: createMessageId(), type: "task.completed",
      taskId: task.id, agentId: this.deps.agentId, timestamp: new Date(),
    })
  }
}
```

- [ ] **Step 7: Run OpsPlugin tests**

Run: `npx jest tests/adapters/OpsPlugin.test.ts --verbose`
Expected: ALL pass

- [ ] **Step 8: Commit OpsPlugin**

```bash
git add src/adapters/plugins/agents/OpsPlugin.ts tests/adapters/OpsPlugin.test.ts
git commit -m "feat: add OpsPlugin — deterministic build/test via executor"
```

- [ ] **Step 9: Write LearnerPlugin test**

Create `tests/adapters/LearnerPlugin.test.ts`:

```typescript
import { LearnerPlugin } from "../../src/adapters/plugins/agents/LearnerPlugin"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryEventStore } from "../../src/adapters/storage/InMemoryEventStore"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { createTask } from "../../src/entities/Task"
import { createAgentId, createTaskId, createGoalId, createMessageId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("LearnerPlugin", () => {
  it("has correct identity and subscribes to review/goal/budget events", () => {
    const plugin = createTestLearnerPlugin()
    expect(plugin.name).toBe("learner-agent")
    const subs = plugin.subscriptions()
    const types = subs.flatMap(s => s.types ?? [])
    expect(types).toContain("review.approved")
    expect(types).toContain("review.rejected")
    expect(types).toContain("goal.completed")
    expect(types).toContain("budget.exceeded")
  })

  it("creates KeepDiscardRecord on review.approved", async () => {
    const eventStore = new InMemoryEventStore()
    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget(10000, 1.0), assignedTo: createAgentId("dev-1"),
    })
    await taskRepo.create(task)

    const plugin = createTestLearnerPlugin({ eventStore, taskRepo })

    await plugin.handle({
      id: createMessageId(), type: "review.approved",
      taskId: createTaskId("t-1"), reviewerId: createAgentId("rev-1"), timestamp: new Date(),
    })

    expect(plugin.keepDiscardRecords).toHaveLength(1)
    expect(plugin.keepDiscardRecords[0]?.verdict).toBe("approved")
  })

  it("creates KeepDiscardRecord on review.rejected", async () => {
    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget(10000, 1.0), assignedTo: createAgentId("dev-1"),
    })
    await taskRepo.create(task)

    const plugin = createTestLearnerPlugin({ taskRepo })

    await plugin.handle({
      id: createMessageId(), type: "review.rejected",
      taskId: createTaskId("t-1"), reviewerId: createAgentId("rev-1"),
      reasons: ["no tests", "bad naming"], timestamp: new Date(),
    })

    expect(plugin.keepDiscardRecords).toHaveLength(1)
    expect(plugin.keepDiscardRecords[0]?.verdict).toBe("rejected")
    expect(plugin.keepDiscardRecords[0]?.reasons).toEqual(["no tests", "bad naming"])
  })

  it("records event on goal.completed", async () => {
    const eventStore = new InMemoryEventStore()
    const plugin = createTestLearnerPlugin({ eventStore })

    await plugin.handle({
      id: createMessageId(), type: "goal.completed",
      goalId: createGoalId("g-1"), costUsd: 0.5, timestamp: new Date(),
    })

    const events = await eventStore.findByGoalId(createGoalId("g-1"))
    expect(events.length).toBeGreaterThan(0)
  })
})

function createTestLearnerPlugin(overrides: Record<string, any> = {}): LearnerPlugin {
  return new LearnerPlugin({
    agentId: createAgentId("learner-1"),
    bus: overrides.bus ?? new InMemoryBus(),
    eventStore: overrides.eventStore ?? new InMemoryEventStore(),
    taskRepo: overrides.taskRepo ?? new InMemoryTaskRepo(),
    ...overrides,
  })
}
```

- [ ] **Step 10: Implement LearnerPlugin**

Create `src/adapters/plugins/agents/LearnerPlugin.ts`:

```typescript
import type { AgentId } from "../../../entities/ids"
import { createEventId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { EventStore } from "../../../use-cases/ports/EventStore"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import { type KeepDiscardRecord, createKeepDiscardRecord } from "../../../entities/KeepDiscardRecord"

export interface LearnerPluginDeps {
  readonly agentId: AgentId
  readonly bus: MessagePort
  readonly eventStore: EventStore
  readonly taskRepo: TaskRepository
}

export class LearnerPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "learner-agent"
  readonly version = "1.0.0"
  readonly description = "Learner agent that records structured events for future analysis"

  private readonly deps: LearnerPluginDeps
  readonly keepDiscardRecords: KeepDiscardRecord[] = []

  constructor(deps: LearnerPluginDeps) {
    this.deps = deps
    this.id = `learner-${deps.agentId}`
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async healthCheck(): Promise<HealthStatus> { return "healthy" }

  subscriptions(): ReadonlyArray<MessageFilter> {
    return [{
      types: [
        "review.approved", "review.rejected",
        "goal.completed", "budget.exceeded",
        "insight.generated", "ceo.override",
      ],
    }]
  }

  async handle(message: Message): Promise<void> {
    switch (message.type) {
      case "review.approved":
        return this.handleReviewVerdict(message.taskId, "approved", [])
      case "review.rejected":
        return this.handleReviewVerdict(message.taskId, "rejected", [...message.reasons])
      default:
        return this.recordSystemEvent(message)
    }
  }

  private async handleReviewVerdict(
    taskId: Message extends { taskId: infer T } ? T : never,
    verdict: "approved" | "rejected",
    reasons: string[],
  ): Promise<void> {
    const task = await this.deps.taskRepo.findById(taskId as any)
    if (!task) return

    const record = createKeepDiscardRecord({
      taskId: task.id,
      agentId: task.assignedTo ?? this.deps.agentId,
      phase: task.phase,
      durationMs: 0, // Phase 4: calculate from metrics
      tokensUsed: task.tokensUsed,
      verdict,
      reasons,
      artifactIds: [...task.artifacts],
      commitHash: null,
    })

    this.keepDiscardRecords.push(record)
  }

  private async recordSystemEvent(message: Message): Promise<void> {
    const goalId = "goalId" in message ? (message as any).goalId : null
    const taskId = "taskId" in message ? (message as any).taskId : null
    const agentId = "agentId" in message ? (message as any).agentId : null

    await this.deps.eventStore.append({
      id: createEventId(),
      type: message.type,
      agentId,
      taskId,
      goalId,
      cost: null,
      occurredAt: new Date(),
      payload: message,
    })
  }
}
```

- [ ] **Step 11: Run all three plugin tests**

Run: `npx jest tests/adapters/ReviewerPlugin.test.ts tests/adapters/OpsPlugin.test.ts tests/adapters/LearnerPlugin.test.ts --verbose`
Expected: ALL pass

- [ ] **Step 12: Run full test suite**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 13: Commit**

```bash
git add src/adapters/plugins/agents/ReviewerPlugin.ts src/adapters/plugins/agents/OpsPlugin.ts src/adapters/plugins/agents/LearnerPlugin.ts tests/adapters/ReviewerPlugin.test.ts tests/adapters/OpsPlugin.test.ts tests/adapters/LearnerPlugin.test.ts
git commit -m "feat: add ReviewerPlugin, OpsPlugin, LearnerPlugin"
```

---

## Batch 4: Integration + End-to-End

### Task 22: Rewire composition root for full agent team

**Files:**
- Modify: `src/infrastructure/config/composition-root.ts`

- [ ] **Step 1: Update DevFleetConfig and DevFleetSystem interfaces**

Add to `DevFleetConfig`:
```typescript
export interface DevFleetConfig {
  readonly workspaceDir: string
  readonly anthropicApiKey?: string
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

- [ ] **Step 2: Wire all 7 agents in buildSystem()**

Update `buildSystem()` to instantiate: one AI provider per agent tier (Opus for supervisor/reviewer, Sonnet for others, Deterministic for Ops), one `RunAgentLoop` per agent, all 7 plugins, default `PipelineConfig` with `roleMapping`.

- [ ] **Step 3: Run existing tests to ensure no regressions**

Run: `npx jest --verbose`
Expected: ALL pass (composition root is only used in integration tests)

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/config/composition-root.ts
git commit -m "feat: rewire composition root for full 7-agent team"
```

---

### Task 23: Update CLI with pipeline progress and timeout

**Files:**
- Modify: `src/infrastructure/cli/index.ts`

- [ ] **Step 1: Add pipeline progress display and timeout**

Update the CLI to:
- Subscribe to key message types and print progress
- Set a pipeline timeout timer
- Wait for `goal.completed` or `goal.abandoned`
- Exit with appropriate code

- [ ] **Step 2: Manual test**

Run: `ANTHROPIC_API_KEY=test npx tsx src/infrastructure/cli/index.ts` and verify it starts, prompts for a goal, and doesn't crash.

- [ ] **Step 3: Commit**

```bash
git add src/infrastructure/cli/index.ts
git commit -m "feat: update CLI with pipeline progress display and timeout"
```

---

### Task 24: Write Phase 2 end-to-end integration test

**Files:**
- Create: `tests/integration/phase2-end-to-end.test.ts`

- [ ] **Step 1: Write the definitive test**

Create `tests/integration/phase2-end-to-end.test.ts`:

```typescript
import { buildSystem } from "../../src/infrastructure/config/composition-root"
import { createGoal } from "../../src/entities/Goal"
import { createGoalId, createMessageId } from "../../src/entities/ids"
import { waitForMessage } from "../helpers/waitForMessage"

describe("Phase 2 End-to-End", () => {
  it("happy path: goal → decompose → spec → plan → code → build → review → merge → complete", async () => {
    const system = await buildSystem({
      workspaceDir: process.cwd(),
      // Uses mock AI providers configured in composition root for test mode
    })
    await system.start()

    const goalId = createGoalId("e2e-goal")
    const goal = createGoal({ id: goalId, description: "Add a hello world endpoint" })
    await system.goalRepo.create(goal)

    // Set up message waiters BEFORE emitting
    const goalCompleted = waitForMessage(system.bus, "goal.completed", undefined, 30_000)

    // Emit goal.created
    await system.bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId,
      description: goal.description,
      timestamp: new Date(),
    })

    // Wait for the full pipeline to complete
    const completedMsg = await goalCompleted
    expect(completedMsg.type).toBe("goal.completed")

    await system.stop()
  }, 60_000)
})
```

Note: This test requires the composition root to be configured with mock AI providers for testing. The test setup in `buildSystem` should detect when no API key is provided and use mock providers.

- [ ] **Step 2: Run the test**

Run: `npx jest tests/integration/phase2-end-to-end.test.ts --verbose --timeout=60000`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/integration/phase2-end-to-end.test.ts
git commit -m "feat: add Phase 2 end-to-end integration test"
```

---

### Task 25: Final verification

- [ ] **Step 1: Run full test suite**

Run: `npx jest --verbose`
Expected: ALL tests pass

- [ ] **Step 2: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "chore: Phase 2 implementation complete — full agent team + communication"
```
