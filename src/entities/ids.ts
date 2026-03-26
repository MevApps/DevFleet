import { randomUUID } from "node:crypto"

// Branded ID types
export type TaskId = string & { readonly __brand: "TaskId" }
export type GoalId = string & { readonly __brand: "GoalId" }
export type AgentId = string & { readonly __brand: "AgentId" }
export type ArtifactId = string & { readonly __brand: "ArtifactId" }
export type MessageId = string & { readonly __brand: "MessageId" }
export type EventId = string & { readonly __brand: "EventId" }
export type ProjectId = string & { readonly __brand: "ProjectId" }

// Factory functions
export function createTaskId(value?: string): TaskId {
  return (value ?? randomUUID()) as TaskId
}

export function createGoalId(value?: string): GoalId {
  return (value ?? randomUUID()) as GoalId
}

/** AgentId requires a value — agents have explicit identities */
export function createAgentId(value: string): AgentId {
  return value as AgentId
}

export function createArtifactId(value?: string): ArtifactId {
  return (value ?? randomUUID()) as ArtifactId
}

export function createMessageId(value?: string): MessageId {
  return (value ?? randomUUID()) as MessageId
}

export function createEventId(value?: string): EventId {
  return (value ?? randomUUID()) as EventId
}

export function createProjectId(value?: string): ProjectId {
  return (value ?? randomUUID()) as ProjectId
}
