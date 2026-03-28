import type { AgentId, ProjectId, GoalId, TaskId } from "../../../entities/ids"
import { createMessageId, createTaskId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PipelineConfig } from "../../../entities/PipelineConfig"
import { roleForPhase } from "../../../entities/PipelineConfig"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { GoalRepository } from "../../../use-cases/ports/GoalRepository"
import type { AgentRegistry } from "../../../use-cases/ports/AgentRegistry"
import type { DecomposeGoal, TaskDefinition } from "../../../use-cases/DecomposeGoal"
import type { AssignTask } from "../../../use-cases/AssignTask"
import type { AgentSession, PhaseTask } from "../../../use-cases/ports/AgentSession"
import type { EvaluateKeepDiscard } from "../../../use-cases/EvaluateKeepDiscard"
import type { MergeBranch } from "../../../use-cases/MergeBranch"
import type { DiscardBranch } from "../../../use-cases/DiscardBranch"
import type { DetectProjectConfig } from "../../../use-cases/DetectProjectConfig"
import { createBudget } from "../../../entities/Budget"
import { ROLES } from "../../../entities/AgentRole"

export interface SupervisorPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly bus: MessagePort
  readonly taskRepo: TaskRepository
  readonly goalRepo: GoalRepository
  readonly agentRegistry: AgentRegistry
  readonly decomposeGoal: DecomposeGoal
  readonly assignTask: AssignTask
  readonly agentSession: AgentSession
  readonly evaluateKeepDiscard: EvaluateKeepDiscard
  readonly mergeBranch: MergeBranch
  readonly discardBranch: DiscardBranch
  readonly pipelineConfig: PipelineConfig
  readonly maxRetries: number
  readonly model: string
  readonly systemPrompt: string
  readonly detectProjectConfig: DetectProjectConfig
  readonly workspaceDir: string
}

