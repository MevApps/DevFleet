import type { AgentRegistry } from "./ports/AgentRegistry"
import type { MessagePort } from "./ports/MessagePort"
import { createMessageId } from "../entities/ids"

export class DetectStuckAgent {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly bus: MessagePort,
  ) {}

  async execute(timeoutMs: number, now: Date = new Date()): Promise<void> {
    const agents = await this.registry.findAll()

    for (const agent of agents) {
      if (agent.status !== "busy" || !agent.currentTaskId) continue

      const elapsed = now.getTime() - agent.lastActiveAt.getTime()
      if (elapsed > timeoutMs) {
        await this.bus.emit({
          id: createMessageId(),
          type: "agent.stuck",
          agentId: agent.id,
          taskId: agent.currentTaskId,
          reason: `No activity for ${Math.round(elapsed / 1000)}s (timeout: ${Math.round(timeoutMs / 1000)}s)`,
          retryCount: 0,
          timestamp: new Date(),
        })
      }
    }
  }
}
