# DevFleet Unified Command Redesign

**Date:** 2026-03-29
**Status:** Approved
**Philosophy:** "One river, many depths" — every goal flows left-to-right through the system; you zoom in by clicking, never by navigating away.

## Problem

The current dashboard is an 11-page "Database View" spread across 5 navigation sections (Overview, Workflow, Entities, Analytics, System). Information about a single goal is fragmented across Goals, Tasks, Agents, Events, and Pipeline pages. Users cannot see the relationship between a high-level Goal and its moving parts without constant page-hopping.

## Solution

Replace the multi-page architecture with a **three-pane Unified Command layout** using the "Modern Laboratory" visual language (Concept A): clean, high-density, professional, light background with soft semantic colors.

## Visual Language: Modern Laboratory

- **Background:** `zinc-50` (light) / `zinc-950` (dark)
- **Typography:** Inter for UI, JetBrains Mono for code/IDs
- **Colors:** Muted semantic palette — soft green (healthy), soft amber (attention), soft red (error), soft purple (review). No saturated colors except intentional CTAs.
- **Cards:** White with `zinc-200` borders. Hover raises with `shadow-md`.
- **Progress bars:** Thin (4px-6px), rounded, softly colored fills with phase segments.
- **Motion:** Subtle. 200ms ease for panel transitions. No animations on data updates — values change with a gentle 1s highlight flash.
- **Density:** Comfortable by default (16px body, 24px row padding). Compact mode available (14px/16px).

## Migration Strategy: Shell First, Migrate Inward

Build the three-pane shell as the new root layout. Migrate content piece by piece, keeping old pages as fallbacks until fully absorbed. Six phases:

1. **Shell** — Three-pane layout, workspace gate, routing, new stores (`useFloorStore`, `useInspectorStore`), data fetching consolidation
2. **Floor + Stream** — Goal rows with shatter view, replacing Goals + Tasks + Live Floor
3. **Inspector** — Slide-in/pinnable shell + four type-specific inspectors, replacing entity pages
4a. **Kanban** — Flat kanban with goal filter chips, replacing Pipeline
4b. **Table** — Dense table with bulk actions and virtualization (can ship independently after 4a)
5. **Secondary Views** — Analytics/system pages in "More" section (temporary shim — these need a future redesign pass)
6. **Cleanup** — Remove old pages, routes, dead components, `ActivityFeed`, `GoalCard`, `Sidebar`
7. **(Future)** Saved filters, analytics integration into Inspector, table advanced features

---

## Section 1: Layout Shell & Navigation

### Three-Pane Root Layout

| Pane | Width | Content |
|------|-------|---------|
| **Pane 1: Fleet Navigator** | 220px fixed | Live triage counts, agent pool, budget gauge, saved filters, collapsible "More" section |
| **Pane 2: Active Floor** | Fluid (remaining) | Stream / Kanban / Table views. Workspace setup/boot when no workspace active |
| **Pane 3: Inspector** | 400px, collapsed by default | Slides in on entity click. Pin button to keep open. Auto-closes when unpinned and user clicks empty floor |

### Top Bar (48px)

Logo, `Cmd+K` command palette, workspace status badge, alert bell with notification dot, user avatar.

### Status Bar (32px)

SSE connection indicator, active/blocked goal counts, agent count, session spend, last event timestamp. Monospace font.

### Routing

Single root route `/`. State is split between URL (shareable) and ephemeral (session-only):

**URL state** (query params — bookmarkable, shareable):
- `?view=kanban` / `?view=table` (default is stream)
- `?goal=50` (filter to specific goal)
- `?section=financials` (secondary view from "More")

**Ephemeral state** (Zustand only — not in URL):
- Inspector open/closed, pinned state, selected entity
- Goal row expansion state
- Saved filter selection

Rationale: Inspector state is transient navigation context, not a destination. A shared URL like `?inspect=task-312` would break if the task is discarded or the recipient lacks access. View mode and goal filter are stable destinations worth bookmarking.

Old routes (`/goals`, `/tasks`, `/agents`, `/pipeline`, etc.) redirect to `/` with appropriate params during migration, then get removed in the cleanup phase.