export class SupervisorPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "supervisor-agent"
  readonly version = "1.0.0"
  readonly description = "Orchestration agent that decomposes goals and routes tasks"

  private readonly deps: SupervisorPluginDeps

  constructor(deps: SupervisorPluginDeps) {
    this.deps = deps
    this.id = `supervisor-${deps.agentId}`
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async healthCheck(): Promise<HealthStatus> { return "healthy" }

  subscriptions(): ReadonlyArray<MessageFilter> {
    return [{
      types: [
        "goal.created", "task.completed", "task.failed",
        "code.completed",
        "review.approved", "review.rejected",
        "budget.exceeded", "agent.stuck",
      ],
    }]
  }

  async handle(message: Message): Promise<void> {
    switch (message.type) {
      case "goal.created":
        return this.handleGoalCreated(message.goalId, message.description)
      case "task.completed":
        return this.handleTaskCompleted(message.taskId)
      case "code.completed":
        return this.handleTaskCompleted(message.taskId)
      case "task.failed":
        return this.handleTaskFailed(message.taskId, message.reason)
      case "review.approved":
        return this.handleReviewApproved(message.taskId)
      case "review.rejected":
        return this.handleReviewRejected(message.taskId, message.reasons)
      case "budget.exceeded":
        return this.handleBudgetExceeded(message.taskId)
      case "agent.stuck":
        return this.handleAgentStuck(message.taskId)
    }
  }

  private async handleGoalCreated(goalId: GoalId, description: string): Promise<void> {
    // Detect project configuration
    const config = await this.deps.detectProjectConfig.execute()
    await this.deps.bus.emit({
      id: createMessageId(),
      type: "project.detected",
      projectId: this.deps.projectId,
      config,
      timestamp: new Date(),
    })

    // Use AgentSession to decompose the goal into tasks
    const phaseTask: PhaseTask = {
      systemPrompt: this.deps.systemPrompt,
      taskDescription: `Decompose this goal into tasks. Return a JSON array of {description, phase} objects.\nPhases available: ${this.deps.pipelineConfig.phases.join(", ")}\n\nGoal: ${description}`,
      workingDir: this.deps.workspaceDir,
      capabilities: [],
      model: this.deps.model,
    }

    let content = ""
    const controller = new AbortController()
    for await (const event of this.deps.agentSession.launch(phaseTask, controller.signal)) {
      if (event.type === "completed") {
        content = event.result
      }
    }

    if (!content) return

    // Parse AI response into task definitions
    let taskDefs: Array<{ description: string; phase: string }>
    try {
      const jsonMatch = content.match(/\[[\s\S]*\]/)
      taskDefs = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    } catch {
      taskDefs = this.deps.pipelineConfig.phases.map(phase => ({
        description: `${phase}: ${description}`,
        phase,
      }))
    }

    const definitions: TaskDefinition[] = taskDefs.map(def => ({
      id: createTaskId(),
      description: def.description,
      phase: def.phase,
      budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }),
    }))

    await this.deps.decomposeGoal.execute(goalId, definitions)

    // Assign the first phase task
    if (definitions.length > 0) {
      const firstDef = definitions[0]!
      const role = roleForPhase(firstDef.phase, this.deps.pipelineConfig)
      if (role) {
        await this.deps.assignTask.execute(firstDef.id, role)
      }
    }
  }

  private async handleTaskCompleted(taskId: TaskId): Promise<void> {
    const task = await this.deps.taskRepo.findById(taskId)
    if (!task) return

    // Release the agent back to idle so it can be re-assigned
    if (task.assignedTo) {
      try {
        await this.deps.agentRegistry.updateStatus(task.assignedTo, "idle", null)
      } catch {
        // Agent may not exist in registry (e.g., in test scenarios)
      }
    }

    // Find next queued task in pipeline order (tasks were all created during decomposition)
    const allTasks = await this.deps.taskRepo.findByGoalId(task.goalId)
    const phases = this.deps.pipelineConfig.phases
    const currentIdx = phases.indexOf(task.phase)

    const nextTask = allTasks.find(t =>
      t.status === "queued" && phases.indexOf(t.phase) > currentIdx
    )

    if (nextTask) {
      const role = roleForPhase(nextTask.phase, this.deps.pipelineConfig)
      if (role) await this.deps.assignTask.execute(nextTask.id, role)
    } else {
      // All tasks done — emit goal.completed
      await this.deps.bus.emit({
        id: createMessageId(),
        type: "goal.completed",
        goalId: task.goalId,
        costUsd: 0, // Phase 4: calculate from metrics
        timestamp: new Date(),
      })
    }
  }

  private async handleTaskFailed(taskId: TaskId, reason: string): Promise<void> {
    const task = await this.deps.taskRepo.findById(taskId)
    if (!task) return

    if (task.branch) {
      await this.deps.discardBranch.execute(taskId, reason)
    } else {
      // Non-code task failed — mark as discarded directly (no branch to clean up)
      const updated = { ...task, status: "discarded" as const, version: task.version + 1 }
      await this.deps.taskRepo.update(updated)
    }
  }

  private async handleReviewApproved(taskId: TaskId): Promise<void> {
    const result = await this.deps.evaluateKeepDiscard.execute(taskId, "approved", this.deps.maxRetries)
    if (!result.ok) return

    if (result.value === "keep") {
      // Find the code task that has a branch for merging
      const task = await this.deps.taskRepo.findById(taskId)
      if (!task) return

      const allTasks = await this.deps.taskRepo.findByGoalId(task.goalId)
      const codeTask = allTasks.find(t => t.phase === "code" && t.branch)

      if (codeTask) {
        await this.deps.mergeBranch.execute(codeTask.id)
      }

      // After merge, advance the pipeline from the reviewed task
      await this.handleTaskCompleted(taskId)
    }
  }

  private async handleReviewRejected(taskId: TaskId, _reasons: ReadonlyArray<string>): Promise<void> {
    const result = await this.deps.evaluateKeepDiscard.execute(taskId, "rejected", this.deps.maxRetries)
    if (!result.ok) return

    if (result.value === "retry") {
      const task = await this.deps.taskRepo.findById(taskId)
      if (!task) return

      // Re-queue the task for Developer
      const requeuedTask = { ...task, status: "queued" as const, assignedTo: null, version: task.version + 1 }
      await this.deps.taskRepo.update(requeuedTask)
      await this.deps.assignTask.execute(taskId, ROLES.DEVELOPER)
    } else if (result.value === "discard") {
      await this.deps.discardBranch.execute(taskId, "max retries exceeded")
    }
  }

  private async handleBudgetExceeded(taskId: TaskId): Promise<void> {
    await this.deps.discardBranch.execute(taskId, "budget exceeded")
  }

  private async handleAgentStuck(taskId: TaskId): Promise<void> {
    await this.deps.discardBranch.execute(taskId, "agent stuck")
  }
}
