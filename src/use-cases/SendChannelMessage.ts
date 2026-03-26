import type { ChannelMessage } from "../entities/ChannelMessage"
import type { AgentRegistry } from "./ports/AgentRegistry"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"

export class SendChannelMessage {
  constructor(
    private readonly registry: AgentRegistry,
    private readonly bus: MessagePort,
  ) {}

  async execute(channelMsg: ChannelMessage): Promise<Result<void>> {
    const agent = await this.registry.findById(channelMsg.from)
    if (!agent) {
      return failure(`Agent ${channelMsg.from} not found`)
    }

    // Phase 3: route channel messages to dashboard subscribers via bus
    void this.bus

    return success(undefined)
  }
}