---

## Section 2: Active Floor & View Modes

Three mutually exclusive view modes, toggled via segmented control in the floor header.

### Stream (default) — Goal-centric, real-time feed

Each goal is a single row, sorted by last activity (newest top).

**Collapsed row:** Chevron, goal ID, title, phase progress bar (colored segments: green=done, blue=active, purple=review, gray=queued), task count fraction, budget, relative time, status badge.

**Expanded row ("shatter view"):** Task cards arranged in horizontal phase lanes (Planning -> Implementation -> Review -> Done) with arrow connectors. Each task card: name, assigned agent tag, time, thin progress bar.

**Signal vs. Noise:**
- Goals needing attention: amber left border, badge reads "1 Blocked" or "Error"
- Completed goals: fade to 60% opacity, collapse automatically
- Pane 1 triage filters control which goals appear
- Review tasks assigned to current user: purple accent, "Awaiting YOU" label

### Kanban — Phase-centric, pipeline flow

Four columns: Planning, Implementation, Review, Done.

Tasks are **flat** (not grouped by goal). Each task card shows a colored goal tag for context. Filter bar at top with goal chips to isolate a single goal's tasks.

Kanban is **read-only** — task phase transitions are agent-driven. No drag-and-drop.

### Table — Bulk operations, dense data

**Deferred to Phase 4b.** Stream and Kanban ship first. Table view is specced here for completeness but is not required for the core three-pane migration (Phases 1-3).

Spreadsheet rows with sortable columns: Goal, Task, Phase, Status, Agent, Budget, Last Activity.

**Selection model:** Checkbox per row. "Select all visible" toggle in header. Selection persists across sorting/filtering but clears on view mode switch.

**Bulk actions:** Toolbar appears above table when 1+ rows selected. Actions: Reassign (dropdown), Retry, Discard. Each action shows a confirmation dialog listing affected tasks by name. Actions are **not transactional** — each task is processed independently. Results shown as a summary toast: "8 retried, 2 failed (rate limited)" with a "View failures" link that filters the table to failed items.

**Column filtering:** Text input in each column header. Filters compose with AND logic. No inline filter builder beyond text match — complex filtering uses Saved Filters from Pane 1.

**Virtualization:** Required for 100+ goals. Use `@tanstack/react-virtual` (already compatible with the stack). Render only visible rows + 20-row overscan buffer.

### Floor Header

`[Floor Title] [Stream | Kanban | Table] .................. [+ New Goal]`

`+ New Goal` opens an inline form at the top of the stream (not a modal). After submission, the new goal row appears with "Decomposing..." shimmer while the supervisor agent shatters it into tasks via SSE events.

### Failure Modes

- **SSE disconnects mid-shatter:** Goal row shows "Decomposing..." with a stale timer. After 30s without an SSE event, show a warning badge: "Connection lost — updates paused." Reconnection (handled by `useSSE`) automatically resumes. No manual refresh needed.
- **Goal creation API fails:** Inline form shows error inline below submit button. Form stays open with user's input preserved.
- **Stream has 0 goals after workspace boot:** Empty state in Pane 2: "No goals yet — create one to get started" with a prominent `+ New Goal` CTA.
- **Kanban filter selects a goal with 0 tasks in a phase:** Empty column shows "No tasks" in muted text. Column does not collapse or disappear.

---

## Section 3: Inspector Panel

400px right-side panel providing contextual detail for any selected entity. Replaces dedicated entity pages.

### Behavior

- **Collapsed by default** — Pane 2 gets full width
- **Opens on entity click** — Slides in (200ms ease), Pane 2 shrinks
- **Pin button** (top-right, next to close) — Pinned: stays open across entity clicks. Unpinned: auto-closes on empty floor click
- **Entity switching** — Clicking a different entity swaps content without close/reopen animation
- **Breadcrumb chain** — Top shows hierarchy: `Goal #50 > Task #312 > Agent dev-03`. Each segment clickable

### Architecture: Shell + Strategy

`InspectorPanel` is the **shell only** — slide-in animation, pin/close buttons, breadcrumb bar. It delegates rendering to a type-specific inspector component via strategy pattern:

