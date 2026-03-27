# Phase 3: Dashboard + Real-Time Visibility — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Observe and control the full agent team from a browser — live agent status, pipeline kanban, CEO goal creation, and real-time metrics.

**Architecture:** Five batches respecting L1 → L2 → L3 → L4 layer ordering. Batch 1 extends backend ports and adds presenters/DTOs (Layer 2-3). Batch 2 adds the HTTP API server with SSE (Layer 4 backend). Batch 3 scaffolds the Next.js dashboard shell (Layer 4 frontend). Batch 4 builds the dashboard pages (Live Floor, Pipeline, CEO Interaction, Metrics). Batch 5 ties it together with an integration test. The HTTP API is the boundary — the dashboard never imports domain entities.

**Tech Stack:** TypeScript (strict), Node.js, Jest, Express, Next.js 15 (App Router), React 19, Tailwind CSS 4, shadcn/ui, Zustand

**Design spec:** `docs/superpowers/specs/2026-03-26-agentic-dev-platform-design.md` (sections 5.1, 8.1–8.3, 14 Phase 3)

**Clean Architecture constraints (from Uncle Bob review):**
1. Presenters live in `src/adapters/presenters/` (Layer 3) — not in use-cases
2. EventStore port extended with dashboard query methods before any adapter work
3. SSE is a delivery mechanism (Layer 4) — subscribes to MessagePort, never leaks into business logic
4. DTOs defined at API boundary, mapped by presenters — dashboard never imports domain types
5. Every CEO action gets a proper Use Case class

---

## File Structure

### Batch 1: Backend Foundation — Ports, Use Cases, Presenters, DTOs

| Action | Path | Purpose |
|--------|------|---------|
| Modify | `src/use-cases/ports/EventStore.ts` | Add `findAll`, `findRecent`, `countAll` query methods |
| Modify | `src/use-cases/ports/GoalRepository.ts` | Add `findAll` |
| Modify | `src/use-cases/ports/TaskRepository.ts` | Add `findAll` |
| Modify | `src/use-cases/ports/MetricRecorder.ts` | Add `findAll` |
| Modify | `src/adapters/storage/InMemoryEventStore.ts` | Implement new EventStore methods |
| Modify | `src/adapters/storage/InMemoryGoalRepo.ts` | Implement `findAll` |
| Modify | `src/adapters/storage/InMemoryTaskRepo.ts` | Implement `findAll` |
| Modify | `src/adapters/storage/InMemoryMetricRecorder.ts` | Implement `findAll` |
| Create | `src/use-cases/CreateGoalFromCeo.ts` | CEO goal creation use case |
| Create | `src/use-cases/PauseAgent.ts` | CEO pause agent use case |
| Create | `src/adapters/presenters/dto.ts` | All API response DTO types |
| Create | `src/adapters/presenters/mappers.ts` | Domain → DTO mapping functions |
| Create | `src/adapters/presenters/LiveFloorPresenter.ts` | Assembles live floor view model |
| Create | `src/adapters/presenters/PipelinePresenter.ts` | Assembles pipeline kanban view model |
| Create | `src/adapters/presenters/MetricsPresenter.ts` | Assembles Tier 1 metrics view model |
| Modify | `src/use-cases/ports/index.ts` | Re-export updated ports |
| Modify | `src/use-cases/index.ts` | Export new use cases |

### Batch 2: HTTP API + SSE

| Action | Path | Purpose |
|--------|------|---------|
| Create | `src/infrastructure/http/createServer.ts` | Express app factory with all routes |
| Create | `src/infrastructure/http/sseManager.ts` | SSE connection manager (subscribe/broadcast/cleanup) |
| Create | `src/infrastructure/http/routes/agentRoutes.ts` | GET /api/agents, POST /api/agents/:id/pause, POST /api/agents/:id/resume |
| Create | `src/infrastructure/http/routes/goalRoutes.ts` | GET /api/goals, POST /api/goals |
| Create | `src/infrastructure/http/routes/taskRoutes.ts` | GET /api/tasks, GET /api/tasks/:id |
| Create | `src/infrastructure/http/routes/eventRoutes.ts` | GET /api/events/stream (SSE), GET /api/events |
| Create | `src/infrastructure/http/routes/metricsRoutes.ts` | GET /api/metrics |
| Modify | `src/infrastructure/config/composition-root.ts` | Expose presenters + new use cases on DevFleetSystem |
| Modify | `src/infrastructure/cli/index.ts` | Start HTTP server alongside agent system |

### Batch 3: Dashboard Shell

| Action | Path | Purpose |
|--------|------|---------|
| Create | `dashboard/package.json` | Next.js 15 project config |
| Create | `dashboard/tsconfig.json` | TypeScript strict config |
| Create | `dashboard/next.config.ts` | Next.js config with API proxy rewrites |
| Create | `dashboard/tailwind.config.ts` | Tailwind CSS config |
| Create | `dashboard/postcss.config.mjs` | PostCSS config |
| Create | `dashboard/src/app/globals.css` | Global styles + Tailwind imports |
| Create | `dashboard/src/app/layout.tsx` | Root layout with sidebar nav |
| Create | `dashboard/src/app/page.tsx` | Live Floor page (default) |
| Create | `dashboard/src/lib/api.ts` | Typed API client (fetch wrappers) |
| Create | `dashboard/src/lib/store.ts` | Zustand store for real-time state |
| Create | `dashboard/src/lib/useSSE.ts` | SSE connection hook |
| Create | `dashboard/src/lib/types.ts` | DTO types (mirror of backend DTOs) |
| Create | `dashboard/src/components/ui/status-badge.tsx` | Agent/task status indicator |
| Create | `dashboard/src/components/ui/nav-link.tsx` | Sidebar navigation link |

### Batch 4: Dashboard Pages

| Action | Path | Purpose |
|--------|------|---------|
| Create | `dashboard/src/components/live-floor/agent-card.tsx` | Agent status card component |
| Create | `dashboard/src/components/live-floor/activity-feed.tsx` | Real-time event feed |
| Create | `dashboard/src/components/pipeline/kanban-board.tsx` | Kanban column layout |
| Create | `dashboard/src/components/pipeline/task-card.tsx` | Task card for kanban |
| Create | `dashboard/src/app/pipeline/page.tsx` | Pipeline page |
| Create | `dashboard/src/components/ceo/create-goal-form.tsx` | Goal creation form |
| Create | `dashboard/src/components/ceo/agent-controls.tsx` | Pause/resume agent controls |
| Create | `dashboard/src/components/metrics/metrics-panel.tsx` | Tier 1 metrics display |
| Modify | `dashboard/src/app/page.tsx` | Wire Live Floor with agent cards + activity feed + metrics |

### Batch 5: Integration Test

| Action | Path | Purpose |
|--------|------|---------|
| Create | `tests/integration/phase3-api.test.ts` | E2E: start system + API, create goal, verify REST + SSE |

---

## Batch 1: Backend Foundation

### Task 1: Extend EventStore port with dashboard query methods

**Files:**
- Modify: `src/use-cases/ports/EventStore.ts`
- Modify: `src/adapters/storage/InMemoryEventStore.ts`
- Test: `tests/adapters/InMemoryEventStore.test.ts`

- [ ] **Step 1: Write failing tests for new EventStore methods**

```typescript
// tests/adapters/InMemoryEventStore.test.ts
import { InMemoryEventStore } from "../../src/adapters/storage/InMemoryEventStore"
import { createEventId, createAgentId, createTaskId, createGoalId } from "../../src/entities/ids"
import type { SystemEvent } from "../../src/entities/Event"

function makeEvent(overrides: Partial<SystemEvent> = {}): SystemEvent {
  return {
    id: createEventId(),
    type: "task.assigned",
    agentId: createAgentId("agent-1"),
    taskId: createTaskId("task-1"),
    goalId: createGoalId("goal-1"),
    cost: null,
    occurredAt: new Date(),
    payload: null,
    ...overrides,
  }
}

describe("InMemoryEventStore", () => {
  let store: InMemoryEventStore

  beforeEach(() => {
    store = new InMemoryEventStore()
  })

  describe("findAll", () => {
    it("returns all events when no options given", async () => {
      await store.append(makeEvent())
      await store.append(makeEvent())
      const results = await store.findAll()
      expect(results).toHaveLength(2)
    })

    it("filters by event type", async () => {
      await store.append(makeEvent({ type: "task.assigned" }))
      await store.append(makeEvent({ type: "goal.created" }))
      const results = await store.findAll({ types: ["task.assigned"] })
      expect(results).toHaveLength(1)
      expect(results[0].type).toBe("task.assigned")
    })

    it("filters by agentId", async () => {
      await store.append(makeEvent({ agentId: createAgentId("a-1") }))
      await store.append(makeEvent({ agentId: createAgentId("a-2") }))
      const results = await store.findAll({ agentId: createAgentId("a-1") })
      expect(results).toHaveLength(1)
    })

    it("respects limit", async () => {
      for (let i = 0; i < 10; i++) await store.append(makeEvent())
      const results = await store.findAll({ limit: 3 })
      expect(results).toHaveLength(3)
    })

    it("respects offset", async () => {
      for (let i = 0; i < 5; i++) {
        await store.append(makeEvent({ type: i < 3 ? "task.assigned" : "goal.created" }))
      }
      const results = await store.findAll({ offset: 2, limit: 2 })
      expect(results).toHaveLength(2)
    })
  })

  describe("findRecent", () => {
    it("returns the N most recent events newest-first", async () => {
      const e1 = makeEvent({ occurredAt: new Date("2026-01-01") })
      const e2 = makeEvent({ occurredAt: new Date("2026-01-03") })
      const e3 = makeEvent({ occurredAt: new Date("2026-01-02") })
      await store.append(e1)
      await store.append(e2)
      await store.append(e3)
      const results = await store.findRecent(2)
      expect(results).toHaveLength(2)
      expect(results[0].id).toBe(e2.id)
      expect(results[1].id).toBe(e3.id)
    })
  })

  describe("countAll", () => {
    it("returns the total event count", async () => {
      await store.append(makeEvent())
      await store.append(makeEvent())
      await store.append(makeEvent())
      expect(await store.countAll()).toBe(3)
    })

    it("returns 0 when empty", async () => {
      expect(await store.countAll()).toBe(0)
    })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest tests/adapters/InMemoryEventStore.test.ts --no-coverage`
Expected: FAIL — `findAll`, `findRecent`, `countAll` do not exist on EventStore

- [ ] **Step 3: Extend EventStore port interface**

```typescript
// src/use-cases/ports/EventStore.ts
import type { SystemEvent } from "../../entities/Event"
import type { TaskId, GoalId, AgentId } from "../../entities/ids"
import type { MessageType } from "../../entities/Message"

export interface EventQueryOptions {
  readonly types?: readonly MessageType[]
  readonly agentId?: AgentId
  readonly limit?: number
  readonly offset?: number
}

export interface EventStore {
  append(event: SystemEvent): Promise<void>
  findByTaskId(taskId: TaskId): Promise<ReadonlyArray<SystemEvent>>
  findByGoalId(goalId: GoalId): Promise<ReadonlyArray<SystemEvent>>
  findAll(options?: EventQueryOptions): Promise<ReadonlyArray<SystemEvent>>
  findRecent(limit: number): Promise<ReadonlyArray<SystemEvent>>
  countAll(): Promise<number>
}
```

- [ ] **Step 4: Implement new methods in InMemoryEventStore**

