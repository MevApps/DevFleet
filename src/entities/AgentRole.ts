// Branded AgentRole type
export type AgentRole = string & { readonly __brand: "AgentRole" }

export function createAgentRole(value: string): AgentRole {
  return value as AgentRole
}

export const ROLES = {
  SUPERVISOR: createAgentRole("SUPERVISOR"),
  PRODUCT: createAgentRole("PRODUCT"),
  ARCHITECT: createAgentRole("ARCHITECT"),
  DEVELOPER: createAgentRole("DEVELOPER"),
  REVIEWER: createAgentRole("REVIEWER"),
  OPS: createAgentRole("OPS"),
  LEARNER: createAgentRole("LEARNER"),
} as const