- `GoalInspector` — Description (editable), status, budget chart (spent vs. remaining), task list with phase indicators, activity thread
- `TaskInspector` — Status, assigned agent, phase, attempt count. Tabs: **Diff**, **Artifacts**, **Activity**. Status-adaptive action buttons.
- `AgentInspector` — Role, model, current task (clickable), pause/resume toggle, recent activity log, token spend
- `EventInspector` — Full detail with parent chain (Event -> Task -> Goal), timestamp, cost breakdown

`InspectorPanel` selects the component based on `entityType` — no switch statements, no polymorphic blob. Each inspector is an independent file with its own concerns.

### Diff Tab (Task Inspector)

Syntax-highlighted code changes. Split into file sections with `+line/-line` counts per file header. Read-only — user reviews then acts via buttons below.

### Activity Tab (All Entity Types)

Vertical timeline of events filtered to that entity. Each event: colored dot (green=complete, blue=assigned, purple=review, red=error), one-line description, monospace timestamp. Dots connected by vertical line. Most recent at top. Replaces the standalone `/events` page for entity-scoped history.

### Action Buttons (Task Inspector)

Buttons adapt to task status:

**When task is in review:**
- **Approve & Merge** (primary, dark) — Merges branch, marks task complete
- **Discard** (danger, red outline) — Discards branch, marks task discarded
- **Reassign** (secondary, neutral) — Dropdown to pick a different agent

**When task has failed:**
- **Retry** (primary, dark) — Requeues task for same agent
- **Reassign** (secondary, neutral) — Dropdown to pick a different agent
- **Discard** (danger, red outline) — Abandons task, goal adjusts

### Failure Modes

- **Inspector loads a deleted/discarded entity:** Show a "Not Found" state inside the panel: "This [task/goal/agent] no longer exists" with a "Close" button. Do not auto-close — the user needs to understand what happened.
- **Approve & Merge fails (branch conflicts):** Error block appears above the action buttons: "Merge failed: branch has conflicts. Resolve manually or reassign." Retry and Reassign buttons remain active. Approve & Merge is disabled until the conflict is resolved.
- **Breadcrumb entity no longer exists:** Stale breadcrumb segment shows strikethrough styling. Clicking it shows the "Not Found" state.
- **Diff tab has no changes:** Show "No code changes" empty state. This can happen for planning/spec tasks that produce documents, not code.

---

## Section 4: Fleet Navigator (Pane 1)

A live data dashboard, not a nav menu. Filters and summarizes fleet state.

### Triage Section

Four filterable rows controlling the Stream view:

| Row | Dot Color | Meaning |
|-----|-----------|---------|
| Active | Blue | Goals currently being worked on |
| Needs Attention | Amber | Goals with blocked/failed tasks |
| In Review | Purple | Goals with tasks awaiting review |
| Completed Today | Green | Goals finished in current session |

Clicking a row filters the Stream. Active filter highlighted with purple background. Click again to deselect (show all).

### Agent Pool

Three rows: Busy (green), Idle (gray), Blocked (red) with counts. Clicking a row opens a popover listing agents in that state. Clicking an agent opens it in the Inspector.

### Budget Gauge

Compact card: "Session Spend" label, large dollar amount, thin progress bar (spend vs. session budget). Click opens budget breakdown in Inspector.

### Saved Filters

**Deferred to Phase 5 or later.** Not required for the core three-pane migration. The triage section (Active, Needs Attention, In Review, Completed Today) covers the critical filtering needs. Saved filters add value at scale (50+ goals) but introduce scope: filter model, persistence (localStorage vs. backend), filter builder UI, composition logic. Spec these when the core layout is proven.

Until then, Pane 1 shows only the four triage rows and the goal filter chips in Kanban view.

### "More" Section (Collapsible)

Collapsed group at bottom containing links to secondary views:
- Financials
- Quality
- Performance
- Health
- Insights

Clicking renders that page's content in Pane 2 (replacing stream/kanban/table). Back button or triage filter click returns to main floor. These pages reuse existing components — no redesign needed during migration.

