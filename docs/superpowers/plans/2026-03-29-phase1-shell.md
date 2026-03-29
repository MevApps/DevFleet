# Phase 1: Three-Pane Shell Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current 11-page layout (Sidebar + TopBar + routed pages) with a three-pane Unified Command shell (AppSidebar + TopBar + Floor + InspectorPanel) that serves as the foundation for all subsequent phases.

**Architecture:** New root layout with collapsible sidebar (260px), simplified top bar (fleet chips, no search), fluid floor area, and a slide-in inspector panel (380px). Two new Zustand stores (`useFloorStore`, `useInspectorStore`) manage UI state. Existing data stores unchanged. Old pages continue to work during migration — this phase only replaces the shell, not the page content.

**Tech Stack:** Next.js 15 (App Router), React 19, Zustand 5, Tailwind CSS 4, Lucide React, Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-unified-command-redesign.md`

**Prototype:** `ux-goal-focus.html` (final visual reference)

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/lib/floor-store.ts` | Floor UI state: viewMode, focusedGoalId, kanbanGoalFilter, expandedGoalIds, activeSection |
| `src/lib/__tests__/floor-store.test.ts` | Tests for useFloorStore |
| `src/lib/inspector-store.ts` | Inspector UI state: selectedEntity, pinned, breadcrumbs |
| `src/lib/__tests__/inspector-store.test.ts` | Tests for useInspectorStore |
| `src/components/layout/app-sidebar.tsx` | Chat-app-style sidebar: logo, new goal, search, features, recents, user |
| `src/components/layout/__tests__/app-sidebar.test.tsx` | Tests for AppSidebar |
| `src/components/layout/inspector-panel.tsx` | Slide-in/pinnable inspector shell (delegates to type-specific inspectors in Phase 3) |
| `src/components/layout/__tests__/inspector-panel.test.tsx` | Tests for InspectorPanel |
| `src/components/composites/workspace-gate.tsx` | Full-floor workspace setup/boot gate composing existing form + progress |
| `src/components/composites/__tests__/workspace-gate.test.tsx` | Tests for WorkspaceGate |

### Modified Files
| File | Change |
|------|--------|
| `src/lib/theme/tokens.css` | Update `--sidebar-width` from 200px to 260px |
| `src/lib/ui-store.ts` | No changes needed — already has `sidebarCollapsed` and `toggleSidebar` |
| `src/components/layout/top-bar.tsx` | Replace search + title with fleet chips, expand sidebar button, alert bell, workspace badge |
| `src/app/layout-shell.tsx` | Replace Sidebar with AppSidebar, add InspectorPanel, wrap floor in container |
| `src/lib/theme/tokens.css` | Add `--inspector-width` token (same file as sidebar width update) |

### Unchanged Files (used as-is)
| File | Used By |
|------|---------|
| `src/lib/store.ts` | AppSidebar (goals for recents), TopBar (metrics for chips) |
| `src/lib/workspace-store.ts` | WorkspaceGate, AppSidebar (workspace status) |
| `src/lib/useSSE.ts` | LayoutShell (unchanged) |
| `src/components/composites/workspace-setup-form.tsx` | WorkspaceGate (composed) |
| `src/components/composites/workspace-boot-progress.tsx` | WorkspaceGate (composed) |

---

## Task 1: Create `useFloorStore`

