"use client"
import { useEffect } from "react"
import { useDashboardStore } from "@/lib/store"
import { useSSE } from "@/lib/useSSE"
import { KanbanBoard } from "@/components/pipeline/kanban-board"

export default function PipelinePage() {
  const { phases, tasksByPhase, goals, fetchPipeline } = useDashboardStore()
  useSSE()

  useEffect(() => {
    void fetchPipeline()
    const interval = setInterval(() => { void fetchPipeline() }, 10_000)
    return () => clearInterval(interval)
  }, [fetchPipeline])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Pipeline</h2>
      <div className="flex gap-4 text-sm text-zinc-400">
        <span>Goals: {goals.length}</span>
        <span>Active: {goals.filter(g => g.status === "active").length}</span>
      </div>
      <KanbanBoard phases={phases} tasksByPhase={tasksByPhase} />
      {goals.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Goals</h3>
          <div className="space-y-2">
            {goals.map((goal) => (
              <div key={goal.id} className="rounded border border-zinc-800 bg-zinc-900 p-3 text-sm">
                <div className="flex justify-between"><span className="text-white">{goal.description}</span><span className="text-xs text-zinc-500">{goal.status} — {goal.taskCount} tasks</span></div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
