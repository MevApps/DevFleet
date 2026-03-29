# Phase 2: Floor + Stream + Goal Focus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Active Floor with Stream view (goal rows with expandable shatter view) and Goal Focus View (single-goal detail with stat cards and phase lanes), replacing the old Goals, Tasks, and Live Floor pages as the primary content area.

**Architecture:** `ActiveFloor` is the Pane 2 container that reads from `useFloorStore` to decide what to render: Stream view (list of `GoalRow` components), Goal Focus View (when a goal is selected from the sidebar), or secondary views. `GoalRow` shows a collapsed summary with a phase progress bar and expands to show `PhaseLanes` (task cards in horizontal phase columns). A `useGoalTasks` hook derives per-goal task data from the existing `useDashboardStore`. Data fetching is consolidated: one `fetchLiveFloor()` + `fetchPipeline()` on mount, SSE keeps it current.

**Tech Stack:** Next.js 15, React 19, Zustand 5, Tailwind CSS 4, Lucide React, Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-unified-command-redesign.md` (Sections 2, 4, 6)

**Depends on:** Phase 1 (shell) — merged to master

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/hooks/use-goal-tasks.ts` | Hook: derive tasks for a goal from dashboard store, compute phase segments and progress |
| `src/lib/hooks/__tests__/use-goal-tasks.test.ts` | Tests for useGoalTasks |
| `src/components/composites/view-mode-toggle.tsx` | Segmented control: Stream / Kanban / Table |
| `src/components/composites/__tests__/view-mode-toggle.test.tsx` | Tests for ViewModeToggle |
| `src/components/composites/goal-row.tsx` | Collapsible stream row: phase bar, task count, budget, status badge, expand to PhaseLanes |
| `src/components/composites/__tests__/goal-row.test.tsx` | Tests for GoalRow |
| `src/components/composites/phase-lanes.tsx` | Horizontal phase columns with task cards inside expanded GoalRow or GoalFocusView |
| `src/components/composites/goal-focus-view.tsx` | Full-floor single-goal detail: back button, header, stat cards, phase lanes |
| `src/components/composites/__tests__/goal-focus-view.test.tsx` | Tests for GoalFocusView |
| `src/components/composites/active-floor.tsx` | Pane 2 orchestrator: reads floorStore, renders Stream / GoalFocus / secondary views |
| `src/components/composites/__tests__/active-floor.test.tsx` | Tests for ActiveFloor |

### Modified Files
| File | Change |
|------|--------|
| `src/app/layout-shell.tsx` | Replace raw `children` with `<ActiveFloor />`, add data fetch on mount |
| `src/components/layout/app-sidebar.tsx` | Fix `tasksDone = 0` to use real task data |
| `src/components/composites/task-card.tsx` | Add optional `compact` and `goalTag` props |

### Unchanged (used as-is)
| File | Used By |
|------|---------|
| `src/lib/store.ts` | All components (goals, activeTasks, tasksByPhase) |
| `src/lib/floor-store.ts` | ActiveFloor, GoalRow, GoalFocusView |
| `src/lib/inspector-store.ts` | Task cards (open inspector on click) |
| `src/components/primitives/status-badge.tsx` | GoalRow, GoalFocusView |
| `src/components/primitives/time-ago.tsx` | GoalRow |
| `src/components/primitives/empty-state.tsx` | ActiveFloor (no goals state) |

---

## Task 1: Create `useGoalTasks` Hook

**Files:**
- Create: `src/lib/hooks/use-goal-tasks.ts`
- Create: `src/lib/hooks/__tests__/use-goal-tasks.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/hooks/__tests__/use-goal-tasks.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { useDashboardStore } from "@/lib/store"
import { getGoalTasks, computePhaseSegments, computeTaskProgress, getTaskDisplayPhase } from "../use-goal-tasks"
import type { TaskDTO, GoalDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 10000, maxCostUsd: 1, remaining: 0.5 })

const makeTask = (overrides: Partial<TaskDTO>): TaskDTO => ({
  id: "t-1", goalId: "g-1", description: "Test task", status: "in_progress",
  phase: "implementation", assignedTo: "dev-01", tokensUsed: 500,
  budget: makeBudget(), retryCount: 0, branch: null, ...overrides,
})

describe("getGoalTasks", () => {
  it("filters tasks by goalId", () => {
    const tasks: readonly TaskDTO[] = [
      makeTask({ id: "t-1", goalId: "g-1" }),
      makeTask({ id: "t-2", goalId: "g-2" }),
      makeTask({ id: "t-3", goalId: "g-1" }),
    ]
    const result = getGoalTasks(tasks, "g-1")
    expect(result).toHaveLength(2)
    expect(result.map(t => t.id)).toEqual(["t-1", "t-3"])
  })

  it("returns empty array when no tasks match", () => {
    const tasks: readonly TaskDTO[] = [makeTask({ goalId: "g-2" })]
    expect(getGoalTasks(tasks, "g-1")).toEqual([])
  })
})

describe("computePhaseSegments", () => {
  it("computes segment widths from task statuses", () => {
    const tasks: readonly TaskDTO[] = [
      makeTask({ status: "completed", phase: "planning" }),
      makeTask({ status: "in_progress", phase: "implementation" }),
      makeTask({ status: "review", phase: "review" }),
      makeTask({ status: "queued", phase: "implementation" }),
    ]
    const segments = computePhaseSegments(tasks)
    expect(segments).toEqual([
      { type: "done", percent: 25 },
      { type: "active", percent: 25 },
      { type: "review", percent: 25 },
      { type: "queued", percent: 25 },
    ])
  })

  it("returns empty array for no tasks", () => {
    expect(computePhaseSegments([])).toEqual([])
  })

  it("handles all completed tasks", () => {
    const tasks: readonly TaskDTO[] = [
      makeTask({ status: "completed" }),
      makeTask({ status: "merged" }),
    ]
    const segments = computePhaseSegments(tasks)
    expect(segments).toEqual([{ type: "done", percent: 100 }])
  })
})

describe("getTaskDisplayPhase", () => {
  it("maps completed/merged to done", () => {
    expect(getTaskDisplayPhase(makeTask({ status: "completed" }))).toBe("done")
    expect(getTaskDisplayPhase(makeTask({ status: "merged" }))).toBe("done")
  })

  it("maps review statuses to review", () => {
    expect(getTaskDisplayPhase(makeTask({ status: "review" }))).toBe("review")
    expect(getTaskDisplayPhase(makeTask({ status: "pending_review" }))).toBe("review")
  })

  it("uses task.phase for active/queued statuses", () => {
    expect(getTaskDisplayPhase(makeTask({ status: "in_progress", phase: "planning" }))).toBe("planning")
    expect(getTaskDisplayPhase(makeTask({ status: "queued", phase: "implementation" }))).toBe("implementation")
  })
})

describe("computeTaskProgress", () => {
  it("counts completed and total tasks", () => {
    const tasks: readonly TaskDTO[] = [
      makeTask({ status: "completed" }),
      makeTask({ status: "merged" }),
      makeTask({ status: "in_progress" }),
      makeTask({ status: "queued" }),
    ]
    const progress = computeTaskProgress(tasks, 4)
    expect(progress).toEqual({ done: 2, total: 4 })
  })

  it("uses goalTaskCount when larger than tasks array", () => {
    const tasks: readonly TaskDTO[] = [
      makeTask({ status: "completed" }),
    ]
    const progress = computeTaskProgress(tasks, 5)
    expect(progress).toEqual({ done: 1, total: 5 })
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/lib/hooks/__tests__/use-goal-tasks.test.ts`
Expected: FAIL — module `../use-goal-tasks` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/hooks/use-goal-tasks.ts
import type { TaskDTO } from "@/lib/types"

