# Phase 4a: Kanban View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a flat Kanban view to the Active Floor with four phase columns (Planning, Implementation, Review, Done) and goal filter chips, replacing the Pipeline page.

**Architecture:** `KanbanView` reads all tasks from `useDashboardStore`, groups them by display phase using `getTaskDisplayPhase` from `use-goal-tasks`, and renders them in four `KanbanColumn` components. A `FilterBar` at the top shows goal chips — clicking a chip filters to that goal's tasks. Each task card shows a colored goal tag for context. `ActiveFloor` gains a kanban branch that renders `KanbanView` when `viewMode === "kanban"`.

**Tech Stack:** Next.js 15, React 19, Zustand 5, Tailwind CSS 4, Lucide React, Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-unified-command-redesign.md` (Section 2: Kanban)

**Depends on:** Phase 1-3 merged to master

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/composites/filter-bar.tsx` | Goal filter chips for kanban view |
| `src/components/composites/__tests__/filter-bar.test.tsx` | Tests for FilterBar |
| `src/components/composites/kanban-view.tsx` | Kanban layout: FilterBar + four KanbanColumns with task cards |
| `src/components/composites/__tests__/kanban-view.test.tsx` | Tests for KanbanView |

### Modified Files
| File | Change |
|------|--------|
| `src/components/composites/phase-lanes.tsx` | Export `PHASES` and `PHASE_CONFIG` (add `export` keyword) |
| `src/components/composites/kanban-column.tsx` | Extend: accept `onTaskClick` prop, use `compact` TaskCard with `goalTag` |
| `src/components/composites/active-floor.tsx` | Replace kanban placeholder with `<KanbanView />` |

---

## Task 1: Create `FilterBar`

**Files:**
- Create: `src/components/composites/filter-bar.tsx`
- Create: `src/components/composites/__tests__/filter-bar.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/composites/__tests__/filter-bar.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { FilterBar } from "../filter-bar"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import type { GoalDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 100000, maxCostUsd: 10, remaining: 5 })
const makeGoal = (overrides?: Partial<GoalDTO>): GoalDTO => ({
  id: "g-1", description: "Add OAuth2", status: "active",
  createdAt: "2026-03-29T10:00:00Z", completedAt: null,
  taskCount: 4, totalBudget: makeBudget(), ...overrides,
})

describe("FilterBar", () => {
  beforeEach(() => {
    useFloorStore.setState({ kanbanGoalFilter: null })
    useDashboardStore.setState({ goals: [
      makeGoal({ id: "g-1", description: "OAuth2" }),
      makeGoal({ id: "g-2", description: "Redis sessions" }),
    ]})
  })

  it("renders All Goals chip", () => {
    render(<FilterBar />)
    expect(screen.getByText("All Goals")).toBeInTheDocument()
  })

  it("renders a chip per goal", () => {
    render(<FilterBar />)
    expect(screen.getByText(/OAuth2/)).toBeInTheDocument()
    expect(screen.getByText(/Redis/)).toBeInTheDocument()
  })

  it("highlights All Goals when no filter active", () => {
    render(<FilterBar />)
    const allBtn = screen.getByText("All Goals")
    expect(allBtn.className).toContain("bg-text-primary")
  })

  it("renders nothing when no goals", () => {
    useDashboardStore.setState({ goals: [] })
    const { container } = render(<FilterBar />)
    expect(container.querySelector("[data-testid='filter-bar']")).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/filter-bar.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/composites/filter-bar.tsx
"use client"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { getStatusColor } from "@/lib/registry/statuses"

export function FilterBar() {
  const goals = useDashboardStore((s) => s.goals)
  const kanbanGoalFilter = useFloorStore((s) => s.kanbanGoalFilter)
  const setKanbanGoalFilter = useFloorStore((s) => s.setKanbanGoalFilter)

  if (goals.length === 0) return null

  return (
    <div data-testid="filter-bar" className="flex items-center gap-2 mb-4 p-3 bg-bg-card border border-border rounded-lg overflow-x-auto">
      <span className="text-[12px] text-text-muted font-medium shrink-0">Filter by goal:</span>
      <button
        onClick={() => setKanbanGoalFilter(null)}
        className={cn(
          "px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors shrink-0",
          kanbanGoalFilter === null
            ? "bg-text-primary text-text-inverse border-text-primary"
            : "bg-bg-card text-text-secondary border-border hover:bg-bg-hover",
        )}
      >
        All Goals
      </button>
      {goals.map((goal) => {
        const isActive = kanbanGoalFilter === goal.id
        const color = getStatusColor(goal.status)
        return (
          <button
            key={goal.id}
            onClick={() => setKanbanGoalFilter(isActive ? null : goal.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors shrink-0",
              isActive
                ? "bg-text-primary text-text-inverse border-text-primary"
                : "bg-bg-card text-text-secondary border-border hover:bg-bg-hover",
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `var(--status-${color}-fg)` }} />
            #{goal.id.slice(0, 4)} {goal.description.slice(0, 20)}{goal.description.length > 20 ? "..." : ""}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/filter-bar.test.tsx`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/composites/filter-bar.tsx dashboard/src/components/composites/__tests__/filter-bar.test.tsx
