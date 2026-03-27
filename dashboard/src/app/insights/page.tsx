"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { InsightSummary, InsightDetail } from "@/lib/types"

export default function InsightsPage() {
  const [insights, setInsights] = useState<InsightSummary[]>([])
  const [selected, setSelected] = useState<InsightDetail | null>(null)
  const [tab, setTab] = useState("pending")
  const load = () => { api.insights(tab).then(setInsights) }
  useEffect(load, [tab])
  const onSelect = async (id: string) => { setSelected(await api.insight(id)) }
  const onAccept = async (id: string) => { await api.acceptInsight(id); setSelected(null); load() }
  const onDismiss = async (id: string) => { await api.dismissInsight(id); setSelected(null); load() }
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Insights</h1>
      <div className="flex gap-2">{["pending","applied","dismissed"].map(t => (
        <button key={t} onClick={() => setTab(t)} className={`px-3 py-1 rounded text-sm ${tab === t ? "bg-blue-600 text-white" : "bg-zinc-800 text-zinc-400"}`}>{t}</button>
      ))}</div>
      {selected ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 space-y-4">
          <button onClick={() => setSelected(null)} className="text-sm text-zinc-400 hover:text-white">&larr; Back</button>
          <h2 className="text-xl font-bold text-white">{selected.title}</h2>
          <p className="text-zinc-300">{selected.description}</p>
          <div><h3 className="text-sm font-semibold text-zinc-400 mb-1">Evidence</h3><p className="text-zinc-300 text-sm">{selected.evidence}</p></div>
          <div><h3 className="text-sm font-semibold text-zinc-400 mb-1">Proposed Change</h3><pre className="bg-zinc-950 p-2 rounded text-zinc-300 overflow-auto max-h-48 text-sm">{JSON.stringify(selected.proposedAction, null, 2)}</pre></div>
          {selected.status === "pending" && (
            <div className="flex gap-2 pt-2">
              <button onClick={() => onAccept(selected.id)} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500">Accept</button>
              <button onClick={() => onDismiss(selected.id)} className="px-4 py-2 bg-zinc-700 text-white rounded hover:bg-zinc-600">Dismiss</button>
            </div>
          )}
        </div>
      ) : insights.length === 0 ? <div className="text-zinc-500">No insights</div> : (
        <div className="space-y-2">{insights.map(i => (
          <button key={i.id} onClick={() => onSelect(i.id)} className="w-full text-left rounded-lg border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-600 transition-colors">
            <div className="flex justify-between items-center"><span className="text-white font-medium">{i.title}</span><span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">{i.actionKind}</span></div>
            <div className="text-sm text-zinc-500 mt-1">{new Date(i.createdAt).toLocaleDateString()}</div>
          </button>
        ))}</div>
      )}
    </div>
  )
}
