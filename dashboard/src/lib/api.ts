import type { LiveFloorData, PipelineData, MetricsSummary, GoalDTO, FinancialsData, QualityData, TimingsData, InsightSummary, InsightDetail, CeoAlertData, AlertPreferencesData, PluginHealth, WorkspaceStartInput, WorkspaceStatusDTO } from "./types"
const BASE = "/api"
async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json() as Promise<T>
}
function toQuery(params?: Record<string, string>): string {
  if (!params) return ""
  const qs = new URLSearchParams(params).toString()
  return qs ? `?${qs}` : ""
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
  financials: (filter?: Record<string, string>) => get<FinancialsData>("/metrics/financials" + toQuery(filter)),
  quality: (filter?: Record<string, string>) => get<QualityData>("/metrics/quality" + toQuery(filter)),
  timings: (filter?: Record<string, string>) => get<TimingsData>("/metrics/timings" + toQuery(filter)),
  insights: (status?: string) => get<InsightSummary[]>("/insights" + (status ? `?status=${status}` : "")),
  insight: (id: string) => get<InsightDetail>(`/insights/${id}`),
  acceptInsight: (id: string) => post<{ status: string }>(`/insights/${id}/accept`, {}),
  dismissInsight: (id: string) => post<{ status: string }>(`/insights/${id}/dismiss`, {}),
  alerts: () => get<CeoAlertData[]>("/alerts"),
  alertPreferences: () => get<AlertPreferencesData>("/alerts/preferences"),
  updateAlertPreferences: (prefs: AlertPreferencesData) => fetch(`${BASE}/alerts/preferences`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(prefs) }).then(r => r.json() as Promise<{ status: string }>),
  systemHealth: () => get<PluginHealth[]>("/system/health"),
  workspaceStart: (config: WorkspaceStartInput) => post<{ runId: string }>("/workspace/start", config),
  workspaceStatus: () => get<WorkspaceStatusDTO>("/workspace/status"),
  workspaceStop: () => post<{ status: string; clonePath?: string }>("/workspace/stop", {}),
  workspaceCleanup: () => post<{ status: string }>("/workspace/cleanup", {}),
}
