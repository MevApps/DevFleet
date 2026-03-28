# Workspace Dashboard UI (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the `/workspace` dashboard page with setup form, boot progress, active dashboard, stopped-dirty view, plus Live Floor and Goals page workspace-awareness integration.

**Architecture:** New Zustand store (state-only, no API calls) + 4 API client methods + 4 new components + SSE workspace event handling. Layout shell fetches workspace status on mount; SSE keeps it current. Two existing pages modified for workspace banners and goal-form gating.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zustand 5, Tailwind CSS 4, lucide-react

**Spec:** `docs/superpowers/specs/2026-03-28-workspace-dashboard-ui-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `dashboard/src/lib/types.ts` | Add workspace DTOs |
| Modify | `dashboard/src/lib/api.ts` | Add 4 workspace API methods |
| Create | `dashboard/src/lib/workspace-store.ts` | Zustand store (state only) |
| Modify | `dashboard/src/lib/registry/statuses.ts` | Add `delivered`, `stopped_dirty`, `cloning`, `installing`, `detecting` statuses |
| Modify | `dashboard/src/lib/registry/icons.ts` | Add `Container` icon |
| Modify | `dashboard/src/lib/navigation.ts` | Add Workspace to sidebar + PAGE_TITLES |
| Modify | `dashboard/src/lib/useSSE.ts` | Add workspace event types + store update |
| Modify | `dashboard/src/app/layout-shell.tsx` | Initial workspace status fetch on mount |
| Create | `dashboard/src/components/composites/workspace-setup-form.tsx` | Setup form with validation + localStorage |
| Create | `dashboard/src/components/composites/workspace-boot-progress.tsx` | Boot phase stepper |
| Create | `dashboard/src/components/composites/workspace-goal-log.tsx` | Goal history list |
| Create | `dashboard/src/components/composites/workspace-required-notice.tsx` | Shared "no workspace" warning |
| Create | `dashboard/src/app/workspace/page.tsx` | Workspace page with state machine |
| Modify | `dashboard/src/components/composites/create-goal-form.tsx` | Accept optional `workspaceRepoName` prop |
| Modify | `dashboard/src/app/page.tsx` | Add workspace banners + goal-form gating |
| Modify | `dashboard/src/app/goals/page.tsx` | Add workspace gate around CreateGoalForm |

---

## Task 1: Types + API Client

**Files:**
- Modify: `dashboard/src/lib/types.ts`
- Modify: `dashboard/src/lib/api.ts`

- [ ] **Step 1: Add workspace DTOs to types.ts**

Append to the end of `dashboard/src/lib/types.ts`:

```typescript
// Workspace types
export type WorkspaceRunStatus =
  | "created"
  | "cloning"
  | "installing"
  | "detecting"
  | "active"
  | "stopped"
  | "stopped_dirty"
  | "failed"

export interface WorkspaceStartInput {
  readonly repoUrl: string
  readonly maxCostUsd?: number
  readonly maxTokens?: number
  readonly supervisorModel?: string
  readonly developerModel?: string
  readonly reviewerModel?: string
  readonly timeoutMs?: number
}

export interface WorkspaceRunDTO {
  readonly id: string
  readonly config: WorkspaceStartInput
  readonly status: WorkspaceRunStatus
  readonly projectConfig: {
    readonly language: string
    readonly testCommand: string
    readonly installCommand: string
  } | null
  readonly startedAt: string
  readonly completedAt: string | null
  readonly error: string | null
}

export interface WorkspaceGoalSummaryDTO {
  readonly goalId: string
  readonly description: string
  readonly status: string
  readonly costUsd: number
  readonly durationMs: number
  readonly prUrl: string | null
}