**Note:** This is a **temporary shim** for Phase 5. These views are parked here to unblock the old page removal, but they deserve their own redesign pass to integrate into the Unified Command model (e.g., budget gauge click -> inline financials in Inspector, agent click -> inline performance metrics). A future phase should evaluate which analytics belong inline (embedded in Inspector/Floor) vs. which need their own full-floor view.

---

## Section 5: Workspace Gate

Workspace is a prerequisite for all fleet operations. The UI reflects this.

### No Workspace Active

- Pane 2: Full-screen setup form — centered card with repo URL, branch selector, agent count, session budget, "Boot Workspace" button
- Pane 1: Visible but dimmed (40% opacity, non-interactive), all counts show `0`
- Pane 3: Collapsed
- Top bar badge: Amber "No Workspace"
- Status bar: "Workspace inactive — boot to begin"

### During Boot

- Pane 2: Boot progress card with step-by-step checklist:
  1. Cloning repository
  2. Installing dependencies
  3. Detecting project structure
  4. Spawning agents
  5. Running health checks
- Each step: status icon (done/active/pending), label, elapsed time
- Progress bar at bottom fills as steps complete
- Top bar badge: Blue "Booting..." with spinner
- Pane 1: Remains dimmed

### Workspace Active

- Pane 2: Active Floor (Stream view, empty until goals created)
- Pane 1: Interactive, counts populate as goals/agents come online
- Top bar badge: Green "Workspace Active"
- `+ New Goal` button appears in floor header

### Workspace Stop/Failure

- Boot failure: Error displayed in boot card with "Retry" button
- Stopped dirty: Banner at top of Pane 2 with clone path and "Clean Up" action
- Mirrors current `WorkspaceRequiredNotice` and error states within three-pane layout

### Failure Modes

- **Boot fails on step 3 (mid-sequence):** Boot card shows the failed step highlighted in red with the error message. "Retry" button restarts from **step 1** (not mid-sequence) — partial boot state is not recoverable. A "Cancel" button returns to the setup form.
- **SSE disconnects during boot:** Boot progress freezes. After 10s, show "Connection lost — boot may still be in progress." On SSE reconnect, fetch workspace status from REST API to sync state.
- **Budget hits 100% during active session:** Top bar budget badge turns red. A non-dismissable banner appears at the top of Pane 2: "Session budget exhausted. Running tasks will complete but no new tasks will be assigned." Agents finish current work then go idle. `+ New Goal` button is disabled.
- **Workspace becomes unreachable (backend down):** All real-time data freezes. Status bar SSE indicator shows red "Disconnected". Pane 1 counts show last-known values with a "stale" indicator. Reconnection is automatic; once restored, a full refetch syncs state.

---

## Section 6: Critical Workflows

### Workflow A: Creating a Goal -> Watching it Shatter

1. User clicks `+ New Goal` (or `Cmd+K` -> "new goal")
2. Inline form slides open at top of stream — fields: description, budget, priority. Not a modal.
3. User submits. Form collapses into new goal row at top of stream.
4. Row shows "Decomposing..." with shimmer animation on phase bar.
5. Supervisor agent creates tasks via SSE (`task.created`, `task.assigned`). Row auto-expands. Task cards materialize one by one into phase lanes in real-time.
6. Decomposition completes: badge changes to "Active", phase bar fills with colored segments.
7. User collapses and moves on, or clicks any task to inspect.

**Zero page transitions.**

### Workflow B: Intervening on Agent Error

1. **Signal:** Pane 1 "Needs Attention" count increments. Affected goal row gets amber left border. Task card shows red error badge.
2. **Navigate:** User clicks "Needs Attention" in Pane 1 to filter stream. Expands goal, clicks errored task card.
3. **Inspect:** Inspector slides in. Status "Failed". Error block shows message, stack trace, failing agent. Activity tab shows event chain to failure.
4. **Act:** Three options:
   - **Retry** — Requeues task for same agent
   - **Reassign** — Dropdown to pick different agent
   - **Discard** — Abandons task, goal adjusts
5. **Confirm:** Task card updates in real-time via SSE. Pane 1 attention count decrements if no other issues remain.

