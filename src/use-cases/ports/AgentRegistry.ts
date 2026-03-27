import type { Agent } from "../../entities/Agent"
import type { AgentId } from "../../entities/ids"
import type { AgentRole } from "../../entities/AgentRole"

export interface AgentRegistry {
  findAvailable(role: AgentRole): Promise<Agent | null>
  findById(id: AgentId): Promise<Agent | null>
  register(agent: Agent): Promise<void>
  updateStatus(id: AgentId, status: Agent["status"], taskId?: Agent["currentTaskId"]): Promise<void>
  updateModel(id: AgentId, model: string): Promise<void>
  findAll(): Promise<ReadonlyArray<Agent>>
}
