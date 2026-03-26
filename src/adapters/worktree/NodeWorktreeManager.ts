import type { WorktreeManager, WorktreePath, MergeResult } from "../../use-cases/ports/WorktreeManager"
import type { ShellExecutor } from "../../use-cases/ports/ShellExecutor"
import { join } from "node:path"

const WORKTREES_DIR = ".worktrees"

export class NodeWorktreeManager implements WorktreeManager {
  constructor(
    private readonly shell: ShellExecutor,
    private readonly projectRoot: string,
  ) {}

  async create(branch: string, baseBranch?: string): Promise<WorktreePath> {
    const worktreePath = this.worktreePath(branch)
    const base = baseBranch ?? "HEAD"
    await this.shell.execute(`git worktree add -b "${branch}" "${worktreePath}" ${base}`)
    return worktreePath
  }

  async delete(branch: string): Promise<void> {
    const worktreePath = this.worktreePath(branch)
    await this.shell.execute(`git worktree remove "${worktreePath}" --force`)
    await this.shell.execute(`git branch -D "${branch}"`)
  }

  async merge(branch: string, _targetBranch?: string): Promise<MergeResult> {
    try {
      await this.shell.execute(`git merge "${branch}" --no-edit`)
      const commitResult = await this.shell.execute("git rev-parse HEAD")
      const commit = commitResult.stdout.trim()

      const worktreePath = this.worktreePath(branch)
      await this.shell.execute(`git worktree remove "${worktreePath}" --force`).catch(() => {})
      await this.shell.execute(`git branch -D "${branch}"`).catch(() => {})

      return { success: true, commit }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  }

  async exists(branch: string): Promise<boolean> {
    try {
      const result = await this.shell.execute("git worktree list --porcelain")
      return result.stdout.includes(branch)
    } catch {
      return false
    }
  }

  private worktreePath(branch: string): WorktreePath {
    return join(this.projectRoot, WORKTREES_DIR, branch)
  }
}
