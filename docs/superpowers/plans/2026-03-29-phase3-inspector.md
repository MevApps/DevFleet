# Phase 3: Inspector — Type-Specific Inspectors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Inspector panel's Phase 1 placeholder body with four type-specific inspectors (Goal, Task, Agent, Event), an ActivityThread component, a DiffViewer component, and status-adaptive action buttons — enabling the full "click to inspect" workflow from the Stream/GoalFocus views.

**Architecture:** `InspectorPanel` (Phase 1 shell) delegates to type-specific components via a registry map (`entityType → Component`). Each inspector is an independent file reading from `useDashboardStore` by entity ID. `ActivityThread` is a reusable vertical timeline filtered by entity. `DiffViewer` renders syntax-highlighted code diffs (hardcoded mock data until the backend endpoint `GET /api/tasks/{id}/diff` is built). Action buttons adapt to task status (review vs. failed).

**Tech Stack:** Next.js 15, React 19, Zustand 5, Tailwind CSS 4, Lucide React, Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-unified-command-redesign.md` (Section 3)

**Depends on:** Phase 1 (shell) + Phase 2 (floor) — merged to master

**Backend dependency:** `GET /api/tasks/{id}/diff` endpoint not yet built. The DiffViewer will render mock/empty state until the endpoint exists. The API client method is added now so the integration is ready.

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/inspector/goal-inspector.tsx` | Inspector content for goals: description, status, budget, task list, activity |
| `src/components/inspector/__tests__/goal-inspector.test.tsx` | Tests for GoalInspector |
| `src/components/inspector/task-inspector.tsx` | Inspector content for tasks: status, agent, tabs (Diff/Artifacts/Activity), action buttons |
| `src/components/inspector/__tests__/task-inspector.test.tsx` | Tests for TaskInspector |
| `src/components/inspector/agent-inspector.tsx` | Inspector content for agents: role, model, current task, pause/resume, activity |
| `src/components/inspector/__tests__/agent-inspector.test.tsx` | Tests for AgentInspector |
| `src/components/inspector/event-inspector.tsx` | Inspector content for events: type, parent chain, timestamp |
| `src/components/inspector/inspector-registry.ts` | Map of entityType → inspector component (strategy pattern) |
| `src/components/composites/activity-thread.tsx` | Vertical timeline of entity-scoped events (replaces ActivityFeed for inspector use). Exports `eventToStatus()` for reuse. |
| `src/components/composites/__tests__/activity-thread.test.tsx` | Tests for ActivityThread |
| `src/components/composites/diff-viewer.tsx` | Syntax-highlighted code diff display |
| `src/components/composites/__tests__/diff-viewer.test.tsx` | Tests for DiffViewer |
| `src/components/inspector/insp-stat.tsx` | Shared stat card component used by GoalInspector, TaskInspector, AgentInspector |

### Modified Files
| File | Change |
|------|--------|
| `src/components/layout/inspector-panel.tsx` | Replace placeholder body with registry-based delegation to type-specific inspectors |
| `src/lib/api.ts` | Add `taskDiff(taskId)` method (returns mock until backend exists) |

---

## Task 1: Create `ActivityThread`

