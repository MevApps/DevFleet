import type { Message, MessageType } from "../../src/entities/Message"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"

export function waitForMessage(
  bus: MessagePort,
  type: MessageType,
  predicate?: (msg: Message) => boolean,
  timeoutMs: number = 5000,
): Promise<Message> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsubscribe()
      reject(new Error(`Timed out waiting for message "${type}" after ${timeoutMs}ms`))
    }, timeoutMs)

    const unsubscribe = bus.subscribe({ types: [type] }, async (msg) => {
      if (predicate && !predicate(msg)) return
      clearTimeout(timer)
      unsubscribe()
      resolve(msg)
    })
  })
}
