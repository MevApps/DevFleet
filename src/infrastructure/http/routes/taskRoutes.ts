import { Router } from "express"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import { toTaskDTO } from "../../../adapters/presenters/mappers"
import { createTaskId } from "../../../entities/ids"

export function taskRoutes(tasks: TaskRepository): Router {
  const router = Router()

  router.get("/", async (_req, res, next) => {
    try {
      const all = await tasks.findAll()
      res.json({ tasks: all.map(toTaskDTO) })
    } catch (err) {
      next(err)
    }
  })

  router.get("/:id", async (req, res, next) => {
    try {
      const task = await tasks.findById(createTaskId(req.params["id"]!))
      if (!task) {
        res.status(404).json({ error: "Task not found" })
        return
      }
      res.json({ task: toTaskDTO(task) })
    } catch (err) {
      next(err)
    }
  })

  return router
}
