// src/components/composites/new-goal-screen.tsx
"use client"
import { useState } from "react"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import { api } from "@/lib/api"
import { ArrowUp } from "lucide-react"

export function NewGoalScreen() {
  const [description, setDescription] = useState("")
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const setActiveSection = useFloorStore((s) => s.setActiveSection)
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)

  const canSend = description.trim().length > 0 && !sending

  async function handleSend() {
    if (!canSend) return
    setSending(true)
    setError(null)
    try {
      await api.createGoal({
        description: description.trim(),
        maxTokens: 200_000,
        maxCostUsd: 5,
      })
      await Promise.all([fetchLiveFloor(), fetchPipeline()])
      setActiveSection("floor")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create goal")
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-4">
      <h1 className="text-[28px] font-bold text-text-primary mb-8">
        What would you like to build?
      </h1>

      {error && (
        <p className="text-status-red-fg text-sm mb-4">{error}</p>
      )}

      <div className="w-full max-w-[640px] relative">
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Describe your goal..."
          rows={1}
          className="w-full resize-none rounded-xl border border-border bg-bg-card px-4 py-3 pr-12 text-[15px] text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-2 focus:ring-status-purple-fg/40 transition-shadow"
          style={{ minHeight: 48, maxHeight: 200 }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement
            target.style.height = "auto"
            target.style.height = `${Math.min(target.scrollHeight, 200)}px`
          }}
          autoFocus
          disabled={sending}
        />
        <button
          onClick={handleSend}
          disabled={!canSend}
          className="absolute right-2 bottom-2 p-2 rounded-lg bg-text-primary text-text-inverse disabled:opacity-30 hover:opacity-80 transition-opacity"
          aria-label="Send"
        >
          <ArrowUp size={18} />
        </button>
      </div>
    </div>
  )
}
