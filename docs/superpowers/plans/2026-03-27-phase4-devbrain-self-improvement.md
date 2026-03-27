# Phase 4: DevBrain + Self-Improvement — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Learner from a passive event recorder into an active analyst that proposes recommendations, with CEO approval workflow, alerts system, and four new dashboard sections.

**Architecture:** Foundation-first — fix 7 structural issues as Step 0 (entities, ports, adapters), then build analytics use cases, alert system, and dashboard pages. All mutations go through ports. The Learner never mutates directly — it proposes, the CEO disposes.

**Tech Stack:** TypeScript, Express, Next.js (React), Zustand, SSE, Jest (ts-jest), Claude API (Opus for Learner)

**Spec:** `docs/superpowers/specs/2026-03-27-phase4-devbrain-self-improvement-design.md`

---

## Task 1: Layer 1 Entities — InsightId, MetricsFilter, Insight, AlertPreferences

**Files:**
- Modify: `src/entities/ids.ts`
- Create: `src/entities/MetricsFilter.ts`
- Create: `src/entities/Insight.ts`
- Create: `src/entities/AlertPreferences.ts`
- Test: `tests/entities/Insight.test.ts`

- [ ] **Step 1: Add InsightId to ids.ts**

```typescript
// Append to src/entities/ids.ts, after ProjectId:
export type InsightId = string & { readonly __brand: "InsightId" }

export function createInsightId(value?: string): InsightId {
  return (value ?? randomUUID()) as InsightId
}
```

- [ ] **Step 2: Create MetricsFilter entity**

```typescript
// src/entities/MetricsFilter.ts
import type { GoalId, AgentId } from "./ids"

export interface MetricsFilter {
  readonly goalId?: GoalId
  readonly agentId?: AgentId
  readonly since?: Date
  readonly until?: Date
}
```

- [ ] **Step 3: Create Insight entity with ProposedAction union**

```typescript
// src/entities/Insight.ts
import type { InsightId } from "./ids"

export type ProposedAction =
  | { readonly kind: "prompt_update"; readonly role: string; readonly currentContent: string; readonly newContent: string }
  | { readonly kind: "budget_tune"; readonly role: string; readonly currentMaxTokens: number; readonly currentMaxCostUsd: number; readonly newMaxTokens: number; readonly newMaxCostUsd: number }
  | { readonly kind: "model_reassign"; readonly role: string; readonly currentModel: string; readonly newModel: string }
  | { readonly kind: "skill_update"; readonly skillName: string; readonly currentContent: string; readonly newContent: string }
  | { readonly kind: "process_change"; readonly description: string }

export type InsightStatus = "pending" | "applied" | "dismissed"

export interface Insight {
  readonly id: InsightId
  readonly title: string
  readonly description: string
  readonly evidence: string
  readonly proposedAction: ProposedAction
  readonly status: InsightStatus
  readonly outcomeMetric: number | null
  readonly createdAt: Date
  readonly resolvedAt: Date | null
}

export interface CreateInsightParams {
  readonly id: InsightId
  readonly title: string
  readonly description: string
  readonly evidence: string
  readonly proposedAction: ProposedAction
}

export function createInsight(params: CreateInsightParams): Insight {
  return {
    ...params,
    status: "pending",
    outcomeMetric: null,
    createdAt: new Date(),
    resolvedAt: null,
  }
}
```

- [ ] **Step 4: Create AlertPreferences entity**

```typescript
// src/entities/AlertPreferences.ts
import type { MessageType } from "./Message"

export interface AlertPreferences {
  readonly minSeverity: "info" | "warning" | "urgent"
  readonly mutedTriggers: ReadonlyArray<MessageType>
}

export function createDefaultAlertPreferences(): AlertPreferences {
  return { minSeverity: "info", mutedTriggers: [] }
}

const SEVERITY_RANK: Record<string, number> = { info: 0, warning: 1, urgent: 2 }

export function severityRank(severity: "info" | "warning" | "urgent"): number {
  return SEVERITY_RANK[severity] ?? 0
}
```

- [ ] **Step 5: Write Insight entity tests**

```typescript
// tests/entities/Insight.test.ts
import { createInsight, type ProposedAction } from "@entities/Insight"
import { createInsightId } from "@entities/ids"

describe("Insight", () => {
  it("creates with pending status and null timestamps", () => {
    const action: ProposedAction = { kind: "prompt_update", role: "developer", currentContent: "old", newContent: "new" }
    const insight = createInsight({ id: createInsightId(), title: "Fix dev prompt", description: "Add lint", evidence: "4/6 rejected for lint", proposedAction: action })
    expect(insight.status).toBe("pending")
    expect(insight.outcomeMetric).toBeNull()
    expect(insight.resolvedAt).toBeNull()
    expect(insight.proposedAction.kind).toBe("prompt_update")
  })

  it("preserves ProposedAction snapshot data", () => {
    const action: ProposedAction = { kind: "budget_tune", role: "developer", currentMaxTokens: 10000, currentMaxCostUsd: 1.0, newMaxTokens: 7000, newMaxCostUsd: 0.7 }
    const insight = createInsight({ id: createInsightId(), title: "Lower dev budget", description: "desc", evidence: "data", proposedAction: action })
    expect(insight.proposedAction).toEqual(action)
  })
})
```

- [ ] **Step 6: Run tests**

Run: `npx jest tests/entities/Insight.test.ts --verbose`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/entities/ids.ts src/entities/MetricsFilter.ts src/entities/Insight.ts src/entities/AlertPreferences.ts tests/entities/Insight.test.ts
git commit -m "feat(phase4): add Insight, MetricsFilter, AlertPreferences entities and InsightId"
```

---

## Task 2: Extend KeepDiscardRecord + Delete ExperimentResult

**Files:**
- Modify: `src/entities/KeepDiscardRecord.ts`
- Delete: `src/entities/ExperimentResult.ts`
- Modify: `tests/entities/KeepDiscardRecord.test.ts`

- [ ] **Step 1: Extend KeepDiscardRecord with new fields**

Replace the full content of `src/entities/KeepDiscardRecord.ts`:

```typescript
import { type TaskId, type GoalId, type AgentId, type ArtifactId } from "./ids"

export interface KeepDiscardRecord {
  readonly taskId: TaskId
  readonly goalId: GoalId
  readonly agentId: AgentId
  readonly phase: string
  readonly durationMs: number
  readonly tokensUsed: number
  readonly costUsd: number
  readonly verdict: "approved" | "rejected"
  readonly reasons: readonly string[]
  readonly artifactIds: readonly ArtifactId[]
  readonly commitHash: string | null
  readonly iteration: number
  readonly recordedAt: Date
}

export interface CreateKeepDiscardRecordParams {
  taskId: TaskId
  goalId: GoalId
  agentId: AgentId
  phase: string
  durationMs: number
  tokensUsed: number
  costUsd: number
  verdict: "approved" | "rejected"
  reasons: readonly string[]
  artifactIds: readonly ArtifactId[]
  commitHash: string | null
  iteration: number
  recordedAt?: Date
}

export function createKeepDiscardRecord(params: CreateKeepDiscardRecordParams): KeepDiscardRecord {
  return { ...params, recordedAt: params.recordedAt ?? new Date() }
}
```

- [ ] **Step 2: Update the existing KeepDiscardRecord test**

Update `tests/entities/KeepDiscardRecord.test.ts` to include the new fields (`goalId`, `costUsd`, `iteration`) in the `createKeepDiscardRecord` call. Add `goalId: createGoalId()`, `costUsd: 0.05`, `iteration: 1` to existing test params.

- [ ] **Step 3: Delete ExperimentResult.ts**

```bash
rm src/entities/ExperimentResult.ts
```

Verify no imports reference it:

```bash
grep -r "ExperimentResult" src/ tests/
```

Expected: no results (this entity was dead code).

- [ ] **Step 4: Run tests**

Run: `npx jest tests/entities/KeepDiscardRecord.test.ts --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/entities/KeepDiscardRecord.ts tests/entities/KeepDiscardRecord.test.ts
git rm src/entities/ExperimentResult.ts
git commit -m "feat(phase4): extend KeepDiscardRecord, delete dead ExperimentResult entity"
```

---

## Task 3: Layer 2 Ports

**Files:**
- Create: `src/use-cases/ports/KeepDiscardRepository.ts`
- Create: `src/use-cases/ports/AgentPromptStore.ts`
- Create: `src/use-cases/ports/InsightRepository.ts`
- Create: `src/use-cases/ports/BudgetConfigStore.ts`
- Create: `src/use-cases/ports/SkillStore.ts`
- Create: `src/use-cases/ports/NotificationPort.ts`
- Create: `src/use-cases/ports/AlertPreferencesStore.ts`
- Modify: `src/use-cases/ports/AgentRegistry.ts`

- [ ] **Step 1: Create KeepDiscardRepository port**

```typescript
// src/use-cases/ports/KeepDiscardRepository.ts
import type { KeepDiscardRecord } from "../../entities/KeepDiscardRecord"
import type { AgentId, GoalId } from "../../entities/ids"

export interface KeepDiscardRepository {
  save(record: KeepDiscardRecord): Promise<void>
  findByAgentId(agentId: AgentId): Promise<ReadonlyArray<KeepDiscardRecord>>
  findByGoalId(goalId: GoalId): Promise<ReadonlyArray<KeepDiscardRecord>>
  findAll(): Promise<ReadonlyArray<KeepDiscardRecord>>
}
```

- [ ] **Step 2: Create AgentPromptStore port**

```typescript
// src/use-cases/ports/AgentPromptStore.ts
export interface AgentPromptStore {
  read(role: string): Promise<string>
  update(role: string, content: string, reason: string): Promise<void>
}
```

- [ ] **Step 3: Create InsightRepository port**

```typescript
// src/use-cases/ports/InsightRepository.ts
import type { Insight, InsightStatus } from "../../entities/Insight"
import type { InsightId } from "../../entities/ids"

export interface InsightRepository {
  save(insight: Insight): Promise<void>
  findById(id: InsightId): Promise<Insight | null>
  findByStatus(status: InsightStatus): Promise<ReadonlyArray<Insight>>
  findAll(): Promise<ReadonlyArray<Insight>>
  update(insight: Insight): Promise<void>
}
```

- [ ] **Step 4: Create BudgetConfigStore port**

```typescript
// src/use-cases/ports/BudgetConfigStore.ts
export interface BudgetDefaults {
  readonly role: string
  readonly maxTokens: number
  readonly maxCostUsd: number
}

export interface BudgetConfigStore {
  read(role: string): Promise<BudgetDefaults>
  update(role: string, maxTokens: number, maxCostUsd: number): Promise<void>
}
```

- [ ] **Step 5: Create SkillStore port**

```typescript
// src/use-cases/ports/SkillStore.ts
export interface SkillStore {
  read(skillName: string): Promise<string>
  update(skillName: string, content: string, reason: string): Promise<void>
  list(): Promise<ReadonlyArray<string>>
}
```

- [ ] **Step 6: Create NotificationPort**

```typescript
// src/use-cases/ports/NotificationPort.ts
import type { GoalId, TaskId, InsightId } from "../../entities/ids"

export interface CeoAlert {
  readonly severity: "info" | "warning" | "urgent"
  readonly title: string
  readonly body: string
  readonly goalId?: GoalId
  readonly taskId?: TaskId
  readonly insightId?: InsightId
}

export interface NotificationPort {
  notify(alert: CeoAlert): Promise<void>
}
```

- [ ] **Step 7: Create AlertPreferencesStore port**

```typescript
// src/use-cases/ports/AlertPreferencesStore.ts
import type { AlertPreferences } from "../../entities/AlertPreferences"

export interface AlertPreferencesStore {
  read(): Promise<AlertPreferences>
  update(prefs: AlertPreferences): Promise<void>
}
```

- [ ] **Step 8: Extend AgentRegistry with updateModel**

Add to `src/use-cases/ports/AgentRegistry.ts`:

```typescript
updateModel(id: AgentId, model: string): Promise<void>
```

The full interface becomes:

```typescript
import type { Agent } from "../../entities/Agent"
import type { AgentId } from "../../entities/ids"
import type { AgentRole } from "../../entities/AgentRole"

export interface AgentRegistry {
  findAvailable(role: AgentRole): Promise<Agent | null>
  findById(id: AgentId): Promise<Agent | null>
  register(agent: Agent): Promise<void>
  updateStatus(id: AgentId, status: Agent["status"], taskId?: Agent["currentTaskId"]): Promise<void>
  updateModel(id: AgentId, model: string): Promise<void>
  findAll(): Promise<ReadonlyArray<Agent>>
}
```

- [ ] **Step 9: Add updateModel to InMemoryAgentRegistry**

Add to `src/adapters/storage/InMemoryAgentRegistry.ts`:

```typescript
async updateModel(id: AgentId, model: string): Promise<void> {
  const agent = this.store.get(id)
  if (!agent) throw new Error(`Agent ${id} not found`)
  this.store.set(id, { ...agent, model })
}
```

- [ ] **Step 10: Run full test suite**

Run: `npx jest --verbose`
Expected: all existing tests PASS (no behavior changed, only new ports + one new method)

- [ ] **Step 11: Commit**

```bash
git add src/use-cases/ports/KeepDiscardRepository.ts src/use-cases/ports/AgentPromptStore.ts src/use-cases/ports/InsightRepository.ts src/use-cases/ports/BudgetConfigStore.ts src/use-cases/ports/SkillStore.ts src/use-cases/ports/NotificationPort.ts src/use-cases/ports/AlertPreferencesStore.ts src/use-cases/ports/AgentRegistry.ts src/adapters/storage/InMemoryAgentRegistry.ts
git commit -m "feat(phase4): add 7 new ports, extend AgentRegistry with updateModel"
```

---

## Task 4: Layer 3 In-Memory Adapters

**Files:**
- Create: `src/adapters/storage/InMemoryKeepDiscardRepository.ts`
- Create: `src/adapters/storage/InMemoryInsightRepository.ts`
- Create: `src/adapters/storage/InMemoryBudgetConfigStore.ts`
- Create: `src/adapters/storage/InMemoryAlertPreferencesStore.ts`
- Test: `tests/adapters/InMemoryKeepDiscardRepository.test.ts`
- Test: `tests/adapters/InMemoryInsightRepository.test.ts`

- [ ] **Step 1: Write InMemoryKeepDiscardRepository test**

```typescript
// tests/adapters/InMemoryKeepDiscardRepository.test.ts
import { InMemoryKeepDiscardRepository } from "@adapters/storage/InMemoryKeepDiscardRepository"
import { createKeepDiscardRecord } from "@entities/KeepDiscardRecord"
import { createTaskId, createGoalId, createAgentId } from "@entities/ids"

function makeRecord(overrides: Record<string, unknown> = {}) {
  return createKeepDiscardRecord({
    taskId: createTaskId(), goalId: createGoalId(), agentId: createAgentId("dev-1"),
    phase: "code", durationMs: 1000, tokensUsed: 500, costUsd: 0.05,
    verdict: "approved", reasons: [], artifactIds: [], commitHash: null, iteration: 1,
    ...overrides,
  })
}

