import {
  type MessageId,
  type GoalId,
  type TaskId,
  type AgentId,
  type ArtifactId,
} from "./ids"
import { type AgentRole } from "./AgentRole"

// ---------------------------------------------------------------------------
// Base shape every message shares
// ---------------------------------------------------------------------------
interface BaseMessage {
  readonly id: MessageId
  readonly timestamp: Date
}

// ---------------------------------------------------------------------------
// Goal lifecycle
// ---------------------------------------------------------------------------
interface GoalCreatedMessage extends BaseMessage {
  readonly type: "goal.created"
  readonly goalId: GoalId
  readonly description: string
}

interface GoalCompletedMessage extends BaseMessage {
  readonly type: "goal.completed"
  readonly goalId: GoalId
  readonly costUsd: number
}

interface GoalAbandonedMessage extends BaseMessage {
  readonly type: "goal.abandoned"
  readonly goalId: GoalId
  readonly reason: string
}

interface ProjectDetectedMessage extends BaseMessage {
  readonly type: "project.detected"
  readonly projectId: string
  readonly config: import("./ProjectConfig").ProjectConfig
}

// ---------------------------------------------------------------------------
// Task lifecycle
// ---------------------------------------------------------------------------
interface TaskCreatedMessage extends BaseMessage {
  readonly type: "task.created"
  readonly taskId: TaskId
  readonly goalId: GoalId
  readonly description: string
}

interface TaskAssignedMessage extends BaseMessage {
  readonly type: "task.assigned"
  readonly taskId: TaskId
  readonly agentId: AgentId
}

interface TaskCompletedMessage extends BaseMessage {
  readonly type: "task.completed"
  readonly taskId: TaskId
  readonly agentId: AgentId
}

interface TaskFailedMessage extends BaseMessage {
  readonly type: "task.failed"
  readonly taskId: TaskId
  readonly agentId: AgentId
  readonly reason: string
}

// ---------------------------------------------------------------------------
// Artifacts
// ---------------------------------------------------------------------------
interface SpecCreatedMessage extends BaseMessage {
  readonly type: "spec.created"
  readonly artifactId: ArtifactId
  readonly taskId: TaskId
}

interface PlanCreatedMessage extends BaseMessage {
  readonly type: "plan.created"
  readonly artifactId: ArtifactId
  readonly taskId: TaskId
}

interface DesignCreatedMessage extends BaseMessage {
  readonly type: "design.created"
  readonly artifactId: ArtifactId
  readonly taskId: TaskId
}

// ---------------------------------------------------------------------------
// Code / branch
// ---------------------------------------------------------------------------
interface CodeCompletedMessage extends BaseMessage {
  readonly type: "code.completed"
  readonly taskId: TaskId
  readonly artifactId: ArtifactId
  readonly branch: string
  readonly filesChanged: number
  readonly testsWritten: number
}

interface BranchPushedMessage extends BaseMessage {
  readonly type: "branch.pushed"
  readonly taskId: TaskId
  readonly branch: string
}

interface BranchMergedMessage extends BaseMessage {
  readonly type: "branch.merged"
  readonly taskId: TaskId
  readonly branch: string
  readonly commit: string
}

interface BranchDiscardedMessage extends BaseMessage {
  readonly type: "branch.discarded"
  readonly taskId: TaskId
  readonly branch: string
  readonly reason: string
}

// ---------------------------------------------------------------------------
// Build / test
// ---------------------------------------------------------------------------
interface BuildPassedMessage extends BaseMessage {
  readonly type: "build.passed"
  readonly taskId: TaskId
  readonly durationMs: number
}

interface BuildFailedMessage extends BaseMessage {
  readonly type: "build.failed"
  readonly taskId: TaskId
  readonly error: string
}

interface TestReportCreatedMessage extends BaseMessage {
  readonly type: "test.report.created"
  readonly artifactId: ArtifactId
  readonly taskId: TaskId
}

interface TestPassedMessage extends BaseMessage {
  readonly type: "test.passed"
  readonly taskId: TaskId
  readonly durationMs: number
}

interface TestFailedMessage extends BaseMessage {
  readonly type: "test.failed"
  readonly taskId: TaskId
  readonly error: string
}

// ---------------------------------------------------------------------------
// Review
// ---------------------------------------------------------------------------
interface ReviewApprovedMessage extends BaseMessage {
  readonly type: "review.approved"
  readonly taskId: TaskId
  readonly reviewerId: AgentId
}

