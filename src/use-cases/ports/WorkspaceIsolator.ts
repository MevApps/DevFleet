export interface WorkspaceHandle {
  readonly id: string
}

export interface WorkspaceIsolator {
  create(repoUrl: string): Promise<WorkspaceHandle>
  createBranch(handle: WorkspaceHandle, branchName: string): Promise<void>
  detectDefaultBranch(handle: WorkspaceHandle): Promise<string>
  installDependencies(handle: WorkspaceHandle, installCommand: string): Promise<void>
  getWorkspaceDir(handle: WorkspaceHandle): string
  cleanup(handle: WorkspaceHandle): Promise<void>
}