describe("InMemoryKeepDiscardRepository", () => {
  it("saves and retrieves records", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    const record = makeRecord()
    await repo.save(record)
    const all = await repo.findAll()
    expect(all).toHaveLength(1)
    expect(all[0]).toEqual(record)
  })

  it("filters by agentId", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    await repo.save(makeRecord({ agentId: createAgentId("dev-1") }))
    await repo.save(makeRecord({ agentId: createAgentId("dev-2") }))
    const results = await repo.findByAgentId(createAgentId("dev-1"))
    expect(results).toHaveLength(1)
  })

  it("filters by goalId", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    const goalId = createGoalId("g-1")
    await repo.save(makeRecord({ goalId }))
    await repo.save(makeRecord({ goalId: createGoalId("g-2") }))
    const results = await repo.findByGoalId(goalId)
    expect(results).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/adapters/InMemoryKeepDiscardRepository.test.ts --verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement InMemoryKeepDiscardRepository**

```typescript
// src/adapters/storage/InMemoryKeepDiscardRepository.ts
import type { KeepDiscardRecord } from "../../entities/KeepDiscardRecord"
import type { AgentId, GoalId } from "../../entities/ids"
import type { KeepDiscardRepository } from "../../use-cases/ports/KeepDiscardRepository"

export class InMemoryKeepDiscardRepository implements KeepDiscardRepository {
  private readonly records: KeepDiscardRecord[] = []

  async save(record: KeepDiscardRecord): Promise<void> {
    this.records.push(record)
  }

  async findByAgentId(agentId: AgentId): Promise<ReadonlyArray<KeepDiscardRecord>> {
    return this.records.filter(r => r.agentId === agentId)
  }

  async findByGoalId(goalId: GoalId): Promise<ReadonlyArray<KeepDiscardRecord>> {
    return this.records.filter(r => r.goalId === goalId)
  }

  async findAll(): Promise<ReadonlyArray<KeepDiscardRecord>> {
    return [...this.records]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/adapters/InMemoryKeepDiscardRepository.test.ts --verbose`
Expected: PASS

- [ ] **Step 5: Write InMemoryInsightRepository test**

```typescript
// tests/adapters/InMemoryInsightRepository.test.ts
import { InMemoryInsightRepository } from "@adapters/storage/InMemoryInsightRepository"
import { createInsight } from "@entities/Insight"
import { createInsightId } from "@entities/ids"

describe("InMemoryInsightRepository", () => {
  it("saves and finds by id", async () => {
    const repo = new InMemoryInsightRepository()
    const insight = createInsight({ id: createInsightId("i-1"), title: "Test", description: "d", evidence: "e", proposedAction: { kind: "process_change", description: "advice" } })
    await repo.save(insight)
    const found = await repo.findById(createInsightId("i-1"))
    expect(found).toEqual(insight)
  })

  it("filters by status", async () => {
    const repo = new InMemoryInsightRepository()
    const i1 = createInsight({ id: createInsightId("i-1"), title: "A", description: "d", evidence: "e", proposedAction: { kind: "process_change", description: "a" } })
    const i2 = { ...createInsight({ id: createInsightId("i-2"), title: "B", description: "d", evidence: "e", proposedAction: { kind: "process_change", description: "b" } }), status: "applied" as const, resolvedAt: new Date() }
    await repo.save(i1)
    await repo.save(i2)
    const pending = await repo.findByStatus("pending")
    expect(pending).toHaveLength(1)
    expect(pending[0]?.title).toBe("A")
  })

  it("updates insight in place", async () => {
    const repo = new InMemoryInsightRepository()
    const insight = createInsight({ id: createInsightId("i-1"), title: "Test", description: "d", evidence: "e", proposedAction: { kind: "process_change", description: "a" } })
    await repo.save(insight)
    await repo.update({ ...insight, status: "dismissed", resolvedAt: new Date() })
    const found = await repo.findById(createInsightId("i-1"))
    expect(found?.status).toBe("dismissed")
  })
})
```

- [ ] **Step 6: Implement InMemoryInsightRepository**

```typescript
// src/adapters/storage/InMemoryInsightRepository.ts
import type { Insight, InsightStatus } from "../../entities/Insight"
import type { InsightId } from "../../entities/ids"
import type { InsightRepository } from "../../use-cases/ports/InsightRepository"

export class InMemoryInsightRepository implements InsightRepository {
  private readonly store = new Map<string, Insight>()

  async save(insight: Insight): Promise<void> {
    this.store.set(insight.id, insight)
  }

  async findById(id: InsightId): Promise<Insight | null> {
    return this.store.get(id) ?? null
  }

  async findByStatus(status: InsightStatus): Promise<ReadonlyArray<Insight>> {
    return [...this.store.values()].filter(i => i.status === status)
  }

  async findAll(): Promise<ReadonlyArray<Insight>> {
    return [...this.store.values()]
  }

  async update(insight: Insight): Promise<void> {
    if (!this.store.has(insight.id)) throw new Error(`Insight ${insight.id} not found`)
    this.store.set(insight.id, insight)
  }
}
```

- [ ] **Step 7: Implement InMemoryBudgetConfigStore**

```typescript
// src/adapters/storage/InMemoryBudgetConfigStore.ts
import type { BudgetConfigStore, BudgetDefaults } from "../../use-cases/ports/BudgetConfigStore"

export class InMemoryBudgetConfigStore implements BudgetConfigStore {
  private readonly store = new Map<string, BudgetDefaults>()

  constructor(defaults?: ReadonlyArray<BudgetDefaults>) {
    for (const d of defaults ?? []) {
      this.store.set(d.role, d)
    }
  }

  async read(role: string): Promise<BudgetDefaults> {
    const entry = this.store.get(role)
    if (!entry) return { role, maxTokens: 10000, maxCostUsd: 1.0 }
    return entry
  }

  async update(role: string, maxTokens: number, maxCostUsd: number): Promise<void> {
    this.store.set(role, { role, maxTokens, maxCostUsd })
  }
}
```

- [ ] **Step 8: Implement InMemoryAlertPreferencesStore**

```typescript
// src/adapters/storage/InMemoryAlertPreferencesStore.ts
import type { AlertPreferences } from "../../entities/AlertPreferences"
import { createDefaultAlertPreferences } from "../../entities/AlertPreferences"
import type { AlertPreferencesStore } from "../../use-cases/ports/AlertPreferencesStore"

export class InMemoryAlertPreferencesStore implements AlertPreferencesStore {
  private prefs: AlertPreferences = createDefaultAlertPreferences()

  async read(): Promise<AlertPreferences> {
    return this.prefs
  }

  async update(prefs: AlertPreferences): Promise<void> {
    this.prefs = prefs
  }
}
```

- [ ] **Step 9: Implement NoOpNotificationAdapter**

```typescript
// src/adapters/notifications/NoOpNotificationAdapter.ts
import type { CeoAlert, NotificationPort } from "../../use-cases/ports/NotificationPort"

export class NoOpNotificationAdapter implements NotificationPort {
  async notify(_alert: CeoAlert): Promise<void> {
    // V1: alerts delivered via bus → SSE path
    // Future: Slack, email, webhook adapters replace this
  }
}
```

- [ ] **Step 10: Run tests**

Run: `npx jest tests/adapters/InMemoryKeepDiscardRepository.test.ts tests/adapters/InMemoryInsightRepository.test.ts --verbose`
Expected: PASS

- [ ] **Step 11: Commit**

```bash
git add src/adapters/storage/InMemoryKeepDiscardRepository.ts src/adapters/storage/InMemoryInsightRepository.ts src/adapters/storage/InMemoryBudgetConfigStore.ts src/adapters/storage/InMemoryAlertPreferencesStore.ts src/adapters/notifications/NoOpNotificationAdapter.ts tests/adapters/InMemoryKeepDiscardRepository.test.ts tests/adapters/InMemoryInsightRepository.test.ts
git commit -m "feat(phase4): add in-memory adapters for new ports"
```

---

## Task 5: Filesystem Adapters (AgentPromptStore, SkillStore)

**Files:**
- Create: `src/adapters/filesystem/FileSystemAgentPromptStore.ts`
- Create: `src/adapters/filesystem/FileSystemSkillStore.ts`
- Test: `tests/adapters/FileSystemAgentPromptStore.test.ts`

- [ ] **Step 1: Write FileSystemAgentPromptStore test**

```typescript
// tests/adapters/FileSystemAgentPromptStore.test.ts
import { FileSystemAgentPromptStore } from "@adapters/filesystem/FileSystemAgentPromptStore"
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("FileSystemAgentPromptStore", () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "prompt-test-")); writeFileSync(join(dir, "developer.md"), "You are a developer.") })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it("reads a prompt file", async () => {
    const store = new FileSystemAgentPromptStore(dir)
    const content = await store.read("developer")
    expect(content).toBe("You are a developer.")
  })

  it("updates a prompt file", async () => {
    const store = new FileSystemAgentPromptStore(dir)
    await store.update("developer", "You are a senior developer.", "improve quality")
    const raw = readFileSync(join(dir, "developer.md"), "utf-8")
    expect(raw).toBe("You are a senior developer.")
  })
})
```

- [ ] **Step 2: Implement FileSystemAgentPromptStore**

```typescript
// src/adapters/filesystem/FileSystemAgentPromptStore.ts
import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { AgentPromptStore } from "../../use-cases/ports/AgentPromptStore"

export class FileSystemAgentPromptStore implements AgentPromptStore {
  constructor(private readonly dir: string) {}

  async read(role: string): Promise<string> {
    return readFile(join(this.dir, `${role}.md`), "utf-8")
  }

  async update(role: string, content: string, _reason: string): Promise<void> {
    await writeFile(join(this.dir, `${role}.md`), content, "utf-8")
  }
}
```

- [ ] **Step 3: Implement FileSystemSkillStore**

```typescript
// src/adapters/filesystem/FileSystemSkillStore.ts
import { readFile, writeFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import type { SkillStore } from "../../use-cases/ports/SkillStore"

export class FileSystemSkillStore implements SkillStore {
  constructor(private readonly dir: string) {}

  async read(skillName: string): Promise<string> {
    return readFile(join(this.dir, `${skillName}.md`), "utf-8")
  }

  async update(skillName: string, content: string, _reason: string): Promise<void> {
    await writeFile(join(this.dir, `${skillName}.md`), content, "utf-8")
  }

  async list(): Promise<ReadonlyArray<string>> {
    const files = await readdir(this.dir)
    return files.filter(f => f.endsWith(".md")).map(f => f.replace(/\.md$/, ""))
  }
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest tests/adapters/FileSystemAgentPromptStore.test.ts --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/adapters/filesystem/FileSystemAgentPromptStore.ts src/adapters/filesystem/FileSystemSkillStore.ts tests/adapters/FileSystemAgentPromptStore.test.ts
git commit -m "feat(phase4): add filesystem adapters for prompt and skill stores"
```

---

## Task 6: New Message Types

**Files:**
- Modify: `src/entities/Message.ts`

- [ ] **Step 1: Add 6 new message interfaces and extend union**

Add the following interfaces before the union definition, and add them to the `Message` union:

```typescript
// After AgentResumedMessage, before the union:

interface InsightAcceptedMessage extends BaseMessage {
  readonly type: "insight.accepted"
  readonly insightId: string
  readonly actionKind: string
  readonly title: string
}

interface InsightDismissedMessage extends BaseMessage {
  readonly type: "insight.dismissed"
  readonly insightId: string
}

interface BudgetUpdatedMessage extends BaseMessage {
  readonly type: "budget.updated"
  readonly role: string
  readonly maxTokens: number
  readonly maxCostUsd: number
}

interface ModelUpdatedMessage extends BaseMessage {
  readonly type: "model.updated"
  readonly role: string
  readonly newModel: string
}

interface CeoAlertMessage extends BaseMessage {
  readonly type: "ceo.alert"
  readonly severity: "info" | "warning" | "urgent"
  readonly title: string
  readonly body: string
  readonly goalId?: GoalId
  readonly taskId?: TaskId
  readonly insightId?: string
}
```

Also update the existing `InsightGeneratedMessage` to match the spec:

```typescript
// Replace the existing InsightGeneratedMessage:
interface InsightGeneratedMessage extends BaseMessage {
  readonly type: "insight.generated"
  readonly insightId: string
  readonly actionKind: string
  readonly title: string
  readonly confidence: number
}
```

Update the `Message` union to include all 5 new types (`InsightGeneratedMessage` already exists — just updated above):

```typescript
export type Message =
  // ... existing 28 types (InsightGeneratedMessage already in the union) ...
  | InsightAcceptedMessage
  | InsightDismissedMessage
  | BudgetUpdatedMessage
  | ModelUpdatedMessage
  | CeoAlertMessage
```

- [ ] **Step 2: Run existing Message tests**

Run: `npx jest tests/entities/Message.test.ts --verbose`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/entities/Message.ts
git commit -m "feat(phase4): add 5 new message types for insights, alerts, config changes"
```

---

## Task 7: Reports Value Objects + ComputeFinancials Use Case

**Files:**
- Create: `src/entities/Reports.ts`
- Create: `src/use-cases/ComputeFinancials.ts`
- Test: `tests/use-cases/ComputeFinancials.test.ts`

- [ ] **Step 1: Create Reports value objects**

```typescript
// src/entities/Reports.ts
import type { GoalId } from "./ids"
import type { KeepDiscardRecord } from "./KeepDiscardRecord"

export interface FinancialsReport {
  readonly totalTokensUsed: number
  readonly totalCostUsd: number
  readonly costPerGoal: ReadonlyArray<{ goalId: GoalId; costUsd: number }>
  readonly agentTokenBreakdown: Record<string, number>
  readonly modelTierBreakdown: Record<string, number>
}

export interface QualityReport {
  readonly overallKeepRate: number
  readonly keepRateByAgent: Record<string, number>
  readonly reviewPassRate: number
  readonly topRejectionReasons: ReadonlyArray<{ reason: string; count: number }>
  readonly recentRecords: ReadonlyArray<KeepDiscardRecord>
}

export interface TimingsReport {
  readonly avgDurationByPhase: Record<string, number>
  readonly stalledPhases: ReadonlyArray<{ phase: string; avgMs: number; threshold: number }>
  readonly agentEfficiency: Record<string, number>
}
```

- [ ] **Step 2: Write ComputeFinancials test**

```typescript
// tests/use-cases/ComputeFinancials.test.ts
import { ComputeFinancials } from "@use-cases/ComputeFinancials"
import { InMemoryEventStore } from "@adapters/storage/InMemoryEventStore"
import { InMemoryGoalRepo } from "@adapters/storage/InMemoryGoalRepo"
import { createEventId, createGoalId, createAgentId } from "@entities/ids"
import type { SystemEvent } from "@entities/Event"

function makeEvent(goalId: string, agentId: string, tokens: number, cost: number): SystemEvent {
  return {
    id: createEventId(), type: "task.completed", agentId: createAgentId(agentId),
    taskId: null, goalId: createGoalId(goalId),
    cost: { inputTokens: tokens, outputTokens: 0, totalTokens: tokens, estimatedCostUsd: cost },
    occurredAt: new Date(), payload: {},
  }
}

describe("ComputeFinancials", () => {
  it("aggregates total tokens and cost across events", async () => {
    const eventStore = new InMemoryEventStore()
    await eventStore.append(makeEvent("g1", "dev-1", 100, 0.01))
    await eventStore.append(makeEvent("g1", "dev-2", 200, 0.02))
    const uc = new ComputeFinancials(eventStore)
    const report = await uc.execute()
    expect(report.totalTokensUsed).toBe(300)
    expect(report.totalCostUsd).toBeCloseTo(0.03)
  })

  it("computes cost per goal", async () => {
    const eventStore = new InMemoryEventStore()
    await eventStore.append(makeEvent("g1", "dev-1", 100, 0.01))
    await eventStore.append(makeEvent("g2", "dev-1", 200, 0.02))
    const uc = new ComputeFinancials(eventStore)
    const report = await uc.execute()
    expect(report.costPerGoal).toHaveLength(2)
    const g1 = report.costPerGoal.find(c => c.goalId === createGoalId("g1"))
    expect(g1?.costUsd).toBeCloseTo(0.01)
  })

  it("computes agent token breakdown", async () => {
    const eventStore = new InMemoryEventStore()
    await eventStore.append(makeEvent("g1", "dev-1", 100, 0.01))
    await eventStore.append(makeEvent("g1", "dev-1", 50, 0.005))
    await eventStore.append(makeEvent("g1", "rev-1", 200, 0.02))
    const uc = new ComputeFinancials(eventStore)
    const report = await uc.execute()
    expect(report.agentTokenBreakdown["dev-1"]).toBe(150)
    expect(report.agentTokenBreakdown["rev-1"]).toBe(200)
  })
})
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx jest tests/use-cases/ComputeFinancials.test.ts --verbose`
Expected: FAIL

- [ ] **Step 4: Implement ComputeFinancials**

```typescript
// src/use-cases/ComputeFinancials.ts
import type { EventStore } from "./ports/EventStore"
import type { MetricsFilter } from "../entities/MetricsFilter"
import type { FinancialsReport } from "../entities/Reports"
import type { GoalId } from "../entities/ids"

export class ComputeFinancials {
  constructor(private readonly events: EventStore) {}

  async execute(filter?: MetricsFilter): Promise<FinancialsReport> {
    const allEvents = await this.events.findAll()
    const filtered = allEvents.filter(e => {
      if (!e.cost) return false
      if (filter?.goalId && e.goalId !== filter.goalId) return false
      if (filter?.agentId && e.agentId !== filter.agentId) return false
      if (filter?.since && e.occurredAt < filter.since) return false
      if (filter?.until && e.occurredAt > filter.until) return false
      return true
    })

    let totalTokensUsed = 0
    let totalCostUsd = 0
    const costByGoal = new Map<string, number>()
    const tokensByAgent = new Map<string, number>()

    for (const event of filtered) {
      if (!event.cost) continue
      totalTokensUsed += event.cost.totalTokens
      totalCostUsd += event.cost.estimatedCostUsd
      if (event.goalId) {
        costByGoal.set(event.goalId, (costByGoal.get(event.goalId) ?? 0) + event.cost.estimatedCostUsd)
      }
      if (event.agentId) {
        tokensByAgent.set(event.agentId as string, (tokensByAgent.get(event.agentId as string) ?? 0) + event.cost.totalTokens)
      }
    }

    const costPerGoal = [...costByGoal.entries()].map(([goalId, costUsd]) => ({ goalId: goalId as GoalId, costUsd }))
    const agentTokenBreakdown: Record<string, number> = Object.fromEntries(tokensByAgent)

    return { totalTokensUsed, totalCostUsd, costPerGoal, agentTokenBreakdown, modelTierBreakdown: {} }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/use-cases/ComputeFinancials.test.ts --verbose`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/entities/Reports.ts src/use-cases/ComputeFinancials.ts tests/use-cases/ComputeFinancials.test.ts
git commit -m "feat(phase4): add Reports value objects and ComputeFinancials use case"
```

---

## Task 8: ComputeQualityMetrics Use Case

**Files:**
- Create: `src/use-cases/ComputeQualityMetrics.ts`
- Test: `tests/use-cases/ComputeQualityMetrics.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/use-cases/ComputeQualityMetrics.test.ts
import { ComputeQualityMetrics } from "@use-cases/ComputeQualityMetrics"
import { InMemoryKeepDiscardRepository } from "@adapters/storage/InMemoryKeepDiscardRepository"
import { createKeepDiscardRecord } from "@entities/KeepDiscardRecord"
import { createTaskId, createGoalId, createAgentId } from "@entities/ids"

function makeRecord(verdict: "approved" | "rejected", agentId: string, reasons: string[] = []) {
  return createKeepDiscardRecord({
    taskId: createTaskId(), goalId: createGoalId(), agentId: createAgentId(agentId),
    phase: "review", durationMs: 1000, tokensUsed: 500, costUsd: 0.05,
    verdict, reasons, artifactIds: [], commitHash: null, iteration: 1,
  })
}

describe("ComputeQualityMetrics", () => {
  it("computes overall keep rate", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    await repo.save(makeRecord("approved", "dev-1"))
    await repo.save(makeRecord("approved", "dev-1"))
    await repo.save(makeRecord("rejected", "dev-1", ["no tests"]))
    const uc = new ComputeQualityMetrics(repo)
    const report = await uc.execute()
    expect(report.overallKeepRate).toBeCloseTo(2 / 3)
  })

  it("computes keep rate by agent", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    await repo.save(makeRecord("approved", "dev-1"))
    await repo.save(makeRecord("rejected", "dev-1"))
    await repo.save(makeRecord("approved", "dev-2"))
    const uc = new ComputeQualityMetrics(repo)
    const report = await uc.execute()
    expect(report.keepRateByAgent["dev-1"]).toBeCloseTo(0.5)
    expect(report.keepRateByAgent["dev-2"]).toBeCloseTo(1.0)
  })

  it("ranks top rejection reasons", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    await repo.save(makeRecord("rejected", "dev-1", ["no tests", "bad naming"]))
    await repo.save(makeRecord("rejected", "dev-1", ["no tests"]))
    const uc = new ComputeQualityMetrics(repo)
    const report = await uc.execute()
    expect(report.topRejectionReasons[0]).toEqual({ reason: "no tests", count: 2 })
    expect(report.topRejectionReasons[1]).toEqual({ reason: "bad naming", count: 1 })
  })

  it("includes recent records for AI context", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    await repo.save(makeRecord("approved", "dev-1"))
    const uc = new ComputeQualityMetrics(repo)
    const report = await uc.execute()
    expect(report.recentRecords).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/use-cases/ComputeQualityMetrics.test.ts --verbose`
Expected: FAIL

- [ ] **Step 3: Implement ComputeQualityMetrics**

```typescript
// src/use-cases/ComputeQualityMetrics.ts
import type { KeepDiscardRepository } from "./ports/KeepDiscardRepository"
import type { MetricsFilter } from "../entities/MetricsFilter"
import type { QualityReport } from "../entities/Reports"

export class ComputeQualityMetrics {
  constructor(private readonly keepDiscardRepo: KeepDiscardRepository) {}

  async execute(filter?: MetricsFilter): Promise<QualityReport> {
    let records = await this.keepDiscardRepo.findAll()
    if (filter?.agentId) records = records.filter(r => r.agentId === filter.agentId)
    if (filter?.goalId) records = records.filter(r => r.goalId === filter.goalId)
    if (filter?.since) records = records.filter(r => r.recordedAt >= filter.since!)
    if (filter?.until) records = records.filter(r => r.recordedAt <= filter.until!)

    const total = records.length
    const approved = records.filter(r => r.verdict === "approved").length
    const overallKeepRate = total > 0 ? approved / total : 0

    const byAgent = new Map<string, { approved: number; total: number }>()
    for (const r of records) {
      const key = r.agentId as string
      const entry = byAgent.get(key) ?? { approved: 0, total: 0 }
      entry.total++
      if (r.verdict === "approved") entry.approved++
      byAgent.set(key, entry)
    }
    const keepRateByAgent: Record<string, number> = {}
    for (const [agent, counts] of byAgent) {
      keepRateByAgent[agent] = counts.total > 0 ? counts.approved / counts.total : 0
    }

    const firstAttempts = records.filter(r => r.iteration === 1)
    const firstApproved = firstAttempts.filter(r => r.verdict === "approved").length
    const reviewPassRate = firstAttempts.length > 0 ? firstApproved / firstAttempts.length : 0

    const reasonCounts = new Map<string, number>()
    for (const r of records) {
      for (const reason of r.reasons) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
      }
    }
    const topRejectionReasons = [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)

    return { overallKeepRate, keepRateByAgent, reviewPassRate, topRejectionReasons, recentRecords: [...records].slice(-20) }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/use-cases/ComputeQualityMetrics.test.ts --verbose`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/ComputeQualityMetrics.ts tests/use-cases/ComputeQualityMetrics.test.ts
git commit -m "feat(phase4): add ComputeQualityMetrics use case"
```

---

## Task 9: ComputePhaseTimings Use Case

**Files:**
- Create: `src/use-cases/ComputePhaseTimings.ts`
- Test: `tests/use-cases/ComputePhaseTimings.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/use-cases/ComputePhaseTimings.test.ts
import { ComputePhaseTimings } from "@use-cases/ComputePhaseTimings"
import { InMemoryEventStore } from "@adapters/storage/InMemoryEventStore"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { createTask } from "@entities/Task"
import { createTaskId, createGoalId, createAgentId, createEventId } from "@entities/ids"
import { createBudget } from "@entities/Budget"

describe("ComputePhaseTimings", () => {
  it("computes average duration per phase from task.assigned/task.completed events", async () => {
    const eventStore = new InMemoryEventStore()
    const taskRepo = new InMemoryTaskRepo()
    const taskId = createTaskId("t-1")
    await taskRepo.create(createTask({ id: taskId, goalId: createGoalId(), description: "d", phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1 }) }))
    const base = new Date("2026-01-01T00:00:00Z")
    await eventStore.append({ id: createEventId(), type: "task.assigned", agentId: createAgentId("dev-1"), taskId, goalId: null, cost: null, occurredAt: base, payload: {} })
    await eventStore.append({ id: createEventId(), type: "task.completed", agentId: createAgentId("dev-1"), taskId, goalId: null, cost: null, occurredAt: new Date(base.getTime() + 5000), payload: {} })
    const uc = new ComputePhaseTimings(eventStore, taskRepo)
    const report = await uc.execute()
    expect(report.avgDurationByPhase["code"]).toBe(5000)
  })
})
```

- [ ] **Step 2: Implement ComputePhaseTimings**

```typescript
// src/use-cases/ComputePhaseTimings.ts
import type { EventStore } from "./ports/EventStore"
import type { TaskRepository } from "./ports/TaskRepository"
import type { MetricsFilter } from "../entities/MetricsFilter"
import type { TimingsReport } from "../entities/Reports"

const STALL_THRESHOLD_MS = 120_000

export class ComputePhaseTimings {
  constructor(
    private readonly events: EventStore,
    private readonly tasks: TaskRepository,
  ) {}

  async execute(filter?: MetricsFilter): Promise<TimingsReport> {
    const allEvents = await this.events.findAll()
    const allTasks = await this.tasks.findAll()
    const taskPhase = new Map<string, string>()
    for (const t of allTasks) {
      if (filter?.goalId && t.goalId !== filter.goalId) continue
      taskPhase.set(t.id, t.phase)
    }

    const assigned = new Map<string, Date>()
    const durations = new Map<string, number[]>()
    const tokensByAgent = new Map<string, { tokens: number; tasks: number }>()

    for (const event of allEvents) {
      if (event.type === "task.assigned" && event.taskId) {
        assigned.set(event.taskId, event.occurredAt)
      }
      if (event.type === "task.completed" && event.taskId) {
        const start = assigned.get(event.taskId)
        const phase = taskPhase.get(event.taskId)
        if (start && phase) {
          const dur = event.occurredAt.getTime() - start.getTime()
          const arr = durations.get(phase) ?? []
          arr.push(dur)
          durations.set(phase, arr)
        }
        if (event.agentId && event.cost) {
          const key = event.agentId as string
          const entry = tokensByAgent.get(key) ?? { tokens: 0, tasks: 0 }
          entry.tokens += event.cost.totalTokens
          entry.tasks++
          tokensByAgent.set(key, entry)
        }
      }
    }

    const avgDurationByPhase: Record<string, number> = {}
    const stalledPhases: Array<{ phase: string; avgMs: number; threshold: number }> = []
    for (const [phase, durs] of durations) {
      const avg = durs.reduce((a, b) => a + b, 0) / durs.length
      avgDurationByPhase[phase] = avg
      if (avg > STALL_THRESHOLD_MS) {
        stalledPhases.push({ phase, avgMs: avg, threshold: STALL_THRESHOLD_MS })
      }
    }

    const agentEfficiency: Record<string, number> = {}
    for (const [agent, data] of tokensByAgent) {
      agentEfficiency[agent] = data.tasks > 0 ? data.tokens / data.tasks : 0
    }

    return { avgDurationByPhase, stalledPhases, agentEfficiency }
  }
}
```

- [ ] **Step 3: Run test**

Run: `npx jest tests/use-cases/ComputePhaseTimings.test.ts --verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/use-cases/ComputePhaseTimings.ts tests/use-cases/ComputePhaseTimings.test.ts
git commit -m "feat(phase4): add ComputePhaseTimings use case"
```

---

## Task 10: AcceptInsight + DismissInsight Use Cases

**Files:**
- Create: `src/use-cases/AcceptInsight.ts`
- Create: `src/use-cases/DismissInsight.ts`
- Test: `tests/use-cases/AcceptInsight.test.ts`
- Test: `tests/use-cases/DismissInsight.test.ts`

- [ ] **Step 1: Write AcceptInsight test**

```typescript
// tests/use-cases/AcceptInsight.test.ts
import { AcceptInsight } from "@use-cases/AcceptInsight"
import { InMemoryInsightRepository } from "@adapters/storage/InMemoryInsightRepository"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryBudgetConfigStore } from "@adapters/storage/InMemoryBudgetConfigStore"
import { NoOpNotificationAdapter } from "@adapters/notifications/NoOpNotificationAdapter"
import { createInsight } from "@entities/Insight"
import { createInsightId } from "@entities/ids"

