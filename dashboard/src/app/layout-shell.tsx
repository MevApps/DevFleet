"use client"
import { useEffect } from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { TopBar } from "@/components/layout/top-bar"
import { InspectorPanel } from "@/components/layout/inspector-panel"
import { WorkspaceGate } from "@/components/composites/workspace-gate"
import { useSSE } from "@/lib/useSSE"
import { useUIStore } from "@/lib/ui-store"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { api } from "@/lib/api"

export function LayoutShell({ children }: { children: React.ReactNode }) {
  useSSE()
  const theme = useUIStore((s) => s.theme)

  useEffect(() => {
    document.documentElement.classList.remove("dark", "light")
    document.documentElement.classList.add(theme)
    localStorage.setItem("devfleet-theme", theme)
  }, [theme])

  useEffect(() => {
    const saved = localStorage.getItem("devfleet-theme") as "dark" | "light" | null
    if (saved) useUIStore.getState().setTheme(saved)
  }, [])

  useEffect(() => {
    api.workspaceStatus()
      .then(useWorkspaceStore.getState().setStatus)
      .catch(() => useWorkspaceStore.getState().clear())
  }, [])

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-auto p-6">
            <WorkspaceGate>
              {() => children}
            </WorkspaceGate>
          </main>
          <InspectorPanel />
        </div>
      </div>
    </div>
  )
}
