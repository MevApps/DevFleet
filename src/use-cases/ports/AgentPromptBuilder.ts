import type { GoalId } from "../../entities/ids"

export interface AgentPromptBuilder {
  build(rolePrompt: string, goalId: GoalId): Promise<string>
}