describe("AcceptInsight", () => {
  it("applies budget_tune via BudgetConfigStore and sets status to applied", async () => {
    const insightRepo = new InMemoryInsightRepository()
    const budgetStore = new InMemoryBudgetConfigStore()
    const bus = new InMemoryBus()
    const insight = createInsight({
      id: createInsightId("i-1"), title: "Lower dev budget", description: "d", evidence: "e",
      proposedAction: { kind: "budget_tune", role: "developer", currentMaxTokens: 10000, currentMaxCostUsd: 1.0, newMaxTokens: 7000, newMaxCostUsd: 0.7 },
    })
    await insightRepo.save(insight)

    const uc = new AcceptInsight(insightRepo, { read: async () => "", update: async () => {} }, budgetStore, { findAvailable: async () => null, findById: async () => null, register: async () => {}, updateStatus: async () => {}, updateModel: async () => {}, findAll: async () => [] }, { read: async () => "", update: async () => {}, list: async () => [] }, bus, new NoOpNotificationAdapter())
    await uc.execute(createInsightId("i-1"))

    const updated = await insightRepo.findById(createInsightId("i-1"))
    expect(updated?.status).toBe("applied")
    expect(updated?.resolvedAt).not.toBeNull()
    const budget = await budgetStore.read("developer")
    expect(budget.maxTokens).toBe(7000)
    expect(budget.maxCostUsd).toBe(0.7)
  })

  it("throws if insight is not pending", async () => {
    const insightRepo = new InMemoryInsightRepository()
    const insight = { ...createInsight({ id: createInsightId("i-1"), title: "t", description: "d", evidence: "e", proposedAction: { kind: "process_change", description: "a" } }), status: "dismissed" as const, resolvedAt: new Date() }
    await insightRepo.save(insight)
    const uc = new AcceptInsight(insightRepo, { read: async () => "", update: async () => {} }, new InMemoryBudgetConfigStore(), { findAvailable: async () => null, findById: async () => null, register: async () => {}, updateStatus: async () => {}, updateModel: async () => {}, findAll: async () => [] }, { read: async () => "", update: async () => {}, list: async () => [] }, new InMemoryBus(), new NoOpNotificationAdapter())
    await expect(uc.execute(createInsightId("i-1"))).rejects.toThrow()
  })
})
```

- [ ] **Step 2: Implement AcceptInsight**

```typescript
// src/use-cases/AcceptInsight.ts
import type { InsightRepository } from "./ports/InsightRepository"
import type { AgentPromptStore } from "./ports/AgentPromptStore"
import type { BudgetConfigStore } from "./ports/BudgetConfigStore"
import type { AgentRegistry } from "./ports/AgentRegistry"
import type { SkillStore } from "./ports/SkillStore"
import type { MessagePort } from "./ports/MessagePort"
import type { NotificationPort } from "./ports/NotificationPort"
import type { InsightId } from "../entities/ids"
import { createMessageId } from "../entities/ids"

