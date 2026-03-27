import type { AgentRegistry } from "../../use-cases/ports/AgentRegistry"
import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import type { EventStore } from "../../use-cases/ports/EventStore"
import type { LiveFloorDTO } from "./dto"
import { toAgentDTO, toTaskDTO, toEventDTO } from "./mappers"

const ACTIVE_STATUSES = new Set(["queued", "in_progress", "review"])

export class LiveFloorPresenter {
  constructor(
    private readonly agents: AgentRegistry,
    private readonly tasks: TaskRepository,
    private readonly events: EventStore,
  ) {}

  async present(): Promise<LiveFloorDTO> {
    const [agents, allTasks, recentEvents] = await Promise.all([
      this.agents.findAll(),
      this.tasks.findAll(),
      this.events.findRecent(50),
    ])
    const activeTasks = allTasks.filter(t => ACTIVE_STATUSES.has(t.status))
    return {
      agents: agents.map(toAgentDTO),
      activeTasks: activeTasks.map(toTaskDTO),
      recentEvents: recentEvents.map(toEventDTO),
    }
  }
}
