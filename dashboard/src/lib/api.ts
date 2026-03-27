import type { LiveFloorData, PipelineData, MetricsSummary, GoalDTO } from "./types"
const BASE = "/api"
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<T>
}
async function post<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
  if (!res.ok) { const err = await res.json().catch(() => ({ error: res.statusText })); throw new Error((err as { error: string }).error) }
  return res.json() as Promise<T>
}
export const api = {
  liveFloor: () => get<LiveFloorData>("/live-floor"),
  pipeline: () => get<PipelineData>("/pipeline"),
  metrics: () => get<MetricsSummary>("/metrics"),
  createGoal: (input: { description: string; maxTokens: number; maxCostUsd: number }) => post<{ goal: GoalDTO }>("/goals", input),
  pauseAgent: (agentId: string, reason: string) => post<{ status: string }>(`/agents/${agentId}/pause`, { reason }),
  resumeAgent: (agentId: string) => post<{ status: string }>(`/agents/${agentId}/resume`, {}),
}
