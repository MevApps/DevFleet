import type { Task } from "../entities/Task"
import type { AgentId, ProjectId } from "../entities/ids"
import type { AgentConfig, AgentEvent, AgentExecutor } from "./ports/AgentExecutor"
import type { AgentSession, PhaseTask } from "./ports/AgentSession"
import type { MessagePort } from "./ports/MessagePort"
import type { CheckBudget } from "./CheckBudget"
import type { RecordTurnMetrics } from "./RecordTurnMetrics"
import type { EvaluateOutcome } from "./EvaluateOutcome"
import { createMessageId } from "../entities/ids"

export class RunAgentSession implements AgentExecutor {
  constructor(
    private readonly session: AgentSession,
    private readonly checkBudget: CheckBudget,
    private readonly recordTurnMetrics: RecordTurnMetrics,
    private readonly evaluateOutcome: EvaluateOutcome,
    private readonly bus: MessagePort,
  ) {}

  async *run(agentId: AgentId, config: AgentConfig, task: Task, _projectId: ProjectId): AsyncIterable<AgentEvent> {
    // Pre-launch budget check
    const budgetResult = await this.checkBudget.execute(task.id, config.budget.maxTokens / 10)
    if (!budgetResult.ok || !budgetResult.value.canProceed) {
      yield { type: "budget_exceeded", data: { taskId: task.id, agentId } }
      return
    }

    const controller = new AbortController()

    const phaseTask: PhaseTask = {
      systemPrompt: config.systemPrompt,
      taskDescription: task.description,
      workingDir: config.workingDir ?? "/tmp",
      capabilities: config.capabilities ?? [],
      maxTurns: (config.capabilities ?? []).length > 0 ? 50 : 10,
      model: config.model,
    }

    let lastResult = ""
    let lastNumTurns = 0
    let lastTurnTime = Date.now()

    try {
      for await (const event of this.session.launch(phaseTask, controller.signal)) {
        switch (event.type) {
          case "started":
            lastTurnTime = Date.now()
            await this.bus.emit({
              id: createMessageId(),
              type: "agent.active",
              agentId,
              taskId: task.id,
              timestamp: new Date(),
            })
            break

          case "text":
            yield { type: "text", data: { content: event.content } }
            break

          case "turn_completed": {
            const now = Date.now()
            const turnDurationMs = now - lastTurnTime
            lastTurnTime = now

            await this.recordTurnMetrics.execute(task.id, {
              tokensIn: event.tokensIn,
              tokensOut: event.tokensOut,
              durationMs: turnDurationMs,
            })

            yield { type: "turn_completed", data: { tokensIn: event.tokensIn, tokensOut: event.tokensOut } }

            // Mid-session budget check
            const midBudget = await this.checkBudget.execute(task.id, 0)
            if (midBudget.ok && !midBudget.value.canProceed) {
              controller.abort()
              yield { type: "budget_exceeded", data: { taskId: task.id, agentId } }
              return
            }
            break
          }

          case "completed":
            lastResult = event.result
            lastNumTurns = event.numTurns
            break

          case "error":
            yield { type: "task_failed", data: { taskId: task.id, reason: event.reason } }
            return
        }
      }
    } catch (err) {
      if (controller.signal.aborted) {
        yield { type: "budget_exceeded", data: { taskId: task.id, agentId } }
        return
      }
      const reason = err instanceof Error ? err.message : String(err)
      yield { type: "task_failed", data: { taskId: task.id, reason } }
      return
    }

    // Evaluate the session outcome
    const outcomeResult = await this.evaluateOutcome.execute(task.id, {
      result: lastResult,
      numTurns: lastNumTurns,
    })

    if (!outcomeResult.ok) {
      yield { type: "task_failed", data: { taskId: task.id, reason: outcomeResult.error } }
      return
    }

    if (outcomeResult.value.outcome === "budget_exceeded") {
      yield { type: "budget_exceeded", data: { taskId: task.id, agentId } }
      return
    }

    yield { type: "task_completed", data: { taskId: task.id, turns: lastNumTurns, content: lastResult } }
  }
}