export interface WorkspaceStatusDTO {
  readonly run: WorkspaceRunDTO
  readonly costUsd: number
  readonly goalSummaries: readonly WorkspaceGoalSummaryDTO[]
}
```

- [ ] **Step 2: Add workspace API methods to api.ts**

Add `WorkspaceStartInput` and `WorkspaceStatusDTO` to the import at line 1 of `dashboard/src/lib/api.ts`:

```typescript
import type { LiveFloorData, PipelineData, MetricsSummary, GoalDTO, FinancialsData, QualityData, TimingsData, InsightSummary, InsightDetail, CeoAlertData, AlertPreferencesData, PluginHealth, WorkspaceStartInput, WorkspaceStatusDTO } from "./types"
```

Add these methods to the `api` object:

```typescript
  workspaceStart: (config: WorkspaceStartInput) => post<{ runId: string }>("/workspace/start", config),
  workspaceStatus: () => get<WorkspaceStatusDTO>("/workspace/status"),
  workspaceStop: () => post<{ status: string; clonePath?: string }>("/workspace/stop", {}),
  workspaceCleanup: () => post<{ status: string }>("/workspace/cleanup", {}),
```

- [ ] **Step 3: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/types.ts dashboard/src/lib/api.ts
git commit -m "feat(dashboard): add workspace DTOs and API client methods"
```

---

## Task 2: Workspace Zustand Store

**Files:**
- Create: `dashboard/src/lib/workspace-store.ts`

- [ ] **Step 1: Create the workspace store**

Create `dashboard/src/lib/workspace-store.ts`:

```typescript
import { create } from "zustand"
import type { WorkspaceRunDTO, WorkspaceGoalSummaryDTO, WorkspaceStatusDTO } from "./types"

interface WorkspaceState {
  run: WorkspaceRunDTO | null
  goalSummaries: readonly WorkspaceGoalSummaryDTO[]
  costUsd: number
  error: string | null

  setStatus: (dto: WorkspaceStatusDTO) => void
  setError: (error: string | null) => void
  clear: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  run: null,
  goalSummaries: [],
  costUsd: 0,
  error: null,

  setStatus: (dto) =>
    set({ run: dto.run, goalSummaries: dto.goalSummaries, costUsd: dto.costUsd, error: null }),

  setError: (error) => set({ error }),

  clear: () => set({ run: null, goalSummaries: [], costUsd: 0, error: null }),
}))
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/lib/workspace-store.ts
git commit -m "feat(dashboard): add workspace Zustand store (state only)"
```

---

## Task 3: Registries + Navigation

**Files:**
- Modify: `dashboard/src/lib/registry/statuses.ts`
- Modify: `dashboard/src/lib/registry/icons.ts`
- Modify: `dashboard/src/lib/navigation.ts`

- [ ] **Step 1: Add workspace statuses to the status registry**

In `dashboard/src/lib/registry/statuses.ts`, update the `statusGroups` array.

Add `"delivered"` to the green group:

```typescript
  { color: "green",  statuses: ["completed", "approved", "merged", "healthy", "delivered"] },
```

Add `"cloning"`, `"installing"`, `"detecting"` to the blue group:

```typescript
  { color: "blue",   statuses: ["active", "busy", "in_progress", "cloning", "installing", "detecting"] },
```

Add `"stopped_dirty"` to the yellow group:

```typescript
  { color: "yellow", statuses: ["blocked", "warning", "degraded", "stopped_dirty"] },
```

- [ ] **Step 2: Add Container icon to the icon registry**

In `dashboard/src/lib/registry/icons.ts`, add `Container` to the lucide-react import:

```typescript
import {
  Bot, Target, CheckSquare, FileCode, Activity, BarChart3, Wallet,
  Circle, Radio, Columns3, DollarSign, ShieldCheck, Timer, HeartPulse,
  Lightbulb, Inbox, PanelLeftOpen, PanelLeftClose, Sun, Moon, Bell,
  Container,
} from "lucide-react"
```

Add `Container` to the `iconMap` object:

```typescript
const iconMap: Record<string, LucideIcon> = {
  Bot, Target, CheckSquare, FileCode, Activity, BarChart3, Wallet,
  Circle, Radio, Columns3, DollarSign, ShieldCheck, Timer, HeartPulse,
  Lightbulb, Inbox, PanelLeftOpen, PanelLeftClose, Sun, Moon, Bell,
  Container,
}
```