export class AcceptInsight {
  constructor(
    private readonly insightRepo: InsightRepository,
    private readonly promptStore: AgentPromptStore,
    private readonly budgetConfigStore: BudgetConfigStore,
    private readonly agentRegistry: AgentRegistry,
    private readonly skillStore: SkillStore,
    private readonly bus: MessagePort,
    private readonly notificationPort: NotificationPort,
  ) {}

  async execute(insightId: InsightId): Promise<void> {
    const insight = await this.insightRepo.findById(insightId)
    if (!insight) throw new Error(`Insight ${insightId} not found`)
    if (insight.status !== "pending") throw new Error(`Insight ${insightId} is ${insight.status}, not pending`)

    const action = insight.proposedAction
    switch (action.kind) {
      case "prompt_update":
        await this.promptStore.update(action.role, action.newContent, insight.title)
        break
      case "budget_tune":
        await this.budgetConfigStore.update(action.role, action.newMaxTokens, action.newMaxCostUsd)
        break
      case "model_reassign": {
        const agents = await this.agentRegistry.findAll()
        const agent = agents.find(a => a.role === action.role)
        if (agent) await this.agentRegistry.updateModel(agent.id, action.newModel)
        break
      }
      case "skill_update":
        await this.skillStore.update(action.skillName, action.newContent, insight.title)
        break
      case "process_change":
        break
    }

    await this.insightRepo.update({ ...insight, status: "applied", resolvedAt: new Date() })

    await this.bus.emit({ id: createMessageId(), type: "insight.accepted", insightId: insight.id, actionKind: action.kind, title: insight.title, timestamp: new Date() })
    await this.notificationPort.notify({ severity: "info", title: "Insight applied", body: insight.title, insightId: insight.id })
  }
}
```

- [ ] **Step 3: Write DismissInsight test**

```typescript
// tests/use-cases/DismissInsight.test.ts
import { DismissInsight } from "@use-cases/DismissInsight"
import { InMemoryInsightRepository } from "@adapters/storage/InMemoryInsightRepository"
import { createInsight } from "@entities/Insight"
import { createInsightId } from "@entities/ids"

describe("DismissInsight", () => {
  it("sets status to dismissed with resolvedAt", async () => {
    const repo = new InMemoryInsightRepository()
    await repo.save(createInsight({ id: createInsightId("i-1"), title: "t", description: "d", evidence: "e", proposedAction: { kind: "process_change", description: "a" } }))
    const uc = new DismissInsight(repo)
    await uc.execute(createInsightId("i-1"))
    const found = await repo.findById(createInsightId("i-1"))
    expect(found?.status).toBe("dismissed")
    expect(found?.resolvedAt).not.toBeNull()
  })
})
```

- [ ] **Step 4: Implement DismissInsight**

```typescript
// src/use-cases/DismissInsight.ts
import type { InsightRepository } from "./ports/InsightRepository"
import type { InsightId } from "../entities/ids"

export class DismissInsight {
  constructor(private readonly insightRepo: InsightRepository) {}

  async execute(insightId: InsightId): Promise<void> {
    const insight = await this.insightRepo.findById(insightId)
    if (!insight) throw new Error(`Insight ${insightId} not found`)
    if (insight.status !== "pending") throw new Error(`Insight ${insightId} is ${insight.status}, not pending`)
    await this.insightRepo.update({ ...insight, status: "dismissed", resolvedAt: new Date() })
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest tests/use-cases/AcceptInsight.test.ts tests/use-cases/DismissInsight.test.ts --verbose`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/use-cases/AcceptInsight.ts src/use-cases/DismissInsight.ts tests/use-cases/AcceptInsight.test.ts tests/use-cases/DismissInsight.test.ts
git commit -m "feat(phase4): add AcceptInsight and DismissInsight use cases"
```

---

## Task 11: EvaluateAlert Use Case

**Files:**
- Create: `src/use-cases/EvaluateAlert.ts`
- Test: `tests/use-cases/EvaluateAlert.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/use-cases/EvaluateAlert.test.ts
import { EvaluateAlert, type AlertRule } from "@use-cases/EvaluateAlert"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryAlertPreferencesStore } from "@adapters/storage/InMemoryAlertPreferencesStore"
import { NoOpNotificationAdapter } from "@adapters/notifications/NoOpNotificationAdapter"
import { createMessageId, createGoalId } from "@entities/ids"
import type { Message } from "@entities/Message"

describe("EvaluateAlert", () => {
  const rule: AlertRule = { trigger: "goal.completed", severity: "info", evaluate: (msg) => ({ severity: "info", title: "Goal done", body: "completed" }) }

  it("emits ceo.alert when rule matches", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({ types: ["ceo.alert"] }, async (m) => { emitted.push(m) })
    const uc = new EvaluateAlert(new NoOpNotificationAdapter(), new InMemoryAlertPreferencesStore(), bus, [rule])
    await uc.execute({ id: createMessageId(), type: "goal.completed", goalId: createGoalId(), costUsd: 0, timestamp: new Date() })
    expect(emitted).toHaveLength(1)
    expect(emitted[0]?.type).toBe("ceo.alert")
  })

  it("respects minSeverity preference", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({ types: ["ceo.alert"] }, async (m) => { emitted.push(m) })
    const prefsStore = new InMemoryAlertPreferencesStore()
    await prefsStore.update({ minSeverity: "warning", mutedTriggers: [] })
    const uc = new EvaluateAlert(new NoOpNotificationAdapter(), prefsStore, bus, [rule])
    await uc.execute({ id: createMessageId(), type: "goal.completed", goalId: createGoalId(), costUsd: 0, timestamp: new Date() })
    expect(emitted).toHaveLength(0)
  })

  it("does not emit for non-matching message types", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({ types: ["ceo.alert"] }, async (m) => { emitted.push(m) })
    const uc = new EvaluateAlert(new NoOpNotificationAdapter(), new InMemoryAlertPreferencesStore(), bus, [rule])
    await uc.execute({ id: createMessageId(), type: "task.created", taskId: createGoalId() as any, goalId: createGoalId(), description: "x", timestamp: new Date() })
    expect(emitted).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Implement EvaluateAlert**

```typescript
// src/use-cases/EvaluateAlert.ts
import type { NotificationPort, CeoAlert } from "./ports/NotificationPort"
import type { AlertPreferencesStore } from "./ports/AlertPreferencesStore"
import type { MessagePort } from "./ports/MessagePort"
import type { Message, MessageType } from "../entities/Message"
import { severityRank } from "../entities/AlertPreferences"
import { createMessageId } from "../entities/ids"

export interface AlertRule {
  readonly trigger: MessageType
  readonly severity: "info" | "warning" | "urgent"
  readonly evaluate: (message: Message) => CeoAlert | null
}

export class EvaluateAlert {
  constructor(
    private readonly notificationPort: NotificationPort,
    private readonly alertPreferencesStore: AlertPreferencesStore,
    private readonly bus: MessagePort,
    private readonly rules: ReadonlyArray<AlertRule>,
  ) {}

  async execute(message: Message): Promise<void> {
    const prefs = await this.alertPreferencesStore.read()

    for (const rule of this.rules) {
      if (rule.trigger !== message.type) continue
      const alert = rule.evaluate(message)
      if (!alert) continue
      if (severityRank(alert.severity) < severityRank(prefs.minSeverity)) continue
      if (prefs.mutedTriggers.includes(rule.trigger)) continue

      await this.bus.emit({
        id: createMessageId(),
        type: "ceo.alert",
        severity: alert.severity,
        title: alert.title,
        body: alert.body,
        goalId: alert.goalId,
        taskId: alert.taskId,
        insightId: alert.insightId as string | undefined,
        timestamp: new Date(),
      })

      await this.notificationPort.notify(alert)
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest tests/use-cases/EvaluateAlert.test.ts --verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/use-cases/EvaluateAlert.ts tests/use-cases/EvaluateAlert.test.ts
git commit -m "feat(phase4): add EvaluateAlert use case with rules engine"
```

---

## Task 12: toSystemEvent Helper + Universal Event Persistence

**Files:**
- Create: `src/infrastructure/config/toSystemEvent.ts`
- Test: `tests/infrastructure/toSystemEvent.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/infrastructure/toSystemEvent.test.ts
import { toSystemEvent } from "@infrastructure/config/toSystemEvent"
import { createMessageId, createGoalId, createAgentId, createTaskId } from "@entities/ids"
import type { Message } from "@entities/Message"

describe("toSystemEvent", () => {
  it("extracts agentId, taskId, goalId from message", () => {
    const msg: Message = { id: createMessageId(), type: "task.assigned", taskId: createTaskId("t-1"), agentId: createAgentId("dev-1"), timestamp: new Date() }
    const event = toSystemEvent(msg)
    expect(event.type).toBe("task.assigned")
    expect(event.taskId).toBe("t-1")
    expect(event.agentId).toBe("dev-1")
    expect(event.goalId).toBeNull()
  })

  it("sets cost to null when message has no cost field", () => {
    const msg: Message = { id: createMessageId(), type: "goal.completed", goalId: createGoalId("g-1"), costUsd: 0.5, timestamp: new Date() }
    const event = toSystemEvent(msg)
    expect(event.cost).toBeNull()
    expect(event.goalId).toBe("g-1")
  })
})
```

- [ ] **Step 2: Implement toSystemEvent**

```typescript
// src/infrastructure/config/toSystemEvent.ts
import type { Message } from "../../entities/Message"
import type { SystemEvent } from "../../entities/Event"
import type { AgentId, GoalId, TaskId } from "../../entities/ids"
import { createEventId } from "../../entities/ids"

export function toSystemEvent(message: Message): SystemEvent {
  const agentId = "agentId" in message ? (message as { agentId: AgentId }).agentId : null
  const taskId = "taskId" in message ? (message as { taskId: TaskId }).taskId : null
  const goalId = "goalId" in message ? (message as { goalId: GoalId }).goalId : null

  return {
    id: createEventId(),
    type: message.type,
    agentId,
    taskId,
    goalId,
    cost: null,
    occurredAt: message.timestamp,
    payload: message,
  }
}
```

- [ ] **Step 3: Run test**

Run: `npx jest tests/infrastructure/toSystemEvent.test.ts --verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/config/toSystemEvent.ts tests/infrastructure/toSystemEvent.test.ts
git commit -m "feat(phase4): add toSystemEvent helper for universal event persistence"
```

---

## Task 13: Refactor LearnerPlugin

**Files:**
- Modify: `src/adapters/plugins/agents/LearnerPlugin.ts`
- Modify: `tests/adapters/LearnerPlugin.test.ts`

- [ ] **Step 1: Rewrite LearnerPlugin**

Replace the full content of `src/adapters/plugins/agents/LearnerPlugin.ts`:

```typescript
import type { AgentId, GoalId, TaskId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { KeepDiscardRepository } from "../../../use-cases/ports/KeepDiscardRepository"
import { createKeepDiscardRecord } from "../../../entities/KeepDiscardRecord"

export interface LearnerPluginDeps {
  readonly agentId: AgentId
  readonly bus: MessagePort
  readonly taskRepo: TaskRepository
  readonly keepDiscardRepo: KeepDiscardRepository
  readonly onGoalCompleted?: () => Promise<void>
}

export class LearnerPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "learner-agent"
  readonly version = "1.0.0"
  readonly description = "Learner agent that records verdicts and triggers analysis"

  private readonly deps: LearnerPluginDeps

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
        "review.approved",
        "review.rejected",
        "goal.completed",
      ],
    }]
  }

  async handle(message: Message): Promise<void> {
    switch (message.type) {
      case "review.approved":
        return this.handleReviewVerdict(message.taskId, "approved", [])
      case "review.rejected":
        return this.handleReviewVerdict(message.taskId, "rejected", [...message.reasons])
      case "goal.completed":
        if (this.deps.onGoalCompleted) await this.deps.onGoalCompleted()
        return
    }
  }

  private async handleReviewVerdict(
    taskId: TaskId,
    verdict: "approved" | "rejected",
    reasons: string[],
  ): Promise<void> {
    const task = await this.deps.taskRepo.findById(taskId)
    if (!task) return

    const record = createKeepDiscardRecord({
      taskId: task.id,
      goalId: task.goalId,
      agentId: task.assignedTo ?? this.deps.agentId,
      phase: task.phase,
      durationMs: 0,
      tokensUsed: task.tokensUsed,
      costUsd: 0,
      verdict,
      reasons,
      artifactIds: [...task.artifacts],
      commitHash: null,
      iteration: task.retryCount + 1,
    })

    await this.deps.keepDiscardRepo.save(record)
  }
}
```

- [ ] **Step 2: Update LearnerPlugin tests**

Replace `tests/adapters/LearnerPlugin.test.ts`:

```typescript
import { LearnerPlugin } from "@adapters/plugins/agents/LearnerPlugin"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { InMemoryKeepDiscardRepository } from "@adapters/storage/InMemoryKeepDiscardRepository"
import { createTask } from "@entities/Task"
import { createAgentId, createTaskId, createGoalId, createMessageId } from "@entities/ids"
import { createBudget } from "@entities/Budget"

describe("LearnerPlugin", () => {
  it("subscribes to review.approved, review.rejected, goal.completed only", () => {
    const plugin = createTestLearnerPlugin()
    const types = plugin.subscriptions().flatMap(s => s.types ?? [])
    expect(types).toEqual(["review.approved", "review.rejected", "goal.completed"])
  })

  it("saves KeepDiscardRecord to repository on review.approved", async () => {
    const keepDiscardRepo = new InMemoryKeepDiscardRepository()
    const taskRepo = new InMemoryTaskRepo()
    await taskRepo.create(createTask({ id: createTaskId("t-1"), goalId: createGoalId("g-1"), description: "test", phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }), assignedTo: createAgentId("dev-1") }))
    const plugin = createTestLearnerPlugin({ keepDiscardRepo, taskRepo })
    await plugin.handle({ id: createMessageId(), type: "review.approved", taskId: createTaskId("t-1"), reviewerId: createAgentId("rev-1"), timestamp: new Date() })
    const records = await keepDiscardRepo.findAll()
    expect(records).toHaveLength(1)
    expect(records[0]?.verdict).toBe("approved")
    expect(records[0]?.goalId).toBe("g-1")
  })