interface ReviewRejectedMessage extends BaseMessage {
  readonly type: "review.rejected"
  readonly taskId: TaskId
  readonly reviewerId: AgentId
  readonly reasons: ReadonlyArray<string>
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------
interface BudgetExceededMessage extends BaseMessage {
  readonly type: "budget.exceeded"
  readonly taskId: TaskId
  readonly agentId: AgentId
  readonly tokensUsed: number
  readonly budgetMax: number
}

// ---------------------------------------------------------------------------
// Agent / skill / learning
// ---------------------------------------------------------------------------
interface AgentPromptUpdatedMessage extends BaseMessage {
  readonly type: "agent.prompt.updated"
  readonly agentId: AgentId
  readonly role: AgentRole
  readonly diff: string
  readonly reason: string
}

interface SkillUpdatedMessage extends BaseMessage {
  readonly type: "skill.updated"
  readonly skillId: string
  readonly diff: string
  readonly reason: string
}

interface InsightGeneratedMessage extends BaseMessage {
  readonly type: "insight.generated"
  readonly insightId: string
  readonly actionKind: string
  readonly title: string
  readonly confidence: number
}

// ---------------------------------------------------------------------------
// Control / scheduling
// ---------------------------------------------------------------------------
interface CeoOverrideMessage extends BaseMessage {
  readonly type: "ceo.override"
  readonly taskId: TaskId
  readonly action: string
  readonly reason: string
}

interface ScheduleIdeationMessage extends BaseMessage {
  readonly type: "schedule.ideation"
}

interface AgentActiveMessage extends BaseMessage {
  readonly type: "agent.active"
  readonly agentId: AgentId
  readonly taskId: TaskId
}

interface AgentStuckMessage extends BaseMessage {
  readonly type: "agent.stuck"
  readonly agentId: AgentId
  readonly taskId: TaskId
  readonly reason: string
  readonly retryCount: number
}

interface AgentPausedMessage extends BaseMessage {
  readonly type: "agent.paused"
  readonly agentId: AgentId
  readonly reason: string
}

interface AgentResumedMessage extends BaseMessage {
  readonly type: "agent.resumed"
  readonly agentId: AgentId
}

interface InsightAcceptedMessage extends BaseMessage {
  readonly type: "insight.accepted"
  readonly insightId: string
  readonly actionKind: string
  readonly title: string
}

interface InsightDismissedMessage extends BaseMessage {
  readonly type: "insight.dismissed"
  readonly insightId: string
}

interface BudgetUpdatedMessage extends BaseMessage {
  readonly type: "budget.updated"
  readonly role: string
  readonly maxTokens: number
  readonly maxCostUsd: number
}

interface ModelUpdatedMessage extends BaseMessage {
  readonly type: "model.updated"
  readonly role: string
  readonly newModel: string
}

interface CeoAlertMessage extends BaseMessage {
  readonly type: "ceo.alert"
  readonly severity: "info" | "warning" | "urgent"
  readonly title: string
  readonly body: string
  readonly goalId?: GoalId
  readonly taskId?: TaskId
  readonly insightId?: string
}

// ---------------------------------------------------------------------------
// Agent activity
// ---------------------------------------------------------------------------
interface AgentToolCallMessage extends BaseMessage {
  readonly type: "agent.tool_call"
  readonly agentId: AgentId
  readonly taskId: TaskId
  readonly tool: string
  readonly target: string
}

// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------
interface WorkspaceGoalDeliveredMessage extends BaseMessage {
  readonly type: "workspace.goal.delivered"
  readonly goalId: GoalId
  readonly prUrl: string
  readonly merged: boolean
}

interface WorkspaceGoalFailedMessage extends BaseMessage {
  readonly type: "workspace.goal.failed"
  readonly goalId: GoalId
  readonly reason: string
}

interface WorkspaceStatusChangedMessage extends BaseMessage {
  readonly type: "workspace.status.changed"
  readonly runId: string
  readonly status: string
}

// ---------------------------------------------------------------------------
// Union + utilities
// ---------------------------------------------------------------------------
export type Message =
  | GoalCreatedMessage
  | GoalCompletedMessage
  | GoalAbandonedMessage
  | ProjectDetectedMessage
  | TaskCreatedMessage
  | TaskAssignedMessage
  | TaskCompletedMessage
  | TaskFailedMessage
  | SpecCreatedMessage
  | PlanCreatedMessage
  | DesignCreatedMessage
  | CodeCompletedMessage
  | BranchPushedMessage
  | BranchMergedMessage
  | BranchDiscardedMessage
  | BuildPassedMessage
  | BuildFailedMessage
  | TestReportCreatedMessage
  | TestPassedMessage
  | TestFailedMessage
  | ReviewApprovedMessage
  | ReviewRejectedMessage
  | BudgetExceededMessage
  | AgentPromptUpdatedMessage
  | SkillUpdatedMessage
  | InsightGeneratedMessage
  | CeoOverrideMessage
  | ScheduleIdeationMessage
  | AgentActiveMessage
  | AgentStuckMessage
  | AgentPausedMessage
  | AgentResumedMessage
  | AgentToolCallMessage
  | InsightAcceptedMessage
  | InsightDismissedMessage
  | BudgetUpdatedMessage
  | ModelUpdatedMessage
  | CeoAlertMessage
  | WorkspaceGoalDeliveredMessage
  | WorkspaceGoalFailedMessage
  | WorkspaceStatusChangedMessage

export type MessageType = Message["type"]

export interface MessageFilter {
  readonly types?: readonly MessageType[]
  readonly agentId?: AgentId
  readonly taskId?: TaskId
  readonly goalId?: GoalId
}

export function matchesFilter(message: Message, filter: MessageFilter): boolean {
  if (filter.types && filter.types.length > 0) {
    if (!filter.types.includes(message.type)) {
      return false
    }
  }

  if (filter.agentId) {
    const msgAgentId = "agentId" in message ? (message as { agentId: AgentId }).agentId : undefined
    if (msgAgentId !== undefined && msgAgentId !== filter.agentId) {
      return false
    }
  }

  if (filter.taskId) {
    const msgTaskId = "taskId" in message ? (message as { taskId: TaskId }).taskId : undefined
    if (msgTaskId !== undefined && msgTaskId !== filter.taskId) {
      return false
    }
  }

  if (filter.goalId) {
    const msgGoalId = "goalId" in message ? (message as { goalId: GoalId }).goalId : undefined
    if (msgGoalId !== undefined && msgGoalId !== filter.goalId) {
      return false
    }
  }

  return true
}
