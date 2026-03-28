import type { PullRequestCreator, CreatePullRequestParams } from "../../use-cases/ports/PullRequestCreator"
import type { ShellExecutorFactory } from "../../use-cases/ports/ShellExecutor"

export class GitHubPullRequestCreator implements PullRequestCreator {
  constructor(private readonly shellFactory: ShellExecutorFactory) {}

  async create(params: CreatePullRequestParams): Promise<string> {
    const shell = this.shellFactory(params.workingDir)
    const result = await shell.execute("gh", [
      "pr", "create",
      "--repo", params.repoUrl.replace("https://github.com/", "").replace(".git", ""),
      "--head", params.branch,
      "--base", params.baseBranch,
      "--title", params.title,
      "--body", params.body,
    ], 30_000)

    if (result.exitCode !== 0) {
      throw new Error(`gh pr create failed: ${result.stderr}`)
    }
    return result.stdout.trim()
  }

  async merge(prUrl: string, workingDir: string): Promise<void> {
    const shell = this.shellFactory(workingDir)
    const result = await shell.execute("gh", [
      "pr", "merge", prUrl, "--merge", "--delete-branch",
    ], 30_000)

    if (result.exitCode !== 0) {
      throw new Error(`gh pr merge failed: ${result.stderr}`)
    }
  }
}
