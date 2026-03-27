# DevFleet UI/UX Design System Specification

> Design system for a real-time operational dashboard powering an autonomous multi-agent software development platform.

## Decisions Summary

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Component library | shadcn/ui (Radix + Tailwind) | Code ownership, Tailwind-native, no lock-in |
| Charts | Recharts (via shadcn/ui chart primitives) | Integrates with token system, covers 90% of viz needs |
| Animation | Motion (formerly Framer Motion) | Layout animations for kanban, spring physics, AnimatePresence |
| Design approach | Hybrid: Entity Tokens + View Shells | Entity identity via tokens, visual variety via view patterns |
| Default density | Comfortable | Ships to users; compact as power-user toggle |
| Color mode | Dark (default) + Light | CSS custom properties, class toggle on `<html>` |
| Primary user | Single user, all hats (operator + PM + developer) | Dashboard is a Swiss Army knife |

---

## A. Foundation Layer

### A1. Color Architecture

#### Base Palette — Zinc Scale

| Token | Value | Usage |
|-------|-------|-------|
| `--bg-page` | zinc-950 `#09090b` | Page background |
| `--bg-card` | zinc-900 `#18181b` | Card / panel surfaces |
| `--border` | zinc-800 `#27272a` | Borders, dividers |
| `--bg-hover` | zinc-700 `#3f3f46` | Hover states |
| `--text-muted` | zinc-500 `#71717a` | Large text / decorative only (3.1:1) |
| `--text-secondary` | zinc-400 `#a1a1aa` | Secondary text (4.6:1 on card) |
| `--text-primary` | zinc-50 `#fafafa` | Primary text (16.8:1 on card) |

#### Status Palette — Semantic Colors (Fixed Meanings)

| Semantic Group | Color | Hue | Statuses |
|---------------|-------|-----|----------|
| Success | Green | `#22c55e` | completed, approved, merged, healthy |
| Active | Blue | `#3b82f6` | active, busy, in_progress |
| Review | Purple | `#a855f7` | review, pending_review |
| Warning | Yellow | `#eab308` | blocked, warning, degraded |
| Pending | Orange | `#f97316` | paused, queued |
| Error | Red | `#ef4444` | stopped, abandoned, discarded, failed, unhealthy |
| Neutral | Zinc | `#71717a` | idle, proposed, unknown (default fallback) |

#### Entity Hue Rotation — Categorical Colors

Algorithm: start at hue 210°, rotate by golden angle (137.5°) for maximum perceptual distance. New entities get the next hue automatically.

| Entity | Hue | Usage |
|--------|-----|-------|
| Agent | 210° | Chart series, entity icon tint, detail page accent |
| Goal | 348° | " |
| Task | 125° | " |
| Artifact | 263° | " |
| Event | 40° | " |
| Metric | 178° | " |
| Budget | 315° | " |
| Future N+1 | 93° | Auto-assigned via golden angle |

#### Three-Layer Color Rule

Every colored element uses exactly three values derived from its hue:

1. **Surface**: hue at 12% opacity — background tint
2. **Border**: hue at 25-30% opacity — edge definition
3. **Foreground**: hue at lightness 65-75% (dark) / 30-40% (light) — text and icons

This rule applies universally: status badges, entity cards, chart tooltips, and every colored component.

### A2. Design Tokens

#### Spacing Scale (4px base)

| Token | Comfortable (default) | Compact | Usage |
|-------|----------------------|---------|-------|
| `--space-1` | 4px | 2px | Icon gaps, badge padding |
| `--space-2` | 8px | 4px | Inner padding, small gaps |
| `--space-3` | 12px | 8px | Card padding, list item gaps |
| `--space-4` | 16px | 12px | Section padding, grid gaps |
| `--space-6` | 24px | 16px | Panel padding, page margins |
| `--space-8` | 32px | 24px | Section spacing, layout gaps |

#### Typography Scale

