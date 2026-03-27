import { Router } from "express"
import type { MetricsPresenter } from "../../../adapters/presenters/MetricsPresenter"
import type { ComputeFinancials } from "../../../use-cases/ComputeFinancials"
import type { ComputeQualityMetrics } from "../../../use-cases/ComputeQualityMetrics"
import type { ComputePhaseTimings } from "../../../use-cases/ComputePhaseTimings"
import type { MetricsFilter } from "../../../entities/MetricsFilter"
import type { GoalId, AgentId } from "../../../entities/ids"

function parseFilter(query: Record<string, unknown>): MetricsFilter | undefined {
  const filter: MetricsFilter = {}
  if (query.goalId) (filter as any).goalId = query.goalId as GoalId
  if (query.agentId) (filter as any).agentId = query.agentId as AgentId
  if (query.since) (filter as any).since = new Date(query.since as string)
  if (query.until) (filter as any).until = new Date(query.until as string)
  return Object.keys(filter).length > 0 ? filter : undefined
}

export function metricsRoutes(
  metrics: MetricsPresenter,
  financials: ComputeFinancials,
  quality: ComputeQualityMetrics,
  timings: ComputePhaseTimings,
): Router {
  const router = Router()

  router.get("/", async (_req, res, next) => {
    try {
      res.json(await metrics.present())
    } catch (err) { next(err) }
  })

  router.get("/financials", async (req, res, next) => {
    try {
      res.json(await financials.execute(parseFilter(req.query as Record<string, unknown>)))
    } catch (err) { next(err) }
  })

  router.get("/quality", async (req, res, next) => {
    try {
      res.json(await quality.execute(parseFilter(req.query as Record<string, unknown>)))
    } catch (err) { next(err) }
  })

  router.get("/timings", async (req, res, next) => {
    try {
      res.json(await timings.execute(parseFilter(req.query as Record<string, unknown>)))
    } catch (err) { next(err) }
  })

  return router
}
