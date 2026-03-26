import { buildSystem, type DevFleetSystem } from "../../src/infrastructure/config/composition-root"
import { createGoal } from "../../src/entities/Goal"
import { createGoalId, createMessageId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import { waitForMessage } from "../helpers/waitForMessage"
import type { Message } from "../../src/entities/Message"

describe("Phase 2 End-to-End", () => {
  let system: DevFleetSystem

  beforeEach(async () => {
    system = await buildSystem({
      workspaceDir: process.cwd(),
      // No API key → uses MockAIProvider
    })
    await system.start()
  })

  afterEach(async () => {
    await system.stop()
  })

  it("happy path: goal → decompose → spec → plan → code → build → review → merge → complete", async () => {
    // Collect all messages for debugging
    const messages: Message[] = []
    system.bus.subscribe({}, async (msg) => { messages.push(msg) })

    const goalId = createGoalId("e2e-goal")
    const goal = createGoal({
      id: goalId,
      description: "Add a hello world endpoint",
      totalBudget: createBudget({ maxTokens: 500_000, maxCostUsd: 50.0 }),
      status: "active",
    })
    await system.goalRepo.create(goal)

    // Set up message waiter BEFORE emitting
    const goalCompleted = waitForMessage(system.bus, "goal.completed", undefined, 30_000)

    // Emit goal.created to kick off the pipeline
    await system.bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId,
      description: goal.description,
      timestamp: new Date(),
    })

    // Wait for the full pipeline to complete
    const completedMsg = await goalCompleted
    expect(completedMsg.type).toBe("goal.completed")

    // Verify the pipeline produced expected message types
    const types = messages.map(m => m.type)

    // Tasks were created (decomposed from goal)
    expect(types.filter(t => t === "task.created").length).toBeGreaterThanOrEqual(5)

    // Tasks were assigned to agents
    expect(types.filter(t => t === "task.assigned").length).toBeGreaterThanOrEqual(5)

    // Code was completed (developer produced code)
    expect(types).toContain("code.completed")

    // Build passed (ops ran build/tests)
    expect(types).toContain("build.passed")

    // Review approved (reviewer approved the code)
    expect(types).toContain("review.approved")

    // Branch was merged
    expect(types).toContain("branch.merged")

    // Goal completed
    expect(types).toContain("goal.completed")
  }, 60_000)

  it("verifies all 7 agents are registered", async () => {
    const agents = await system.agentRegistry.findAll()
    expect(agents).toHaveLength(7)

    const roles = agents.map(a => a.role).sort()
    expect(roles).toEqual([
      "architect", "developer", "learner", "ops", "product", "reviewer", "supervisor",
    ])
  })

  it("verifies pipeline config has correct phase-role mapping", async () => {
    // The system should have created tasks in all pipeline phases
    const goalId = createGoalId("e2e-phases")
    const goal = createGoal({
      id: goalId,
      description: "Test pipeline phases",
      totalBudget: createBudget({ maxTokens: 500_000, maxCostUsd: 50.0 }),
      status: "active",
    })
    await system.goalRepo.create(goal)

    const goalCompleted = waitForMessage(system.bus, "goal.completed", undefined, 30_000)

    await system.bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId,
      description: goal.description,
      timestamp: new Date(),
    })

    await goalCompleted

    // Check that tasks were created for all phases
    const tasks = await system.taskRepo.findByGoalId(goalId)
    expect(tasks.length).toBeGreaterThanOrEqual(5)

    const phases = tasks.map(t => t.phase)
    expect(phases).toContain("spec")
    expect(phases).toContain("plan")
    expect(phases).toContain("code")
    expect(phases).toContain("test")
    expect(phases).toContain("review")
  }, 60_000)

  it("creates artifacts during pipeline execution", async () => {
    const goalId = createGoalId("e2e-artifacts")
    const goal = createGoal({
      id: goalId,
      description: "Test artifact creation",
      totalBudget: createBudget({ maxTokens: 500_000, maxCostUsd: 50.0 }),
      status: "active",
    })
    await system.goalRepo.create(goal)

    const goalCompleted = waitForMessage(system.bus, "goal.completed", undefined, 30_000)

    await system.bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId,
      description: goal.description,
      timestamp: new Date(),
    })

    await goalCompleted

    // Check that artifacts were created for spec, plan, review, test_report
    const tasks = await system.taskRepo.findByGoalId(goalId)
    let totalArtifacts = 0
    for (const task of tasks) {
      totalArtifacts += task.artifacts.length
    }
    // At minimum: spec artifact, plan artifact, test_report artifact, review artifact
    expect(totalArtifacts).toBeGreaterThanOrEqual(4)
  }, 60_000)
})