| Token | Size / Line Height | Weight | Usage |
|-------|-------------------|--------|-------|
| `--text-xs` | 11px / 1.45 | 400 | Timestamps, secondary labels, badge text |
| `--text-sm` | 13px / 1.5 | 400 | Body text, table cells, card content |
| `--text-base` | 14px / 1.5 | 400 | Primary body, nav items, form labels |
| `--text-lg` | 16px / 1.4 | 500 | Card titles, section headers |
| `--text-xl` | 20px / 1.3 | 600 | Page titles |
| `--text-2xl` | 28px / 1.2 | 700 | Hero metrics (KPI numbers) |
| `--text-mono` | 13px | 400 | JetBrains Mono — IDs, code, token counts, costs |

Font stack: Inter (system), JetBrains Mono (data).

#### Elevation

| Level | Shadow | Border | Usage |
|-------|--------|--------|-------|
| 0 | none | 1px zinc-800 | Cards, panels |
| 1 | `0 4px 12px black/30%` | 1px zinc-700 | Dropdowns, popovers |
| 2 | `0 8px 24px black/50%` | 1px zinc-700 | Modals, command palette |

#### Border Radius

| Token | Value | Usage |
|-------|-------|-------|
| `--radius-sm` | 4px | Badges, small elements |
| `--radius-md` | 6px | Inputs, buttons |
| `--radius-lg` | 8px | Cards, panels |
| `--radius-xl` | 12px | Modals, large containers |
| `--radius-full` | 9999px | Pills, status dots |

### A3. Light Mode Token Mapping

Same semantic tokens, inverted values. Toggle via class on `<html>`.

| Token | Dark | Light |
|-------|------|-------|
| `--bg-page` | zinc-950 `#09090b` | zinc-50 `#fafafa` |
| `--bg-card` | zinc-900 `#18181b` | white `#ffffff` |
| `--border` | zinc-800 `#27272a` | zinc-200 `#e4e4e7` |
| `--text-primary` | zinc-50 `#fafafa` | zinc-900 `#18181b` |
| `--text-secondary` | zinc-400 `#a1a1aa` (4.6:1) | zinc-600 `#52525b` (7:1) |
| `--text-muted` | zinc-500 `#71717a` (large only) | zinc-400 `#a1a1aa` (large only) |
| `--status-surface` | hue @ 12% opacity | hue @ 8% opacity |
| `--status-border` | hue @ 25% opacity | hue @ 20% opacity |
| `--status-fg` | hue lightness 65-75% | hue lightness 30-40% |

Implementation: CSS custom properties on `:root` (light) and `.dark` class. Tailwind v4's `@theme` directive maps to utility classes.

### A4. WCAG Compliance

All text combinations meet WCAG AA:

| Combination | Ratio | Verdict |
|-------------|-------|---------|
| Primary text on card (dark) | 16.8:1 | AA pass |
| Secondary text on card (dark) | 4.6:1 | AA pass |
| Muted text on card (dark) | 3.1:1 | Large text / decorative only |
| Primary text on card (light) | 18.4:1 | AA pass |
| Secondary text on card (light) | 7:1 | AA pass |
| Status foregrounds on status surfaces | 4.5:1+ | AA pass |

---

## B. Layout & Navigation Architecture

### B1. Page Taxonomy

| Category | Page | URL | Layout Shell |
|----------|------|-----|-------------|
| Overview | Live Floor (home) | `/` | Metrics + Grid + Feed |
| Workflow | Pipeline | `/pipeline` | Kanban horizontal scroll |
| Workflow | Goals | `/goals` | List + detail |
| Entity List | Agents | `/agents` | DataTable + filters + detail panel |
| Entity List | Tasks | `/tasks` | DataTable + filters + detail panel |
| Entity List | Events | `/events` | DataTable + filters + detail panel |
| Analytics | Financials | `/analytics/financials` | Metrics + Charts + Tables |
| Analytics | Quality | `/analytics/quality` | Metrics + Charts + Tables |
| Analytics | Performance | `/analytics/performance` | Metrics + Charts + Tables |
| System | Health | `/system/health` | Status grid + config panels |
| System | Settings | `/system/settings` | Status grid + config panels |

Detail pages: `/agents/[id]`, `/tasks/[id]`, `/goals/[id]` — opens as slide-over from list, or standalone page via direct URL.

