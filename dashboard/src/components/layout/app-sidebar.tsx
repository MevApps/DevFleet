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
      style={{ width: collapsed ? "0px" : "var(--sidebar-width)" }}
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
          <kbd className="ml-auto text-[10px] px-1 py-0.5 rounded border border-border text-text-muted">⌘N</kbd>
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
