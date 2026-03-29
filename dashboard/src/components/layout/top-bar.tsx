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
