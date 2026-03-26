import type { TaskId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"
import { isOverBudget } from "../entities/Task"
import { createMessageId } from "../entities/ids"
import type { ToolResult } from "./ExecuteToolCalls"

export type TurnOutcomeType = "success" | "needs_continuation" | "failure" | "budget_exceeded"

export interface TurnOutcome {
  readonly outcome: TurnOutcomeType
  readonly reason?: string
}

export interface EvaluateTurnInput {
  readonly stopReason: "end_turn" | "max_tokens" | "tool_use"
  readonly toolResults: ReadonlyArray<ToolResult>
}

export class EvaluateTurnOutcome {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly bus: MessagePort,
  ) {}

  async execute(taskId: TaskId, input: EvaluateTurnInput): Promise<Result<TurnOutcome>> {
    const task = await this.tasks.findById(taskId)
    if (!task) {
      return failure(`Task ${taskId} not found`)
    }

    // Budget exceeded takes highest priority
    if (isOverBudget(task)) {
      if (task.assignedTo) {
        await this.bus.emit({
          id: createMessageId(),
          type: "budget.exceeded",
          taskId,
          agentId: task.assignedTo,
          timestamp: new Date(),
        })
      }
      return success({ outcome: "budget_exceeded", reason: "Token budget exceeded" })
    }

    // AI wants to use tools → continue loop
    if (input.stopReason === "tool_use") {
      return success({ outcome: "needs_continuation", reason: "Agent requested tool use" })
    }

    // Any failed tool result → failure
    const failedTool = input.toolResults.find(r => !r.success)
    if (failedTool) {
      return success({ outcome: "failure", reason: `Tool ${failedTool.name} failed: ${failedTool.error ?? "unknown"}` })
    }

    return success({ outcome: "success" })
  }
}