**Files:**
- Create: `src/components/composites/activity-thread.tsx`
- Create: `src/components/composites/__tests__/activity-thread.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/composites/__tests__/activity-thread.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ActivityThread } from "../activity-thread"
import type { EventDTO } from "@/lib/types"

const makeEvent = (overrides: Partial<EventDTO>): EventDTO => ({
  id: "e-1", type: "task.completed", agentId: "dev-01",
  taskId: "t-1", goalId: "g-1", occurredAt: "2026-03-29T14:32:12Z",
  ...overrides,
})

describe("ActivityThread", () => {
  it("renders event type text", () => {
    render(<ActivityThread events={[makeEvent({ type: "task.completed" })]} />)
    expect(screen.getByText("task.completed")).toBeInTheDocument()
  })

  it("renders multiple events in order", () => {
    const events = [
      makeEvent({ id: "e-1", type: "task.assigned", occurredAt: "2026-03-29T14:32:12Z" }),
      makeEvent({ id: "e-2", type: "task.completed", occurredAt: "2026-03-29T14:30:00Z" }),
    ]
    render(<ActivityThread events={events} />)
    expect(screen.getByText("task.assigned")).toBeInTheDocument()
    expect(screen.getByText("task.completed")).toBeInTheDocument()
  })

  it("shows empty message when no events", () => {
    render(<ActivityThread events={[]} />)
    expect(screen.getByText(/no activity/i)).toBeInTheDocument()
  })

  it("shows agent ID when present", () => {
    render(<ActivityThread events={[makeEvent({ agentId: "dev-03" })]} />)
    expect(screen.getByText("dev-03")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/activity-thread.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/composites/activity-thread.tsx
import type { EventDTO } from "@/lib/types"
import { StatusDot } from "@/components/primitives/status-dot"
import { formatTimeAgo } from "@/lib/utils/format"

export function eventToStatus(type: string): string {
  if (type.includes("completed") || type.includes("approved") || type.includes("merged")) return "completed"
  if (type.includes("created") || type.includes("assigned")) return "active"
  if (type.includes("failed") || type.includes("rejected") || type.includes("discarded")) return "failed"
  if (type.includes("review")) return "review"
  return "idle"
}

interface ActivityThreadProps {
  events: readonly EventDTO[]
}

export function ActivityThread({ events }: ActivityThreadProps) {
  if (events.length === 0) {
    return <p className="text-[11px] text-text-muted py-3">No activity yet.</p>
  }

  return (
    <div>
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-2.5 py-2 border-b border-border last:border-b-0 text-[12px]">
          <div className="flex flex-col items-center w-4 pt-1 shrink-0">
            <StatusDot status={eventToStatus(event.type)} size="sm" />
            {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono font-medium text-text-primary">{event.type}</p>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
              {event.agentId && <span>{event.agentId}</span>}
              {event.taskId && <span>task:{event.taskId.slice(0, 8)}</span>}
              <span className="font-mono">{formatTimeAgo(event.occurredAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/activity-thread.test.tsx`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/composites/activity-thread.tsx dashboard/src/components/composites/__tests__/activity-thread.test.tsx
git commit -m "feat(inspector): add ActivityThread — entity-scoped vertical event timeline"
```

---

## Task 2: Create `DiffViewer`

**Files:**
- Create: `src/components/composites/diff-viewer.tsx`
- Create: `src/components/composites/__tests__/diff-viewer.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/composites/__tests__/diff-viewer.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { DiffViewer } from "../diff-viewer"
import type { DiffFile } from "../diff-viewer"

