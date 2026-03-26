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
}

interface GoalAbandonedMessage extends BaseMessage {
  readonly type: "goal.abandoned"
  readonly goalId: GoalId
  readonly reason: string
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
}

interface TaskFailedMessage extends BaseMessage {
  readonly type: "task.failed"
  readonly taskId: TaskId
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
}

interface BranchDiscardedMessage extends BaseMessage {
  readonly type: "branch.discarded"
  readonly taskId: TaskId
  readonly branch: string
}

// ---------------------------------------------------------------------------
// Build / test
// ---------------------------------------------------------------------------
interface BuildPassedMessage extends BaseMessage {
  readonly type: "build.passed"
  readonly taskId: TaskId
}

interface BuildFailedMessage extends BaseMessage {
  readonly type: "build.failed"
  readonly taskId: TaskId
  readonly logs: string
}

interface TestReportCreatedMessage extends BaseMessage {
  readonly type: "test.report.created"
  readonly artifactId: ArtifactId
  readonly taskId: TaskId
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
  readonly feedback: string
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------
interface BudgetExceededMessage extends BaseMessage {
  readonly type: "budget.exceeded"
  readonly taskId: TaskId
  readonly agentId: AgentId
}

// ---------------------------------------------------------------------------
// Agent / skill / learning
// ---------------------------------------------------------------------------
interface AgentPromptUpdatedMessage extends BaseMessage {
  readonly type: "agent.prompt.updated"
  readonly agentId: AgentId
  readonly role: AgentRole
}

interface SkillUpdatedMessage extends BaseMessage {
  readonly type: "skill.updated"
  readonly skillId: string
}

interface InsightGeneratedMessage extends BaseMessage {
  readonly type: "insight.generated"
  readonly agentId: AgentId
  readonly content: string
}

// ---------------------------------------------------------------------------
// Control / scheduling
// ---------------------------------------------------------------------------
interface CeoOverrideMessage extends BaseMessage {
  readonly type: "ceo.override"
  readonly instruction: string
}

interface ScheduleIdeationMessage extends BaseMessage {
  readonly type: "schedule.ideation"
}

interface AgentStuckMessage extends BaseMessage {
  readonly type: "agent.stuck"
  readonly agentId: AgentId
  readonly taskId: TaskId
  readonly reason: string
}

// ---------------------------------------------------------------------------
// Union + utilities
// ---------------------------------------------------------------------------
export type Message =
  | GoalCreatedMessage
  | GoalCompletedMessage
  | GoalAbandonedMessage
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
  | ReviewApprovedMessage
  | ReviewRejectedMessage
  | BudgetExceededMessage
  | AgentPromptUpdatedMessage
  | SkillUpdatedMessage
  | InsightGeneratedMessage
  | CeoOverrideMessage
  | ScheduleIdeationMessage
  | AgentStuckMessage

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
  return true
}
