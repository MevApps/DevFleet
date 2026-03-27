"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { AgentDTO, PluginHealth, TimingsData } from "@/lib/types"

const STATUS_COLORS: Record<string, string> = { idle: "text-green-400", busy: "text-blue-400", blocked: "text-yellow-400", paused: "text-zinc-500", stopped: "text-red-400" }
const HEALTH_COLORS: Record<string, string> = { healthy: "text-green-400", degraded: "text-yellow-400", unhealthy: "text-red-400" }

export default function SystemPage() {
  const [agents, setAgents] = useState<AgentDTO[]>([])
  const [plugins, setPlugins] = useState<PluginHealth[]>([])
  const [timings, setTimings] = useState<TimingsData | null>(null)
  useEffect(() => { api.liveFloor().then(d => setAgents([...d.agents])); api.systemHealth().then(setPlugins); api.timings().then(setTimings) }, [])
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">System Health</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{agents.map(a => (
        <div key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-900 p-3">
          <div className="text-sm font-medium text-white">{a.role}</div>
          <div className={`text-xs mt-1 ${STATUS_COLORS[a.status] ?? "text-zinc-400"}`}>{a.status}</div>
          <div className="text-xs text-zinc-500 mt-1">Model: {a.model}</div>
        </div>
      ))}</div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold text-white mb-3">Plugin Status</h2>
        <div className="space-y-1">{plugins.map(p => (
          <div key={p.name} className="flex justify-between text-sm py-1 border-b border-zinc-800 last:border-0"><span className="text-zinc-300">{p.name}</span><span className={HEALTH_COLORS[p.status] ?? "text-zinc-400"}>{p.status}</span></div>
        ))}</div>
      </div>
      {timings && Object.keys(timings.avgDurationByPhase).length > 0 && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-lg font-semibold text-white mb-3">Phase Timings</h2>
          <div className="space-y-1">{Object.entries(timings.avgDurationByPhase).map(([phase, ms]) => (
            <div key={phase} className="flex justify-between text-sm"><span className="text-zinc-300">{phase}</span><span className="text-zinc-400">{(ms / 1000).toFixed(1)}s avg</span></div>
          ))}</div>
        </div>
      )}
    </div>
  )
}