- [ ] **Step 3: Add Workspace to navigation**

In `dashboard/src/lib/navigation.ts`, update the Workflow section to add Workspace as the first item:

```typescript
  {
    title: "Workflow",
    items: [
      { href: "/workspace", label: "Workspace", icon: "Container" },
      { href: "/pipeline", label: "Pipeline", icon: "Columns3" },
      { href: "/goals", label: "Goals", icon: "Target" },
    ],
  },
```

Add to `PAGE_TITLES`:

```typescript
  "/workspace": "Workspace",
```

- [ ] **Step 4: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/lib/registry/statuses.ts dashboard/src/lib/registry/icons.ts dashboard/src/lib/navigation.ts
git commit -m "feat(dashboard): add workspace statuses, icon, and navigation entry"
```

---

## Task 4: SSE + Layout Shell Integration

**Files:**
- Modify: `dashboard/src/lib/useSSE.ts`
- Modify: `dashboard/src/app/layout-shell.tsx`

- [ ] **Step 1: Add workspace events to SSE hook**

In `dashboard/src/lib/useSSE.ts`, add import for workspace store and API:

```typescript
import { useWorkspaceStore } from "./workspace-store"
import { api } from "./api"
```

Add workspace store selectors after the existing selectors (after line 9):

```typescript
  const setWorkspaceStatus = useWorkspaceStore((s) => s.setStatus)
  const clearWorkspace = useWorkspaceStore((s) => s.clear)
```

Add workspace event types to the `refreshTypes` set inside `source.onmessage` (after the existing set):

```typescript
      const workspaceRefreshTypes = new Set([
        "workspace.status.changed",
        "workspace.goal.delivered",
        "workspace.goal.failed",
      ])
      if (workspaceRefreshTypes.has(data.type)) {
        api.workspaceStatus()
          .then(setWorkspaceStatus)
          .catch(() => clearWorkspace())
      }
```

Add `setWorkspaceStatus` and `clearWorkspace` to the `useEffect` dependency array.

The full updated `useSSE.ts` should be:

```typescript
"use client"
import { useEffect, useRef } from "react"
import { useDashboardStore } from "./store"
import { useUIStore } from "./ui-store"
import { useWorkspaceStore } from "./workspace-store"
import { api } from "./api"
import type { SSEEvent } from "./types"

export function useSSE() {
  const handleSSEEvent = useDashboardStore((s) => s.handleSSEEvent)
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)
  const fetchMetrics = useDashboardStore((s) => s.fetchMetrics)
  const setWorkspaceStatus = useWorkspaceStore((s) => s.setStatus)
  const clearWorkspace = useWorkspaceStore((s) => s.clear)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    useUIStore.getState().setConnectionState("reconnecting")
    const source = new EventSource("/api/events/stream")
    sourceRef.current = source

    source.onopen = () => {
      useUIStore.getState().setConnectionState("connected")
    }

    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as SSEEvent
      handleSSEEvent(data)
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
      const workspaceRefreshTypes = new Set([
        "workspace.status.changed",
        "workspace.goal.delivered",
        "workspace.goal.failed",
      ])
      if (workspaceRefreshTypes.has(data.type)) {
        api.workspaceStatus()
          .then(setWorkspaceStatus)
          .catch(() => clearWorkspace())
      }
    }

    source.onerror = () => {
      useUIStore.getState().setConnectionState("reconnecting")
    }

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [handleSSEEvent, fetchLiveFloor, fetchPipeline, fetchMetrics, setWorkspaceStatus, clearWorkspace])
}
```

- [ ] **Step 2: Add initial workspace fetch to layout shell**

In `dashboard/src/app/layout-shell.tsx`, add imports:

```typescript
import { useWorkspaceStore } from "@/lib/workspace-store"
import { api } from "@/lib/api"
```

Add a `useEffect` after the existing theme effects (after line 22) that fetches workspace status on mount:

```typescript
  useEffect(() => {
    api.workspaceStatus()
      .then(useWorkspaceStore.getState().setStatus)
      .catch(() => useWorkspaceStore.getState().clear())
  }, [])