describe("DiffViewer", () => {
  it("renders file name header", () => {
    const files: DiffFile[] = [{
      path: "src/auth/oauth.ts",
      additions: 5,
      deletions: 2,
      hunks: [{ lines: [
        { type: "context", content: "import { Auth } from './types'" },
        { type: "deletion", content: "const x = null" },
        { type: "addition", content: "const x = getAuth()" },
      ]}],
    }]
    render(<DiffViewer files={files} />)
    expect(screen.getByText("src/auth/oauth.ts")).toBeInTheDocument()
    expect(screen.getByText("+5 -2")).toBeInTheDocument()
  })

  it("renders diff lines with correct styling", () => {
    const files: DiffFile[] = [{
      path: "test.ts",
      additions: 1,
      deletions: 1,
      hunks: [{ lines: [
        { type: "addition", content: "const y = 1" },
        { type: "deletion", content: "const y = 0" },
      ]}],
    }]
    render(<DiffViewer files={files} />)
    expect(screen.getByText("+ const y = 1")).toBeInTheDocument()
    expect(screen.getByText("- const y = 0")).toBeInTheDocument()
  })

  it("shows empty state when no files", () => {
    render(<DiffViewer files={[]} />)
    expect(screen.getByText(/no code changes/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/diff-viewer.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/composites/diff-viewer.tsx
import { cn } from "@/lib/utils"

export interface DiffLine {
  readonly type: "addition" | "deletion" | "context"
  readonly content: string
}

export interface DiffHunk {
  readonly lines: readonly DiffLine[]
}

export interface DiffFile {
  readonly path: string
  readonly additions: number
  readonly deletions: number
  readonly hunks: readonly DiffHunk[]
}

interface DiffViewerProps {
  files: readonly DiffFile[]
}

export function DiffViewer({ files }: DiffViewerProps) {
  if (files.length === 0) {
    return <p className="text-[11px] text-text-muted py-3">No code changes.</p>
  }

  return (
    <div className="space-y-3">
      {files.map((file) => (
        <div key={file.path} className="rounded-lg border border-border overflow-hidden">
          {/* File header */}
          <div className="flex items-center justify-between px-3 py-2 bg-bg-hover text-[11px]">
            <span className="font-mono text-text-primary">{file.path}</span>
            <span className="font-mono text-text-muted">
              <span className="text-status-green-fg">+{file.additions}</span>{" "}
              <span className="text-status-red-fg">-{file.deletions}</span>
            </span>
          </div>
          {/* Diff lines */}
          <div className="font-mono text-[12px] leading-relaxed">
            {file.hunks.map((hunk, hi) => (
              <div key={hi}>
                {hunk.lines.map((line, li) => (
                  <div
                    key={li}
                    className={cn(
                      "px-3 py-px whitespace-pre",
                      line.type === "addition" && "bg-status-green-surface text-status-green-fg",
                      line.type === "deletion" && "bg-status-red-surface text-status-red-fg",
                      line.type === "context" && "text-text-secondary",
                    )}
                  >
                    {line.type === "addition" && "+ "}
                    {line.type === "deletion" && "- "}
                    {line.type === "context" && "  "}
                    {line.content}
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/diff-viewer.test.tsx`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/composites/diff-viewer.tsx dashboard/src/components/composites/__tests__/diff-viewer.test.tsx
git commit -m "feat(inspector): add DiffViewer — syntax-highlighted code diff display"
```

---

## Task 3: Add `taskDiff` to API Client

**Files:**
- Modify: `src/lib/api.ts`
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add DiffDTO types**

Add to the end of `src/lib/types.ts`:

```typescript
// Diff types (Phase 3)
export interface DiffLineDTO { readonly type: "addition" | "deletion" | "context"; readonly content: string }
export interface DiffHunkDTO { readonly lines: readonly DiffLineDTO[] }
export interface DiffFileDTO { readonly path: string; readonly additions: number; readonly deletions: number; readonly hunks: readonly DiffHunkDTO[] }
export interface TaskDiffDTO { readonly taskId: string; readonly files: readonly DiffFileDTO[] }
```

- [ ] **Step 2: Add taskDiff method to api.ts**

Add to the `api` object in `src/lib/api.ts`:

```typescript
taskDiff: (taskId: string) => get<TaskDiffDTO>(`/tasks/${taskId}/diff`),
```

Add `TaskDiffDTO` to the import line at the top of `api.ts`.

- [ ] **Step 3: Verify build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/types.ts dashboard/src/lib/api.ts
git commit -m "feat(inspector): add TaskDiffDTO types and taskDiff API method"
```

---

## Task 4: Create `InspStat` + `GoalInspector`

**Files:**
- Create: `src/components/inspector/insp-stat.tsx`
- Create: `src/components/inspector/goal-inspector.tsx`
- Create: `src/components/inspector/__tests__/goal-inspector.test.tsx`

- [ ] **Step 0: Create shared InspStat component**

```typescript
// src/components/inspector/insp-stat.tsx
interface InspStatProps {
  label: string
  children: React.ReactNode
}

export function InspStat({ label, children }: InspStatProps) {
  return (
    <div className="rounded-lg bg-bg-hover p-2.5">
      <p className="text-[11px] text-text-muted">{label}</p>
      <div className="text-[15px] font-bold text-text-primary mt-0.5">{children}</div>
    </div>
  )
}
```

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/inspector/__tests__/goal-inspector.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { GoalInspector } from "../goal-inspector"
import { useDashboardStore } from "@/lib/store"
import type { GoalDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 100000, maxCostUsd: 10, remaining: 5 })
const makeGoal = (overrides?: Partial<GoalDTO>): GoalDTO => ({
  id: "g-1", description: "Add OAuth2 support", status: "active",
  createdAt: "2026-03-29T10:00:00Z", completedAt: null,
  taskCount: 4, totalBudget: makeBudget(), ...overrides,
})

describe("GoalInspector", () => {
  beforeEach(() => {
    useDashboardStore.setState({
      goals: [makeGoal()],
      activeTasks: [],
      recentEvents: [],
    })
  })

  it("renders goal description", () => {
    render(<GoalInspector entityId="g-1" />)
    expect(screen.getByText("Add OAuth2 support")).toBeInTheDocument()
  })

  it("renders status badge", () => {
    render(<GoalInspector entityId="g-1" />)
    expect(screen.getByText("active")).toBeInTheDocument()
  })

  it("renders budget info", () => {
    render(<GoalInspector entityId="g-1" />)
    expect(screen.getByText(/\$5\.00/)).toBeInTheDocument()
  })

  it("shows not found for missing goal", () => {
    render(<GoalInspector entityId="nonexistent" />)
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/inspector/__tests__/goal-inspector.test.tsx`
Expected: FAIL — module not found. Create the directory first: `mkdir -p src/components/inspector/__tests__`

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/inspector/goal-inspector.tsx
"use client"
import { useDashboardStore } from "@/lib/store"
import { StatusBadge } from "@/components/primitives/status-badge"
import { ActivityThread } from "@/components/composites/activity-thread"
import { InspStat } from "./insp-stat"
import { getGoalTasks, computeTaskProgress, computePhaseSegments, SEGMENT_COLORS } from "@/lib/hooks/use-goal-tasks"
import { formatCurrency } from "@/lib/utils/format"

interface GoalInspectorProps {
  entityId: string
}

export function GoalInspector({ entityId }: GoalInspectorProps) {
  const goal = useDashboardStore((s) => s.goals.find((g) => g.id === entityId))
  const activeTasks = useDashboardStore((s) => s.activeTasks)
  const recentEvents = useDashboardStore((s) => s.recentEvents)

  if (!goal) {
    return <p className="text-sm text-text-muted">Goal not found.</p>
  }

  const tasks = getGoalTasks(activeTasks, goal.id)
  const { done, total } = computeTaskProgress(tasks, goal.taskCount)
  const segments = computePhaseSegments(tasks)
  const budgetUsed = goal.totalBudget.maxCostUsd - goal.totalBudget.remaining
  const goalEvents = recentEvents.filter((e) => e.goalId === goal.id)

  return (
    <div>
      {/* Title */}
      <h2 className="text-[15px] font-bold text-text-primary mb-3">{goal.description}</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <InspStat label="Status"><StatusBadge status={goal.status} /></InspStat>
        <InspStat label="Tasks">{done}/{total}</InspStat>
        <InspStat label="Budget">{formatCurrency(budgetUsed)} / {formatCurrency(goal.totalBudget.maxCostUsd)}</InspStat>
        <InspStat label="Task Count">{goal.taskCount}</InspStat>
      </div>

      {/* Phase progress */}
      <div className="h-1.5 rounded-full bg-border overflow-hidden flex mb-4">
        {segments.map((seg, i) => (
          <div key={i} className="h-full" style={{ width: `${seg.percent}%`, backgroundColor: SEGMENT_COLORS[seg.type] }} />
        ))}
      </div>

      {/* Task list */}
      {tasks.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">Tasks</p>
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0 text-[12px]">
              <span className="text-text-primary truncate flex-1">{task.description.split("\n")[0].slice(0, 40)}</span>
              <StatusBadge status={task.status} />
            </div>
          ))}
        </div>
      )}

      {/* Activity */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">Activity</p>
        <ActivityThread events={goalEvents} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/inspector/__tests__/goal-inspector.test.tsx`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/inspector/insp-stat.tsx dashboard/src/components/inspector/goal-inspector.tsx dashboard/src/components/inspector/__tests__/goal-inspector.test.tsx
git commit -m "feat(inspector): add InspStat shared component + GoalInspector"
```

---

## Task 5: Create `TaskInspector`

**Files:**
- Create: `src/components/inspector/task-inspector.tsx`
- Create: `src/components/inspector/__tests__/task-inspector.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/inspector/__tests__/task-inspector.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TaskInspector } from "../task-inspector"
import { useDashboardStore } from "@/lib/store"
import type { TaskDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 100000, maxCostUsd: 10, remaining: 5 })
const makeTask = (overrides?: Partial<TaskDTO>): TaskDTO => ({
  id: "t-1", goalId: "g-1", description: "Write OAuth handler", status: "review",
  phase: "implementation", assignedTo: "dev-03", tokensUsed: 5000,
  budget: makeBudget(), retryCount: 0, branch: "feat/oauth", ...overrides,
})

describe("TaskInspector", () => {
  beforeEach(() => {
    useDashboardStore.setState({
      activeTasks: [makeTask()],
      recentEvents: [],
    })
  })

  it("renders task description", () => {
    render(<TaskInspector entityId="t-1" />)
    expect(screen.getByText("Write OAuth handler")).toBeInTheDocument()
  })

  it("renders status and agent info", () => {
    render(<TaskInspector entityId="t-1" />)
    expect(screen.getByText("review")).toBeInTheDocument()
    expect(screen.getByText("dev-03")).toBeInTheDocument()
  })

  it("renders Diff, Artifacts, Activity tabs", () => {
    render(<TaskInspector entityId="t-1" />)
    expect(screen.getByText("Diff")).toBeInTheDocument()
    expect(screen.getByText("Artifacts")).toBeInTheDocument()
    expect(screen.getByText("Activity")).toBeInTheDocument()
  })

  it("renders Approve & Merge button for review status", () => {
    render(<TaskInspector entityId="t-1" />)
    expect(screen.getByText(/approve/i)).toBeInTheDocument()
    expect(screen.getByText(/discard/i)).toBeInTheDocument()
  })

  it("renders Retry button for failed status", () => {
    useDashboardStore.setState({ activeTasks: [makeTask({ status: "failed" })] })
    render(<TaskInspector entityId="t-1" />)
    expect(screen.getByText(/retry/i)).toBeInTheDocument()
  })

  it("shows not found for missing task", () => {
    render(<TaskInspector entityId="nonexistent" />)
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/inspector/__tests__/task-inspector.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/inspector/task-inspector.tsx
"use client"
import { useState } from "react"
import { useDashboardStore } from "@/lib/store"
import { StatusBadge } from "@/components/primitives/status-badge"
import { ActivityThread } from "@/components/composites/activity-thread"
import { DiffViewer } from "@/components/composites/diff-viewer"
import { InspStat } from "./insp-stat"
import { formatTokens, formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

const REVIEW_STATUSES = new Set(["review", "pending_review"])
const FAILED_STATUSES = new Set(["failed"])

type Tab = "diff" | "artifacts" | "activity"

interface TaskInspectorProps {
  entityId: string
}

export function TaskInspector({ entityId }: TaskInspectorProps) {
  const task = useDashboardStore((s) => s.activeTasks.find((t) => t.id === entityId))
  const recentEvents = useDashboardStore((s) => s.recentEvents)
  const [activeTab, setActiveTab] = useState<Tab>("diff")

  if (!task) {
    return <p className="text-sm text-text-muted">Task not found.</p>
  }

  const taskEvents = recentEvents.filter((e) => e.taskId === task.id)
  const isReview = REVIEW_STATUSES.has(task.status)
  const isFailed = FAILED_STATUSES.has(task.status)
  const budgetRatio = task.budget.maxTokens > 0 ? task.tokensUsed / task.budget.maxTokens : 0

  return (
    <div>
      {/* Title */}
      <h2 className="text-[15px] font-bold text-text-primary mb-3">{task.description.split("\n")[0]}</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <InspStat label="Status"><StatusBadge status={task.status} /></InspStat>
        <InspStat label="Agent">{task.assignedTo ?? "unassigned"}</InspStat>
        <InspStat label="Budget">{formatCurrency(task.budget.maxCostUsd - task.budget.remaining)}</InspStat>
        <InspStat label="Attempt">{task.retryCount + 1}/3</InspStat>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border mb-3">
        {(["diff", "artifacts", "activity"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3.5 py-2 text-[12px] font-medium border-b-2 transition-colors capitalize",
              activeTab === tab
                ? "text-text-primary border-status-purple-fg"
                : "text-text-muted border-transparent hover:text-text-secondary",
            )}
          >
            {tab === "diff" ? "Diff" : tab === "artifacts" ? "Artifacts" : "Activity"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "diff" && (
        <DiffViewer files={[]} />
      )}
      {activeTab === "artifacts" && (
        <p className="text-[11px] text-text-muted py-3">No artifacts.</p>
      )}
      {activeTab === "activity" && (
        <ActivityThread events={taskEvents} />
      )}

      {/* Action buttons — status-adaptive */}
      <div className="flex gap-2 mt-4">
        {isReview && (
          <>
            <button className="flex-1 py-2 rounded-lg bg-text-primary text-text-inverse text-[13px] font-semibold">
              Approve &amp; Merge
            </button>
            <button className="flex-1 py-2 rounded-lg border border-status-red-border text-status-red-fg text-[13px] font-semibold">
              Discard
            </button>
            <button className="flex-1 py-2 rounded-lg border border-border text-text-secondary text-[13px] font-semibold">
              Reassign
            </button>
          </>
        )}
        {isFailed && (
          <>
            <button className="flex-1 py-2 rounded-lg bg-text-primary text-text-inverse text-[13px] font-semibold">
              Retry
            </button>
            <button className="flex-1 py-2 rounded-lg border border-border text-text-secondary text-[13px] font-semibold">
              Reassign
            </button>
            <button className="flex-1 py-2 rounded-lg border border-status-red-border text-status-red-fg text-[13px] font-semibold">
              Discard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/inspector/__tests__/task-inspector.test.tsx`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/inspector/task-inspector.tsx dashboard/src/components/inspector/__tests__/task-inspector.test.tsx
git commit -m "feat(inspector): add TaskInspector — status, agent, diff/artifacts/activity tabs, action buttons"
```

---

## Task 6: Create `AgentInspector`

**Files:**
- Create: `src/components/inspector/agent-inspector.tsx`
- Create: `src/components/inspector/__tests__/agent-inspector.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/inspector/__tests__/agent-inspector.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { AgentInspector } from "../agent-inspector"
import { useDashboardStore } from "@/lib/store"
import type { AgentDTO } from "@/lib/types"

const makeAgent = (overrides?: Partial<AgentDTO>): AgentDTO => ({
  id: "dev-03", role: "developer", status: "busy", currentTaskId: "t-1",
  model: "claude-sonnet-4-6", lastActiveAt: "2026-03-29T14:32:00Z", ...overrides,
})

describe("AgentInspector", () => {
  beforeEach(() => {
    useDashboardStore.setState({
      agents: [makeAgent()],
      recentEvents: [],
    })
  })

  it("renders agent role", () => {
    render(<AgentInspector entityId="dev-03" />)
    expect(screen.getByText("developer")).toBeInTheDocument()
  })

  it("renders agent model", () => {
    render(<AgentInspector entityId="dev-03" />)
    expect(screen.getByText("claude-sonnet-4-6")).toBeInTheDocument()
  })

  it("renders current task link", () => {
    render(<AgentInspector entityId="dev-03" />)
    expect(screen.getByText(/t-1/)).toBeInTheDocument()
  })

  it("renders pause button for busy agent", () => {
    render(<AgentInspector entityId="dev-03" />)
    expect(screen.getByText(/pause/i)).toBeInTheDocument()
  })

  it("renders resume button for paused agent", () => {
    useDashboardStore.setState({ agents: [makeAgent({ status: "paused" })] })
    render(<AgentInspector entityId="dev-03" />)
    expect(screen.getByText(/resume/i)).toBeInTheDocument()
  })

  it("shows not found for missing agent", () => {
    render(<AgentInspector entityId="nonexistent" />)
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/inspector/__tests__/agent-inspector.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/inspector/agent-inspector.tsx
"use client"
import { useDashboardStore } from "@/lib/store"
import { useInspectorStore } from "@/lib/inspector-store"
import { StatusBadge } from "@/components/primitives/status-badge"
import { ActivityThread } from "@/components/composites/activity-thread"
import { InspStat } from "./insp-stat"
import { api } from "@/lib/api"

interface AgentInspectorProps {
  entityId: string
}

export function AgentInspector({ entityId }: AgentInspectorProps) {
  const agent = useDashboardStore((s) => s.agents.find((a) => a.id === entityId))
  const recentEvents = useDashboardStore((s) => s.recentEvents)
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const openInspector = useInspectorStore((s) => s.open)

  if (!agent) {
    return <p className="text-sm text-text-muted">Agent not found.</p>
  }

  const agentEvents = recentEvents.filter((e) => e.agentId === agent.id)
  const canPause = agent.status !== "paused" && agent.status !== "idle" && agent.status !== "stopped"
  const canResume = agent.status === "paused"

  const handlePause = async () => {
    await api.pauseAgent(agent.id, "Manual pause from inspector")
    await fetchLiveFloor()
  }
  const handleResume = async () => {
    await api.resumeAgent(agent.id)
    await fetchLiveFloor()
  }

  return (
    <div>
      {/* Title */}
      <h2 className="text-[15px] font-bold text-text-primary mb-3 capitalize">{agent.role}</h2>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <InspStat label="Status"><StatusBadge status={agent.status} /></InspStat>
        <InspStat label="Model">{agent.model}</InspStat>
        <div className="rounded-lg bg-bg-hover p-2.5 col-span-2">
          <p className="text-[11px] text-text-muted">Current Task</p>
          {agent.currentTaskId ? (
            <button
              onClick={() => openInspector(agent.currentTaskId!, "task", agent.currentTaskId!)}
              className="text-[13px] font-mono font-medium text-status-blue-fg hover:underline mt-0.5"
            >
              {agent.currentTaskId}
            </button>
          ) : (
            <p className="text-[13px] text-text-muted mt-0.5">none</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        {canPause && (
          <button onClick={handlePause} className="flex-1 py-2 rounded-lg border border-border text-text-secondary text-[13px] font-semibold hover:bg-bg-hover">
            Pause
          </button>
        )}
        {canResume && (
          <button onClick={handleResume} className="flex-1 py-2 rounded-lg border border-status-green-border text-status-green-fg text-[13px] font-semibold hover:bg-status-green-surface">
            Resume
          </button>
        )}
      </div>

      {/* Activity */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">Activity</p>
        <ActivityThread events={agentEvents} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/inspector/__tests__/agent-inspector.test.tsx`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/inspector/agent-inspector.tsx dashboard/src/components/inspector/__tests__/agent-inspector.test.tsx
git commit -m "feat(inspector): add AgentInspector — role, model, current task, pause/resume, activity"
```

---

## Task 7: Create `EventInspector`

**Files:**
- Create: `src/components/inspector/event-inspector.tsx`

- [ ] **Step 1: Write the implementation**

```typescript
// src/components/inspector/event-inspector.tsx
"use client"
import { useDashboardStore } from "@/lib/store"
import { useInspectorStore } from "@/lib/inspector-store"
import { StatusDot } from "@/components/primitives/status-dot"
import { eventToStatus } from "@/components/composites/activity-thread"
import { formatTimeAgo } from "@/lib/utils/format"

interface EventInspectorProps {
  entityId: string
}

export function EventInspector({ entityId }: EventInspectorProps) {
  const event = useDashboardStore((s) => s.recentEvents.find((e) => e.id === entityId))
  const openInspector = useInspectorStore((s) => s.open)

  if (!event) {
    return <p className="text-sm text-text-muted">Event not found.</p>
  }

  return (
    <div>
      {/* Type + status */}
      <div className="flex items-center gap-2 mb-3">
        <StatusDot status={eventToStatus(event.type)} />
        <h2 className="text-[15px] font-bold font-mono text-text-primary">{event.type}</h2>
      </div>

      {/* Details */}
      <div className="space-y-2.5 mb-4">
        <DetailRow label="Timestamp">{formatTimeAgo(event.occurredAt)}</DetailRow>
        {event.goalId && (
          <DetailRow label="Goal">
            <button
              onClick={() => openInspector(event.goalId!, "goal", event.goalId!)}
              className="text-status-blue-fg font-mono hover:underline"
            >
              {event.goalId}
            </button>
          </DetailRow>
        )}
        {event.taskId && (
          <DetailRow label="Task">
            <button
              onClick={() => openInspector(event.taskId!, "task", event.taskId!)}
              className="text-status-blue-fg font-mono hover:underline"
            >
              {event.taskId}
            </button>
          </DetailRow>
        )}
        {event.agentId && (
          <DetailRow label="Agent">
            <button
              onClick={() => openInspector(event.agentId!, "agent", event.agentId!)}
              className="text-status-blue-fg font-mono hover:underline"
            >
              {event.agentId}
            </button>
          </DetailRow>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border text-[12px]">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary">{children}</span>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx vitest run && npx next build`
Expected: All tests pass, build succeeds

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/inspector/event-inspector.tsx
git commit -m "feat(inspector): add EventInspector — type, parent chain links, timestamp"
```

---

## Task 8: Create Inspector Registry + Wire into InspectorPanel

**Files:**
- Create: `src/components/inspector/inspector-registry.ts`
- Modify: `src/components/layout/inspector-panel.tsx`
- Modify: `src/components/layout/__tests__/inspector-panel.test.tsx`

- [ ] **Step 1: Create the inspector registry**

```typescript
// src/components/inspector/inspector-registry.ts
import type { ComponentType } from "react"
import { GoalInspector } from "./goal-inspector"
import { TaskInspector } from "./task-inspector"
import { AgentInspector } from "./agent-inspector"
import { EventInspector } from "./event-inspector"

interface InspectorComponentProps {
  entityId: string
}

const INSPECTOR_MAP: Record<string, ComponentType<InspectorComponentProps>> = {
  goal: GoalInspector,
  task: TaskInspector,
  agent: AgentInspector,
  event: EventInspector,
}

export function getInspectorComponent(entityType: string): ComponentType<InspectorComponentProps> | null {
  return INSPECTOR_MAP[entityType] ?? null
}
```

- [ ] **Step 2: Update InspectorPanel to use registry**

Replace the placeholder body in `src/components/layout/inspector-panel.tsx`. Change the import section and the body div:

Add import at top:
```typescript
import { getInspectorComponent } from "@/components/inspector/inspector-registry"
```

Replace the body section (the `<div className="flex-1 p-4">` block) with:

```typescript
      {/* Body — type-specific inspector */}
      <div className="flex-1 p-4">
        {(() => {
          const InspectorComponent = selectedEntityType ? getInspectorComponent(selectedEntityType) : null
          if (!InspectorComponent) {
            return <p className="text-sm text-text-muted">Unknown entity type.</p>
          }
          return <InspectorComponent entityId={selectedEntityId} />
        })()}
      </div>
```

- [ ] **Step 3: Update InspectorPanel tests**

Add a test to `src/components/layout/__tests__/inspector-panel.test.tsx` that verifies type-specific content renders:

Add this test to the existing describe block:

```typescript
  it("renders goal inspector content for goal entity", () => {
    useDashboardStore.setState({
      goals: [{ id: "g-1", description: "Test goal", status: "active", createdAt: "2026-03-29T10:00:00Z", completedAt: null, taskCount: 2, totalBudget: { maxTokens: 100000, maxCostUsd: 10, remaining: 5 } }],
      activeTasks: [],
      recentEvents: [],
    })
    useInspectorStore.getState().open("g-1", "goal", "Test goal")
    render(<InspectorPanel />)
    expect(screen.getByText("Test goal")).toBeInTheDocument()
  })
```

Add `import { useDashboardStore } from "@/lib/store"` to the test imports.

- [ ] **Step 4: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/inspector/inspector-registry.ts dashboard/src/components/layout/inspector-panel.tsx dashboard/src/components/layout/__tests__/inspector-panel.test.tsx
git commit -m "feat(inspector): wire registry into InspectorPanel — strategy pattern delegation"
```

---

## Task 9: Full Verification

- [ ] **Step 1: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run the build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Verify workflow**

Open `http://localhost:3000` and verify:
- Click a task card in a GoalRow's phase lanes → Inspector slides in showing TaskInspector (description, status, agent, tabs, action buttons)
- Click the Diff tab → shows "No code changes" (expected — backend endpoint not built yet)
- Click Activity tab → shows entity-scoped events
- Review task shows "Approve & Merge" + "Discard" + "Reassign" buttons
- Failed task shows "Retry" + "Reassign" + "Discard" buttons
- Click a goal in the sidebar → GoalFocusView appears → click a task → TaskInspector in Pane 3
- Inspector breadcrumbs update as you navigate deeper
- Pin button keeps inspector open when clicking elsewhere

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(inspector): Phase 3 complete — type-specific inspectors with activity, diff, actions"
```