### B2. Navigation Model — Collapsible Sidebar

- **Expanded** (default, 200px): Logo, section headers (Overview, Workflow, Entities, Analytics, System), icon + label per item, connection status + ⌘K at bottom
- **Collapsed** (48px): Icons only, tooltips on hover
- Section headers group items — 30 pages feels like 5 groups of 6
- Sections collapse independently

### B3. Top Bar

Persistent across all pages:
- Breadcrumb trail (page > entity)
- ⌘K search trigger with shortcut hint
- ConnectionStatus indicator (green dot)
- Alert bell with unread badge count
- Theme toggle (dark/light)

### B4. Responsive Strategy

| Breakpoint | Width | Sidebar | Grid | Detail Panel |
|-----------|-------|---------|------|-------------|
| Mobile | <768px | Hidden (hamburger) | 1 column | Full-screen sheet |
| Tablet | 768-1279px | Collapsed (icons) | 2 columns | Slide-over (50%) |
| Desktop | 1280-1919px | Expanded (200px) | 3-4 columns | Slide-over (40%) |
| Command Center | 1920px+ | Expanded (240px) | 4-6 columns | Inline side panel (30%) |

Mobile gets read-only monitoring (no create-goal form). Kanban scrolls horizontally at all breakpoints. Charts collapse to sparklines on mobile. MetricsRow wraps 4 → 2×2 → 1 column.

---

## C. Component Architecture

### C1. Primitive Components (Custom)

| Component | Purpose | Props | Variants |
|-----------|---------|-------|----------|
| StatusDot | Tiny circle encoding status, pulses when active | `status`, `size?: 'sm'\|'md'`, `pulse?: boolean` | — |
| StatusBadge | Pill badge with three-layer color rule | `status`, `variant?: 'pill'\|'dot-label'` | — |
| MetricValue | Single KPI with label, value, trend | `label`, `value`, `trend?`, `format?: 'number'\|'currency'\|'tokens'\|'percent'` | — |
| ProgressRing | Circular progress for budget consumption | `value (0-1)`, `size?: 'sm'\|'md'\|'lg'`, `thresholds?: {warn, critical}` | Color shifts at thresholds |
| ProgressBar | Linear progress with semantic thresholds | `value (0-1)`, `label?`, `showPercent?`, `thresholds?` | — |
| TimeAgo | Auto-updating relative timestamp | `timestamp`, `staleAfter?: ms`, `showLiveIndicator?` | Shows "stale" after threshold |
| EntityIcon | Lucide icon tinted with entity hue | `entity`, `size?: 'sm'\|'md'\|'lg'` | Three-layer tinted container |
| Skeleton | Loading placeholder matching component shape | `variant: 'line'\|'circle'\|'card'\|'chart'`, `lines?` | Shimmer animation |
| ConnectionStatus | SSE connection state indicator | `state: 'connected'\|'reconnecting'\|'disconnected'` | Pulse on connected |
| EmptyState | Zero-data view | `icon?`, `title`, `description`, `action?: {label, onClick}` | — |

### C2. Primitive Components (shadcn/ui)

Button, Dialog, DropdownMenu, Popover, Tooltip, Tabs, Sheet (slide-over), Command (palette), Table, Separator, ScrollArea, Toast — configured with the design token system.

### C3. Composite Components

| Component | Composition | Purpose |
|-----------|-------------|---------|
| AgentCard | EntityIcon + StatusBadge + TimeAgo + Button | Agent monitoring with pause/resume |
| TaskCard | EntityIcon + StatusBadge + ProgressBar | Task in pipeline with budget |
| GoalCard | EntityIcon + StatusBadge + ProgressRing + segmented ProgressBar | Goal progress across tasks |
| ArtifactCard | EntityIcon + StatusBadge + TimeAgo + Button | Work product with "View" drill-down |
| ActivityFeed | StatusDot + TimeAgo + timeline connector | Streaming event log, new items animate in |
| MetricsRow | MetricValue × N in responsive grid | Horizontal KPI strip (4 → 2×2 responsive) |
| KanbanColumn | Phase header + TaskCard[] | Pipeline phase, layout animation on phase change |
| DetailPanel | Tabs + EntityCard + ActivityFeed + Chart[] | Slide-over entity detail with tabbed sections |
| CommandPalette | shadcn Command + entity search | ⌘K universal search across all entities |

