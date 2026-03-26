import { exec } from "node:child_process"
import { promisify } from "node:util"
import type { ShellExecutor, ShellResult } from "../../use-cases/ports/ShellExecutor"

const execAsync = promisify(exec)

const DEFAULT_TIMEOUT_MS = 30_000

export class NodeShellExecutor implements ShellExecutor {
  constructor(private readonly cwd: string = process.cwd()) {}

  async execute(command: string, timeout?: number): Promise<ShellResult> {
    try {
      const { stdout, stderr } = await execAsync(command, {
        cwd: this.cwd,
        timeout: timeout ?? DEFAULT_TIMEOUT_MS,
      })
      return { stdout, stderr, exitCode: 0 }
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string; code?: number }
      return {
        stdout: error.stdout ?? "",
        stderr: error.stderr ?? String(err),
        exitCode: error.code ?? 1,
      }
    }
  }
}
