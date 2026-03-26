import { type AgentRole } from "./AgentRole"

export interface Skill {
  readonly id: string
  readonly name: string
  readonly description: string
  readonly applicableRoles: readonly AgentRole[]
  readonly content: string
  readonly version: number
  readonly updatedAt: Date
}
