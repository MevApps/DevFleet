"use client"
import { useEffect } from "react"
import { Sidebar } from "@/components/layout/sidebar"
import { TopBar } from "@/components/layout/top-bar"
import { useSSE } from "@/lib/useSSE"
import { useUIStore } from "@/lib/ui-store"

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

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  )
}
