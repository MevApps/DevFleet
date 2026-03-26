# Phase 1: Core + Single Agent (MVP) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working MVP where a coding task can be assigned to a Developer agent, it executes via Claude API, and produces typed artifacts — all wired through Clean Architecture with in-memory adapters.

**Architecture:** 4-layer Clean Architecture (Entities -> Use Cases -> Adapters -> Infrastructure). All dependencies point inward. Ports defined in Layer 2, implemented in Layer 3. Composition root in Layer 4 wires everything. Plugin system with registry pattern for agent lifecycle and typed message routing.

**Tech Stack:** TypeScript (strict), Node.js, Jest, @anthropic-ai/sdk, better-sqlite3 (optional), tsx (dev runner)

---

## File Structure

```
devfleet/
├── src/
│   ├── entities/                        # Layer 1 — pure domain, zero deps
│   │   ├── ids.ts                       # All branded ID types + factory functions
│   │   ├── AgentRole.ts                 # AgentRole branded type + ROLES constants
│   │   ├── Budget.ts                    # TokenBudget value object
│   │   ├── Task.ts                      # Task interface + canTransition + isOverBudget
│   │   ├── Goal.ts                      # Goal interface + GoalStatus
│   │   ├── Agent.ts                     # Agent interface + AgentStatus
│   │   ├── PipelineConfig.ts            # PipelineConfig + canAdvancePhase
│   │   ├── Message.ts                   # Message discriminated union + MessageType + MessageFilter
│   │   ├── Artifact.ts                  # Artifact discriminated union (all kinds)
│   │   ├── Event.ts                     # SystemEvent interface
│   │   ├── ExperimentResult.ts          # Keep/discard experiment record
│   │   ├── Conversation.ts              # Agent conversation history
│   │   ├── Skill.ts                     # Named convention document
│   │   ├── Metric.ts                    # Typed measurement
│   │   ├── Project.ts                   # Project + ProjectConfig + TechStack
│   │   └── index.ts                     # Barrel export
│   │
│   ├── use-cases/                       # Layer 2 — application logic
│   │   ├── ports/                       # Interface contracts (DI)
│   │   │   ├── TaskRepository.ts
│   │   │   ├── GoalRepository.ts
│   │   │   ├── AgentRegistry.ts
│   │   │   ├── AIProvider.ts            # AICompletionProvider + AIToolProvider
│   │   │   ├── FileSystem.ts
│   │   │   ├── ShellExecutor.ts
│   │   │   ├── MessagePort.ts
│   │   │   ├── EventStore.ts
│   │   │   ├── MetricRecorder.ts
│   │   │   ├── AgentExecutor.ts         # Universal agent execution contract
│   │   │   └── index.ts
│   │   ├── Result.ts                    # Result<T> monad
│   │   ├── RouteMessage.ts
│   │   ├── CheckBudget.ts
│   │   ├── AssignTask.ts
│   │   ├── DecomposeGoal.ts
│   │   ├── PromptAgent.ts
│   │   ├── ExecuteToolCalls.ts
│   │   ├── RecordTurnMetrics.ts
│   │   ├── EvaluateTurnOutcome.ts
│   │   ├── RunAgentLoop.ts             # Orchestrates agent turn cycle (Layer 2 policy)
│   │   └── index.ts
│   │
│   ├── adapters/                        # Layer 3 — interface adapters
│   │   ├── storage/                     # In-memory port implementations
│   │   │   ├── InMemoryTaskRepo.ts
│   │   │   ├── InMemoryGoalRepo.ts
│   │   │   ├── InMemoryAgentRegistry.ts
│   │   │   ├── InMemoryEventStore.ts
│   │   │   └── InMemoryMetricRecorder.ts
│   │   ├── messaging/
│   │   │   └── InMemoryBus.ts
│   │   ├── ai-providers/
│   │   │   └── ClaudeProvider.ts
│   │   ├── filesystem/
│   │   │   └── NodeFileSystem.ts
│   │   ├── shell/
│   │   │   └── NodeShellExecutor.ts
│   │   ├── execution/
│   │   │   └── DefaultAgentExecutor.ts  # Implements AgentExecutor port (composes use cases)
│   │   └── plugins/
│   │       ├── PluginRegistry.ts
│   │       └── agents/
│   │           └── DeveloperPlugin.ts   # Thin adapter: message bus → AgentExecutor
│   │
│   ├── infrastructure/                  # Layer 4 — frameworks & drivers
│   │   ├── config/
│   │   │   └── composition-root.ts
│   │   └── cli/
│   │       └── index.ts
│   │
│   └── plugin-sdk/                      # Re-exports from Layer 2 ports for external consumers
│       ├── interfaces.ts               # Re-exports PluginIdentity, Lifecycle, etc. from ports
│       └── index.ts
│
├── tests/
│   ├── entities/
│   │   ├── ids.test.ts
│   │   ├── Task.test.ts
│   │   ├── Goal.test.ts
│   │   ├── PipelineConfig.test.ts
│   │   ├── Message.test.ts
│   │   └── Artifact.test.ts
│   ├── use-cases/
│   │   ├── RouteMessage.test.ts
│   │   ├── CheckBudget.test.ts
│   │   ├── AssignTask.test.ts
│   │   ├── DecomposeGoal.test.ts
│   │   ├── PromptAgent.test.ts
│   │   ├── ExecuteToolCalls.test.ts
│   │   ├── RecordTurnMetrics.test.ts
│   │   ├── EvaluateTurnOutcome.test.ts
│   │   └── RunAgentLoop.test.ts
│   ├── adapters/
│   │   ├── InMemoryTaskRepo.test.ts
│   │   ├── InMemoryGoalRepo.test.ts
│   │   ├── InMemoryBus.test.ts
│   │   ├── PluginRegistry.test.ts
│   │   └── DeveloperPlugin.test.ts
│   └── integration/
│       └── end-to-end.test.ts
│
├── agent-prompts/
│   └── developer.md
│
├── package.json
├── tsconfig.json
└── jest.config.ts
```

---

### Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `jest.config.ts`

- [ ] **Step 1: Initialize package.json**

```bash
cd /Users/mevapps/StudioProjects/DevFleet
npm init -y
```

- [ ] **Step 2: Install core dependencies**

```bash
npm install @anthropic-ai/sdk
npm install -D typescript @types/node jest ts-jest @types/jest tsx
```

- [ ] **Step 3: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": false,
    "resolveJsonModule": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] **Step 4: Create jest.config.ts**

```typescript
import type { Config } from "jest"

const config: Config = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests"],
  moduleNameMapper: {
    "^@entities/(.*)$": "<rootDir>/src/entities/$1",
    "^@use-cases/(.*)$": "<rootDir>/src/use-cases/$1",
    "^@adapters/(.*)$": "<rootDir>/src/adapters/$1",
    "^@infrastructure/(.*)$": "<rootDir>/src/infrastructure/$1",
    "^@plugin-sdk/(.*)$": "<rootDir>/src/plugin-sdk/$1",
  },
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
}

export default config
```

- [ ] **Step 5: Add path aliases to tsconfig.json**

Add to `compilerOptions`:
```json
{
  "baseUrl": ".",
  "paths": {
    "@entities/*": ["src/entities/*"],
    "@use-cases/*": ["src/use-cases/*"],
    "@adapters/*": ["src/adapters/*"],
    "@infrastructure/*": ["src/infrastructure/*"],
    "@plugin-sdk/*": ["src/plugin-sdk/*"]
  }
}
```

- [ ] **Step 6: Add scripts to package.json**

```json
{
  "scripts": {
    "build": "tsc",
    "test": "jest",
    "test:watch": "jest --watch",
    "start": "tsx src/infrastructure/cli/index.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 7: Create source directories**

```bash
mkdir -p src/{entities,use-cases/ports,adapters/{storage,messaging,ai-providers,filesystem,shell,plugins/agents},infrastructure/{config,cli},plugin-sdk}
mkdir -p tests/{entities,use-cases,adapters,integration}
mkdir -p agent-prompts
```

- [ ] **Step 8: Verify setup compiles**

Create a minimal `src/entities/ids.ts` with `export {}` and run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add package.json tsconfig.json jest.config.ts src/ tests/ agent-prompts/
git commit -m "chore: scaffold TypeScript project with Jest and path aliases"
```

---

### Task 2: Layer 1 — Identity Types + AgentRole + Budget

**Files:**
- Create: `src/entities/ids.ts`
- Create: `src/entities/AgentRole.ts`
- Create: `src/entities/Budget.ts`
- Test: `tests/entities/ids.test.ts`

- [ ] **Step 1: Write the failing test for identity types**

```typescript
// tests/entities/ids.test.ts
import {
  createTaskId,
  createGoalId,
  createAgentId,
  createArtifactId,
  createMessageId,
  createEventId,
  createProjectId,
  type TaskId,
  type GoalId,
  type AgentId,
} from "../../src/entities/ids"

describe("Identity types", () => {
  test("createTaskId produces a branded string", () => {
    const id = createTaskId()
    expect(typeof id).toBe("string")
    expect(id.length).toBeGreaterThan(0)
  })

  test("createTaskId with custom value preserves value", () => {
    const id = createTaskId("task-123")
    expect(id).toBe("task-123")
  })

  test("each factory produces unique IDs", () => {
    const ids = Array.from({ length: 100 }, () => createTaskId())
    const unique = new Set(ids)
    expect(unique.size).toBe(100)
  })

  test("createGoalId produces a branded string", () => {
    const id = createGoalId()
    expect(typeof id).toBe("string")
    expect(id.length).toBeGreaterThan(0)
  })

  test("createAgentId produces a branded string", () => {
    const id = createAgentId("developer-opus-1")
    expect(id).toBe("developer-opus-1")
  })

  test("all ID factories produce strings", () => {
    expect(typeof createArtifactId()).toBe("string")
    expect(typeof createMessageId()).toBe("string")
    expect(typeof createEventId()).toBe("string")
    expect(typeof createProjectId()).toBe("string")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/entities/ids.test.ts --no-cache`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement identity types**

```typescript
// src/entities/ids.ts
import { randomUUID } from "node:crypto"

export type TaskId = string & { readonly __brand: "TaskId" }
export type GoalId = string & { readonly __brand: "GoalId" }
export type AgentId = string & { readonly __brand: "AgentId" }
export type ArtifactId = string & { readonly __brand: "ArtifactId" }
export type MessageId = string & { readonly __brand: "MessageId" }
export type EventId = string & { readonly __brand: "EventId" }
export type ProjectId = string & { readonly __brand: "ProjectId" }

export function createTaskId(value?: string): TaskId {
  return (value ?? randomUUID()) as TaskId
}

export function createGoalId(value?: string): GoalId {
  return (value ?? randomUUID()) as GoalId
}

export function createAgentId(value: string): AgentId {
  return value as AgentId
}

export function createArtifactId(value?: string): ArtifactId {
  return (value ?? randomUUID()) as ArtifactId
}

export function createMessageId(value?: string): MessageId {
  return (value ?? randomUUID()) as MessageId
}

export function createEventId(value?: string): EventId {
  return (value ?? randomUUID()) as EventId
}

export function createProjectId(value?: string): ProjectId {
  return (value ?? randomUUID()) as ProjectId
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/entities/ids.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Implement AgentRole**

```typescript
// src/entities/AgentRole.ts
export type AgentRole = string & { readonly __brand: "AgentRole" }

export function createAgentRole(value: string): AgentRole {
  return value as AgentRole
}

export const ROLES = {
  SUPERVISOR: "supervisor" as AgentRole,
  PRODUCT: "product" as AgentRole,
  ARCHITECT: "architect" as AgentRole,
  DEVELOPER: "developer" as AgentRole,
  REVIEWER: "reviewer" as AgentRole,
  OPS: "ops" as AgentRole,
  LEARNER: "learner" as AgentRole,
} as const
```

- [ ] **Step 6: Implement Budget**

```typescript
// src/entities/Budget.ts
export interface TokenBudget {
  readonly maxTokens: number
  readonly maxCostUsd: number
  readonly remaining: number
}

export function createBudget(maxTokens: number, maxCostUsd: number): TokenBudget {
  return { maxTokens, maxCostUsd, remaining: maxTokens }
}

export function consumeTokens(budget: TokenBudget, tokens: number): TokenBudget {
  return { ...budget, remaining: budget.remaining - tokens }
}

