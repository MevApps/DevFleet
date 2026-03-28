# Workspace Dashboard UI Design (Plan B)

> Frontend for the workspace backend (Plan A). Setup form, boot progress,
> active dashboard, stopped-dirty view, plus Live Floor and Goals page
> integration with prerequisite-aware empty states.

## Motivation

The workspace backend is shipped (5 API endpoints, WorkspaceRunManager,
goal routing). Users need a browser UI to start workspaces, monitor
progress, and see goal delivery — without touching the terminal. More
importantly, users must understand that a workspace is a prerequisite
for creating goals. The UI must guide them to set one up before they can
do anything else.

## Success Criteria

1. User can start a workspace from `/workspace` in under 30 seconds
2. Boot progress (cloning → installing → detecting → active) is visible in real-time
3. Active workspace shows goal history with status, cost, duration, and PR links
4. Live Floor shows a banner indicating workspace state (active or missing)
5. Goals page disables goal creation when no workspace is active
6. Failed-goal cleanup is one click from the stopped-dirty view

## Constraints

- Dashboard is a Next.js 15 app in `dashboard/` — talks to core via HTTP proxy
- All existing patterns preserved: Zustand stores, `api.ts` module, `useSSE` hook, shadcn + Tailwind
- No new polling endpoints — reuse `/api/workspace/status` + SSE events
- `localStorage` for "Last Config" is a v1 shortcut (acknowledged, not abstracted)

---

## Navigation

Add "Workspace" as the **first item** in the Workflow sidebar section,
above Pipeline and Goals. This signals hierarchy: workspace first, then
features that operate within it.

```typescript
// In navigation.ts, Workflow section becomes:
{
  title: "Workflow",
  items: [
    { href: "/workspace", label: "Workspace", icon: "Container" },
    { href: "/pipeline", label: "Pipeline", icon: "Columns3" },
    { href: "/goals", label: "Goals", icon: "Target" },
  ],
}
```

Add `/workspace` to `PAGE_TITLES`: `"/workspace": "Workspace"`.

---

## Types (`types.ts`)

```typescript
interface WorkspaceStartInput {
  readonly repoUrl: string
  readonly maxCostUsd?: number
  readonly maxTokens?: number
  readonly supervisorModel?: string
  readonly developerModel?: string
  readonly reviewerModel?: string
  readonly timeoutMs?: number
}

interface WorkspaceRunDTO {
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

type WorkspaceRunStatus =
  | "created"
  | "cloning"
  | "installing"
  | "detecting"
  | "active"
  | "stopped"
  | "stopped_dirty"
  | "failed"

interface WorkspaceGoalSummaryDTO {
  readonly goalId: string
  readonly description: string
  readonly status: string
  readonly costUsd: number
  readonly durationMs: number
  readonly prUrl: string | null
}

interface WorkspaceStatusDTO {
  readonly run: WorkspaceRunDTO
  readonly costUsd: number
  readonly goalSummaries: readonly WorkspaceGoalSummaryDTO[]
}
```

---

## API Client (`api.ts`)

Four methods added to the existing `api` object. No `workspaceActive()`
endpoint — redundant when we already have `workspaceStatus()` + SSE.

```typescript
workspaceStart: (config: WorkspaceStartInput) =>
  post<{ runId: string }>("/workspace/start", config),

workspaceStatus: () =>
  get<WorkspaceStatusDTO>("/workspace/status"),

workspaceStop: () =>
  post<{ status: string; clonePath?: string }>("/workspace/stop", {}),

workspaceCleanup: () =>
  post<{ status: string }>("/workspace/cleanup", {}),
```

---

## State Management (`workspace-store.ts`)

The store holds **state only**. No API calls, no side effects. Page
components and hooks call the API, then update the store.

```typescript
interface WorkspaceState {
  run: WorkspaceRunDTO | null
  goalSummaries: readonly WorkspaceGoalSummaryDTO[]
  costUsd: number
  error: string | null

  setStatus(dto: WorkspaceStatusDTO): void
  setError(error: string | null): void
  clear(): void
}
```

**No `isActive` boolean.** Derived via selectors at the call site:

```typescript
const isActive = useWorkspaceStore(s => s.run?.status === "active")
const isBooting = useWorkspaceStore(s =>
  ["created", "cloning", "installing", "detecting"].includes(s.run?.status ?? ""))
const isDirty = useWorkspaceStore(s => s.run?.status === "stopped_dirty")
const isFailed = useWorkspaceStore(s => s.run?.status === "failed")
```

---

## SSE Integration (`useSSE.ts`)

Add workspace event types to the existing refresh trigger set:

```typescript
"workspace.status.changed",
"workspace.goal.delivered",
"workspace.goal.failed",
```

