import { Router } from "express"
import type { MetricsPresenter } from "../../../adapters/presenters/MetricsPresenter"

export function metricsRoutes(metrics: MetricsPresenter): Router {
  const router = Router()

  router.get("/", async (_req, res, next) => {
    try {
      const summary = await metrics.present()
      res.json(summary)
    } catch (err) {
      next(err)
    }
  })

  return router
}
