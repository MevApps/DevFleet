export interface WorkspaceHandle {
  readonly id: string
}

export interface WorkspaceIsolator {
  create(repoUrl: string): Promise<WorkspaceHandle>
  installDependencies(handle: WorkspaceHandle, installCommand: string): Promise<void>
  getWorkspaceDir(handle: WorkspaceHandle): string
  cleanup(handle: WorkspaceHandle): Promise<void>
}