On any workspace event: call `api.workspaceStatus()`, then
`useWorkspaceStore.getState().setStatus(dto)`. Both the Live Floor
banner and the workspace page read from the same store — one fetch,
one source of truth.

**Tech debt note:** The `useSSE` hook is becoming a coordinator for
multiple stores. This is acknowledged as tech debt but not fixed in
this scope. Adding 3 event types to the existing set is acceptable.
A future refactor could make the hook dispatch generic events that
stores subscribe to independently.

---

## Initial Fetch Strategy

SSE drives real-time updates, but pages need state on mount before
any SSE event fires.

- **Workspace page:** calls `api.workspaceStatus()` on mount via the
  existing `usePolling` hook (10s interval, matching other pages).
  A 404 response means "no workspace" — sets `run: null`, not an error.
- **Live Floor:** reads `useWorkspaceStore(s => s.run)` which is
  populated by the workspace page's polling or by SSE events. If the
  user navigates directly to Live Floor without visiting `/workspace`
  first, the store is `null` (shows nudge banner). The first SSE
  workspace event will populate it.
- **Layout shell:** optionally, a single `api.workspaceStatus()` call
  in the layout shell on app mount ensures the store is populated
  regardless of which page the user lands on. This is the recommended
  approach — one fetch on app start, SSE keeps it current.

---

## Error Contract

Errors are handled at the surface where the user can act on them:

| Error source | Where shown | UX |
|-------------|------------|-----|
| `startWorkspace()` validation (empty URL) | Inline in setup form | Red text below input |
| `startWorkspace()` 4xx (already active, clone failed) | Inline in setup form | Error banner above form |
| `startWorkspace()` 5xx | Inline in setup form | "Something went wrong. Try again." |
| `stopWorkspace()` 409 (goals still running) | Inline near Stop button | "Cannot stop — goals are still running." |
| `workspaceStatus()` 404 | Not an error | Sets `run: null` (State 1) |
| `workspaceStatus()` 5xx | Dismissible banner at top of workspace page | "Failed to load workspace status." |
| `cleanupWorkspace()` failure | Inline near Cleanup button | "Cleanup failed." |
| `run.status === "failed"` | Setup form with error banner | Shows `run.error` above the form + "Try Again" |

---

## Components

Only components with meaningful logic get their own file. Trivial
markup (stats row, info bar, banners) is inlined in the page.

| Component | File | Justification |
|-----------|------|---------------|
| `WorkspaceSetupForm` | `composites/workspace-setup-form.tsx` | Form state, validation, localStorage read/write, submit handler, error display |
| `WorkspaceBootProgress` | `composites/workspace-boot-progress.tsx` | Phase stepper logic: maps `run.status` to step index, renders 4-step indicator (Cloning → Installing → Detecting → Active) |
| `WorkspaceGoalLog` | `composites/workspace-goal-log.tsx` | List rendering with status mapping, cost/duration formatting, PR links, empty state |

Components **not** extracted (inlined in the page):

- **Info bar** — a flex row: green dot, repo name, language tag, Stop button. ~15 lines.
- **Stats row** — four `MetricValue` cards in a grid. ~20 lines.
- **Active banner** (Live Floor) — blue bar with repo name + link. ~10 lines.
- **Nudge banner** (Live Floor) — CTA bar with "Start Workspace →". ~10 lines.
- **Dirty banner** — warning bar with clone path + Cleanup button. ~15 lines.
- **Workspace required notice** (Goals page) — warning with link. ~8 lines.

---

## Workspace Page (`app/workspace/page.tsx`)

### State machine

```
run === null OR status === "stopped"   → State 1:   WorkspaceSetupForm
status === "failed"                    → State 1+:  WorkspaceSetupForm with error banner (run.error)
status in [created, cloning,           → State 1.5: WorkspaceBootProgress
  installing, detecting]
status === "active"                    → State 2:   Info bar + Stats row + WorkspaceGoalLog
status === "stopped_dirty"             → State 3:   Dirty banner + WorkspaceGoalLog
```

### State 1: No active workspace

Centered layout. `WorkspaceSetupForm` with:
- Repository URL input (required)
- Collapsed "Advanced settings" toggle: budget, models, timeout
- "Start Workspace" primary button
- "Last Config" secondary button (reads from `localStorage` key `devfleet-workspace-last-config`)
- On submit: calls `api.workspaceStart(config)`, saves config to localStorage, store updates via SSE

### State 1+: Failed (reuses State 1)

Same as State 1 but with an error banner above the form:
- Shows `run.error` message
- "Try Again" is implicit — the form is right there

### State 1.5: Boot progress

`WorkspaceBootProgress` shows a horizontal stepper:

