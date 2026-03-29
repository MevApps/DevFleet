// src/components/composites/new-goal-screen.tsx
"use client"
import { useEffect, useRef, useState } from "react"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import { api } from "@/lib/api"
import { ArrowUp, ChevronLeft, Check, Loader2 } from "lucide-react"

type Phase = "idle" | "sending" | "success"

export function NewGoalScreen() {
  const [description, setDescription] = useState("")
  const [phase, setPhase] = useState<Phase>("idle")
  const [error, setError] = useState<string | null>(null)
  const setActiveSection = useFloorStore((s) => s.setActiveSection)
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)

  const goBack = () => setActiveSection("floor")
  const canSend = description.trim().length > 0 && phase === "idle"
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)
  const phaseRef = useRef(phase)
  phaseRef.current = phase

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && phaseRef.current === "idle") goBack()
    }
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("keydown", onKeyDown)
      clearTimeout(timerRef.current)
    }
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSend() {
    if (!canSend) return
    setPhase("sending")
    setError(null)
    try {
      await api.createGoal({
        description: description.trim(),
        maxTokens: 200_000,
        maxCostUsd: 5,
      })
      await Promise.all([fetchLiveFloor(), fetchPipeline()])
      setPhase("success")
      timerRef.current = setTimeout(() => setActiveSection("floor"), 600)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create goal")
      setPhase("idle")
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="flex flex-col items-center justify-center h-full px-4 relative">
      <button
        onClick={goBack}
        className="absolute top-0 left-0 p-1.5 rounded-lg border border-border bg-bg-card text-text-muted hover:bg-bg-hover"
        aria-label="Back to floor"
      >
        <ChevronLeft size={16} />
      </button>

      {phase === "success" ? (
        <div className="flex flex-col items-center gap-3 animate-in fade-in duration-300">
          <div className="w-10 h-10 rounded-full bg-status-green-surface flex items-center justify-center">
            <Check size={20} className="text-status-green-fg" />
          </div>
          <p className="text-[15px] text-text-secondary">Goal created — setting up pipeline...</p>
        </div>
      ) : (
        <>
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
              disabled={phase !== "idle"}
            />
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="absolute right-2 bottom-2 p-2 rounded-lg bg-text-primary text-text-inverse disabled:opacity-30 hover:opacity-80 transition-opacity"
              aria-label="Send"
            >
              {phase === "sending" ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <ArrowUp size={18} />
              )}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
