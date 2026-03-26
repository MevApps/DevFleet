export interface ShellResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

export interface ShellExecutor {
  execute(command: string, timeout?: number): Promise<ShellResult>
}

export type ShellExecutorFactory = (rootPath: string) => ShellExecutor
