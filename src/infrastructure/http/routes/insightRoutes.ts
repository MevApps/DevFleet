import { Router } from "express"
import type { InsightRepository } from "../../../use-cases/ports/InsightRepository"
import type { AcceptInsight } from "../../../use-cases/AcceptInsight"
import type { DismissInsight } from "../../../use-cases/DismissInsight"
import type { InsightId } from "../../../entities/ids"
import type { InsightSummaryDTO, InsightDetailDTO } from "../../../adapters/presenters/dto"
import type { InsightStatus } from "../../../entities/Insight"

export function insightRoutes(repo: InsightRepository, accept: AcceptInsight, dismiss: DismissInsight): Router {
  const router = Router()

  router.get("/", async (req, res, next) => {
    try {
      const status = req.query.status as InsightStatus | undefined
      const insights = status ? await repo.findByStatus(status) : await repo.findAll()
      const dtos: InsightSummaryDTO[] = insights.map(i => ({
        id: i.id,
        title: i.title,
        actionKind: i.proposedAction.kind,
        status: i.status,
        createdAt: i.createdAt.toISOString(),
      }))
      res.json(dtos)
    } catch (err) { next(err) }
  })

  router.get("/:id", async (req, res, next) => {
    try {
      const insight = await repo.findById(req.params.id as InsightId)
      if (!insight) { res.status(404).json({ error: "Not found" }); return }
      const dto: InsightDetailDTO = {
        id: insight.id,
        title: insight.title,
        description: insight.description,
        evidence: insight.evidence,
        proposedAction: insight.proposedAction,
        status: insight.status,
        createdAt: insight.createdAt.toISOString(),
        resolvedAt: insight.resolvedAt?.toISOString() ?? null,
      }
      res.json(dto)
    } catch (err) { next(err) }
  })

  router.post("/:id/accept", async (req, res, next) => {
    try {
      await accept.execute(req.params.id as InsightId)
      res.json({ status: "applied" })
    } catch (err) { next(err) }
  })

  router.post("/:id/dismiss", async (req, res, next) => {
    try {
      await dismiss.execute(req.params.id as InsightId)
      res.json({ status: "dismissed" })
    } catch (err) { next(err) }
  })

  return router
}