```typescript
// src/adapters/storage/InMemoryEventStore.ts
import type { SystemEvent } from "../../entities/Event"
import type { TaskId, GoalId } from "../../entities/ids"
import type { EventStore, EventQueryOptions } from "../../use-cases/ports/EventStore"

export class InMemoryEventStore implements EventStore {
  private readonly events: SystemEvent[] = []

  async append(event: SystemEvent): Promise<void> {
    this.events.push(event)
  }

  async findByTaskId(taskId: TaskId): Promise<ReadonlyArray<SystemEvent>> {
    return this.events.filter(e => e.taskId === taskId)
  }

  async findByGoalId(goalId: GoalId): Promise<ReadonlyArray<SystemEvent>> {
    return this.events.filter(e => e.goalId === goalId)
  }

  async findAll(options?: EventQueryOptions): Promise<ReadonlyArray<SystemEvent>> {
    let results: SystemEvent[] = [...this.events]

    if (options?.types && options.types.length > 0) {
      const typeSet = new Set(options.types)
      results = results.filter(e => typeSet.has(e.type))
    }

    if (options?.agentId) {
      results = results.filter(e => e.agentId === options.agentId)
    }

    const offset = options?.offset ?? 0
    const limit = options?.limit ?? results.length

    return results.slice(offset, offset + limit)
  }

  async findRecent(limit: number): Promise<ReadonlyArray<SystemEvent>> {
    return [...this.events]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit)
  }

  async countAll(): Promise<number> {
    return this.events.length
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest tests/adapters/InMemoryEventStore.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 6: Run full test suite to verify no regressions**

Run: `npx jest --no-coverage`
Expected: All existing tests still pass

- [ ] **Step 7: Commit**

```bash
git add src/use-cases/ports/EventStore.ts src/adapters/storage/InMemoryEventStore.ts tests/adapters/InMemoryEventStore.test.ts
git commit -m "feat(phase3): extend EventStore port with dashboard query methods"
```

---

### Task 2: Extend GoalRepository, TaskRepository, MetricRecorder with findAll

**Files:**
- Modify: `src/use-cases/ports/GoalRepository.ts`
- Modify: `src/use-cases/ports/TaskRepository.ts`
- Modify: `src/use-cases/ports/MetricRecorder.ts`
- Modify: `src/adapters/storage/InMemoryGoalRepo.ts`
- Modify: `src/adapters/storage/InMemoryTaskRepo.ts`
- Modify: `src/adapters/storage/InMemoryMetricRecorder.ts`
- Test: `tests/adapters/InMemoryGoalRepo.test.ts`

- [ ] **Step 1: Write failing tests for findAll on each repo**

```typescript
// tests/adapters/InMemoryGoalRepo.test.ts
import { InMemoryGoalRepo } from "../../src/adapters/storage/InMemoryGoalRepo"
import { createGoal } from "../../src/entities/Goal"
import { createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("InMemoryGoalRepo", () => {
  let repo: InMemoryGoalRepo

  beforeEach(() => {
    repo = new InMemoryGoalRepo()
  })

  describe("findAll", () => {
    it("returns empty array when no goals exist", async () => {
      expect(await repo.findAll()).toEqual([])
    })

    it("returns all goals", async () => {
      const g1 = createGoal({ id: createGoalId("g1"), description: "A", totalBudget: createBudget({ maxTokens: 100, maxCostUsd: 1 }) })
      const g2 = createGoal({ id: createGoalId("g2"), description: "B", totalBudget: createBudget({ maxTokens: 200, maxCostUsd: 2 }) })
      await repo.create(g1)
      await repo.create(g2)
      const all = await repo.findAll()
      expect(all).toHaveLength(2)
      expect(all.map(g => g.id)).toEqual(expect.arrayContaining(["g1", "g2"]))
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/adapters/InMemoryGoalRepo.test.ts --no-coverage`
Expected: FAIL — `findAll` does not exist

- [ ] **Step 3: Add findAll to GoalRepository port**

```typescript
// src/use-cases/ports/GoalRepository.ts
import type { Goal } from "../../entities/Goal"
import type { GoalId } from "../../entities/ids"

export interface GoalRepository {
  findById(id: GoalId): Promise<Goal | null>
  findAll(): Promise<ReadonlyArray<Goal>>
  create(goal: Goal): Promise<void>
  update(goal: Goal): Promise<void>
}
```

- [ ] **Step 4: Add findAll to TaskRepository port**

```typescript
// src/use-cases/ports/TaskRepository.ts — add to interface
  findAll(): Promise<ReadonlyArray<Task>>
```

The full interface becomes:

```typescript
import type { Task } from "../../entities/Task"
import type { TaskId, GoalId } from "../../entities/ids"

export class VersionConflictError extends Error {
  constructor(public readonly taskId: TaskId, public readonly expectedVersion: number) {
    super(`Version conflict for task ${taskId} at version ${expectedVersion}`)
    this.name = "VersionConflictError"
  }
}

export interface TaskRepository {
  findById(id: TaskId): Promise<Task | null>
  findByGoalId(goalId: GoalId): Promise<ReadonlyArray<Task>>
  findAll(): Promise<ReadonlyArray<Task>>
  create(task: Task): Promise<void>
  update(task: Task): Promise<void>
}
```

- [ ] **Step 5: Add findAll to MetricRecorder port**

```typescript
// src/use-cases/ports/MetricRecorder.ts — add to interface
  findAll(): Promise<ReadonlyArray<Metric>>
```

The full interface becomes:

```typescript
import type { Metric } from "../../entities/Metric"
import type { TaskId, AgentId } from "../../entities/ids"

export interface MetricRecorder {
  record(metric: Metric): Promise<void>
  findByTaskId(taskId: TaskId): Promise<ReadonlyArray<Metric>>
  findByAgentId(agentId: AgentId): Promise<ReadonlyArray<Metric>>
  findAll(): Promise<ReadonlyArray<Metric>>
}
```

- [ ] **Step 6: Implement findAll in all three in-memory adapters**

Add to `src/adapters/storage/InMemoryGoalRepo.ts`:
```typescript
  async findAll(): Promise<ReadonlyArray<Goal>> {
    return Array.from(this.store.values())
  }
```

Add to `src/adapters/storage/InMemoryTaskRepo.ts`:
```typescript
  async findAll(): Promise<ReadonlyArray<Task>> {
    return Array.from(this.store.values())
  }
```

Add to `src/adapters/storage/InMemoryMetricRecorder.ts`:
```typescript
  async findAll(): Promise<ReadonlyArray<Metric>> {
    return [...this.metrics]
  }
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx jest tests/adapters/InMemoryGoalRepo.test.ts --no-coverage`
Expected: PASS

Run: `npx jest --no-coverage`
Expected: All tests PASS (no regressions)

- [ ] **Step 8: Commit**

```bash
git add src/use-cases/ports/GoalRepository.ts src/use-cases/ports/TaskRepository.ts src/use-cases/ports/MetricRecorder.ts src/adapters/storage/InMemoryGoalRepo.ts src/adapters/storage/InMemoryTaskRepo.ts src/adapters/storage/InMemoryMetricRecorder.ts tests/adapters/InMemoryGoalRepo.test.ts
git commit -m "feat(phase3): add findAll to GoalRepository, TaskRepository, MetricRecorder"
```

---

### Task 3: CreateGoalFromCeo use case

**Files:**
- Create: `src/use-cases/CreateGoalFromCeo.ts`
- Test: `tests/use-cases/CreateGoalFromCeo.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/use-cases/CreateGoalFromCeo.test.ts
import { CreateGoalFromCeo } from "../../src/use-cases/CreateGoalFromCeo"
import { InMemoryGoalRepo } from "../../src/adapters/storage/InMemoryGoalRepo"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import type { Message } from "../../src/entities/Message"

describe("CreateGoalFromCeo", () => {
  let goalRepo: InMemoryGoalRepo
  let bus: InMemoryBus
  let useCase: CreateGoalFromCeo

  beforeEach(() => {
    goalRepo = new InMemoryGoalRepo()
    bus = new InMemoryBus()
    useCase = new CreateGoalFromCeo(goalRepo, bus)
  })

  it("creates a goal and emits goal.created", async () => {
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })

    const result = await useCase.execute({
      description: "Build login page",
      maxTokens: 50_000,
      maxCostUsd: 5.0,
    })

    expect(result.ok).toBe(true)
    if (!result.ok) return

    // Goal stored
    const stored = await goalRepo.findById(result.value.id)
    expect(stored).not.toBeNull()
    expect(stored!.description).toBe("Build login page")
    expect(stored!.status).toBe("active")
    expect(stored!.totalBudget.maxTokens).toBe(50_000)

    // goal.created emitted
    expect(emitted).toHaveLength(1)
    expect(emitted[0].type).toBe("goal.created")
    if (emitted[0].type === "goal.created") {
      expect(emitted[0].goalId).toBe(result.value.id)
      expect(emitted[0].description).toBe("Build login page")
    }
  })

  it("rejects empty description", async () => {
    const result = await useCase.execute({
      description: "   ",
      maxTokens: 50_000,
      maxCostUsd: 5.0,
    })

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("description")
    }
  })

  it("rejects zero or negative budget", async () => {
    const result = await useCase.execute({
      description: "Valid",
      maxTokens: 0,
      maxCostUsd: 5.0,
    })

    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/use-cases/CreateGoalFromCeo.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement CreateGoalFromCeo**

```typescript
// src/use-cases/CreateGoalFromCeo.ts
import type { GoalRepository } from "./ports/GoalRepository"
import type { MessagePort } from "./ports/MessagePort"
import type { Goal } from "../entities/Goal"
import { createGoal } from "../entities/Goal"
import { createGoalId, createMessageId } from "../entities/ids"
import { createBudget } from "../entities/Budget"
import { success, failure, type Result } from "./Result"

export interface CreateGoalInput {
  readonly description: string
  readonly maxTokens: number
  readonly maxCostUsd: number
}

export class CreateGoalFromCeo {
  constructor(
    private readonly goals: GoalRepository,
    private readonly bus: MessagePort,
  ) {}

  async execute(input: CreateGoalInput): Promise<Result<Goal>> {
    const description = input.description.trim()
    if (!description) {
      return failure("Goal description must not be empty")
    }

    if (input.maxTokens <= 0 || input.maxCostUsd <= 0) {
      return failure("Budget must be greater than zero")
    }

    const goal = createGoal({
      id: createGoalId(),
      description,
      totalBudget: createBudget({
        maxTokens: input.maxTokens,
        maxCostUsd: input.maxCostUsd,
      }),
      status: "active",
    })

    await this.goals.create(goal)

    await this.bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId: goal.id,
      description: goal.description,
      timestamp: new Date(),
    })

    return success(goal)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/use-cases/CreateGoalFromCeo.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/CreateGoalFromCeo.ts tests/use-cases/CreateGoalFromCeo.test.ts
git commit -m "feat(phase3): add CreateGoalFromCeo use case"
```

---

### Task 4: PauseAgent use case

**Files:**
- Create: `src/use-cases/PauseAgent.ts`
- Test: `tests/use-cases/PauseAgent.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/use-cases/PauseAgent.test.ts
import { PauseAgent } from "../../src/use-cases/PauseAgent"
import { InMemoryAgentRegistry } from "../../src/adapters/storage/InMemoryAgentRegistry"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { createAgent } from "../../src/entities/Agent"
import { createAgentId } from "../../src/entities/ids"
import { ROLES } from "../../src/entities/AgentRole"
import type { Message } from "../../src/entities/Message"

describe("PauseAgent", () => {
  let registry: InMemoryAgentRegistry
  let bus: InMemoryBus
  let useCase: PauseAgent

  beforeEach(async () => {
    registry = new InMemoryAgentRegistry()
    bus = new InMemoryBus()
    useCase = new PauseAgent(registry, bus)

    await registry.register(createAgent({
      id: createAgentId("dev-1"),
      role: ROLES.DEVELOPER,
      model: "sonnet",
      status: "busy",
    }))
  })

  it("pauses a busy agent", async () => {
    const result = await useCase.execute(createAgentId("dev-1"), "CEO requested pause")

    expect(result.ok).toBe(true)
    const agent = await registry.findById(createAgentId("dev-1"))
    expect(agent!.status).toBe("paused")
  })

  it("emits ceo.override message on pause", async () => {
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })

    await useCase.execute(createAgentId("dev-1"), "Testing pause")

    const override = emitted.find(m => m.type === "ceo.override")
    expect(override).toBeDefined()
  })

  it("resumes a paused agent", async () => {
    await useCase.execute(createAgentId("dev-1"), "pause")
    const result = await useCase.resume(createAgentId("dev-1"))

    expect(result.ok).toBe(true)
    const agent = await registry.findById(createAgentId("dev-1"))
    expect(agent!.status).toBe("idle")
  })

  it("fails when agent not found", async () => {
    const result = await useCase.execute(createAgentId("unknown"), "reason")
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/use-cases/PauseAgent.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement PauseAgent**

```typescript
// src/use-cases/PauseAgent.ts
import type { AgentRegistry } from "./ports/AgentRegistry"
import type { MessagePort } from "./ports/MessagePort"
import type { AgentId } from "../entities/ids"
import { createMessageId, createTaskId } from "../entities/ids"
import { success, failure, type Result } from "./Result"

export class PauseAgent {
  constructor(
    private readonly agents: AgentRegistry,
    private readonly bus: MessagePort,
  ) {}

  async execute(agentId: AgentId, reason: string): Promise<Result<void>> {
    const agent = await this.agents.findById(agentId)
    if (!agent) {
      return failure(`Agent ${agentId} not found`)
    }

    await this.agents.updateStatus(agentId, "paused")

    await this.bus.emit({
      id: createMessageId(),
      type: "ceo.override",
      taskId: agent.currentTaskId ?? createTaskId("no-task"),
      action: "pause",
      reason,
      timestamp: new Date(),
    })

    return success(undefined)
  }

  async resume(agentId: AgentId): Promise<Result<void>> {
    const agent = await this.agents.findById(agentId)
    if (!agent) {
      return failure(`Agent ${agentId} not found`)
    }

    if (agent.status !== "paused") {
      return failure(`Agent ${agentId} is not paused (status: ${agent.status})`)
    }

    await this.agents.updateStatus(agentId, "idle")

    return success(undefined)
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/use-cases/PauseAgent.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/PauseAgent.ts tests/use-cases/PauseAgent.test.ts
git commit -m "feat(phase3): add PauseAgent use case with pause/resume"
```

---

### Task 5: API DTO types and domain-to-DTO mappers

**Files:**
- Create: `src/adapters/presenters/dto.ts`
- Create: `src/adapters/presenters/mappers.ts`
- Test: `tests/adapters/presenters/mappers.test.ts`

- [ ] **Step 1: Create DTO types**

```typescript
// src/adapters/presenters/dto.ts

export interface AgentDTO {
  readonly id: string
  readonly role: string
  readonly status: string
  readonly currentTaskId: string | null
  readonly model: string
  readonly lastActiveAt: string
}

export interface TaskDTO {
  readonly id: string
  readonly goalId: string
  readonly description: string
  readonly status: string
  readonly phase: string
  readonly assignedTo: string | null
  readonly tokensUsed: number
  readonly budget: BudgetDTO
  readonly retryCount: number
  readonly branch: string | null
}

export interface BudgetDTO {
  readonly maxTokens: number
  readonly maxCostUsd: number
  readonly remaining: number
}

export interface GoalDTO {
  readonly id: string
  readonly description: string
  readonly status: string
  readonly createdAt: string
  readonly completedAt: string | null
  readonly taskCount: number
  readonly totalBudget: BudgetDTO
}

export interface EventDTO {
  readonly id: string
  readonly type: string
  readonly agentId: string | null
  readonly taskId: string | null
  readonly goalId: string | null
  readonly cost: EventCostDTO | null
  readonly occurredAt: string
}

export interface EventCostDTO {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly totalTokens: number
  readonly estimatedCostUsd: number
}

export interface LiveFloorDTO {
  readonly agents: readonly AgentDTO[]
  readonly activeTasks: readonly TaskDTO[]
  readonly recentEvents: readonly EventDTO[]
}

export interface PipelineDTO {
  readonly phases: readonly string[]
  readonly tasksByPhase: Record<string, readonly TaskDTO[]>
  readonly goals: readonly GoalDTO[]
}

export interface MetricsSummaryDTO {
  readonly totalTokensUsed: number
  readonly totalCostUsd: number
  readonly activeTaskCount: number
  readonly completedTaskCount: number
  readonly agentTokenBreakdown: Record<string, number>
}
```

- [ ] **Step 2: Write failing tests for mappers**

```typescript
// tests/adapters/presenters/mappers.test.ts
import { toAgentDTO, toTaskDTO, toGoalDTO, toEventDTO } from "../../../src/adapters/presenters/mappers"
import { createAgent } from "../../../src/entities/Agent"
import { createTask } from "../../../src/entities/Task"
import { createGoal } from "../../../src/entities/Goal"
import { createBudget } from "../../../src/entities/Budget"
import { createAgentId, createTaskId, createGoalId, createEventId } from "../../../src/entities/ids"
import { ROLES } from "../../../src/entities/AgentRole"
import type { SystemEvent } from "../../../src/entities/Event"

describe("mappers", () => {
  describe("toAgentDTO", () => {
    it("maps all Agent fields to DTO", () => {
      const agent = createAgent({
        id: createAgentId("dev-1"),
        role: ROLES.DEVELOPER,
        model: "claude-sonnet",
        status: "busy",
        currentTaskId: createTaskId("t-1"),
        lastActiveAt: new Date("2026-03-27T10:00:00Z"),
      })
      const dto = toAgentDTO(agent)
      expect(dto.id).toBe("dev-1")
      expect(dto.role).toBe("developer")
      expect(dto.status).toBe("busy")
      expect(dto.currentTaskId).toBe("t-1")
      expect(dto.model).toBe("claude-sonnet")
      expect(dto.lastActiveAt).toBe("2026-03-27T10:00:00.000Z")
    })
  })

  describe("toTaskDTO", () => {
    it("maps all Task fields to DTO", () => {
      const task = createTask({
        id: createTaskId("t-1"),
        goalId: createGoalId("g-1"),
        description: "Implement feature",
        phase: "code",
        budget: createBudget({ maxTokens: 10_000, maxCostUsd: 1 }),
      })
      const dto = toTaskDTO(task)
      expect(dto.id).toBe("t-1")
      expect(dto.goalId).toBe("g-1")
      expect(dto.description).toBe("Implement feature")
      expect(dto.status).toBe("queued")
      expect(dto.phase).toBe("code")
      expect(dto.budget.maxTokens).toBe(10_000)
    })
  })

  describe("toGoalDTO", () => {
    it("maps Goal to DTO with taskCount", () => {
      const goal = createGoal({
        id: createGoalId("g-1"),
        description: "Build login",
        totalBudget: createBudget({ maxTokens: 50_000, maxCostUsd: 5 }),
        taskIds: [createTaskId("t-1"), createTaskId("t-2")],
      })
      const dto = toGoalDTO(goal)
      expect(dto.id).toBe("g-1")
      expect(dto.taskCount).toBe(2)
      expect(dto.status).toBe("proposed")
    })
  })

  describe("toEventDTO", () => {
    it("maps SystemEvent to DTO", () => {
      const event: SystemEvent = {
        id: createEventId("e-1"),
        type: "task.assigned",
        agentId: createAgentId("dev-1"),
        taskId: createTaskId("t-1"),
        goalId: null,
        cost: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCostUsd: 0.01 },
        occurredAt: new Date("2026-03-27T12:00:00Z"),
        payload: null,
      }
      const dto = toEventDTO(event)
      expect(dto.id).toBe("e-1")
      expect(dto.type).toBe("task.assigned")
      expect(dto.agentId).toBe("dev-1")
      expect(dto.cost!.totalTokens).toBe(150)
      expect(dto.occurredAt).toBe("2026-03-27T12:00:00.000Z")
    })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest tests/adapters/presenters/mappers.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 4: Implement mappers**

```typescript
// src/adapters/presenters/mappers.ts
import type { Agent } from "../../entities/Agent"
import type { Task } from "../../entities/Task"
import type { Goal } from "../../entities/Goal"
import type { SystemEvent } from "../../entities/Event"
import type { AgentDTO, TaskDTO, GoalDTO, EventDTO, BudgetDTO } from "./dto"
import type { TokenBudget } from "../../entities/Budget"

export function toBudgetDTO(budget: TokenBudget): BudgetDTO {
  return {
    maxTokens: budget.maxTokens,
    maxCostUsd: budget.maxCostUsd,
    remaining: budget.remaining,
  }
}

export function toAgentDTO(agent: Agent): AgentDTO {
  return {
    id: agent.id as string,
    role: agent.role as string,
    status: agent.status,
    currentTaskId: agent.currentTaskId as string | null,
    model: agent.model,
    lastActiveAt: agent.lastActiveAt.toISOString(),
  }
}

export function toTaskDTO(task: Task): TaskDTO {
  return {
    id: task.id as string,
    goalId: task.goalId as string,
    description: task.description,
    status: task.status,
    phase: task.phase,
    assignedTo: task.assignedTo as string | null,
    tokensUsed: task.tokensUsed,
    budget: toBudgetDTO(task.budget),
    retryCount: task.retryCount,
    branch: task.branch,
  }
}

export function toGoalDTO(goal: Goal): GoalDTO {
  return {
    id: goal.id as string,
    description: goal.description,
    status: goal.status,
    createdAt: goal.createdAt.toISOString(),
    completedAt: goal.completedAt?.toISOString() ?? null,
    taskCount: goal.taskIds.length,
    totalBudget: toBudgetDTO(goal.totalBudget),
  }
}

export function toEventDTO(event: SystemEvent): EventDTO {
  return {
    id: event.id as string,
    type: event.type,
    agentId: event.agentId as string | null,
    taskId: event.taskId as string | null,
    goalId: event.goalId as string | null,
    cost: event.cost
      ? {
          inputTokens: event.cost.inputTokens,
          outputTokens: event.cost.outputTokens,
          totalTokens: event.cost.totalTokens,
          estimatedCostUsd: event.cost.estimatedCostUsd,
        }
      : null,
    occurredAt: event.occurredAt.toISOString(),
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest tests/adapters/presenters/mappers.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/adapters/presenters/dto.ts src/adapters/presenters/mappers.ts tests/adapters/presenters/mappers.test.ts
git commit -m "feat(phase3): add API DTO types and domain-to-DTO mappers"
```

---

### Task 6: LiveFloorPresenter

**Files:**
- Create: `src/adapters/presenters/LiveFloorPresenter.ts`
- Test: `tests/adapters/presenters/LiveFloorPresenter.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/adapters/presenters/LiveFloorPresenter.test.ts
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

    await agentRegistry.register(createAgent({
      id: createAgentId("dev-1"), role: ROLES.DEVELOPER, model: "sonnet", status: "busy",
      currentTaskId: createTaskId("t-1"),
    }))
    await agentRegistry.register(createAgent({
      id: createAgentId("rev-1"), role: ROLES.REVIEWER, model: "sonnet", status: "idle",
    }))

    await taskRepo.create(createTask({
      id: createTaskId("t-1"), goalId: createGoalId("g-1"),
      description: "Implement feature", phase: "code",
      budget: createBudget({ maxTokens: 10_000, maxCostUsd: 1 }),
      status: "in_progress",
    }))
    await taskRepo.create(createTask({
      id: createTaskId("t-2"), goalId: createGoalId("g-1"),
      description: "Done task", phase: "review",
      budget: createBudget({ maxTokens: 5_000, maxCostUsd: 0.5 }),
      status: "merged",
    }))

    const event: SystemEvent = {
      id: createEventId(), type: "task.assigned",
      agentId: createAgentId("dev-1"), taskId: createTaskId("t-1"),
      goalId: createGoalId("g-1"), cost: null,
      occurredAt: new Date(), payload: null,
    }
    await eventStore.append(event)
  })

  it("assembles LiveFloorDTO with agents, active tasks, and recent events", async () => {
    const dto = await presenter.present()

    expect(dto.agents).toHaveLength(2)
    expect(dto.agents.find(a => a.id === "dev-1")!.status).toBe("busy")

    // Only active tasks (in_progress, review), not merged/discarded
    expect(dto.activeTasks).toHaveLength(1)
    expect(dto.activeTasks[0].id).toBe("t-1")

    expect(dto.recentEvents).toHaveLength(1)
    expect(dto.recentEvents[0].type).toBe("task.assigned")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/adapters/presenters/LiveFloorPresenter.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement LiveFloorPresenter**

```typescript
// src/adapters/presenters/LiveFloorPresenter.ts
import type { AgentRegistry } from "../../use-cases/ports/AgentRegistry"
import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import type { EventStore } from "../../use-cases/ports/EventStore"
import type { LiveFloorDTO } from "./dto"
import { toAgentDTO, toTaskDTO, toEventDTO } from "./mappers"

const ACTIVE_STATUSES = new Set(["queued", "in_progress", "review"])

export class LiveFloorPresenter {
  constructor(
    private readonly agents: AgentRegistry,
    private readonly tasks: TaskRepository,
    private readonly events: EventStore,
  ) {}

  async present(): Promise<LiveFloorDTO> {
    const [agents, allTasks, recentEvents] = await Promise.all([
      this.agents.findAll(),
      this.tasks.findAll(),
      this.events.findRecent(50),
    ])

    const activeTasks = allTasks.filter(t => ACTIVE_STATUSES.has(t.status))

    return {
      agents: agents.map(toAgentDTO),
      activeTasks: activeTasks.map(toTaskDTO),
      recentEvents: recentEvents.map(toEventDTO),
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/adapters/presenters/LiveFloorPresenter.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/presenters/LiveFloorPresenter.ts tests/adapters/presenters/LiveFloorPresenter.test.ts
git commit -m "feat(phase3): add LiveFloorPresenter"
```

---

### Task 7: PipelinePresenter and MetricsPresenter

**Files:**
- Create: `src/adapters/presenters/PipelinePresenter.ts`
- Create: `src/adapters/presenters/MetricsPresenter.ts`
- Test: `tests/adapters/presenters/PipelinePresenter.test.ts`
- Test: `tests/adapters/presenters/MetricsPresenter.test.ts`

- [ ] **Step 1: Write failing test for PipelinePresenter**

```typescript
// tests/adapters/presenters/PipelinePresenter.test.ts
import { PipelinePresenter } from "../../../src/adapters/presenters/PipelinePresenter"
import { InMemoryTaskRepo } from "../../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryGoalRepo } from "../../../src/adapters/storage/InMemoryGoalRepo"
import { createTask } from "../../../src/entities/Task"
import { createGoal } from "../../../src/entities/Goal"
import { createBudget } from "../../../src/entities/Budget"
import { createTaskId, createGoalId } from "../../../src/entities/ids"

describe("PipelinePresenter", () => {
  let taskRepo: InMemoryTaskRepo
  let goalRepo: InMemoryGoalRepo
  let presenter: PipelinePresenter

  beforeEach(async () => {
    taskRepo = new InMemoryTaskRepo()
    goalRepo = new InMemoryGoalRepo()
    presenter = new PipelinePresenter(taskRepo, goalRepo, ["spec", "plan", "code", "test", "review"])

    await goalRepo.create(createGoal({
      id: createGoalId("g-1"), description: "Build feature",
      totalBudget: createBudget({ maxTokens: 50_000, maxCostUsd: 5 }),
      status: "active", taskIds: [createTaskId("t-1"), createTaskId("t-2")],
    }))

    await taskRepo.create(createTask({
      id: createTaskId("t-1"), goalId: createGoalId("g-1"),
      description: "Write spec", phase: "spec",
      budget: createBudget({ maxTokens: 5_000, maxCostUsd: 0.5 }),
      status: "merged",
    }))
    await taskRepo.create(createTask({
      id: createTaskId("t-2"), goalId: createGoalId("g-1"),
      description: "Create plan", phase: "plan",
      budget: createBudget({ maxTokens: 5_000, maxCostUsd: 0.5 }),
      status: "in_progress",
    }))
  })

  it("groups tasks by phase", async () => {
    const dto = await presenter.present()

    expect(dto.phases).toEqual(["spec", "plan", "code", "test", "review"])
    expect(dto.tasksByPhase["spec"]).toHaveLength(1)
    expect(dto.tasksByPhase["plan"]).toHaveLength(1)
    expect(dto.tasksByPhase["code"]).toHaveLength(0)
    expect(dto.goals).toHaveLength(1)
    expect(dto.goals[0].id).toBe("g-1")
  })
})
```

- [ ] **Step 2: Write failing test for MetricsPresenter**

```typescript
// tests/adapters/presenters/MetricsPresenter.test.ts
import { MetricsPresenter } from "../../../src/adapters/presenters/MetricsPresenter"
import { InMemoryTaskRepo } from "../../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryEventStore } from "../../../src/adapters/storage/InMemoryEventStore"
import { createTask } from "../../../src/entities/Task"
import { createBudget } from "../../../src/entities/Budget"
import { createTaskId, createGoalId, createEventId, createAgentId } from "../../../src/entities/ids"
import type { SystemEvent } from "../../../src/entities/Event"

describe("MetricsPresenter", () => {
  let taskRepo: InMemoryTaskRepo
  let eventStore: InMemoryEventStore
  let presenter: MetricsPresenter

  beforeEach(async () => {
    taskRepo = new InMemoryTaskRepo()
    eventStore = new InMemoryEventStore()
    presenter = new MetricsPresenter(taskRepo, eventStore)

    await taskRepo.create(createTask({
      id: createTaskId("t-1"), goalId: createGoalId("g-1"),
      description: "A", phase: "code",
      budget: createBudget({ maxTokens: 10_000, maxCostUsd: 1 }),
      status: "in_progress", tokensUsed: 3_000,
    }))
    await taskRepo.create(createTask({
      id: createTaskId("t-2"), goalId: createGoalId("g-1"),
      description: "B", phase: "review",
      budget: createBudget({ maxTokens: 5_000, maxCostUsd: 0.5 }),
      status: "merged", tokensUsed: 2_000,
    }))

    const event: SystemEvent = {
      id: createEventId(), type: "task.completed",
      agentId: createAgentId("dev-1"), taskId: createTaskId("t-1"),
      goalId: createGoalId("g-1"),
      cost: { inputTokens: 1_000, outputTokens: 500, totalTokens: 1_500, estimatedCostUsd: 0.05 },
      occurredAt: new Date(), payload: null,
    }
    await eventStore.append(event)
  })

  it("computes metrics summary", async () => {
    const dto = await presenter.present()

    expect(dto.totalTokensUsed).toBe(5_000) // 3000 + 2000
    expect(dto.activeTaskCount).toBe(1) // only in_progress
    expect(dto.completedTaskCount).toBe(1) // merged
    expect(dto.totalCostUsd).toBeCloseTo(0.05)
    expect(dto.agentTokenBreakdown["dev-1"]).toBe(1_500)
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx jest tests/adapters/presenters/PipelinePresenter.test.ts tests/adapters/presenters/MetricsPresenter.test.ts --no-coverage`
Expected: FAIL — modules not found

- [ ] **Step 4: Implement PipelinePresenter**

```typescript
// src/adapters/presenters/PipelinePresenter.ts
import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import type { GoalRepository } from "../../use-cases/ports/GoalRepository"
import type { PipelineDTO } from "./dto"
import { toTaskDTO, toGoalDTO } from "./mappers"

export class PipelinePresenter {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly goals: GoalRepository,
    private readonly phases: readonly string[],
  ) {}

  async present(): Promise<PipelineDTO> {
    const [allTasks, allGoals] = await Promise.all([
      this.tasks.findAll(),
      this.goals.findAll(),
    ])

    const tasksByPhase: Record<string, ReturnType<typeof toTaskDTO>[]> = {}
    for (const phase of this.phases) {
      tasksByPhase[phase] = []
    }

    for (const task of allTasks) {
      if (tasksByPhase[task.phase]) {
        tasksByPhase[task.phase].push(toTaskDTO(task))
      }
    }

    return {
      phases: this.phases,
      tasksByPhase,
      goals: allGoals.map(toGoalDTO),
    }
  }
}
```

- [ ] **Step 5: Implement MetricsPresenter**

```typescript
// src/adapters/presenters/MetricsPresenter.ts
import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import type { EventStore } from "../../use-cases/ports/EventStore"
import type { MetricsSummaryDTO } from "./dto"

export class MetricsPresenter {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly events: EventStore,
  ) {}

  async present(): Promise<MetricsSummaryDTO> {
    const [allTasks, allEvents] = await Promise.all([
      this.tasks.findAll(),
      this.events.findAll(),
    ])

    let totalTokensUsed = 0
    let totalCostUsd = 0
    let activeTaskCount = 0
    let completedTaskCount = 0

    for (const task of allTasks) {
      totalTokensUsed += task.tokensUsed
      if (task.status === "in_progress" || task.status === "review") {
        activeTaskCount++
      }
      if (task.status === "merged") {
        completedTaskCount++
      }
    }

    const agentTokenBreakdown: Record<string, number> = {}
    for (const event of allEvents) {
      if (event.cost) {
        totalCostUsd += event.cost.estimatedCostUsd
        if (event.agentId) {
          const key = event.agentId as string
          agentTokenBreakdown[key] = (agentTokenBreakdown[key] ?? 0) + event.cost.totalTokens
        }
      }
    }

    return {
      totalTokensUsed,
      totalCostUsd,
      activeTaskCount,
      completedTaskCount,
      agentTokenBreakdown,
    }
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest tests/adapters/presenters/ --no-coverage`
Expected: All presenter tests PASS

- [ ] **Step 7: Run full test suite**

Run: `npx jest --no-coverage`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/adapters/presenters/PipelinePresenter.ts src/adapters/presenters/MetricsPresenter.ts tests/adapters/presenters/PipelinePresenter.test.ts tests/adapters/presenters/MetricsPresenter.test.ts
git commit -m "feat(phase3): add PipelinePresenter and MetricsPresenter"
```

---

### Task 8: Update use-cases/index.ts and ports/index.ts exports

**Files:**
- Modify: `src/use-cases/index.ts`
- Modify: `src/use-cases/ports/index.ts`

- [ ] **Step 1: Add new use case exports**

Add to `src/use-cases/index.ts`:
```typescript
export { CreateGoalFromCeo } from "./CreateGoalFromCeo"
export type { CreateGoalInput } from "./CreateGoalFromCeo"
export { PauseAgent } from "./PauseAgent"
```

- [ ] **Step 2: Add EventQueryOptions export to ports/index.ts**

Add to `src/use-cases/ports/index.ts`:
```typescript
export type { EventQueryOptions } from "./EventStore"
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/use-cases/index.ts src/use-cases/ports/index.ts
git commit -m "chore(phase3): export new use cases and port types"
```

---

## Batch 2: HTTP API + SSE

### Task 9: Install Express dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install express and types**

Run: `npm install express cors && npm install --save-dev @types/express @types/cors`
Expected: Packages added to package.json

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(phase3): add express and cors dependencies"
```

---

### Task 10: SSE connection manager

**Files:**
- Create: `src/infrastructure/http/sseManager.ts`
- Test: `tests/infrastructure/http/sseManager.test.ts`

- [ ] **Step 1: Write failing test**

```typescript
// tests/infrastructure/http/sseManager.test.ts
import { SSEManager } from "../../../src/infrastructure/http/sseManager"
import { InMemoryBus } from "../../../src/adapters/messaging/InMemoryBus"
import { createMessageId, createGoalId } from "../../../src/entities/ids"
import type { EventEmitter } from "node:events"

// Minimal mock for ServerResponse
function createMockResponse(): {
  written: string[]
  headersSent: boolean
  writeHead: jest.Mock
  write: jest.Mock
  on: jest.Mock
  onClose: (() => void) | null
} {
  const mock = {
    written: [] as string[],
    headersSent: false,
    writeHead: jest.fn(() => { mock.headersSent = true }),
    write: jest.fn((data: string) => { mock.written.push(data) }),
    on: jest.fn((event: string, cb: () => void) => {
      if (event === "close") mock.onClose = cb
    }),
    onClose: null as (() => void) | null,
  }
  return mock
}

describe("SSEManager", () => {
  let bus: InMemoryBus
  let manager: SSEManager

  beforeEach(() => {
    bus = new InMemoryBus()
    manager = new SSEManager(bus)
  })

  afterEach(() => {
    manager.shutdown()
  })

  it("sends SSE-formatted data to connected clients on bus message", async () => {
    const res = createMockResponse()
    manager.addClient(res as any)

    await bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId: createGoalId("g-1"),
      description: "Test goal",
      timestamp: new Date(),
    })

    expect(res.written.length).toBeGreaterThan(0)
    const data = res.written.find(w => w.startsWith("data:"))
    expect(data).toBeDefined()
    const parsed = JSON.parse(data!.replace("data:", "").trim())
    expect(parsed.type).toBe("goal.created")
  })

  it("removes client on close", async () => {
    const res = createMockResponse()
    manager.addClient(res as any)

    expect(manager.clientCount).toBe(1)
    res.onClose!()
    expect(manager.clientCount).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/infrastructure/http/sseManager.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 3: Implement SSEManager**

```typescript
// src/infrastructure/http/sseManager.ts
import type { Response } from "express"
import type { MessagePort, Unsubscribe } from "../../use-cases/ports/MessagePort"
import type { Message } from "../../entities/Message"

export class SSEManager {
  private readonly clients = new Set<Response>()
  private readonly unsubscribe: Unsubscribe

  constructor(bus: MessagePort) {
    this.unsubscribe = bus.subscribe({}, async (message: Message) => {
      this.broadcast(message)
    })
  }

  addClient(res: Response): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    })

    this.clients.add(res)

    res.on("close", () => {
      this.clients.delete(res)
    })
  }

  get clientCount(): number {
    return this.clients.size
  }

  shutdown(): void {
    this.unsubscribe()
    this.clients.clear()
  }

  private broadcast(message: Message): void {
    const data = JSON.stringify({
      type: message.type,
      timestamp: message.timestamp.toISOString(),
      ...this.extractFields(message),
    })

    for (const client of this.clients) {
      client.write(`data:${data}\n\n`)
    }
  }

  private extractFields(message: Message): Record<string, unknown> {
    const fields: Record<string, unknown> = {}
    if ("goalId" in message) fields["goalId"] = message.goalId
    if ("taskId" in message) fields["taskId"] = message.taskId
    if ("agentId" in message) fields["agentId"] = message.agentId
    if ("description" in message) fields["description"] = message.description
    if ("reason" in message) fields["reason"] = message.reason
    if ("branch" in message) fields["branch"] = message.branch
    return fields
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/infrastructure/http/sseManager.test.ts --no-coverage`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/http/sseManager.ts tests/infrastructure/http/sseManager.test.ts
git commit -m "feat(phase3): add SSE connection manager"
```

---

### Task 11: Express server with all API routes

**Files:**
- Create: `src/infrastructure/http/routes/agentRoutes.ts`
- Create: `src/infrastructure/http/routes/goalRoutes.ts`
- Create: `src/infrastructure/http/routes/taskRoutes.ts`
- Create: `src/infrastructure/http/routes/eventRoutes.ts`
- Create: `src/infrastructure/http/routes/metricsRoutes.ts`
- Create: `src/infrastructure/http/createServer.ts`
- Test: `tests/infrastructure/http/routes.test.ts`

- [ ] **Step 1: Write failing test for API routes**

```typescript
// tests/infrastructure/http/routes.test.ts
import request from "supertest"
import { createServer } from "../../../src/infrastructure/http/createServer"
import { buildSystem, type DevFleetSystem } from "../../../src/infrastructure/config/composition-root"
import { createGoal } from "../../../src/entities/Goal"
import { createTask } from "../../../src/entities/Task"
import { createBudget } from "../../../src/entities/Budget"
import { createGoalId, createTaskId, createMessageId } from "../../../src/entities/ids"
import type { Express } from "express"

describe("API routes", () => {
  let system: DevFleetSystem
  let app: Express

  beforeEach(async () => {
    system = await buildSystem({ workspaceDir: "/tmp/test" })
    app = createServer(system)
    await system.start()
  })

  afterEach(async () => {
    await system.stop()
  })

  describe("GET /api/health", () => {
    it("returns 200 with status ok", async () => {
      const res = await request(app).get("/api/health")
      expect(res.status).toBe(200)
      expect(res.body.status).toBe("ok")
    })
  })

  describe("GET /api/agents", () => {
    it("returns all registered agents", async () => {
      const res = await request(app).get("/api/agents")
      expect(res.status).toBe(200)
      expect(res.body.agents).toBeInstanceOf(Array)
      expect(res.body.agents.length).toBe(7) // 7 agents from composition root
    })
  })

  describe("GET /api/goals", () => {
    it("returns all goals", async () => {
      await system.goalRepo.create(createGoal({
        id: createGoalId("g-1"), description: "Test",
        totalBudget: createBudget({ maxTokens: 1000, maxCostUsd: 1 }),
      }))

      const res = await request(app).get("/api/goals")
      expect(res.status).toBe(200)
      expect(res.body.goals).toHaveLength(1)
      expect(res.body.goals[0].id).toBe("g-1")
    })
  })

  describe("POST /api/goals", () => {
    it("creates a goal and returns it", async () => {
      const res = await request(app)
        .post("/api/goals")
        .send({ description: "Build login page", maxTokens: 50000, maxCostUsd: 5 })

      expect(res.status).toBe(201)
      expect(res.body.goal.description).toBe("Build login page")
      expect(res.body.goal.status).toBe("active")
    })

    it("returns 400 for empty description", async () => {
      const res = await request(app)
        .post("/api/goals")
        .send({ description: "", maxTokens: 50000, maxCostUsd: 5 })

      expect(res.status).toBe(400)
    })
  })

  describe("GET /api/tasks", () => {
    it("returns all tasks", async () => {
      await system.taskRepo.create(createTask({
        id: createTaskId("t-1"), goalId: createGoalId("g-1"),
        description: "A task", phase: "code",
        budget: createBudget({ maxTokens: 5000, maxCostUsd: 0.5 }),
      }))

      const res = await request(app).get("/api/tasks")
      expect(res.status).toBe(200)
      expect(res.body.tasks).toHaveLength(1)
    })
  })

  describe("GET /api/metrics", () => {
    it("returns metrics summary", async () => {
      const res = await request(app).get("/api/metrics")
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("totalTokensUsed")
      expect(res.body).toHaveProperty("activeTaskCount")
    })
  })

  describe("GET /api/live-floor", () => {
    it("returns live floor data", async () => {
      const res = await request(app).get("/api/live-floor")
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("agents")
      expect(res.body).toHaveProperty("activeTasks")
      expect(res.body).toHaveProperty("recentEvents")
    })
  })

  describe("GET /api/pipeline", () => {
    it("returns pipeline data with phases", async () => {
      const res = await request(app).get("/api/pipeline")
      expect(res.status).toBe(200)
      expect(res.body.phases).toEqual(["spec", "plan", "code", "test", "review"])
      expect(res.body).toHaveProperty("tasksByPhase")
    })
  })
})
```

- [ ] **Step 2: Install supertest**

Run: `npm install --save-dev supertest @types/supertest`

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/infrastructure/http/routes.test.ts --no-coverage`
Expected: FAIL — module not found

- [ ] **Step 4: Implement route modules**

```typescript
// src/infrastructure/http/routes/agentRoutes.ts
import { Router } from "express"
import type { AgentRegistry } from "../../../use-cases/ports/AgentRegistry"
import type { PauseAgent } from "../../../use-cases/PauseAgent"
import { toAgentDTO } from "../../../adapters/presenters/mappers"
import type { AgentId } from "../../../entities/ids"

export function agentRoutes(agents: AgentRegistry, pauseAgent: PauseAgent): Router {
  const router = Router()

  router.get("/", async (_req, res) => {
    const all = await agents.findAll()
    res.json({ agents: all.map(toAgentDTO) })
  })

  router.post("/:id/pause", async (req, res) => {
    const result = await pauseAgent.execute(
      req.params["id"] as AgentId,
      (req.body as { reason?: string }).reason ?? "CEO pause",
    )
    if (!result.ok) {
      res.status(404).json({ error: result.error })
      return
    }
    res.json({ status: "paused" })
  })

  router.post("/:id/resume", async (req, res) => {
    const result = await pauseAgent.resume(req.params["id"] as AgentId)
    if (!result.ok) {
      res.status(400).json({ error: result.error })
      return
    }
    res.json({ status: "resumed" })
  })

  return router
}
```

```typescript
// src/infrastructure/http/routes/goalRoutes.ts
import { Router } from "express"
import type { GoalRepository } from "../../../use-cases/ports/GoalRepository"
import type { CreateGoalFromCeo } from "../../../use-cases/CreateGoalFromCeo"
import { toGoalDTO } from "../../../adapters/presenters/mappers"

export function goalRoutes(goals: GoalRepository, createGoal: CreateGoalFromCeo): Router {
  const router = Router()

  router.get("/", async (_req, res) => {
    const all = await goals.findAll()
    res.json({ goals: all.map(toGoalDTO) })
  })

  router.post("/", async (req, res) => {
    const body = req.body as { description?: string; maxTokens?: number; maxCostUsd?: number }
    const result = await createGoal.execute({
      description: body.description ?? "",
      maxTokens: body.maxTokens ?? 100_000,
      maxCostUsd: body.maxCostUsd ?? 10,
    })

    if (!result.ok) {
      res.status(400).json({ error: result.error })
      return
    }

    res.status(201).json({ goal: toGoalDTO(result.value) })
  })

  return router
}
```

```typescript
// src/infrastructure/http/routes/taskRoutes.ts
import { Router } from "express"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import { toTaskDTO } from "../../../adapters/presenters/mappers"
import type { TaskId } from "../../../entities/ids"

export function taskRoutes(tasks: TaskRepository): Router {
  const router = Router()

  router.get("/", async (_req, res) => {
    const all = await tasks.findAll()
    res.json({ tasks: all.map(toTaskDTO) })
  })

  router.get("/:id", async (req, res) => {
    const task = await tasks.findById(req.params["id"] as TaskId)
    if (!task) {
      res.status(404).json({ error: "Task not found" })
      return
    }
    res.json({ task: toTaskDTO(task) })
  })

  return router
}
```

```typescript
// src/infrastructure/http/routes/eventRoutes.ts
import { Router } from "express"
import type { SSEManager } from "../sseManager"
import type { EventStore } from "../../../use-cases/ports/EventStore"
import { toEventDTO } from "../../../adapters/presenters/mappers"

export function eventRoutes(eventStore: EventStore, sseManager: SSEManager): Router {
  const router = Router()

  router.get("/", async (req, res) => {
    const limit = parseInt(req.query["limit"] as string) || 50
    const events = await eventStore.findRecent(limit)
    res.json({ events: events.map(toEventDTO) })
  })

  router.get("/stream", (req, res) => {
    sseManager.addClient(res)
  })

  return router
}
```

```typescript
// src/infrastructure/http/routes/metricsRoutes.ts
import { Router } from "express"
import type { MetricsPresenter } from "../../../adapters/presenters/MetricsPresenter"

export function metricsRoutes(presenter: MetricsPresenter): Router {
  const router = Router()

  router.get("/", async (_req, res) => {
    const metrics = await presenter.present()
    res.json(metrics)
  })

  return router
}
```

- [ ] **Step 5: Implement createServer**

```typescript
// src/infrastructure/http/createServer.ts
import express from "express"
import cors from "cors"
import type { DevFleetSystem } from "../config/composition-root"
import { SSEManager } from "./sseManager"
import { LiveFloorPresenter } from "../../adapters/presenters/LiveFloorPresenter"
import { PipelinePresenter } from "../../adapters/presenters/PipelinePresenter"
import { MetricsPresenter } from "../../adapters/presenters/MetricsPresenter"
import { CreateGoalFromCeo } from "../../use-cases/CreateGoalFromCeo"
import { PauseAgent } from "../../use-cases/PauseAgent"
import { agentRoutes } from "./routes/agentRoutes"
import { goalRoutes } from "./routes/goalRoutes"
import { taskRoutes } from "./routes/taskRoutes"
import { eventRoutes } from "./routes/eventRoutes"
import { metricsRoutes } from "./routes/metricsRoutes"

export function createServer(system: DevFleetSystem): express.Express {
  const app = express()
  app.use(cors())
  app.use(express.json())

  // --- Use cases ---
  const createGoal = new CreateGoalFromCeo(system.goalRepo, system.bus)
  const pauseAgent = new PauseAgent(system.agentRegistry, system.bus)

  // --- Presenters ---
  const liveFloor = new LiveFloorPresenter(system.agentRegistry, system.taskRepo, system.eventStore)
  const pipeline = new PipelinePresenter(system.taskRepo, system.goalRepo, ["spec", "plan", "code", "test", "review"])
  const metrics = new MetricsPresenter(system.taskRepo, system.eventStore)

  // --- SSE ---
  const sseManager = new SSEManager(system.bus)

  // --- Routes ---
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" })
  })

  app.get("/api/live-floor", async (_req, res) => {
    const data = await liveFloor.present()
    res.json(data)
  })

  app.get("/api/pipeline", async (_req, res) => {
    const data = await pipeline.present()
    res.json(data)
  })

  app.use("/api/agents", agentRoutes(system.agentRegistry, pauseAgent))
  app.use("/api/goals", goalRoutes(system.goalRepo, createGoal))
  app.use("/api/tasks", taskRoutes(system.taskRepo))
  app.use("/api/events", eventRoutes(system.eventStore, sseManager))
  app.use("/api/metrics", metricsRoutes(metrics))

  return app
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest tests/infrastructure/http/routes.test.ts --no-coverage`
Expected: All route tests PASS

- [ ] **Step 7: Run full test suite**

Run: `npx jest --no-coverage`
Expected: All tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/infrastructure/http/ tests/infrastructure/http/
git commit -m "feat(phase3): add Express HTTP API server with all routes and SSE"
```

---

### Task 12: Wire HTTP server into composition root and CLI

**Files:**
- Modify: `src/infrastructure/config/composition-root.ts`
- Modify: `src/infrastructure/cli/index.ts`

- [ ] **Step 1: Add httpPort to DevFleetConfig**

In `src/infrastructure/config/composition-root.ts`, add to `DevFleetConfig`:

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
  readonly httpPort?: number
}
```

- [ ] **Step 2: Update CLI to start HTTP server**

Replace the CLI's `main()` function to also start the HTTP server:

In `src/infrastructure/cli/index.ts`, add after `await system.start()`:

```typescript
import { createServer } from "../http/createServer"
import * as http from "node:http"

// ... inside main(), after system.start():

const httpPort = parseInt(process.env["HTTP_PORT"] ?? "3100", 10)
const app = createServer(system)
const server = http.createServer(app)
server.listen(httpPort, () => {
  console.log(`Dashboard API running at http://localhost:${httpPort}`)
})
```

And in the `finally` block, add `server.close()` before `system.stop()`.

The full updated `main()`:

```typescript
async function main(): Promise<void> {
  console.log("DevFleet CLI — Phase 3 Dashboard + Real-Time")
  console.log("=============================================")

  if (!API_KEY) {
    console.log("(No ANTHROPIC_API_KEY set — using mock AI providers)")
  }

  const system = await buildSystem({
    workspaceDir: WORKSPACE_DIR,
    anthropicApiKey: API_KEY,
    developerModel: process.env["DEVELOPER_MODEL"] ?? "claude-3-5-sonnet-20241022",
    supervisorModel: process.env["SUPERVISOR_MODEL"] ?? "claude-3-5-sonnet-20241022",
    reviewerModel: process.env["REVIEWER_MODEL"] ?? "claude-3-5-sonnet-20241022",
    pipelineTimeoutMs: parseInt(process.env["PIPELINE_TIMEOUT_MS"] ?? "300000", 10),
    maxRetries: parseInt(process.env["MAX_RETRIES"] ?? "2", 10),
  })

  await system.start()

  // --- HTTP API server ---
  const httpPort = parseInt(process.env["HTTP_PORT"] ?? "3100", 10)
  const app = createServer(system)
  const server = http.createServer(app)
  server.listen(httpPort, () => {
    console.log(`Dashboard API running at http://localhost:${httpPort}`)
  })

  // ... (existing progress subscription and readline code unchanged) ...
```

Update the imports at the top of the file to include:
```typescript
import * as http from "node:http"
import { createServer } from "../http/createServer"
```

In the `finally` block:
```typescript
  } finally {
    rl.close()
    server.close()
    await system.stop()
  }
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run full test suite**

Run: `npx jest --no-coverage`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/config/composition-root.ts src/infrastructure/cli/index.ts
git commit -m "feat(phase3): wire HTTP server into composition root and CLI"
```

---

## Batch 3: Dashboard Shell

### Task 13: Initialize Next.js project

**Files:**
- Create: `dashboard/` directory with Next.js boilerplate

- [ ] **Step 1: Scaffold Next.js project**

Run from repo root:
```bash
npx create-next-app@latest dashboard --typescript --tailwind --eslint --app --src-dir --no-import-alias --use-npm
```

Answer prompts: Yes to all defaults.

- [ ] **Step 2: Install additional dependencies**

```bash
cd dashboard && npm install zustand && cd ..
```

- [ ] **Step 3: Add API proxy rewrite to next.config.ts**

```typescript
// dashboard/next.config.ts
import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3100/api/:path*",
      },
    ]
  },
}

export default nextConfig
```

- [ ] **Step 4: Verify dashboard builds**

Run: `cd dashboard && npm run build && cd ..`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add dashboard/
git commit -m "feat(phase3): scaffold Next.js dashboard project"
```

---

### Task 14: Dashboard layout with sidebar navigation

**Files:**
- Modify: `dashboard/src/app/layout.tsx`
- Modify: `dashboard/src/app/globals.css`
- Create: `dashboard/src/components/ui/nav-link.tsx`

- [ ] **Step 1: Create NavLink component**

```typescript
// dashboard/src/components/ui/nav-link.tsx
"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

interface NavLinkProps {
  href: string
  label: string
}

export function NavLink({ href, label }: NavLinkProps) {
  const pathname = usePathname()
  const isActive = pathname === href

  return (
    <Link
      href={href}
      className={`block px-4 py-2 rounded-md text-sm font-medium transition-colors ${
        isActive
          ? "bg-zinc-800 text-white"
          : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
      }`}
    >
      {label}
    </Link>
  )
}
```

- [ ] **Step 2: Update global styles**

Replace `dashboard/src/app/globals.css` with:

```css
@import "tailwindcss";

body {
  background-color: #09090b;
  color: #fafafa;
}
```

- [ ] **Step 3: Update root layout**

```typescript
// dashboard/src/app/layout.tsx
import type { Metadata } from "next"
import "./globals.css"
import { NavLink } from "@/components/ui/nav-link"

export const metadata: Metadata = {
  title: "DevFleet Dashboard",
  description: "Agentic Development Platform — CEO Dashboard",
}

const NAV_ITEMS = [
  { href: "/", label: "Live Floor" },
  { href: "/pipeline", label: "Pipeline" },
]

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="flex h-screen overflow-hidden">
        <aside className="w-56 border-r border-zinc-800 bg-zinc-950 p-4 flex flex-col gap-1">
          <h1 className="text-lg font-bold text-white mb-6 px-4">DevFleet</h1>
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map((item) => (
              <NavLink key={item.href} href={item.href} label={item.label} />
            ))}
          </nav>
        </aside>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </body>
    </html>
  )
}
```

- [ ] **Step 4: Verify dashboard builds**

Run: `cd dashboard && npm run build && cd ..`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/app/layout.tsx dashboard/src/app/globals.css dashboard/src/components/ui/nav-link.tsx
git commit -m "feat(phase3): add dashboard layout with sidebar navigation"
```

---

### Task 15: API client, DTO types, Zustand store, SSE hook

**Files:**
- Create: `dashboard/src/lib/types.ts`
- Create: `dashboard/src/lib/api.ts`
- Create: `dashboard/src/lib/store.ts`
- Create: `dashboard/src/lib/useSSE.ts`

- [ ] **Step 1: Define DTO types (mirror of backend)**

```typescript
// dashboard/src/lib/types.ts
export interface AgentDTO {
  readonly id: string
  readonly role: string
  readonly status: string
  readonly currentTaskId: string | null
  readonly model: string
  readonly lastActiveAt: string
}

export interface TaskDTO {
  readonly id: string
  readonly goalId: string
  readonly description: string
  readonly status: string
  readonly phase: string
  readonly assignedTo: string | null
  readonly tokensUsed: number
  readonly budget: BudgetDTO
  readonly retryCount: number
  readonly branch: string | null
}

export interface BudgetDTO {
  readonly maxTokens: number
  readonly maxCostUsd: number
  readonly remaining: number
}

export interface GoalDTO {
  readonly id: string
  readonly description: string
  readonly status: string
  readonly createdAt: string
  readonly completedAt: string | null
  readonly taskCount: number
  readonly totalBudget: BudgetDTO
}

export interface EventDTO {
  readonly id: string
  readonly type: string
  readonly agentId: string | null
  readonly taskId: string | null
  readonly goalId: string | null
  readonly occurredAt: string
}

export interface LiveFloorData {
  readonly agents: readonly AgentDTO[]
  readonly activeTasks: readonly TaskDTO[]
  readonly recentEvents: readonly EventDTO[]
}

export interface PipelineData {
  readonly phases: readonly string[]
  readonly tasksByPhase: Record<string, readonly TaskDTO[]>
  readonly goals: readonly GoalDTO[]
}

export interface MetricsSummary {
  readonly totalTokensUsed: number
  readonly totalCostUsd: number
  readonly activeTaskCount: number
  readonly completedTaskCount: number
  readonly agentTokenBreakdown: Record<string, number>
}

export interface SSEEvent {
  readonly type: string
  readonly timestamp: string
  readonly goalId?: string
  readonly taskId?: string
  readonly agentId?: string
  readonly description?: string
  readonly reason?: string
  readonly branch?: string
}
```

- [ ] **Step 2: Create API client**

```typescript
// dashboard/src/lib/api.ts
import type { LiveFloorData, PipelineData, MetricsSummary, GoalDTO } from "./types"

const BASE = "/api"

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status} ${res.statusText}`)
  return res.json() as Promise<T>
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error((err as { error: string }).error)
  }
  return res.json() as Promise<T>
}

export const api = {
  liveFloor: () => get<LiveFloorData>("/live-floor"),
  pipeline: () => get<PipelineData>("/pipeline"),
  metrics: () => get<MetricsSummary>("/metrics"),
  createGoal: (input: { description: string; maxTokens: number; maxCostUsd: number }) =>
    post<{ goal: GoalDTO }>("/goals", input),
  pauseAgent: (agentId: string, reason: string) =>
    post<{ status: string }>(`/agents/${agentId}/pause`, { reason }),
  resumeAgent: (agentId: string) =>
    post<{ status: string }>(`/agents/${agentId}/resume`, {}),
}
```

- [ ] **Step 3: Create Zustand store**

```typescript
// dashboard/src/lib/store.ts
import { create } from "zustand"
import type { AgentDTO, TaskDTO, EventDTO, GoalDTO, MetricsSummary, SSEEvent } from "./types"
import { api } from "./api"

interface DashboardState {
  agents: readonly AgentDTO[]
  activeTasks: readonly TaskDTO[]
  goals: readonly GoalDTO[]
  recentEvents: readonly EventDTO[]
  metrics: MetricsSummary | null
  phases: readonly string[]
  tasksByPhase: Record<string, readonly TaskDTO[]>

  // Actions
  fetchLiveFloor: () => Promise<void>
  fetchPipeline: () => Promise<void>
  fetchMetrics: () => Promise<void>
  handleSSEEvent: (event: SSEEvent) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  agents: [],
  activeTasks: [],
  goals: [],
  recentEvents: [],
  metrics: null,
  phases: [],
  tasksByPhase: {},

  fetchLiveFloor: async () => {
    const data = await api.liveFloor()
    set({
      agents: data.agents,
      activeTasks: data.activeTasks,
      recentEvents: data.recentEvents,
    })
  },

  fetchPipeline: async () => {
    const data = await api.pipeline()
    set({
      phases: data.phases,
      tasksByPhase: data.tasksByPhase,
      goals: data.goals,
    })
  },

  fetchMetrics: async () => {
    const metrics = await api.metrics()
    set({ metrics })
  },

  handleSSEEvent: (event: SSEEvent) => {
    set((state) => ({
      recentEvents: [
        { id: crypto.randomUUID(), type: event.type, agentId: event.agentId ?? null, taskId: event.taskId ?? null, goalId: event.goalId ?? null, occurredAt: event.timestamp },
        ...state.recentEvents.slice(0, 49),
      ],
    }))
  },
}))
```

- [ ] **Step 4: Create SSE hook**

```typescript
// dashboard/src/lib/useSSE.ts
"use client"

import { useEffect, useRef } from "react"
import { useDashboardStore } from "./store"
import type { SSEEvent } from "./types"

export function useSSE() {
  const handleSSEEvent = useDashboardStore((s) => s.handleSSEEvent)
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)
  const fetchMetrics = useDashboardStore((s) => s.fetchMetrics)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const source = new EventSource("/api/events/stream")
    sourceRef.current = source

    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as SSEEvent
      handleSSEEvent(data)

      // Refresh full state on significant events
      const refreshTypes = new Set([
        "goal.created", "goal.completed", "goal.abandoned",
        "task.created", "task.assigned", "task.completed", "task.failed",
        "review.approved", "review.rejected",
        "branch.merged", "branch.discarded",
      ])

      if (refreshTypes.has(data.type)) {
        void fetchLiveFloor()
        void fetchPipeline()
        void fetchMetrics()
      }
    }

    source.onerror = () => {
      // EventSource auto-reconnects
    }

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [handleSSEEvent, fetchLiveFloor, fetchPipeline, fetchMetrics])
}
```

- [ ] **Step 5: Verify dashboard builds**

Run: `cd dashboard && npm run build && cd ..`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/lib/
git commit -m "feat(phase3): add API client, Zustand store, SSE hook, DTO types"
```

---

### Task 16: Shared UI components — StatusBadge

**Files:**
- Create: `dashboard/src/components/ui/status-badge.tsx`

- [ ] **Step 1: Create StatusBadge component**

```typescript
// dashboard/src/components/ui/status-badge.tsx
const STATUS_COLORS: Record<string, string> = {
  idle: "bg-zinc-700 text-zinc-300",
  busy: "bg-blue-900 text-blue-300",
  blocked: "bg-yellow-900 text-yellow-300",
  paused: "bg-orange-900 text-orange-300",
  stopped: "bg-red-900 text-red-300",
  queued: "bg-zinc-700 text-zinc-300",
  in_progress: "bg-blue-900 text-blue-300",
  review: "bg-purple-900 text-purple-300",
  approved: "bg-green-900 text-green-300",
  merged: "bg-green-900 text-green-300",
  discarded: "bg-red-900 text-red-300",
  active: "bg-blue-900 text-blue-300",
  completed: "bg-green-900 text-green-300",
  abandoned: "bg-red-900 text-red-300",
  proposed: "bg-zinc-700 text-zinc-300",
}

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const colors = STATUS_COLORS[status] ?? "bg-zinc-700 text-zinc-300"

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
      {status.replace("_", " ")}
    </span>
  )
}
```

- [ ] **Step 2: Verify dashboard builds**

Run: `cd dashboard && npm run build && cd ..`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/ui/status-badge.tsx
git commit -m "feat(phase3): add StatusBadge component"
```

---

## Batch 4: Dashboard Pages

### Task 17: Live Floor page — agent cards and activity feed

**Files:**
- Create: `dashboard/src/components/live-floor/agent-card.tsx`
- Create: `dashboard/src/components/live-floor/activity-feed.tsx`
- Create: `dashboard/src/components/metrics/metrics-panel.tsx`
- Modify: `dashboard/src/app/page.tsx`

- [ ] **Step 1: Create AgentCard component**

```typescript
// dashboard/src/components/live-floor/agent-card.tsx
import type { AgentDTO } from "@/lib/types"
import { StatusBadge } from "@/components/ui/status-badge"
import { api } from "@/lib/api"
import { useDashboardStore } from "@/lib/store"

interface AgentCardProps {
  agent: AgentDTO
}

export function AgentCard({ agent }: AgentCardProps) {
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)

  const handlePause = async () => {
    await api.pauseAgent(agent.id, "Manual pause from dashboard")
    await fetchLiveFloor()
  }

  const handleResume = async () => {
    await api.resumeAgent(agent.id)
    await fetchLiveFloor()
  }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white capitalize">{agent.role}</h3>
        <StatusBadge status={agent.status} />
      </div>
      <p className="text-xs text-zinc-500 mb-1">ID: {agent.id}</p>
      <p className="text-xs text-zinc-500 mb-1">Model: {agent.model}</p>
      {agent.currentTaskId && (
        <p className="text-xs text-zinc-400 mb-2">Task: {agent.currentTaskId}</p>
      )}
      <div className="flex gap-2 mt-3">
        {agent.status !== "paused" && agent.status !== "idle" && agent.status !== "stopped" && (
          <button
            onClick={handlePause}
            className="px-2 py-1 text-xs rounded bg-orange-900/50 text-orange-300 hover:bg-orange-900"
          >
            Pause
          </button>
        )}
        {agent.status === "paused" && (
          <button
            onClick={handleResume}
            className="px-2 py-1 text-xs rounded bg-green-900/50 text-green-300 hover:bg-green-900"
          >
            Resume
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create ActivityFeed component**

```typescript
// dashboard/src/components/live-floor/activity-feed.tsx
import type { EventDTO } from "@/lib/types"

interface ActivityFeedProps {
  events: readonly EventDTO[]
}

export function ActivityFeed({ events }: ActivityFeedProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Activity Feed</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {events.length === 0 && (
          <p className="text-xs text-zinc-500">No events yet</p>
        )}
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-2 text-xs">
            <span className="text-zinc-500 whitespace-nowrap">
              {new Date(event.occurredAt).toLocaleTimeString()}
            </span>
            <span className="text-zinc-300 font-mono">{event.type}</span>
            {event.taskId && <span className="text-zinc-500">task:{event.taskId.slice(0, 8)}</span>}
            {event.agentId && <span className="text-zinc-500">{event.agentId}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create MetricsPanel component**

```typescript
// dashboard/src/components/metrics/metrics-panel.tsx
import type { MetricsSummary } from "@/lib/types"

interface MetricsPanelProps {
  metrics: MetricsSummary | null
}

export function MetricsPanel({ metrics }: MetricsPanelProps) {
  if (!metrics) return null

  const cards = [
    { label: "Active Tasks", value: metrics.activeTaskCount },
    { label: "Completed", value: metrics.completedTaskCount },
    { label: "Total Tokens", value: metrics.totalTokensUsed.toLocaleString() },
    { label: "Total Cost", value: `$${metrics.totalCostUsd.toFixed(4)}` },
  ]

  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500 mb-1">{card.label}</p>
          <p className="text-xl font-bold text-white">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Wire Live Floor page**

```typescript
// dashboard/src/app/page.tsx
"use client"

import { useEffect } from "react"
import { useDashboardStore } from "@/lib/store"
import { useSSE } from "@/lib/useSSE"
import { AgentCard } from "@/components/live-floor/agent-card"
import { ActivityFeed } from "@/components/live-floor/activity-feed"
import { MetricsPanel } from "@/components/metrics/metrics-panel"
import { CreateGoalForm } from "@/components/ceo/create-goal-form"

export default function LiveFloorPage() {
  const { agents, activeTasks, recentEvents, metrics, fetchLiveFloor, fetchMetrics } = useDashboardStore()

  useSSE()

  useEffect(() => {
    void fetchLiveFloor()
    void fetchMetrics()
    const interval = setInterval(() => {
      void fetchLiveFloor()
      void fetchMetrics()
    }, 10_000)
    return () => clearInterval(interval)
  }, [fetchLiveFloor, fetchMetrics])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Live Floor</h2>

      <MetricsPanel metrics={metrics} />

      <CreateGoalForm />

      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Agents</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent) => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Active Tasks ({activeTasks.length})</h3>
          <div className="space-y-2">
            {activeTasks.map((task) => (
              <div key={task.id} className="rounded border border-zinc-800 bg-zinc-900 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white">{task.description}</span>
                  <span className="text-xs text-zinc-500">{task.phase} / {task.status}</span>
                </div>
                {task.assignedTo && <p className="text-xs text-zinc-500 mt-1">Assigned: {task.assignedTo}</p>}
              </div>
            ))}
            {activeTasks.length === 0 && <p className="text-sm text-zinc-500">No active tasks</p>}
          </div>
        </div>

        <ActivityFeed events={recentEvents} />
      </div>
    </div>
  )
}
```

Note: This references `CreateGoalForm` which is created in the next task. Create a placeholder for now or implement Task 18 first.

- [ ] **Step 5: Verify dashboard builds**

Run: `cd dashboard && npm run build && cd ..`
Expected: Build succeeds (may need placeholder for CreateGoalForm — create an empty export in Step 4 if needed)

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/components/live-floor/ dashboard/src/components/metrics/ dashboard/src/app/page.tsx
git commit -m "feat(phase3): add Live Floor page with agent cards, activity feed, metrics"
```

---

### Task 18: CEO interaction — create goal form and agent controls

**Files:**
- Create: `dashboard/src/components/ceo/create-goal-form.tsx`
- Create: `dashboard/src/components/ceo/agent-controls.tsx`

- [ ] **Step 1: Create goal form**

```typescript
// dashboard/src/components/ceo/create-goal-form.tsx
"use client"

import { useState } from "react"
import { api } from "@/lib/api"
import { useDashboardStore } from "@/lib/store"

export function CreateGoalForm() {
  const [description, setDescription] = useState("")
  const [maxTokens, setMaxTokens] = useState(100_000)
  const [maxCostUsd, setMaxCostUsd] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      await api.createGoal({ description, maxTokens, maxCostUsd })
      setDescription("")
      await fetchLiveFloor()
      await fetchPipeline()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create goal")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Create Goal</h3>
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your goal..."
            className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div className="w-32">
          <label className="text-xs text-zinc-500 block mb-1">Max tokens</label>
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => setMaxTokens(Number(e.target.value))}
            className="w-full px-2 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-zinc-500"
          />
        </div>
        <div className="w-24">
          <label className="text-xs text-zinc-500 block mb-1">Max $ USD</label>
          <input
            type="number"
            step="0.01"
            value={maxCostUsd}
            onChange={(e) => setMaxCostUsd(Number(e.target.value))}
            className="w-full px-2 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-zinc-500"
          />
        </div>
        <button
          type="submit"
          disabled={submitting || !description.trim()}
          className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? "Creating..." : "Create"}
        </button>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </form>
  )
}
```

- [ ] **Step 2: Verify dashboard builds**

Run: `cd dashboard && npm run build && cd ..`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/ceo/
git commit -m "feat(phase3): add CEO goal creation form"
```

---

### Task 19: Pipeline page — kanban board

**Files:**
- Create: `dashboard/src/components/pipeline/task-card.tsx`
- Create: `dashboard/src/components/pipeline/kanban-board.tsx`
- Create: `dashboard/src/app/pipeline/page.tsx`

- [ ] **Step 1: Create TaskCard component**

```typescript
// dashboard/src/components/pipeline/task-card.tsx
import type { TaskDTO } from "@/lib/types"
import { StatusBadge } from "@/components/ui/status-badge"

interface TaskCardProps {
  task: TaskDTO
}

export function TaskCard({ task }: TaskCardProps) {
  const budgetPct = task.budget.maxTokens > 0
    ? Math.round((task.tokensUsed / task.budget.maxTokens) * 100)
    : 0

  return (
    <div className="rounded border border-zinc-700 bg-zinc-800 p-3 text-sm">
      <div className="flex items-start justify-between mb-1">
        <p className="text-white text-xs font-medium leading-tight">{task.description}</p>
        <StatusBadge status={task.status} />
      </div>
      {task.assignedTo && (
        <p className="text-xs text-zinc-500 mt-1">{task.assignedTo}</p>
      )}
      <div className="mt-2">
        <div className="flex justify-between text-xs text-zinc-500 mb-1">
          <span>Budget</span>
          <span>{budgetPct}%</span>
        </div>
        <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full ${budgetPct > 80 ? "bg-red-500" : budgetPct > 50 ? "bg-yellow-500" : "bg-green-500"}`}
            style={{ width: `${Math.min(budgetPct, 100)}%` }}
          />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create KanbanBoard component**

```typescript
// dashboard/src/components/pipeline/kanban-board.tsx
import type { TaskDTO } from "@/lib/types"
import { TaskCard } from "./task-card"

interface KanbanBoardProps {
  phases: readonly string[]
  tasksByPhase: Record<string, readonly TaskDTO[]>
}

export function KanbanBoard({ phases, tasksByPhase }: KanbanBoardProps) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {phases.map((phase) => {
        const tasks = tasksByPhase[phase] ?? []
        return (
          <div
            key={phase}
            className="flex-shrink-0 w-64 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
          >
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white capitalize">{phase}</h4>
              <span className="text-xs text-zinc-500">{tasks.length}</span>
            </div>
            <div className="space-y-2">
              {tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))}
              {tasks.length === 0 && (
                <p className="text-xs text-zinc-600 text-center py-4">Empty</p>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 3: Create Pipeline page**

```typescript
// dashboard/src/app/pipeline/page.tsx
"use client"

import { useEffect } from "react"
import { useDashboardStore } from "@/lib/store"
import { useSSE } from "@/lib/useSSE"
import { KanbanBoard } from "@/components/pipeline/kanban-board"

export default function PipelinePage() {
  const { phases, tasksByPhase, goals, fetchPipeline } = useDashboardStore()

  useSSE()

  useEffect(() => {
    void fetchPipeline()
    const interval = setInterval(() => { void fetchPipeline() }, 10_000)
    return () => clearInterval(interval)
  }, [fetchPipeline])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Pipeline</h2>

      <div className="flex gap-4 text-sm text-zinc-400">
        <span>Goals: {goals.length}</span>
        <span>Active: {goals.filter(g => g.status === "active").length}</span>
      </div>

      <KanbanBoard phases={phases} tasksByPhase={tasksByPhase} />

      {goals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Goals</h3>
          <div className="space-y-2">
            {goals.map((goal) => (
              <div key={goal.id} className="rounded border border-zinc-800 bg-zinc-900 p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-white">{goal.description}</span>
                  <span className="text-xs text-zinc-500">{goal.status} — {goal.taskCount} tasks</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify dashboard builds**

Run: `cd dashboard && npm run build && cd ..`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/pipeline/ dashboard/src/app/pipeline/
git commit -m "feat(phase3): add Pipeline page with kanban board"
```

---

## Batch 5: Integration Test

### Task 20: Phase 3 API integration test

**Files:**
- Create: `tests/integration/phase3-api.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// tests/integration/phase3-api.test.ts
import request from "supertest"
import { createServer } from "../../src/infrastructure/http/createServer"
import { buildSystem, type DevFleetSystem } from "../../src/infrastructure/config/composition-root"
import type { Express } from "express"

describe("Phase 3 — API Integration", () => {
  let system: DevFleetSystem
  let app: Express

  beforeEach(async () => {
    system = await buildSystem({ workspaceDir: "/tmp/phase3-test" })
    app = createServer(system)
    await system.start()
  })

  afterEach(async () => {
    await system.stop()
  })

  it("full flow: create goal via API → verify agents → verify pipeline → verify metrics", async () => {
    // 1. Health check
    const health = await request(app).get("/api/health")
    expect(health.status).toBe(200)

    // 2. All 7 agents registered
    const agentsRes = await request(app).get("/api/agents")
    expect(agentsRes.body.agents).toHaveLength(7)
    const roles = agentsRes.body.agents.map((a: { role: string }) => a.role).sort()
    expect(roles).toEqual(["architect", "developer", "learner", "ops", "product", "reviewer", "supervisor"])

    // 3. Create goal via CEO endpoint
    const goalRes = await request(app)
      .post("/api/goals")
      .send({ description: "Build user auth", maxTokens: 100_000, maxCostUsd: 10 })
    expect(goalRes.status).toBe(201)
    expect(goalRes.body.goal.status).toBe("active")
    const goalId = goalRes.body.goal.id

    // 4. Goal appears in list
    const goalsRes = await request(app).get("/api/goals")
    expect(goalsRes.body.goals.some((g: { id: string }) => g.id === goalId)).toBe(true)

    // 5. Live floor shows agents
    const liveFloor = await request(app).get("/api/live-floor")
    expect(liveFloor.body.agents).toHaveLength(7)

    // 6. Pipeline shows phases
    const pipeline = await request(app).get("/api/pipeline")
    expect(pipeline.body.phases).toEqual(["spec", "plan", "code", "test", "review"])

    // 7. Metrics endpoint works
    const metrics = await request(app).get("/api/metrics")
    expect(metrics.body).toHaveProperty("totalTokensUsed")
    expect(metrics.body).toHaveProperty("activeTaskCount")
    expect(metrics.body).toHaveProperty("agentTokenBreakdown")

    // 8. Events endpoint works
    const events = await request(app).get("/api/events?limit=10")
    expect(events.body).toHaveProperty("events")

    // 9. Pause an agent
    const pauseRes = await request(app)
      .post("/api/agents/developer-1/pause")
      .send({ reason: "testing" })
    expect(pauseRes.status).toBe(200)

    // Verify agent is paused
    const agentsAfterPause = await request(app).get("/api/agents")
    const dev = agentsAfterPause.body.agents.find((a: { id: string }) => a.id === "developer-1")
    expect(dev.status).toBe("paused")

    // 10. Resume the agent
    const resumeRes = await request(app)
      .post("/api/agents/developer-1/resume")
      .send({})
    expect(resumeRes.status).toBe(200)

    const agentsAfterResume = await request(app).get("/api/agents")
    const devAfter = agentsAfterResume.body.agents.find((a: { id: string }) => a.id === "developer-1")
    expect(devAfter.status).toBe("idle")
  })

  it("SSE endpoint accepts connection and receives events", async () => {
    // Use a manual approach — connect to SSE, emit a message, check the data
    const ssePromise = new Promise<string>((resolve) => {
      const req = request(app)
        .get("/api/events/stream")
        .buffer(false)
        .parse((res, callback) => {
          let data = ""
          res.on("data", (chunk: Buffer) => {
            data += chunk.toString()
            if (data.includes("data:")) {
              res.destroy()
              callback(null, data)
            }
          })
          // Timeout after 2s — if no data, fail
          setTimeout(() => {
            res.destroy()
            callback(null, data)
          }, 2000)
        })
        .then((res) => resolve(res.body as string))
    })

    // Give SSE time to connect
    await new Promise(r => setTimeout(r, 100))

    // Emit a message through the bus
    const { createMessageId, createGoalId } = await import("../../src/entities/ids")
    await system.bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId: createGoalId("sse-test"),
      description: "SSE test goal",
      timestamp: new Date(),
    })

    const data = await ssePromise
    expect(data).toContain("goal.created")
  })
})
```

- [ ] **Step 2: Run integration test**

Run: `npx jest tests/integration/phase3-api.test.ts --no-coverage`
Expected: All tests PASS

- [ ] **Step 3: Run full test suite**

Run: `npx jest --no-coverage`
Expected: All tests PASS (including Phase 1 and Phase 2 tests)

- [ ] **Step 4: Verify TypeScript build**

Run: `npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add tests/integration/phase3-api.test.ts
git commit -m "feat(phase3): add API integration test"
```

---

## Stretch Goals (implement after core dashboard works)

**PostgreSQL EventStore Adapter:**
The spec calls for a PostgreSQL adapter for EventStore. The port interface is already extended with dashboard query methods (`findAll`, `findRecent`, `countAll`). Adding PostgreSQL is a clean adapter swap:
1. Add `prisma` to root `package.json`
2. Create `prisma/schema.prisma` with `SystemEvent` table
3. Run `npx prisma migrate dev`
4. Create `src/adapters/storage/PostgresEventStore.ts` implementing `EventStore`
5. Add a `storage` config option to `DevFleetConfig` and wire in composition root

This is deferred because the in-memory adapter is sufficient for single-process local development, and adding PostgreSQL requires Docker or a running DB instance. The port/adapter boundary makes this a zero-risk deferral.

**Chat with Agents:**
The spec mentions "chat with any agent" as a CEO interaction point. This requires:
1. A `SendCeoMessage` use case that injects a message into an agent's conversation
2. A WebSocket (not SSE — needs bidirectional) endpoint for real-time chat
3. A chat UI component in the dashboard
This is a standalone feature that can be added once the core dashboard is stable.

---

## Post-Implementation Checklist

After all batches are complete, verify:

- [ ] `npx jest --no-coverage` — all tests pass (Phase 1 + 2 + 3)
- [ ] `npx tsc --noEmit` — no type errors
- [ ] `cd dashboard && npm run build` — dashboard builds cleanly
- [ ] Start both processes: `npm start` (core + API) and `cd dashboard && npm run dev` (dashboard)
- [ ] Open `http://localhost:3000` — Live Floor loads with 7 agents
- [ ] Create a goal from the dashboard — pipeline kicks off
- [ ] Events stream in real-time via SSE
- [ ] Pipeline kanban shows tasks flowing through phases
- [ ] Pause/resume an agent from the dashboard

**Exit criteria (from spec):** Can observe and control the full agent team from the browser.