```
[1 Cloning] → [2 Installing] → [3 Detecting] → [4 Active]
     ●              ○                ○              ○
```

- Current step highlighted (blue), completed steps green, pending steps gray
- Below stepper: repo URL and elapsed time
- Driven by `run.status` from the store (updated via SSE)
- On failure during boot: transitions to State 1+ (failed)

### State 2: Workspace active

**Info bar** (inline):
- Green pulsing dot + repo name (extracted from URL) + language/commands badge
- "Stop Workspace" destructive button (right-aligned)
- Stop button shows inline error if stop fails (409: goals running)

**Stats row** (inline, 4 `MetricValue` cards):
- Goals Run (count from `goalSummaries.length`)
- Active (count where status is active/in_progress)
- Total Cost (`costUsd` formatted as currency)
- Uptime (derived from `run.startedAt` via `TimeAgo`)

**Goal log** (`WorkspaceGoalLog`):
- Table/list of `goalSummaries`
- Each row: StatusBadge, description, cost, duration, PR link (if delivered)
- Status badges: `delivered` (green), `active` (blue), `failed` (red)
- Empty state: "No goals yet. Create goals from the Live Floor page."
- Footer hint: "Create goals from the Live Floor page" with link

### State 3: Stopped dirty

**Dirty banner** (inline):
- Yellow/amber warning: "Workspace stopped with failed goals"
- Clone path displayed in monospace
- "Cleanup" button — calls `api.workspaceCleanup()`, transitions to State 1

**Goal log** — same `WorkspaceGoalLog` showing the final state with failures visible.

---

## Live Floor Integration (`app/page.tsx`)

Render one of two inline banners at the top of the page, above the
existing MetricsRow:

**When workspace is active:**
```
[blue banner] ● Workspace active: acme/web-app — goals target this workspace   [View Workspace →]
```
Links to `/workspace`.

**When no workspace:**
```
[neutral banner] 📦 No workspace running — Start a workspace to begin creating goals.   [Start Workspace →]
```
Links to `/workspace`.

The banner reads from `useWorkspaceStore(s => s.run)`. No separate
API call — relies on the layout shell's initial fetch + SSE updates.

---

## Goals Integration (`composites/create-goal-form.tsx`)

`CreateGoalForm` is rendered in two places: Live Floor (`app/page.tsx`)
and Goals page (`app/goals/page.tsx`). Both need the workspace gate.

The **page** that hosts the form checks workspace state, not the form
itself. The form never imports `useWorkspaceStore`.

```tsx
// In both app/page.tsx and app/goals/page.tsx:
const isActive = useWorkspaceStore(s => s.run?.status === "active")
const repoName = useWorkspaceStore(s =>
  s.run?.config.repoUrl.split("/").pop() ?? "")

return isActive
  ? <CreateGoalForm targetLabel={repoName} />
  : <WorkspaceRequiredNotice />  // inline: warning + "Start Workspace →" link
```

The `CreateGoalForm` receives an optional `targetLabel` prop and renders
a small indicator: "Targeting: {targetLabel}". No other workspace
awareness.

The `WorkspaceRequiredNotice` is ~8 lines of inline JSX: an amber
warning box with "No active workspace" message and a link to `/workspace`.
Since it's used in two places, extract it as a shared component only if
the markup is identical in both — otherwise inline it (YAGNI).

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `app/workspace/page.tsx` | Workspace page with state machine |
| Create | `lib/workspace-store.ts` | Zustand store (state only, no API calls) |
| Create | `composites/workspace-setup-form.tsx` | Setup form with validation + localStorage |
| Create | `composites/workspace-boot-progress.tsx` | Boot phase stepper |
| Create | `composites/workspace-goal-log.tsx` | Goal history list |
| Modify | `lib/api.ts` | Add 4 workspace API methods |
| Modify | `lib/types.ts` | Add workspace DTOs |
| Modify | `lib/useSSE.ts` | Add 3 workspace event types to refresh set |
| Modify | `lib/navigation.ts` | Add Workspace to Workflow section + PAGE_TITLES |
| Modify | `app/page.tsx` | Add workspace banner (active/nudge) + workspace gate around CreateGoalForm |
| Modify | `app/goals/page.tsx` | Add workspace gate around CreateGoalForm |
| Modify | `composites/create-goal-form.tsx` | Accept optional `targetLabel` prop |
| Modify | `app/layout-shell.tsx` | Initial workspace status fetch on app mount |

---

## Out of Scope

- Abstracting localStorage (v1 shortcut)
- Refactoring useSSE into event dispatcher (tech debt, not this scope)
- Workspace settings page (env vars for v1)
- Run history (requires persistent storage)
- Multi-workspace support
