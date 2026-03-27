import type { Agent } from "../../entities/Agent"
import type { Task } from "../../entities/Task"
import type { Goal } from "../../entities/Goal"
import type { SystemEvent } from "../../entities/Event"
import type { TokenBudget } from "../../entities/Budget"
import type { AgentDTO, TaskDTO, GoalDTO, EventDTO, BudgetDTO, EventCostDTO } from "./dto"

export function toBudgetDTO(budget: TokenBudget): BudgetDTO {
  return {
    maxTokens: budget.maxTokens,
    maxCostUsd: budget.maxCostUsd,
    remaining: budget.remaining,
  }
}

export function toAgentDTO(agent: Agent): AgentDTO {
  return {
    id: agent.id as string,
    role: agent.role as string,
    status: agent.status,
    currentTaskId: agent.currentTaskId !== null ? (agent.currentTaskId as string) : null,
    model: agent.model,
    lastActiveAt: agent.lastActiveAt.toISOString(),
  }
}

export function toTaskDTO(task: Task): TaskDTO {
  return {
    id: task.id as string,
    goalId: task.goalId as string,
    description: task.description,
    status: task.status,
    phase: task.phase,
    assignedTo: task.assignedTo !== null ? (task.assignedTo as string) : null,
    tokensUsed: task.tokensUsed,
    budget: toBudgetDTO(task.budget),
    retryCount: task.retryCount,
    branch: task.branch,
  }
}

export function toGoalDTO(goal: Goal): GoalDTO {
  return {
    id: goal.id as string,
    description: goal.description,
    status: goal.status,
    createdAt: goal.createdAt.toISOString(),
    completedAt: goal.completedAt !== null ? goal.completedAt.toISOString() : null,
    taskCount: goal.taskIds.length,
    totalBudget: toBudgetDTO(goal.totalBudget),
  }
}

export function toEventDTO(event: SystemEvent): EventDTO {
  let cost: EventCostDTO | null = null
  if (event.cost !== null) {
    cost = {
      inputTokens: event.cost.inputTokens,
      outputTokens: event.cost.outputTokens,
      totalTokens: event.cost.totalTokens,
      estimatedCostUsd: event.cost.estimatedCostUsd,
    }
  }
  return {
    id: event.id as string,
    type: event.type,
    agentId: event.agentId !== null ? (event.agentId as string) : null,
    taskId: event.taskId !== null ? (event.taskId as string) : null,
    goalId: event.goalId !== null ? (event.goalId as string) : null,
    cost,
    occurredAt: event.occurredAt.toISOString(),
  }
}
