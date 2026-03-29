# Phase 5+6: Secondary Views + Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire existing analytics/system pages into the sidebar's secondary view slots (Settings, Analytics, Health), then remove all dead code: old pages, old sidebar, old navigation config, and unused components.

**Architecture:** `ActiveFloor` gains three secondary section branches that lazy-import the existing page content. A `SecondaryViewWrapper` provides a consistent back-button header. Then cleanup: delete 11 old page routes, the old Sidebar component, navigation.ts, and unused composites (WorkspaceRequiredNotice, WorkspaceGoalLog, ActivityFeed). No new components — just wiring and deletion.

**Tech Stack:** Next.js 15, React 19, Tailwind CSS 4, Vitest

**Spec:** `docs/superpowers/specs/2026-03-29-unified-command-redesign.md` (Sections 4, 6)

**Depends on:** Phase 1-4b merged to master

---

## File Map

### New Files
| File | Responsibility |
|------|---------------|
| `src/components/composites/secondary-view-wrapper.tsx` | Back-button header wrapper for secondary views |

### Modified Files
| File | Change |
|------|--------|
| `src/components/composites/active-floor.tsx` | Replace secondary placeholder with real pages |

### Deleted Files (Cleanup)
| File | Reason |
|------|--------|
| `src/components/layout/sidebar.tsx` | Replaced by AppSidebar |
| `src/lib/navigation.ts` | NAV_SECTIONS/PAGE_TITLES no longer used |
| `src/app/agents/page.tsx` | Absorbed into Stream/Inspector |
| `src/app/tasks/page.tsx` | Absorbed into Stream/Kanban/Table |
| `src/app/events/page.tsx` | Absorbed into Inspector ActivityThread |
| `src/app/goals/page.tsx` | Absorbed into Stream/GoalFocus |
| `src/app/pipeline/page.tsx` | Absorbed into Kanban view |
| `src/app/workspace/page.tsx` | Absorbed into WorkspaceGate |
| `src/components/composites/workspace-required-notice.tsx` | Absorbed into WorkspaceGate |
| `src/components/composites/workspace-goal-log.tsx` | Absorbed into sidebar Recents + budget |
| `src/components/composites/activity-feed.tsx` | Replaced by ActivityThread |

---

## Task 1: Create `SecondaryViewWrapper`

**Files:**
- Create: `src/components/composites/secondary-view-wrapper.tsx`

- [ ] **Step 1: Write the implementation**

```typescript
// src/components/composites/secondary-view-wrapper.tsx
"use client"
import { useFloorStore } from "@/lib/floor-store"
import { ChevronLeft } from "lucide-react"

interface SecondaryViewWrapperProps {
  title: string
  children: React.ReactNode
}

export function SecondaryViewWrapper({ title, children }: SecondaryViewWrapperProps) {
  const setActiveSection = useFloorStore((s) => s.setActiveSection)

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 pb-3 border-b border-border">
        <button
          onClick={() => setActiveSection("floor")}
          className="p-1.5 rounded-lg border border-border bg-bg-card text-text-muted hover:bg-bg-hover shrink-0"
          aria-label="Back to floor"
        >
          <ChevronLeft size={16} />
        </button>
        <h1 className="text-[16px] font-bold text-text-primary">{title}</h1>
      </div>
      {children}
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx vitest run && npx next build`
Expected: Pass

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/composites/secondary-view-wrapper.tsx
git commit -m "feat(secondary): add SecondaryViewWrapper — back button header for secondary views"
```

---

## Task 2: Wire Secondary Views into ActiveFloor

**Files:**
- Modify: `src/components/composites/active-floor.tsx`

- [ ] **Step 1: Add imports and replace secondary placeholder**

Add imports at top of `active-floor.tsx`:

```typescript
import { SecondaryViewWrapper } from "./secondary-view-wrapper"
import { lazy, Suspense } from "react"
```

Add lazy imports below the regular imports:

```typescript
// Lazy-load secondary views to avoid bundling them in the main floor chunk
const FinancialsPage = lazy(() => import("@/app/financials/page"))
const QualityPage = lazy(() => import("@/app/quality/page"))
const PerformancePage = lazy(() => import("@/app/analytics/performance/page"))
const SystemPage = lazy(() => import("@/app/system/page"))
const InsightsPage = lazy(() => import("@/app/insights/page"))
```

Find and replace the secondary sections placeholder block at the bottom:

```typescript
  // Secondary sections — placeholder, Phase 5 will render existing pages here
  return (
    <div>
      <p className="text-sm text-text-muted">
        {activeSection} view will be implemented in Phase 5.
      </p>
    </div>
  )
```

Replace with:

```typescript
  // Secondary views from sidebar feature links
  if (activeSection === "analytics") {
    return (
      <SecondaryViewWrapper title="Analytics">
        <Suspense fallback={<p className="text-sm text-text-muted">Loading...</p>}>
          <div className="space-y-6">
            <FinancialsPage />
            <QualityPage />
            <PerformancePage />
          </div>
        </Suspense>
      </SecondaryViewWrapper>
    )
  }

  if (activeSection === "health") {
    return (
      <SecondaryViewWrapper title="System Health">
        <Suspense fallback={<p className="text-sm text-text-muted">Loading...</p>}>
          <SystemPage />
        </Suspense>
      </SecondaryViewWrapper>
    )
  }

  if (activeSection === "settings") {
    return (
      <SecondaryViewWrapper title="Settings">
        <Suspense fallback={<p className="text-sm text-text-muted">Loading...</p>}>
          <InsightsPage />
        </Suspense>
      </SecondaryViewWrapper>
    )
  }

  return null
