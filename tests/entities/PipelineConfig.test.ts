import {
  createPipelineConfig,
  canAdvancePhase,
  roleForPhase,
  type PhaseTransition,
} from "../../src/entities/PipelineConfig"
import { ROLES } from "../../src/entities/AgentRole"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

const pipeline = createPipelineConfig({
  phases: ["plan", "code", "test", "review", "done"],
  transitions: [
    { from: "plan", to: "code" },
    { from: "code", to: "test" },
    { from: "test", to: "review" },
    { from: "review", to: "done" },
    // allow going back for rework
    { from: "review", to: "code" },
  ],
  skipAllowed: [],
})

const baseTask = createTask({
  id: createTaskId("t-1"),
  goalId: createGoalId("g-1"),
  description: "Do stuff",
  phase: "plan",
  budget: createBudget({ maxTokens: 1000, maxCostUsd: 1.0 }),
})

describe("PipelineConfig", () => {
  test("createPipelineConfig stores phases and transitions", () => {
    expect(pipeline.phases).toEqual(["plan", "code", "test", "review", "done"])
    expect(pipeline.transitions).toHaveLength(5)
  })

  test("canAdvancePhase: plan -> code is valid", () => {
    const task = { ...baseTask, phase: "plan" }
    expect(canAdvancePhase(task, "code", pipeline)).toBe(true)
  })

  test("canAdvancePhase: plan -> test is invalid (skipping code)", () => {
    const task = { ...baseTask, phase: "plan" }
    expect(canAdvancePhase(task, "test", pipeline)).toBe(false)
  })

  test("canAdvancePhase: review -> code is allowed (rework)", () => {
    const task = { ...baseTask, phase: "review" }
    expect(canAdvancePhase(task, "code", pipeline)).toBe(true)
  })

  test("canAdvancePhase: review -> plan is not valid", () => {
    const task = { ...baseTask, phase: "review" }
    expect(canAdvancePhase(task, "plan", pipeline)).toBe(false)
  })

  test("canAdvancePhase: done -> anything is false (terminal)", () => {
    const task = { ...baseTask, phase: "done" }
    expect(canAdvancePhase(task, "code", pipeline)).toBe(false)
  })
})

describe("PipelineConfig – roleMapping", () => {
  it("includes roleMapping in created config", () => {
    const config = createPipelineConfig({
      phases: ["spec", "plan", "code", "review"],
      transitions: [{ from: "spec", to: "plan" }, { from: "plan", to: "code" }, { from: "code", to: "review" }],
      roleMapping: [
        { phase: "spec", role: ROLES.PRODUCT }, { phase: "plan", role: ROLES.ARCHITECT },
        { phase: "code", role: ROLES.DEVELOPER }, { phase: "review", role: ROLES.REVIEWER },
      ],
    })
    expect(config.roleMapping).toHaveLength(4)
    expect(config.roleMapping[0]).toEqual({ phase: "spec", role: ROLES.PRODUCT })
  })
  it("defaults roleMapping to empty array", () => {
    const config = createPipelineConfig({ phases: ["code"], transitions: [] })
    expect(config.roleMapping).toEqual([])
  })
  it("roleForPhase returns correct role", () => {
    const config = createPipelineConfig({
      phases: ["spec", "code"], transitions: [{ from: "spec", to: "code" }],
      roleMapping: [{ phase: "spec", role: ROLES.PRODUCT }, { phase: "code", role: ROLES.DEVELOPER }],
    })
    expect(roleForPhase("spec", config)).toBe(ROLES.PRODUCT)
    expect(roleForPhase("code", config)).toBe(ROLES.DEVELOPER)
    expect(roleForPhase("unknown", config)).toBeNull()
  })
})
