import type { SystemEvent } from "../../entities/Event"
import type { TaskId, GoalId } from "../../entities/ids"
import type { EventStore } from "../../use-cases/ports/EventStore"

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
}
