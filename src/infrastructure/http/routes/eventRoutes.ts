import { Router } from "express"
import type { EventStore } from "../../../use-cases/ports/EventStore"
import type { SSEManager } from "../sseManager"
import { toEventDTO } from "../../../adapters/presenters/mappers"

export function eventRoutes(events: EventStore, sseManager: SSEManager): Router {
  const router = Router()

  router.get("/", async (_req, res, next) => {
    try {
      const all = await events.findRecent(100)
      res.json({ events: all.map(toEventDTO) })
    } catch (err) {
      next(err)
    }
  })

  router.get("/stream", (_req, res, _next) => {
    sseManager.addClient(res)
  })

  return router
}
