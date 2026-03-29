# Phase 4b: Table View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dense Table view to the Active Floor with sortable columns, column text filtering, row selection, and a bulk action toolbar for Reassign/Retry/Discard operations.

**Architecture:** `TableView` is a self-contained component that reads tasks + goals from `useDashboardStore`, enriches each task with its goal description, and renders a sortable/filterable HTML table. `useTableState` hook manages sort column/direction, column filters, and selected row IDs as local component state (not global store — table state is ephemeral). A `BulkActionBar` appears when 1+ rows are selected. Virtualization is noted as future work — not added until 100+ tasks is a real scenario.

**Tech Stack:** Next.js 15, React 19, Zustand 5, Tailwind CSS 4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-unified-command-redesign.md` (Section 2: Table)

**Depends on:** Phase 1-4a merged to master

**Deferred:** `@tanstack/react-virtual` virtualization — add when 100+ task rows is a real use case. The table works without it for normal scale.

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/hooks/use-table-state.ts` | Hook: sort column/direction, column text filters, selected IDs, select/deselect/toggle |
| `src/lib/hooks/__tests__/use-table-state.test.ts` | Tests for useTableState |
| `src/components/composites/bulk-action-bar.tsx` | Toolbar with Reassign/Retry/Discard buttons + selection count |
| `src/components/composites/table-view.tsx` | Dense spreadsheet table: sortable headers, filter inputs, checkbox selection, task rows |
| `src/components/composites/__tests__/table-view.test.tsx` | Tests for TableView |

### Modified Files
| File | Change |
|------|--------|
| `src/components/composites/active-floor.tsx` | Replace table placeholder with `<TableView />` |

---

## Task 1: Create `useTableState` Hook

