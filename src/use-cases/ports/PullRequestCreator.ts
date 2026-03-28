export interface CreatePullRequestParams {
  readonly repoUrl: string
  readonly branch: string
  readonly baseBranch: string
  readonly title: string
  readonly body: string
  readonly workingDir: string
}

export interface PullRequestCreator {
  create(params: CreatePullRequestParams): Promise<string>
  merge(prUrl: string, workingDir: string): Promise<void>
}
