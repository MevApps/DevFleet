import type { FileSystem } from "./ports/FileSystem"
import type { ShellExecutor } from "./ports/ShellExecutor"
import type { ToolCall } from "./ports/AIProvider"

export interface ToolResult {
  readonly id: string
  readonly name: string
  readonly success: boolean
  readonly output: string
  readonly error?: string
}

export class ExecuteToolCalls {
  constructor(
    private readonly fs: FileSystem,
    private readonly shell: ShellExecutor,
  ) {}

  async execute(toolCalls: ReadonlyArray<ToolCall>): Promise<ToolResult[]> {
    const results: ToolResult[] = []

    for (const call of toolCalls) {
      try {
        const output = await this.runTool(call)
        results.push({ id: call.id, name: call.name, success: true, output })
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        results.push({ id: call.id, name: call.name, success: false, output: "", error: msg })
      }
    }

    return results
  }

  private async runTool(call: ToolCall): Promise<string> {
    switch (call.name) {
      case "file_read": {
        const path = call.input["path"] as string
        return await this.fs.read(path)
      }
      case "file_write": {
        const path = call.input["path"] as string
        const content = call.input["content"] as string
        await this.fs.write(path, content)
        return `Written to ${path}`
      }
      case "file_edit": {
        const path = call.input["path"] as string
        const oldContent = call.input["oldContent"] as string
        const newContent = call.input["newContent"] as string
        await this.fs.edit(path, oldContent, newContent)
        return `Edited ${path}`
      }
      case "file_glob": {
        const pattern = call.input["pattern"] as string
        const files = await this.fs.glob(pattern)
        return files.join("\n")
      }
      case "shell_run": {
        const rawCommand = call.input["command"] as string
        const timeout = call.input["timeout"] as number | undefined
        const parts = rawCommand.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [rawCommand]
        const command = parts[0]!
        const args = parts.slice(1).map(p => p.replace(/^"|"$/g, ""))
        const result = await this.shell.execute(command, args, timeout)
        return result.stdout + (result.stderr ? `\nSTDERR: ${result.stderr}` : "")
      }
      default:
        throw new Error(`Unknown tool: ${call.name}`)
    }
  }
}
