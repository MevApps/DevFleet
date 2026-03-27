import { Router } from "express"
import type { EventStore } from "../../../use-cases/ports/EventStore"
import type { AlertPreferencesStore } from "../../../use-cases/ports/AlertPreferencesStore"
import type { CeoAlertDTO } from "../../../adapters/presenters/dto"

export function alertRoutes(eventStore: EventStore, prefsStore: AlertPreferencesStore): Router {
  const router = Router()

  router.get("/", async (_req, res, next) => {
    try {
      const events = await eventStore.findAll({ types: ["ceo.alert"], limit: 50 })
      const dtos: CeoAlertDTO[] = events.map(e => {
        const p = e.payload as Record<string, unknown>
        return {
          severity: (p.severity as string) as "info" | "warning" | "urgent",
          title: p.title as string,
          body: p.body as string,
          goalId: (p.goalId as string) ?? null,
          taskId: (p.taskId as string) ?? null,
          insightId: (p.insightId as string) ?? null,
          timestamp: e.occurredAt.toISOString(),
        }
      })
      res.json(dtos)
    } catch (err) { next(err) }
  })

  router.get("/preferences", async (_req, res, next) => {
    try {
      res.json(await prefsStore.read())
    } catch (err) { next(err) }
  })

  router.put("/preferences", async (req, res, next) => {
    try {
      await prefsStore.update(req.body)
      res.json({ status: "ok" })
    } catch (err) { next(err) }
  })

  return router
}