  it("saves KeepDiscardRecord on review.rejected with reasons", async () => {
    const keepDiscardRepo = new InMemoryKeepDiscardRepository()
    const taskRepo = new InMemoryTaskRepo()
    await taskRepo.create(createTask({ id: createTaskId("t-1"), goalId: createGoalId(), description: "test", phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }), assignedTo: createAgentId("dev-1") }))
    const plugin = createTestLearnerPlugin({ keepDiscardRepo, taskRepo })
    await plugin.handle({ id: createMessageId(), type: "review.rejected", taskId: createTaskId("t-1"), reviewerId: createAgentId("rev-1"), reasons: ["no tests", "bad naming"], timestamp: new Date() })
    const records = await keepDiscardRepo.findAll()
    expect(records).toHaveLength(1)
    expect(records[0]?.verdict).toBe("rejected")
    expect(records[0]?.reasons).toEqual(["no tests", "bad naming"])
  })

  it("calls onGoalCompleted callback on goal.completed", async () => {
    let called = false
    const plugin = createTestLearnerPlugin({ onGoalCompleted: async () => { called = true } })
    await plugin.handle({ id: createMessageId(), type: "goal.completed", goalId: createGoalId("g-1"), costUsd: 0.5, timestamp: new Date() })
    expect(called).toBe(true)
  })
})

function createTestLearnerPlugin(overrides: Record<string, unknown> = {}): LearnerPlugin {
  return new LearnerPlugin({
    agentId: createAgentId("learner-1"),
    bus: (overrides["bus"] as any) ?? new InMemoryBus(),
    taskRepo: (overrides["taskRepo"] as any) ?? new InMemoryTaskRepo(),
    keepDiscardRepo: (overrides["keepDiscardRepo"] as any) ?? new InMemoryKeepDiscardRepository(),
    onGoalCompleted: overrides["onGoalCompleted"] as any,
  })
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest tests/adapters/LearnerPlugin.test.ts --verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/adapters/plugins/agents/LearnerPlugin.ts tests/adapters/LearnerPlugin.test.ts
git commit -m "refactor(phase4): LearnerPlugin uses KeepDiscardRepository, narrowed subscriptions"
```

---

## Task 14: Integration Layer — DTOs, Routes, Server, Composition Root (Atomic)

> **IMPORTANT:** This task modifies MetricsPresenter constructor, metricsRoutes signature, DashboardDeps, and composition root in a SINGLE COMMIT. These changes are interdependent — committing them separately produces broken intermediate states.

**Files:**
- Modify: `src/adapters/presenters/dto.ts`
- Modify: `src/adapters/presenters/MetricsPresenter.ts`
- Modify: `tests/adapters/presenters/MetricsPresenter.test.ts`
- Create: `src/infrastructure/http/routes/insightRoutes.ts`
- Create: `src/infrastructure/http/routes/alertRoutes.ts`
- Create: `src/infrastructure/http/routes/systemRoutes.ts`
- Modify: `src/infrastructure/http/routes/metricsRoutes.ts`
- Modify: `src/infrastructure/http/createServer.ts`
- Modify: `src/infrastructure/config/composition-root.ts`
- Modify: `tests/infrastructure/http/routes.test.ts` (if it constructs MetricsPresenter)

- [ ] **Step 1: Add new DTOs to dto.ts**

Append to `src/adapters/presenters/dto.ts`:

```typescript
import type { ProposedAction } from "../../entities/Insight"

export interface FinancialsDTO {
  readonly totalTokensUsed: number
  readonly totalCostUsd: number
  readonly costPerGoal: ReadonlyArray<{ goalId: string; costUsd: number }>
  readonly agentTokenBreakdown: Record<string, number>
  readonly modelTierBreakdown: Record<string, number>
}

export interface QualityDTO {
  readonly overallKeepRate: number
  readonly keepRateByAgent: Record<string, number>
  readonly reviewPassRate: number
  readonly topRejectionReasons: ReadonlyArray<{ reason: string; count: number }>
}

export interface TimingsDTO {
  readonly avgDurationByPhase: Record<string, number>
  readonly stalledPhases: ReadonlyArray<{ phase: string; avgMs: number; threshold: number }>
  readonly agentEfficiency: Record<string, number>
}

export interface InsightSummaryDTO {
  readonly id: string
  readonly title: string
  readonly actionKind: string
  readonly status: string
  readonly createdAt: string
}

export interface InsightDetailDTO {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly evidence: string
  readonly proposedAction: ProposedAction
  readonly status: string
  readonly createdAt: string
  readonly resolvedAt: string | null
}

export interface CeoAlertDTO {
  readonly severity: "info" | "warning" | "urgent"
  readonly title: string
  readonly body: string
  readonly goalId: string | null
  readonly taskId: string | null
  readonly insightId: string | null
  readonly timestamp: string
}

export interface AlertPreferencesDTO {
  readonly minSeverity: "info" | "warning" | "urgent"
  readonly mutedTriggers: ReadonlyArray<string>
}

export interface PluginHealthDTO {
  readonly name: string
  readonly status: "healthy" | "degraded" | "unhealthy"
}
```

- [ ] **Step 2: Refactor MetricsPresenter**

Replace `src/adapters/presenters/MetricsPresenter.ts`:

```typescript
import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import type { ComputeFinancials } from "../../use-cases/ComputeFinancials"
import type { MetricsSummaryDTO } from "./dto"

export class MetricsPresenter {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly computeFinancials: ComputeFinancials,
  ) {}

  async present(): Promise<MetricsSummaryDTO> {
    const [allTasks, financials] = await Promise.all([this.tasks.findAll(), this.computeFinancials.execute()])
    let activeTaskCount = 0, completedTaskCount = 0
    for (const task of allTasks) {
      if (task.status === "in_progress" || task.status === "review") activeTaskCount++
      if (task.status === "merged") completedTaskCount++
    }
    return {
      totalTokensUsed: financials.totalTokensUsed,
      totalCostUsd: financials.totalCostUsd,
      activeTaskCount,
      completedTaskCount,
      agentTokenBreakdown: financials.agentTokenBreakdown,
    }
  }
}
```

- [ ] **Step 3: Update MetricsPresenter test**

In `tests/adapters/presenters/MetricsPresenter.test.ts`, change all `new MetricsPresenter(taskRepo, eventStore)` to `new MetricsPresenter(taskRepo, new ComputeFinancials(eventStore))`. Add import:

```typescript
import { ComputeFinancials } from "@use-cases/ComputeFinancials"
```

- [ ] **Step 4: Create insightRoutes.ts**

```typescript
// src/infrastructure/http/routes/insightRoutes.ts
import { Router } from "express"
import type { InsightRepository } from "../../../use-cases/ports/InsightRepository"
import type { AcceptInsight } from "../../../use-cases/AcceptInsight"
import type { DismissInsight } from "../../../use-cases/DismissInsight"
import type { InsightId } from "../../../entities/ids"
import type { InsightSummaryDTO, InsightDetailDTO } from "../../../adapters/presenters/dto"
import type { InsightStatus } from "../../../entities/Insight"

export function insightRoutes(repo: InsightRepository, accept: AcceptInsight, dismiss: DismissInsight): Router {
  const router = Router()

  router.get("/", async (req, res, next) => {
    try {
      const status = req.query.status as InsightStatus | undefined
      const insights = status ? await repo.findByStatus(status) : await repo.findAll()
      const dtos: InsightSummaryDTO[] = insights.map(i => ({
        id: i.id, title: i.title, actionKind: i.proposedAction.kind, status: i.status, createdAt: i.createdAt.toISOString(),
      }))
      res.json(dtos)
    } catch (err) { next(err) }
  })

  router.get("/:id", async (req, res, next) => {
    try {
      const insight = await repo.findById(req.params.id as InsightId)
      if (!insight) return res.status(404).json({ error: "Not found" })
      const dto: InsightDetailDTO = {
        id: insight.id, title: insight.title, description: insight.description,
        evidence: insight.evidence, proposedAction: insight.proposedAction,
        status: insight.status, createdAt: insight.createdAt.toISOString(),
        resolvedAt: insight.resolvedAt?.toISOString() ?? null,
      }
      res.json(dto)
    } catch (err) { next(err) }
  })

  router.post("/:id/accept", async (req, res, next) => {
    try { await accept.execute(req.params.id as InsightId); res.json({ status: "applied" }) } catch (err) { next(err) }
  })

  router.post("/:id/dismiss", async (req, res, next) => {
    try { await dismiss.execute(req.params.id as InsightId); res.json({ status: "dismissed" }) } catch (err) { next(err) }
  })

  return router
}
```

- [ ] **Step 5: Create alertRoutes.ts**

```typescript
// src/infrastructure/http/routes/alertRoutes.ts
import { Router } from "express"
import type { EventStore } from "../../../use-cases/ports/EventStore"
import type { AlertPreferencesStore } from "../../../use-cases/ports/AlertPreferencesStore"
import type { CeoAlertDTO } from "../../../adapters/presenters/dto"

export function alertRoutes(eventStore: EventStore, prefsStore: AlertPreferencesStore): Router {
  const router = Router()

  router.get("/", async (_req, res, next) => {
    try {
      const events = await eventStore.findAll({ types: ["ceo.alert"], limit: 50 })
      const dtos: CeoAlertDTO[] = events.map(e => {
        const p = e.payload as Record<string, unknown>
        return {
          severity: (p.severity as string) as "info" | "warning" | "urgent",
          title: p.title as string, body: p.body as string,
          goalId: (p.goalId as string) ?? null, taskId: (p.taskId as string) ?? null,
          insightId: (p.insightId as string) ?? null, timestamp: e.occurredAt.toISOString(),
        }
      })
      res.json(dtos)
    } catch (err) { next(err) }
  })

  router.get("/preferences", async (_req, res, next) => {
    try { res.json(await prefsStore.read()) } catch (err) { next(err) }
  })

  router.put("/preferences", async (req, res, next) => {
    try { await prefsStore.update(req.body); res.json({ status: "ok" }) } catch (err) { next(err) }
  })

  return router
}
```

- [ ] **Step 6: Create systemRoutes.ts**

```typescript
// src/infrastructure/http/routes/systemRoutes.ts
import { Router } from "express"
import type { PluginRegistry } from "../../../adapters/plugins/PluginRegistry"

export function systemRoutes(pluginRegistry: PluginRegistry): Router {
  const router = Router()

  router.get("/health", async (_req, res, next) => {
    try {
      const plugins = pluginRegistry.discover()
      const results = await Promise.all(plugins.map(async (p) => ({
        name: p.identity.name,
        status: await p.lifecycle.healthCheck(),
      })))
      res.json(results)
    } catch (err) { next(err) }
  })

  return router
}
```

- [ ] **Step 7: Update metricsRoutes.ts**

Replace `src/infrastructure/http/routes/metricsRoutes.ts`:

```typescript
import { Router } from "express"
import type { MetricsPresenter } from "../../../adapters/presenters/MetricsPresenter"
import type { ComputeFinancials } from "../../../use-cases/ComputeFinancials"
import type { ComputeQualityMetrics } from "../../../use-cases/ComputeQualityMetrics"
import type { ComputePhaseTimings } from "../../../use-cases/ComputePhaseTimings"
import type { MetricsFilter } from "../../../entities/MetricsFilter"
import type { GoalId, AgentId } from "../../../entities/ids"

function parseFilter(query: Record<string, unknown>): MetricsFilter | undefined {
  const filter: MetricsFilter = {}
  if (query.goalId) (filter as any).goalId = query.goalId as GoalId
  if (query.agentId) (filter as any).agentId = query.agentId as AgentId
  if (query.since) (filter as any).since = new Date(query.since as string)
  if (query.until) (filter as any).until = new Date(query.until as string)
  return Object.keys(filter).length > 0 ? filter : undefined
}

export function metricsRoutes(
  metrics: MetricsPresenter,
  financials: ComputeFinancials,
  quality: ComputeQualityMetrics,
  timings: ComputePhaseTimings,
): Router {
  const router = Router()

  router.get("/", async (_req, res, next) => {
    try { res.json(await metrics.present()) } catch (err) { next(err) }
  })

  router.get("/financials", async (req, res, next) => {
    try { res.json(await financials.execute(parseFilter(req.query as Record<string, unknown>))) } catch (err) { next(err) }
  })

  router.get("/quality", async (req, res, next) => {
    try { res.json(await quality.execute(parseFilter(req.query as Record<string, unknown>))) } catch (err) { next(err) }
  })

  router.get("/timings", async (req, res, next) => {
    try { res.json(await timings.execute(parseFilter(req.query as Record<string, unknown>))) } catch (err) { next(err) }
  })

  return router
}
```

- [ ] **Step 8: Update createServer.ts**

Replace the full content of `src/infrastructure/http/createServer.ts`:

```typescript
import express from "express"
import cors from "cors"
import type { Express, Request, Response, NextFunction } from "express"
import type { AgentRegistry } from "../../use-cases/ports/AgentRegistry"
import type { GoalRepository } from "../../use-cases/ports/GoalRepository"
import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import type { EventStore } from "../../use-cases/ports/EventStore"
import type { InsightRepository } from "../../use-cases/ports/InsightRepository"
import type { AlertPreferencesStore } from "../../use-cases/ports/AlertPreferencesStore"
import type { CreateGoalFromCeo } from "../../use-cases/CreateGoalFromCeo"
import type { PauseAgent } from "../../use-cases/PauseAgent"
import type { AcceptInsight } from "../../use-cases/AcceptInsight"
import type { DismissInsight } from "../../use-cases/DismissInsight"
import type { ComputeFinancials } from "../../use-cases/ComputeFinancials"
import type { ComputeQualityMetrics } from "../../use-cases/ComputeQualityMetrics"
import type { ComputePhaseTimings } from "../../use-cases/ComputePhaseTimings"
import type { LiveFloorPresenter } from "../../adapters/presenters/LiveFloorPresenter"
import type { PipelinePresenter } from "../../adapters/presenters/PipelinePresenter"
import type { MetricsPresenter } from "../../adapters/presenters/MetricsPresenter"
import type { PluginRegistry } from "../../adapters/plugins/PluginRegistry"
import type { SSEManager } from "./sseManager"
import { agentRoutes } from "./routes/agentRoutes"
import { goalRoutes } from "./routes/goalRoutes"
import { taskRoutes } from "./routes/taskRoutes"
import { eventRoutes } from "./routes/eventRoutes"
import { metricsRoutes } from "./routes/metricsRoutes"
import { insightRoutes } from "./routes/insightRoutes"
import { alertRoutes } from "./routes/alertRoutes"
import { systemRoutes } from "./routes/systemRoutes"

export interface DashboardDeps {
  readonly agentRegistry: AgentRegistry
  readonly goalRepo: GoalRepository
  readonly taskRepo: TaskRepository
  readonly eventStore: EventStore
  readonly createGoal: CreateGoalFromCeo
  readonly pauseAgent: PauseAgent
  readonly liveFloor: LiveFloorPresenter
  readonly pipeline: PipelinePresenter
  readonly metrics: MetricsPresenter
  readonly sseManager: SSEManager
  readonly pluginRegistry: PluginRegistry
  readonly insightRepo: InsightRepository
  readonly acceptInsight: AcceptInsight
  readonly dismissInsight: DismissInsight
  readonly computeFinancials: ComputeFinancials
  readonly computeQuality: ComputeQualityMetrics
  readonly computeTimings: ComputePhaseTimings
  readonly alertPreferencesStore: AlertPreferencesStore
}

