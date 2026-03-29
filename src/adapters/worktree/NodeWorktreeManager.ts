import type { WorktreeManager, WorktreePath, MergeResult } from "../../use-cases/ports/WorktreeManager"
import type { ShellExecutor, ShellExecutorFactory } from "../../use-cases/ports/ShellExecutor"
import { join } from "node:path"

const WORKTREES_DIR = ".worktrees"

export class NodeWorktreeManager implements WorktreeManager {
  constructor(
    private readonly shell: ShellExecutor,
    private readonly projectRoot: string,
    private readonly shellFactory: ShellExecutorFactory,
  ) {}

  async create(branch: string, baseBranch?: string): Promise<WorktreePath> {
    const worktreePath = this.worktreePath(branch)
    const base = baseBranch ?? "HEAD"
    await this.shell.execute("git", ["worktree", "add", "-b", branch, worktreePath, base])
    return worktreePath
  }

  async commitAll(branch: string, message: string): Promise<boolean> {
    const worktreePath = this.worktreePath(branch)
    const wtShell = this.shellFactory(worktreePath)
    await wtShell.execute("git", ["add", "-A"])
    const status = await wtShell.execute("git", ["status", "--porcelain"])
    if (!status.stdout.trim()) {
      console.log(`[NodeWorktreeManager] no changes to commit on ${branch}`)
      return false
    }
    const result = await wtShell.execute("git", ["commit", "-m", message])
    if (result.exitCode !== 0) {
      console.error(`[NodeWorktreeManager] commit failed on ${branch}:`, result.stderr)
      return false
    }
    console.log(`[NodeWorktreeManager] committed changes on ${branch}`)
    return true
  }

  async delete(branch: string): Promise<void> {
    const worktreePath = this.worktreePath(branch)
    await this.shell.execute("git", ["worktree", "remove", worktreePath, "--force"])
    await this.shell.execute("git", ["branch", "-D", branch])
  }

  async merge(branch: string, _targetBranch?: string): Promise<MergeResult> {
    try {
      const beforeHead = (await this.shell.execute("git", ["rev-parse", "HEAD"])).stdout.trim()
      const currentBranch = (await this.shell.execute("git", ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim()
      console.log(`[NodeWorktreeManager] merging "${branch}" into "${currentBranch}" (HEAD: ${beforeHead.slice(0, 8)})`)
      const mergeResult = await this.shell.execute("git", ["merge", branch, "--no-edit"])
      if (mergeResult.exitCode !== 0) {
        console.error(`[NodeWorktreeManager] merge failed:`, mergeResult.stderr)
      }
      const commitResult = await this.shell.execute("git", ["rev-parse", "HEAD"])
      const commit = commitResult.stdout.trim()
      console.log(`[NodeWorktreeManager] after merge HEAD: ${commit.slice(0, 8)} (changed: ${commit !== beforeHead})`)

      const worktreePath = this.worktreePath(branch)
      await this.shell.execute("git", ["worktree", "remove", worktreePath, "--force"]).catch(() => {})
      await this.shell.execute("git", ["branch", "-D", branch]).catch(() => {})

      return { success: true, commit }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  }

  async exists(branch: string): Promise<boolean> {
    try {
      const result = await this.shell.execute("git", ["worktree", "list", "--porcelain"])
      return result.stdout.includes(branch)
    } catch {
      return false
    }
  }

  async cleanupAll(): Promise<void> {
    try {
      const result = await this.shell.execute("git", ["worktree", "list", "--porcelain"])
      const worktreePaths = result.stdout
        .split("\n")
        .filter(line => line.startsWith("worktree "))
        .map(line => line.replace("worktree ", ""))
        .filter(p => p.includes(WORKTREES_DIR))

      for (const wt of worktreePaths) {
        await this.shell.execute("git", ["worktree", "remove", wt, "--force"]).catch(() => {})
      }
    } catch {
      // Best-effort cleanup
    }
  }

  private worktreePath(branch: string): WorktreePath {
    return join(this.projectRoot, WORKTREES_DIR, branch)
  }
}