export const DONE_STATUSES = new Set(["completed", "approved", "merged"])
export const ACTIVE_STATUSES = new Set(["in_progress", "busy"])
export const REVIEW_STATUSES = new Set(["review", "pending_review"])

export const SEGMENT_COLORS: Record<string, string> = {
  done: "var(--status-green-fg)",
  active: "var(--status-blue-fg)",
  review: "var(--status-purple-fg)",
  queued: "var(--border)",
}

export interface PhaseSegment {
  readonly type: "done" | "active" | "review" | "queued"
  readonly percent: number
}

export interface TaskProgress {
  readonly done: number
  readonly total: number
}

export function getGoalTasks(tasks: readonly TaskDTO[], goalId: string): TaskDTO[] {
  return tasks.filter((t) => t.goalId === goalId)
}

export function getTaskDisplayPhase(task: TaskDTO): string {
  if (DONE_STATUSES.has(task.status)) return "done"
  if (REVIEW_STATUSES.has(task.status)) return "review"
  return task.phase || "implementation"
}

export function computePhaseSegments(tasks: readonly TaskDTO[]): PhaseSegment[] {
  if (tasks.length === 0) return []

  let done = 0, active = 0, review = 0, queued = 0
  for (const t of tasks) {
    if (DONE_STATUSES.has(t.status)) done++
    else if (ACTIVE_STATUSES.has(t.status)) active++
    else if (REVIEW_STATUSES.has(t.status)) review++
    else queued++
  }

  const total = tasks.length
  const segments: PhaseSegment[] = []
  if (done > 0) segments.push({ type: "done", percent: Math.round((done / total) * 100) })
  if (active > 0) segments.push({ type: "active", percent: Math.round((active / total) * 100) })
  if (review > 0) segments.push({ type: "review", percent: Math.round((review / total) * 100) })
  if (queued > 0) segments.push({ type: "queued", percent: Math.round((queued / total) * 100) })
  return segments
}