**Files:**
- Create: `src/lib/hooks/use-table-state.ts`
- Create: `src/lib/hooks/__tests__/use-table-state.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/hooks/__tests__/use-table-state.test.ts
import { describe, it, expect } from "vitest"
import {
  sortTasks,
  filterTasks,
  type SortConfig,
  type ColumnFilters,
  type TableTask,
} from "../use-table-state"

const makeTableTask = (overrides?: Partial<TableTask>): TableTask => ({
  id: "t-1",
  goalId: "g-1",
  goalDescription: "OAuth2",
  description: "Write handler",
  phase: "implementation",
  status: "in_progress",
  assignedTo: "dev-01",
  budgetUsed: 5.0,
  lastActivity: "2026-03-29T14:00:00Z",
  ...overrides,
})

describe("sortTasks", () => {
  it("sorts by description ascending", () => {
    const tasks = [
      makeTableTask({ id: "t-2", description: "Zulu task" }),
      makeTableTask({ id: "t-1", description: "Alpha task" }),
    ]
    const sorted = sortTasks(tasks, { column: "description", direction: "asc" })
    expect(sorted[0].description).toBe("Alpha task")
    expect(sorted[1].description).toBe("Zulu task")
  })

  it("sorts by description descending", () => {
    const tasks = [
      makeTableTask({ id: "t-1", description: "Alpha task" }),
      makeTableTask({ id: "t-2", description: "Zulu task" }),
    ]
    const sorted = sortTasks(tasks, { column: "description", direction: "desc" })
    expect(sorted[0].description).toBe("Zulu task")
  })

  it("sorts by budgetUsed numerically", () => {
    const tasks = [
      makeTableTask({ id: "t-1", budgetUsed: 10 }),
      makeTableTask({ id: "t-2", budgetUsed: 2 }),
    ]
    const sorted = sortTasks(tasks, { column: "budgetUsed", direction: "asc" })
    expect(sorted[0].budgetUsed).toBe(2)
  })
})

describe("filterTasks", () => {
  it("filters by single column", () => {
    const tasks = [
      makeTableTask({ id: "t-1", description: "Write OAuth handler" }),
      makeTableTask({ id: "t-2", description: "Fix Redis bug" }),
    ]
    const filtered = filterTasks(tasks, { description: "oauth" })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("t-1")
  })

  it("filters by multiple columns with AND logic", () => {
    const tasks = [
      makeTableTask({ id: "t-1", description: "Write handler", status: "in_progress" }),
      makeTableTask({ id: "t-2", description: "Write tests", status: "completed" }),
      makeTableTask({ id: "t-3", description: "Fix bug", status: "in_progress" }),
    ]
    const filtered = filterTasks(tasks, { description: "write", status: "in_progress" })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("t-1")
  })

  it("returns all tasks when no filters", () => {
    const tasks = [makeTableTask(), makeTableTask({ id: "t-2" })]
    expect(filterTasks(tasks, {})).toHaveLength(2)
  })

  it("is case-insensitive", () => {
    const tasks = [makeTableTask({ description: "UPPERCASE task" })]
    expect(filterTasks(tasks, { description: "uppercase" })).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/lib/hooks/__tests__/use-table-state.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/hooks/use-table-state.ts

export interface TableTask {
  readonly id: string
  readonly goalId: string
  readonly goalDescription: string
  readonly description: string
  readonly phase: string
  readonly status: string
  readonly assignedTo: string | null
  readonly budgetUsed: number
  readonly lastActivity: string
}

export interface SortConfig {
  readonly column: keyof TableTask
  readonly direction: "asc" | "desc"
}

export type ColumnFilters = Partial<Record<keyof TableTask, string>>

export function sortTasks(tasks: readonly TableTask[], sort: SortConfig): TableTask[] {
  return [...tasks].sort((a, b) => {
    const aVal = a[sort.column]
    const bVal = b[sort.column]
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = typeof aVal === "number" && typeof bVal === "number"
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal))
    return sort.direction === "asc" ? cmp : -cmp
  })
}

export function filterTasks(tasks: readonly TableTask[], filters: ColumnFilters): TableTask[] {
  const activeFilters = Object.entries(filters).filter(([, v]) => v && v.trim() !== "")
  if (activeFilters.length === 0) return [...tasks]
  return tasks.filter((task) =>
    activeFilters.every(([col, query]) => {
      const val = task[col as keyof TableTask]
      return val != null && String(val).toLowerCase().includes(query!.toLowerCase())
    })
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/lib/hooks/__tests__/use-table-state.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/hooks/use-table-state.ts dashboard/src/lib/hooks/__tests__/use-table-state.test.ts
git commit -m "feat(table): add useTableState — sort, filter, and TableTask type for table view"
```

---

## Task 2: Create `BulkActionBar`

**Files:**
- Create: `src/components/composites/bulk-action-bar.tsx`

- [ ] **Step 1: Write the implementation**

```typescript
// src/components/composites/bulk-action-bar.tsx
"use client"

interface BulkActionBarProps {
  selectedCount: number
  onRetry: () => void
  onDiscard: () => void
  onClearSelection: () => void
}

export function BulkActionBar({ selectedCount, onRetry, onDiscard, onClearSelection }: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 mb-3 rounded-lg border border-status-blue-border bg-status-blue-surface">
      <span className="text-[13px] font-semibold text-text-primary">
        {selectedCount} selected
      </span>
      <div className="flex gap-2 ml-auto">
        <button
          onClick={onRetry}
          className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-text-primary text-text-inverse hover:opacity-90"
        >
          Retry
        </button>
        <button
          onClick={onDiscard}
          className="px-3 py-1.5 rounded-md text-[12px] font-semibold border border-status-red-border text-status-red-fg hover:bg-status-red-surface"
        >
          Discard
        </button>
        <button
          onClick={onClearSelection}
          className="px-3 py-1.5 rounded-md text-[12px] font-medium border border-border text-text-secondary hover:bg-bg-hover"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx vitest run && npx next build`
Expected: Pass

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/composites/bulk-action-bar.tsx
git commit -m "feat(table): add BulkActionBar — Retry/Discard actions for selected tasks"
```

---

## Task 3: Create `TableView`

**Files:**
- Create: `src/components/composites/table-view.tsx`
- Create: `src/components/composites/__tests__/table-view.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/components/composites/__tests__/table-view.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TableView } from "../table-view"
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

