// Branded AgentRole type
export type AgentRole = string & { readonly __brand: "AgentRole" }

export function createAgentRole(value: string): AgentRole {
  return value as AgentRole
}

export const ROLES = {
  SUPERVISOR: "supervisor" as AgentRole,
  PRODUCT: "product" as AgentRole,
  ARCHITECT: "architect" as AgentRole,
  DEVELOPER: "developer" as AgentRole,
  REVIEWER: "reviewer" as AgentRole,
  OPS: "ops" as AgentRole,
  LEARNER: "learner" as AgentRole,
} as const