**Files:**
- Create: `src/lib/floor-store.ts`
- Create: `src/lib/__tests__/floor-store.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/floor-store.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { useFloorStore } from "../floor-store"

describe("useFloorStore", () => {
  beforeEach(() => {
    useFloorStore.setState({
      viewMode: "stream",
      focusedGoalId: null,
      kanbanGoalFilter: null,
      expandedGoalIds: new Set(),
      activeSection: "floor",
    })
  })

  it("starts with default state", () => {
    const state = useFloorStore.getState()
    expect(state.viewMode).toBe("stream")
    expect(state.focusedGoalId).toBeNull()
    expect(state.kanbanGoalFilter).toBeNull()
    expect(state.expandedGoalIds.size).toBe(0)
    expect(state.activeSection).toBe("floor")
  })

  it("setViewMode changes view mode", () => {
    useFloorStore.getState().setViewMode("kanban")
    expect(useFloorStore.getState().viewMode).toBe("kanban")
  })

  it("focusGoal sets focusedGoalId and activeSection to floor", () => {
    useFloorStore.getState().setActiveSection("analytics")
    useFloorStore.getState().focusGoal("goal-1")
    const state = useFloorStore.getState()
    expect(state.focusedGoalId).toBe("goal-1")
    expect(state.activeSection).toBe("floor")
  })

  it("unfocusGoal clears focusedGoalId", () => {
    useFloorStore.getState().focusGoal("goal-1")
    useFloorStore.getState().unfocusGoal()
    expect(useFloorStore.getState().focusedGoalId).toBeNull()
  })

  it("toggleGoalExpanded adds and removes goal IDs", () => {
    useFloorStore.getState().toggleGoalExpanded("g-1")
    expect(useFloorStore.getState().expandedGoalIds.has("g-1")).toBe(true)
    useFloorStore.getState().toggleGoalExpanded("g-1")
    expect(useFloorStore.getState().expandedGoalIds.has("g-1")).toBe(false)
  })

  it("setActiveSection preserves viewMode", () => {
    useFloorStore.getState().setViewMode("kanban")
    useFloorStore.getState().setActiveSection("analytics")
    expect(useFloorStore.getState().viewMode).toBe("kanban")
    expect(useFloorStore.getState().activeSection).toBe("analytics")
  })

  it("setActiveSection clears focusedGoalId", () => {
    useFloorStore.getState().focusGoal("goal-1")
    useFloorStore.getState().setActiveSection("analytics")
    expect(useFloorStore.getState().focusedGoalId).toBeNull()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/lib/__tests__/floor-store.test.ts`
Expected: FAIL — module `../floor-store` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/floor-store.ts
import { create } from "zustand"

type ViewMode = "stream" | "kanban" | "table"
type ActiveSection = "floor" | "settings" | "analytics" | "health"

interface FloorState {
  viewMode: ViewMode
  focusedGoalId: string | null
  kanbanGoalFilter: string | null
  expandedGoalIds: Set<string>
  activeSection: ActiveSection
  setViewMode: (mode: ViewMode) => void
  focusGoal: (goalId: string) => void
  unfocusGoal: () => void
  setKanbanGoalFilter: (goalId: string | null) => void
  toggleGoalExpanded: (goalId: string) => void
  setActiveSection: (section: ActiveSection) => void
}

