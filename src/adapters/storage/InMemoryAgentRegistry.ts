import type { Agent } from "../../entities/Agent"
import type { AgentId } from "../../entities/ids"
import type { AgentRole } from "../../entities/AgentRole"
import type { AgentRegistry } from "../../use-cases/ports/AgentRegistry"

export class InMemoryAgentRegistry implements AgentRegistry {
  private readonly store = new Map<string, Agent>()

  async findAvailable(role: AgentRole): Promise<Agent | null> {
    for (const agent of this.store.values()) {
      if (agent.role === role && agent.status === "idle") {
        return agent
      }
    }
    return null
  }

  async findById(id: AgentId): Promise<Agent | null> {
    return this.store.get(id) ?? null
  }

  async register(agent: Agent): Promise<void> {
    this.store.set(agent.id, agent)
  }

  async updateStatus(
    id: AgentId,
    status: Agent["status"],
    taskId?: Agent["currentTaskId"],
  ): Promise<void> {
    const agent = this.store.get(id)
    if (!agent) {
      throw new Error(`Agent ${id} not found`)
    }
    this.store.set(id, {
      ...agent,
      status,
      currentTaskId: taskId !== undefined ? taskId : agent.currentTaskId,
    })
  }

  async findAll(): Promise<ReadonlyArray<Agent>> {
    return [...this.store.values()]
  }
}
