"use client"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { resolveIcon } from "@/lib/registry/icons"
import { ConnectionStatus } from "@/components/primitives/connection-status"
import { useUIStore } from "@/lib/ui-store"
import { NAV_SECTIONS } from "@/lib/navigation"
import { cn } from "@/lib/utils"

export function Sidebar() {
  const pathname = usePathname()
  const connectionState = useUIStore((s) => s.connectionState)
  const collapsed = useUIStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUIStore((s) => s.toggleSidebar)

  const PanelOpenIcon = resolveIcon("PanelLeftOpen")
  const PanelCloseIcon = resolveIcon("PanelLeftClose")

  return (
    <aside
      className="flex flex-col border-r border-border bg-card transition-[width] duration-200"
      style={{ width: collapsed ? "var(--sidebar-collapsed-width)" : "var(--sidebar-width)" }}
    >
      <div className="flex items-center gap-2 p-3" style={{ height: "var(--topbar-height)" }}>
        <div className="h-7 w-7 rounded-md bg-blue-600 flex items-center justify-center text-white text-xs font-bold shrink-0">
          D
        </div>
        {!collapsed && (
          <span className="text-base font-semibold text-text-primary">DevFleet</span>
        )}
        <button onClick={toggleSidebar} className="ml-auto p-1 rounded hover:opacity-80 shrink-0 text-text-muted">
          {collapsed ? <PanelOpenIcon size={14} /> : <PanelCloseIcon size={14} />}
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="mb-4">
            {!collapsed && (
              <span className="block px-2 mb-1 text-[10px] uppercase tracking-widest text-text-muted">
                {section.title}
              </span>
            )}
            {section.items.map((item) => {
              const isActive = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)
              const Icon = resolveIcon(item.icon)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md mb-0.5 transition-colors",
                    collapsed ? "justify-center p-2" : "px-2 py-1.5",
                    isActive ? "bg-status-blue-surface text-status-blue-fg" : "text-text-secondary",
                  )}
                >
                  <Icon size={16} className="shrink-0" />
                  {!collapsed && <span className="text-sm">{item.label}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border flex items-center">
        <ConnectionStatus state={connectionState} />
        {!collapsed && <span className="ml-auto text-xs text-text-muted">&#x2318;K</span>}
      </div>
    </aside>
  )
}
