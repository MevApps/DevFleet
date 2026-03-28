import { Router } from "express"
import type { WorkspaceRunManager } from "../../../use-cases/WorkspaceRunManager"
import type { WorkspaceRunRepository } from "../../../use-cases/ports/WorkspaceRunRepository"
import { DEFAULT_WORKSPACE_CONFIG } from "../../../entities/WorkspaceRun"

export function workspaceRoutes(
  manager: WorkspaceRunManager,
  repo: WorkspaceRunRepository,
): Router {
  const router = Router()

  router.post("/start", async (req, res, next) => {
    try {
      const body = req.body as {
        repoUrl?: string
        maxCostUsd?: number
        maxTokens?: number
        supervisorModel?: string
        developerModel?: string
        reviewerModel?: string
        timeoutMs?: number
      }

      if (!body.repoUrl) {
        res.status(400).json({ error: "repoUrl is required" })
        return
      }

      const config = {
        repoUrl: body.repoUrl,
        maxCostUsd: body.maxCostUsd ?? DEFAULT_WORKSPACE_CONFIG.maxCostUsd,
        maxTokens: body.maxTokens ?? DEFAULT_WORKSPACE_CONFIG.maxTokens,
        supervisorModel: body.supervisorModel ?? DEFAULT_WORKSPACE_CONFIG.supervisorModel,
        developerModel: body.developerModel ?? DEFAULT_WORKSPACE_CONFIG.developerModel,
        reviewerModel: body.reviewerModel ?? DEFAULT_WORKSPACE_CONFIG.reviewerModel,
        timeoutMs: body.timeoutMs ?? DEFAULT_WORKSPACE_CONFIG.timeoutMs,
      }

      const result = await manager.startRun(config)
      if (!result.ok) {
        res.status(409).json({ error: result.error })
        return
      }
      res.status(201).json({ runId: result.value })
    } catch (err) {
      next(err)
    }
  })

  router.get("/status", async (_req, res, next) => {
    try {
      const active = await manager.findActive()
      if (!active) {
        res.status(404).json({ error: "No active workspace" })
        return
      }
      const run = await repo.findById(active.id)
      if (!run) {
        res.status(500).json({ error: "Run not found in repository" })
        return
      }
      res.json({ run })
    } catch (err) {
      next(err)
    }
  })

  router.get("/active", async (_req, res, next) => {
    try {
      const active = await manager.findActive()
      if (!active) {
        res.json({ active: false })
        return
      }
      res.json({ active: true, runId: active.id, repoUrl: active.config.repoUrl })
    } catch (err) {
      next(err)
    }
  })

  router.post("/stop", async (_req, res, next) => {
    try {
      const active = await manager.findActive()
      if (!active) {
        res.status(404).json({ error: "No active workspace" })
        return
      }
      await manager.stop(active.id, false)
      res.json({ status: "stopped" })
    } catch (err) {
      next(err)
    }
  })

  router.post("/cleanup", async (_req, res, next) => {
    try {
      const stoppedDirty = await repo.findByStatus("stopped_dirty")
      if (!stoppedDirty) {
        res.status(404).json({ error: "No stopped_dirty workspace to cleanup" })
        return
      }
      const result = await manager.cleanup(stoppedDirty.id)
      if (!result.ok) {
        res.status(400).json({ error: result.error })
        return
      }
      res.json({ status: "stopped" })
    } catch (err) {
      next(err)
    }
  })

  return router
}
