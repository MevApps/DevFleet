import type { WorktreeManager, WorktreePath, MergeResult } from "../../use-cases/ports/WorktreeManager"

export class InMemoryWorktreeManager implements WorktreeManager {
  private readonly branches = new Set<string>()

  async create(branch: string, _baseBranch?: string): Promise<WorktreePath> {
    this.branches.add(branch)
    return `.worktrees/${branch}`
  }

  async delete(branch: string): Promise<void> {
    this.branches.delete(branch)
  }

  async merge(branch: string, _targetBranch?: string): Promise<MergeResult> {
    if (!this.branches.has(branch)) {
      return { success: false, error: `Branch ${branch} not found` }
    }
    this.branches.delete(branch)
    const commit = `fake-${branch}-${Date.now().toString(36)}`
    return { success: true, commit }
  }

  async exists(branch: string): Promise<boolean> {
    return this.branches.has(branch)
  }

  async cleanupAll(): Promise<void> {
    this.branches.clear()
  }
}