**Zero page transitions.**

---

## Components to Build (New)

- `ThreePaneLayout` — Root layout shell (flexbox container for three panes + top/status bars)
- `FleetNavigator` — Pane 1 with triage, agents, budget, "More"
- `ActiveFloor` — Pane 2 container managing view mode state
- `GoalRow` — Collapsible stream row with phase bar; delegates expanded content to `PhaseLanes`
- `PhaseLanes` — Horizontal phase layout within expanded goal row
- `InspectorPanel` — Slide-in/pinnable Pane 3 **shell only** (animation, pin/close, breadcrumb). Delegates to type-specific inspectors
- `GoalInspector` — Inspector content for goals (description, budget chart, task list, activity)
- `TaskInspector` — Inspector content for tasks (diff, artifacts, activity, action buttons)
- `AgentInspector` — Inspector content for agents (status, current task, activity)
- `EventInspector` — Inspector content for events (detail, parent chain, cost)
- `InspectorBreadcrumb` — Hierarchy navigation within inspector shell
- `DiffViewer` — Syntax-highlighted code diff component
- `ActivityThread` — Vertical timeline of entity-scoped events (replaces `ActivityFeed`)
- `InlineGoalForm` — Stream-top inline form for new goal creation
- `GoalFormFields` — Shared form fields extracted from `CreateGoalForm`, used by both `InlineGoalForm` and `CreateGoalForm`
- `useGoalDisplay` — Hook extracting shared goal data-formatting (budget display, status mapping) from `GoalCard`
- `FilterBar` — Goal filter chips for kanban view
- `BudgetGauge` — Compact spend visualization
- `WorkspaceGate` — Full-floor setup/boot/progress states (composes existing `WorkspaceSetupForm` + `WorkspaceBootProgress`)
- `ViewModeToggle` — Segmented control for stream/kanban/table

## Components to Reuse (Existing)

Each entry specifies the reuse strategy: **extend** (add props, backward compatible), **wrap** (new component delegates to existing), or **replace** (new component, old removed in cleanup).

- `TaskCard` — **Extend.** Add optional `goalTag` prop (colored goal chip) for kanban context. Add optional `compact` prop for stream phase lanes (smaller padding, no progress bar). Existing usage in pipeline unchanged.
- `GoalCard` — **Replace.** The new `GoalRow` has fundamentally different layout (horizontal row with phase bar vs. vertical card with progress ring). Extract shared data-formatting logic (budget display, status mapping) into a `useGoalDisplay` hook. Remove `GoalCard` in cleanup.
- `AgentCard` — **Wrap.** New `AgentInspector` wraps `AgentCard`'s core data display and adds inspector-specific UI (pause/resume toggle, activity thread, task link). `AgentCard` continues to work standalone for the agent pool popover.
- `StatusBadge`, `StatusDot` — **Unchanged.**
- `ProgressBar`, `ProgressRing` — **Unchanged.** Used directly in `BudgetGauge` and `GoalRow`.
- `EntityIcon`, `TimeAgo`, `MetricValue` — **Unchanged.**
- `KanbanColumn` — **Extend.** Currently groups tasks by phase. Add optional `filterGoalId` prop to filter cards. Add `goalTag` rendering to child task cards.
- `ActivityFeed` — **Replace.** New `ActivityThread` is entity-scoped (filtered to one goal/task/agent) with vertical dot-line timeline layout. Current `ActivityFeed` is a flat global feed. Different enough to warrant a new component. Remove `ActivityFeed` in cleanup.
- `CreateGoalForm` — **Wrap.** New `InlineGoalForm` wraps the form fields from `CreateGoalForm` but changes the container (inline slide-down in stream vs. standalone card). Extract form fields into a shared `GoalFormFields` component used by both.
- `WorkspaceSetupForm`, `WorkspaceBootProgress` — **Wrap.** New `WorkspaceGate` composes these existing components within the full-floor layout. They continue to own their form logic and boot step rendering.
- All `/components/ui/*` primitives — **Unchanged.**
- All `/components/charts/*` — **Unchanged.** Reused in secondary views and budget inspector.

