import type { GitRemote } from "../../use-cases/ports/GitRemote"
import type { ShellExecutorFactory } from "../../use-cases/ports/ShellExecutor"

export class NodeGitRemote implements GitRemote {
  constructor(private readonly shellFactory: ShellExecutorFactory) {}

  async push(branch: string, remoteUrl: string, workingDir: string): Promise<void> {
    const shell = this.shellFactory(workingDir)
    const head = (await shell.execute("git", ["rev-parse", "HEAD"])).stdout.trim()
    const currentBranch = (await shell.execute("git", ["rev-parse", "--abbrev-ref", "HEAD"])).stdout.trim()
    console.log(`[NodeGitRemote] pushing ${branch}:${branch}, current branch: ${currentBranch}, HEAD: ${head.slice(0, 8)}`)
    const result = await shell.execute("git", ["push", remoteUrl, `${branch}:${branch}`])
    if (result.exitCode !== 0) {
      console.error(`[NodeGitRemote] push stderr:`, result.stderr)
      throw new Error(`git push failed: ${result.stderr}`)
    }
    console.log("[NodeGitRemote] push succeeded")
  }
}
