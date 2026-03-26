import type { Message, MessageFilter } from "../../entities/Message"
import { matchesFilter } from "../../entities/Message"
import type { MessagePort, MessageHandler, Unsubscribe } from "../../use-cases/ports/MessagePort"

interface Subscription {
  readonly filter: MessageFilter
  readonly handler: MessageHandler
}

export class InMemoryBus implements MessagePort {
  private readonly subscriptions: Subscription[] = []

  async emit(message: Message): Promise<void> {
    const matching = this.subscriptions.filter(s => matchesFilter(message, s.filter))
    await Promise.all(matching.map(s => s.handler(message)))
  }

  subscribe(filter: MessageFilter, handler: MessageHandler): Unsubscribe {
    const subscription: Subscription = { filter, handler }
    this.subscriptions.push(subscription)

    return () => {
      const index = this.subscriptions.indexOf(subscription)
      if (index !== -1) {
        this.subscriptions.splice(index, 1)
      }
    }
  }
}
