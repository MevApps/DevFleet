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

1. **Shell** — Three-pane layout (sidebar, top bar, floor, inspector), workspace gate, routing, new stores (`useFloorStore`, `useInspectorStore`), data fetching consolidation
2. **Floor + Stream + Goal Focus** — Stream view with goal rows, Goal Focus View (stat cards + phase lanes), replacing Goals + Tasks + Live Floor. Sidebar recents list wired to goal navigation.
3. **Inspector** — Slide-in/pinnable shell + four type-specific inspectors, replacing entity pages. Includes new backend endpoint `GET /api/tasks/{id}/diff`.
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
| **Pane 1: Sidebar** | 260px, collapsible | Logo + collapse button, `+ New Goal`, search, feature links (Settings, Analytics, Health), "Recents" goal list, user section at bottom |
| **Pane 2: Active Floor** | Fluid (remaining) | Stream / Kanban / Table views, Goal Focus view, workspace setup/boot |
| **Pane 3: Inspector** | 380px, collapsed by default | Slides in on entity click. Pin button to keep open. Auto-closes when unpinned and user clicks empty floor |

### Sidebar (Pane 1) — Chat-App Style

Follows the Claude/ChatGPT sidebar pattern. Top-to-bottom layout:

1. **Header row:** DevFleet logo (icon + text) on the left, collapse/expand double-chevron button on the right. Clicking collapse hides the sidebar (width animates to 0). An expand button appears in the top bar to reopen.
2. **`+ New Goal` button:** Full-width, prominent. Keyboard shortcut `Cmd+N`.
3. **Search bar:** "Search goals..." with icon. Searches across all goals by title.
4. **Feature links:** Icon + label rows for secondary views:
   - Settings — workspace configuration
   - Analytics — Financials, Quality, Performance, Insights (renders in Pane 2)
   - Health — system health dashboard (renders in Pane 2)
   - Analytics shows a badge when new insights are available (e.g., "3 insights")
5. **Divider**
6. **"Recents" section:** Label + scrollable list of goals sorted by last activity. Each goal row shows: status dot (color-coded), title (truncated), mini phase progress bar, task count fraction, relative time. Completed goals fade to 50% opacity. Goals needing attention show a `!` badge. Goals in review show an `R` badge.
7. **User section** (bottom, above border): Avatar, username, budget display (`$42.10 / $100.00`). Click opens a popup menu: Profile, API Keys, Billing, divider, Stop Workspace (danger).

**Clicking a goal** in the sidebar navigates to the **Goal Focus View** in Pane 2 (see Section 2).

### Top Bar (48px)

No logo (lives in sidebar), no search (lives in sidebar). Contains:
- **Expand sidebar button** (only visible when sidebar is collapsed)
- **Fleet summary chips:** compact pill badges showing `4/7 agents`, `3 need attention` (amber), `$42.10 spent`
- **Right side:** Workspace status badge ("Workspace Active" green), alert bell with notification dot

### No Status Bar

Removed. Fleet summary is in the top bar chips. SSE connection state is indicated by the alert bell color (green = connected, red pulse = disconnected).

### Routing

Single root route `/`. State is split between URL (shareable) and ephemeral (session-only):

**URL state** (query params — bookmarkable, shareable):
- `?view=kanban` / `?view=table` (default is stream)
- `?goal=50` (navigates to Goal Focus View)
- `?section=analytics` (secondary view from sidebar features)

**Ephemeral state** (Zustand only — not in URL):
- Inspector open/closed, pinned state, selected entity
- Sidebar collapsed state
- Goal row expansion state (stream view)

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

### Goal Focus View — Single goal deep-dive

Activated when user clicks a goal in the sidebar (or navigates to `?goal=50`). Replaces the stream/kanban/table in Pane 2 with a dedicated goal page:

1. **Back button** (top-left chevron) — returns to the previous floor view (stream/kanban/table), preserving the view mode.
2. **Goal header** — Goal ID, status badge, full title, metadata row (created time, budget spent/total, task count), large phase progress bar (8px, color-coded segments).
3. **Stat cards** — Four compact cards in a row: Tasks (completed/total + in-progress count), Agents (count + names), Budget (spent + percentage), Duration (elapsed + avg per task).
4. **Phase lanes** — "Tasks by Phase" label, then horizontal phase columns (Planning → Implementation → Review → Done) with task cards. Arrow connectors between columns. This is the "shatter view" at full width, not constrained inside a goal row.

Clicking a task card in the phase lanes opens the Inspector (Pane 3) with that task's detail.

`viewMode` is preserved when entering Goal Focus View. Returning via the back button restores the previous view (stream/kanban/table).

### Floor Header

`[Floor Title] [Stream | Kanban | Table]`

`+ New Goal` button lives in the sidebar, not the floor header. After goal creation, the new goal appears in the sidebar's Recents list and the floor navigates to its Goal Focus View showing the "Decomposing..." state with tasks materializing in real-time via SSE events.

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

## Section 4: Sidebar (Pane 1)

A chat-app-style sidebar for goal navigation and feature access. Not a data dashboard — live fleet stats are in the top bar chips.

### Sidebar Structure

Detailed in Section 1. Key behaviors:

- **Collapsible:** Double-chevron button in sidebar header collapses to 0 width (200ms ease). Expand button appears in top bar. Collapse state stored in `useUIStore.sidebarCollapsed`.
- **Goal list ("Recents"):** Sorted by last activity, newest on top. Shows all goals from the current workspace session. Completed goals fade to 50% opacity but remain in the list. Goals with errors show amber `!` badge. Goals in review show purple `R` badge.
- **Goal click:** Navigates to the Goal Focus View in Pane 2. URL updates to `?goal={id}`. Sidebar highlights the active goal with purple background.
- **Feature links:** Settings, Analytics, Health. Clicking renders the respective page in Pane 2 (replacing current floor content). Back button or goal click returns to the floor.