git commit -m "feat(kanban): add FilterBar — goal filter chips for kanban view"
```

---

## Task 2: Extend `KanbanColumn`

**Files:**
- Modify: `src/components/composites/kanban-column.tsx`

- [ ] **Step 1: Update KanbanColumn to use compact TaskCard with goalTag and onClick**

Replace the entire content of `src/components/composites/kanban-column.tsx`:

```typescript
// src/components/composites/kanban-column.tsx
import type { TaskDTO, GoalDTO } from "@/lib/types"
import { TaskCard } from "./task-card"
import { getStatusColor } from "@/lib/registry/statuses"

interface KanbanColumnProps {
  phase: string
  tasks: readonly TaskDTO[]
  goals: readonly GoalDTO[]
  dotColor: string
  onTaskClick?: (task: TaskDTO) => void
}

export function KanbanColumn({ phase, tasks, goals, dotColor, onTaskClick }: KanbanColumnProps) {
  const goalMap = new Map(goals.map((g) => [g.id, g]))

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between px-2.5 py-2 bg-bg-card border border-border rounded-t-lg">
        <div className="flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: dotColor }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{phase}</span>
        </div>
        <span className="text-[10px] text-text-muted bg-bg-hover px-1.5 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <div className="bg-bg-page border border-border border-t-0 rounded-b-lg p-2 min-h-[120px]">
        {tasks.length === 0 && (
          <p className="text-[11px] text-text-muted text-center py-6">No tasks</p>
        )}
        {tasks.map((task) => {
          const goal = goalMap.get(task.goalId)
          const color = goal ? getStatusColor(goal.status) : "zinc"
          const goalTag = goal ? {
            label: `#${goal.id.slice(0, 4)}`,
            color: `var(--status-${color}-fg)`,
          } : undefined
          return (
            <TaskCard
              key={task.id}
              task={task}
              compact
              goalTag={goalTag}
              onClick={onTaskClick ? () => onTaskClick(task) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx vitest run && npx next build`
Expected: All tests pass, build succeeds

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/composites/kanban-column.tsx
git commit -m "feat(kanban): extend KanbanColumn — compact cards with goalTag and onClick"
```

---

## Task 3: Create `KanbanView`

**Files:**
- Create: `src/components/composites/kanban-view.tsx`
- Create: `src/components/composites/__tests__/kanban-view.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/composites/__tests__/kanban-view.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { KanbanView } from "../kanban-view"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import type { TaskDTO, GoalDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 10000, maxCostUsd: 1, remaining: 0.5 })
const makeGoal = (overrides?: Partial<GoalDTO>): GoalDTO => ({
  id: "g-1", description: "OAuth2", status: "active",
  createdAt: "2026-03-29T10:00:00Z", completedAt: null,
  taskCount: 2, totalBudget: makeBudget(), ...overrides,
})
const makeTask = (overrides?: Partial<TaskDTO>): TaskDTO => ({
  id: "t-1", goalId: "g-1", description: "Write handler", status: "in_progress",
  phase: "implementation", assignedTo: "dev-01", tokensUsed: 500,
  budget: makeBudget(), retryCount: 0, branch: null, ...overrides,
})

describe("KanbanView", () => {
  beforeEach(() => {
    useFloorStore.setState({ kanbanGoalFilter: null })
    useDashboardStore.setState({
      goals: [makeGoal()],
      activeTasks: [
        makeTask({ id: "t-1", status: "in_progress", phase: "implementation" }),
        makeTask({ id: "t-2", status: "completed", phase: "implementation" }),
      ],
    })
  })

  it("renders four phase columns", () => {
    render(<KanbanView />)
    expect(screen.getByText("Planning")).toBeInTheDocument()
    expect(screen.getByText("Implementation")).toBeInTheDocument()
    expect(screen.getByText("Review")).toBeInTheDocument()
    expect(screen.getByText("Done")).toBeInTheDocument()
  })

  it("renders filter bar", () => {
    render(<KanbanView />)
    expect(screen.getByText("All Goals")).toBeInTheDocument()
  })

  it("renders task descriptions", () => {
    render(<KanbanView />)
    expect(screen.getAllByText(/Write handler/).length).toBeGreaterThan(0)
  })

  it("filters tasks when goal filter is set", () => {
    useDashboardStore.setState({
      goals: [
        makeGoal({ id: "g-1", description: "OAuth2" }),
        makeGoal({ id: "g-2", description: "Redis" }),
      ],
      activeTasks: [
        makeTask({ id: "t-1", goalId: "g-1", description: "OAuth task" }),
        makeTask({ id: "t-2", goalId: "g-2", description: "Redis task" }),
      ],
    })
    useFloorStore.setState({ kanbanGoalFilter: "g-1" })
    render(<KanbanView />)
    expect(screen.getByText(/OAuth task/)).toBeInTheDocument()
    expect(screen.queryByText(/Redis task/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/kanban-view.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

**Note to implementer:** Before writing KanbanView, export `PHASES` and `PHASE_CONFIG` from `src/components/composites/phase-lanes.tsx`. Change these two lines from `const` to `export const`:
```typescript
export const PHASES = ["planning", "implementation", "review", "done"] as const
export const PHASE_CONFIG: Record<string, { label: string; dotColor: string }> = { ... }
```
This avoids duplicating the phase definitions. KanbanView imports them.

```typescript
// src/components/composites/kanban-view.tsx
"use client"
import { useDashboardStore } from "@/lib/store"
import { useFloorStore } from "@/lib/floor-store"
import { useInspectorStore } from "@/lib/inspector-store"
import { KanbanColumn } from "./kanban-column"
import { FilterBar } from "./filter-bar"
import { PHASES, PHASE_CONFIG } from "./phase-lanes"
import { getTaskDisplayPhase } from "@/lib/hooks/use-goal-tasks"

export function KanbanView() {
  const activeTasks = useDashboardStore((s) => s.activeTasks)
  const goals = useDashboardStore((s) => s.goals)
  const kanbanGoalFilter = useFloorStore((s) => s.kanbanGoalFilter)
  const openInspector = useInspectorStore((s) => s.open)

  const filteredTasks = kanbanGoalFilter
    ? activeTasks.filter((t) => t.goalId === kanbanGoalFilter)
    : activeTasks

  const tasksByPhase: Record<string, typeof filteredTasks[number][]> = Object.fromEntries(
    PHASES.map((p) => [p, []])
  )
  for (const task of filteredTasks) {
    const phase = getTaskDisplayPhase(task)
    if (tasksByPhase[phase]) tasksByPhase[phase].push(task)
    else tasksByPhase.implementation.push(task)
  }

  return (
    <div>
      <FilterBar />
      <div className="flex gap-3">
        {PHASES.map((phase) => {
          const config = PHASE_CONFIG[phase]
          return (
            <KanbanColumn
              key={phase}
              phase={config.label}
              tasks={tasksByPhase[phase]}
              goals={goals}
              dotColor={config.dotColor}
              onTaskClick={(task) => openInspector(task.id, "task", task.description.split("\n")[0].slice(0, 40))}
            />
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/kanban-view.test.tsx`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/composites/kanban-view.tsx dashboard/src/components/composites/__tests__/kanban-view.test.tsx
git commit -m "feat(kanban): add KanbanView — four phase columns with goal filter chips"
```

---

## Task 4: Wire Kanban into ActiveFloor

**Files:**
- Modify: `src/components/composites/active-floor.tsx`

- [ ] **Step 1: Replace kanban placeholder with KanbanView**

In `src/components/composites/active-floor.tsx`:

Add import at top:
```typescript
import { KanbanView } from "./kanban-view"
```

Find and replace the entire kanban/table placeholder block:
```typescript
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
```

Replace with:
```typescript
  // Kanban view — flat task board with goal filters
  if (activeSection === "floor" && viewMode === "kanban") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[16px] font-bold text-text-primary">Active Floor</h1>
          <ViewModeToggle />
        </div>
        <KanbanView />
      </div>
    )
  }

  // Table view — placeholder for Phase 4b
  if (activeSection === "floor" && viewMode === "table") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[16px] font-bold text-text-primary">Active Floor</h1>
          <ViewModeToggle />
        </div>
        <p className="text-sm text-text-muted">Table view will be implemented in Phase 4b.</p>
      </div>
    )
  }
```

- [ ] **Step 2: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/components/composites/active-floor.tsx
git commit -m "feat(kanban): wire KanbanView into ActiveFloor, separate table placeholder"
```

---

## Task 5: Full Verification

- [ ] **Step 1: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run the build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds

- [ ] **Step 3: Verify workflow**

Open `http://localhost:3000` and verify:
- Click "Kanban" in the ViewModeToggle → Kanban view renders with 4 phase columns
- FilterBar shows "All Goals" + one chip per goal
- Clicking a goal chip filters tasks to that goal only
- Clicking "All Goals" shows all tasks again
- Each task card shows a colored goal tag chip
- Clicking a task card opens the Inspector with TaskInspector
- Clicking "Stream" returns to stream view
- Clicking "Table" shows Phase 4b placeholder

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(kanban): Phase 4a complete — flat kanban with goal filter chips"
```