```

The full updated `layout-shell.tsx`:

```typescript
"use client"
import { useEffect } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { TopBar } from "@/components/layout/top-bar"
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
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 4: Commit**

```bash
git add dashboard/src/lib/useSSE.ts dashboard/src/app/layout-shell.tsx
git commit -m "feat(dashboard): wire SSE workspace events + initial fetch on mount"
```

---

## Task 5: WorkspaceRequiredNotice Component

**Files:**
- Create: `dashboard/src/components/composites/workspace-required-notice.tsx`

- [ ] **Step 1: Create the component**

Create `dashboard/src/components/composites/workspace-required-notice.tsx`:

```typescript
import Link from "next/link"

export function WorkspaceRequiredNotice() {
  return (
    <div className="rounded-lg border border-status-yellow-border bg-status-yellow-surface p-4 flex items-center gap-3">
      <span className="text-status-yellow-fg text-sm">⚠</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">No active workspace</p>
        <p className="text-xs text-text-secondary mt-0.5">Start a workspace to create goals.</p>
      </div>
      <Link
        href="/workspace"
        className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-500"
      >
        Start Workspace →
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/composites/workspace-required-notice.tsx
git commit -m "feat(dashboard): add WorkspaceRequiredNotice component"
```

---

## Task 6: WorkspaceSetupForm Component

**Files:**
- Create: `dashboard/src/components/composites/workspace-setup-form.tsx`

- [ ] **Step 1: Create the component**

Create `dashboard/src/components/composites/workspace-setup-form.tsx`:

```typescript
"use client"
import { useState } from "react"
import { api } from "@/lib/api"
import { useWorkspaceStore } from "@/lib/workspace-store"

const STORAGE_KEY = "devfleet-workspace-last-config"

interface WorkspaceSetupFormProps {
  errorMessage?: string | null
}

export function WorkspaceSetupForm({ errorMessage }: WorkspaceSetupFormProps) {
  const [repoUrl, setRepoUrl] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [maxCostUsd, setMaxCostUsd] = useState(10)
  const [maxTokens, setMaxTokens] = useState(200_000)
  const [timeoutMs, setTimeoutMs] = useState(600_000)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLastConfig = () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    try {
      const config = JSON.parse(saved) as { repoUrl: string; maxCostUsd: number; maxTokens: number; timeoutMs: number }
      setRepoUrl(config.repoUrl)
      setMaxCostUsd(config.maxCostUsd)
      setMaxTokens(config.maxTokens)
      setTimeoutMs(config.timeoutMs)
    } catch { /* ignore corrupt data */ }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = repoUrl.trim()
    if (!trimmed) { setError("Repository URL is required"); return }
    setSubmitting(true)
    setError(null)
    const config = { repoUrl: trimmed, maxCostUsd, maxTokens, timeoutMs }
    try {
      await api.workspaceStart(config)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
      const status = await api.workspaceStatus()
      useWorkspaceStore.getState().setStatus(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start workspace")
    } finally {
      setSubmitting(false)
    }
  }

  const displayError = error ?? errorMessage

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <div className="text-center mb-6">
          <p className="text-3xl mb-2">📦</p>
          <h2 className="text-lg font-semibold text-text-primary">Start a Workspace</h2>
          <p className="text-sm text-text-secondary mt-1">
            Clone a repository and let DevFleet work on it.
          </p>
        </div>

        {displayError && (
          <div className="rounded-lg border border-status-red-border bg-status-red-surface p-3 mb-4">
            <p className="text-sm text-status-red-fg">{displayError}</p>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1">Repository URL</label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full px-3 py-2 rounded-md text-sm border border-border bg-page text-text-primary focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            {showAdvanced ? "▾" : "▸"} Advanced settings
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">Budget ($)</label>
                <input type="number" step="0.01" value={maxCostUsd}
                  onChange={(e) => setMaxCostUsd(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-md text-sm border border-border bg-page text-text-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">Max tokens</label>
                <input type="number" value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-md text-sm border border-border bg-page text-text-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">Timeout (ms)</label>
                <input type="number" value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-md text-sm border border-border bg-page text-text-primary focus:outline-none" />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Starting..." : "Start Workspace"}
            </button>
            <button
              type="button"
              onClick={loadLastConfig}
              className="px-3 py-2 rounded-md text-sm border border-border text-text-secondary hover:bg-hover"
            >
              Last Config
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/composites/workspace-setup-form.tsx
git commit -m "feat(dashboard): add WorkspaceSetupForm with validation and localStorage"
```

