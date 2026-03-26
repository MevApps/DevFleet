import type { Task } from "../entities/Task"
import type { AgentId, ProjectId } from "../entities/ids"
import type { AgentConfig, AgentEvent, AgentExecutor } from "./ports/AgentExecutor"
import type { TaskRepository } from "./ports/TaskRepository"
import type { CheckBudget } from "./CheckBudget"
import type { PromptAgent } from "./PromptAgent"
import type { ExecuteToolCalls } from "./ExecuteToolCalls"
import type { RecordTurnMetrics } from "./RecordTurnMetrics"
import type { EvaluateTurnOutcome } from "./EvaluateTurnOutcome"
import { addTurn, createConversation } from "../entities/Conversation"

const MAX_TURNS = 20

export class RunAgentLoop implements AgentExecutor {
  constructor(
    private readonly checkBudget: CheckBudget,
    private readonly promptAgent: PromptAgent,
    private readonly executeToolCalls: ExecuteToolCalls,
    private readonly recordTurnMetrics: RecordTurnMetrics,
    private readonly evaluateTurnOutcome: EvaluateTurnOutcome,
    private readonly tasks: TaskRepository,
  ) {}

  async *run(agentId: AgentId, config: AgentConfig, task: Task, _projectId: ProjectId): AsyncIterable<AgentEvent> {
    let conversation = createConversation(agentId)
    let turnCount = 0
    let lastContent = ""

    while (turnCount < MAX_TURNS) {
      turnCount++

      // 1. Check budget
      const budgetResult = await this.checkBudget.execute(task.id, config.budget.maxTokens / 10)
      if (!budgetResult.ok || !budgetResult.value.canProceed) {
        yield { type: "budget_exceeded", data: { taskId: task.id, agentId } }
        return
      }

      // 2. Build prompt from conversation
      const prompt = {
        systemPrompt: config.systemPrompt,
        messages: conversation.turns
          .filter(t => t.role === "user" || t.role === "assistant")
          .map(t => ({ role: t.role as "user" | "assistant", content: t.content })),
        model: config.model,
        maxTokens: config.budget.maxTokens,
      }

      // Add user turn if conversation empty
      const promptMessages = prompt.messages.length === 0
        ? [{ role: "user" as const, content: task.description }]
        : prompt.messages

      const finalPrompt = { ...prompt, messages: promptMessages }

      // 3. Prompt AI
      const turnStart = Date.now()
      const promptResult = await this.promptAgent.execute(finalPrompt, config.tools, config.budget)
      const durationMs = Date.now() - turnStart

      if (!promptResult.ok) {
        yield { type: "task_failed", data: { taskId: task.id, reason: promptResult.error } }
        return
      }

      const { content, toolCalls, tokensIn, tokensOut, stopReason } = promptResult.value
      lastContent = content

      // 4. Update conversation
      if (conversation.turns.length === 0) {
        conversation = addTurn(conversation, {
          role: "user",
          content: task.description,
          tokenCount: 0,
          timestamp: new Date(),
        })
      }
      conversation = addTurn(conversation, {
        role: "assistant",
        content,
        tokenCount: tokensOut,
        timestamp: new Date(),
      })

      // 5. Record metrics
      await this.recordTurnMetrics.execute(task.id, { tokensIn, tokensOut, durationMs })

      // 6. Execute tool calls if any
      const toolResults = toolCalls.length > 0
        ? await this.executeToolCalls.execute(toolCalls)
        : []

      // Add tool results to conversation as user turn
      if (toolResults.length > 0) {
        const toolSummary = toolResults
          .map(r => `[${r.name}]: ${r.success ? r.output : `ERROR: ${r.error}`}`)
          .join("\n")
        conversation = addTurn(conversation, {
          role: "user",
          content: toolSummary,
          tokenCount: 0,
          timestamp: new Date(),
        })
      }

      yield { type: "turn_completed", data: { turn: turnCount, tokensIn, tokensOut, stopReason } }

      // Emit tool_executed events
      for (const toolResult of toolResults) {
        yield { type: "tool_executed", data: { toolName: toolResult.name, success: toolResult.success } }
      }

      // 7. Evaluate outcome
      // Re-fetch task (metrics may have updated tokensUsed)
      const freshTask = await this.tasks.findById(task.id)
      const evaluateTask = freshTask ?? task

      const outcomeResult = await this.evaluateTurnOutcome.execute(evaluateTask.id, { stopReason, toolResults })
      if (!outcomeResult.ok) {
        yield { type: "task_failed", data: { taskId: task.id, reason: outcomeResult.error } }
        return
      }

      const { outcome } = outcomeResult.value

      if (outcome === "budget_exceeded") {
        yield { type: "budget_exceeded", data: { taskId: task.id, agentId } }
        return
      }

      if (outcome === "success") {
        yield { type: "task_completed", data: { taskId: task.id, turns: turnCount, content: lastContent } }
        return
      }

      if (outcome === "failure") {
        yield { type: "task_failed", data: { taskId: task.id, reason: outcomeResult.value.reason ?? "unknown failure" } }
        return
      }

      // needs_continuation → loop continues
    }

    // Exceeded MAX_TURNS
    yield { type: "task_failed", data: { taskId: task.id, reason: `Exceeded max turns (${MAX_TURNS})` } }
  }
}
