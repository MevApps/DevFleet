import request from "supertest"
import { createServer } from "../../../src/infrastructure/http/createServer"
import { buildSystem, type DevFleetSystem } from "../../../src/infrastructure/config/composition-root"
import { createGoal } from "../../../src/entities/Goal"
import { createTask } from "../../../src/entities/Task"
import { createBudget } from "../../../src/entities/Budget"
import { createGoalId, createTaskId } from "../../../src/entities/ids"
import type { Express } from "express"

describe("API routes", () => {
  let system: DevFleetSystem
  let app: Express

  beforeEach(async () => {
    system = await buildSystem({ workspaceDir: "/tmp/test" })
    app = createServer(system.dashboardDeps)
    await system.start()
  })

  afterEach(async () => {
    await system.stop()
  })

  describe("GET /api/health", () => {
    it("returns 200", async () => {
      const res = await request(app).get("/api/health")
      expect(res.status).toBe(200)
      expect(res.body.status).toBe("ok")
    })
  })

  describe("GET /api/agents", () => {
    it("returns 7 agents", async () => {
      const res = await request(app).get("/api/agents")
      expect(res.status).toBe(200)
      expect(res.body.agents.length).toBe(7)
    })
  })

  describe("GET /api/goals", () => {
    it("returns goals", async () => {
      await system.goalRepo.create(
        createGoal({
          id: createGoalId("g-1"),
          description: "Test",
          totalBudget: createBudget({ maxTokens: 1000, maxCostUsd: 1 }),
        }),
      )
      const res = await request(app).get("/api/goals")
      expect(res.status).toBe(200)
      expect(res.body.goals).toHaveLength(1)
    })
  })

  describe("POST /api/goals", () => {
    it("creates goal", async () => {
      const res = await request(app)
        .post("/api/goals")
        .send({ description: "Build login", maxTokens: 50000, maxCostUsd: 5 })
      expect(res.status).toBe(201)
      expect(res.body.goal.status).toBe("active")
    })

    it("400 for empty desc", async () => {
      const res = await request(app)
        .post("/api/goals")
        .send({ description: "", maxTokens: 50000, maxCostUsd: 5 })
      expect(res.status).toBe(400)
    })
  })

  describe("GET /api/tasks", () => {
    it("returns tasks", async () => {
      await system.taskRepo.create(
        createTask({
          id: createTaskId("t-1"),
          goalId: createGoalId("g-1"),
          description: "A task",
          phase: "code",
          budget: createBudget({ maxTokens: 5000, maxCostUsd: 0.5 }),
        }),
      )
      const res = await request(app).get("/api/tasks")
      expect(res.status).toBe(200)
      expect(res.body.tasks).toHaveLength(1)
    })
  })

  describe("GET /api/metrics", () => {
    it("returns metrics", async () => {
      const res = await request(app).get("/api/metrics")
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("totalTokensUsed")
    })
  })

  describe("GET /api/live-floor", () => {
    it("returns live floor", async () => {
      const res = await request(app).get("/api/live-floor")
      expect(res.status).toBe(200)
      expect(res.body).toHaveProperty("agents")
    })
  })

  describe("GET /api/pipeline", () => {
    it("returns pipeline", async () => {
      const res = await request(app).get("/api/pipeline")
      expect(res.status).toBe(200)
      expect(res.body.phases).toEqual(["spec", "plan", "code", "test", "review"])
    })
  })
})