---

## Task 7: WorkspaceBootProgress Component

**Files:**
- Create: `dashboard/src/components/composites/workspace-boot-progress.tsx`

- [ ] **Step 1: Create the component**

Create `dashboard/src/components/composites/workspace-boot-progress.tsx`:

```typescript
import type { WorkspaceRunStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatTimeAgo } from "@/lib/utils/format"

const BOOT_PHASES = [
  { status: "cloning" as const, label: "Cloning" },
  { status: "installing" as const, label: "Installing" },
  { status: "detecting" as const, label: "Detecting" },
  { status: "active" as const, label: "Active" },
]

interface WorkspaceBootProgressProps {
  status: WorkspaceRunStatus
  repoUrl: string
  startedAt: string
}

export function WorkspaceBootProgress({ status, repoUrl, startedAt }: WorkspaceBootProgressProps) {
  const currentIndex = BOOT_PHASES.findIndex((p) => p.status === status)

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-lg text-center">
        <p className="text-3xl mb-4">⏳</p>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Setting up workspace</h2>
        <p className="text-sm text-text-secondary mb-6">{repoUrl}</p>

        <div className="flex items-center justify-center gap-2 mb-6">
          {BOOT_PHASES.map((phase, i) => {
            const isComplete = i < currentIndex
            const isCurrent = i === currentIndex
            return (
              <div key={phase.status} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border",
                      isComplete && "bg-status-green-surface border-status-green-border text-status-green-fg",
                      isCurrent && "bg-status-blue-surface border-status-blue-border text-status-blue-fg",
                      !isComplete && !isCurrent && "bg-page border-border text-text-muted",
                    )}
                  >
                    {isComplete ? "✓" : i + 1}
                  </div>
                  <span
                    className={cn(
                      "text-xs",
                      isCurrent ? "text-status-blue-fg font-medium" : "text-text-muted",
                    )}
                  >
                    {phase.label}
                  </span>
                </div>
                {i < BOOT_PHASES.length - 1 && (
                  <div
                    className={cn(
                      "w-8 h-px mb-4",
                      i < currentIndex ? "bg-status-green-fg" : "bg-border",
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>

        <p className="text-xs text-text-muted">Started {formatTimeAgo(startedAt)}</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/composites/workspace-boot-progress.tsx
git commit -m "feat(dashboard): add WorkspaceBootProgress stepper component"
```

---

## Task 8: WorkspaceGoalLog Component

**Files:**
- Create: `dashboard/src/components/composites/workspace-goal-log.tsx`

- [ ] **Step 1: Create the component**

Create `dashboard/src/components/composites/workspace-goal-log.tsx`:

```typescript
import { StatusBadge } from "@/components/primitives/status-badge"
import { formatCurrency } from "@/lib/utils/format"
import type { WorkspaceGoalSummaryDTO } from "@/lib/types"
import Link from "next/link"

interface WorkspaceGoalLogProps {
  goalSummaries: readonly WorkspaceGoalSummaryDTO[]
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m`
}

