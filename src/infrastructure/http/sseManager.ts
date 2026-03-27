import type { Response } from "express"
import type { MessagePort, Unsubscribe } from "../../use-cases/ports/MessagePort"
import type { Message } from "../../entities/Message"

export class SSEManager {
  private readonly clients = new Set<Response>()
  private readonly unsubscribe: Unsubscribe

  constructor(bus: MessagePort) {
    this.unsubscribe = bus.subscribe({}, async (message: Message) => {
      this.broadcast(message)
    })
  }

  addClient(res: Response): void {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    })
    this.clients.add(res)
    res.on("close", () => {
      this.clients.delete(res)
    })
  }

  get clientCount(): number {
    return this.clients.size
  }

  shutdown(): void {
    this.unsubscribe()
    this.clients.clear()
  }

  private broadcast(message: Message): void {
    const payload = { ...message, timestamp: message.timestamp.toISOString() }
    const data = JSON.stringify(payload)
    for (const client of this.clients) {
      client.write(`data:${data}\n\n`)
    }
  }
}