export function createServer(deps: DashboardDeps): Express {
  const app = express()

  app.use(cors())
  app.use(express.json())

  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() })
  })

  app.use("/api/agents", agentRoutes(deps.agentRegistry, deps.pauseAgent))
  app.use("/api/goals", goalRoutes(deps.goalRepo, deps.createGoal))
  app.use("/api/tasks", taskRoutes(deps.taskRepo))
  app.use("/api/events", eventRoutes(deps.eventStore, deps.sseManager))
  app.use("/api/metrics", metricsRoutes(deps.metrics, deps.computeFinancials, deps.computeQuality, deps.computeTimings))
  app.use("/api/insights", insightRoutes(deps.insightRepo, deps.acceptInsight, deps.dismissInsight))
  app.use("/api/alerts", alertRoutes(deps.eventStore, deps.alertPreferencesStore))
  app.use("/api/system", systemRoutes(deps.pluginRegistry))

  app.get("/api/live-floor", async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json(await deps.liveFloor.present()) } catch (err) { next(err) }
  })

  app.get("/api/pipeline", async (_req: Request, res: Response, next: NextFunction) => {
    try { res.json(await deps.pipeline.present()) } catch (err) { next(err) }
  })

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[HTTP]", err.message)
    res.status(500).json({ error: "Internal server error" })
  })

  return app
}
```

- [ ] **Step 9: Update composition root**

Apply the following changes to `src/infrastructure/config/composition-root.ts`. The implementing agent should read the current file first, then apply these changes:

**Add imports** (after existing imports):

```typescript
import { InMemoryKeepDiscardRepository } from "../../adapters/storage/InMemoryKeepDiscardRepository"
import { InMemoryInsightRepository } from "../../adapters/storage/InMemoryInsightRepository"
import { InMemoryBudgetConfigStore } from "../../adapters/storage/InMemoryBudgetConfigStore"
import { InMemoryAlertPreferencesStore } from "../../adapters/storage/InMemoryAlertPreferencesStore"
import { FileSystemAgentPromptStore } from "../../adapters/filesystem/FileSystemAgentPromptStore"
import { FileSystemSkillStore } from "../../adapters/filesystem/FileSystemSkillStore"
import { NoOpNotificationAdapter } from "../../adapters/notifications/NoOpNotificationAdapter"
import { ComputeFinancials } from "../../use-cases/ComputeFinancials"
import { ComputeQualityMetrics } from "../../use-cases/ComputeQualityMetrics"
import { ComputePhaseTimings } from "../../use-cases/ComputePhaseTimings"
import { AcceptInsight } from "../../use-cases/AcceptInsight"
import { DismissInsight } from "../../use-cases/DismissInsight"
import { EvaluateAlert, type AlertRule } from "../../use-cases/EvaluateAlert"
import { toSystemEvent } from "./toSystemEvent"
import { join } from "node:path"
```

**Add after existing storage creation** (after `const artifactRepo = ...`):

```typescript
const keepDiscardRepo = new InMemoryKeepDiscardRepository()
const insightRepo = new InMemoryInsightRepository()
const budgetConfigStore = new InMemoryBudgetConfigStore()
const alertPreferencesStore = new InMemoryAlertPreferencesStore()
const agentPromptStore = new FileSystemAgentPromptStore(join(config.workspaceDir, "agent-prompts"))
const skillStore = new FileSystemSkillStore(join(config.workspaceDir, "skills"))
const notificationPort = new NoOpNotificationAdapter()
```

**Add after existing use case creation** (after `const agentTimeoutMs = ...`):

```typescript
const computeFinancials = new ComputeFinancials(eventStore)
const computeQuality = new ComputeQualityMetrics(keepDiscardRepo)
const computeTimings = new ComputePhaseTimings(eventStore, taskRepo)
const acceptInsight = new AcceptInsight(insightRepo, agentPromptStore, budgetConfigStore, agentRegistry, skillStore, bus, notificationPort)
const dismissInsight = new DismissInsight(insightRepo)
```

**Replace** the `learnerPlugin` construction:

```typescript
const learnerPlugin = new LearnerPlugin({
  agentId: learnerId,
  bus,
  taskRepo,
  keepDiscardRepo,
})
```

**Replace** the `metricsPresenter` construction:

```typescript
const metricsPresenter = new MetricsPresenter(taskRepo, computeFinancials)
```

**Add** universal event persistence and alert wiring (before `const dashboardDeps`):

```typescript
// Universal event persistence — replaces LearnerPlugin.recordSystemEvent
bus.subscribe({}, async (message) => {
  await eventStore.append(toSystemEvent(message))
})

// Alert rules
const alertRules: ReadonlyArray<AlertRule> = [
  { trigger: "goal.completed", severity: "info", evaluate: (msg) => ({ severity: "info", title: "Goal completed", body: "Goal finished", goalId: "goalId" in msg ? (msg as any).goalId : undefined }) },
  { trigger: "agent.stuck", severity: "warning", evaluate: (msg) => ({ severity: "warning", title: "Agent stuck", body: "Agent stuck after retries", taskId: "taskId" in msg ? (msg as any).taskId : undefined }) },
  { trigger: "budget.exceeded", severity: "warning", evaluate: (msg) => ({ severity: "warning", title: "Budget exceeded", body: "Task exceeded budget", taskId: "taskId" in msg ? (msg as any).taskId : undefined }) },
  { trigger: "review.rejected", severity: "urgent", evaluate: (msg) => { if (!("retryCount" in msg) || (msg as any).retryCount < 3) return null; return { severity: "urgent", title: "Rejection loop", body: "Task rejected 3+ times", taskId: "taskId" in msg ? (msg as any).taskId : undefined } } },
  { trigger: "insight.generated", severity: "info", evaluate: (msg) => ({ severity: "info", title: "New recommendation", body: "Learner has a suggestion", insightId: "insightId" in msg ? (msg as any).insightId : undefined }) },
  { trigger: "insight.accepted", severity: "info", evaluate: (msg) => ({ severity: "info", title: "Insight applied", body: "title" in msg ? (msg as any).title : "Applied", insightId: "insightId" in msg ? (msg as any).insightId : undefined }) },
]
const evaluateAlert = new EvaluateAlert(notificationPort, alertPreferencesStore, bus, alertRules)
bus.subscribe({ types: alertRules.map(r => r.trigger) }, (message) => evaluateAlert.execute(message))
```

**Extend** `dashboardDeps` — add after `sseManager`:

```typescript
pluginRegistry,
insightRepo,
acceptInsight,
dismissInsight,
computeFinancials,
computeQuality: computeQuality,
computeTimings: computeTimings,
alertPreferencesStore,
```

- [ ] **Step 10: Update any tests that construct MetricsPresenter or DashboardDeps**

Search for `new MetricsPresenter` and `DashboardDeps` in tests. Update constructor args. If `tests/infrastructure/http/routes.test.ts` constructs a DashboardDeps mock, add the new required fields.

- [ ] **Step 11: Run full test suite**

Run: `npx jest --verbose`
Expected: All tests PASS

- [ ] **Step 12: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 13: Commit**

```bash
git add src/adapters/presenters/dto.ts src/adapters/presenters/MetricsPresenter.ts src/infrastructure/http/routes/insightRoutes.ts src/infrastructure/http/routes/alertRoutes.ts src/infrastructure/http/routes/systemRoutes.ts src/infrastructure/http/routes/metricsRoutes.ts src/infrastructure/http/createServer.ts src/infrastructure/config/composition-root.ts tests/
git commit -m "feat(phase4): integration layer — DTOs, routes, server, composition root (atomic)"
```

---

## Task 18: Dashboard Types + API Client + Store

**Files:**
- Modify: `dashboard/src/lib/types.ts`
- Modify: `dashboard/src/lib/api.ts`
- Modify: `dashboard/src/lib/store.ts`

- [ ] **Step 1: Add new types to dashboard/src/lib/types.ts**

Append:

```typescript
// Phase 4 types
export interface FinancialsData { readonly totalTokensUsed: number; readonly totalCostUsd: number; readonly costPerGoal: ReadonlyArray<{ goalId: string; costUsd: number }>; readonly agentTokenBreakdown: Record<string, number>; readonly modelTierBreakdown: Record<string, number> }
export interface QualityData { readonly overallKeepRate: number; readonly keepRateByAgent: Record<string, number>; readonly reviewPassRate: number; readonly topRejectionReasons: ReadonlyArray<{ reason: string; count: number }> }
export interface TimingsData { readonly avgDurationByPhase: Record<string, number>; readonly stalledPhases: ReadonlyArray<{ phase: string; avgMs: number; threshold: number }>; readonly agentEfficiency: Record<string, number> }
export interface InsightSummary { readonly id: string; readonly title: string; readonly actionKind: string; readonly status: string; readonly createdAt: string }
export interface InsightDetail { readonly id: string; readonly title: string; readonly description: string; readonly evidence: string; readonly proposedAction: unknown; readonly status: string; readonly createdAt: string; readonly resolvedAt: string | null }
export interface CeoAlertData { readonly severity: "info" | "warning" | "urgent"; readonly title: string; readonly body: string; readonly goalId: string | null; readonly taskId: string | null; readonly insightId: string | null; readonly timestamp: string }
export interface AlertPreferencesData { readonly minSeverity: "info" | "warning" | "urgent"; readonly mutedTriggers: string[] }
export interface PluginHealth { readonly name: string; readonly status: "healthy" | "degraded" | "unhealthy" }
```

- [ ] **Step 2: Extend API client**

Append to `dashboard/src/lib/api.ts`:

```typescript
import type { FinancialsData, QualityData, TimingsData, InsightSummary, InsightDetail, CeoAlertData, AlertPreferencesData, PluginHealth } from "./types"

// Add to api object:
// financials: (filter?: Record<string,string>) => get<FinancialsData>("/metrics/financials" + toQuery(filter)),
// quality: (filter?: Record<string,string>) => get<QualityData>("/metrics/quality" + toQuery(filter)),
// timings: (filter?: Record<string,string>) => get<TimingsData>("/metrics/timings" + toQuery(filter)),
// insights: (status?: string) => get<InsightSummary[]>("/insights" + (status ? `?status=${status}` : "")),
// insight: (id: string) => get<InsightDetail>(`/insights/${id}`),
// acceptInsight: (id: string) => post<{ status: string }>(`/insights/${id}/accept`, {}),
// dismissInsight: (id: string) => post<{ status: string }>(`/insights/${id}/dismiss`, {}),
// alerts: () => get<CeoAlertData[]>("/alerts"),
// alertPreferences: () => get<AlertPreferencesData>("/alerts/preferences"),
// updateAlertPreferences: (prefs: AlertPreferencesData) => { return fetch(`${BASE}/alerts/preferences`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefs) }).then(r => r.json()) },
// systemHealth: () => get<PluginHealth[]>("/system/health"),
```

Add helper:

```typescript
function toQuery(params?: Record<string, string>): string {
  if (!params) return ""
  const qs = new URLSearchParams(params).toString()
  return qs ? `?${qs}` : ""
}
```

- [ ] **Step 3: Extend Zustand store with alerts state**

Add to `dashboard/src/lib/store.ts`:

```typescript
// Add to DashboardState interface:
// alerts: readonly CeoAlertData[]; unreadAlertCount: number; fetchAlerts: () => Promise<void>; handleAlertSSE: (event: SSEEvent) => void

// Add to create() initial state:
// alerts: [], unreadAlertCount: 0,
// fetchAlerts: async () => { const alerts = await api.alerts(); set({ alerts }) },
// handleAlertSSE: (event: SSEEvent) => { if (event.type === "ceo.alert") { set((state) => ({ alerts: [{ severity: (event as any).severity ?? "info", title: (event as any).title ?? "", body: (event as any).body ?? "", goalId: event.goalId ?? null, taskId: event.taskId ?? null, insightId: (event as any).insightId ?? null, timestamp: event.timestamp }, ...state.alerts], unreadAlertCount: state.unreadAlertCount + 1 })) } },
```

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/types.ts dashboard/src/lib/api.ts dashboard/src/lib/store.ts
git commit -m "feat(phase4): add dashboard types, API client, and store for Phase 4"
```

---

## Task 19: Dashboard Nav + Financials Page

**Files:**
- Modify: `dashboard/src/app/layout.tsx`
- Create: `dashboard/src/app/financials/page.tsx`
- Create: `dashboard/src/components/financials/cost-overview.tsx`
- Create: `dashboard/src/components/financials/agent-spend-breakdown.tsx`

- [ ] **Step 1: Update nav in layout.tsx**

```typescript
const NAV_ITEMS = [
  { href: "/", label: "Live Floor" },
  { href: "/pipeline", label: "Pipeline" },
  { href: "/financials", label: "Financials" },
  { href: "/quality", label: "Quality" },
  { href: "/insights", label: "Insights" },
  { href: "/system", label: "System Health" },
]
```

- [ ] **Step 2: Create Financials page and components**

```tsx
// dashboard/src/app/financials/page.tsx
"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { FinancialsData } from "@/lib/types"
import { CostOverview } from "@/components/financials/cost-overview"
import { AgentSpendBreakdown } from "@/components/financials/agent-spend-breakdown"

export default function FinancialsPage() {
  const [data, setData] = useState<FinancialsData | null>(null)
  useEffect(() => { api.financials().then(setData) }, [])
  if (!data) return <div className="text-zinc-400">Loading financials...</div>
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Financials</h1>
      <CostOverview data={data} />
      <AgentSpendBreakdown breakdown={data.agentTokenBreakdown} />
    </div>
  )
}
```

```tsx
// dashboard/src/components/financials/cost-overview.tsx
import type { FinancialsData } from "@/lib/types"

export function CostOverview({ data }: { data: FinancialsData }) {
  const avgCostPerGoal = data.costPerGoal.length > 0
    ? data.costPerGoal.reduce((sum, g) => sum + g.costUsd, 0) / data.costPerGoal.length
    : 0
  return (
    <div className="grid grid-cols-3 gap-4">
      <Card label="Total Tokens" value={data.totalTokensUsed.toLocaleString()} />
      <Card label="Total Cost" value={`$${data.totalCostUsd.toFixed(4)}`} />
      <Card label="Avg Cost/Goal" value={`$${avgCostPerGoal.toFixed(4)}`} />
    </div>
  )
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="text-sm text-zinc-400">{label}</div>
      <div className="text-2xl font-bold text-white mt-1">{value}</div>
    </div>
  )
}
```

```tsx
// dashboard/src/components/financials/agent-spend-breakdown.tsx
export function AgentSpendBreakdown({ breakdown }: { breakdown: Record<string, number> }) {
  const entries = Object.entries(breakdown).sort((a, b) => b[1] - a[1])
  const max = entries[0]?.[1] ?? 1
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="text-lg font-semibold text-white mb-4">Agent Token Spend</h2>
      <div className="space-y-2">
        {entries.map(([agent, tokens]) => (
          <div key={agent} className="flex items-center gap-3">
            <span className="w-24 text-sm text-zinc-400 truncate">{agent}</span>
            <div className="flex-1 h-4 bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-blue-500 rounded-full" style={{ width: `${(tokens / max) * 100}%` }} />
            </div>
            <span className="text-sm text-zinc-300 w-20 text-right">{tokens.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/layout.tsx dashboard/src/app/financials/page.tsx dashboard/src/components/financials/cost-overview.tsx dashboard/src/components/financials/agent-spend-breakdown.tsx
git commit -m "feat(phase4): add Financials dashboard page"
```

