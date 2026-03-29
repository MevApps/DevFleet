// src/app/layout-shell.tsx
"use client"
import { useEffect, useRef } from "react"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { TopBar } from "@/components/layout/top-bar"
import { InspectorPanel } from "@/components/layout/inspector-panel"
import { WorkspaceGate } from "@/components/composites/workspace-gate"
import { useSSE } from "@/lib/useSSE"
import { useUIStore } from "@/lib/ui-store"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { useDashboardStore } from "@/lib/store"
import { useFloorStore } from "@/lib/floor-store"
import { api } from "@/lib/api"

function logFetchError(label: string) {
  return (e: unknown) => console.error(`[LayoutShell] ${label} failed`, e)
}

export function LayoutShell({ children }: { children: React.ReactNode }) {
  useSSE()
  const theme = useUIStore((s) => s.theme)
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)
  const fetchMetrics = useDashboardStore((s) => s.fetchMetrics)
  const fetchAlerts = useDashboardStore((s) => s.fetchAlerts)
  const wsRun = useWorkspaceStore((s) => s.run)
  const hasAutoNavigated = useRef(false)

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

  // Consolidated data fetch when workspace is active
  useEffect(() => {
    if (wsRun?.status === "active") {
      fetchLiveFloor().catch(logFetchError("fetchLiveFloor"))
      fetchPipeline()
        .then(() => {
          if (!hasAutoNavigated.current && useDashboardStore.getState().goals.length === 0) {
            hasAutoNavigated.current = true
            useFloorStore.getState().setActiveSection("new-goal")
          }
        })
        .catch(logFetchError("fetchPipeline"))
      fetchMetrics().catch(logFetchError("fetchMetrics"))
      fetchAlerts().catch(logFetchError("fetchAlerts"))
    }
  }, [wsRun?.status, fetchLiveFloor, fetchPipeline, fetchMetrics, fetchAlerts])

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
