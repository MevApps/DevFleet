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

1. **Shell** — Three-pane layout, workspace gate, routing
2. **Floor + Stream** — Goal rows with shatter view, replacing Goals + Tasks + Live Floor
3. **Inspector** — Slide-in/pinnable entity detail, replacing entity pages
4. **Kanban + Table** — Alternate view modes, replacing Pipeline
5. **Secondary Views** — Analytics/system pages in "More" section
6. **Cleanup** — Remove old pages, routes, dead components

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

Single root route `/` with query params for view state:
- `?view=kanban` / `?view=table` (default is stream)
- `?goal=50` (filter to specific goal)
- `?inspect=task-312` (open inspector for entity)

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

Spreadsheet rows with sortable columns: Goal, Task, Phase, Status, Agent, Budget, Last Activity.

Multi-select checkboxes for bulk actions (reassign, retry, discard). Inline search/filter per column.

### Floor Header

`[Floor Title] [Stream | Kanban | Table] .................. [+ New Goal]`

`+ New Goal` opens an inline form at the top of the stream (not a modal). After submission, the new goal row appears with "Decomposing..." shimmer while the supervisor agent shatters it into tasks via SSE events.

---

## Section 3: Inspector Panel

400px right-side panel providing contextual detail for any selected entity. Replaces dedicated entity pages.

### Behavior

- **Collapsed by default** — Pane 2 gets full width
- **Opens on entity click** — Slides in (200ms ease), Pane 2 shrinks
- **Pin button** (top-right, next to close) — Pinned: stays open across entity clicks. Unpinned: auto-closes on empty floor click
- **Entity switching** — Clicking a different entity swaps content without close/reopen animation
- **Breadcrumb chain** — Top shows hierarchy: `Goal #50 > Task #312 > Agent dev-03`. Each segment clickable

### Content by Entity Type

| Entity | Inspector Shows |
|--------|----------------|
| **Goal** | Description (editable), status, budget chart (spent vs. remaining), task list with phase indicators, activity thread |
| **Task** | Status, assigned agent, phase, attempt count. Tabs: **Diff** (syntax-highlighted code), **Artifacts** (file list), **Activity** (event thread). Actions: Approve & Merge, Discard, Reassign |
| **Agent** | Role, model, current task (clickable), pause/resume toggle, recent activity log, token spend |
| **Event** | Full detail with parent chain (Event -> Task -> Goal), timestamp, cost breakdown |

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

User-created filter presets. Single row each with colored dot and label. Click applies filter to Pane 2. "+" button opens filter builder.

### "More" Section (Collapsible)

Collapsed group at bottom containing links to secondary views:
- Financials
- Quality
- Performance
- Health
- Insights

Clicking renders that page's content in Pane 2 (replacing stream/kanban/table). Back button or triage filter click returns to main floor. These pages reuse existing components — no redesign needed during migration.

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

- `ThreePaneLayout` — Root layout shell
- `FleetNavigator` — Pane 1 with triage, agents, budget, filters, "More"
- `ActiveFloor` — Pane 2 container managing view mode state
- `GoalRow` — Collapsible stream row with phase bar and shatter view
- `PhaseLanes` — Horizontal phase layout within expanded goal row
- `InspectorPanel` — Slide-in/pinnable Pane 3 with entity-type-aware content
- `InspectorBreadcrumb` — Hierarchy navigation within inspector
- `DiffViewer` — Syntax-highlighted code diff component
- `ActivityThread` — Vertical timeline of entity-scoped events
- `InlineGoalForm` — Stream-top form for new goal creation
- `FilterBar` — Goal filter chips for kanban view
- `BudgetGauge` — Compact spend visualization
- `WorkspaceGate` — Full-floor setup/boot/progress states
- `ViewModeToggle` — Segmented control for stream/kanban/table

## Components to Reuse (Existing)

- `TaskCard` — Adapt for both stream phase lanes and kanban columns
- `GoalCard` — Adapt core data display for GoalRow collapsed state
- `AgentCard` — Adapt for agent inspector content
- `StatusBadge`, `StatusDot` — Unchanged
- `ProgressBar`, `ProgressRing` — Reuse in budget gauge and goal rows
- `EntityIcon`, `TimeAgo`, `MetricValue` — Unchanged
- `KanbanColumn` — Adapt for flat kanban with goal tags
- `ActivityFeed` — Adapt into ActivityThread (filtered, vertical timeline)
- `CreateGoalForm` — Adapt into InlineGoalForm
- `WorkspaceSetupForm`, `WorkspaceBootProgress` — Adapt into WorkspaceGate
- All `/components/ui/*` primitives — Unchanged
- All `/components/charts/*` — Reused in secondary views and budget inspector

## Components to Remove (After Migration)

- `Sidebar` — Replaced by FleetNavigator
- `WorkspaceRequiredNotice` — Absorbed into WorkspaceGate
- `WorkspaceGoalLog` — Absorbed into FleetNavigator budget/goal summary
- Page-level layouts for all 11 routes — Replaced by single ThreePaneLayout

## State Management Changes

The existing `useDashboardStore` (Zustand) needs extension, not replacement:

- Add: `selectedEntityId`, `selectedEntityType`, `inspectorPinned`, `viewMode`, `activeTriageFilter`, `activeSavedFilter`
- Add: `inspectorData` (computed from selected entity)
- Keep: All existing data fetching (`fetchLiveFloor`, `fetchPipeline`, `fetchMetrics`) and SSE handling

The `useWorkspaceStore` and `useUIStore` remain as-is.

## Prototypes

Interactive HTML prototypes created during design:
- `ux-redesign.html` — Full three-pane layout with both Concept A (Modern Laboratory) and Concept B (Tactical HUD)
- `ux-kanban-options.html` — Three kanban grouping options (swimlanes, dividers, flat+filter)
- `ux-workspace-options.html` — Three workspace setup placement options (full-floor, inspector, modal)