---

## Task 20: Quality Dashboard Page

**Files:**
- Create: `dashboard/src/app/quality/page.tsx`
- Create: `dashboard/src/components/quality/keep-rate-overview.tsx`
- Create: `dashboard/src/components/quality/rejection-reasons.tsx`

- [ ] **Step 1: Create Quality page and components**

```tsx
// dashboard/src/app/quality/page.tsx
"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { QualityData } from "@/lib/types"
import { KeepRateOverview } from "@/components/quality/keep-rate-overview"
import { RejectionReasons } from "@/components/quality/rejection-reasons"

export default function QualityPage() {
  const [data, setData] = useState<QualityData | null>(null)
  useEffect(() => { api.quality().then(setData) }, [])
  if (!data) return <div className="text-zinc-400">Loading quality metrics...</div>
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Quality</h1>
      <KeepRateOverview data={data} />
      <RejectionReasons reasons={data.topRejectionReasons} />
    </div>
  )
}
```

```tsx
// dashboard/src/components/quality/keep-rate-overview.tsx
import type { QualityData } from "@/lib/types"

export function KeepRateOverview({ data }: { data: QualityData }) {
  const pct = (data.overallKeepRate * 100).toFixed(1)
  const color = data.overallKeepRate > 0.7 ? "text-green-400" : data.overallKeepRate > 0.5 ? "text-yellow-400" : "text-red-400"
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
        <div className="text-sm text-zinc-400">Overall Keep Rate</div>
        <div className={`text-4xl font-bold mt-2 ${color}`}>{pct}%</div>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center">
        <div className="text-sm text-zinc-400">Review Pass Rate</div>
        <div className="text-4xl font-bold mt-2 text-white">{(data.reviewPassRate * 100).toFixed(1)}%</div>
      </div>
    </div>
  )
}
```

```tsx
// dashboard/src/components/quality/rejection-reasons.tsx
export function RejectionReasons({ reasons }: { reasons: ReadonlyArray<{ reason: string; count: number }> }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="text-lg font-semibold text-white mb-4">Top Rejection Reasons</h2>
      {reasons.length === 0 ? <div className="text-zinc-500">No rejections yet</div> : (
        <div className="space-y-2">
          {reasons.map((r, i) => (
            <div key={i} className="flex justify-between items-center py-1 border-b border-zinc-800 last:border-0">
              <span className="text-sm text-zinc-300">{r.reason}</span>
              <span className="text-sm font-mono text-zinc-400">{r.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/app/quality/page.tsx dashboard/src/components/quality/keep-rate-overview.tsx dashboard/src/components/quality/rejection-reasons.tsx
git commit -m "feat(phase4): add Quality dashboard page"
```

---

## Task 21: Insights Dashboard Page

**Files:**
- Create: `dashboard/src/app/insights/page.tsx`
- Create: `dashboard/src/components/insights/insights-list.tsx`
- Create: `dashboard/src/components/insights/insight-detail.tsx`

- [ ] **Step 1: Create Insights page and components**

```tsx
// dashboard/src/app/insights/page.tsx
"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { InsightSummary, InsightDetail } from "@/lib/types"
import { InsightsList } from "@/components/insights/insights-list"
import { InsightDetailView } from "@/components/insights/insight-detail"

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightSummary[]>([])
  const [selected, setSelected] = useState<InsightDetail | null>(null)
  const [tab, setTab] = useState<string>("pending")

  const load = () => { api.insights(tab).then(setInsights) }
  useEffect(load, [tab])

  const onSelect = async (id: string) => { setSelected(await api.insight(id)) }
  const onAccept = async (id: string) => { await api.acceptInsight(id); setSelected(null); load() }
  const onDismiss = async (id: string) => { await api.dismissInsight(id); setSelected(null); load() }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Insights</h1>
      <div className="flex gap-2">
        {["pending", "applied", "dismissed"].map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded text-sm ${tab === t ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>{t}</button>
        ))}
      </div>
      {selected ? (
        <InsightDetailView insight={selected} onAccept={onAccept} onDismiss={onDismiss} onBack={() => setSelected(null)} />
      ) : (
        <InsightsList insights={insights} onSelect={onSelect} />
      )}
    </div>
  )
}
```

```tsx
// dashboard/src/components/insights/insights-list.tsx
import type { InsightSummary } from "@/lib/types"

export function InsightsList({ insights, onSelect }: { insights: InsightSummary[]; onSelect: (id: string) => void }) {
  if (insights.length === 0) return <div className="text-zinc-500">No insights</div>
  return (
    <div className="space-y-2">
      {insights.map(i => (
        <button key={i.id} onClick={() => onSelect(i.id)} className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 transition-colors">
          <div className="flex justify-between items-center">
            <span className="text-white font-medium">{i.title}</span>
            <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">{i.actionKind}</span>
          </div>
          <div className="text-sm text-zinc-500 mt-1">{new Date(i.createdAt).toLocaleDateString()}</div>
        </button>
      ))}
    </div>
  )
}
```

```tsx
// dashboard/src/components/insights/insight-detail.tsx
import type { InsightDetail } from "@/lib/types"

export function InsightDetailView({ insight, onAccept, onDismiss, onBack }: { insight: InsightDetail; onAccept: (id: string) => void; onDismiss: (id: string) => void; onBack: () => void }) {
  const action = insight.proposedAction as Record<string, unknown>
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-4">
      <button onClick={onBack} className="text-sm text-zinc-400 hover:text-white">&larr; Back</button>
      <h2 className="text-xl font-bold text-white">{insight.title}</h2>
      <p className="text-zinc-300">{insight.description}</p>
      <div>
        <h3 className="text-sm font-semibold text-zinc-400 mb-1">Evidence</h3>
        <p className="text-zinc-300 text-sm">{insight.evidence}</p>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-400 mb-1">Proposed Change ({action.kind})</h3>
        {action.kind === "prompt_update" || action.kind === "skill_update" ? (
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><div className="text-zinc-500 mb-1">Current</div><pre className="bg-zinc-950 p-2 rounded text-zinc-300 overflow-auto max-h-48">{action.currentContent as string}</pre></div>
            <div><div className="text-zinc-500 mb-1">Proposed</div><pre className="bg-zinc-950 p-2 rounded text-zinc-300 overflow-auto max-h-48">{action.newContent as string}</pre></div>
          </div>
        ) : action.kind === "budget_tune" ? (
          <div className="text-sm text-zinc-300">
            Tokens: {String(action.currentMaxTokens)} → {String(action.newMaxTokens)} | Cost: ${String(action.currentMaxCostUsd)} → ${String(action.newMaxCostUsd)}
          </div>
        ) : action.kind === "model_reassign" ? (
          <div className="text-sm text-zinc-300">{String(action.currentModel)} → {String(action.newModel)}</div>
        ) : (
          <div className="text-sm text-zinc-300">{action.description as string}</div>
        )}
      </div>
      {insight.status === "pending" && (
        <div className="flex gap-2 pt-2">
          <button onClick={() => onAccept(insight.id)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500">Accept</button>
          <button onClick={() => onDismiss(insight.id)} className="px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600">Dismiss</button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/app/insights/page.tsx dashboard/src/components/insights/insights-list.tsx dashboard/src/components/insights/insight-detail.tsx
git commit -m "feat(phase4): add Insights dashboard page with accept/dismiss"
```

---

## Task 22: System Health Dashboard Page

**Files:**
- Create: `dashboard/src/app/system/page.tsx`
- Create: `dashboard/src/components/system/agent-status-grid.tsx`
- Create: `dashboard/src/components/system/plugin-status.tsx`

- [ ] **Step 1: Create System Health page and components**

```tsx
// dashboard/src/app/system/page.tsx
"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { AgentDTO, PluginHealth, TimingsData } from "@/lib/types"
import { AgentStatusGrid } from "@/components/system/agent-status-grid"
import { PluginStatusTable } from "@/components/system/plugin-status"

export default function SystemPage() {
  const [agents, setAgents] = useState<AgentDTO[]>([])
  const [plugins, setPlugins] = useState<PluginHealth[]>([])
  const [timings, setTimings] = useState<TimingsData | null>(null)
  useEffect(() => {
    api.liveFloor().then(d => setAgents([...d.agents]))
    api.systemHealth().then(setPlugins)
    api.timings().then(setTimings)
  }, [])
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">System Health</h1>
      <AgentStatusGrid agents={agents} />
      <PluginStatusTable plugins={plugins} />
      {timings && Object.keys(timings.avgDurationByPhase).length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-lg font-semibold text-white mb-3">Phase Timings</h2>
          <div className="space-y-1">
            {Object.entries(timings.avgDurationByPhase).map(([phase, ms]) => (
              <div key={phase} className="flex justify-between text-sm">
                <span className="text-zinc-300">{phase}</span>
                <span className="text-zinc-400">{(ms / 1000).toFixed(1)}s avg</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

```tsx
// dashboard/src/components/system/agent-status-grid.tsx
import type { AgentDTO } from "@/lib/types"

const STATUS_COLORS: Record<string, string> = { idle: "text-green-400", busy: "text-blue-400", blocked: "text-yellow-400", paused: "text-zinc-500", stopped: "text-red-400" }

export function AgentStatusGrid({ agents }: { agents: AgentDTO[] }) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {agents.map(a => (
        <div key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <div className="text-sm font-medium text-white">{a.role}</div>
          <div className={`text-xs mt-1 ${STATUS_COLORS[a.status] ?? "text-zinc-400"}`}>{a.status}</div>
          <div className="text-xs text-zinc-500 mt-1">Model: {a.model}</div>
        </div>
      ))}
    </div>
  )
}
```

```tsx
// dashboard/src/components/system/plugin-status.tsx
import type { PluginHealth } from "@/lib/types"

const HEALTH_COLORS: Record<string, string> = { healthy: "text-green-400", degraded: "text-yellow-400", unhealthy: "text-red-400" }

