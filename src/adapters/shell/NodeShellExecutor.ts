import { execFile } from "node:child_process"
import type { ShellExecutor, ShellResult } from "../../use-cases/ports/ShellExecutor"

const DEFAULT_TIMEOUT_MS = 30_000

export class NodeShellExecutor implements ShellExecutor {
  constructor(private readonly cwd: string = process.cwd()) {}

  execute(command: string, args: readonly string[], timeout?: number): Promise<ShellResult> {
    return new Promise((resolve) => {
      execFile(
        command,
        args as string[],
        { cwd: this.cwd, timeout: timeout ?? DEFAULT_TIMEOUT_MS },
        (err, stdout, stderr) => {
          if (err === null) {
            resolve({ stdout, stderr, exitCode: 0 })
          } else {
            resolve({
              stdout: err.killed ? "" : (stdout ?? ""),
              stderr: err.killed ? `Process timed out after ${timeout ?? DEFAULT_TIMEOUT_MS}ms` : (stderr ?? String(err)),
              exitCode: typeof err.code === "number" ? err.code : 1,
            })
          }
        },
      )
    })
  }
}
