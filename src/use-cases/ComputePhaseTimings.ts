import type { EventStore } from "./ports/EventStore"
import type { TaskRepository } from "./ports/TaskRepository"
import type { MetricsFilter } from "../entities/MetricsFilter"
import type { TimingsReport } from "../entities/Reports"

const STALL_THRESHOLD_MS = 120_000

export class ComputePhaseTimings {
  constructor(
    private readonly events: EventStore,
    private readonly tasks: TaskRepository,
  ) {}

  async execute(filter?: MetricsFilter): Promise<TimingsReport> {
    const allEvents = await this.events.findAll()
    const allTasks = await this.tasks.findAll()
    const taskPhase = new Map<string, string>()
    for (const t of allTasks) {
      if (filter?.goalId && t.goalId !== filter.goalId) continue
      taskPhase.set(t.id, t.phase)
    }

    const assigned = new Map<string, Date>()
    const durations = new Map<string, number[]>()
    const tokensByAgent = new Map<string, { tokens: number; tasks: number }>()

    for (const event of allEvents) {
      if (event.type === "task.assigned" && event.taskId) {
        assigned.set(event.taskId, event.occurredAt)
      }
      if (event.type === "task.completed" && event.taskId) {
        const start = assigned.get(event.taskId)
        const phase = taskPhase.get(event.taskId)
        if (start && phase) {
          const dur = event.occurredAt.getTime() - start.getTime()
          const arr = durations.get(phase) ?? []
          arr.push(dur)
          durations.set(phase, arr)
        }
        if (event.agentId && event.cost) {
          const key = event.agentId as string
          const entry = tokensByAgent.get(key) ?? { tokens: 0, tasks: 0 }
          entry.tokens += event.cost.totalTokens
          entry.tasks++
          tokensByAgent.set(key, entry)
        }
      }
    }

    const avgDurationByPhase: Record<string, number> = {}
    const stalledPhases: Array<{ phase: string; avgMs: number; threshold: number }> = []
    for (const [phase, durs] of durations) {
      const avg = durs.reduce((a, b) => a + b, 0) / durs.length
      avgDurationByPhase[phase] = avg
      if (avg > STALL_THRESHOLD_MS) {
        stalledPhases.push({ phase, avgMs: avg, threshold: STALL_THRESHOLD_MS })
      }
    }

    const agentEfficiency: Record<string, number> = {}
    for (const [agent, data] of tokensByAgent) {
      agentEfficiency[agent] = data.tasks > 0 ? data.tokens / data.tasks : 0
    }

    return { avgDurationByPhase, stalledPhases, agentEfficiency }
  }
}
