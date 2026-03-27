import { create } from "zustand"
import type { AgentDTO, TaskDTO, EventDTO, GoalDTO, MetricsSummary, SSEEvent } from "./types"
import { api } from "./api"

interface DashboardState {
  agents: readonly AgentDTO[]; activeTasks: readonly TaskDTO[]; goals: readonly GoalDTO[]; recentEvents: readonly EventDTO[]; metrics: MetricsSummary | null; phases: readonly string[]; tasksByPhase: Record<string, readonly TaskDTO[]>
  fetchLiveFloor: () => Promise<void>; fetchPipeline: () => Promise<void>; fetchMetrics: () => Promise<void>; handleSSEEvent: (event: SSEEvent) => void
}

export const useDashboardStore = create<DashboardState>((set) => ({
  agents: [], activeTasks: [], goals: [], recentEvents: [], metrics: null, phases: [], tasksByPhase: {},
  fetchLiveFloor: async () => { const data = await api.liveFloor(); set({ agents: data.agents, activeTasks: data.activeTasks, recentEvents: data.recentEvents }) },
  fetchPipeline: async () => { const data = await api.pipeline(); set({ phases: data.phases, tasksByPhase: data.tasksByPhase, goals: data.goals }) },
  fetchMetrics: async () => { const metrics = await api.metrics(); set({ metrics }) },
  handleSSEEvent: (event: SSEEvent) => { set((state) => ({ recentEvents: [{ id: event.id, type: event.type, agentId: event.agentId ?? null, taskId: event.taskId ?? null, goalId: event.goalId ?? null, occurredAt: event.timestamp }, ...state.recentEvents.slice(0, 49)] })) },
}))
