import express from "express"
import cors from "cors"
import type { Express, Request, Response, NextFunction } from "express"
import type { AgentRegistry } from "../../use-cases/ports/AgentRegistry"
import type { GoalRepository } from "../../use-cases/ports/GoalRepository"
import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import type { EventStore } from "../../use-cases/ports/EventStore"
import type { CreateGoalFromCeo } from "../../use-cases/CreateGoalFromCeo"
import type { PauseAgent } from "../../use-cases/PauseAgent"
import type { LiveFloorPresenter } from "../../adapters/presenters/LiveFloorPresenter"
import type { PipelinePresenter } from "../../adapters/presenters/PipelinePresenter"
import type { MetricsPresenter } from "../../adapters/presenters/MetricsPresenter"
import type { SSEManager } from "./sseManager"
import { agentRoutes } from "./routes/agentRoutes"
import { goalRoutes } from "./routes/goalRoutes"
import { taskRoutes } from "./routes/taskRoutes"
import { eventRoutes } from "./routes/eventRoutes"
import { metricsRoutes } from "./routes/metricsRoutes"

export interface DashboardDeps {
  readonly agentRegistry: AgentRegistry
  readonly goalRepo: GoalRepository
  readonly taskRepo: TaskRepository
  readonly eventStore: EventStore
  readonly createGoal: CreateGoalFromCeo
  readonly pauseAgent: PauseAgent
  readonly liveFloor: LiveFloorPresenter
  readonly pipeline: PipelinePresenter
  readonly metrics: MetricsPresenter
  readonly sseManager: SSEManager
}

export function createServer(deps: DashboardDeps): Express {
  const app = express()

  app.use(cors())
  app.use(express.json())

  // Health check
  app.get("/api/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", timestamp: new Date().toISOString() })
  })

  // Route modules
  app.use("/api/agents", agentRoutes(deps.agentRegistry, deps.pauseAgent))
  app.use("/api/goals", goalRoutes(deps.goalRepo, deps.createGoal))
  app.use("/api/tasks", taskRoutes(deps.taskRepo))
  app.use("/api/events", eventRoutes(deps.eventStore, deps.sseManager))
  app.use("/api/metrics", metricsRoutes(deps.metrics))

  // Presenter endpoints
  app.get("/api/live-floor", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await deps.liveFloor.present()
      res.json(data)
    } catch (err) {
      next(err)
    }
  })

  app.get("/api/pipeline", async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const data = await deps.pipeline.present()
      res.json(data)
    } catch (err) {
      next(err)
    }
  })

  // Error middleware
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[HTTP]", err.message)
    res.status(500).json({ error: "Internal server error" })
  })

  return app
}
