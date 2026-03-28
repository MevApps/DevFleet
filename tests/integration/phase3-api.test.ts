import request from "supertest"
import { createServer } from "../../src/infrastructure/http/createServer"
import { buildSystem, type DevFleetSystem } from "../../src/infrastructure/config/composition-root"
import type { Express } from "express"

describe("Phase 3 — API Integration", () => {
  let system: DevFleetSystem
  let app: Express

  beforeEach(async () => {
    system = await buildSystem({ workspaceDir: "/tmp/phase3-test", mockMode: true })
    app = createServer(system.dashboardDeps)
    await system.start()
  })

  afterEach(async () => {
    await system.stop()
  })

  it("full flow: create goal → verify agents → verify pipeline → verify metrics → pause/resume", async () => {
    // 1. Health check
    const health = await request(app).get("/api/health")
    expect(health.status).toBe(200)

    // 2. All 7 agents registered
    const agentsRes = await request(app).get("/api/agents")
    expect(agentsRes.body.agents).toHaveLength(7)
    const roles = agentsRes.body.agents.map((a: { role: string }) => a.role).sort()
    expect(roles).toEqual(["architect", "developer", "learner", "ops", "product", "reviewer", "supervisor"])

    // 3. Create goal via CEO endpoint
    const goalRes = await request(app)
      .post("/api/goals")
      .send({ description: "Build user auth", maxTokens: 100_000, maxCostUsd: 10 })
    expect(goalRes.status).toBe(201)
    expect(goalRes.body.goal.status).toBe("active")
    const goalId = goalRes.body.goal.id

    // 4. Goal appears in list
    const goalsRes = await request(app).get("/api/goals")
    expect(goalsRes.body.goals.some((g: { id: string }) => g.id === goalId)).toBe(true)

    // 5. Live floor shows agents
    const liveFloor = await request(app).get("/api/live-floor")
    expect(liveFloor.body.agents).toHaveLength(7)
    expect(liveFloor.body).toHaveProperty("activeTasks")
    expect(liveFloor.body).toHaveProperty("recentEvents")

    // 6. Pipeline shows phases
    const pipeline = await request(app).get("/api/pipeline")
    expect(pipeline.body.phases).toEqual(["spec", "plan", "code", "test", "review"])
    expect(pipeline.body).toHaveProperty("tasksByPhase")

    // 7. Metrics endpoint works
    const metrics = await request(app).get("/api/metrics")
    expect(metrics.body).toHaveProperty("totalTokensUsed")
    expect(metrics.body).toHaveProperty("activeTaskCount")
    expect(metrics.body).toHaveProperty("agentTokenBreakdown")

    // 8. Events endpoint works
    const events = await request(app).get("/api/events?limit=10")
    expect(events.body).toHaveProperty("events")

    // 9. Pause an agent
    const pauseRes = await request(app)
      .post("/api/agents/developer-1/pause")
      .send({ reason: "testing" })
    expect(pauseRes.status).toBe(200)

    const agentsAfterPause = await request(app).get("/api/agents")
    const dev = agentsAfterPause.body.agents.find((a: { id: string }) => a.id === "developer-1")
    expect(dev.status).toBe("paused")

    // 10. Resume the agent
    const resumeRes = await request(app)
      .post("/api/agents/developer-1/resume")
      .send({})
    expect(resumeRes.status).toBe(200)

    const agentsAfterResume = await request(app).get("/api/agents")
    const devAfter = agentsAfterResume.body.agents.find((a: { id: string }) => a.id === "developer-1")
    expect(devAfter.status).toBe("idle")
  })

  it("POST /api/goals rejects invalid input", async () => {
    const res = await request(app)
      .post("/api/goals")
      .send({ description: "", maxTokens: 50000, maxCostUsd: 5 })
    expect(res.status).toBe(400)
  })
})
