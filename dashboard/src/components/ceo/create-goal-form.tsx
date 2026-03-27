"use client"
import { useState } from "react"
import { api } from "@/lib/api"
import { useDashboardStore } from "@/lib/store"

export function CreateGoalForm() {
  const [description, setDescription] = useState("")
  const [maxTokens, setMaxTokens] = useState(100_000)
  const [maxCostUsd, setMaxCostUsd] = useState(10)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setSubmitting(true); setError(null)
    try { await api.createGoal({ description, maxTokens, maxCostUsd }); setDescription(""); await fetchLiveFloor(); await fetchPipeline() }
    catch (err) { setError(err instanceof Error ? err.message : "Failed to create goal") }
    finally { setSubmitting(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Create Goal</h3>
      <div className="flex gap-3 items-end">
        <div className="flex-1">
          <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe your goal..." className="w-full px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm placeholder:text-zinc-500 focus:outline-none focus:border-zinc-500" />
        </div>
        <div className="w-32">
          <label className="text-xs text-zinc-500 block mb-1">Max tokens</label>
          <input type="number" value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className="w-full px-2 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-zinc-500" />
        </div>
        <div className="w-24">
          <label className="text-xs text-zinc-500 block mb-1">Max $ USD</label>
          <input type="number" step="0.01" value={maxCostUsd} onChange={(e) => setMaxCostUsd(Number(e.target.value))} className="w-full px-2 py-2 rounded bg-zinc-800 border border-zinc-700 text-white text-sm focus:outline-none focus:border-zinc-500" />
        </div>
        <button type="submit" disabled={submitting || !description.trim()} className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed">{submitting ? "Creating..." : "Create"}</button>
      </div>
      {error && <p className="text-xs text-red-400 mt-2">{error}</p>}
    </form>
  )
}
