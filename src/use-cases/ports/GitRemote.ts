export interface GitRemote {
  push(branch: string, remoteUrl: string, workingDir: string): Promise<void>
}
