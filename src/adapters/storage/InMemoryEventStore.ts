import type { SystemEvent } from "../../entities/Event"
import type { TaskId, GoalId } from "../../entities/ids"
import type { EventStore, EventQueryOptions } from "../../use-cases/ports/EventStore"

export class InMemoryEventStore implements EventStore {
  private readonly events: SystemEvent[] = []

  async append(event: SystemEvent): Promise<void> {
    this.events.push(event)
  }

  async findByTaskId(taskId: TaskId): Promise<ReadonlyArray<SystemEvent>> {
    return this.events.filter(e => e.taskId === taskId)
  }

  async findByGoalId(goalId: GoalId): Promise<ReadonlyArray<SystemEvent>> {
    return this.events.filter(e => e.goalId === goalId)
  }

  async findAll(options?: EventQueryOptions): Promise<ReadonlyArray<SystemEvent>> {
    let results: SystemEvent[] = [...this.events]

    if (options?.types && options.types.length > 0) {
      const typeSet = new Set(options.types)
      results = results.filter(e => typeSet.has(e.type))
    }

    if (options?.agentId) {
      results = results.filter(e => e.agentId === options.agentId)
    }

    const offset = options?.offset ?? 0
    const limit = options?.limit ?? results.length

    return results.slice(offset, offset + limit)
  }

  async findRecent(limit: number): Promise<ReadonlyArray<SystemEvent>> {
    return [...this.events]
      .sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
      .slice(0, limit)
  }

  async countAll(): Promise<number> {
    return this.events.length
  }
}
