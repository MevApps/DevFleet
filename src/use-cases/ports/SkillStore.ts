export interface SkillStore {
  read(skillName: string): Promise<string>
  update(skillName: string, content: string, reason: string): Promise<void>
  list(): Promise<ReadonlyArray<string>>
}
