import type { GitRemote } from "../../use-cases/ports/GitRemote"
import type { ShellExecutorFactory } from "../../use-cases/ports/ShellExecutor"

export class NodeGitRemote implements GitRemote {
  constructor(private readonly shellFactory: ShellExecutorFactory) {}

  async push(branch: string, remoteUrl: string, workingDir: string): Promise<void> {
    const shell = this.shellFactory(workingDir)
    const result = await shell.execute("git", ["push", remoteUrl, `${branch}:${branch}`])
    if (result.exitCode !== 0) {
      throw new Error(`git push failed: ${result.stderr}`)
    }
  }
}