### Secondary Views (Settings, Analytics, Health)

The sidebar feature links replace the old "More" collapsible section. They render existing page components in Pane 2:
- **Settings** — Workspace configuration (reuses `WorkspaceSetupForm` internals)
- **Analytics** — Financials, Quality, Performance, Insights (tabbed view reusing existing page components)
- **Health** — System health dashboard (reuses existing Health page)

**Note:** This is a **temporary shim** for Phase 5. These views are parked in the sidebar to unblock old page removal, but they deserve a future redesign pass to integrate into the Unified Command model (e.g., budget chip click → inline financials, agent click → inline performance).

---

## Section 5: Workspace Gate

Workspace is a prerequisite for all fleet operations. The UI reflects this.

### No Workspace Active

- Pane 2: Full-screen setup form — centered card with repo URL, branch selector, agent count, session budget, "Boot Workspace" button
- Pane 1: Visible but dimmed (40% opacity, non-interactive), all counts show `0`
- Pane 3: Collapsed
- Top bar badge: Amber "No Workspace"

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
- Sidebar `+ New Goal` button becomes active

### Workspace Stop/Failure

- Boot failure: Error displayed in boot card with "Retry" button
- Stopped dirty: Banner at top of Pane 2 with clone path and "Clean Up" action
- Mirrors current `WorkspaceRequiredNotice` and error states within three-pane layout

### Failure Modes

- **Boot fails on step 3 (mid-sequence):** Boot card shows the failed step highlighted in red with the error message. "Retry" button restarts from **step 1** (not mid-sequence) — partial boot state is not recoverable. A "Cancel" button returns to the setup form.
- **SSE disconnects during boot:** Boot progress freezes. After 10s, show "Connection lost — boot may still be in progress." On SSE reconnect, fetch workspace status from REST API to sync state.
- **Budget hits 100% during active session:** Top bar budget badge turns red. A non-dismissable banner appears at the top of Pane 2: "Session budget exhausted. Running tasks will complete but no new tasks will be assigned." Agents finish current work then go idle. `+ New Goal` button is disabled.
- **Workspace becomes unreachable (backend down):** All real-time data freezes. Top bar alert bell pulses red to indicate disconnection. Fleet summary chips show last-known values with a "stale" styling (muted, italic). Reconnection is automatic; once restored, a full refetch syncs state.

---

## Section 6: Critical Workflows

### Workflow A: Creating a Goal -> Watching it Shatter

1. User clicks `+ New Goal` in the sidebar (or `Cmd+N`).
2. Inline form slides open below the button in the sidebar — fields: description, budget, priority. Not a modal, not a page change.
3. User submits. Form collapses. New goal appears at the top of the sidebar Recents list. Floor navigates to the Goal Focus View for the new goal.
4. Goal Focus View shows "Decomposing..." with shimmer animation on the phase progress bar. Phase lanes are empty.
5. Supervisor agent creates tasks via SSE (`task.created`, `task.assigned`). Task cards materialize one by one into their phase lanes in real-time.
6. Decomposition completes: status badge changes to "Active", phase bar fills with colored segments, stat cards populate.
7. User clicks any task card to inspect it, or clicks another goal in the sidebar to move on.

**Zero page transitions.**

### Workflow B: Intervening on Agent Error

1. **Signal:** Top bar "need attention" chip increments. The affected goal in the sidebar Recents shows an amber `!` badge. If in Stream view, the goal row gets an amber left border.
2. **Navigate:** User clicks the errored goal in the sidebar (or notices the amber badge and clicks it). Goal Focus View opens. The errored task card in the phase lanes shows a red error badge. User clicks it.
3. **Inspect:** Inspector slides in. Status "Failed". Error block shows message, stack trace, failing agent. Activity tab shows event chain to failure.
4. **Act:** Three options:
   - **Retry** — Requeues task for same agent
   - **Reassign** — Dropdown to pick different agent
   - **Discard** — Abandons task, goal adjusts
5. **Confirm:** Task card updates in real-time via SSE. Top bar attention chip decrements. Sidebar goal badge clears if no other issues remain on that goal.

**Zero page transitions.**

---

## Components to Build (New)

- `ThreePaneLayout` — Root layout shell (flexbox container for sidebar + top bar + floor + inspector)
- `AppSidebar` — Pane 1: logo/collapse, new goal, search, feature links, recents goal list, user section with popup menu
- `GoalFocusView` — Full-floor single-goal detail: header, stat cards, phase lanes
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

- `Sidebar` — Replaced by AppSidebar
- `WorkspaceRequiredNotice` — Absorbed into WorkspaceGate
- `WorkspaceGoalLog` — Absorbed into sidebar Recents list and user section budget display
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
- `focusedGoalId`: `GoalId | null` (when set, Pane 2 shows Goal Focus View)
- `kanbanGoalFilter`: `GoalId | null`
- `expandedGoalIds`: `Set<GoalId>` (which goal rows are expanded in stream)
- `activeSection`: `'floor' | 'settings' | 'analytics' | 'health'` (what Pane 2 is showing)

`viewMode` is preserved when navigating to a secondary section or Goal Focus View. Returning to the floor restores the previous `viewMode`. When `activeSection` is not `'floor'`, `viewMode` is silently preserved but not applied — the secondary view renders in its place.

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
- `ux-sidebar-options.html` — Three sidebar options (data dashboard, chat-app, hybrid)
- `ux-sidebar-v2.html` — Refined sidebar with search, features above recents, no stat cards/tabs
- `ux-goal-focus.html` — Goal Focus View: sidebar + goal detail with phase lanes + inspector