```

- [ ] **Step 2: Run all tests and build**

Run: `cd dashboard && npx vitest run && npx next build`
Expected: Pass. The lazy imports reference existing page files that export default components.

- [ ] **Step 3: Commit**

```bash
git add dashboard/src/components/composites/active-floor.tsx
git commit -m "feat(secondary): wire Analytics, Health, Settings into ActiveFloor via sidebar"
```

---

## Task 3: Delete Dead Pages

**Files to delete:**
- `src/app/agents/page.tsx` (and `src/app/agents/` directory)
- `src/app/tasks/page.tsx` (and `src/app/tasks/` directory)
- `src/app/events/page.tsx` (and `src/app/events/` directory)
- `src/app/goals/page.tsx` (and `src/app/goals/` directory)
- `src/app/pipeline/page.tsx` (and `src/app/pipeline/` directory)
- `src/app/workspace/page.tsx` (and `src/app/workspace/` directory)

These pages are superseded by: Stream view (goals, tasks), Kanban view (pipeline), Inspector (agents, events), WorkspaceGate (workspace).

**Keep alive** (used by secondary views):
- `src/app/financials/page.tsx` — lazy-imported by ActiveFloor
- `src/app/quality/page.tsx` — lazy-imported by ActiveFloor
- `src/app/analytics/performance/page.tsx` — lazy-imported by ActiveFloor
- `src/app/system/page.tsx` — lazy-imported by ActiveFloor
- `src/app/insights/page.tsx` — lazy-imported by ActiveFloor

- [ ] **Step 1: Delete dead page directories**

```bash
rm -rf src/app/agents src/app/tasks src/app/events src/app/goals src/app/pipeline src/app/workspace
```

- [ ] **Step 2: Verify build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds — no imports reference these deleted pages

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "cleanup: remove 6 dead page routes (agents, tasks, events, goals, pipeline, workspace)"
```

---

## Task 4: Delete Dead Components

**Files to delete:**
- `src/components/layout/sidebar.tsx` — replaced by AppSidebar
- `src/lib/navigation.ts` — NAV_SECTIONS/PAGE_TITLES no longer imported
- `src/components/composites/workspace-required-notice.tsx` — absorbed into WorkspaceGate
- `src/components/composites/workspace-goal-log.tsx` — absorbed into sidebar Recents
- `src/components/composites/activity-feed.tsx` — replaced by ActivityThread

- [ ] **Step 1: Verify nothing imports these files**

```bash
grep -r "layout/sidebar" src/ --include="*.tsx" --include="*.ts" | grep -v "app-sidebar" | grep -v "sidebar.tsx"
grep -r "navigation" src/ --include="*.tsx" --include="*.ts" | grep -v "next/navigation" | grep -v "navigation.ts"
grep -r "workspace-required-notice" src/ --include="*.tsx" --include="*.ts" | grep -v "workspace-required-notice.tsx"
grep -r "workspace-goal-log" src/ --include="*.tsx" --include="*.ts" | grep -v "workspace-goal-log.tsx"
grep -r "activity-feed" src/ --include="*.tsx" --include="*.ts" | grep -v "activity-feed.tsx"
```

Each command should return empty (no imports from other files).

- [ ] **Step 2: Delete the files**

```bash
rm src/components/layout/sidebar.tsx
rm src/lib/navigation.ts
rm src/components/composites/workspace-required-notice.tsx
rm src/components/composites/workspace-goal-log.tsx
rm src/components/composites/activity-feed.tsx
```

- [ ] **Step 3: Run all tests and build**

Run: `cd dashboard && npx vitest run && npx next build`
Expected: All tests pass, build succeeds. If any test references a deleted file, fix the import.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "cleanup: remove dead components — old Sidebar, navigation, unused composites"
```

---

## Task 5: Full Verification

- [ ] **Step 1: Run all tests**

Run: `cd dashboard && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Run the build**

Run: `cd dashboard && npx next build`
Expected: Build succeeds

- [ ] **Step 3: Verify secondary views**

Open `http://localhost:3000` and verify:
- Click "Analytics" in sidebar → Analytics view renders with Financials + Quality + Performance
- Click "Health" in sidebar → System Health page renders
- Click "Settings" in sidebar → Insights page renders
- Back button returns to Active Floor (preserves view mode)
- All three view modes (Stream/Kanban/Table) still work
- Goal Focus view still works via sidebar click
- Inspector still works via task card click

- [ ] **Step 4: Verify old routes are gone**

Navigate to `/goals`, `/tasks`, `/agents`, `/pipeline`, `/workspace`, `/events` — should show 404 or the root ActiveFloor (depends on Next.js fallback behavior).

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: Phase 5+6 complete — secondary views wired, dead code removed"
```