## Components to Remove (After Migration)

- `Sidebar` — Replaced by FleetNavigator
- `WorkspaceRequiredNotice` — Absorbed into WorkspaceGate
- `WorkspaceGoalLog` — Absorbed into FleetNavigator budget/goal summary
- Page-level layouts for all 11 routes — Replaced by single ThreePaneLayout

## State Management

Split into **four focused stores** (Zustand). Each store has a single reason to change.

### `useDashboardStore` (existing — data only, no UI state)

Keep as-is. This store owns fleet data and API communication:
- `agents`, `activeTasks`, `goals`, `recentEvents`, `metrics`
- `phases`, `tasksByPhase`
- `alerts`, `unreadAlertCount`
- Methods: `fetchLiveFloor()`, `fetchPipeline()`, `fetchMetrics()`, `handleSSEEvent()`, `fetchAlerts()`

No UI state added here. This store is the **data layer**.

### `useFloorStore` (new — Active Floor UI state)

- `viewMode`: `'stream' | 'kanban' | 'table'`
- `activeTriageFilter`: `'active' | 'attention' | 'review' | 'completed' | null`
- `kanbanGoalFilter`: `GoalId | null`
- `expandedGoalIds`: `Set<GoalId>` (which goal rows are expanded in stream)
- `activeSection`: `'floor' | 'financials' | 'quality' | 'performance' | 'health' | 'insights'` (what Pane 2 is showing)

### `useInspectorStore` (new — Inspector UI state)

- `selectedEntityId`: `string | null`
- `selectedEntityType`: `'goal' | 'task' | 'agent' | 'event' | null`
- `pinned`: `boolean`
- `breadcrumbs`: `Array<{ id: string, type: string, label: string }>`
- Methods: `open(id, type)`, `close()`, `togglePin()`, `pushBreadcrumb()`, `navigateBreadcrumb(index)`

### `useWorkspaceStore` and `useUIStore` (existing — unchanged)

Remain as-is.

## Data Fetching Strategy

### Root Layout Mount

On mount, the root layout calls:
1. `fetchLiveFloor()` — populates goals, agents, active tasks, metrics (needed by all three panes)
2. SSE connection via `useSSE()` — real-time updates for all entity types

This replaces the per-page fetch pattern. One fetch on mount, SSE keeps everything current.

### View Mode Switches

- **Stream -> Kanban:** No additional fetch. Kanban reads from the same `goals` + `activeTasks` data. `tasksByPhase` is already computed in the store.
- **Stream -> Table:** No additional fetch. Table renders from the same data with different layout.
- **Floor -> "More" section (e.g., Financials):** Triggers the relevant fetch (`fetchMetrics()`, etc.) on demand. Data is cached in the store — subsequent visits don't refetch unless stale.

### Inspector Opens

Inspector data is **derived from existing store data**, not fetched separately:
- Goal inspector: reads from `goals` array in `useDashboardStore`
- Task inspector: reads from `activeTasks` + filters `recentEvents` by task ID
- Agent inspector: reads from `agents` + filters `recentEvents` by agent ID

**Exception:** The Diff tab content (code changes) requires a new API endpoint: `GET /api/tasks/{id}/diff`. This is fetched on-demand when the Diff tab is selected and cached in component state (not the store — it's view-specific).

### SSE Event Handling

The existing `handleSSEEvent()` in `useDashboardStore` already triggers refetches based on event type. This continues to work — the three-pane layout simply subscribes to the same store. No changes to SSE handling needed.

### Polling

Remove per-page polling hooks (`usePolling`). The SSE stream replaces polling for real-time updates. Fallback: if SSE disconnects for >30s, start a 10s polling interval on `fetchLiveFloor()` until SSE reconnects.

## Prototypes

Interactive HTML prototypes created during design:
- `ux-redesign.html` — Full three-pane layout with both Concept A (Modern Laboratory) and Concept B (Tactical HUD)
- `ux-kanban-options.html` — Three kanban grouping options (swimlanes, dividers, flat+filter)
- `ux-workspace-options.html` — Three workspace setup placement options (full-floor, inspector, modal)
