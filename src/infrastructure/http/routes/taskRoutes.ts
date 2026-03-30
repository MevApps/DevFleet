import { Router } from "express"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import { toTaskDTO } from "../../../adapters/presenters/mappers"
import { createTaskId, createMessageId } from "../../../entities/ids"
import type { Message } from "../../../entities/Message"

export function taskRoutes(tasks: TaskRepository, bus: MessagePort): Router {
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

  router.post("/:taskId/retry", async (req, res, next) => {
    try {
      const { taskId } = req.params as { taskId: string }
      const { hint } = req.body as { hint?: string }

      if (!hint || !hint.trim()) {
        res.status(400).json({ error: "hint is required" })
        return
      }

      const message: Message = {
        id: createMessageId(),
        type: "task.retry",
        taskId: createTaskId(taskId),
        hint: hint.trim(),
        timestamp: new Date(),
      }
      await bus.emit(message)

      res.json({ ok: true })
    } catch (err) {
      next(err)
    }
  })

  return router
}