### C4. Composition Rule

```
Page       = MetricsRow + EntityCard[] + ActivityFeed + Chart[]
EntityCard = EntityIcon + StatusBadge + ProgressBar|Ring + TimeAgo + Button
DetailPanel = Tabs + EntityCard + ActivityFeed + Chart[]
New Entity = entity tokens + config → existing components render it
```

If a new page needs a new component, the system failed.

---

## D. Data Visualization Strategy

### D1. Chart Type Selection Matrix

| Data Shape | Chart Type | Recharts Component | DevFleet Use Cases |
|-----------|-----------|-------------------|-------------------|
| Time-series (cumulative) | Area chart | `AreaChart` | Budget burn, cumulative tokens, cost accumulation |
| Time-series (rate) | Line chart | `LineChart` | Tasks/hour, events/minute, throughput trends |
| Comparison (categorical) | Horizontal bar | `BarChart` | Token usage by agent, cost per goal, rejection reasons |
| Distribution | Vertical bar | `BarChart` | Phase duration distribution, retry count histogram |
| Proportion (whole) | Donut chart | `PieChart` (innerRadius) | Task status breakdown, keep/discard ratio, model tier |
| Single value (progress) | ProgressRing/Bar | Custom primitives | Budget remaining, goal completion %, keep rate |
| Single value (KPI) | MetricValue + sparkline | Custom + Sparkline | Active tasks, total cost, avg phase duration |
| Multi-phase timing | Stacked horizontal bar | `BarChart` (stacked) | Per-task phase durations, bottleneck detection |

### D2. Real-Time Animation Philosophy

| Trigger | Animation | Duration | Purpose |
|---------|-----------|----------|---------|
| New event arrives | Slide in from top + brief highlight | 300ms ease-out | Draw eye to new data |
| Status change | Color crossfade on badge/dot | 200ms ease | Show state transition |
| Task changes phase | Layout animation (card moves between columns) | 400ms spring | Show pipeline flow |
| Metric value updates | Number counter roll + trend flash | 500ms | Visible data refresh |
| Chart data point added | Line extends smoothly, area fills | 300ms ease | Continuous flow feel |
| Agent active | StatusDot pulse (glow) | 2s loop | Show liveness |
| Item removed/completed | Fade out + collapse | 250ms ease | Clean exit |

Rule: motion conveys meaning. If the animation doesn't communicate a state change, remove it. No decorative animations. All animations respect `prefers-reduced-motion`.

### D3. Systematic States

Every data-driven component handles 4 states (no per-component design):

| State | Treatment |
|-------|-----------|
| **Loading** | Skeleton shimmer matching component shape |
| **Empty** | EmptyState primitive with icon, message, optional CTA |
| **Error** | Warning icon, error message, retry button |
| **Stale** | Dashed yellow border overlay on existing content, "Last updated Xs ago" |

---

## E. Interaction Design

### E1. Information Hierarchy — 4-Tier Progressive Disclosure

| Tier | Time | What the user grasps | Components |
|------|------|---------------------|------------|
| Glance | <2s | System health (green/yellow/red), active task count, agent status dots, connection state, alert badge | StatusDot, MetricValue, ConnectionStatus |
| Scan | 5-10s | Which agents doing what, pipeline distribution, budget burn, recent events, goal progress | EntityCard grid, MetricsRow, KanbanBoard headers, ActivityFeed (top 3) |
| Explore | Hover/click | Exact values, timestamps, task details, chart data points, event payloads, agent task history | Tooltip, Popover, inline expand, chart tooltips |
| Deep Dive | Navigate | Full entity view, artifact content, analytics charts + tables, filtered event timeline, keep/discard history | DetailPanel, Sheet, dedicated pages, DataTable |

### E2. Micro-Interactions

