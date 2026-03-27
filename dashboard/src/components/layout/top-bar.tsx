"use client"
import { usePathname } from "next/navigation"
import { resolveIcon } from "@/lib/registry/icons"
import { useUIStore } from "@/lib/ui-store"
import { useDashboardStore } from "@/lib/store"
import { PAGE_TITLES } from "@/lib/navigation"

export function TopBar() {
  const pathname = usePathname()
  const theme = useUIStore((s) => s.theme)
  const setTheme = useUIStore((s) => s.setTheme)
  const unreadAlertCount = useDashboardStore((s) => s.unreadAlertCount)
  const title = PAGE_TITLES[pathname] ?? pathname.split("/").pop() ?? ""

  const BellIcon = resolveIcon("Bell")
  const SunIcon = resolveIcon("Sun")
  const MoonIcon = resolveIcon("Moon")

  return (
    <header
      className="flex items-center justify-between px-6 border-b border-border bg-card shrink-0"
      style={{ height: "var(--topbar-height)" }}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-text-primary">{title}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-md border border-border text-xs text-text-muted">
          Search... <kbd className="ml-2 px-1 rounded border border-border text-[10px]">&#x2318;K</kbd>
        </div>

        <button className="relative p-1.5 rounded-md hover:opacity-80 text-text-secondary">
          <BellIcon size={16} />
          {unreadAlertCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-red-500 text-white text-[9px] flex items-center justify-center">
              {unreadAlertCount}
            </span>
          )}
        </button>

        <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="p-1.5 rounded-md hover:opacity-80 text-text-secondary">
          {theme === "dark" ? <SunIcon size={16} /> : <MoonIcon size={16} />}
        </button>
      </div>
    </header>
  )
}
