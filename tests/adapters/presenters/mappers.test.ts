import { toAgentDTO, toTaskDTO, toGoalDTO, toEventDTO } from "../../../src/adapters/presenters/mappers"
import { createAgent } from "../../../src/entities/Agent"
import { createTask } from "../../../src/entities/Task"
import { createGoal } from "../../../src/entities/Goal"
import { createBudget } from "../../../src/entities/Budget"
import { createAgentId, createTaskId, createGoalId, createEventId } from "../../../src/entities/ids"
import { ROLES } from "../../../src/entities/AgentRole"
import type { SystemEvent } from "../../../src/entities/Event"

describe("mappers", () => {
  describe("toAgentDTO", () => {
    it("maps all Agent fields to DTO", () => {
      const agent = createAgent({ id: createAgentId("dev-1"), role: ROLES.DEVELOPER, model: "claude-sonnet", status: "busy", currentTaskId: createTaskId("t-1"), lastActiveAt: new Date("2026-03-27T10:00:00Z") })
      const dto = toAgentDTO(agent)
      expect(dto.id).toBe("dev-1")
      expect(dto.role).toBe("developer")
      expect(dto.status).toBe("busy")
      expect(dto.currentTaskId).toBe("t-1")
      expect(dto.model).toBe("claude-sonnet")
      expect(dto.lastActiveAt).toBe("2026-03-27T10:00:00.000Z")
    })
  })
  describe("toTaskDTO", () => {
    it("maps all Task fields to DTO", () => {
      const task = createTask({ id: createTaskId("t-1"), goalId: createGoalId("g-1"), description: "Implement feature", phase: "code", budget: createBudget({ maxTokens: 10_000, maxCostUsd: 1 }) })
      const dto = toTaskDTO(task)
      expect(dto.id).toBe("t-1")
      expect(dto.goalId).toBe("g-1")
      expect(dto.status).toBe("queued")
      expect(dto.phase).toBe("code")
      expect(dto.budget.maxTokens).toBe(10_000)
    })
  })
  describe("toGoalDTO", () => {
    it("maps Goal to DTO with taskCount", () => {
      const goal = createGoal({ id: createGoalId("g-1"), description: "Build login", totalBudget: createBudget({ maxTokens: 50_000, maxCostUsd: 5 }), taskIds: [createTaskId("t-1"), createTaskId("t-2")] })
      const dto = toGoalDTO(goal)
      expect(dto.id).toBe("g-1")
      expect(dto.taskCount).toBe(2)
      expect(dto.status).toBe("proposed")
    })
  })
  describe("toEventDTO", () => {
    it("maps SystemEvent to DTO", () => {
      const event: SystemEvent = { id: createEventId("e-1"), type: "task.assigned", agentId: createAgentId("dev-1"), taskId: createTaskId("t-1"), goalId: null, cost: { inputTokens: 100, outputTokens: 50, totalTokens: 150, estimatedCostUsd: 0.01 }, occurredAt: new Date("2026-03-27T12:00:00Z"), payload: null }
      const dto = toEventDTO(event)
      expect(dto.id).toBe("e-1")
      expect(dto.type).toBe("task.assigned")
      expect(dto.agentId).toBe("dev-1")
      expect(dto.cost!.totalTokens).toBe(150)
      expect(dto.occurredAt).toBe("2026-03-27T12:00:00.000Z")
    })
  })
})