export function PluginStatusTable({ plugins }: { plugins: PluginHealth[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h2 className="text-lg font-semibold text-white mb-3">Plugin Status</h2>
      <div className="space-y-1">
        {plugins.map(p => (
          <div key={p.name} className="flex justify-between text-sm py-1 border-b border-zinc-800 last:border-0">
            <span className="text-zinc-300">{p.name}</span>
            <span className={HEALTH_COLORS[p.status] ?? "text-zinc-400"}>{p.status}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add dashboard/src/app/system/page.tsx dashboard/src/components/system/agent-status-grid.tsx dashboard/src/components/system/plugin-status.tsx
git commit -m "feat(phase4): add System Health dashboard page"
```

---

## Task 23: Alerts Drawer

**Files:**
- Create: `dashboard/src/components/alerts/alerts-drawer.tsx`
- Modify: `dashboard/src/app/layout.tsx`

- [ ] **Step 1: Create alerts drawer component**

```tsx
// dashboard/src/components/alerts/alerts-drawer.tsx
"use client"
import { useEffect, useState } from "react"
import { useDashboardStore } from "@/lib/store"

const SEVERITY_COLORS = { info: "border-blue-500", warning: "border-yellow-500", urgent: "border-red-500" }

export function AlertsDrawer() {
  const [open, setOpen] = useState(false)
  const { alerts, unreadAlertCount, fetchAlerts } = useDashboardStore()
  useEffect(() => { fetchAlerts() }, [])

  const toggle = () => {
    setOpen(!open)
    if (!open) useDashboardStore.setState({ unreadAlertCount: 0 })
  }

  return (
    <>
      <button onClick={toggle} className="relative p-2 text-zinc-400 hover:text-white">
        <span className="text-lg">&#128276;</span>
        {unreadAlertCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">{unreadAlertCount}</span>
        )}
      </button>
      {open && (
        <div className="fixed right-0 top-0 h-full w-80 bg-zinc-950 border-l border-zinc-800 z-50 overflow-y-auto p-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white">Alerts</h2>
            <button onClick={toggle} className="text-zinc-400 hover:text-white">&times;</button>
          </div>
          {alerts.length === 0 ? <div className="text-zinc-500 text-sm">No alerts</div> : (
            <div className="space-y-2">
              {alerts.map((a, i) => (
                <div key={i} className={`rounded border-l-2 ${SEVERITY_COLORS[a.severity]} bg-zinc-900 p-3`}>
                  <div className="text-sm font-medium text-white">{a.title}</div>
                  <div className="text-xs text-zinc-400 mt-1">{a.body}</div>
                  <div className="text-xs text-zinc-500 mt-1">{new Date(a.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Add alerts drawer to layout**

In `dashboard/src/app/layout.tsx`, import and render the `AlertsDrawer` in the aside header area:

```tsx
import { AlertsDrawer } from "@/components/alerts/alerts-drawer"

// In the aside, after the h1:
<div className="flex items-center justify-between mb-6 px-4">
  <h1 className="text-lg font-bold text-white">DevFleet</h1>
  <AlertsDrawer />
</div>
```

Remove the standalone `<h1>` tag that was there before.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/alerts/alerts-drawer.tsx dashboard/src/app/layout.tsx
git commit -m "feat(phase4): add alerts drawer with real-time badge"
```

---

## Task 24: Learner System Prompt

**Files:**
- Create: `agent-prompts/learner.md`

- [ ] **Step 1: Write the Learner system prompt**

```markdown
# Learner Agent — System Prompt

You are the Learner, an analytical agent that reviews system performance data and proposes improvements.

## Your Role

You receive structured metrics data (financials, quality, timings) and current system configuration (agent prompts, budgets, models). Your job is to identify patterns and propose actionable recommendations.

## Input Format

You receive JSON with these sections:
- `financials`: token spend, cost per goal, agent breakdown
- `quality`: keep/discard ratios, review pass rate, rejection reasons, recent records
- `timings`: phase durations, stalled phases, agent efficiency
- `currentConfig`: current prompts, budgets, and models for each agent role

## Output Format

Respond with a JSON array of recommendations. Each recommendation must match this schema:

```json
[
  {
    "title": "Short title describing the recommendation",
    "description": "Why this change would help",
    "evidence": "Which metrics support this (cite specific numbers)",
    "confidence": "high" | "medium" | "low",
    "proposedAction": {
      "kind": "prompt_update" | "budget_tune" | "model_reassign" | "skill_update" | "process_change",
      // For prompt_update: include "role" and "newContent" (full new prompt)
      // For budget_tune: include "role", "newMaxTokens", "newMaxCostUsd"
      // For model_reassign: include "role", "newModel"
      // For skill_update: include "skillName", "newContent"
      // For process_change: include "description"
    }
  }
]
```

## Rules

1. Only recommend changes with clear supporting data. No speculative improvements.
2. Be conservative. A wrong recommendation wastes CEO time and erodes trust.
3. If metrics look healthy, return an empty array `[]`. No recommendations is a valid response.
4. For prompt_update: always provide the FULL new prompt, not a diff or partial edit.
5. For budget_tune: only lower budgets when data shows consistent underutilization. Never raise budgets without clear evidence of budget exhaustion limiting quality.
6. Cite specific numbers in evidence: "Keep rate for developer is 42% (5/12)" not "keep rate is low."
7. Return valid JSON only. No markdown, no explanations outside the JSON array.
```

- [ ] **Step 2: Commit**

```bash
git add agent-prompts/learner.md
git commit -m "feat(phase4): add Learner agent system prompt"
```

---

## Task 25: RunAnalysisCycle Use Case

**Files:**
- Create: `src/use-cases/RunAnalysisCycle.ts`
- Test: `tests/use-cases/RunAnalysisCycle.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/use-cases/RunAnalysisCycle.test.ts
import { RunAnalysisCycle } from "@use-cases/RunAnalysisCycle"
import { InMemoryInsightRepository } from "@adapters/storage/InMemoryInsightRepository"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryKeepDiscardRepository } from "@adapters/storage/InMemoryKeepDiscardRepository"
import { InMemoryEventStore } from "@adapters/storage/InMemoryEventStore"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { InMemoryBudgetConfigStore } from "@adapters/storage/InMemoryBudgetConfigStore"
import { InMemoryAgentRegistry } from "@adapters/storage/InMemoryAgentRegistry"
import { NoOpNotificationAdapter } from "@adapters/notifications/NoOpNotificationAdapter"
import { ComputeFinancials } from "@use-cases/ComputeFinancials"
import { ComputeQualityMetrics } from "@use-cases/ComputeQualityMetrics"
import { ComputePhaseTimings } from "@use-cases/ComputePhaseTimings"
import type { AICompletionProvider, AgentPrompt, AIResponse } from "@use-cases/ports/AIProvider"
import type { TokenBudget } from "@entities/Budget"

const mockAI: AICompletionProvider = {
  capabilities: new Set(),
  async complete(_prompt: AgentPrompt, _budget: TokenBudget): Promise<AIResponse> {
    return {
      content: JSON.stringify([{
        title: "Lower dev budget",
        description: "Dev consistently underuses budget",
        evidence: "Avg usage 30%",
        confidence: "high",
        proposedAction: { kind: "budget_tune", role: "developer", newMaxTokens: 7000, newMaxCostUsd: 0.7 },
      }]),
      tokensIn: 100, tokensOut: 50, stopReason: "end_turn",
    }
  },
}

describe("RunAnalysisCycle", () => {
  it("creates Insight entities from AI response", async () => {
    const eventStore = new InMemoryEventStore()
    const insightRepo = new InMemoryInsightRepository()
    const uc = new RunAnalysisCycle(
      mockAI, "system prompt", "opus",
      new ComputeFinancials(eventStore),
      new ComputeQualityMetrics(new InMemoryKeepDiscardRepository()),
      new ComputePhaseTimings(eventStore, new InMemoryTaskRepo()),
      insightRepo, new NoOpNotificationAdapter(), new InMemoryBus(),
      { read: async () => "prompt", update: async () => {} },
      new InMemoryBudgetConfigStore(),
      new InMemoryAgentRegistry(),
      { read: async () => "skill", update: async () => {}, list: async () => [] },
    )
    await uc.execute()
    const insights = await insightRepo.findAll()
    expect(insights).toHaveLength(1)
    expect(insights[0]?.title).toBe("Lower dev budget")
    expect(insights[0]?.status).toBe("pending")
    expect(insights[0]?.proposedAction.kind).toBe("budget_tune")
  })
})
```

- [ ] **Step 2: Implement RunAnalysisCycle**

```typescript
// src/use-cases/RunAnalysisCycle.ts
import type { AICompletionProvider } from "./ports/AIProvider"
import type { ComputeFinancials } from "./ComputeFinancials"
import type { ComputeQualityMetrics } from "./ComputeQualityMetrics"
import type { ComputePhaseTimings } from "./ComputePhaseTimings"
import type { InsightRepository } from "./ports/InsightRepository"
import type { NotificationPort } from "./ports/NotificationPort"
import type { MessagePort } from "./ports/MessagePort"
import type { AgentPromptStore } from "./ports/AgentPromptStore"
import type { BudgetConfigStore } from "./ports/BudgetConfigStore"
import type { AgentRegistry } from "./ports/AgentRegistry"
import type { SkillStore } from "./ports/SkillStore"
import type { ProposedAction } from "../entities/Insight"
import { createInsight } from "../entities/Insight"
import { createInsightId, createMessageId } from "../entities/ids"

interface RawRecommendation {
  title: string
  description: string
  evidence: string
  confidence: string
  proposedAction: {
    kind: string
    role?: string
    newContent?: string
    newMaxTokens?: number
    newMaxCostUsd?: number
    newModel?: string
    skillName?: string
    description?: string
  }
}

export class RunAnalysisCycle {
  constructor(
    private readonly ai: AICompletionProvider,
    private readonly systemPrompt: string,
    private readonly model: string,
    private readonly computeFinancials: ComputeFinancials,
    private readonly computeQuality: ComputeQualityMetrics,
    private readonly computeTimings: ComputePhaseTimings,
    private readonly insightRepo: InsightRepository,
    private readonly notificationPort: NotificationPort,
    private readonly bus: MessagePort,
    private readonly promptStore: AgentPromptStore,
    private readonly budgetConfigStore: BudgetConfigStore,
    private readonly agentRegistry: AgentRegistry,
    private readonly skillStore: SkillStore,
  ) {}

  async execute(): Promise<void> {
    const [financials, quality, timings] = await Promise.all([
      this.computeFinancials.execute(),
      this.computeQuality.execute(),
      this.computeTimings.execute(),
    ])

    const agents = await this.agentRegistry.findAll()
    const currentConfig: Record<string, unknown> = {}
    for (const agent of agents) {
      try {
        const prompt = await this.promptStore.read(agent.role)
        const budget = await this.budgetConfigStore.read(agent.role)
        currentConfig[agent.role as string] = { prompt, budget, model: agent.model }
      } catch { /* role may not have a prompt file */ }
    }

    const context = JSON.stringify({ financials, quality, timings, currentConfig }, null, 2)
    const response = await this.ai.complete(
      { systemPrompt: this.systemPrompt, messages: [{ role: "user", content: context }], model: this.model, maxTokens: 4096 },
      { maxTokens: 100000, maxCostUsd: 10, remaining: 100000 },
    )

    let recommendations: RawRecommendation[]
    try {
      recommendations = JSON.parse(response.content)
      if (!Array.isArray(recommendations)) return
    } catch { return }

    for (const rec of recommendations) {
      const action = this.buildProposedAction(rec, currentConfig)
      if (!action) continue

      const insight = createInsight({
        id: createInsightId(),
        title: rec.title,
        description: rec.description,
        evidence: rec.evidence,
        proposedAction: action,
      })

      await this.insightRepo.save(insight)
      await this.bus.emit({ id: createMessageId(), type: "insight.generated", insightId: insight.id, recommendation: rec.title, confidence: rec.confidence === "high" ? 1 : rec.confidence === "medium" ? 0.5 : 0.2, timestamp: new Date() })

      if (rec.confidence === "high") {
        await this.notificationPort.notify({ severity: "info", title: "New recommendation", body: rec.title, insightId: insight.id })
      }
    }
  }

  private buildProposedAction(rec: RawRecommendation, currentConfig: Record<string, unknown>): ProposedAction | null {
    const pa = rec.proposedAction
    const config = pa.role ? (currentConfig[pa.role] as { prompt?: string; budget?: { maxTokens: number; maxCostUsd: number }; model?: string } | undefined) : undefined

    switch (pa.kind) {
      case "prompt_update":
        if (!pa.role || !pa.newContent) return null
        return { kind: "prompt_update", role: pa.role, currentContent: config?.prompt ?? "", newContent: pa.newContent }
      case "budget_tune":
        if (!pa.role || pa.newMaxTokens === undefined || pa.newMaxCostUsd === undefined) return null
        return { kind: "budget_tune", role: pa.role, currentMaxTokens: config?.budget?.maxTokens ?? 0, currentMaxCostUsd: config?.budget?.maxCostUsd ?? 0, newMaxTokens: pa.newMaxTokens, newMaxCostUsd: pa.newMaxCostUsd }
      case "model_reassign":
        if (!pa.role || !pa.newModel) return null
        return { kind: "model_reassign", role: pa.role, currentModel: config?.model ?? "", newModel: pa.newModel }
      case "skill_update":
        if (!pa.skillName || !pa.newContent) return null
        return { kind: "skill_update", skillName: pa.skillName, currentContent: "", newContent: pa.newContent }
      case "process_change":
        return { kind: "process_change", description: pa.description ?? rec.description }
      default:
        return null
    }
  }
}
```

- [ ] **Step 3: Run test**

Run: `npx jest tests/use-cases/RunAnalysisCycle.test.ts --verbose`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/use-cases/RunAnalysisCycle.ts tests/use-cases/RunAnalysisCycle.test.ts
git commit -m "feat(phase4): add RunAnalysisCycle use case — Learner's brain"
```

---

## Task 26: Integration Test

**Files:**
- Create: `tests/integration/phase4-insights.test.ts`

- [ ] **Step 1: Write integration test for full insight lifecycle**

```typescript
// tests/integration/phase4-insights.test.ts
import { InMemoryInsightRepository } from "@adapters/storage/InMemoryInsightRepository"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryBudgetConfigStore } from "@adapters/storage/InMemoryBudgetConfigStore"
import { InMemoryAgentRegistry } from "@adapters/storage/InMemoryAgentRegistry"
import { NoOpNotificationAdapter } from "@adapters/notifications/NoOpNotificationAdapter"
import { AcceptInsight } from "@use-cases/AcceptInsight"
import { DismissInsight } from "@use-cases/DismissInsight"
import { createInsight } from "@entities/Insight"
import { createInsightId } from "@entities/ids"
import type { Message } from "@entities/Message"

describe("Phase 4 — Insight lifecycle", () => {
  it("accept insight applies budget change and emits audit message", async () => {
    const insightRepo = new InMemoryInsightRepository()
    const budgetStore = new InMemoryBudgetConfigStore()
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({ types: ["insight.accepted"] }, async (m) => { emitted.push(m) })

    const insight = createInsight({
      id: createInsightId("i-1"), title: "Tune budget", description: "d", evidence: "e",
      proposedAction: { kind: "budget_tune", role: "developer", currentMaxTokens: 10000, currentMaxCostUsd: 1, newMaxTokens: 7000, newMaxCostUsd: 0.7 },
    })
    await insightRepo.save(insight)

    const accept = new AcceptInsight(insightRepo, { read: async () => "", update: async () => {} }, budgetStore, new InMemoryAgentRegistry(), { read: async () => "", update: async () => {}, list: async () => [] }, bus, new NoOpNotificationAdapter())
    await accept.execute(createInsightId("i-1"))

    const updated = await insightRepo.findById(createInsightId("i-1"))
    expect(updated?.status).toBe("applied")
    const budget = await budgetStore.read("developer")
    expect(budget.maxTokens).toBe(7000)
    expect(emitted).toHaveLength(1)
  })

  it("dismiss insight sets status without applying changes", async () => {
    const insightRepo = new InMemoryInsightRepository()
    const insight = createInsight({
      id: createInsightId("i-2"), title: "Bad idea", description: "d", evidence: "e",
      proposedAction: { kind: "process_change", description: "don't" },
    })
    await insightRepo.save(insight)

    const dismiss = new DismissInsight(insightRepo)
    await dismiss.execute(createInsightId("i-2"))

    const updated = await insightRepo.findById(createInsightId("i-2"))
    expect(updated?.status).toBe("dismissed")
  })
})
```

- [ ] **Step 2: Run test**

Run: `npx jest tests/integration/phase4-insights.test.ts --verbose`
Expected: PASS

- [ ] **Step 3: Run full test suite**

Run: `npx jest --verbose`
Expected: All tests PASS

- [ ] **Step 4: Commit**

```bash
git add tests/integration/phase4-insights.test.ts
git commit -m "test(phase4): add integration test for insight lifecycle"
```

---

## Task 27: Final Verification

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 2: Full test suite**

Run: `npx jest --verbose`
Expected: All tests PASS

- [ ] **Step 3: Verify file inventory matches spec**

Check that all files listed in spec Section 8 (File Inventory) exist. Run:

```bash
ls src/entities/Insight.ts src/entities/AlertPreferences.ts src/entities/MetricsFilter.ts src/entities/Reports.ts src/use-cases/ports/KeepDiscardRepository.ts src/use-cases/ports/AgentPromptStore.ts src/use-cases/ports/InsightRepository.ts src/use-cases/ports/BudgetConfigStore.ts src/use-cases/ports/SkillStore.ts src/use-cases/ports/NotificationPort.ts src/use-cases/ports/AlertPreferencesStore.ts src/use-cases/ComputeFinancials.ts src/use-cases/ComputeQualityMetrics.ts src/use-cases/ComputePhaseTimings.ts src/use-cases/RunAnalysisCycle.ts src/use-cases/AcceptInsight.ts src/use-cases/DismissInsight.ts src/use-cases/EvaluateAlert.ts src/infrastructure/config/toSystemEvent.ts
```

Expected: all files listed

- [ ] **Step 4: Final commit if any fixes were needed**

```bash
git add -A
git commit -m "fix(phase4): final verification fixes"
```

---

## Self-Review Errata

Issues identified during self-review. Items marked **FIXED** have been addressed in the plan. Remaining items the implementing agent MUST address during execution:

### Fixed in Plan

- ~~Broken commits in Tasks 14-17~~ → **FIXED:** Merged into single atomic Task 14
- ~~`PluginRegistry.allPlugins()` doesn't exist~~ → **FIXED:** Changed to `pluginRegistry.discover()` (existing method)
- ~~`InsightGeneratedMessage` field mismatch~~ → **FIXED:** Task 6 now updates existing interface to match spec
- ~~Task 17 is prose not code~~ → **FIXED:** Task 14 provides complete code for all files
- ~~Missing alert rules~~ → **FIXED:** Task 14 Step 9 defines all 6 rules including `review.rejected` and `insight.accepted`
- ~~`InsightDetailDTO.proposedAction: unknown`~~ → **FIXED:** Changed to `ProposedAction` type with import

### Remaining (Implementing Agent Must Address)

1. **Missing dashboard components:** Tasks 15-19 (renumbered) omit 7 components from the spec's file inventory. Create these additional files:
   - `dashboard/src/components/financials/cost-per-goal-chart.tsx` — bar chart from `costPerGoal`
   - `dashboard/src/components/financials/model-tier-breakdown.tsx` — donut chart from `modelTierBreakdown`
   - `dashboard/src/components/quality/keep-rate-by-agent.tsx` — bar chart from `keepRateByAgent`
   - `dashboard/src/components/quality/review-pass-rate.tsx` — single metric card
   - `dashboard/src/components/system/prompt-versions.tsx` — prompt change history from event store
   - `dashboard/src/components/system/phase-timings.tsx` — extract inline timings into reusable component
   - `dashboard/src/components/insights/insight-history.tsx` — table of applied/dismissed insights

2. **Missing Learner periodic sweep:** Task 14 wires `onGoalCompleted` but never sets up the periodic `setInterval` sweep (default 1 hour) or its cleanup in `stop()`. Add to composition root using the existing `DetectStuckAgent` interval pattern.

3. **Alerts preferences modal:** Task 20 (renumbered) omits the settings UI in the drawer. Add a settings button that opens a modal with min severity selector and muted triggers checkboxes.

4. **`skill_update` snapshot:** In `RunAnalysisCycle.buildProposedAction()`, read current skill content via `this.skillStore.read(pa.skillName)` instead of hardcoding `currentContent: ""`.