export function computeTaskProgress(tasks: readonly TaskDTO[], goalTaskCount: number): TaskProgress {
  const done = tasks.filter((t) => DONE_STATUSES.has(t.status)).length
  return { done, total: Math.max(tasks.length, goalTaskCount) }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/lib/hooks/__tests__/use-goal-tasks.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/hooks/use-goal-tasks.ts dashboard/src/lib/hooks/__tests__/use-goal-tasks.test.ts
git commit -m "feat(floor): add useGoalTasks — derive per-goal task data, phase segments, progress"
```

---

## Task 2: Create `ViewModeToggle`

**Files:**
- Create: `src/components/composites/view-mode-toggle.tsx`
- Create: `src/components/composites/__tests__/view-mode-toggle.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/composites/__tests__/view-mode-toggle.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { ViewModeToggle } from "../view-mode-toggle"
import { useFloorStore } from "@/lib/floor-store"

describe("ViewModeToggle", () => {
  beforeEach(() => {
    useFloorStore.setState({ viewMode: "stream" })
  })

  it("renders three view mode buttons", () => {
    render(<ViewModeToggle />)
    expect(screen.getByText("Stream")).toBeInTheDocument()
    expect(screen.getByText("Kanban")).toBeInTheDocument()
    expect(screen.getByText("Table")).toBeInTheDocument()
  })

  it("highlights the active view mode", () => {
    render(<ViewModeToggle />)
    const streamBtn = screen.getByText("Stream")
    expect(streamBtn.className).toContain("bg-text-primary")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/view-mode-toggle.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/composites/view-mode-toggle.tsx
"use client"
import { useFloorStore } from "@/lib/floor-store"
import { cn } from "@/lib/utils"

const VIEW_MODES = [
  { value: "stream" as const, label: "Stream" },
  { value: "kanban" as const, label: "Kanban" },
  { value: "table" as const, label: "Table" },
]

export function ViewModeToggle() {
  const viewMode = useFloorStore((s) => s.viewMode)
  const setViewMode = useFloorStore((s) => s.setViewMode)

  return (
    <div className="flex rounded-lg overflow-hidden border border-border">
      {VIEW_MODES.map((mode) => (
        <button
          key={mode.value}
          onClick={() => setViewMode(mode.value)}
          className={cn(
            "px-3.5 py-1 text-[12px] font-medium transition-colors",
            viewMode === mode.value
              ? "bg-text-primary text-text-inverse"
              : "bg-bg-card text-text-muted hover:text-text-secondary",
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/view-mode-toggle.test.tsx`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/composites/view-mode-toggle.tsx dashboard/src/components/composites/__tests__/view-mode-toggle.test.tsx
git commit -m "feat(floor): add ViewModeToggle — segmented control for Stream/Kanban/Table"
```

---

## Task 3: Extend `TaskCard` with `compact` and `goalTag` Props

**Files:**
- Modify: `src/components/composites/task-card.tsx`

- [ ] **Step 1: Extend TaskCard**

Add optional `compact` and `goalTag` props. When `compact` is true, show a smaller card suitable for phase lanes (no progress bar, tighter padding). When `goalTag` is provided, show a colored goal chip.

```typescript
// src/components/composites/task-card.tsx
import type { TaskDTO } from "@/lib/types"
import { EntityIcon } from "@/components/primitives/entity-icon"
import { StatusBadge } from "@/components/primitives/status-badge"
import { ProgressBar } from "@/components/primitives/progress-bar"
import { formatTokens } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface TaskCardProps {
  task: TaskDTO
  compact?: boolean
  goalTag?: { label: string; color: string }
  onClick?: () => void
}

export function TaskCard({ task, compact, goalTag, onClick }: TaskCardProps) {
  const budgetRatio = task.budget.maxTokens > 0 ? task.tokensUsed / task.budget.maxTokens : 0

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left rounded-lg border border-border p-2.5 bg-bg-card transition-colors mb-2",
          onClick && "hover:border-border-hover cursor-pointer",
        )}
      >
        <p className="text-[13px] font-medium text-text-primary leading-snug">
          {task.description.split("\n")[0].slice(0, 50)}{task.description.length > 50 ? "..." : ""}
        </p>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-text-muted">
          {task.assignedTo && (
            <span className="px-1.5 py-0.5 rounded bg-status-blue-surface text-status-blue-fg font-mono text-[10px]">
              {task.assignedTo}
            </span>
          )}
          {!task.assignedTo && <span>queued</span>}
          {goalTag && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ backgroundColor: `${goalTag.color}15`, color: goalTag.color }}
            >
              {goalTag.label}
            </span>
          )}
        </div>
        {task.status === "in_progress" && budgetRatio > 0 && (
          <div className="h-[3px] rounded-full bg-border mt-1.5 overflow-hidden">
            <div className="h-full rounded-full bg-status-blue-fg" style={{ width: `${Math.min(budgetRatio * 100, 100)}%` }} />
          </div>
        )}
      </button>
    )
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border p-4 bg-card",
        onClick && "cursor-pointer hover:border-border-hover",
      )}
      style={{ borderLeftWidth: "3px", borderLeftColor: "hsl(125, 70%, 40%)" }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <EntityIcon entity="task" size="md" />
          <div>
            <div className="text-sm font-medium text-text-primary leading-snug">{task.description.split("\n")[0].slice(0, 60)}{task.description.length > 60 ? "..." : ""}</div>
            <div className="text-xs text-text-muted">{task.phase} &middot; #{task.id.slice(0, 6)}</div>
          </div>
        </div>
        <StatusBadge status={task.status} />
      </div>

      <div className="flex gap-3 text-xs mb-2 text-text-secondary">
        <span>Phase: <span className="text-status-purple-fg">{task.phase}</span></span>
        {task.assignedTo && <span>Agent: <span className="text-text-primary">{task.assignedTo}</span></span>}
      </div>

      <ProgressBar value={budgetRatio} label="Budget" showPercent thresholds={{ warn: 0.5, critical: 0.8 }} />
      <div className="text-xs font-mono mt-1 text-text-secondary">
        {formatTokens(task.tokensUsed)} / {formatTokens(task.budget.maxTokens)} tokens
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx vitest run && npx next build`
Expected: All tests pass, build succeeds. The existing full card rendering is unchanged — we just added new props.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/composites/task-card.tsx
git commit -m "feat(floor): extend TaskCard with compact and goalTag props for phase lanes"
```

---

## Task 4: Create `GoalRow`

**Files:**
- Create: `src/components/composites/goal-row.tsx`
- Create: `src/components/composites/__tests__/goal-row.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/composites/__tests__/goal-row.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { GoalRow } from "../goal-row"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import type { GoalDTO, TaskDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 100000, maxCostUsd: 10, remaining: 5 })

const makeGoal = (overrides?: Partial<GoalDTO>): GoalDTO => ({
  id: "g-1", description: "Add OAuth2 support", status: "active",
  createdAt: "2026-03-29T10:00:00Z", completedAt: null,
  taskCount: 4, totalBudget: makeBudget(), ...overrides,
})

const makeTask = (overrides?: Partial<TaskDTO>): TaskDTO => ({
  id: "t-1", goalId: "g-1", description: "Write handler", status: "in_progress",
  phase: "implementation", assignedTo: "dev-01", tokensUsed: 500,
  budget: makeBudget(), retryCount: 0, branch: null, ...overrides,
})

describe("GoalRow", () => {
  beforeEach(() => {
    useFloorStore.setState({ expandedGoalIds: new Set() })
    useDashboardStore.setState({ activeTasks: [] })
  })

  it("renders goal description", () => {
    render(<GoalRow goal={makeGoal()} />)
    expect(screen.getByText("Add OAuth2 support")).toBeInTheDocument()
  })

  it("renders task count", () => {
    render(<GoalRow goal={makeGoal({ taskCount: 6 })} />)
    expect(screen.getByText(/0\/6/)).toBeInTheDocument()
  })

  it("renders status badge", () => {
    render(<GoalRow goal={makeGoal({ status: "active" })} />)
    expect(screen.getByText("active")).toBeInTheDocument()
  })

  it("shows amber border for blocked goals", () => {
    const { container } = render(<GoalRow goal={makeGoal({ status: "blocked" })} />)
    const row = container.firstChild as HTMLElement
    expect(row.className).toContain("border-l-3")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/goal-row.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/composites/goal-row.tsx
"use client"
import type { GoalDTO } from "@/lib/types"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import { useInspectorStore } from "@/lib/inspector-store"
import { StatusBadge } from "@/components/primitives/status-badge"
import { TimeAgo } from "@/components/primitives/time-ago"
import { PhaseLanes } from "./phase-lanes"
import { getGoalTasks, computePhaseSegments, computeTaskProgress, SEGMENT_COLORS } from "@/lib/hooks/use-goal-tasks"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"

const ATTENTION_STATUSES = new Set(["blocked", "failed"])

export function GoalRow({ goal }: { goal: GoalDTO }) {
  const expandedGoalIds = useFloorStore((s) => s.expandedGoalIds)
  const toggleGoalExpanded = useFloorStore((s) => s.toggleGoalExpanded)
  const activeTasks = useDashboardStore((s) => s.activeTasks)
  const openInspector = useInspectorStore((s) => s.open)

  const isExpanded = expandedGoalIds.has(goal.id)
  const tasks = getGoalTasks(activeTasks, goal.id)
  const segments = computePhaseSegments(tasks)
  const { done, total } = computeTaskProgress(tasks, goal.taskCount)
  const needsAttention = ATTENTION_STATUSES.has(goal.status)
  const isCompleted = goal.status === "completed" || goal.status === "merged"
  const budgetUsed = goal.totalBudget.maxCostUsd - goal.totalBudget.remaining

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-bg-card mb-3 overflow-hidden transition-shadow hover:shadow-sm",
        needsAttention && "border-l-3 border-l-status-yellow-fg",
        isCompleted && "opacity-60",
      )}
    >
      {/* Collapsed header */}
      <button
        onClick={() => toggleGoalExpanded(goal.id)}
        className="flex items-center gap-3 w-full px-4 py-3.5 text-left"
      >
        <ChevronRight
          size={14}
          className={cn(
            "text-text-muted transition-transform shrink-0",
            isExpanded && "rotate-90",
          )}
        />
        <span className="text-[12px] font-mono text-text-muted shrink-0">#{goal.id.slice(0, 6)}</span>
        <span className="text-[14px] font-semibold text-text-primary flex-1 truncate">{goal.description}</span>

        {/* Phase progress bar */}
        <div className="w-[120px] h-1.5 rounded-full bg-border overflow-hidden flex shrink-0">
          {segments.map((seg, i) => (
            <div
              key={i}
              className="h-full"
              style={{ width: `${seg.percent}%`, backgroundColor: SEGMENT_COLORS[seg.type] }}
            />
          ))}
        </div>

        <span className="text-[12px] text-text-muted whitespace-nowrap shrink-0">{done}/{total}</span>
        <span className="text-[12px] font-mono text-text-muted shrink-0">{formatCurrency(budgetUsed)}</span>
        <TimeAgo timestamp={goal.completedAt ?? goal.createdAt} className="text-[12px] text-text-muted shrink-0" />
        <StatusBadge status={goal.status} />
      </button>

      {/* Expanded: Phase Lanes */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border">
          <PhaseLanes
            tasks={tasks}
            onTaskClick={(task) => openInspector(task.id, "task", task.description.split("\n")[0].slice(0, 40))}
          />
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/goal-row.test.tsx`
Expected: All 4 tests PASS (PhaseLanes import may need a stub — create it as an empty component first if needed, or the full PhaseLanes in Task 5 can come first)

**Note to implementer:** If `PhaseLanes` doesn't exist yet, create a minimal stub at `src/components/composites/phase-lanes.tsx`:
```typescript
export function PhaseLanes({ tasks, onTaskClick }: { tasks: readonly any[]; onTaskClick: (task: any) => void }) {
  return <div data-testid="phase-lanes" />
}
```
Then replace with full implementation in Task 5.

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/composites/goal-row.tsx dashboard/src/components/composites/__tests__/goal-row.test.tsx dashboard/src/components/composites/phase-lanes.tsx
git commit -m "feat(floor): add GoalRow — collapsible stream row with phase bar and shatter view"
```

---

## Task 5: Create `PhaseLanes`

**Files:**
- Create (or replace stub): `src/components/composites/phase-lanes.tsx`

- [ ] **Step 1: Write the implementation**

```typescript
// src/components/composites/phase-lanes.tsx
"use client"
import type { TaskDTO } from "@/lib/types"
import { TaskCard } from "./task-card"
import { getTaskDisplayPhase } from "@/lib/hooks/use-goal-tasks"
import { ArrowRight } from "lucide-react"

const PHASES = ["planning", "implementation", "review", "done"] as const

const PHASE_CONFIG: Record<string, { label: string; dotColor: string }> = {
  planning: { label: "Planning", dotColor: "var(--status-green-fg)" },
  implementation: { label: "Implementation", dotColor: "var(--status-blue-fg)" },
  review: { label: "Review", dotColor: "var(--status-purple-fg)" },
  done: { label: "Done", dotColor: "var(--status-green-fg)" },
}

interface PhaseLanesProps {
  tasks: readonly TaskDTO[]
  onTaskClick: (task: TaskDTO) => void
}

export function PhaseLanes({ tasks, onTaskClick }: PhaseLanesProps) {
  const tasksByPhase: Record<string, TaskDTO[]> = { planning: [], implementation: [], review: [], done: [] }
  for (const task of tasks) {
    const phase = getTaskDisplayPhase(task)
    if (tasksByPhase[phase]) tasksByPhase[phase].push(task)
    else tasksByPhase.implementation.push(task)
  }

  return (
    <div className="flex gap-3 pt-3">
      {PHASES.map((phase, i) => {
        const config = PHASE_CONFIG[phase]
        const phaseTasks = tasksByPhase[phase]
        return (
          <div key={phase} className="flex items-start gap-3 flex-1 min-w-0">
            {i > 0 && (
              <div className="flex items-center justify-center w-5 shrink-0 pt-8">
                <ArrowRight size={14} className="text-text-muted opacity-30" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.dotColor }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{config.label}</span>
                </div>
                <span className="text-[10px] text-text-muted bg-bg-hover px-1.5 py-0.5 rounded-full">{phaseTasks.length}</span>
              </div>
              <div className="min-h-[60px]">
                {phaseTasks.length === 0 && (
                  <p className="text-[11px] text-text-muted text-center py-4">No tasks</p>
                )}
                {phaseTasks.map((task) => (
                  <TaskCard key={task.id} task={task} compact onClick={() => onTaskClick(task)} />
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Write tests for PhaseLanes**

```typescript
// src/components/composites/__tests__/phase-lanes.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { PhaseLanes } from "../phase-lanes"
import type { TaskDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 10000, maxCostUsd: 1, remaining: 0.5 })
const makeTask = (overrides: Partial<TaskDTO>): TaskDTO => ({
  id: "t-1", goalId: "g-1", description: "Test task", status: "in_progress",
  phase: "implementation", assignedTo: "dev-01", tokensUsed: 500,
  budget: makeBudget(), retryCount: 0, branch: null, ...overrides,
})

describe("PhaseLanes", () => {
  it("renders four phase columns", () => {
    render(<PhaseLanes tasks={[]} onTaskClick={() => {}} />)
    expect(screen.getByText("Planning")).toBeInTheDocument()
    expect(screen.getByText("Implementation")).toBeInTheDocument()
    expect(screen.getByText("Review")).toBeInTheDocument()
    expect(screen.getByText("Done")).toBeInTheDocument()
  })

  it("places completed tasks in Done column", () => {
    const tasks = [makeTask({ id: "t-1", status: "completed", description: "Write spec" })]
    render(<PhaseLanes tasks={tasks} onTaskClick={() => {}} />)
    expect(screen.getByText(/Write spec/)).toBeInTheDocument()
  })

  it("places review tasks in Review column", () => {
    const tasks = [makeTask({ id: "t-1", status: "review", description: "Review handler" })]
    render(<PhaseLanes tasks={tasks} onTaskClick={() => {}} />)
    expect(screen.getByText(/Review handler/)).toBeInTheDocument()
  })

  it("shows 'No tasks' for empty phases", () => {
    render(<PhaseLanes tasks={[]} onTaskClick={() => {}} />)
    const noTasks = screen.getAllByText("No tasks")
    expect(noTasks).toHaveLength(4)
  })
})
```

- [ ] **Step 3: Run tests**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/phase-lanes.test.tsx`
Expected: All 4 tests PASS

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/composites/phase-lanes.tsx dashboard/src/components/composites/__tests__/phase-lanes.test.tsx
git commit -m "feat(floor): add PhaseLanes — horizontal phase columns with compact task cards"
```

---

## Task 6: Create `GoalFocusView`

**Files:**
- Create: `src/components/composites/goal-focus-view.tsx`
- Create: `src/components/composites/__tests__/goal-focus-view.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/composites/__tests__/goal-focus-view.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { GoalFocusView } from "../goal-focus-view"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import type { GoalDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 100000, maxCostUsd: 10, remaining: 5 })
const makeGoal = (overrides?: Partial<GoalDTO>): GoalDTO => ({
  id: "g-1", description: "Add OAuth2 support for GitHub and Google", status: "active",
  createdAt: "2026-03-29T10:00:00Z", completedAt: null,
  taskCount: 6, totalBudget: makeBudget(), ...overrides,
})

describe("GoalFocusView", () => {
  beforeEach(() => {
    useDashboardStore.setState({
      goals: [makeGoal()],
      activeTasks: [],
      agents: [],
    })
    useFloorStore.setState({ focusedGoalId: "g-1" })
  })

  it("renders goal title", () => {
    render(<GoalFocusView />)
    expect(screen.getByText("Add OAuth2 support for GitHub and Google")).toBeInTheDocument()
  })

  it("renders back button", () => {
    render(<GoalFocusView />)
    expect(screen.getByLabelText(/back/i)).toBeInTheDocument()
  })

  it("renders stat cards", () => {
    render(<GoalFocusView />)
    expect(screen.getByText("Tasks")).toBeInTheDocument()
    expect(screen.getByText("Budget")).toBeInTheDocument()
  })

  it("renders Tasks by Phase label", () => {
    render(<GoalFocusView />)
    expect(screen.getByText("Tasks by Phase")).toBeInTheDocument()
  })

  it("renders nothing when focusedGoalId has no matching goal", () => {
    useFloorStore.setState({ focusedGoalId: "nonexistent" })
    const { container } = render(<GoalFocusView />)
    expect(container.textContent).toContain("not found")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/goal-focus-view.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/composites/goal-focus-view.tsx
"use client"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import { useInspectorStore } from "@/lib/inspector-store"
import { StatusBadge } from "@/components/primitives/status-badge"
import { PhaseLanes } from "./phase-lanes"
import { getGoalTasks, computePhaseSegments, computeTaskProgress, SEGMENT_COLORS } from "@/lib/hooks/use-goal-tasks"
import { formatCurrency, formatElapsed } from "@/lib/utils/format"
import { ChevronLeft } from "lucide-react"

export function GoalFocusView() {
  const focusedGoalId = useFloorStore((s) => s.focusedGoalId)
  const unfocusGoal = useFloorStore((s) => s.unfocusGoal)
  const goals = useDashboardStore((s) => s.goals)
  const activeTasks = useDashboardStore((s) => s.activeTasks)
  const agents = useDashboardStore((s) => s.agents)
  const openInspector = useInspectorStore((s) => s.open)

  const goal = goals.find((g) => g.id === focusedGoalId)
  if (!goal) {
    return <p className="text-sm text-text-muted p-4">Goal not found.</p>
  }

  const tasks = getGoalTasks(activeTasks, goal.id)
  const segments = computePhaseSegments(tasks)
  const { done, total } = computeTaskProgress(tasks, goal.taskCount)
  const budgetUsed = goal.totalBudget.maxCostUsd - goal.totalBudget.remaining
  const goalAgents = [...new Set(tasks.filter((t) => t.assignedTo).map((t) => t.assignedTo!))]
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length

  return (
    <div>
      {/* Goal header */}
      <div className="flex items-start gap-4 mb-5 pb-4 border-b border-border">
        <button
          onClick={unfocusGoal}
          className="p-1.5 rounded-lg border border-border bg-bg-card text-text-muted hover:bg-bg-hover shrink-0 mt-0.5"
          aria-label="Back to all goals"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-mono text-text-muted">#{goal.id.slice(0, 8)}</span>
            <StatusBadge status={goal.status} />
          </div>
          <h1 className="text-[20px] font-bold text-text-primary leading-tight">{goal.description}</h1>
          <div className="flex items-center gap-4 mt-2 text-[13px] text-text-muted">
            <span>Created <strong className="text-text-secondary">{formatElapsed(goal.createdAt)}</strong> ago</span>
            <span className="font-mono">{formatCurrency(budgetUsed)} / {formatCurrency(goal.totalBudget.maxCostUsd)}</span>
            <span>{done} of {total} tasks</span>
          </div>
          {/* Phase progress bar */}
          <div className="h-2 rounded bg-border overflow-hidden flex mt-3">
            {segments.map((seg, i) => (
              <div
                key={i}
                className="h-full"
                style={{ width: `${seg.percent}%`, backgroundColor: SEGMENT_COLORS[seg.type] }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Tasks" value={`${done}/${total}`} sub={`${inProgressCount} in progress`} />
        <StatCard label="Agents" value={String(goalAgents.length)} sub={goalAgents.slice(0, 3).join(", ") || "none"} />
        <StatCard label="Budget" value={formatCurrency(budgetUsed)} sub={`${Math.round((budgetUsed / goal.totalBudget.maxCostUsd) * 100)}% of ${formatCurrency(goal.totalBudget.maxCostUsd)}`} />
        <StatCard label="Duration" value={formatElapsed(goal.createdAt)} sub={total > 0 ? `avg ${Math.round(((Date.now() - new Date(goal.createdAt).getTime()) / 1000 / Math.max(done, 1)))}s/task` : "—"} />
      </div>

      {/* Phase lanes */}
      <div>
        <h2 className="text-[13px] font-bold text-text-primary mb-3">Tasks by Phase</h2>
        <PhaseLanes
          tasks={tasks}
          onTaskClick={(task) => openInspector(task.id, "task", task.description.split("\n")[0].slice(0, 40))}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <p className="text-[20px] font-bold font-mono text-text-primary mt-1">{value}</p>
      <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/goal-focus-view.test.tsx`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/composites/goal-focus-view.tsx dashboard/src/components/composites/__tests__/goal-focus-view.test.tsx
git commit -m "feat(floor): add GoalFocusView — single-goal detail with stat cards and phase lanes"
```

---

## Task 7: Create `ActiveFloor`

**Files:**
- Create: `src/components/composites/active-floor.tsx`
- Create: `src/components/composites/__tests__/active-floor.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/composites/__tests__/active-floor.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { ActiveFloor } from "../active-floor"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import type { GoalDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 100000, maxCostUsd: 10, remaining: 5 })
const makeGoal = (overrides?: Partial<GoalDTO>): GoalDTO => ({
  id: "g-1", description: "Add OAuth2", status: "active",
  createdAt: "2026-03-29T10:00:00Z", completedAt: null,
  taskCount: 4, totalBudget: makeBudget(), ...overrides,
})

describe("ActiveFloor", () => {
  beforeEach(() => {
    useFloorStore.setState({ viewMode: "stream", focusedGoalId: null, activeSection: "floor" })
    useDashboardStore.setState({ goals: [], activeTasks: [], agents: [] })
  })

  it("renders Stream view with view mode toggle", () => {
    render(<ActiveFloor />)
    expect(screen.getByText("Stream")).toBeInTheDocument()
    expect(screen.getByText("Active Floor")).toBeInTheDocument()
  })

  it("shows empty state when no goals exist", () => {
    render(<ActiveFloor />)
    expect(screen.getByText(/no goals yet/i)).toBeInTheDocument()
  })

  it("renders goal rows when goals exist", () => {
    useDashboardStore.setState({ goals: [makeGoal()] })
    render(<ActiveFloor />)
    expect(screen.getByText("Add OAuth2")).toBeInTheDocument()
  })

  it("renders GoalFocusView when a goal is focused", () => {
    useDashboardStore.setState({ goals: [makeGoal()] })
    useFloorStore.setState({ focusedGoalId: "g-1" })
    render(<ActiveFloor />)
    expect(screen.getByLabelText(/back/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/active-floor.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/composites/active-floor.tsx
"use client"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import { GoalRow } from "./goal-row"
import { GoalFocusView } from "./goal-focus-view"
import { ViewModeToggle } from "./view-mode-toggle"
import { EmptyState } from "@/components/primitives/empty-state"
import { Target } from "lucide-react"

export function ActiveFloor() {
  const viewMode = useFloorStore((s) => s.viewMode)
  const focusedGoalId = useFloorStore((s) => s.focusedGoalId)
  const activeSection = useFloorStore((s) => s.activeSection)
  const goals = useDashboardStore((s) => s.goals)

  // Goal Focus View — when a goal is selected from the sidebar
  if (focusedGoalId && activeSection === "floor") {
    return <GoalFocusView />
  }

  // Stream view (default) — goal rows sorted by last activity
  if (activeSection === "floor" && viewMode === "stream") {
    const sortedGoals = [...goals].sort((a, b) => {
      const aTime = a.completedAt ?? a.createdAt
      const bTime = b.completedAt ?? b.createdAt
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[16px] font-bold text-text-primary">Active Floor</h1>
          <ViewModeToggle />
        </div>

        {sortedGoals.length === 0 ? (
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Create a goal from the sidebar to get started."
          />
        ) : (
          sortedGoals.map((goal) => <GoalRow key={goal.id} goal={goal} />)
        )}
      </div>
    )
  }

  // Kanban and Table views — placeholder for Phase 4
  if (activeSection === "floor" && (viewMode === "kanban" || viewMode === "table")) {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[16px] font-bold text-text-primary">Active Floor</h1>
          <ViewModeToggle />
        </div>
        <p className="text-sm text-text-muted">
          {viewMode === "kanban" ? "Kanban" : "Table"} view will be implemented in Phase 4.
        </p>
      </div>
    )
  }

  // Secondary sections — placeholder, Phase 5 will render existing pages here
  return (
    <div>
      <p className="text-sm text-text-muted">
        {activeSection} view will be implemented in Phase 5.
      </p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/active-floor.test.tsx`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/composites/active-floor.tsx dashboard/src/components/composites/__tests__/active-floor.test.tsx
git commit -m "feat(floor): add ActiveFloor — orchestrates Stream, GoalFocus, and placeholder views"
```

---

## Task 8: Wire ActiveFloor into Layout + Consolidate Data Fetching

**Files:**
- Modify: `src/app/layout-shell.tsx`
- Modify: `src/app/page.tsx` (will become a thin wrapper)

- [ ] **Step 1: Add consolidated data fetch to layout-shell**

The layout-shell keeps its existing structure — `children` still render. We only add the consolidated data fetch effect. Do NOT replace children with ActiveFloor — old routes must continue working during migration.

```typescript
// src/app/layout-shell.tsx
"use client"
import { useEffect } from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { TopBar } from "@/components/layout/top-bar"
import { InspectorPanel } from "@/components/layout/inspector-panel"
import { WorkspaceGate } from "@/components/composites/workspace-gate"
import { useSSE } from "@/lib/useSSE"
import { useUIStore } from "@/lib/ui-store"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { useDashboardStore } from "@/lib/store"
import { api } from "@/lib/api"

export function LayoutShell({ children }: { children: React.ReactNode }) {
  useSSE()
  const theme = useUIStore((s) => s.theme)
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)
  const fetchMetrics = useDashboardStore((s) => s.fetchMetrics)
  const fetchAlerts = useDashboardStore((s) => s.fetchAlerts)
  const wsRun = useWorkspaceStore((s) => s.run)

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light")
    document.documentElement.classList.add(theme)
    localStorage.setItem("devfleet-theme", theme)
  }, [theme])

  useEffect(() => {
    const saved = localStorage.getItem("devfleet-theme") as "dark" | "light" | null
    if (saved) useUIStore.getState().setTheme(saved)
  }, [])

  useEffect(() => {
    api.workspaceStatus()
      .then(useWorkspaceStore.getState().setStatus)
      .catch(() => useWorkspaceStore.getState().clear())
  }, [])

  // Consolidated data fetch when workspace is active
  useEffect(() => {
    if (wsRun?.status === "active") {
      fetchLiveFloor()
      fetchPipeline()
      fetchMetrics()
      fetchAlerts()
    }
  }, [wsRun?.status, fetchLiveFloor, fetchPipeline, fetchMetrics, fetchAlerts])

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto p-6">
            <WorkspaceGate>
              {() => children}
            </WorkspaceGate>
          </main>
          <InspectorPanel />
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Update root page to render ActiveFloor**

The root page (`src/app/page.tsx`) renders `ActiveFloor` as its content. This is the only page that changes — old pages at `/goals`, `/tasks`, `/financials`, etc. continue to render their own content through `children`. They still work during migration and will be removed in Phase 6.

```typescript
// src/app/page.tsx
"use client"
import { ActiveFloor } from "@/components/composites/active-floor"

export default function RootPage() {
  return <ActiveFloor />
}
```

**Note:** The root route `/` now shows the Stream view. Navigating to `/goals` or `/financials` shows the old page content. The sidebar goal clicks set `focusedGoalId` which ActiveFloor reads — this works because ActiveFloor is rendered at `/` and the sidebar doesn't trigger route navigation.

- [ ] **Step 3: Run all tests and verify build**

Run: `cd dashboard && npx vitest run && npx next build`
Expected: All tests pass, build succeeds

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/app/layout-shell.tsx dashboard/src/app/page.tsx
git commit -m "feat(floor): wire ActiveFloor into layout, consolidate data fetching on mount"
```

---

## Task 9: Fix Sidebar `tasksDone` Computation

**Files:**
- Modify: `src/components/layout/app-sidebar.tsx`

- [ ] **Step 1: Update app-sidebar.tsx with real task progress**

Three changes to `src/components/layout/app-sidebar.tsx`:

**Change 1:** Add imports at the top of the file (after the existing imports):
```typescript
import { getGoalTasks, computeTaskProgress } from "@/lib/hooks/use-goal-tasks"
import type { TaskDTO } from "@/lib/types"
```

**Change 2:** In the `AppSidebar` function, add `activeTasks` read and pass to `SidebarGoalList`. Find this line:
```typescript
const focusGoal = useFloorStore((s) => s.focusGoal)
```
Add below it:
```typescript
const activeTasks = useDashboardStore((s) => s.activeTasks)
```
Then find the `<SidebarGoalList` call and replace it:
```typescript
// OLD:
<SidebarGoalList goals={sortedGoals} focusedGoalId={focusedGoalId} onGoalClick={focusGoal} />
// NEW:
<SidebarGoalList goals={sortedGoals} focusedGoalId={focusedGoalId} onGoalClick={focusGoal} activeTasks={activeTasks} />
```

**Change 3:** Replace the entire `SidebarGoalList` and `SidebarGoalItem` functions (find them at the bottom of the file) with:

```typescript
function SidebarGoalList({ goals, focusedGoalId, onGoalClick, activeTasks }: {
  goals: readonly GoalDTO[]
  focusedGoalId: string | null
  onGoalClick: (id: string) => void
  activeTasks: readonly TaskDTO[]
}) {
  return (
    <div className="flex-1 overflow-y-auto px-2">
      {goals.map((goal) => (
        <SidebarGoalItem
          key={goal.id}
          goal={goal}
          isActive={goal.id === focusedGoalId}
          onClick={() => onGoalClick(goal.id)}
          activeTasks={activeTasks}
        />
      ))}
    </div>
  )
}

function SidebarGoalItem({ goal, isActive, onClick, activeTasks }: {
  goal: GoalDTO
  isActive: boolean
  onClick: () => void
  activeTasks: readonly TaskDTO[]
}) {
  const color = getStatusColor(goal.status)
  const isCompleted = goal.status === "completed" || goal.status === "merged"
  const needsAttention = goal.status === "blocked" || goal.status === "failed"
  const isReview = goal.status === "review" || goal.status === "pending_review"
  const tasks = getGoalTasks(activeTasks, goal.id)
  const { done, total } = computeTaskProgress(tasks, goal.taskCount)

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-2 w-full px-2.5 py-2 rounded-lg text-left transition-colors mb-px",
        isActive ? "bg-status-purple-surface" : "hover:bg-bg-hover",
        isCompleted && "opacity-50",
      )}
    >
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: `var(--status-${color}-fg)` }}
      />
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-[13px] truncate",
          isActive ? "font-semibold text-status-purple-fg" : "font-medium text-text-primary",
        )}>
          {goal.description}
        </p>
        <div className="flex items-center gap-1.5 mt-0.5">
          <div className="w-10 h-[3px] rounded-full bg-border overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: total > 0 ? `${(done / total) * 100}%` : "0%",
                backgroundColor: `var(--status-${color}-fg)`,
              }}
            />
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            {done}/{total}
          </span>
        </div>
      </div>
      {needsAttention && (
        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-status-yellow-surface text-status-yellow-fg shrink-0">!</span>
      )}
      {isReview && (
        <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-status-purple-surface text-status-purple-fg shrink-0">R</span>
      )}
    </button>
  )
}
```

- [ ] **Step 2: Run tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/layout/app-sidebar.tsx
git commit -m "feat(floor): fix sidebar tasksDone — compute real progress from activeTasks"
```

---

## Task 10: Full Verification

- [ ] **Step 1: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run the build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Verify visual match**

Open `http://localhost:3000` and verify:
- Active Floor shows Stream view with goal rows (or empty state if no goals)
- Clicking a goal in the sidebar switches to Goal Focus View with stat cards + phase lanes
- Back button returns to Stream view
- View mode toggle visible (Stream active, Kanban/Table show placeholders)
- Task cards in phase lanes are clickable (opens inspector shell)
- Sidebar recents show real task progress (not `0/N`)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(floor): Phase 2 complete — Stream view, Goal Focus, phase lanes"
```
