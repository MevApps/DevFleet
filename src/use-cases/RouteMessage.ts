import type { Message } from "../entities/Message"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"

export class RouteMessage {
  constructor(private readonly bus: MessagePort) {}

  async execute(message: Message): Promise<Result<void>> {
    try {
      await this.bus.emit(message)
      return success(undefined)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return failure(msg)
    }
  }
}