- **Hover reveals**: Actions appear on card hover, background lifts to zinc-800
- **Toast notifications**: Bottom-right stack. Success auto-dismiss (5s). Errors persist until dismissed. Left border colored by severity.
- **Context menus**: Right-click or ⋯ button. Entity actions (view, artifacts, events, retry, discard). Keyboard shortcuts shown inline.
- **Focus ring**: 2px blue ring + glow (`box-shadow: 0 0 0 2px rgba(59,130,246,0.25)`)

### E3. Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `⌘K` | Command palette |
| `G then H` | Go to Home (Live Floor) |
| `G then P` | Go to Pipeline |
| `G then A` | Go to Agents |
| `G then G` | Go to Goals |
| `G then F` | Go to Financials |
| `J / K` | Next / Previous item in list |
| `Enter` | Open detail panel |
| `Esc` | Close panel / modal |

Vim-style navigation. "G then X" = go-to chords (like GitHub).

### E4. Real-Time UX — Communicating Liveness

| State | Indicator | Behavior |
|-------|-----------|----------|
| Connected | Green pulsing dot in top bar + "Live" label | Data streams real-time. No banner. |
| Reconnecting | Yellow banner replaces top bar status | Polling fallback activates. Stale borders on data >30s old. |
| Disconnected | Red persistent banner with "Retry now" link | All data marked stale. Timestamps freeze. Manual retry. |

**Event Pulse ("The Heartbeat")**: Every SSE event triggers a brief brightness flash on the green connection dot. User subliminally feels data flowing. If the pulse stops, something is wrong — even before reconnection logic kicks in.

---

## F. Scalability & Extensibility

### F1. Entity Registry

Single source of truth for all entity types. All components read from this.

```typescript
export const entityRegistry = {
  agent:    { hue: 210, icon: 'Bot',         label: 'Agent'    },
  goal:     { hue: 348, icon: 'Target',      label: 'Goal'     },
  task:     { hue: 125, icon: 'CheckSquare',  label: 'Task'     },
  artifact: { hue: 263, icon: 'FileCode',    label: 'Artifact' },
  event:    { hue: 40,  icon: 'Activity',    label: 'Event'    },
  metric:   { hue: 178, icon: 'BarChart3',   label: 'Metric'   },
  budget:   { hue: 315, icon: 'Wallet',      label: 'Budget'   },
  // New entity = new line. Golden angle ensures distinct hue.
}
```

Adding a new entity: add one line to the registry. EntityIcon, EntityCard, CommandPalette, chart legends, and detail panels all render it automatically.

### F2. Status Registry

```typescript
export const statusRegistry = {
  success: { color: 'green',  statuses: ['completed', 'approved', 'merged', 'healthy'] },
  active:  { color: 'blue',   statuses: ['active', 'busy', 'in_progress'] },
  review:  { color: 'purple', statuses: ['review', 'pending_review'] },
  warning: { color: 'yellow', statuses: ['blocked', 'warning', 'degraded'] },
  pending: { color: 'orange', statuses: ['paused', 'queued'] },
  error:   { color: 'red',    statuses: ['stopped', 'abandoned', 'discarded', 'failed'] },
  neutral: { color: 'zinc',   statuses: ['idle', 'proposed', 'unknown'] },
}
// Unknown status → falls back to 'neutral'. No crash, no missing color.
```

### F3. Theming Architecture

Three composable CSS layers via classes on `<html>`:

| Layer | Classes | Tokens Affected |
|-------|---------|----------------|
| Color mode | `.dark` / `.light` | `--bg-*`, `--border`, `--text-*`, `--shadow-*` |
| Density | `.density-comfortable` / `.density-compact` | `--space-*`, `--text-size-*`, `--radius-*` |
| High contrast | `.high-contrast` | Boosts foreground contrast, thickens borders |

Layers compose: `.dark.density-compact.high-contrast` = all three active.

- Color mode: top bar toggle, respects `prefers-color-scheme`, persists to localStorage
- Density: settings page toggle, defaults to comfortable, persists to localStorage
- High contrast: settings page toggle, respects `prefers-contrast: more`, persists to localStorage

### F4. File Structure