export function isExhausted(budget: TokenBudget): boolean {
  return budget.remaining <= 0
}
```

- [ ] **Step 7: Commit**

```bash
git add src/entities/ids.ts src/entities/AgentRole.ts src/entities/Budget.ts tests/entities/ids.test.ts
git commit -m "feat: add Layer 1 identity types, AgentRole, and Budget"
```

---

### Task 3: Layer 1 — Task, Goal, Agent Entities

**Files:**
- Create: `src/entities/Task.ts`
- Create: `src/entities/Goal.ts`
- Create: `src/entities/Agent.ts`
- Test: `tests/entities/Task.test.ts`
- Test: `tests/entities/Goal.test.ts`

- [ ] **Step 1: Write the failing test for Task**

```typescript
// tests/entities/Task.test.ts
import {
  type Task,
  type TaskStatus,
  canTransition,
  isOverBudget,
  createTask,
} from "../../src/entities/Task"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("Task", () => {
  const taskId = createTaskId("task-1")
  const goalId = createGoalId("goal-1")

  function makeTask(overrides: Partial<Task> = {}): Task {
    return createTask({
      id: taskId,
      goalId,
      description: "Write a function",
      phase: "code",
      budget: createBudget(1000, 0.01),
      ...overrides,
    })
  }

  describe("canTransition", () => {
    test("queued -> in_progress is allowed", () => {
      const task = makeTask({ status: "queued" })
      expect(canTransition(task, "in_progress")).toBe(true)
    })

    test("queued -> discarded is allowed", () => {
      const task = makeTask({ status: "queued" })
      expect(canTransition(task, "discarded")).toBe(true)
    })

    test("queued -> approved is not allowed", () => {
      const task = makeTask({ status: "queued" })
      expect(canTransition(task, "approved")).toBe(false)
    })

    test("in_progress -> review is allowed", () => {
      const task = makeTask({ status: "in_progress" })
      expect(canTransition(task, "review")).toBe(true)
    })

    test("review -> approved is allowed", () => {
      const task = makeTask({ status: "review" })
      expect(canTransition(task, "approved")).toBe(true)
    })

    test("review -> in_progress is allowed (rejection)", () => {
      const task = makeTask({ status: "review" })
      expect(canTransition(task, "in_progress")).toBe(true)
    })

    test("approved -> merged is allowed", () => {
      const task = makeTask({ status: "approved" })
      expect(canTransition(task, "merged")).toBe(true)
    })

    test("merged -> anything is not allowed", () => {
      const task = makeTask({ status: "merged" })
      expect(canTransition(task, "queued")).toBe(false)
      expect(canTransition(task, "in_progress")).toBe(false)
    })

    test("discarded -> anything is not allowed", () => {
      const task = makeTask({ status: "discarded" })
      expect(canTransition(task, "queued")).toBe(false)
    })
  })

  describe("isOverBudget", () => {
    test("returns false when under budget", () => {
      const task = makeTask({ tokensUsed: 500 })
      expect(isOverBudget(task)).toBe(false)
    })

    test("returns true when over budget", () => {
      const task = makeTask({ tokensUsed: 1500 })
      expect(isOverBudget(task)).toBe(true)
    })

    test("returns false when exactly at budget", () => {
      const task = makeTask({ tokensUsed: 1000 })
      expect(isOverBudget(task)).toBe(false)
    })
  })

  describe("createTask", () => {
    test("defaults to queued status and version 1", () => {
      const task = makeTask()
      expect(task.status).toBe("queued")
      expect(task.version).toBe(1)
      expect(task.assignedTo).toBeNull()
      expect(task.tokensUsed).toBe(0)
      expect(task.artifacts).toEqual([])
      expect(task.parentTaskId).toBeNull()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/entities/Task.test.ts --no-cache`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement Task entity**

```typescript
// src/entities/Task.ts
import type { TaskId, GoalId, AgentId, ArtifactId } from "./ids"
import type { TokenBudget } from "./Budget"

export type TaskStatus = "queued" | "in_progress" | "review" | "approved" | "merged" | "discarded"

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
  readonly artifacts: ReadonlyArray<ArtifactId>
  readonly parentTaskId: TaskId | null
}

const ALLOWED_TRANSITIONS: Record<TaskStatus, ReadonlyArray<TaskStatus>> = {
  queued: ["in_progress", "discarded"],
  in_progress: ["review", "discarded"],
  review: ["approved", "in_progress"],
  approved: ["merged"],
  merged: [],
  discarded: [],
}

export function canTransition(task: Task, to: TaskStatus): boolean {
  return ALLOWED_TRANSITIONS[task.status].includes(to)
}

export function isOverBudget(task: Task): boolean {
  return task.tokensUsed > task.budget.maxTokens
}

export function createTask(params: {
  id: TaskId
  goalId: GoalId
  description: string
  phase: string
  budget: TokenBudget
  status?: TaskStatus
  assignedTo?: AgentId | null
  tokensUsed?: number
  version?: number
  artifacts?: ReadonlyArray<ArtifactId>
  parentTaskId?: TaskId | null
}): Task {
  return {
    id: params.id,
    goalId: params.goalId,
    description: params.description,
    status: params.status ?? "queued",
    phase: params.phase,
    assignedTo: params.assignedTo ?? null,
    budget: params.budget,
    tokensUsed: params.tokensUsed ?? 0,
    version: params.version ?? 1,
    artifacts: params.artifacts ?? [],
    parentTaskId: params.parentTaskId ?? null,
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/entities/Task.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Write the failing test for Goal**

```typescript
// tests/entities/Goal.test.ts
import { createGoal, type Goal } from "../../src/entities/Goal"
import { createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("Goal", () => {
  test("createGoal defaults to proposed status", () => {
    const goal = createGoal({
      id: createGoalId("goal-1"),
      description: "Add user authentication",
      totalBudget: createBudget(10000, 1.0),
    })
    expect(goal.status).toBe("proposed")
    expect(goal.completedAt).toBeNull()
    expect(goal.taskIds).toEqual([])
    expect(goal.createdAt).toBeGreaterThan(0)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest tests/entities/Goal.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 7: Implement Goal entity**

```typescript
// src/entities/Goal.ts
import type { GoalId, TaskId } from "./ids"
import type { TokenBudget } from "./Budget"

export type GoalStatus = "proposed" | "active" | "completed" | "abandoned"

export interface Goal {
  readonly id: GoalId
  readonly description: string
  readonly status: GoalStatus
  readonly createdAt: number
  readonly completedAt: number | null
  readonly taskIds: ReadonlyArray<TaskId>
  readonly totalBudget: TokenBudget
}

export function createGoal(params: {
  id: GoalId
  description: string
  totalBudget: TokenBudget
  status?: GoalStatus
  createdAt?: number
  completedAt?: number | null
  taskIds?: ReadonlyArray<TaskId>
}): Goal {
  return {
    id: params.id,
    description: params.description,
    status: params.status ?? "proposed",
    createdAt: params.createdAt ?? Date.now(),
    completedAt: params.completedAt ?? null,
    taskIds: params.taskIds ?? [],
    totalBudget: params.totalBudget,
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest tests/entities/Goal.test.ts --no-cache`
Expected: PASS

- [ ] **Step 9: Implement Agent entity**

```typescript
// src/entities/Agent.ts
import type { AgentId, TaskId } from "./ids"
import type { AgentRole } from "./AgentRole"

export type AgentStatus = "idle" | "busy" | "blocked" | "paused" | "stopped"

export interface Agent {
  readonly id: AgentId
  readonly role: AgentRole
  readonly status: AgentStatus
  readonly currentTaskId: TaskId | null
  readonly model: string
}

export function createAgent(params: {
  id: AgentId
  role: AgentRole
  model: string
  status?: AgentStatus
  currentTaskId?: TaskId | null
}): Agent {
  return {
    id: params.id,
    role: params.role,
    status: params.status ?? "idle",
    currentTaskId: params.currentTaskId ?? null,
    model: params.model,
  }
}

export function isAvailable(agent: Agent): boolean {
  return agent.status === "idle"
}
```

- [ ] **Step 10: Commit**

```bash
git add src/entities/Task.ts src/entities/Goal.ts src/entities/Agent.ts tests/entities/Task.test.ts tests/entities/Goal.test.ts
git commit -m "feat: add Task, Goal, Agent entities with business rules"
```

---

### Task 4: Layer 1 — PipelineConfig

**Files:**
- Create: `src/entities/PipelineConfig.ts`
- Test: `tests/entities/PipelineConfig.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/entities/PipelineConfig.test.ts
import {
  canAdvancePhase,
  createPipelineConfig,
  type PipelineConfig,
} from "../../src/entities/PipelineConfig"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("PipelineConfig", () => {
  const pipeline = createPipelineConfig({
    phases: ["plan", "code", "test", "review", "done"],
    transitions: [
      { from: "plan", to: "code" },
      { from: "code", to: "test" },
      { from: "test", to: "review" },
      { from: "review", to: "done" },
      { from: "review", to: "code" },
    ],
  })

  function makeTask(phase: string) {
    return createTask({
      id: createTaskId("t-1"),
      goalId: createGoalId("g-1"),
      description: "test",
      phase,
      budget: createBudget(1000, 0.01),
    })
  }

  test("allows valid phase transition", () => {
    expect(canAdvancePhase(makeTask("plan"), "code", pipeline)).toBe(true)
  })

  test("disallows invalid phase transition", () => {
    expect(canAdvancePhase(makeTask("plan"), "review", pipeline)).toBe(false)
  })

  test("allows review -> code (rejection back)", () => {
    expect(canAdvancePhase(makeTask("review"), "code", pipeline)).toBe(true)
  })

  test("allows review -> done", () => {
    expect(canAdvancePhase(makeTask("review"), "done", pipeline)).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/entities/PipelineConfig.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement PipelineConfig**

```typescript
// src/entities/PipelineConfig.ts
import type { Task } from "./Task"

export interface PhaseTransition {
  readonly from: string
  readonly to: string
}

export interface PipelineConfig {
  readonly phases: ReadonlyArray<string>
  readonly transitions: ReadonlyArray<PhaseTransition>
  readonly skipAllowed: ReadonlyArray<{
    from: string
    to: string
    condition: string
  }>
}

export function createPipelineConfig(params: {
  phases: ReadonlyArray<string>
  transitions: ReadonlyArray<PhaseTransition>
  skipAllowed?: ReadonlyArray<{ from: string; to: string; condition: string }>
}): PipelineConfig {
  return {
    phases: params.phases,
    transitions: params.transitions,
    skipAllowed: params.skipAllowed ?? [],
  }
}

export function canAdvancePhase(
  task: Task,
  to: string,
  pipeline: PipelineConfig,
): boolean {
  return pipeline.transitions.some(
    (t) => t.from === task.phase && t.to === to,
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/entities/PipelineConfig.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/entities/PipelineConfig.ts tests/entities/PipelineConfig.test.ts
git commit -m "feat: add PipelineConfig entity with phase transition rules"
```

---

### Task 5: Layer 1 — Message + Artifact Discriminated Unions

**Files:**
- Create: `src/entities/Message.ts`
- Create: `src/entities/Artifact.ts`
- Test: `tests/entities/Message.test.ts`
- Test: `tests/entities/Artifact.test.ts`

- [ ] **Step 1: Write the failing test for Message**

```typescript
// tests/entities/Message.test.ts
import { type Message, type MessageType, matchesFilter } from "../../src/entities/Message"
import { createTaskId, createAgentId, createGoalId } from "../../src/entities/ids"

describe("Message", () => {
  const taskId = createTaskId("task-1")
  const agentId = createAgentId("dev-1")
  const goalId = createGoalId("goal-1")

  test("task.assigned message has correct shape", () => {
    const msg: Message = {
      type: "task.assigned",
      taskId,
      agentId,
    }
    expect(msg.type).toBe("task.assigned")
    expect(msg.taskId).toBe(taskId)
  })

  test("goal.created message has correct shape", () => {
    const msg: Message = {
      type: "goal.created",
      goalId,
      description: "Build auth",
    }
    expect(msg.type).toBe("goal.created")
  })

  describe("matchesFilter", () => {
    test("matches when message type is in filter", () => {
      const msg: Message = { type: "task.assigned", taskId, agentId }
      expect(matchesFilter(msg, { types: ["task.assigned", "task.completed"] })).toBe(true)
    })

    test("does not match when message type is not in filter", () => {
      const msg: Message = { type: "task.assigned", taskId, agentId }
      expect(matchesFilter(msg, { types: ["goal.created"] })).toBe(false)
    })

    test("empty filter matches nothing", () => {
      const msg: Message = { type: "task.assigned", taskId, agentId }
      expect(matchesFilter(msg, { types: [] })).toBe(false)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/entities/Message.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement Message discriminated union**

```typescript
// src/entities/Message.ts
import type { TaskId, GoalId, AgentId, ArtifactId, ProjectId } from "./ids"
import type { AgentRole } from "./AgentRole"

export type Message =
  // Goal lifecycle
  | { readonly type: "goal.created"; readonly goalId: GoalId; readonly description: string }
  | { readonly type: "goal.completed"; readonly goalId: GoalId; readonly costUsd: number }
  | { readonly type: "goal.abandoned"; readonly goalId: GoalId; readonly reason: string }
  // Task lifecycle
  | { readonly type: "task.created"; readonly taskId: TaskId; readonly goalId: GoalId; readonly phase: string }
  | { readonly type: "task.assigned"; readonly taskId: TaskId; readonly agentId: AgentId }
  | { readonly type: "task.completed"; readonly taskId: TaskId; readonly agentId: AgentId }
  | { readonly type: "task.failed"; readonly taskId: TaskId; readonly agentId: AgentId; readonly reason: string }
  // Artifact handoffs
  | { readonly type: "spec.created"; readonly taskId: TaskId; readonly artifactId: ArtifactId }
  | { readonly type: "plan.created"; readonly taskId: TaskId; readonly artifactId: ArtifactId }
  | { readonly type: "design.created"; readonly taskId: TaskId; readonly artifactId: ArtifactId }
  // Code lifecycle
  | { readonly type: "code.completed"; readonly taskId: TaskId; readonly branch: string; readonly filesChanged: number; readonly testsWritten: number }
  | { readonly type: "branch.pushed"; readonly taskId: TaskId; readonly branch: string }
  | { readonly type: "branch.merged"; readonly taskId: TaskId; readonly branch: string; readonly commit: string }
  | { readonly type: "branch.discarded"; readonly taskId: TaskId; readonly branch: string; readonly reason: string }
  // Build & test
  | { readonly type: "build.passed"; readonly taskId: TaskId; readonly durationMs: number }
  | { readonly type: "build.failed"; readonly taskId: TaskId; readonly error: string }
  | { readonly type: "test.report.created"; readonly taskId: TaskId; readonly passed: number; readonly failed: number; readonly coverageDelta: number }
  // Review
  | { readonly type: "review.approved"; readonly taskId: TaskId; readonly reviewerId: AgentId }
  | { readonly type: "review.rejected"; readonly taskId: TaskId; readonly reviewerId: AgentId; readonly reasons: ReadonlyArray<string> }
  // Budget
  | { readonly type: "budget.exceeded"; readonly taskId: TaskId; readonly agentId: AgentId; readonly tokensUsed: number; readonly budgetMax: number }
  // System
  | { readonly type: "agent.prompt.updated"; readonly agentRole: AgentRole; readonly diff: string; readonly reason: string }
  | { readonly type: "skill.updated"; readonly skillName: string; readonly diff: string; readonly reason: string }
  | { readonly type: "insight.generated"; readonly insightId: string; readonly recommendation: string; readonly confidence: number }
  | { readonly type: "ceo.override"; readonly taskId: TaskId; readonly action: string; readonly reason: string }
  // Scheduling
  | { readonly type: "schedule.ideation"; readonly projectId: ProjectId }
  | { readonly type: "agent.stuck"; readonly agentId: AgentId; readonly taskId: TaskId; readonly retryCount: number }

export type MessageType = Message["type"]

export interface MessageFilter {
  readonly types: ReadonlyArray<MessageType>
}

export function matchesFilter(message: Message, filter: MessageFilter): boolean {
  return filter.types.includes(message.type)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/entities/Message.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Write the failing test for Artifact**

```typescript
// tests/entities/Artifact.test.ts
import { type Artifact, createArtifact } from "../../src/entities/Artifact"
import { createArtifactId, createTaskId, createAgentId } from "../../src/entities/ids"

describe("Artifact", () => {
  const taskId = createTaskId("task-1")
  const agentId = createAgentId("dev-1")

  test("creates a spec artifact with correct metadata", () => {
    const artifact = createArtifact({
      id: createArtifactId("art-1"),
      kind: "spec",
      format: "markdown",
      taskId,
      createdBy: agentId,
      content: "## Requirements\n- Auth system",
      metadata: { requirementCount: 1, hasSuccessCriteria: false },
    })
    expect(artifact.kind).toBe("spec")
    if (artifact.kind === "spec") {
      expect(artifact.metadata.requirementCount).toBe(1)
    }
  })

  test("creates a diff artifact with correct metadata", () => {
    const artifact = createArtifact({
      id: createArtifactId("art-2"),
      kind: "diff",
      format: "diff",
      taskId,
      createdBy: agentId,
      content: "+ added line",
      metadata: { filesChanged: 2, linesAdded: 10, linesRemoved: 3 },
    })
    expect(artifact.kind).toBe("diff")
    if (artifact.kind === "diff") {
      expect(artifact.metadata.filesChanged).toBe(2)
    }
  })

  test("creates a test_report artifact", () => {
    const artifact = createArtifact({
      id: createArtifactId("art-3"),
      kind: "test_report",
      format: "json",
      taskId,
      createdBy: agentId,
      content: '{"passed":5,"failed":0}',
      metadata: { passed: 5, failed: 0, coverageDelta: 2.5 },
    })
    expect(artifact.kind).toBe("test_report")
    if (artifact.kind === "test_report") {
      expect(artifact.metadata.passed).toBe(5)
    }
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest tests/entities/Artifact.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 7: Implement Artifact discriminated union**

```typescript
// src/entities/Artifact.ts
import type { ArtifactId, TaskId, AgentId } from "./ids"

export type Artifact =
  | {
      readonly id: ArtifactId
      readonly kind: "spec"
      readonly format: "markdown"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string
      readonly metadata: { readonly requirementCount: number; readonly hasSuccessCriteria: boolean }
    }
  | {
      readonly id: ArtifactId
      readonly kind: "plan"
      readonly format: "markdown"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string
      readonly metadata: { readonly stepCount: number; readonly estimatedTokens: number }
    }
  | {
      readonly id: ArtifactId
      readonly kind: "design"
      readonly format: "markdown"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string
      readonly metadata: { readonly componentCount: number }
    }
  | {
      readonly id: ArtifactId
      readonly kind: "diff"
      readonly format: "diff"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string
      readonly metadata: { readonly filesChanged: number; readonly linesAdded: number; readonly linesRemoved: number }
    }
  | {
      readonly id: ArtifactId
      readonly kind: "review"
      readonly format: "markdown"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string
      readonly metadata: { readonly verdict: "approved" | "rejected"; readonly issueCount: number }
    }
  | {
      readonly id: ArtifactId
      readonly kind: "test_report"
      readonly format: "json"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string
      readonly metadata: { readonly passed: number; readonly failed: number; readonly coverageDelta: number }
    }
  | {
      readonly id: ArtifactId
      readonly kind: "metric_report"
      readonly format: "json"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string
      readonly metadata: { readonly metricCount: number; readonly periodStart: number; readonly periodEnd: number }
    }

export function createArtifact<K extends Artifact["kind"]>(
  params: Extract<Artifact, { kind: K }>,
): Extract<Artifact, { kind: K }> {
  return params
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest tests/entities/Artifact.test.ts --no-cache`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/entities/Message.ts src/entities/Artifact.ts tests/entities/Message.test.ts tests/entities/Artifact.test.ts
git commit -m "feat: add Message and Artifact discriminated unions"
```

---

### Task 6: Layer 1 — Supporting Entities + Barrel Export

**Files:**
- Create: `src/entities/Event.ts`
- Create: `src/entities/ExperimentResult.ts`
- Create: `src/entities/Conversation.ts`
- Create: `src/entities/Skill.ts`
- Create: `src/entities/Metric.ts`
- Create: `src/entities/Project.ts`
- Create: `src/entities/index.ts`

These are all type definitions with no business logic — no tests needed (types are tested at compile time).

- [ ] **Step 1: Implement Event**

```typescript
// src/entities/Event.ts
import type { EventId, TaskId, GoalId, ProjectId, AgentId } from "./ids"
import type { Message, MessageType } from "./Message"

export interface EventCost {
  readonly tokensIn: number
  readonly tokensOut: number
  readonly costUsd: number
  readonly durationMs: number
}

export interface SystemEvent {
  readonly id: EventId
  readonly timestamp: number
  readonly source: AgentId | "system" | "ceo"
  readonly type: MessageType
  readonly taskId: TaskId | null
  readonly goalId: GoalId | null
  readonly projectId: ProjectId
  readonly message: Message
  readonly cost: EventCost
}
```

- [ ] **Step 2: Implement ExperimentResult**

```typescript
// src/entities/ExperimentResult.ts
import type { TaskId, AgentId } from "./ids"

export interface ExperimentResult {
  readonly id: string
  readonly taskId: TaskId
  readonly agentId: AgentId
  readonly commit: string
  readonly metric: number
  readonly tokensUsed: number
  readonly costUsd: number
  readonly durationMs: number
  readonly status: "keep" | "discard" | "crash"
  readonly description: string
  readonly baseline: number
  readonly delta: number
  readonly iteration: number
}
```

- [ ] **Step 3: Implement Conversation**

```typescript
// src/entities/Conversation.ts
import type { AgentId } from "./ids"

export interface ConversationTurn {
  readonly role: "user" | "assistant"
  readonly content: string
  readonly timestamp: number
  readonly tokensUsed: number
}

export interface Conversation {
  readonly agentId: AgentId
  readonly turns: ReadonlyArray<ConversationTurn>
}

export function createConversation(agentId: AgentId): Conversation {
  return { agentId, turns: [] }
}

export function addTurn(
  conversation: Conversation,
  turn: ConversationTurn,
): Conversation {
  return { ...conversation, turns: [...conversation.turns, turn] }
}
```

- [ ] **Step 4: Implement Skill**

```typescript
// src/entities/Skill.ts
import type { AgentRole } from "./AgentRole"

export interface Skill {
  readonly name: string
  readonly description: string
  readonly content: string
  readonly scope: ReadonlyArray<AgentRole>
}
```

- [ ] **Step 5: Implement Metric**

```typescript
// src/entities/Metric.ts
import type { AgentId, TaskId, ProjectId } from "./ids"

export interface Metric {
  readonly name: string
  readonly value: number
  readonly timestamp: number
  readonly agentId: AgentId | null
  readonly taskId: TaskId | null
  readonly projectId: ProjectId
  readonly tags: Readonly<Record<string, string>>
}
```

- [ ] **Step 6: Implement Project**

```typescript
// src/entities/Project.ts
import type { ProjectId } from "./ids"
import type { PipelineConfig } from "./PipelineConfig"
import type { Skill } from "./Skill"

export interface TechStack {
  readonly languages: ReadonlyArray<string>
  readonly frameworks: ReadonlyArray<string>
  readonly buildTool: string
  readonly testFramework: string
  readonly packageManager?: string
}

export interface QualityGate {
  readonly name: string
  readonly command: string
  readonly required: boolean
}

export interface BudgetDefaults {
  readonly simple: number
  readonly moderate: number
  readonly complex: number
  readonly maxCostPerTaskUsd: number
}

export interface ProjectConfig {
  readonly name: string
  readonly repoPath: string
  readonly techStack: TechStack
  readonly skills: ReadonlyArray<Skill>
  readonly conventions: string
  readonly buildCommand: string
  readonly testCommand: string
  readonly lintCommand?: string
  readonly pipeline: PipelineConfig
  readonly qualityGates: ReadonlyArray<QualityGate>
  readonly budgetDefaults: BudgetDefaults
}

export interface Project {
  readonly id: ProjectId
  readonly config: ProjectConfig
}
```

- [ ] **Step 7: Create barrel export**

```typescript
// src/entities/index.ts
export * from "./ids"
export * from "./AgentRole"
export * from "./Budget"
export * from "./Task"
export * from "./Goal"
export * from "./Agent"
export * from "./PipelineConfig"
export * from "./Message"
export * from "./Artifact"
export * from "./Event"
export * from "./ExperimentResult"
export * from "./Conversation"
export * from "./Skill"
export * from "./Metric"
export * from "./Project"
```

- [ ] **Step 8: Verify all entities compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 9: Commit**

```bash
git add src/entities/
git commit -m "feat: add remaining Layer 1 entities and barrel export"
```

---

### Task 7: Layer 2 — Result Type + Port Interfaces

**Files:**
- Create: `src/use-cases/Result.ts`
- Create: `src/use-cases/ports/TaskRepository.ts`
- Create: `src/use-cases/ports/GoalRepository.ts`
- Create: `src/use-cases/ports/AgentRegistry.ts`
- Create: `src/use-cases/ports/AIProvider.ts`
- Create: `src/use-cases/ports/FileSystem.ts`
- Create: `src/use-cases/ports/ShellExecutor.ts`
- Create: `src/use-cases/ports/MessagePort.ts`
- Create: `src/use-cases/ports/EventStore.ts`
- Create: `src/use-cases/ports/MetricRecorder.ts`
- Create: `src/use-cases/ports/index.ts`

- [ ] **Step 1: Implement Result type**

```typescript
// src/use-cases/Result.ts
export type Result<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: string }

export function success<T>(value: T): Result<T> {
  return { ok: true, value }
}

export function failure<T = never>(error: string): Result<T> {
  return { ok: false, error }
}
```

- [ ] **Step 2: Implement TaskRepository port**

```typescript
// src/use-cases/ports/TaskRepository.ts
import type { Task } from "../../entities/Task"
import type { TaskId, GoalId } from "../../entities/ids"

export class VersionConflictError extends Error {
  constructor(
    public readonly taskId: TaskId,
    public readonly expectedVersion: number,
  ) {
    super(`Version conflict for task ${taskId} at version ${expectedVersion}`)
    this.name = "VersionConflictError"
  }
}

export interface TaskRepository {
  findById(id: TaskId): Promise<Task | null>
  findByGoalId(goalId: GoalId): Promise<ReadonlyArray<Task>>
  create(task: Task): Promise<void>
  update(task: Task): Promise<void> // throws VersionConflictError if stale
}
```

- [ ] **Step 3: Implement GoalRepository port**

```typescript
// src/use-cases/ports/GoalRepository.ts
import type { Goal } from "../../entities/Goal"
import type { GoalId } from "../../entities/ids"

export interface GoalRepository {
  findById(id: GoalId): Promise<Goal | null>
  create(goal: Goal): Promise<void>
  update(goal: Goal): Promise<void>
}
```

- [ ] **Step 4: Implement AgentRegistry port**

```typescript
// src/use-cases/ports/AgentRegistry.ts
import type { Agent } from "../../entities/Agent"
import type { AgentId } from "../../entities/ids"
import type { AgentRole } from "../../entities/AgentRole"

export interface AgentRegistry {
  findAvailable(role: AgentRole): Promise<Agent | null>
  findById(id: AgentId): Promise<Agent | null>
  register(agent: Agent): Promise<void>
  updateStatus(id: AgentId, status: Agent["status"], taskId?: Agent["currentTaskId"]): Promise<void>
}
```

- [ ] **Step 5: Implement AI provider ports**

```typescript
// src/use-cases/ports/AIProvider.ts
import type { TokenBudget } from "../../entities/Budget"

export type AICapability = "tool_use" | "vision" | "streaming" | "json_mode" | "extended_context"

export interface AgentPrompt {
  readonly systemPrompt: string
  readonly messages: ReadonlyArray<{ readonly role: "user" | "assistant"; readonly content: string }>
  readonly model: string
  readonly maxTokens: number
}

export interface AIResponse {
  readonly content: string
  readonly tokensIn: number
  readonly tokensOut: number
  readonly stopReason: "end_turn" | "max_tokens" | "tool_use"
}

export interface ToolDefinition {
  readonly name: string
  readonly description: string
  readonly inputSchema: Record<string, unknown>
}

export interface ToolCall {
  readonly id: string
  readonly name: string
  readonly input: Record<string, unknown>
}

export interface AIToolResponse {
  readonly content: string
  readonly toolCalls: ReadonlyArray<ToolCall>
  readonly tokensIn: number
  readonly tokensOut: number
  readonly stopReason: "end_turn" | "max_tokens" | "tool_use"
}

export interface AICompletionProvider {
  complete(prompt: AgentPrompt, budget: TokenBudget): Promise<AIResponse>
  readonly capabilities: ReadonlySet<AICapability>
}

export interface AIToolProvider {
  completeWithTools(
    prompt: AgentPrompt,
    tools: ReadonlyArray<ToolDefinition>,
    budget: TokenBudget,
  ): Promise<AIToolResponse>
}
```

- [ ] **Step 6: Implement FileSystem + ShellExecutor ports**

```typescript
// src/use-cases/ports/FileSystem.ts
export interface FileSystem {
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  edit(path: string, oldContent: string, newContent: string): Promise<void>
  glob(pattern: string): Promise<ReadonlyArray<string>>
  exists(path: string): Promise<boolean>
}
```

```typescript
// src/use-cases/ports/ShellExecutor.ts
export interface ShellResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

export interface ShellExecutor {
  execute(command: string, timeout?: number): Promise<ShellResult>
}
```

- [ ] **Step 7: Implement MessagePort + EventStore + MetricRecorder ports**

```typescript
// src/use-cases/ports/MessagePort.ts
import type { Message, MessageFilter } from "../../entities/Message"

export type MessageHandler = (message: Message) => Promise<void>
export type Unsubscribe = () => void

export interface MessagePort {
  emit(message: Message): Promise<void>
  subscribe(filter: MessageFilter, handler: MessageHandler): Unsubscribe
}
```

```typescript
// src/use-cases/ports/EventStore.ts
import type { SystemEvent } from "../../entities/Event"
import type { EventId, TaskId, GoalId } from "../../entities/ids"

export interface EventStore {
  append(event: SystemEvent): Promise<void>
  findByTaskId(taskId: TaskId): Promise<ReadonlyArray<SystemEvent>>
  findByGoalId(goalId: GoalId): Promise<ReadonlyArray<SystemEvent>>
}
```

```typescript
// src/use-cases/ports/MetricRecorder.ts
import type { Metric } from "../../entities/Metric"
import type { TaskId, AgentId } from "../../entities/ids"

export interface MetricRecorder {
  record(metric: Metric): Promise<void>
  findByTaskId(taskId: TaskId): Promise<ReadonlyArray<Metric>>
  findByAgentId(agentId: AgentId): Promise<ReadonlyArray<Metric>>
}
```

- [ ] **Step 8: Implement AgentExecutor port**

This is the universal agent execution contract from the spec. All agent plugins delegate to an implementation of this port. In Phase 2, the same executor is reused for all 7 agents — they differ only in config, not execution logic.

```typescript
// src/use-cases/ports/AgentExecutor.ts
import type { Task } from "../../entities/Task"
import type { AgentId, ProjectId } from "../../entities/ids"
import type { AgentRole } from "../../entities/AgentRole"
import type { TokenBudget } from "../../entities/Budget"

export interface AgentConfig {
  readonly role: AgentRole
  readonly systemPrompt: string
  readonly tools: ReadonlyArray<ToolDefinition>
  readonly model: string
  readonly budget: TokenBudget
}

// Re-import to avoid circular — ToolDefinition is defined in AIProvider.ts
import type { ToolDefinition } from "./AIProvider"

export type AgentEventType = "turn_completed" | "tool_executed" | "task_completed" | "task_failed" | "budget_exceeded"

export interface AgentEvent {
  readonly type: AgentEventType
  readonly data: Record<string, unknown>
}

export interface AgentExecutor {
  run(
    agentId: AgentId,
    config: AgentConfig,
    task: Task,
    projectId: ProjectId,
  ): AsyncIterable<AgentEvent>
}
```

- [ ] **Step 9: Implement plugin interfaces (Layer 2 ports)**

These are the contracts plugins must fulfill. They live in Layer 2 because the application defines what a plugin looks like.

```typescript
// src/use-cases/ports/PluginInterfaces.ts
import type { Message, MessageFilter } from "../../entities/Message"

export type HealthStatus = "healthy" | "degraded" | "unhealthy"

export interface PluginIdentity {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly description: string
}

export interface Lifecycle {
  start(): Promise<void>
  stop(): Promise<void>
  healthCheck(): Promise<HealthStatus>
}

export interface PluginMessageHandler {
  subscriptions(): ReadonlyArray<MessageFilter>
  handle(message: Message): Promise<void>
}

export interface DashboardContributor {
  widgets(): ReadonlyArray<DashboardWidget>
}

export interface DashboardWidget {
  readonly id: string
  readonly title: string
  readonly component: string
  readonly data: Record<string, unknown>
}

export interface RegisteredPlugin {
  readonly identity: PluginIdentity
  readonly lifecycle: Lifecycle
  readonly messageHandler?: PluginMessageHandler
}
```

- [ ] **Step 10: Create ports barrel export**

```typescript
// src/use-cases/ports/index.ts
export * from "./TaskRepository"
export * from "./GoalRepository"
export * from "./AgentRegistry"
export * from "./AIProvider"
export * from "./FileSystem"
export * from "./ShellExecutor"
export * from "./MessagePort"
export * from "./EventStore"
export * from "./MetricRecorder"
export * from "./AgentExecutor"
export * from "./PluginInterfaces"
```

- [ ] **Step 11: Verify all ports compile**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 12: Commit**

```bash
git add src/use-cases/Result.ts src/use-cases/ports/
git commit -m "feat: add Result type, AgentExecutor port, plugin interfaces, and all Layer 2 ports"
```

---

### Task 8: Layer 2 — RouteMessage + CheckBudget Use Cases

**Files:**
- Create: `src/use-cases/RouteMessage.ts`
- Create: `src/use-cases/CheckBudget.ts`
- Test: `tests/use-cases/RouteMessage.test.ts`
- Test: `tests/use-cases/CheckBudget.test.ts`

- [ ] **Step 1: Write the failing test for RouteMessage**

```typescript
// tests/use-cases/RouteMessage.test.ts
import { RouteMessage } from "../../src/use-cases/RouteMessage"
import type { MessagePort, MessageHandler, Unsubscribe } from "../../src/use-cases/ports/MessagePort"
import type { Message, MessageFilter } from "../../src/entities/Message"
import { createTaskId, createAgentId } from "../../src/entities/ids"

function createMockBus(): MessagePort & { handlers: Array<{ filter: MessageFilter; handler: MessageHandler }> } {
  const handlers: Array<{ filter: MessageFilter; handler: MessageHandler }> = []
  return {
    handlers,
    async emit(message: Message): Promise<void> {
      for (const { filter, handler } of handlers) {
        if (filter.types.includes(message.type)) {
          await handler(message)
        }
      }
    },
    subscribe(filter: MessageFilter, handler: MessageHandler): Unsubscribe {
      const entry = { filter, handler }
      handlers.push(entry)
      return () => {
        const idx = handlers.indexOf(entry)
        if (idx >= 0) handlers.splice(idx, 1)
      }
    },
  }
}

describe("RouteMessage", () => {
  test("delivers message to matching subscribers", async () => {
    const bus = createMockBus()
    const route = new RouteMessage(bus)
    const received: Message[] = []

    bus.subscribe({ types: ["task.assigned"] }, async (msg) => {
      received.push(msg)
    })

    const msg: Message = {
      type: "task.assigned",
      taskId: createTaskId("t-1"),
      agentId: createAgentId("dev-1"),
    }
    const result = await route.execute(msg)

    expect(result.ok).toBe(true)
    expect(received).toHaveLength(1)
    expect(received[0]).toEqual(msg)
  })

  test("does not deliver to non-matching subscribers", async () => {
    const bus = createMockBus()
    const route = new RouteMessage(bus)
    const received: Message[] = []

    bus.subscribe({ types: ["goal.created"] }, async (msg) => {
      received.push(msg)
    })

    const msg: Message = {
      type: "task.assigned",
      taskId: createTaskId("t-1"),
      agentId: createAgentId("dev-1"),
    }
    await route.execute(msg)

    expect(received).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/use-cases/RouteMessage.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement RouteMessage**

```typescript
// src/use-cases/RouteMessage.ts
import type { Message } from "../entities/Message"
import type { MessagePort } from "./ports/MessagePort"
import { type Result, success, failure } from "./Result"

export class RouteMessage {
  constructor(private readonly bus: MessagePort) {}

  async execute(message: Message): Promise<Result<void>> {
    try {
      await this.bus.emit(message)
      return success(undefined)
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return failure(`Failed to route message: ${msg}`)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/use-cases/RouteMessage.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Write the failing test for CheckBudget**

```typescript
// tests/use-cases/CheckBudget.test.ts
import { CheckBudget } from "../../src/use-cases/CheckBudget"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

function createMockTaskRepo(tasks: Map<string, ReturnType<typeof createTask>>): TaskRepository {
  return {
    async findById(id) { return tasks.get(id as string) ?? null },
    async findByGoalId() { return [] },
    async create() {},
    async update() {},
  }
}

describe("CheckBudget", () => {
  test("returns ok when budget has remaining tokens", async () => {
    const taskId = createTaskId("t-1")
    const tasks = new Map([[taskId as string, createTask({
      id: taskId,
      goalId: createGoalId("g-1"),
      description: "test",
      phase: "code",
      budget: createBudget(1000, 0.01),
      tokensUsed: 200,
    })]])

    const check = new CheckBudget(createMockTaskRepo(tasks))
    const result = await check.execute(taskId, 300)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.canProceed).toBe(true)
  })

  test("returns canProceed false when estimated tokens exceed remaining", async () => {
    const taskId = createTaskId("t-1")
    const tasks = new Map([[taskId as string, createTask({
      id: taskId,
      goalId: createGoalId("g-1"),
      description: "test",
      phase: "code",
      budget: createBudget(1000, 0.01),
      tokensUsed: 800,
    })]])

    const check = new CheckBudget(createMockTaskRepo(tasks))
    const result = await check.execute(taskId, 300)

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.canProceed).toBe(false)
  })

  test("returns failure when task not found", async () => {
    const check = new CheckBudget(createMockTaskRepo(new Map()))
    const result = await check.execute(createTaskId("missing"), 100)

    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest tests/use-cases/CheckBudget.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 7: Implement CheckBudget**

```typescript
// src/use-cases/CheckBudget.ts
import type { TaskId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import { type Result, success, failure } from "./Result"

export interface BudgetCheckResult {
  readonly canProceed: boolean
  readonly remaining: number
  readonly estimatedCost: number
}

export class CheckBudget {
  constructor(private readonly tasks: TaskRepository) {}

  async execute(taskId: TaskId, estimatedTokens: number): Promise<Result<BudgetCheckResult>> {
    const task = await this.tasks.findById(taskId)
    if (!task) return failure("Task not found")

    const remaining = task.budget.maxTokens - task.tokensUsed
    const canProceed = estimatedTokens <= remaining

    return success({ canProceed, remaining, estimatedCost: estimatedTokens })
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest tests/use-cases/CheckBudget.test.ts --no-cache`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/use-cases/RouteMessage.ts src/use-cases/CheckBudget.ts tests/use-cases/RouteMessage.test.ts tests/use-cases/CheckBudget.test.ts
git commit -m "feat: add RouteMessage and CheckBudget use cases"
```

---

### Task 9: Layer 2 — AssignTask + DecomposeGoal Use Cases

**Files:**
- Create: `src/use-cases/AssignTask.ts`
- Create: `src/use-cases/DecomposeGoal.ts`
- Test: `tests/use-cases/AssignTask.test.ts`
- Test: `tests/use-cases/DecomposeGoal.test.ts`

- [ ] **Step 1: Write the failing test for AssignTask**

```typescript
// tests/use-cases/AssignTask.test.ts
import { AssignTask } from "../../src/use-cases/AssignTask"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { AgentRegistry } from "../../src/use-cases/ports/AgentRegistry"
import type { MessagePort, MessageHandler, Unsubscribe } from "../../src/use-cases/ports/MessagePort"
import type { Message, MessageFilter } from "../../src/entities/Message"
import { createTask } from "../../src/entities/Task"
import { createAgent } from "../../src/entities/Agent"
import { createTaskId, createGoalId, createAgentId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import { ROLES } from "../../src/entities/AgentRole"

describe("AssignTask", () => {
  const taskId = createTaskId("t-1")
  const goalId = createGoalId("g-1")
  const agentId = createAgentId("dev-1")

  function setup(overrides: { taskExists?: boolean; agentAvailable?: boolean; taskStatus?: string } = {}) {
    const { taskExists = true, agentAvailable = true, taskStatus = "queued" } = overrides

    const task = createTask({
      id: taskId,
      goalId,
      description: "Write code",
      phase: "code",
      budget: createBudget(1000, 0.01),
      status: taskStatus as any,
    })

    const agent = createAgent({
      id: agentId,
      role: ROLES.DEVELOPER,
      model: "claude-sonnet-4-6",
    })

    let updatedTask: any = null
    const emitted: Message[] = []

    const taskRepo: TaskRepository = {
      async findById() { return taskExists ? task : null },
      async findByGoalId() { return [] },
      async create() {},
      async update(t) { updatedTask = t },
    }

    const agentRegistry: AgentRegistry = {
      async findAvailable() { return agentAvailable ? agent : null },
      async findById() { return agent },
      async register() {},
      async updateStatus() {},
    }

    const bus: MessagePort = {
      async emit(msg) { emitted.push(msg) },
      subscribe() { return () => {} },
    }

    const useCase = new AssignTask(taskRepo, agentRegistry, bus)
    return { useCase, getUpdatedTask: () => updatedTask, getEmitted: () => emitted }
  }

  test("assigns task to available agent", async () => {
    const { useCase, getUpdatedTask, getEmitted } = setup()
    const result = await useCase.execute(taskId, ROLES.DEVELOPER)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.assignedTo).toBe(agentId)
      expect(result.value.status).toBe("in_progress")
      expect(result.value.version).toBe(2)
    }
    expect(getEmitted()).toHaveLength(1)
    expect(getEmitted()[0].type).toBe("task.assigned")
  })

  test("fails when task not found", async () => {
    const { useCase } = setup({ taskExists: false })
    const result = await useCase.execute(taskId, ROLES.DEVELOPER)
    expect(result.ok).toBe(false)
  })

  test("fails when task not in queued status", async () => {
    const { useCase } = setup({ taskStatus: "in_progress" })
    const result = await useCase.execute(taskId, ROLES.DEVELOPER)
    expect(result.ok).toBe(false)
  })

  test("fails when no available agent", async () => {
    const { useCase } = setup({ agentAvailable: false })
    const result = await useCase.execute(taskId, ROLES.DEVELOPER)
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/use-cases/AssignTask.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement AssignTask**

```typescript
// src/use-cases/AssignTask.ts
import type { Task } from "../entities/Task"
import type { TaskId } from "../entities/ids"
import type { AgentRole } from "../entities/AgentRole"
import type { TaskRepository } from "./ports/TaskRepository"
import type { AgentRegistry } from "./ports/AgentRegistry"
import type { MessagePort } from "./ports/MessagePort"
import { type Result, success, failure } from "./Result"

export class AssignTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly agents: AgentRegistry,
    private readonly bus: MessagePort,
  ) {}

  async execute(taskId: TaskId, role: AgentRole): Promise<Result<Task>> {
    const task = await this.tasks.findById(taskId)
    if (!task) return failure("Task not found")
    if (task.status !== "queued") return failure("Task not assignable")

    const agent = await this.agents.findAvailable(role)
    if (!agent) return failure(`No available ${role} agent`)

    const assigned: Task = {
      ...task,
      assignedTo: agent.id,
      status: "in_progress",
      version: task.version + 1,
    }
    await this.tasks.update(assigned)
    await this.agents.updateStatus(agent.id, "busy", task.id)
    await this.bus.emit({ type: "task.assigned", taskId, agentId: agent.id })
    return success(assigned)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/use-cases/AssignTask.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Write the failing test for DecomposeGoal**

```typescript
// tests/use-cases/DecomposeGoal.test.ts
import { DecomposeGoal } from "../../src/use-cases/DecomposeGoal"
import type { GoalRepository } from "../../src/use-cases/ports/GoalRepository"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"
import type { Message } from "../../src/entities/Message"
import { createGoal } from "../../src/entities/Goal"
import { createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("DecomposeGoal", () => {
  test("creates tasks from descriptions and activates goal", async () => {
    const goalId = createGoalId("g-1")
    const goal = createGoal({
      id: goalId,
      description: "Build auth",
      totalBudget: createBudget(10000, 1.0),
    })

    let updatedGoal: any = null
    const createdTasks: any[] = []
    const emitted: Message[] = []

    const goalRepo: GoalRepository = {
      async findById() { return goal },
      async create() {},
      async update(g) { updatedGoal = g },
    }

    const taskRepo: TaskRepository = {
      async findById() { return null },
      async findByGoalId() { return [] },
      async create(t) { createdTasks.push(t) },
      async update() {},
    }

    const bus: MessagePort = {
      async emit(msg) { emitted.push(msg) },
      subscribe() { return () => {} },
    }

    const decompose = new DecomposeGoal(goalRepo, taskRepo, bus)
    const result = await decompose.execute(goalId, [
      { description: "Set up project", phase: "code", budgetTokens: 2000 },
      { description: "Write tests", phase: "test", budgetTokens: 3000 },
    ])

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(2)
      expect(result.value[0].description).toBe("Set up project")
      expect(result.value[1].description).toBe("Write tests")
    }
    expect(createdTasks).toHaveLength(2)
    expect(updatedGoal.status).toBe("active")
    expect(updatedGoal.taskIds).toHaveLength(2)
    // 2 task.created + 0 other = 2 emitted messages
    expect(emitted.filter(m => m.type === "task.created")).toHaveLength(2)
  })

  test("fails when goal not found", async () => {
    const goalRepo: GoalRepository = {
      async findById() { return null },
      async create() {},
      async update() {},
    }
    const taskRepo: TaskRepository = {
      async findById() { return null },
      async findByGoalId() { return [] },
      async create() {},
      async update() {},
    }
    const bus: MessagePort = {
      async emit() {},
      subscribe() { return () => {} },
    }

    const decompose = new DecomposeGoal(goalRepo, taskRepo, bus)
    const result = await decompose.execute(createGoalId("missing"), [])
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest tests/use-cases/DecomposeGoal.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 7: Implement DecomposeGoal**

```typescript
// src/use-cases/DecomposeGoal.ts
import type { Task } from "../entities/Task"
import { createTask } from "../entities/Task"
import type { GoalId } from "../entities/ids"
import { createTaskId } from "../entities/ids"
import { createBudget } from "../entities/Budget"
import type { GoalRepository } from "./ports/GoalRepository"
import type { TaskRepository } from "./ports/TaskRepository"
import type { MessagePort } from "./ports/MessagePort"
import { type Result, success, failure } from "./Result"

export interface TaskDefinition {
  readonly description: string
  readonly phase: string
  readonly budgetTokens: number
}

export class DecomposeGoal {
  constructor(
    private readonly goals: GoalRepository,
    private readonly tasks: TaskRepository,
    private readonly bus: MessagePort,
  ) {}

  async execute(
    goalId: GoalId,
    definitions: ReadonlyArray<TaskDefinition>,
  ): Promise<Result<ReadonlyArray<Task>>> {
    const goal = await this.goals.findById(goalId)
    if (!goal) return failure("Goal not found")

    const createdTasks: Task[] = []

    for (const def of definitions) {
      const task = createTask({
        id: createTaskId(),
        goalId,
        description: def.description,
        phase: def.phase,
        budget: createBudget(def.budgetTokens, goal.totalBudget.maxCostUsd / definitions.length),
      })
      await this.tasks.create(task)
      createdTasks.push(task)
      await this.bus.emit({ type: "task.created", taskId: task.id, goalId, phase: def.phase })
    }

    const updatedGoal = {
      ...goal,
      status: "active" as const,
      taskIds: createdTasks.map((t) => t.id),
    }
    await this.goals.update(updatedGoal)

    return success(createdTasks)
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest tests/use-cases/DecomposeGoal.test.ts --no-cache`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/use-cases/AssignTask.ts src/use-cases/DecomposeGoal.ts tests/use-cases/AssignTask.test.ts tests/use-cases/DecomposeGoal.test.ts
git commit -m "feat: add AssignTask and DecomposeGoal use cases"
```

---

### Task 10: Layer 2 — PromptAgent + ExecuteToolCalls Use Cases

**Files:**
- Create: `src/use-cases/PromptAgent.ts`
- Create: `src/use-cases/ExecuteToolCalls.ts`
- Test: `tests/use-cases/PromptAgent.test.ts`
- Test: `tests/use-cases/ExecuteToolCalls.test.ts`

- [ ] **Step 1: Write the failing test for PromptAgent**

```typescript
// tests/use-cases/PromptAgent.test.ts
import { PromptAgent } from "../../src/use-cases/PromptAgent"
import type {
  AICompletionProvider,
  AIToolProvider,
  AgentPrompt,
  AIResponse,
  AIToolResponse,
  ToolDefinition,
  AICapability,
} from "../../src/use-cases/ports/AIProvider"
import { createBudget } from "../../src/entities/Budget"

function createMockAI(overrides: {
  response?: Partial<AIResponse>
  toolResponse?: Partial<AIToolResponse>
  capabilities?: AICapability[]
} = {}): AICompletionProvider & AIToolProvider {
  return {
    capabilities: new Set(overrides.capabilities ?? ["tool_use"]),
    async complete(): Promise<AIResponse> {
      return {
        content: "Hello",
        tokensIn: 100,
        tokensOut: 50,
        stopReason: "end_turn",
        ...overrides.response,
      }
    },
    async completeWithTools(): Promise<AIToolResponse> {
      return {
        content: "Using tool",
        toolCalls: [],
        tokensIn: 150,
        tokensOut: 80,
        stopReason: "end_turn",
        ...overrides.toolResponse,
      }
    },
  }
}

describe("PromptAgent", () => {
  const prompt: AgentPrompt = {
    systemPrompt: "You are a developer",
    messages: [{ role: "user", content: "Write hello world" }],
    model: "claude-sonnet-4-6",
    maxTokens: 4096,
  }
  const budget = createBudget(1000, 0.01)

  test("completes without tools when no tools provided", async () => {
    const ai = createMockAI({ response: { content: "Done" } })
    const promptAgent = new PromptAgent(ai, ai)
    const result = await promptAgent.execute(prompt, budget)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.content).toBe("Done")
      expect(result.value.toolCalls).toHaveLength(0)
    }
  })

  test("completes with tools when tools provided and capable", async () => {
    const ai = createMockAI({
      toolResponse: {
        content: "Let me write that",
        toolCalls: [{ id: "tc-1", name: "write_file", input: { path: "index.ts", content: "console.log('hi')" } }],
      },
    })
    const promptAgent = new PromptAgent(ai, ai)
    const tools: ToolDefinition[] = [{ name: "write_file", description: "Write a file", inputSchema: {} }]
    const result = await promptAgent.execute(prompt, budget, tools)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.toolCalls).toHaveLength(1)
      expect(result.value.toolCalls[0].name).toBe("write_file")
    }
  })

  test("falls back to completion when AI lacks tool_use capability", async () => {
    const ai = createMockAI({ capabilities: [], response: { content: "No tools" } })
    const promptAgent = new PromptAgent(ai, ai)
    const tools: ToolDefinition[] = [{ name: "write_file", description: "Write", inputSchema: {} }]
    const result = await promptAgent.execute(prompt, budget, tools)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.content).toBe("No tools")
      expect(result.value.toolCalls).toHaveLength(0)
    }
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/use-cases/PromptAgent.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement PromptAgent**

```typescript
// src/use-cases/PromptAgent.ts
import type { TokenBudget } from "../entities/Budget"
import type {
  AICompletionProvider,
  AIToolProvider,
  AgentPrompt,
  ToolDefinition,
  ToolCall,
} from "./ports/AIProvider"
import { type Result, success, failure } from "./Result"

export interface PromptResult {
  readonly content: string
  readonly toolCalls: ReadonlyArray<ToolCall>
  readonly tokensIn: number
  readonly tokensOut: number
  readonly stopReason: string
}

export class PromptAgent {
  constructor(
    private readonly completion: AICompletionProvider,
    private readonly tools: AIToolProvider,
  ) {}

  async execute(
    prompt: AgentPrompt,
    budget: TokenBudget,
    toolDefs?: ReadonlyArray<ToolDefinition>,
  ): Promise<Result<PromptResult>> {
    try {
      if (toolDefs && toolDefs.length > 0 && this.completion.capabilities.has("tool_use")) {
        const response = await this.tools.completeWithTools(prompt, toolDefs, budget)
        return success({
          content: response.content,
          toolCalls: response.toolCalls,
          tokensIn: response.tokensIn,
          tokensOut: response.tokensOut,
          stopReason: response.stopReason,
        })
      }

      const response = await this.completion.complete(prompt, budget)
      return success({
        content: response.content,
        toolCalls: [],
        tokensIn: response.tokensIn,
        tokensOut: response.tokensOut,
        stopReason: response.stopReason,
      })
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error)
      return failure(`AI call failed: ${msg}`)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/use-cases/PromptAgent.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Write the failing test for ExecuteToolCalls**

```typescript
// tests/use-cases/ExecuteToolCalls.test.ts
import { ExecuteToolCalls } from "../../src/use-cases/ExecuteToolCalls"
import type { FileSystem } from "../../src/use-cases/ports/FileSystem"
import type { ShellExecutor } from "../../src/use-cases/ports/ShellExecutor"
import type { ToolCall } from "../../src/use-cases/ports/AIProvider"

function createMockFs(): FileSystem & { written: Map<string, string> } {
  const written = new Map<string, string>()
  return {
    written,
    async read(path) { return written.get(path) ?? "" },
    async write(path, content) { written.set(path, content) },
    async edit(path, old, newContent) {
      const current = written.get(path) ?? ""
      written.set(path, current.replace(old, newContent))
    },
    async glob() { return [] },
    async exists(path) { return written.has(path) },
  }
}

function createMockShell(): ShellExecutor {
  return {
    async execute(command) {
      return { stdout: `ran: ${command}`, stderr: "", exitCode: 0 }
    },
  }
}

describe("ExecuteToolCalls", () => {
  test("executes file_write tool call", async () => {
    const fs = createMockFs()
    const shell = createMockShell()
    const exec = new ExecuteToolCalls(fs, shell)

    const toolCalls: ToolCall[] = [
      { id: "tc-1", name: "file_write", input: { path: "hello.ts", content: "console.log('hi')" } },
    ]

    const result = await exec.execute(toolCalls)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value).toHaveLength(1)
      expect(result.value[0].success).toBe(true)
    }
    expect(fs.written.get("hello.ts")).toBe("console.log('hi')")
  })

  test("executes file_read tool call", async () => {
    const fs = createMockFs()
    fs.written.set("hello.ts", "content here")
    const shell = createMockShell()
    const exec = new ExecuteToolCalls(fs, shell)

    const toolCalls: ToolCall[] = [
      { id: "tc-1", name: "file_read", input: { path: "hello.ts" } },
    ]

    const result = await exec.execute(toolCalls)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value[0].output).toBe("content here")
    }
  })

  test("executes shell_run tool call", async () => {
    const fs = createMockFs()
    const shell = createMockShell()
    const exec = new ExecuteToolCalls(fs, shell)

    const toolCalls: ToolCall[] = [
      { id: "tc-1", name: "shell_run", input: { command: "npm test" } },
    ]

    const result = await exec.execute(toolCalls)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value[0].output).toContain("ran: npm test")
    }
  })

  test("returns error for unknown tool", async () => {
    const fs = createMockFs()
    const shell = createMockShell()
    const exec = new ExecuteToolCalls(fs, shell)

    const toolCalls: ToolCall[] = [
      { id: "tc-1", name: "unknown_tool", input: {} },
    ]

    const result = await exec.execute(toolCalls)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value[0].success).toBe(false)
    }
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest tests/use-cases/ExecuteToolCalls.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 7: Implement ExecuteToolCalls**

```typescript
// src/use-cases/ExecuteToolCalls.ts
import type { ToolCall } from "./ports/AIProvider"
import type { FileSystem } from "./ports/FileSystem"
import type { ShellExecutor } from "./ports/ShellExecutor"
import { type Result, success, failure } from "./Result"

export interface ToolResult {
  readonly toolCallId: string
  readonly name: string
  readonly output: string
  readonly success: boolean
}

export class ExecuteToolCalls {
  constructor(
    private readonly fs: FileSystem,
    private readonly shell: ShellExecutor,
  ) {}

  async execute(toolCalls: ReadonlyArray<ToolCall>): Promise<Result<ReadonlyArray<ToolResult>>> {
    const results: ToolResult[] = []

    for (const call of toolCalls) {
      try {
        const output = await this.executeSingle(call)
        results.push({ toolCallId: call.id, name: call.name, output, success: true })
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error)
        results.push({ toolCallId: call.id, name: call.name, output: msg, success: false })
      }
    }

    return success(results)
  }

  private async executeSingle(call: ToolCall): Promise<string> {
    switch (call.name) {
      case "file_read": {
        const content = await this.fs.read(call.input.path as string)
        return content
      }
      case "file_write": {
        await this.fs.write(call.input.path as string, call.input.content as string)
        return "File written successfully"
      }
      case "file_edit": {
        await this.fs.edit(
          call.input.path as string,
          call.input.old_content as string,
          call.input.new_content as string,
        )
        return "File edited successfully"
      }
      case "file_glob": {
        const files = await this.fs.glob(call.input.pattern as string)
        return files.join("\n")
      }
      case "shell_run": {
        const result = await this.shell.execute(
          call.input.command as string,
          call.input.timeout as number | undefined,
        )
        const output = result.stdout + (result.stderr ? `\nstderr: ${result.stderr}` : "")
        return `exit code: ${result.exitCode}\n${output}`
      }
      default:
        throw new Error(`Unknown tool: ${call.name}`)
    }
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest tests/use-cases/ExecuteToolCalls.test.ts --no-cache`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/use-cases/PromptAgent.ts src/use-cases/ExecuteToolCalls.ts tests/use-cases/PromptAgent.test.ts tests/use-cases/ExecuteToolCalls.test.ts
git commit -m "feat: add PromptAgent and ExecuteToolCalls use cases"
```

---

### Task 11: Layer 2 — RecordTurnMetrics + EvaluateTurnOutcome Use Cases

**Files:**
- Create: `src/use-cases/RecordTurnMetrics.ts`
- Create: `src/use-cases/EvaluateTurnOutcome.ts`
- Test: `tests/use-cases/RecordTurnMetrics.test.ts`
- Test: `tests/use-cases/EvaluateTurnOutcome.test.ts`

- [ ] **Step 1: Write the failing test for RecordTurnMetrics**

```typescript
// tests/use-cases/RecordTurnMetrics.test.ts
import { RecordTurnMetrics } from "../../src/use-cases/RecordTurnMetrics"
import type { MetricRecorder } from "../../src/use-cases/ports/MetricRecorder"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { Metric } from "../../src/entities/Metric"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId, createAgentId, createProjectId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("RecordTurnMetrics", () => {
  test("records metrics and updates task token usage", async () => {
    const taskId = createTaskId("t-1")
    const agentId = createAgentId("dev-1")
    const projectId = createProjectId("p-1")

    const task = createTask({
      id: taskId,
      goalId: createGoalId("g-1"),
      description: "test",
      phase: "code",
      budget: createBudget(1000, 0.01),
      tokensUsed: 100,
      status: "in_progress",
      assignedTo: agentId,
    })

    let updatedTask: any = null
    const recorded: Metric[] = []

    const taskRepo: TaskRepository = {
      async findById() { return task },
      async findByGoalId() { return [] },
      async create() {},
      async update(t) { updatedTask = t },
    }

    const metricRecorder: MetricRecorder = {
      async record(m) { recorded.push(m) },
      async findByTaskId() { return [] },
      async findByAgentId() { return [] },
    }

    const recordMetrics = new RecordTurnMetrics(taskRepo, metricRecorder)
    const result = await recordMetrics.execute({
      taskId,
      agentId,
      projectId,
      tokensIn: 150,
      tokensOut: 80,
      durationMs: 2000,
    })

    expect(result.ok).toBe(true)
    expect(updatedTask.tokensUsed).toBe(330) // 100 + 150 + 80
    expect(recorded).toHaveLength(3) // tokens_in, tokens_out, duration
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/use-cases/RecordTurnMetrics.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement RecordTurnMetrics**

```typescript
// src/use-cases/RecordTurnMetrics.ts
import type { TaskId, AgentId, ProjectId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import type { MetricRecorder } from "./ports/MetricRecorder"
import { type Result, success, failure } from "./Result"

export interface TurnMetricsInput {
  readonly taskId: TaskId
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly tokensIn: number
  readonly tokensOut: number
  readonly durationMs: number
}

export class RecordTurnMetrics {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly metrics: MetricRecorder,
  ) {}

  async execute(input: TurnMetricsInput): Promise<Result<void>> {
    const task = await this.tasks.findById(input.taskId)
    if (!task) return failure("Task not found")

    const totalTokens = input.tokensIn + input.tokensOut
    const updated = {
      ...task,
      tokensUsed: task.tokensUsed + totalTokens,
      version: task.version + 1,
    }
    await this.tasks.update(updated)

    const now = Date.now()
    const baseTags = { agentId: input.agentId as string, taskId: input.taskId as string }

    await this.metrics.record({
      name: "tokens_in",
      value: input.tokensIn,
      timestamp: now,
      agentId: input.agentId,
      taskId: input.taskId,
      projectId: input.projectId,
      tags: baseTags,
    })

    await this.metrics.record({
      name: "tokens_out",
      value: input.tokensOut,
      timestamp: now,
      agentId: input.agentId,
      taskId: input.taskId,
      projectId: input.projectId,
      tags: baseTags,
    })

    await this.metrics.record({
      name: "turn_duration_ms",
      value: input.durationMs,
      timestamp: now,
      agentId: input.agentId,
      taskId: input.taskId,
      projectId: input.projectId,
      tags: baseTags,
    })

    return success(undefined)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/use-cases/RecordTurnMetrics.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Write the failing test for EvaluateTurnOutcome**

```typescript
// tests/use-cases/EvaluateTurnOutcome.test.ts
import { EvaluateTurnOutcome, type TurnOutcome } from "../../src/use-cases/EvaluateTurnOutcome"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"
import type { Message } from "../../src/entities/Message"
import type { ToolResult } from "../../src/use-cases/ExecuteToolCalls"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId, createAgentId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("EvaluateTurnOutcome", () => {
  const taskId = createTaskId("t-1")
  const agentId = createAgentId("dev-1")

  function setup(taskOverrides: Record<string, any> = {}) {
    const task = createTask({
      id: taskId,
      goalId: createGoalId("g-1"),
      description: "test",
      phase: "code",
      budget: createBudget(1000, 0.01),
      status: "in_progress",
      assignedTo: agentId,
      ...taskOverrides,
    })

    const emitted: Message[] = []
    const taskRepo: TaskRepository = {
      async findById() { return task },
      async findByGoalId() { return [] },
      async create() {},
      async update() {},
    }
    const bus: MessagePort = {
      async emit(msg) { emitted.push(msg) },
      subscribe() { return () => {} },
    }

    return { evaluate: new EvaluateTurnOutcome(taskRepo, bus), emitted }
  }

  test("returns success when all tool results succeed and stop reason is end_turn", async () => {
    const { evaluate } = setup()
    const toolResults: ToolResult[] = [
      { toolCallId: "tc-1", name: "file_write", output: "ok", success: true },
    ]
    const result = await evaluate.execute(taskId, agentId, toolResults, "end_turn")

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe("success")
  })

  test("returns needs_continuation when stop reason is tool_use", async () => {
    const { evaluate } = setup()
    const result = await evaluate.execute(taskId, agentId, [], "tool_use")

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe("needs_continuation")
  })

  test("returns failure when any tool result failed", async () => {
    const { evaluate, emitted } = setup()
    const toolResults: ToolResult[] = [
      { toolCallId: "tc-1", name: "shell_run", output: "error", success: false },
    ]
    const result = await evaluate.execute(taskId, agentId, toolResults, "end_turn")

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe("failure")
  })

  test("returns budget_exceeded when task is over budget", async () => {
    const { evaluate, emitted } = setup({ tokensUsed: 1500 })
    const result = await evaluate.execute(taskId, agentId, [], "end_turn")

    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe("budget_exceeded")
    expect(emitted.some(m => m.type === "budget.exceeded")).toBe(true)
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest tests/use-cases/EvaluateTurnOutcome.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 7: Implement EvaluateTurnOutcome**

```typescript
// src/use-cases/EvaluateTurnOutcome.ts
import type { TaskId, AgentId } from "../entities/ids"
import { isOverBudget } from "../entities/Task"
import type { TaskRepository } from "./ports/TaskRepository"
import type { MessagePort } from "./ports/MessagePort"
import type { ToolResult } from "./ExecuteToolCalls"
import { type Result, success, failure } from "./Result"

export type TurnOutcome = "success" | "failure" | "needs_continuation" | "budget_exceeded"

export class EvaluateTurnOutcome {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly bus: MessagePort,
  ) {}

  async execute(
    taskId: TaskId,
    agentId: AgentId,
    toolResults: ReadonlyArray<ToolResult>,
    stopReason: string,
  ): Promise<Result<TurnOutcome>> {
    const task = await this.tasks.findById(taskId)
    if (!task) return failure("Task not found")

    if (isOverBudget(task)) {
      await this.bus.emit({
        type: "budget.exceeded",
        taskId,
        agentId,
        tokensUsed: task.tokensUsed,
        budgetMax: task.budget.maxTokens,
      })
      return success("budget_exceeded")
    }

    if (stopReason === "tool_use") {
      return success("needs_continuation")
    }

    const hasFailure = toolResults.some((r) => !r.success)
    if (hasFailure) {
      return success("failure")
    }

    return success("success")
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest tests/use-cases/EvaluateTurnOutcome.test.ts --no-cache`
Expected: PASS

- [ ] **Step 9: Commit**

```bash
git add src/use-cases/RecordTurnMetrics.ts src/use-cases/EvaluateTurnOutcome.ts tests/use-cases/RecordTurnMetrics.test.ts tests/use-cases/EvaluateTurnOutcome.test.ts
git commit -m "feat: add RecordTurnMetrics and EvaluateTurnOutcome use cases"
```

---

### Task 12: Layer 2 — RunAgentLoop Use Case (Extracted Agent Orchestration)

This is the core policy of how any agent executes a task. It lives in Layer 2 because it orchestrates use cases — not in Layer 3 where the DeveloperPlugin adapter lives. When Phase 2 adds 6 more agents, they all share this same execution engine, differing only in config (system prompt, tools, model).

**Files:**
- Create: `src/use-cases/RunAgentLoop.ts`
- Test: `tests/use-cases/RunAgentLoop.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/use-cases/RunAgentLoop.test.ts
import { RunAgentLoop } from "../../src/use-cases/RunAgentLoop"
import type { AgentConfig, AgentEvent } from "../../src/use-cases/ports/AgentExecutor"
import type { AICompletionProvider, AIToolProvider, AICapability, AIResponse, AIToolResponse, ToolDefinition } from "../../src/use-cases/ports/AIProvider"
import type { FileSystem } from "../../src/use-cases/ports/FileSystem"
import type { ShellExecutor } from "../../src/use-cases/ports/ShellExecutor"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { MetricRecorder } from "../../src/use-cases/ports/MetricRecorder"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"
import type { Metric } from "../../src/entities/Metric"
import type { Message } from "../../src/entities/Message"
import type { TokenBudget } from "../../src/entities/Budget"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId, createAgentId, createProjectId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import { ROLES } from "../../src/entities/AgentRole"

describe("RunAgentLoop", () => {
  const taskId = createTaskId("t-1")
  const goalId = createGoalId("g-1")
  const agentId = createAgentId("dev-1")
  const projectId = createProjectId("p-1")

  function setup(options: { maxAiCalls?: number } = {}) {
    const { maxAiCalls = 2 } = options
    const writtenFiles = new Map<string, string>()
    const emitted: Message[] = []
    const recorded: Metric[] = []

    let taskData = createTask({
      id: taskId,
      goalId,
      description: "Create a hello.ts file",
      phase: "code",
      budget: createBudget(5000, 0.05),
      status: "in_progress",
      assignedTo: agentId,
    })

    let aiCallCount = 0
    const mockAI: AICompletionProvider & AIToolProvider = {
      capabilities: new Set(["tool_use"] as AICapability[]),
      async complete(): Promise<AIResponse> {
        return { content: "Done", tokensIn: 50, tokensOut: 20, stopReason: "end_turn" }
      },
      async completeWithTools(): Promise<AIToolResponse> {
        aiCallCount++
        if (aiCallCount < maxAiCalls) {
          return {
            content: "Writing file",
            toolCalls: [{
              id: `tc-${aiCallCount}`,
              name: "file_write",
              input: { path: "hello.ts", content: "export const hello = 'world'" },
            }],
            tokensIn: 100,
            tokensOut: 80,
            stopReason: "tool_use",
          }
        }
        return {
          content: "Task complete",
          toolCalls: [],
          tokensIn: 50,
          tokensOut: 30,
          stopReason: "end_turn",
        }
      },
    }

    const fs: FileSystem = {
      async read(path) { return writtenFiles.get(path) ?? "" },
      async write(path, content) { writtenFiles.set(path, content) },
      async edit() {},
      async glob() { return [] },
      async exists(path) { return writtenFiles.has(path) },
    }

    const shell: ShellExecutor = {
      async execute() { return { stdout: "", stderr: "", exitCode: 0 } },
    }

    const taskRepo: TaskRepository = {
      async findById() { return taskData },
      async findByGoalId() { return [] },
      async create() {},
      async update(t) { taskData = t as any },
    }

    const metricRecorder: MetricRecorder = {
      async record(m) { recorded.push(m) },
      async findByTaskId() { return [] },
      async findByAgentId() { return [] },
    }

    const bus: MessagePort = {
      async emit(msg) { emitted.push(msg) },
      subscribe() { return () => {} },
    }

    const tools: ToolDefinition[] = [
      { name: "file_write", description: "Write a file", inputSchema: { type: "object", properties: { path: { type: "string" }, content: { type: "string" } }, required: ["path", "content"] } },
    ]

    const config: AgentConfig = {
      role: ROLES.DEVELOPER,
      systemPrompt: "You are a developer agent.",
      tools,
      model: "claude-sonnet-4-6",
      budget: createBudget(5000, 0.05),
    }

    const loop = new RunAgentLoop(mockAI, mockAI, fs, shell, taskRepo, metricRecorder, bus)

    return { loop, config, emitted, writtenFiles, recorded, getAiCallCount: () => aiCallCount }
  }

  test("runs agent loop to completion, emitting task_completed", async () => {
    const { loop, config, emitted, writtenFiles, getAiCallCount } = setup()
    const task = createTask({
      id: taskId,
      goalId,
      description: "Create a hello.ts file",
      phase: "code",
      budget: createBudget(5000, 0.05),
      status: "in_progress",
      assignedTo: agentId,
    })

    const events: AgentEvent[] = []
    for await (const event of loop.run(agentId, config, task, projectId)) {
      events.push(event)
    }

    expect(writtenFiles.get("hello.ts")).toBe("export const hello = 'world'")
    expect(events.some(e => e.type === "task_completed")).toBe(true)
    expect(getAiCallCount()).toBe(2)
  })

  test("emits turn_completed events for each turn", async () => {
    const { loop, config } = setup()
    const task = createTask({
      id: taskId,
      goalId,
      description: "test",
      phase: "code",
      budget: createBudget(5000, 0.05),
      status: "in_progress",
      assignedTo: agentId,
    })

    const events: AgentEvent[] = []
    for await (const event of loop.run(agentId, config, task, projectId)) {
      events.push(event)
    }

    const turnEvents = events.filter(e => e.type === "turn_completed")
    expect(turnEvents.length).toBeGreaterThanOrEqual(1)
  })

  test("stops on budget exceeded", async () => {
    const { loop, config } = setup({ maxAiCalls: 100 })
    const task = createTask({
      id: taskId,
      goalId,
      description: "test",
      phase: "code",
      budget: createBudget(200, 0.01), // very small budget
      status: "in_progress",
      assignedTo: agentId,
      tokensUsed: 150,
    })

    const events: AgentEvent[] = []
    for await (const event of loop.run(agentId, config, task, projectId)) {
      events.push(event)
    }

    expect(events.some(e => e.type === "budget_exceeded")).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/use-cases/RunAgentLoop.test.ts --no-cache`
Expected: FAIL — cannot find module

- [ ] **Step 3: Implement RunAgentLoop**

```typescript
// src/use-cases/RunAgentLoop.ts
import type { Task } from "../entities/Task"
import type { AgentId, ProjectId } from "../entities/ids"
import type {
  AgentConfig,
  AgentEvent,
  AgentExecutor,
} from "./ports/AgentExecutor"
import type {
  AICompletionProvider,
  AIToolProvider,
  AgentPrompt,
} from "./ports/AIProvider"
import type { FileSystem } from "./ports/FileSystem"
import type { ShellExecutor } from "./ports/ShellExecutor"
import type { TaskRepository } from "./ports/TaskRepository"
import type { MetricRecorder } from "./ports/MetricRecorder"
import type { MessagePort } from "./ports/MessagePort"
import { CheckBudget } from "./CheckBudget"
import { PromptAgent } from "./PromptAgent"
import { ExecuteToolCalls } from "./ExecuteToolCalls"
import { RecordTurnMetrics } from "./RecordTurnMetrics"
import { EvaluateTurnOutcome } from "./EvaluateTurnOutcome"

const MAX_TURNS = 20

export class RunAgentLoop implements AgentExecutor {
  private readonly checkBudget: CheckBudget
  private readonly promptAgent: PromptAgent
  private readonly executeToolCalls: ExecuteToolCalls
  private readonly recordMetrics: RecordTurnMetrics
  private readonly evaluateOutcome: EvaluateTurnOutcome

  constructor(
    completion: AICompletionProvider,
    tools: AIToolProvider,
    fs: FileSystem,
    shell: ShellExecutor,
    private readonly taskRepo: TaskRepository,
    metricRecorder: MetricRecorder,
    private readonly bus: MessagePort,
  ) {
    this.checkBudget = new CheckBudget(taskRepo)
    this.promptAgent = new PromptAgent(completion, tools)
    this.executeToolCalls = new ExecuteToolCalls(fs, shell)
    this.recordMetrics = new RecordTurnMetrics(taskRepo, metricRecorder)
    this.evaluateOutcome = new EvaluateTurnOutcome(taskRepo, bus)
  }

  async *run(
    agentId: AgentId,
    config: AgentConfig,
    task: Task,
    projectId: ProjectId,
  ): AsyncIterable<AgentEvent> {
    const conversationMessages: Array<{ role: "user" | "assistant"; content: string }> = [
      {
        role: "user",
        content: `Task: ${task.description}\n\nPhase: ${task.phase}\n\nPlease complete this task using the available tools.`,
      },
    ]

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // 1. Check budget
      const budgetCheck = await this.checkBudget.execute(task.id, 500)
      if (budgetCheck.ok && !budgetCheck.value.canProceed) {
        yield { type: "budget_exceeded", data: { turn, taskId: task.id } }
        await this.bus.emit({
          type: "budget.exceeded",
          taskId: task.id,
          agentId,
          tokensUsed: task.budget.maxTokens,
          budgetMax: task.budget.maxTokens,
        })
        return
      }

      const startTime = Date.now()

      // 2. Prompt AI
      const prompt: AgentPrompt = {
        systemPrompt: config.systemPrompt,
        messages: conversationMessages,
        model: config.model,
        maxTokens: 4096,
      }

      const promptResult = await this.promptAgent.execute(prompt, config.budget, config.tools)
      if (!promptResult.ok) {
        yield { type: "task_failed", data: { reason: promptResult.error } }
        await this.bus.emit({ type: "task.failed", taskId: task.id, agentId, reason: promptResult.error })
        return
      }

      const { content, toolCalls, tokensIn, tokensOut, stopReason } = promptResult.value

      // 3. Record metrics
      await this.recordMetrics.execute({
        taskId: task.id,
        agentId,
        projectId,
        tokensIn,
        tokensOut,
        durationMs: Date.now() - startTime,
      })

      // 4. Execute tool calls
      let toolResultsContent = ""
      const toolResults = toolCalls.length > 0
        ? await this.executeToolCalls.execute(toolCalls)
        : undefined

      if (toolResults?.ok && toolResults.value.length > 0) {
        toolResultsContent = toolResults.value
          .map((r) => `[${r.name}] ${r.success ? "OK" : "ERROR"}: ${r.output}`)
          .join("\n")

        yield {
          type: "tool_executed",
          data: {
            tools: toolResults.value.map((r) => ({ name: r.name, success: r.success })),
          },
        }
      }

      // 5. Update conversation
      if (content) {
        conversationMessages.push({ role: "assistant", content })
      }
      if (toolResultsContent) {
        conversationMessages.push({ role: "user", content: `Tool results:\n${toolResultsContent}` })
      }

      yield { type: "turn_completed", data: { turn, tokensIn, tokensOut, stopReason } }

      // 6. Evaluate outcome
      const outcome = await this.evaluateOutcome.execute(
        task.id,
        agentId,
        toolResults?.ok ? toolResults.value : [],
        stopReason,
      )

      if (!outcome.ok) {
        yield { type: "task_failed", data: { reason: outcome.error } }
        await this.bus.emit({ type: "task.failed", taskId: task.id, agentId, reason: outcome.error })
        return
      }

      if (outcome.value === "success") {
        yield { type: "task_completed", data: { turns: turn + 1 } }
        await this.bus.emit({ type: "task.completed", taskId: task.id, agentId })
        return
      }

      if (outcome.value === "budget_exceeded") {
        yield { type: "budget_exceeded", data: { turn } }
        return
      }

      // "failure" or "needs_continuation" → continue loop
    }

    // Max turns reached
    yield { type: "task_failed", data: { reason: "Max turns reached" } }
    await this.bus.emit({
      type: "task.failed",
      taskId: task.id,
      agentId,
      reason: "Max turns reached",
    })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/use-cases/RunAgentLoop.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Update use-cases barrel export**

```typescript
// src/use-cases/index.ts
export * from "./Result"
export * from "./RouteMessage"
export * from "./CheckBudget"
export * from "./AssignTask"
export * from "./DecomposeGoal"
export * from "./PromptAgent"
export * from "./ExecuteToolCalls"
export * from "./RecordTurnMetrics"
export * from "./EvaluateTurnOutcome"
export * from "./RunAgentLoop"
```

- [ ] **Step 6: Commit**

```bash
git add src/use-cases/RunAgentLoop.ts src/use-cases/index.ts tests/use-cases/RunAgentLoop.test.ts
git commit -m "feat: extract RunAgentLoop use case — agent orchestration in Layer 2"
```

---

### Task 13: Layer 3 — In-Memory Storage Adapters

**Files:**
- Create: `src/adapters/storage/InMemoryTaskRepo.ts`
- Create: `src/adapters/storage/InMemoryGoalRepo.ts`
- Create: `src/adapters/storage/InMemoryAgentRegistry.ts`
- Create: `src/adapters/storage/InMemoryEventStore.ts`
- Create: `src/adapters/storage/InMemoryMetricRecorder.ts`
- Test: `tests/adapters/InMemoryTaskRepo.test.ts`
- Test: `tests/adapters/InMemoryGoalRepo.test.ts`

- [ ] **Step 1: Write the failing test for InMemoryTaskRepo**

```typescript
// tests/adapters/InMemoryTaskRepo.test.ts
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import { VersionConflictError } from "../../src/use-cases/ports/TaskRepository"

describe("InMemoryTaskRepo", () => {
  const goalId = createGoalId("g-1")

  function makeTask(id: string, version = 1) {
    return createTask({
      id: createTaskId(id),
      goalId,
      description: "test",
      phase: "code",
      budget: createBudget(1000, 0.01),
      version,
    })
  }

  test("create and findById", async () => {
    const repo = new InMemoryTaskRepo()
    const task = makeTask("t-1")
    await repo.create(task)
    const found = await repo.findById(task.id)
    expect(found).toEqual(task)
  })

  test("findById returns null for missing", async () => {
    const repo = new InMemoryTaskRepo()
    const found = await repo.findById(createTaskId("missing"))
    expect(found).toBeNull()
  })

  test("findByGoalId returns matching tasks", async () => {
    const repo = new InMemoryTaskRepo()
    await repo.create(makeTask("t-1"))
    await repo.create(makeTask("t-2"))
    const found = await repo.findByGoalId(goalId)
    expect(found).toHaveLength(2)
  })

  test("update succeeds with matching version", async () => {
    const repo = new InMemoryTaskRepo()
    const task = makeTask("t-1", 1)
    await repo.create(task)
    const updated = { ...task, status: "in_progress" as const, version: 2 }
    await repo.update(updated)
    const found = await repo.findById(task.id)
    expect(found?.status).toBe("in_progress")
    expect(found?.version).toBe(2)
  })

  test("update throws VersionConflictError on stale version", async () => {
    const repo = new InMemoryTaskRepo()
    const task = makeTask("t-1", 1)
    await repo.create(task)
    // Update to version 2
    await repo.update({ ...task, version: 2 })
    // Try to update with stale version 2 (current is now 2, so updating with version 2 means the caller read version 1)
    // Actually: let's update with version 2 again — the stored version is now 2, and update expects version = stored + 1 = 3
    // The contract is: task.version in the update call is the NEW version. The repo checks that stored.version === task.version - 1.
    await expect(repo.update({ ...task, version: 2 })).rejects.toThrow(VersionConflictError)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/adapters/InMemoryTaskRepo.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement InMemoryTaskRepo**

```typescript
// src/adapters/storage/InMemoryTaskRepo.ts
import type { Task } from "../../entities/Task"
import type { TaskId, GoalId } from "../../entities/ids"
import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import { VersionConflictError } from "../../use-cases/ports/TaskRepository"

export class InMemoryTaskRepo implements TaskRepository {
  private readonly tasks = new Map<string, Task>()

  async findById(id: TaskId): Promise<Task | null> {
    return this.tasks.get(id as string) ?? null
  }

  async findByGoalId(goalId: GoalId): Promise<ReadonlyArray<Task>> {
    return Array.from(this.tasks.values()).filter(
      (t) => t.goalId === goalId,
    )
  }

  async create(task: Task): Promise<void> {
    this.tasks.set(task.id as string, task)
  }

  async update(task: Task): Promise<void> {
    const existing = this.tasks.get(task.id as string)
    if (!existing) throw new Error(`Task ${task.id} not found`)
    if (existing.version !== task.version - 1) {
      throw new VersionConflictError(task.id, task.version)
    }
    this.tasks.set(task.id as string, task)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/adapters/InMemoryTaskRepo.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Write the failing test for InMemoryGoalRepo**

```typescript
// tests/adapters/InMemoryGoalRepo.test.ts
import { InMemoryGoalRepo } from "../../src/adapters/storage/InMemoryGoalRepo"
import { createGoal } from "../../src/entities/Goal"
import { createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("InMemoryGoalRepo", () => {
  test("create and findById", async () => {
    const repo = new InMemoryGoalRepo()
    const goal = createGoal({
      id: createGoalId("g-1"),
      description: "Build auth",
      totalBudget: createBudget(10000, 1.0),
    })
    await repo.create(goal)
    const found = await repo.findById(goal.id)
    expect(found).toEqual(goal)
  })

  test("findById returns null for missing", async () => {
    const repo = new InMemoryGoalRepo()
    expect(await repo.findById(createGoalId("missing"))).toBeNull()
  })

  test("update replaces goal", async () => {
    const repo = new InMemoryGoalRepo()
    const goal = createGoal({
      id: createGoalId("g-1"),
      description: "Build auth",
      totalBudget: createBudget(10000, 1.0),
    })
    await repo.create(goal)
    await repo.update({ ...goal, status: "active" })
    const found = await repo.findById(goal.id)
    expect(found?.status).toBe("active")
  })
})
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx jest tests/adapters/InMemoryGoalRepo.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 7: Implement InMemoryGoalRepo**

```typescript
// src/adapters/storage/InMemoryGoalRepo.ts
import type { Goal } from "../../entities/Goal"
import type { GoalId } from "../../entities/ids"
import type { GoalRepository } from "../../use-cases/ports/GoalRepository"

export class InMemoryGoalRepo implements GoalRepository {
  private readonly goals = new Map<string, Goal>()

  async findById(id: GoalId): Promise<Goal | null> {
    return this.goals.get(id as string) ?? null
  }

  async create(goal: Goal): Promise<void> {
    this.goals.set(goal.id as string, goal)
  }

  async update(goal: Goal): Promise<void> {
    this.goals.set(goal.id as string, goal)
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

Run: `npx jest tests/adapters/InMemoryGoalRepo.test.ts --no-cache`
Expected: PASS

- [ ] **Step 9: Implement remaining in-memory adapters**

```typescript
// src/adapters/storage/InMemoryAgentRegistry.ts
import type { Agent } from "../../entities/Agent"
import type { AgentId } from "../../entities/ids"
import type { AgentRole } from "../../entities/AgentRole"
import type { AgentStatus } from "../../entities/Agent"
import type { AgentRegistry } from "../../use-cases/ports/AgentRegistry"

export class InMemoryAgentRegistry implements AgentRegistry {
  private readonly agents = new Map<string, Agent>()

  async findAvailable(role: AgentRole): Promise<Agent | null> {
    for (const agent of this.agents.values()) {
      if (agent.role === role && agent.status === "idle") return agent
    }
    return null
  }

  async findById(id: AgentId): Promise<Agent | null> {
    return this.agents.get(id as string) ?? null
  }

  async register(agent: Agent): Promise<void> {
    this.agents.set(agent.id as string, agent)
  }

  async updateStatus(
    id: AgentId,
    status: AgentStatus,
    taskId?: Agent["currentTaskId"],
  ): Promise<void> {
    const agent = this.agents.get(id as string)
    if (!agent) throw new Error(`Agent ${id} not found`)
    this.agents.set(id as string, {
      ...agent,
      status,
      currentTaskId: taskId ?? agent.currentTaskId,
    })
  }
}
```

```typescript
// src/adapters/storage/InMemoryEventStore.ts
import type { SystemEvent } from "../../entities/Event"
import type { TaskId, GoalId } from "../../entities/ids"
import type { EventStore } from "../../use-cases/ports/EventStore"

export class InMemoryEventStore implements EventStore {
  private readonly events: SystemEvent[] = []

  async append(event: SystemEvent): Promise<void> {
    this.events.push(event)
  }

  async findByTaskId(taskId: TaskId): Promise<ReadonlyArray<SystemEvent>> {
    return this.events.filter((e) => e.taskId === taskId)
  }

  async findByGoalId(goalId: GoalId): Promise<ReadonlyArray<SystemEvent>> {
    return this.events.filter((e) => e.goalId === goalId)
  }
}
```

```typescript
// src/adapters/storage/InMemoryMetricRecorder.ts
import type { Metric } from "../../entities/Metric"
import type { TaskId, AgentId } from "../../entities/ids"
import type { MetricRecorder } from "../../use-cases/ports/MetricRecorder"

export class InMemoryMetricRecorder implements MetricRecorder {
  private readonly metrics: Metric[] = []

  async record(metric: Metric): Promise<void> {
    this.metrics.push(metric)
  }

  async findByTaskId(taskId: TaskId): Promise<ReadonlyArray<Metric>> {
    return this.metrics.filter((m) => m.taskId === taskId)
  }

  async findByAgentId(agentId: AgentId): Promise<ReadonlyArray<Metric>> {
    return this.metrics.filter((m) => m.agentId === agentId)
  }
}
```

- [ ] **Step 10: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 11: Commit**

```bash
git add src/adapters/storage/ tests/adapters/InMemoryTaskRepo.test.ts tests/adapters/InMemoryGoalRepo.test.ts
git commit -m "feat: add in-memory storage adapters for all repository ports"
```

---

### Task 14: Layer 3 — InMemoryBus + Node FS + Shell Adapters

**Files:**
- Create: `src/adapters/messaging/InMemoryBus.ts`
- Create: `src/adapters/filesystem/NodeFileSystem.ts`
- Create: `src/adapters/shell/NodeShellExecutor.ts`
- Test: `tests/adapters/InMemoryBus.test.ts`

- [ ] **Step 1: Write the failing test for InMemoryBus**

```typescript
// tests/adapters/InMemoryBus.test.ts
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import type { Message } from "../../src/entities/Message"
import { createTaskId, createAgentId, createGoalId } from "../../src/entities/ids"

describe("InMemoryBus", () => {
  test("delivers message to matching subscriber", async () => {
    const bus = new InMemoryBus()
    const received: Message[] = []

    bus.subscribe({ types: ["task.assigned"] }, async (msg) => {
      received.push(msg)
    })

    await bus.emit({
      type: "task.assigned",
      taskId: createTaskId("t-1"),
      agentId: createAgentId("dev-1"),
    })

    expect(received).toHaveLength(1)
    expect(received[0].type).toBe("task.assigned")
  })

  test("does not deliver to non-matching subscriber", async () => {
    const bus = new InMemoryBus()
    const received: Message[] = []

    bus.subscribe({ types: ["goal.created"] }, async (msg) => {
      received.push(msg)
    })

    await bus.emit({
      type: "task.assigned",
      taskId: createTaskId("t-1"),
      agentId: createAgentId("dev-1"),
    })

    expect(received).toHaveLength(0)
  })

  test("delivers to multiple matching subscribers", async () => {
    const bus = new InMemoryBus()
    const received1: Message[] = []
    const received2: Message[] = []

    bus.subscribe({ types: ["task.assigned"] }, async (msg) => { received1.push(msg) })
    bus.subscribe({ types: ["task.assigned"] }, async (msg) => { received2.push(msg) })

    await bus.emit({
      type: "task.assigned",
      taskId: createTaskId("t-1"),
      agentId: createAgentId("dev-1"),
    })

    expect(received1).toHaveLength(1)
    expect(received2).toHaveLength(1)
  })

  test("unsubscribe stops delivery", async () => {
    const bus = new InMemoryBus()
    const received: Message[] = []

    const unsub = bus.subscribe({ types: ["task.assigned"] }, async (msg) => {
      received.push(msg)
    })
    unsub()

    await bus.emit({
      type: "task.assigned",
      taskId: createTaskId("t-1"),
      agentId: createAgentId("dev-1"),
    })

    expect(received).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/adapters/InMemoryBus.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 3: Implement InMemoryBus**

```typescript
// src/adapters/messaging/InMemoryBus.ts
import type { Message, MessageFilter } from "../../entities/Message"
import { matchesFilter } from "../../entities/Message"
import type { MessagePort, MessageHandler, Unsubscribe } from "../../use-cases/ports/MessagePort"

interface Subscription {
  readonly filter: MessageFilter
  readonly handler: MessageHandler
}

export class InMemoryBus implements MessagePort {
  private readonly subscriptions: Subscription[] = []

  async emit(message: Message): Promise<void> {
    const matching = this.subscriptions.filter((s) =>
      matchesFilter(message, s.filter),
    )
    await Promise.all(matching.map((s) => s.handler(message)))
  }

  subscribe(filter: MessageFilter, handler: MessageHandler): Unsubscribe {
    const subscription: Subscription = { filter, handler }
    this.subscriptions.push(subscription)
    return () => {
      const idx = this.subscriptions.indexOf(subscription)
      if (idx >= 0) this.subscriptions.splice(idx, 1)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/adapters/InMemoryBus.test.ts --no-cache`
Expected: PASS

- [ ] **Step 5: Implement NodeFileSystem adapter**

```typescript
// src/adapters/filesystem/NodeFileSystem.ts
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { glob as globFn } from "node:fs"
import type { FileSystem } from "../../use-cases/ports/FileSystem"

export class NodeFileSystem implements FileSystem {
  constructor(private readonly rootDir: string) {}

  private resolve(filePath: string): string {
    const resolved = path.resolve(this.rootDir, filePath)
    if (!resolved.startsWith(this.rootDir)) {
      throw new Error(`Path traversal not allowed: ${filePath}`)
    }
    return resolved
  }

  async read(filePath: string): Promise<string> {
    return fs.readFile(this.resolve(filePath), "utf-8")
  }

  async write(filePath: string, content: string): Promise<void> {
    const resolved = this.resolve(filePath)
    await fs.mkdir(path.dirname(resolved), { recursive: true })
    await fs.writeFile(resolved, content, "utf-8")
  }

  async edit(filePath: string, oldContent: string, newContent: string): Promise<void> {
    const resolved = this.resolve(filePath)
    const current = await fs.readFile(resolved, "utf-8")
    if (!current.includes(oldContent)) {
      throw new Error(`Old content not found in ${filePath}`)
    }
    await fs.writeFile(resolved, current.replace(oldContent, newContent), "utf-8")
  }

  async glob(pattern: string): Promise<ReadonlyArray<string>> {
    const { glob: globAsync } = await import("node:fs/promises")
    const matches: string[] = []
    for await (const entry of globAsync(pattern, { cwd: this.rootDir })) {
      matches.push(entry)
    }
    return matches
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(filePath))
      return true
    } catch {
      return false
    }
  }
}
```

- [ ] **Step 6: Implement NodeShellExecutor adapter**

```typescript
// src/adapters/shell/NodeShellExecutor.ts
import { exec } from "node:child_process"
import type { ShellExecutor, ShellResult } from "../../use-cases/ports/ShellExecutor"

export class NodeShellExecutor implements ShellExecutor {
  constructor(private readonly cwd: string) {}

  execute(command: string, timeout = 120_000): Promise<ShellResult> {
    return new Promise((resolve) => {
      exec(command, { cwd: this.cwd, timeout }, (error, stdout, stderr) => {
        resolve({
          stdout: stdout ?? "",
          stderr: stderr ?? "",
          exitCode: error?.code ?? (error ? 1 : 0),
        })
      })
    })
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add src/adapters/messaging/InMemoryBus.ts src/adapters/filesystem/NodeFileSystem.ts src/adapters/shell/NodeShellExecutor.ts tests/adapters/InMemoryBus.test.ts
git commit -m "feat: add InMemoryBus, NodeFileSystem, NodeShellExecutor adapters"
```


---

### Task 15: Layer 3 — Plugin SDK (Re-exports) + PluginRegistry

Plugin interfaces are defined as Layer 2 ports (Task 7, Step 9). The plugin-sdk package simply re-exports them for external consumers. This keeps the architectural home in Layer 2 while providing a clean public API.

**Files:**
- Create: `src/plugin-sdk/interfaces.ts`
- Create: `src/plugin-sdk/index.ts`
- Create: `src/adapters/plugins/PluginRegistry.ts`
- Test: `tests/adapters/PluginRegistry.test.ts`

- [ ] **Step 1: Implement Plugin SDK as re-exports**

```typescript
// src/plugin-sdk/interfaces.ts
// Re-export plugin interfaces from their canonical home in Layer 2 ports.
// External plugin authors import from here; internal code imports from ports.
export type {
  PluginIdentity,
  Lifecycle,
  PluginMessageHandler,
  DashboardContributor,
  DashboardWidget,
  HealthStatus,
  RegisteredPlugin,
} from "../use-cases/ports/PluginInterfaces"
```

```typescript
// src/plugin-sdk/index.ts
export * from "./interfaces"
```

- [ ] **Step 2: Write the failing test for PluginRegistry**

```typescript
// tests/adapters/PluginRegistry.test.ts
import { PluginRegistry } from "../../src/adapters/plugins/PluginRegistry"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../src/use-cases/ports/PluginInterfaces"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"
import type { Message, MessageFilter } from "../../src/entities/Message"
import { createTaskId, createAgentId } from "../../src/entities/ids"

function createTestPlugin(id: string, subscriptionTypes: string[] = []): PluginIdentity & Lifecycle & PluginMessageHandler {
  const handled: Message[] = []
  return {
    id,
    name: `Plugin ${id}`,
    version: "1.0.0",
    description: `Test plugin ${id}`,
    handled,
    async start() {},
    async stop() {},
    async healthCheck(): Promise<HealthStatus> { return "healthy" },
    subscriptions(): ReadonlyArray<MessageFilter> {
      return [{ types: subscriptionTypes as any }]
    },
    async handle(msg: Message) { handled.push(msg) },
  } as any
}

describe("PluginRegistry", () => {
  function createMockBus(): MessagePort {
    return {
      async emit() {},
      subscribe() { return () => {} },
    }
  }

  test("registers and discovers plugins", async () => {
    const registry = new PluginRegistry(createMockBus())
    const plugin = createTestPlugin("p-1")
    await registry.register(plugin)

    const discovered = registry.discover()
    expect(discovered).toHaveLength(1)
    expect(discovered[0].identity.id).toBe("p-1")
  })

  test("starts all plugins", async () => {
    const started: string[] = []
    const plugin = createTestPlugin("p-1")
    plugin.start = async () => { started.push("p-1") }

    const registry = new PluginRegistry(createMockBus())
    await registry.register(plugin)
    await registry.startAll()

    expect(started).toContain("p-1")
  })

  test("stops all plugins", async () => {
    const stopped: string[] = []
    const plugin = createTestPlugin("p-1")
    plugin.stop = async () => { stopped.push("p-1") }

    const registry = new PluginRegistry(createMockBus())
    await registry.register(plugin)
    await registry.startAll()
    await registry.stopAll()

    expect(stopped).toContain("p-1")
  })

  test("routes messages to plugin handlers via bus subscription", async () => {
    const bus = createMockBus()
    const subscribedHandlers: Array<{ filter: MessageFilter; handler: (msg: Message) => Promise<void> }> = []
    bus.subscribe = (filter, handler) => {
      subscribedHandlers.push({ filter, handler })
      return () => {}
    }

    const registry = new PluginRegistry(bus)
    const plugin = createTestPlugin("p-1", ["task.assigned"])
    await registry.register(plugin)

    expect(subscribedHandlers).toHaveLength(1)
    expect(subscribedHandlers[0].filter.types).toContain("task.assigned")
  })

  test("deregisters plugins", async () => {
    const registry = new PluginRegistry(createMockBus())
    const plugin = createTestPlugin("p-1")
    await registry.register(plugin)
    await registry.deregister("p-1")

    expect(registry.discover()).toHaveLength(0)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/adapters/PluginRegistry.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 4: Implement PluginRegistry**

```typescript
// src/adapters/plugins/PluginRegistry.ts
import type {
  PluginIdentity,
  Lifecycle,
  PluginMessageHandler,
  RegisteredPlugin,
} from "../../use-cases/ports/PluginInterfaces"
import type { MessagePort, Unsubscribe } from "../../use-cases/ports/MessagePort"

export class PluginRegistry {
  private readonly plugins = new Map<string, RegisteredPlugin>()
  private readonly unsubscribes = new Map<string, Unsubscribe[]>()

  constructor(private readonly bus: MessagePort) {}

  async register(
    plugin: PluginIdentity & Lifecycle & Partial<PluginMessageHandler>,
  ): Promise<void> {
    const registered: RegisteredPlugin = {
      identity: {
        id: plugin.id,
        name: plugin.name,
        version: plugin.version,
        description: plugin.description,
      },
      lifecycle: plugin,
      messageHandler: plugin.subscriptions && plugin.handle
        ? { subscriptions: plugin.subscriptions.bind(plugin), handle: plugin.handle.bind(plugin) }
        : undefined,
    }
    this.plugins.set(plugin.id, registered)

    if (registered.messageHandler) {
      const unsubs: Unsubscribe[] = []
      for (const filter of registered.messageHandler.subscriptions()) {
        const unsub = this.bus.subscribe(filter, (msg) =>
          registered.messageHandler!.handle(msg),
        )
        unsubs.push(unsub)
      }
      this.unsubscribes.set(plugin.id, unsubs)
    }
  }

  async deregister(pluginId: string): Promise<void> {
    const unsubs = this.unsubscribes.get(pluginId)
    if (unsubs) {
      unsubs.forEach((u) => u())
      this.unsubscribes.delete(pluginId)
    }
    const plugin = this.plugins.get(pluginId)
    if (plugin) {
      await plugin.lifecycle.stop()
    }
    this.plugins.delete(pluginId)
  }

  discover(): ReadonlyArray<RegisteredPlugin> {
    return Array.from(this.plugins.values())
  }

  async startAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.lifecycle.start()
    }
  }

  async stopAll(): Promise<void> {
    for (const plugin of this.plugins.values()) {
      await plugin.lifecycle.stop()
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/adapters/PluginRegistry.test.ts --no-cache`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/plugin-sdk/ src/adapters/plugins/PluginRegistry.ts tests/adapters/PluginRegistry.test.ts
git commit -m "feat: add Plugin SDK re-exports and PluginRegistry"
```

---

### Task 16: Layer 3 — Claude AI Provider Adapter

**Files:**
- Create: `src/adapters/ai-providers/ClaudeProvider.ts`

No test for this adapter because it wraps the external Anthropic SDK. We test it via the integration test.

- [ ] **Step 1: Implement ClaudeProvider**

```typescript
// src/adapters/ai-providers/ClaudeProvider.ts
import Anthropic from "@anthropic-ai/sdk"
import type { TokenBudget } from "../../entities/Budget"
import type {
  AICompletionProvider,
  AIToolProvider,
  AICapability,
  AgentPrompt,
  AIResponse,
  AIToolResponse,
  ToolDefinition,
} from "../../use-cases/ports/AIProvider"

export class ClaudeProvider implements AICompletionProvider, AIToolProvider {
  readonly capabilities: ReadonlySet<AICapability> = new Set([
    "tool_use",
    "vision",
    "streaming",
    "json_mode",
    "extended_context",
  ])

  private readonly client: Anthropic

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey })
  }

  async complete(prompt: AgentPrompt, budget: TokenBudget): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: prompt.model,
      max_tokens: Math.min(budget.remaining, prompt.maxTokens),
      system: prompt.systemPrompt,
      messages: prompt.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    })

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")

    return {
      content,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      stopReason: response.stop_reason === "end_turn" ? "end_turn"
        : response.stop_reason === "max_tokens" ? "max_tokens"
        : "tool_use",
    }
  }

  async completeWithTools(
    prompt: AgentPrompt,
    tools: ReadonlyArray<ToolDefinition>,
    budget: TokenBudget,
  ): Promise<AIToolResponse> {
    const response = await this.client.messages.create({
      model: prompt.model,
      max_tokens: Math.min(budget.remaining, prompt.maxTokens),
      system: prompt.systemPrompt,
      messages: prompt.messages.map((m) => ({
        role: m.role,
        content: m.content,
      })),
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema as Anthropic.Tool.InputSchema,
      })),
    })

    const content = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("")

    const toolCalls = response.content
      .filter((block): block is Anthropic.ToolUseBlock => block.type === "tool_use")
      .map((block) => ({
        id: block.id,
        name: block.name,
        input: block.input as Record<string, unknown>,
      }))

    return {
      content,
      toolCalls,
      tokensIn: response.usage.input_tokens,
      tokensOut: response.usage.output_tokens,
      stopReason: response.stop_reason === "end_turn" ? "end_turn"
        : response.stop_reason === "max_tokens" ? "max_tokens"
        : "tool_use",
    }
  }
}
```

- [ ] **Step 2: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/adapters/ai-providers/ClaudeProvider.ts
git commit -m "feat: add Claude AI provider adapter"
```

---

### Task 17: Layer 3 — Developer Agent Plugin (Thin Adapter)

The DeveloperPlugin is now a **thin adapter** — it translates between the message bus protocol and the `AgentExecutor` port. All orchestration logic lives in `RunAgentLoop` (Layer 2). When Phase 2 adds more agents, each plugin is ~30 lines: subscribe to messages, delegate to the shared executor with agent-specific config.

**Files:**
- Create: `src/adapters/plugins/agents/DeveloperPlugin.ts`
- Create: `agent-prompts/developer.md`
- Test: `tests/adapters/DeveloperPlugin.test.ts`

- [ ] **Step 1: Create the Developer agent system prompt**

```markdown
<!-- agent-prompts/developer.md -->
# Developer Agent

You are a Developer agent in the DevFleet system. Your job is to write code that solves the assigned task.

## Instructions

1. Read the task description carefully
2. Examine existing code in the project
3. Write code that fulfills the task requirements
4. Write tests for your code
5. Run the tests to make sure they pass
6. Report completion when done

## Tools Available

- `file_read` — Read a file. Input: `{ path: string }`
- `file_write` — Write a file. Input: `{ path: string, content: string }`
- `file_edit` — Edit a file. Input: `{ path: string, old_content: string, new_content: string }`
- `file_glob` — Find files matching a pattern. Input: `{ pattern: string }`
- `shell_run` — Run a shell command. Input: `{ command: string, timeout?: number }`

## Guidelines

- Write clean, tested code
- Follow existing project conventions
- Keep changes minimal and focused
- Run tests before reporting completion
```

- [ ] **Step 2: Write the failing test for DeveloperPlugin**

```typescript
// tests/adapters/DeveloperPlugin.test.ts
import { DeveloperPlugin } from "../../src/adapters/plugins/agents/DeveloperPlugin"
import type { AgentExecutor, AgentConfig, AgentEvent } from "../../src/use-cases/ports/AgentExecutor"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import type { Message } from "../../src/entities/Message"
import type { Task } from "../../src/entities/Task"
import type { AgentId, ProjectId } from "../../src/entities/ids"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId, createAgentId, createProjectId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import { ROLES } from "../../src/entities/AgentRole"

describe("DeveloperPlugin", () => {
  const agentId = createAgentId("developer-1")
  const taskId = createTaskId("t-1")
  const goalId = createGoalId("g-1")
  const projectId = createProjectId("p-1")

  function setup() {
    const task = createTask({
      id: taskId,
      goalId,
      description: "Create a hello.ts file",
      phase: "code",
      budget: createBudget(5000, 0.05),
      status: "in_progress",
      assignedTo: agentId,
    })

    const executorEvents: AgentEvent[] = [
      { type: "turn_completed", data: { turn: 0 } },
      { type: "task_completed", data: { turns: 1 } },
    ]

    const executorCalls: Array<{ agentId: AgentId; task: Task }> = []

    const mockExecutor: AgentExecutor = {
      async *run(aid, config, t, pid) {
        executorCalls.push({ agentId: aid, task: t })
        for (const event of executorEvents) {
          yield event
        }
      },
    }

    const taskRepo: TaskRepository = {
      async findById() { return task },
      async findByGoalId() { return [] },
      async create() {},
      async update() {},
    }

    const plugin = new DeveloperPlugin({
      agentId,
      projectId,
      executor: mockExecutor,
      taskRepo,
      systemPrompt: "You are a developer agent.",
      model: "claude-sonnet-4-6",
    })

    return { plugin, executorCalls }
  }

  test("has correct identity", () => {
    const { plugin } = setup()
    expect(plugin.id).toBe("developer-1")
    expect(plugin.name).toBe("Developer Agent")
  })

  test("subscribes to task.assigned messages", () => {
    const { plugin } = setup()
    const subs = plugin.subscriptions()
    expect(subs).toHaveLength(1)
    expect(subs[0].types).toContain("task.assigned")
  })

  test("delegates to AgentExecutor on task.assigned", async () => {
    const { plugin, executorCalls } = setup()
    await plugin.start()

    await plugin.handle({
      type: "task.assigned",
      taskId,
      agentId,
    })

    expect(executorCalls).toHaveLength(1)
    expect(executorCalls[0].agentId).toBe(agentId)
    expect(executorCalls[0].task.id).toBe(taskId)
  })

  test("ignores task.assigned for other agents", async () => {
    const { plugin, executorCalls } = setup()
    await plugin.start()

    await plugin.handle({
      type: "task.assigned",
      taskId,
      agentId: createAgentId("other-agent"),
    })

    expect(executorCalls).toHaveLength(0)
  })

  test("health check returns healthy", async () => {
    const { plugin } = setup()
    expect(await plugin.healthCheck()).toBe("healthy")
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/adapters/DeveloperPlugin.test.ts --no-cache`
Expected: FAIL

- [ ] **Step 4: Implement DeveloperPlugin (thin adapter)**

```typescript
// src/adapters/plugins/agents/DeveloperPlugin.ts
import type {
  PluginIdentity,
  Lifecycle,
  PluginMessageHandler,
  HealthStatus,
} from "../../../use-cases/ports/PluginInterfaces"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { AgentId, ProjectId } from "../../../entities/ids"
import type { AgentExecutor, AgentConfig } from "../../../use-cases/ports/AgentExecutor"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { ToolDefinition } from "../../../use-cases/ports/AIProvider"
import { ROLES } from "../../../entities/AgentRole"
import { createBudget } from "../../../entities/Budget"

const DEVELOPER_TOOLS: ReadonlyArray<ToolDefinition> = [
  {
    name: "file_read",
    description: "Read a file's contents",
    inputSchema: {
      type: "object",
      properties: { path: { type: "string", description: "File path to read" } },
      required: ["path"],
    },
  },
  {
    name: "file_write",
    description: "Write content to a file (creates or overwrites)",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to write" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "file_edit",
    description: "Replace specific content in a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to edit" },
        old_content: { type: "string", description: "Content to find" },
        new_content: { type: "string", description: "Content to replace with" },
      },
      required: ["path", "old_content", "new_content"],
    },
  },
  {
    name: "file_glob",
    description: "Find files matching a glob pattern",
    inputSchema: {
      type: "object",
      properties: { pattern: { type: "string", description: "Glob pattern" } },
      required: ["pattern"],
    },
  },
  {
    name: "shell_run",
    description: "Run a shell command",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Command to execute" },
        timeout: { type: "number", description: "Timeout in ms (optional)" },
      },
      required: ["command"],
    },
  },
]

export interface DeveloperPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly executor: AgentExecutor
  readonly taskRepo: TaskRepository
  readonly systemPrompt: string
  readonly model: string
}

export class DeveloperPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "Developer Agent"
  readonly version = "1.0.0"
  readonly description = "Writes code to solve assigned tasks"

  private readonly deps: DeveloperPluginDeps
  private readonly config: AgentConfig

  constructor(deps: DeveloperPluginDeps) {
    this.id = deps.agentId as string
    this.deps = deps
    this.config = {
      role: ROLES.DEVELOPER,
      systemPrompt: deps.systemPrompt,
      tools: DEVELOPER_TOOLS,
      model: deps.model,
      budget: createBudget(5000, 0.05),
    }
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

    // Delegate entirely to the AgentExecutor (Layer 2)
    // The plugin's job is just to translate message → executor call
    for await (const _event of this.deps.executor.run(
      this.deps.agentId,
      this.config,
      task,
      this.deps.projectId,
    )) {
      // Events could be forwarded to a logger, dashboard, etc.
      // For Phase 1 MVP, we just consume the iterator to completion.
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/adapters/DeveloperPlugin.test.ts --no-cache`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/adapters/plugins/agents/DeveloperPlugin.ts agent-prompts/developer.md tests/adapters/DeveloperPlugin.test.ts
git commit -m "feat: add Developer agent plugin as thin adapter over AgentExecutor"
```

---

### Task 18: Layer 4 — Composition Root + CLI

The composition root is the **only place** that knows all concrete types. It wires `RunAgentLoop` (Layer 2) with concrete adapters, then injects the executor into the `DeveloperPlugin`.

**Files:**
- Create: `src/infrastructure/config/composition-root.ts`
- Create: `src/infrastructure/cli/index.ts`

- [ ] **Step 1: Implement composition root**

```typescript
// src/infrastructure/config/composition-root.ts
import * as fs from "node:fs/promises"
import * as path from "node:path"
import { InMemoryTaskRepo } from "../../adapters/storage/InMemoryTaskRepo"
import { InMemoryGoalRepo } from "../../adapters/storage/InMemoryGoalRepo"
import { InMemoryAgentRegistry } from "../../adapters/storage/InMemoryAgentRegistry"
import { InMemoryEventStore } from "../../adapters/storage/InMemoryEventStore"
import { InMemoryMetricRecorder } from "../../adapters/storage/InMemoryMetricRecorder"
import { InMemoryBus } from "../../adapters/messaging/InMemoryBus"
import { ClaudeProvider } from "../../adapters/ai-providers/ClaudeProvider"
import { NodeFileSystem } from "../../adapters/filesystem/NodeFileSystem"
import { NodeShellExecutor } from "../../adapters/shell/NodeShellExecutor"
import { PluginRegistry } from "../../adapters/plugins/PluginRegistry"
import { DeveloperPlugin } from "../../adapters/plugins/agents/DeveloperPlugin"
import { RunAgentLoop } from "../../use-cases/RunAgentLoop"
import { DecomposeGoal } from "../../use-cases/DecomposeGoal"
import { AssignTask } from "../../use-cases/AssignTask"
import { RouteMessage } from "../../use-cases/RouteMessage"
import { createAgent } from "../../entities/Agent"
import { createAgentId, createProjectId } from "../../entities/ids"
import { ROLES } from "../../entities/AgentRole"
import type { ProjectId } from "../../entities/ids"

export interface SystemConfig {
  readonly anthropicApiKey: string
  readonly projectPath: string
  readonly model: string
}

export interface DevFleetSystem {
  readonly pluginRegistry: PluginRegistry
  readonly bus: InMemoryBus
  readonly taskRepo: InMemoryTaskRepo
  readonly goalRepo: InMemoryGoalRepo
  readonly agentRegistry: InMemoryAgentRegistry
  readonly decomposeGoal: DecomposeGoal
  readonly assignTask: AssignTask
  readonly routeMessage: RouteMessage
  readonly projectId: ProjectId
}

export async function buildSystem(config: SystemConfig): Promise<DevFleetSystem> {
  // --- Layer 4: Infrastructure ---
  const bus = new InMemoryBus()
  const taskRepo = new InMemoryTaskRepo()
  const goalRepo = new InMemoryGoalRepo()
  const agentRegistry = new InMemoryAgentRegistry()
  const eventStore = new InMemoryEventStore()
  const metricRecorder = new InMemoryMetricRecorder()
  const fileSystem = new NodeFileSystem(config.projectPath)
  const shell = new NodeShellExecutor(config.projectPath)
  const ai = new ClaudeProvider(config.anthropicApiKey)
  const projectId = createProjectId()

  // --- Layer 2: Use Cases (wired with ports) ---
  const decomposeGoal = new DecomposeGoal(goalRepo, taskRepo, bus)
  const assignTask = new AssignTask(taskRepo, agentRegistry, bus)
  const routeMessage = new RouteMessage(bus)

  // The agent executor — composes CheckBudget, PromptAgent, ExecuteToolCalls,
  // RecordTurnMetrics, EvaluateTurnOutcome into the universal agent loop.
  // All agent plugins share this same executor.
  const agentExecutor = new RunAgentLoop(ai, ai, fileSystem, shell, taskRepo, metricRecorder, bus)

  // --- Load agent system prompt ---
  let systemPrompt: string
  try {
    const promptPath = path.resolve(__dirname, "../../../agent-prompts/developer.md")
    systemPrompt = await fs.readFile(promptPath, "utf-8")
  } catch {
    systemPrompt = "You are a developer agent. Write code to solve the assigned task using the available tools."
  }

  // --- Layer 3: Agent Plugins (thin adapters over executor) ---
  const devAgentId = createAgentId("developer-1")
  const devPlugin = new DeveloperPlugin({
    agentId: devAgentId,
    projectId,
    executor: agentExecutor,
    taskRepo,
    systemPrompt,
    model: config.model,
  })

  // Register agent in registry
  await agentRegistry.register(
    createAgent({
      id: devAgentId,
      role: ROLES.DEVELOPER,
      model: config.model,
    }),
  )

  // Plugin registry
  const pluginRegistry = new PluginRegistry(bus)
  await pluginRegistry.register(devPlugin)
  await pluginRegistry.startAll()

  return {
    pluginRegistry,
    bus,
    taskRepo,
    goalRepo,
    agentRegistry,
    decomposeGoal,
    assignTask,
    routeMessage,
    projectId,
  }
}
```

- [ ] **Step 2: Implement CLI entry point**

```typescript
// src/infrastructure/cli/index.ts
import * as readline from "node:readline"
import { buildSystem } from "../config/composition-root"
import { createGoal } from "../../entities/Goal"
import { createGoalId } from "../../entities/ids"
import { createBudget } from "../../entities/Budget"
import { ROLES } from "../../entities/AgentRole"

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required")
    process.exit(1)
  }

  const projectPath = process.argv[2] ?? process.cwd()
  const model = process.env.DEVFLEET_MODEL ?? "claude-sonnet-4-6"

  console.log("DevFleet MVP — Phase 1")
  console.log(`Project: ${projectPath}`)
  console.log(`Model: ${model}`)
  console.log("")

  const system = await buildSystem({
    anthropicApiKey: apiKey,
    projectPath,
    model,
  })

  // Subscribe to events for CLI output
  system.bus.subscribe(
    { types: ["task.assigned", "task.completed", "task.failed", "task.created"] },
    async (msg) => {
      console.log(`[event] ${msg.type}`, JSON.stringify(msg, null, 2))
    },
  )

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  console.log("Enter a goal description (or 'quit' to exit):")
  console.log("")

  rl.on("line", async (line) => {
    const input = line.trim()
    if (input === "quit" || input === "exit") {
      await system.pluginRegistry.stopAll()
      rl.close()
      process.exit(0)
    }

    if (!input) return

    try {
      // Create goal
      const goalId = createGoalId()
      const goal = createGoal({
        id: goalId,
        description: input,
        totalBudget: createBudget(10000, 1.0),
      })
      await system.goalRepo.create(goal)

      // Decompose into a single task for MVP
      const decomposeResult = await system.decomposeGoal.execute(goalId, [
        { description: input, phase: "code", budgetTokens: 5000 },
      ])

      if (!decomposeResult.ok) {
        console.error(`Failed to decompose goal: ${decomposeResult.error}`)
        return
      }

      const tasks = decomposeResult.value
      console.log(`Created ${tasks.length} task(s). Assigning to Developer agent...`)

      // Assign first task to developer
      const assignResult = await system.assignTask.execute(tasks[0].id, ROLES.DEVELOPER)
      if (!assignResult.ok) {
        console.error(`Failed to assign task: ${assignResult.error}`)
        return
      }

      console.log("Task assigned. Developer agent is working...")
    } catch (error) {
      console.error("Error:", error)
    }
  })
}

main().catch(console.error)
```

- [ ] **Step 3: Verify compilation**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/
git commit -m "feat: add composition root (wires RunAgentLoop into plugins) and CLI"
```

---

### Task 19: Integration Test — End-to-End Smoke Test

**Files:**
- Test: `tests/integration/end-to-end.test.ts`

- [ ] **Step 1: Write the end-to-end integration test**

```typescript
// tests/integration/end-to-end.test.ts
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryGoalRepo } from "../../src/adapters/storage/InMemoryGoalRepo"
import { InMemoryAgentRegistry } from "../../src/adapters/storage/InMemoryAgentRegistry"
import { InMemoryMetricRecorder } from "../../src/adapters/storage/InMemoryMetricRecorder"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { PluginRegistry } from "../../src/adapters/plugins/PluginRegistry"
import { DeveloperPlugin } from "../../src/adapters/plugins/agents/DeveloperPlugin"
import { RunAgentLoop } from "../../src/use-cases/RunAgentLoop"
import { DecomposeGoal } from "../../src/use-cases/DecomposeGoal"
import { AssignTask } from "../../src/use-cases/AssignTask"
import type { AICompletionProvider, AIToolProvider, AICapability, AIResponse, AIToolResponse } from "../../src/use-cases/ports/AIProvider"
import type { FileSystem } from "../../src/use-cases/ports/FileSystem"
import type { ShellExecutor } from "../../src/use-cases/ports/ShellExecutor"
import type { Message } from "../../src/entities/Message"
import { createAgent } from "../../src/entities/Agent"
import { createGoal } from "../../src/entities/Goal"
import { createGoalId, createAgentId, createProjectId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import { ROLES } from "../../src/entities/AgentRole"

describe("End-to-end: Goal → Developer → Completion", () => {
  test("assigns a task to developer, developer writes code via executor, emits completion", async () => {
    // --- Infrastructure (all in-memory) ---
    const bus = new InMemoryBus()
    const taskRepo = new InMemoryTaskRepo()
    const goalRepo = new InMemoryGoalRepo()
    const agentRegistry = new InMemoryAgentRegistry()
    const metricRecorder = new InMemoryMetricRecorder()
    const projectId = createProjectId("p-1")
    const agentId = createAgentId("developer-1")

    // --- Mock AI: first call writes a file, second call signals completion ---
    let aiCallCount = 0
    const mockAI: AICompletionProvider & AIToolProvider = {
      capabilities: new Set(["tool_use"] as AICapability[]),
      async complete(): Promise<AIResponse> {
        return { content: "Done", tokensIn: 50, tokensOut: 20, stopReason: "end_turn" }
      },
      async completeWithTools(): Promise<AIToolResponse> {
        aiCallCount++
        if (aiCallCount === 1) {
          return {
            content: "Creating the greet function",
            toolCalls: [{
              id: "tc-1",
              name: "file_write",
              input: { path: "greet.ts", content: "export const greet = (name: string) => `Hello, ${name}!`" },
            }],
            tokensIn: 120,
            tokensOut: 90,
            stopReason: "tool_use",
          }
        }
        return {
          content: "The greet function has been created.",
          toolCalls: [],
          tokensIn: 80,
          tokensOut: 40,
          stopReason: "end_turn",
        }
      },
    }

    // --- Mock filesystem ---
    const writtenFiles = new Map<string, string>()
    const mockFs: FileSystem = {
      async read(path) { return writtenFiles.get(path) ?? "" },
      async write(path, content) { writtenFiles.set(path, content) },
      async edit() {},
      async glob() { return [] },
      async exists(path) { return writtenFiles.has(path) },
    }

    const mockShell: ShellExecutor = {
      async execute() { return { stdout: "", stderr: "", exitCode: 0 } },
    }

    // --- Layer 2: Wire the agent executor (use case composition) ---
    const agentExecutor = new RunAgentLoop(
      mockAI, mockAI, mockFs, mockShell, taskRepo, metricRecorder, bus,
    )

    // --- Register Developer agent ---
    await agentRegistry.register(
      createAgent({ id: agentId, role: ROLES.DEVELOPER, model: "claude-sonnet-4-6" }),
    )

    // --- Layer 3: Create thin Developer plugin, injected with executor ---
    const devPlugin = new DeveloperPlugin({
      agentId,
      projectId,
      executor: agentExecutor,
      taskRepo,
      systemPrompt: "You are a developer agent.",
      model: "claude-sonnet-4-6",
    })

    const pluginRegistry = new PluginRegistry(bus)
    await pluginRegistry.register(devPlugin)
    await pluginRegistry.startAll()

    // --- Track emitted events ---
    const events: Message[] = []
    bus.subscribe(
      { types: ["task.created", "task.assigned", "task.completed", "task.failed"] },
      async (msg) => { events.push(msg) },
    )

    // --- 1. Create Goal ---
    const goalId = createGoalId("goal-e2e")
    const goal = createGoal({
      id: goalId,
      description: "Create a greet function in greet.ts",
      totalBudget: createBudget(10000, 1.0),
    })
    await goalRepo.create(goal)

    // --- 2. Decompose Goal → Tasks ---
    const decompose = new DecomposeGoal(goalRepo, taskRepo, bus)
    const decomposeResult = await decompose.execute(goalId, [
      { description: "Create a greet function in greet.ts", phase: "code", budgetTokens: 5000 },
    ])
    expect(decomposeResult.ok).toBe(true)
    if (!decomposeResult.ok) return

    const tasks = decomposeResult.value
    expect(tasks).toHaveLength(1)

    // --- 3. Assign Task to Developer ---
    const assign = new AssignTask(taskRepo, agentRegistry, bus)
    const assignResult = await assign.execute(tasks[0].id, ROLES.DEVELOPER)
    expect(assignResult.ok).toBe(true)

    // The assignment triggers the developer plugin via message bus.
    // Wait for async processing.
    await new Promise((resolve) => setTimeout(resolve, 100))

    // --- 4. Verify Results ---

    // File was written
    expect(writtenFiles.has("greet.ts")).toBe(true)
    expect(writtenFiles.get("greet.ts")).toContain("greet")

    // task.completed was emitted
    const completionEvent = events.find((e) => e.type === "task.completed")
    expect(completionEvent).toBeDefined()

    // AI was called twice (one tool use turn, one completion turn)
    expect(aiCallCount).toBe(2)

    // Cleanup
    await pluginRegistry.stopAll()
  })
})
```

- [ ] **Step 2: Run the integration test**

Run: `npx jest tests/integration/end-to-end.test.ts --no-cache`
Expected: PASS

- [ ] **Step 3: Run ALL tests to verify nothing is broken**

Run: `npx jest --no-cache`
Expected: ALL PASS

- [ ] **Step 4: Verify full compilation**

Run: `npx tsc --noEmit`
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add tests/integration/end-to-end.test.ts
git commit -m "feat: add end-to-end integration test for Phase 1 MVP"
```

- [ ] **Step 6: Run all tests one final time to confirm Phase 1 is complete**

Run: `npx jest --no-cache --verbose`
Expected: ALL tests pass. Exit criteria met: Can assign a coding task to Developer agent, it executes via AgentExecutor and produces typed artifacts.

- [ ] **Step 7: Final commit with all remaining files**

```bash
git add -A
git status
git commit -m "chore: Phase 1 MVP complete — core entities, use cases, agent executor, developer plugin"
```