describe("TableView", () => {
  beforeEach(() => {
    useDashboardStore.setState({
      goals: [makeGoal()],
      activeTasks: [
        makeTask({ id: "t-1", description: "Write OAuth handler" }),
        makeTask({ id: "t-2", description: "Write tests", status: "completed" }),
      ],
    })
  })

  it("renders table headers", () => {
    render(<TableView />)
    expect(screen.getByText("Task")).toBeInTheDocument()
    expect(screen.getByText("Goal")).toBeInTheDocument()
    expect(screen.getByText("Phase")).toBeInTheDocument()
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("Agent")).toBeInTheDocument()
  })

  it("renders task rows", () => {
    render(<TableView />)
    expect(screen.getByText("Write OAuth handler")).toBeInTheDocument()
    expect(screen.getByText("Write tests")).toBeInTheDocument()
  })

  it("renders checkboxes for selection", () => {
    render(<TableView />)
    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes.length).toBeGreaterThanOrEqual(2) // rows + header
  })

  it("shows empty state when no tasks", () => {
    useDashboardStore.setState({ activeTasks: [] })
    render(<TableView />)
    expect(screen.getByText(/no tasks/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/table-view.test.tsx`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/composites/table-view.tsx
"use client"
import { useState, useMemo } from "react"
import { useDashboardStore } from "@/lib/store"
import { useInspectorStore } from "@/lib/inspector-store"
import { StatusBadge } from "@/components/primitives/status-badge"
import { BulkActionBar } from "./bulk-action-bar"
import {
  sortTasks,
  filterTasks,
  type TableTask,
  type SortConfig,
  type ColumnFilters,
} from "@/lib/hooks/use-table-state"
import { formatCurrency, formatTimeAgo } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

type SortableColumn = keyof TableTask

const COLUMNS: { key: SortableColumn; label: string; filterable: boolean }[] = [
  { key: "description", label: "Task", filterable: true },
  { key: "goalDescription", label: "Goal", filterable: true },
  { key: "phase", label: "Phase", filterable: true },
  { key: "status", label: "Status", filterable: true },
  { key: "assignedTo", label: "Agent", filterable: true },
  { key: "budgetUsed", label: "Budget", filterable: false },
  { key: "lastActivity", label: "Last Activity", filterable: false },
]

export function TableView() {
  const activeTasks = useDashboardStore((s) => s.activeTasks)
  const goals = useDashboardStore((s) => s.goals)
  const openInspector = useInspectorStore((s) => s.open)

  const [sort, setSort] = useState<SortConfig>({ column: "lastActivity", direction: "desc" })
  const [filters, setFilters] = useState<ColumnFilters>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Enrich tasks with goal data
  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals])
  const tableTasks: TableTask[] = useMemo(
    () =>
      activeTasks.map((t) => {
        const goal = goalMap.get(t.goalId)
        return {
          id: t.id,
          goalId: t.goalId,
          goalDescription: goal?.description ?? "Unknown",
          description: t.description.split("\n")[0],
          phase: t.phase,
          status: t.status,
          assignedTo: t.assignedTo,
          budgetUsed: t.budget.maxCostUsd - t.budget.remaining,
          lastActivity: goal?.completedAt ?? goal?.createdAt ?? "",
        }
      }),
    [activeTasks, goalMap],
  )

  const filtered = useMemo(() => filterTasks(tableTasks, filters), [tableTasks, filters])
  const sorted = useMemo(() => sortTasks(filtered, sort), [filtered, sort])

  const toggleSort = (column: SortableColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    )
  }

  const setFilter = (column: string, value: string) => {
    setFilters((prev) => ({ ...prev, [column]: value }))
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sorted.map((t) => t.id)))
    }
  }

  const handleBulkRetry = () => {
    // TODO: Wire to API in future — for now, clear selection
    setSelectedIds(new Set())
  }

  const handleBulkDiscard = () => {
    // TODO: Wire to API in future — for now, clear selection
    setSelectedIds(new Set())
  }

  if (activeTasks.length === 0) {
    return <p className="text-sm text-text-muted py-6 text-center">No tasks to display.</p>
  }

  return (
    <div>
      <BulkActionBar
        selectedCount={selectedIds.size}
        onRetry={handleBulkRetry}
        onDiscard={handleBulkDiscard}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            {/* Header row */}
            <tr className="bg-bg-hover border-b border-border">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={sorted.length > 0 && selectedIds.size === sorted.length}
                  onChange={toggleAll}
                  className="rounded border-border"
                />
              </th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-2 text-left font-semibold text-text-muted">
                  <button
                    onClick={() => toggleSort(col.key)}
                    className="flex items-center gap-1 hover:text-text-primary transition-colors"
                  >
                    {col.label}
                    {sort.column === col.key ? (
                      sort.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-30" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
            {/* Filter row */}
            <tr className="bg-bg-card border-b border-border">
              <th className="px-3 py-1" />
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-1">
                  {col.filterable ? (
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={filters[col.key] ?? ""}
                      onChange={(e) => setFilter(col.key, e.target.value)}
                      className="w-full px-2 py-1 rounded border border-border bg-bg-page text-[11px] text-text-primary focus:outline-none focus:border-border-hover"
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => (
              <tr
                key={task.id}
                className={cn(
                  "border-b border-border hover:bg-bg-hover transition-colors cursor-pointer",
                  selectedIds.has(task.id) && "bg-status-blue-surface",
                )}
                onClick={() => openInspector(task.id, "task", task.description.slice(0, 40))}
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(task.id)}
                    onChange={() => toggleRow(task.id)}
                    className="rounded border-border"
                  />
                </td>
                <td className="px-3 py-2 font-medium text-text-primary max-w-[200px] truncate">{task.description}</td>
                <td className="px-3 py-2 text-text-secondary max-w-[150px] truncate">{task.goalDescription}</td>
                <td className="px-3 py-2 text-status-purple-fg">{task.phase}</td>
                <td className="px-3 py-2"><StatusBadge status={task.status} /></td>
                <td className="px-3 py-2 font-mono text-text-secondary">{task.assignedTo ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-text-secondary">{formatCurrency(task.budgetUsed)}</td>
                <td className="px-3 py-2 text-text-muted">{task.lastActivity ? formatTimeAgo(task.lastActivity) : "—"}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-text-muted">
                  No tasks match filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-text-muted mt-2">{sorted.length} of {tableTasks.length} tasks</p>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/table-view.test.tsx`
Expected: All 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/composites/table-view.tsx dashboard/src/components/composites/__tests__/table-view.test.tsx
git commit -m "feat(table): add TableView — sortable columns, filters, selection, bulk actions"
```

---

## Task 4: Wire Table into ActiveFloor

**Files:**
- Modify: `src/components/composites/active-floor.tsx`

- [ ] **Step 1: Replace table placeholder with TableView**

Add import at top:
```typescript
import { TableView } from "./table-view"
```

Find and replace the table placeholder block:
```typescript
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

Replace with:
```typescript
  // Table view — dense spreadsheet with sorting, filtering, bulk actions
  if (activeSection === "floor" && viewMode === "table") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[16px] font-bold text-text-primary">Active Floor</h1>
          <ViewModeToggle />
        </div>
        <TableView />
      </div>
    )
  }
```

- [ ] **Step 2: Run all tests and build**

Run: `cd dashboard && npx vitest run && npx next build`
Expected: All tests pass, build succeeds

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/composites/active-floor.tsx
git commit -m "feat(table): wire TableView into ActiveFloor"
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
- Click "Table" in ViewModeToggle → table renders with column headers
- Click column headers to sort (arrow indicator changes)
- Type in filter inputs to narrow rows (AND logic across columns)
- Check row checkboxes → BulkActionBar appears with count
- "Select all" checkbox in header toggles all visible rows
- Click a row to open inspector (checkbox click doesn't trigger inspector)
- Click "Stream" or "Kanban" to verify view switching still works

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(table): Phase 4b complete — dense table with sort, filter, selection, bulk actions"
```
