import { Router } from "express"
import type { AgentRegistry } from "../../../use-cases/ports/AgentRegistry"
import type { PauseAgent } from "../../../use-cases/PauseAgent"
import { toAgentDTO } from "../../../adapters/presenters/mappers"
import { createAgentId } from "../../../entities/ids"
import type { AgentId } from "../../../entities/ids"

export function agentRoutes(agents: AgentRegistry, pauseAgent: PauseAgent): Router {
  const router = Router()

  router.get("/", async (_req, res, next) => {
    try {
      const all = await agents.findAll()
      res.json({ agents: all.map(toAgentDTO) })
    } catch (err) {
      next(err)
    }
  })

  router.post("/:id/pause", async (req, res, next) => {
    try {
      const agentId = createAgentId(req.params["id"]!) as AgentId
      const reason = (req.body as { reason?: string })?.reason ?? "Paused via API"
      const result = await pauseAgent.execute(agentId, reason)
      if (!result.ok) {
        res.status(404).json({ error: result.error })
        return
      }
      res.json({ status: "paused" })
    } catch (err) {
      next(err)
    }
  })

  router.post("/:id/resume", async (req, res, next) => {
    try {
      const agentId = createAgentId(req.params["id"]!) as AgentId
      const result = await pauseAgent.resume(agentId)
      if (!result.ok) {
        res.status(404).json({ error: result.error })
        return
      }
      res.json({ status: "resumed" })
    } catch (err) {
      next(err)
    }
  })

  return router
}
