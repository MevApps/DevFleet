import { Router } from "express"
import type { GoalRepository } from "../../../use-cases/ports/GoalRepository"
import type { CreateGoalFromCeo } from "../../../use-cases/CreateGoalFromCeo"
import type { WorkspaceRunManager } from "../../../use-cases/WorkspaceRunManager"
import { toGoalDTO } from "../../../adapters/presenters/mappers"

export function goalRoutes(
  goals: GoalRepository,
  createGoal: CreateGoalFromCeo,
  workspaceManager?: WorkspaceRunManager,
): Router {
  const router = Router()

  router.get("/", async (_req, res, next) => {
    try {
      const all = await goals.findAll()
      res.json({ goals: all.map(toGoalDTO) })
    } catch (err) {
      next(err)
    }
  })

  router.post("/", async (req, res, next) => {
    try {
      const body = req.body as { description?: string; maxTokens?: number; maxCostUsd?: number }
      const description = body.description ?? ""
      const maxTokens = body.maxTokens ?? 0
      const maxCostUsd = body.maxCostUsd ?? 0

      console.log("[goalRoutes] POST /goals body:", JSON.stringify(body))

      // When a workspace is active, use its CreateGoalFromCeo
      const wsCreateGoal = workspaceManager
        ? await workspaceManager.getActiveCreateGoal()
        : null
      console.log("[goalRoutes] wsCreateGoal:", wsCreateGoal ? "workspace" : "main")
      const effectiveCreateGoal = wsCreateGoal ?? createGoal

      console.log("[goalRoutes] calling execute...")
      const result = await effectiveCreateGoal.execute({ description, maxTokens, maxCostUsd })
      console.log("[goalRoutes] execute returned, ok:", result.ok)
      if (!result.ok) {
        res.status(400).json({ error: result.error })
        return
      }

      const active = workspaceManager ? await workspaceManager.findActive() : null
      res.status(201).json({
        goal: toGoalDTO(result.value),
        ...(active ? { targetedWorkspace: active.id } : {}),
      })
    } catch (err) {
      next(err)
    }
  })

  return router
}