```
src/
├── app/                          # Pages (App Router)
│   ├── layout.tsx
│   ├── page.tsx                  # Live Floor
│   ├── pipeline/page.tsx
│   ├── goals/page.tsx
│   ├── agents/page.tsx
│   ├── tasks/page.tsx
│   ├── events/page.tsx
│   ├── analytics/
│   │   ├── financials/page.tsx
│   │   ├── quality/page.tsx
│   │   └── performance/page.tsx
│   └── system/
│       ├── health/page.tsx
│       └── settings/page.tsx
├── components/
│   ├── ui/                       # shadcn/ui primitives
│   │   ├── button.tsx
│   │   ├── badge.tsx
│   │   ├── dialog.tsx
│   │   └── ...
│   ├── primitives/               # Custom primitives
│   │   ├── status-dot.tsx
│   │   ├── status-badge.tsx
│   │   ├── metric-value.tsx
│   │   ├── progress-ring.tsx
│   │   ├── progress-bar.tsx
│   │   ├── time-ago.tsx
│   │   ├── entity-icon.tsx
│   │   ├── skeleton.tsx
│   │   ├── connection-status.tsx
│   │   └── empty-state.tsx
│   ├── composites/               # Built from primitives
│   │   ├── agent-card.tsx
│   │   ├── task-card.tsx
│   │   ├── goal-card.tsx
│   │   ├── artifact-card.tsx
│   │   ├── activity-feed.tsx
│   │   ├── metrics-row.tsx
│   │   ├── kanban-column.tsx
│   │   ├── detail-panel.tsx
│   │   └── command-palette.tsx
│   ├── charts/                   # Recharts wrappers
│   │   ├── area-chart.tsx
│   │   ├── bar-chart.tsx
│   │   ├── donut-chart.tsx
│   │   └── sparkline.tsx
│   └── layout/                   # Shell components
│       ├── sidebar.tsx
│       ├── top-bar.tsx
│       └── panel-shell.tsx
└── lib/
    ├── registry/                 # Entity + status configs
    │   ├── entities.ts
    │   └── statuses.ts
    ├── theme/                    # Token definitions
    │   ├── tokens.css
    │   └── colors.ts
    ├── store.ts
    ├── api.ts
    ├── types.ts
    └── useSSE.ts
```

### F5. Naming Conventions

| Element | Convention | Example |
|---------|-----------|---------|
| Files | kebab-case | `status-badge.tsx` |
| Components | PascalCase | `StatusBadge` |
| Props types | `ComponentNameProps` | `StatusBadgeProps` |
| CSS tokens | `--category-property` | `--bg-card` |
| Store hooks | `use[Domain]Store` | `useDashboardStore` |
| Custom hooks | `use[Action]` | `useSSE` |

### F6. Adding a New Page — Checklist

1. Pick category shell (overview / list / analytics / detail)
2. Create `app/[route]/page.tsx`
3. Add nav item to sidebar config
4. Compose from existing primitives + composites
5. If new entity → add to `entityRegistry`
6. If new status → add to `statusRegistry` group

No new components needed if the system is working.

---

## Design Principles (enforced throughout)

1. **Data density over decoration** — Every pixel conveys information. No hero sections, no filler.
2. **Glanceability** — System health understood in <2 seconds from overview.
3. **Progressive disclosure** — Overview → list → detail → raw. Never overwhelm.
4. **Real-time first** — The UI feels alive. Subtle motion for state changes, not static snapshots.
5. **Composable over custom** — Build from primitives. If a new screen needs a new component, the system failed.
6. **Convention over configuration** — Adding a new entity page is copy-paste-modify, not architecture.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) + React 19 |
| Styling | Tailwind CSS 4 + CSS custom properties |
| Components | shadcn/ui (Radix primitives) |
| State | Zustand 5 |
| Charts | Recharts (via shadcn/ui chart primitives) |
| Animation | Motion (formerly Framer Motion) |
| Icons | Lucide React |
| Fonts | Inter (UI) + JetBrains Mono (data) |
| Real-time | SSE (EventSource) + 10s polling fallback |