export function WorkspaceGoalLog({ goalSummaries }: WorkspaceGoalLogProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs uppercase tracking-wider text-text-muted mb-3">Goal Activity</h3>

      {goalSummaries.length === 0 ? (
        <p className="text-sm text-text-secondary py-4 text-center">
          No goals yet. Create goals from the{" "}
          <Link href="/" className="text-blue-400 hover:underline">Live Floor</Link> page.
        </p>
      ) : (
        <div className="space-y-2">
          {goalSummaries.map((goal) => (
            <div key={goal.goalId} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <StatusBadge status={goal.status} />
                <span className="text-sm text-text-primary truncate">{goal.description}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <span className="text-xs text-text-muted">
                  {formatCurrency(goal.costUsd)} · {formatDuration(goal.durationMs)}
                </span>
                {goal.prUrl && (
                  <a
                    href={goal.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline"
                  >
                    PR
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs text-text-muted">
          Create goals from the{" "}
          <Link href="/" className="text-blue-400 hover:underline">Live Floor</Link> page
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/composites/workspace-goal-log.tsx
git commit -m "feat(dashboard): add WorkspaceGoalLog component"
```

---

## Task 9: Workspace Page

**Files:**
- Create: `dashboard/src/app/workspace/page.tsx`

- [ ] **Step 1: Create the workspace page**

Create `dashboard/src/app/workspace/page.tsx`:

```typescript
"use client"
import { useCallback } from "react"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { usePolling } from "@/hooks/use-polling"
import { api } from "@/lib/api"
import { WorkspaceSetupForm } from "@/components/composites/workspace-setup-form"
import { WorkspaceBootProgress } from "@/components/composites/workspace-boot-progress"
import { WorkspaceGoalLog } from "@/components/composites/workspace-goal-log"
import { MetricValue } from "@/components/primitives/metric-value"
import { StatusBadge } from "@/components/primitives/status-badge"
import { formatTimeAgo } from "@/lib/utils/format"
import { useState } from "react"

const BOOT_STATUSES = new Set(["created", "cloning", "installing", "detecting"])

export default function WorkspacePage() {
  const run = useWorkspaceStore((s) => s.run)
  const goalSummaries = useWorkspaceStore((s) => s.goalSummaries)
  const costUsd = useWorkspaceStore((s) => s.costUsd)
  const setStatus = useWorkspaceStore((s) => s.setStatus)
  const clear = useWorkspaceStore((s) => s.clear)
  const [stopError, setStopError] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const status = await api.workspaceStatus()
      setStatus(status)
    } catch {
      clear()
    }
  }, [setStatus, clear])

  usePolling(fetchStatus)

  const handleStop = async () => {
    setStopError(null)
    try {
      await api.workspaceStop()
      await fetchStatus()
    } catch (err) {
      setStopError(err instanceof Error ? err.message : "Failed to stop workspace")
    }
  }

  const handleCleanup = async () => {
    try {
      await api.workspaceCleanup()
      clear()
    } catch { /* cleanup failure shown by re-fetch */ }
  }

  const status = run?.status

  // State 1: No workspace or stopped
  if (!run || status === "stopped") {
    return <WorkspaceSetupForm />
  }

  // State 1+: Failed
  if (status === "failed") {
    return <WorkspaceSetupForm errorMessage={run.error} />
  }

  // State 1.5: Booting
  if (status && BOOT_STATUSES.has(status)) {
    return (
      <WorkspaceBootProgress
        status={status}
        repoUrl={run.config.repoUrl}
        startedAt={run.startedAt}
      />
    )
  }

  // State 3: Stopped dirty
  if (status === "stopped_dirty") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-status-yellow-border bg-status-yellow-surface p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">Workspace stopped with failed goals</p>
            <p className="text-xs text-text-secondary mt-1">
              Clone preserved for debugging
            </p>
          </div>
          <button
            onClick={handleCleanup}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-500"
          >
            Cleanup
          </button>
        </div>
        <WorkspaceGoalLog goalSummaries={goalSummaries} />
      </div>
    )
  }

  // State 2: Active
  const repoName = run.config.repoUrl.split("/").pop() ?? run.config.repoUrl
  const activeGoalCount = goalSummaries.filter((g) =>
    g.status === "active" || g.status === "in_progress"
  ).length

  return (
    <div className="space-y-4">
      {/* Info bar */}
      <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-status-green-fg animate-pulse" />
          <span className="text-base font-medium text-text-primary">{repoName}</span>
          {run.projectConfig && (
            <StatusBadge status={run.projectConfig.language} />
          )}
        </div>
        <div className="flex items-center gap-3">
          {stopError && (
            <span className="text-xs text-status-red-fg">{stopError}</span>
          )}
          <button
            onClick={handleStop}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-900 text-red-300 hover:bg-red-800"
          >
            Stop Workspace
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <MetricValue label="Goals Run" value={goalSummaries.length} />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <MetricValue label="Active" value={activeGoalCount} />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <MetricValue label="Total Cost" value={costUsd} format="currency" />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs uppercase tracking-wider text-text-secondary">Uptime</span>
          <p className="font-mono text-2xl font-bold text-text-primary mt-1">
            {formatTimeAgo(run.startedAt).replace(" ago", "")}
          </p>
        </div>
      </div>

      {/* Goal log */}
      <WorkspaceGoalLog goalSummaries={goalSummaries} />
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/app/workspace/page.tsx
git commit -m "feat(dashboard): add /workspace page with 4-state state machine"
```

---

## Task 10: CreateGoalForm Prop + Live Floor + Goals Page Integration

**Files:**
- Modify: `dashboard/src/components/composites/create-goal-form.tsx`
- Modify: `dashboard/src/app/page.tsx`
- Modify: `dashboard/src/app/goals/page.tsx`

- [ ] **Step 1: Add `workspaceRepoName` prop to CreateGoalForm**

In `dashboard/src/components/composites/create-goal-form.tsx`, update the component signature and add the targeting indicator.

Replace the entire file with:

```typescript
"use client"
import { useState } from "react"
import { api } from "@/lib/api"
import { useDashboardStore } from "@/lib/store"

interface CreateGoalFormProps {
  workspaceRepoName?: string
}

export function CreateGoalForm({ workspaceRepoName }: CreateGoalFormProps) {
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
    <form onSubmit={handleSubmit} className="rounded-lg border border-border p-4 bg-card">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-medium text-text-primary">Create Goal</h3>
        {workspaceRepoName && (
          <span className="text-xs text-text-muted">
            Targeting: <span className="text-text-secondary">{workspaceRepoName}</span>
          </span>
        )}
      </div>
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your goal..."
            className="w-full px-3 py-2 rounded-md text-sm border border-border bg-page text-text-primary focus:outline-none" />
        </div>
        <div className="w-32">
          <label className="text-xs block mb-1 text-text-secondary">Max tokens</label>
          <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))}
            className="w-full px-2 py-2 rounded-md text-sm border border-border bg-page text-text-primary focus:outline-none" />
        </div>
        <div className="w-24">
          <label className="text-xs block mb-1 text-text-secondary">Max $ USD</label>
          <input type="number" step="0.01" value={maxCostUsd} onChange={(e) => setMaxCostUsd(Number(e.target.value))}
            className="w-full px-2 py-2 rounded-md text-sm border border-border bg-page text-text-primary focus:outline-none" />
        </div>
        <button type="submit" disabled={submitting || !description.trim()}
          className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">
          {submitting ? "Creating..." : "Create"}
        </button>
      </div>
      {error && <p className="text-xs mt-2 text-status-red-fg">{error}</p>}
    </form>
  )
}
```

- [ ] **Step 2: Update Live Floor page with workspace banners + goal gate**

Replace `dashboard/src/app/page.tsx` with:

```typescript
"use client"
import { useDashboardStore } from "@/lib/store"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { usePolling } from "@/hooks/use-polling"
import { MetricsRow } from "@/components/composites/metrics-row"
import { AgentCard } from "@/components/composites/agent-card"
import { ActivityFeed } from "@/components/composites/activity-feed"
import { CreateGoalForm } from "@/components/composites/create-goal-form"
import { WorkspaceRequiredNotice } from "@/components/composites/workspace-required-notice"
import { useCallback } from "react"
import Link from "next/link"

export default function LiveFloorPage() {
  const { agents, recentEvents, metrics } = useDashboardStore()
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchMetrics = useDashboardStore((s) => s.fetchMetrics)
  const run = useWorkspaceStore((s) => s.run)

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchLiveFloor(), fetchMetrics()])
  }, [fetchLiveFloor, fetchMetrics])

  usePolling(fetchAll)

  const isActive = run?.status === "active"
  const repoName = run?.config.repoUrl.split("/").pop() ?? ""

  return (
    <div className="space-y-6">
      {/* Workspace banner */}
      {isActive ? (
        <div className="rounded-lg border border-status-blue-border bg-status-blue-surface px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-status-blue-fg animate-pulse" />
            <span className="text-sm text-status-blue-fg font-medium">Workspace active:</span>
            <span className="text-sm text-text-primary">{repoName}</span>
            <span className="text-xs text-text-muted">— goals target this workspace</span>
          </div>
          <Link href="/workspace" className="text-xs text-status-blue-fg font-medium hover:underline">
            View Workspace →
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📦</span>
            <span className="text-sm text-text-primary">No workspace running</span>
            <span className="text-xs text-text-muted">— Start a workspace to begin creating goals.</span>
          </div>
          <Link href="/workspace" className="text-xs text-blue-400 font-medium hover:underline">
            Start Workspace →
          </Link>
        </div>
      )}

      <MetricsRow metrics={metrics} />

      {/* Goal form or workspace required notice */}
      {isActive ? (
        <CreateGoalForm workspaceRepoName={repoName} />
      ) : (
        <WorkspaceRequiredNotice />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
      <ActivityFeed events={recentEvents} />
    </div>
  )
}
```

- [ ] **Step 3: Update Goals page with workspace gate**

Replace `dashboard/src/app/goals/page.tsx` with:

```typescript
"use client"
import { useDashboardStore } from "@/lib/store"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { usePolling } from "@/hooks/use-polling"
import { GoalCard } from "@/components/composites/goal-card"
import { CreateGoalForm } from "@/components/composites/create-goal-form"
import { WorkspaceRequiredNotice } from "@/components/composites/workspace-required-notice"
import { EmptyState } from "@/components/primitives/empty-state"

export default function GoalsPage() {
  const { goals } = useDashboardStore()
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)
  const run = useWorkspaceStore((s) => s.run)
  usePolling(fetchPipeline)

  const isActive = run?.status === "active"
  const repoName = run?.config.repoUrl.split("/").pop() ?? ""

  return (
    <div className="space-y-6">
      {isActive ? (
        <CreateGoalForm workspaceRepoName={repoName} />
      ) : (
        <WorkspaceRequiredNotice />
      )}
      {goals.length === 0 ? (
        <EmptyState icon="Target" title="No goals yet" description="Create a goal above to get started" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map((goal) => (<GoalCard key={goal.id} goal={goal} />))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 5: Commit**

```bash
git add dashboard/src/components/composites/create-goal-form.tsx dashboard/src/app/page.tsx dashboard/src/app/goals/page.tsx
git commit -m "feat(dashboard): integrate workspace banners, goal-form gating, and targeting indicator"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Full type check**

Run: `cd dashboard && npx tsc --noEmit`
Expected: No type errors

- [ ] **Step 2: Dev server smoke test**

Run: `cd dashboard && npm run dev`

Verify in browser:
- `/workspace` shows the setup form (State 1)
- Sidebar shows "Workspace" as first item under Workflow
- Live Floor shows "No workspace running" nudge banner
- Live Floor shows `WorkspaceRequiredNotice` instead of goal form
- Goals page shows `WorkspaceRequiredNotice` instead of goal form

- [ ] **Step 3: Stop dev server and commit any fixes if needed**
