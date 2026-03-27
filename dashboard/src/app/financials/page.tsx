"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { FinancialsData } from "@/lib/types"

export default function FinancialsPage() {
  const [data, setData] = useState<FinancialsData | null>(null)
  useEffect(() => { api.financials().then(setData) }, [])
  if (!data) return <div className="text-zinc-400">Loading financials...</div>
  const avgCost = data.costPerGoal.length > 0 ? data.costPerGoal.reduce((s, g) => s + g.costUsd, 0) / data.costPerGoal.length : 0
  const agents = Object.entries(data.agentTokenBreakdown).sort((a, b) => b[1] - a[1])
  const max = agents[0]?.[1] ?? 1
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Financials</h1>
      <div className="grid grid-cols-3 gap-4">
        {[["Total Tokens", data.totalTokensUsed.toLocaleString()], ["Total Cost", `$${data.totalCostUsd.toFixed(4)}`], ["Avg Cost/Goal", `$${avgCost.toFixed(4)}`]].map(([l, v]) => (
          <div key={l} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4"><div className="text-sm text-zinc-400">{l}</div><div className="text-2xl font-bold text-white mt-1">{v}</div></div>
        ))}
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Agent Token Spend</h2>
        <div className="space-y-2">{agents.map(([agent, tokens]) => (
          <div key={agent} className="flex items-center gap-3">
            <span className="w-24 text-sm text-zinc-400 truncate">{agent}</span>
            <div className="flex-1 h-4 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-blue-500 rounded-full" style={{ width: `${(tokens / max) * 100}%` }} /></div>
            <span className="text-sm text-zinc-300 w-20 text-right">{tokens.toLocaleString()}</span>
          </div>
        ))}</div>
      </div>
    </div>
  )
}
