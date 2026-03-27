export interface AgentPromptStore {
  read(role: string): Promise<string>
  update(role: string, content: string, reason: string): Promise<void>
}
