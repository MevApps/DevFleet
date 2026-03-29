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