export const useFloorStore = create<FloorState>((set) => ({
  viewMode: "stream",
  focusedGoalId: null,
  kanbanGoalFilter: null,
  expandedGoalIds: new Set(),
  activeSection: "floor",
  setViewMode: (viewMode) => set({ viewMode }),
  focusGoal: (goalId) => set({ focusedGoalId: goalId, activeSection: "floor" }),
  unfocusGoal: () => set({ focusedGoalId: null }),
  setKanbanGoalFilter: (goalId) => set({ kanbanGoalFilter: goalId }),
  toggleGoalExpanded: (goalId) =>
    set((state) => {
      const next = new Set(state.expandedGoalIds)
      if (next.has(goalId)) next.delete(goalId)
      else next.add(goalId)
      return { expandedGoalIds: next }
    }),
  setActiveSection: (activeSection) => set({ activeSection, focusedGoalId: null }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/lib/__tests__/floor-store.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/floor-store.ts dashboard/src/lib/__tests__/floor-store.test.ts
git commit -m "feat(shell): add useFloorStore for Active Floor UI state"
```

---

## Task 2: Create `useInspectorStore`

**Files:**
- Create: `src/lib/inspector-store.ts`
- Create: `src/lib/__tests__/inspector-store.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// src/lib/__tests__/inspector-store.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { useInspectorStore } from "../inspector-store"

describe("useInspectorStore", () => {
  beforeEach(() => {
    useInspectorStore.setState({
      selectedEntityId: null,
      selectedEntityType: null,
      pinned: false,
      breadcrumbs: [],
    })
  })

  it("starts closed with no selection", () => {
    const state = useInspectorStore.getState()
    expect(state.selectedEntityId).toBeNull()
    expect(state.selectedEntityType).toBeNull()
    expect(state.pinned).toBe(false)
    expect(state.breadcrumbs).toEqual([])
  })

  it("open sets entity and pushes breadcrumb", () => {
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    const state = useInspectorStore.getState()
    expect(state.selectedEntityId).toBe("task-1")
    expect(state.selectedEntityType).toBe("task")
    expect(state.breadcrumbs).toEqual([
      { id: "task-1", type: "task", label: "Write handler" },
    ])
  })

  it("open appends to breadcrumbs when navigating deeper", () => {
    useInspectorStore.getState().open("goal-1", "goal", "OAuth2")
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    expect(useInspectorStore.getState().breadcrumbs).toHaveLength(2)
    expect(useInspectorStore.getState().breadcrumbs[0].id).toBe("goal-1")
    expect(useInspectorStore.getState().breadcrumbs[1].id).toBe("task-1")
  })

  it("close resets selection but preserves pinned state", () => {
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    useInspectorStore.getState().togglePin()
    useInspectorStore.getState().close()
    const state = useInspectorStore.getState()
    expect(state.selectedEntityId).toBeNull()
    expect(state.pinned).toBe(true)
    expect(state.breadcrumbs).toEqual([])
  })

  it("togglePin flips pinned state", () => {
    expect(useInspectorStore.getState().pinned).toBe(false)
    useInspectorStore.getState().togglePin()
    expect(useInspectorStore.getState().pinned).toBe(true)
    useInspectorStore.getState().togglePin()
    expect(useInspectorStore.getState().pinned).toBe(false)
  })

  it("navigateBreadcrumb truncates breadcrumbs and selects entity", () => {
    useInspectorStore.getState().open("goal-1", "goal", "OAuth2")
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    useInspectorStore.getState().open("agent-1", "agent", "dev-03")
    useInspectorStore.getState().navigateBreadcrumb(0)
    const state = useInspectorStore.getState()
    expect(state.selectedEntityId).toBe("goal-1")
    expect(state.selectedEntityType).toBe("goal")
    expect(state.breadcrumbs).toHaveLength(1)
  })

  it("selectedEntityId is null when closed, set when open", () => {
    expect(useInspectorStore.getState().selectedEntityId).toBeNull()
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    expect(useInspectorStore.getState().selectedEntityId).toBe("task-1")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/lib/__tests__/inspector-store.test.ts`
Expected: FAIL — module `../inspector-store` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/inspector-store.ts
import { create } from "zustand"

type EntityType = "goal" | "task" | "agent" | "event"

interface Breadcrumb {
  readonly id: string
  readonly type: EntityType
  readonly label: string
}

interface InspectorState {
  selectedEntityId: string | null
  selectedEntityType: EntityType | null
  pinned: boolean
  breadcrumbs: readonly Breadcrumb[]
  open: (id: string, type: EntityType, label: string) => void
  close: () => void
  togglePin: () => void
  navigateBreadcrumb: (index: number) => void
}

export const useInspectorStore = create<InspectorState>((set) => ({
  selectedEntityId: null,
  selectedEntityType: null,
  pinned: false,
  breadcrumbs: [],
  open: (id, type, label) =>
    set((state) => ({
      selectedEntityId: id,
      selectedEntityType: type,
      breadcrumbs: [...state.breadcrumbs, { id, type, label }],
    })),
  close: () =>
    set({
      selectedEntityId: null,
      selectedEntityType: null,
      breadcrumbs: [],
    }),
  togglePin: () => set((state) => ({ pinned: !state.pinned })),
  navigateBreadcrumb: (index) =>
    set((state) => {
      const crumb = state.breadcrumbs[index]
      if (!crumb) return state
      return {
        selectedEntityId: crumb.id,
        selectedEntityType: crumb.type as EntityType,
        breadcrumbs: state.breadcrumbs.slice(0, index + 1),
      }
    }),
}))
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/lib/__tests__/inspector-store.test.ts`
Expected: All 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/inspector-store.ts dashboard/src/lib/__tests__/inspector-store.test.ts
git commit -m "feat(shell): add useInspectorStore for Inspector panel UI state"
```

---

## Task 3: Update Design Tokens

**Files:**
- Modify: `src/lib/theme/tokens.css`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update sidebar width token**

In `src/lib/theme/tokens.css`, change `--sidebar-width` from `200px` to `260px`:

```css
--sidebar-width: 260px;
```

- [ ] **Step 2: Add inspector width token**

In `src/lib/theme/tokens.css`, add below `--topbar-height: 48px;`:

```css
--inspector-width: 380px;
```

- [ ] **Step 3: Verify build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds (no CSS errors)

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/theme/tokens.css
git commit -m "feat(shell): update design tokens for new sidebar and inspector widths"
```

---

## Task 4: Build `AppSidebar`

**Files:**
- Create: `src/components/layout/app-sidebar.tsx`
- Create: `src/components/layout/__tests__/app-sidebar.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/layout/__tests__/app-sidebar.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { AppSidebar } from "../app-sidebar"
import { useUIStore } from "@/lib/ui-store"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { useDashboardStore } from "@/lib/store"

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}))

describe("AppSidebar", () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarCollapsed: false })
    useWorkspaceStore.getState().clear()
  })

  it("renders the DevFleet logo", () => {
    render(<AppSidebar />)
    expect(screen.getByText("DevFleet")).toBeInTheDocument()
  })

  it("renders the New Goal button", () => {
    render(<AppSidebar />)
    expect(screen.getByRole("button", { name: /new goal/i })).toBeInTheDocument()
  })

  it("renders the search input", () => {
    render(<AppSidebar />)
    expect(screen.getByText(/search goals/i)).toBeInTheDocument()
  })

  it("renders feature links", () => {
    render(<AppSidebar />)
    expect(screen.getByText("Settings")).toBeInTheDocument()
    expect(screen.getByText("Analytics")).toBeInTheDocument()
    expect(screen.getByText("Health")).toBeInTheDocument()
  })

  it("renders Recents label", () => {
    render(<AppSidebar />)
    expect(screen.getByText("Recents")).toBeInTheDocument()
  })

  it("renders nothing visible when collapsed", () => {
    useUIStore.setState({ sidebarCollapsed: true })
    const { container } = render(<AppSidebar />)
    const sidebar = container.firstChild as HTMLElement
    expect(sidebar.style.width).toBe("0px")
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/layout/__tests__/app-sidebar.test.tsx`
Expected: FAIL — module `../app-sidebar` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/layout/app-sidebar.tsx
"use client"
import { useUIStore } from "@/lib/ui-store"
import { useFloorStore } from "@/lib/floor-store"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { useDashboardStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format"
import { getStatusColor } from "@/lib/registry/statuses"
import type { GoalDTO } from "@/lib/types"
import {
  ChevronsLeft,
  Plus,
  Search,
  Settings,
  Activity,
  HeartPulse,
} from "lucide-react"

export function AppSidebar() {
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const goals = useDashboardStore((s) => s.goals)
  const run = useWorkspaceStore((s) => s.run)
  const costUsd = useWorkspaceStore((s) => s.costUsd)
  const focusedGoalId = useFloorStore((s) => s.focusedGoalId)
  const focusGoal = useFloorStore((s) => s.focusGoal)
  const setActiveSection = useFloorStore((s) => s.setActiveSection)

  const workspaceBudget = run?.config.maxCostUsd ?? 100

  const sortedGoals = [...goals].sort((a, b) => {
    const aTime = a.completedAt ?? a.createdAt
    const bTime = b.completedAt ?? b.createdAt
    return new Date(bTime).getTime() - new Date(aTime).getTime()
  })

  return (
    <aside
      className="flex flex-col border-r border-border bg-bg-page transition-[width] duration-200 overflow-hidden shrink-0"
      style={{ width: collapsed ? 0 : "var(--sidebar-width)" }}
    >
      {/* Header: Logo + Collapse */}
      <div className="flex items-center justify-between px-3.5 pt-3.5 pb-2.5">
        <div className="flex items-center gap-2">
          <div className="h-[22px] w-[22px] rounded-md bg-text-primary flex items-center justify-center shrink-0">
            <span className="text-[10px] font-bold text-text-inverse">D</span>
          </div>
          <span className="text-[15px] font-bold text-text-primary whitespace-nowrap">DevFleet</span>
        </div>
        <button
          onClick={toggleSidebar}
          className="p-1 rounded-md text-text-muted hover:bg-bg-hover shrink-0"
          aria-label="Collapse sidebar"
        >
          <ChevronsLeft size={18} />
        </button>
      </div>

      {/* New Goal + Search */}
      <div className="px-2.5 flex flex-col gap-1.5">
        <button
          className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg border border-border bg-bg-card text-[13px] font-semibold text-text-primary hover:bg-bg-hover transition-colors"
          aria-label="New Goal"
        >
          <Plus size={18} className="text-text-muted" />
          New Goal
          <kbd className="ml-auto text-[10px] px-1 py-0.5 rounded border border-border text-text-muted">&#x2318;N</kbd>
        </button>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-bg-card text-[13px] text-text-muted cursor-pointer hover:border-border-hover transition-colors">
          <Search size={14} />
          <span>Search goals...</span>
        </div>
      </div>

      {/* Feature Links */}
      <div className="px-2 pt-2.5 flex flex-col gap-px">
        <SidebarAction icon={<Settings size={16} />} label="Settings" onClick={() => setActiveSection("settings")} />
        <SidebarAction icon={<Activity size={16} />} label="Analytics" onClick={() => setActiveSection("analytics")} />
        <SidebarAction icon={<HeartPulse size={16} />} label="Health" onClick={() => setActiveSection("health")} />
      </div>

      {/* Divider */}
      <div className="mx-3 my-2 h-px bg-border" />

      {/* Recents */}
      <div className="px-4 pb-1.5">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">Recents</span>
      </div>
      <SidebarGoalList goals={sortedGoals} focusedGoalId={focusedGoalId} onGoalClick={focusGoal} />

      {/* User Section */}
      <div className="border-t border-border px-2 py-2">
        <div className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-bg-hover cursor-pointer transition-colors">
          <div className="w-8 h-8 rounded-full bg-purple-400 flex items-center justify-center text-[13px] font-semibold text-white shrink-0">
            M
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-semibold text-text-primary">MevApps</p>
            <p className="text-[11px] text-text-muted">
              {formatCurrency(costUsd)} / {formatCurrency(workspaceBudget)}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}

function SidebarAction({ icon, label, badge, onClick }: {
  icon: React.ReactNode
  label: string
  badge?: string
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 w-full px-2.5 py-1.5 rounded-lg text-[13px] text-text-secondary hover:bg-bg-hover transition-colors"
    >
      <span className="text-text-muted flex items-center w-[18px] justify-center">{icon}</span>
      {label}
      {badge && (
        <span className="ml-auto text-[10px] font-bold font-mono px-1.5 py-0.5 rounded bg-status-purple-surface text-status-purple-fg">
          {badge}
        </span>
      )}
    </button>
  )
}

function SidebarGoalList({ goals, focusedGoalId, onGoalClick }: {
  goals: readonly GoalDTO[]
  focusedGoalId: string | null
  onGoalClick: (id: string) => void
}) {
  return (
    <div className="flex-1 overflow-y-auto px-2">
      {goals.map((goal) => (
        <SidebarGoalItem
          key={goal.id}
          goal={goal}
          isActive={goal.id === focusedGoalId}
          onClick={() => onGoalClick(goal.id)}
        />
      ))}
    </div>
  )
}

function SidebarGoalItem({ goal, isActive, onClick }: {
  goal: GoalDTO
  isActive: boolean
  onClick: () => void
}) {
  const color = getStatusColor(goal.status)
  const isCompleted = goal.status === "completed" || goal.status === "merged"
  const needsAttention = goal.status === "blocked" || goal.status === "failed"
  const isReview = goal.status === "review" || goal.status === "pending_review"
  const tasksDone = 0 // Phase 2 will compute this from tasks

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
                width: goal.taskCount > 0 ? `${(tasksDone / goal.taskCount) * 100}%` : "0%",
                backgroundColor: `var(--status-${color}-fg)`,
              }}
            />
          </div>
          <span className="text-[10px] font-mono text-text-muted">
            {tasksDone}/{goal.taskCount}
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

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/layout/__tests__/app-sidebar.test.tsx`
Expected: All 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/layout/app-sidebar.tsx dashboard/src/components/layout/__tests__/app-sidebar.test.tsx
git commit -m "feat(shell): add AppSidebar — chat-app style with recents, search, features"
```

---

## Task 5: Build New `TopBar`

**Files:**
- Modify: `src/components/layout/top-bar.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/layout/__tests__/top-bar.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TopBar } from "../top-bar"
import { useUIStore } from "@/lib/ui-store"
import { useDashboardStore } from "@/lib/store"
import { useWorkspaceStore } from "@/lib/workspace-store"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
}))

describe("TopBar", () => {
  beforeEach(() => {
    useUIStore.setState({ sidebarCollapsed: false })
  })

  it("renders fleet summary chips", () => {
    render(<TopBar />)
    expect(screen.getByText(/agents/i)).toBeInTheDocument()
    expect(screen.getByText(/spent/i)).toBeInTheDocument()
  })

  it("shows expand button when sidebar is collapsed", () => {
    useUIStore.setState({ sidebarCollapsed: true })
    render(<TopBar />)
    expect(screen.getByLabelText(/open sidebar/i)).toBeInTheDocument()
  })

  it("hides expand button when sidebar is open", () => {
    useUIStore.setState({ sidebarCollapsed: false })
    render(<TopBar />)
    expect(screen.queryByLabelText(/open sidebar/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/layout/__tests__/top-bar.test.tsx`
Expected: FAIL — current TopBar renders "Search..." not fleet chips

- [ ] **Step 3: Rewrite TopBar implementation**

```typescript
// src/components/layout/top-bar.tsx
"use client"
import { useUIStore } from "@/lib/ui-store"
import { useDashboardStore } from "@/lib/store"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { ChevronsRight, Bell, Sun, Moon } from "lucide-react"

export function TopBar() {
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)
  const agents = useDashboardStore((s) => s.agents)
  const metrics = useDashboardStore((s) => s.metrics)
  const unreadAlertCount = useDashboardStore((s) => s.unreadAlertCount)
  const run = useWorkspaceStore((s) => s.run)
  const costUsd = useWorkspaceStore((s) => s.costUsd)

  const busyAgents = agents.filter((a) => a.status === "busy").length
  const totalAgents = agents.length
  const attentionCount = useDashboardStore((s) =>
    s.goals.filter((g) => g.status === "blocked" || g.status === "failed").length
  )
  const wsActive = run?.status === "active"

  return (
    <header
      className="flex items-center justify-between px-5 border-b border-border bg-bg-card shrink-0"
      style={{ height: "var(--topbar-height)" }}
    >
      <div className="flex items-center gap-2">
        {sidebarCollapsed && (
          <button
            onClick={toggleSidebar}
            className="p-1.5 rounded-lg border border-border bg-bg-card text-text-muted hover:bg-bg-hover mr-2"
            aria-label="Open sidebar"
          >
            <ChevronsRight size={18} />
          </button>
        )}

        {/* Fleet Summary Chips */}
        <div className="flex items-center gap-2">
          <FleetChip>
            <span className="w-1.5 h-1.5 rounded-full bg-status-green-fg" />
            <span className="font-mono font-bold">{busyAgents}</span>/{totalAgents} agents
          </FleetChip>
          {attentionCount > 0 && (
            <FleetChip variant="warn">
              <span className="w-1.5 h-1.5 rounded-full bg-status-yellow-fg" />
              <span className="font-mono font-bold">{attentionCount}</span> attention
            </FleetChip>
          )}
          <FleetChip>
            <span className="font-mono font-bold">{formatCurrency(costUsd)}</span> spent
          </FleetChip>
        </div>
      </div>

      <div className="flex items-center gap-2.5">
        {wsActive && (
          <span className="px-2.5 py-1 rounded-md text-[12px] font-medium bg-status-green-surface text-status-green-fg">
            Workspace Active
          </span>
        )}

        <button className="relative p-1.5 rounded-lg border border-border text-text-secondary hover:bg-bg-hover">
          <Bell size={16} />
          {unreadAlertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">
              {unreadAlertCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="p-1.5 rounded-lg border border-border text-text-secondary hover:bg-bg-hover"
        >
          {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
        </button>
      </div>
    </header>
  )
}

function FleetChip({ children, variant }: { children: React.ReactNode; variant?: "warn" }) {
  return (
    <div className={cn(
      "flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-medium",
      variant === "warn"
        ? "bg-status-yellow-surface text-status-yellow-fg"
        : "bg-bg-hover text-text-secondary",
    )}>
      {children}
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/layout/__tests__/top-bar.test.tsx`
Expected: All 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/layout/top-bar.tsx dashboard/src/components/layout/__tests__/top-bar.test.tsx
git commit -m "feat(shell): rewrite TopBar with fleet chips, expand button, no search"
```

---

## Task 6: Build `InspectorPanel` Shell

**Files:**
- Create: `src/components/layout/inspector-panel.tsx`
- Create: `src/components/layout/__tests__/inspector-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/layout/__tests__/inspector-panel.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { InspectorPanel } from "../inspector-panel"
import { useInspectorStore } from "@/lib/inspector-store"

describe("InspectorPanel", () => {
  beforeEach(() => {
    useInspectorStore.setState({
      selectedEntityId: null,
      selectedEntityType: null,
      pinned: false,
      breadcrumbs: [],
    })
  })

  it("renders nothing when no entity is selected", () => {
    const { container } = render(<InspectorPanel />)
    expect(container.querySelector("[data-testid='inspector']")).toBeNull()
  })

  it("renders panel when entity is selected", () => {
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    render(<InspectorPanel />)
    expect(screen.getByTestId("inspector")).toBeInTheDocument()
  })

  it("shows entity type in header", () => {
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    render(<InspectorPanel />)
    expect(screen.getByText(/task/i)).toBeInTheDocument()
  })

  it("shows close button", () => {
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    render(<InspectorPanel />)
    expect(screen.getByLabelText(/close/i)).toBeInTheDocument()
  })

  it("shows pin button", () => {
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    render(<InspectorPanel />)
    expect(screen.getByLabelText(/pin/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/layout/__tests__/inspector-panel.test.tsx`
Expected: FAIL — module `../inspector-panel` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/layout/inspector-panel.tsx
"use client"
import { useInspectorStore } from "@/lib/inspector-store"
import { cn } from "@/lib/utils"
import { X, Pin } from "lucide-react"

export function InspectorPanel() {
  const selectedEntityId = useInspectorStore((s) => s.selectedEntityId)
  const selectedEntityType = useInspectorStore((s) => s.selectedEntityType)
  const pinned = useInspectorStore((s) => s.pinned)
  const breadcrumbs = useInspectorStore((s) => s.breadcrumbs)
  const close = useInspectorStore((s) => s.close)
  const togglePin = useInspectorStore((s) => s.togglePin)
  const navigateBreadcrumb = useInspectorStore((s) => s.navigateBreadcrumb)

  if (!selectedEntityId) return null

  return (
    <div
      data-testid="inspector"
      className="flex flex-col border-l border-border bg-bg-card shrink-0 overflow-y-auto"
      style={{ width: "var(--inspector-width)" }}
    >
      {/* Accent bar */}
      <div className="h-[3px] bg-status-purple-fg" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {selectedEntityType}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={togglePin}
            className={cn(
              "p-1 rounded-md",
              pinned ? "text-status-purple-fg bg-status-purple-surface" : "text-text-muted hover:bg-bg-hover",
            )}
            aria-label={pinned ? "Unpin inspector" : "Pin inspector"}
          >
            <Pin size={14} />
          </button>
          <button
            onClick={close}
            className="p-1 rounded-md text-text-muted hover:bg-bg-hover"
            aria-label="Close inspector"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 text-[11px] text-text-muted border-b border-border overflow-x-auto">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.id} className="flex items-center gap-1 whitespace-nowrap">
              {i > 0 && <span className="text-text-muted">&gt;</span>}
              <button
                onClick={() => navigateBreadcrumb(i)}
                className={cn(
                  "hover:text-text-primary transition-colors",
                  i === breadcrumbs.length - 1 ? "text-text-primary font-medium" : "text-text-muted",
                )}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Body — Phase 3 will add type-specific inspectors here */}
      <div className="flex-1 p-4">
        <p className="text-sm text-text-muted">
          Inspector content for {selectedEntityType} will be implemented in Phase 3.
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/layout/__tests__/inspector-panel.test.tsx`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/layout/inspector-panel.tsx dashboard/src/components/layout/__tests__/inspector-panel.test.tsx
git commit -m "feat(shell): add InspectorPanel shell with pin, close, breadcrumbs"
```

---

## Task 7: Build `WorkspaceGate`

**Files:**
- Create: `src/components/composites/workspace-gate.tsx`
- Create: `src/components/composites/__tests__/workspace-gate.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// src/components/composites/__tests__/workspace-gate.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { WorkspaceGate } from "../workspace-gate"
import { useWorkspaceStore } from "@/lib/workspace-store"

describe("WorkspaceGate", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().clear()
  })

  it("renders setup form when no workspace exists", () => {
    render(<WorkspaceGate>{() => <div>Floor Content</div>}</WorkspaceGate>)
    expect(screen.queryByText("Floor Content")).not.toBeInTheDocument()
  })

  it("renders children when workspace is active", () => {
    useWorkspaceStore.getState().setStatus({
      run: {
        id: "ws-1",
        config: { repoUrl: "https://github.com/test/repo" },
        status: "active",
        projectConfig: null,
        startedAt: "2026-03-29T10:00:00Z",
        completedAt: null,
        error: null,
      },
      costUsd: 0,
      goalSummaries: [],
    })
    render(<WorkspaceGate>{() => <div>Floor Content</div>}</WorkspaceGate>)
    expect(screen.getByText("Floor Content")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/workspace-gate.test.tsx`
Expected: FAIL — module `../workspace-gate` not found

- [ ] **Step 3: Write the implementation**

```typescript
// src/components/composites/workspace-gate.tsx
"use client"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { WorkspaceSetupForm } from "./workspace-setup-form"
import { WorkspaceBootProgress } from "./workspace-boot-progress"

const BOOT_STATUSES = new Set(["created", "cloning", "installing", "detecting"])

interface WorkspaceGateProps {
  children: () => React.ReactNode
}

export function WorkspaceGate({ children }: WorkspaceGateProps) {
  const run = useWorkspaceStore((s) => s.run)
  const status = run?.status

  // No workspace or stopped
  if (!run || status === "stopped") {
    return (
      <div className="flex items-center justify-center h-full">
        <WorkspaceSetupForm />
      </div>
    )
  }

  // Failed
  if (status === "failed") {
    return (
      <div className="flex items-center justify-center h-full">
        <WorkspaceSetupForm errorMessage={run.error} />
      </div>
    )
  }

  // Booting
  if (status && BOOT_STATUSES.has(status)) {
    return (
      <div className="flex items-center justify-center h-full">
        <WorkspaceBootProgress
          status={status}
          repoUrl={run.config.repoUrl}
          startedAt={run.startedAt}
        />
      </div>
    )
  }

  // Active (or stopped_dirty — let children handle)
  return <>{children()}</>
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd dashboard && npx vitest run src/components/composites/__tests__/workspace-gate.test.tsx`
Expected: All 2 tests PASS

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/composites/workspace-gate.tsx dashboard/src/components/composites/__tests__/workspace-gate.test.tsx
git commit -m "feat(shell): add WorkspaceGate composing existing setup/boot components"
```

---

## Task 8: Wire the New Layout Shell

**Files:**
- Modify: `src/app/layout-shell.tsx`

**Note:** The old `src/components/layout/sidebar.tsx` and `src/lib/navigation.ts` (`NAV_SECTIONS`, `PAGE_TITLES`) remain in the codebase as dead code after this task. They will be removed in Phase 6 (Cleanup). Do not delete them now — old routes still reference `PAGE_TITLES`.

- [ ] **Step 1: Update layout-shell to use new components**

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
import { api } from "@/lib/api"

export function LayoutShell({ children }: { children: React.ReactNode }) {
  useSSE()
  const theme = useUIStore((s) => s.theme)

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

- [ ] **Step 2: Verify the app builds**

Run: `cd dashboard && npx next build`
Expected: Build succeeds

- [ ] **Step 3: Verify the app renders**

Run: `cd dashboard && npx next dev`
Open `http://localhost:3000` in browser. Verify:
- AppSidebar visible on the left (260px) with DevFleet logo, New Goal, Search, Features, Recents, User
- TopBar shows fleet chips (values may be 0 without backend)
- Main content area shows existing page content (or WorkspaceGate setup form)
- No InspectorPanel visible (nothing selected yet)

- [ ] **Step 4: Add collapse/expand round-trip smoke test**

```typescript
// Add to an existing test file, e.g. src/lib/__tests__/floor-store.test.ts or create inline
import { useUIStore } from "@/lib/ui-store"

describe("sidebar collapse/expand round-trip", () => {
  it("toggleSidebar collapses and re-expands", () => {
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(true)
    useUIStore.getState().toggleSidebar()
    expect(useUIStore.getState().sidebarCollapsed).toBe(false)
  })
})
```

- [ ] **Step 5: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass (existing + new)

- [ ] **Step 6: Commit**

```bash
git add dashboard/src/app/layout-shell.tsx
git commit -m "feat(shell): wire three-pane layout — AppSidebar, TopBar, InspectorPanel, WorkspaceGate"
```

---

## Task 9: Run Full Test Suite and Verify

- [ ] **Step 1: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run the build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds with no TypeScript errors

- [ ] **Step 3: Verify visual match**

Open `http://localhost:3000` and compare against `ux-sidebar-v2.html` prototype:
- Sidebar layout matches: logo, collapse button, New Goal, search, features, divider, recents, user
- TopBar matches: fleet chips, workspace badge, alert bell, theme toggle
- Sidebar collapse/expand works (click double-chevron, then expand button in top bar)

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(shell): Phase 1 complete — three-pane Unified Command shell"
```
