import type { AgentRegistry } from "./ports/AgentRegistry"
import type { MessagePort } from "./ports/MessagePort"
import type { AgentId } from "../entities/ids"
import { createMessageId } from "../entities/ids"
import { success, failure, type Result } from "./Result"

export class PauseAgent {
  constructor(
    private readonly agents: AgentRegistry,
    private readonly bus: MessagePort,
  ) {}

  async execute(agentId: AgentId, reason: string): Promise<Result<void>> {
    const agent = await this.agents.findById(agentId)
    if (!agent) return failure(`Agent ${agentId} not found`)
    await this.agents.updateStatus(agentId, "paused")
    await this.bus.emit({ id: createMessageId(), type: "agent.paused", agentId, reason, timestamp: new Date() })
    return success(undefined)
  }

  async resume(agentId: AgentId): Promise<Result<void>> {
    const agent = await this.agents.findById(agentId)
    if (!agent) return failure(`Agent ${agentId} not found`)
    if (agent.status !== "paused") return failure(`Agent ${agentId} is not paused (status: ${agent.status})`)
    await this.agents.updateStatus(agentId, "idle")
    await this.bus.emit({ id: createMessageId(), type: "agent.resumed", agentId, timestamp: new Date() })
    return success(undefined)
  }
}
