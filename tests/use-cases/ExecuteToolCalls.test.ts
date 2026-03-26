import { ExecuteToolCalls } from "../../src/use-cases/ExecuteToolCalls"
import type { FileSystem } from "../../src/use-cases/ports/FileSystem"
import type { ShellExecutor } from "../../src/use-cases/ports/ShellExecutor"
import type { ToolCall } from "../../src/use-cases/ports/AIProvider"

function makeToolCall(name: string, input: Record<string, unknown>): ToolCall {
  return { id: `tc-${name}`, name, input }
}

const mockFs: FileSystem = {
  read: async (path) => `contents of ${path}`,
  write: async () => undefined,
  edit: async () => undefined,
  glob: async (pattern) => [`file1.ts`, `file2.ts`],
  exists: async () => true,
}

const mockShell: ShellExecutor = {
  execute: async (command) => ({ stdout: `ran: ${command}`, stderr: "", exitCode: 0 }),
}

describe("ExecuteToolCalls", () => {
  it("executes file_read and returns content", async () => {
    const uc = new ExecuteToolCalls(mockFs, mockShell)
    const results = await uc.execute([makeToolCall("file_read", { path: "src/index.ts" })])

    expect(results).toHaveLength(1)
    expect(results[0].success).toBe(true)
    expect(results[0].output).toContain("contents of src/index.ts")
  })

  it("executes file_write and returns success", async () => {
    const written: Array<{ path: string; content: string }> = []
    const fs: FileSystem = { ...mockFs, write: async (path, content) => { written.push({ path, content }) } }
    const uc = new ExecuteToolCalls(fs, mockShell)
    const results = await uc.execute([makeToolCall("file_write", { path: "out.ts", content: "export {}" })])

    expect(results[0].success).toBe(true)
    expect(written).toHaveLength(1)
    expect(written[0].path).toBe("out.ts")
  })

  it("executes file_edit and returns success", async () => {
    const uc = new ExecuteToolCalls(mockFs, mockShell)
    const results = await uc.execute([
      makeToolCall("file_edit", { path: "src/x.ts", oldContent: "old", newContent: "new" }),
    ])
    expect(results[0].success).toBe(true)
  })

  it("executes file_glob and returns matched paths", async () => {
    const uc = new ExecuteToolCalls(mockFs, mockShell)
    const results = await uc.execute([makeToolCall("file_glob", { pattern: "**/*.ts" })])

    expect(results[0].success).toBe(true)
    expect(results[0].output).toContain("file1.ts")
  })

  it("executes shell_run and returns stdout", async () => {
    const uc = new ExecuteToolCalls(mockFs, mockShell)
    const results = await uc.execute([makeToolCall("shell_run", { command: "ls -la" })])

    expect(results[0].success).toBe(true)
    expect(results[0].output).toContain("ran: ls -la")
  })

  it("returns error for unknown tool", async () => {
    const uc = new ExecuteToolCalls(mockFs, mockShell)
    const results = await uc.execute([makeToolCall("unknown_tool", {})])

    expect(results[0].success).toBe(false)
    expect(results[0].error).toMatch(/unknown tool/i)
  })

  it("returns error result when tool throws (not all-or-nothing)", async () => {
    const failFs: FileSystem = {
      ...mockFs,
      read: async () => { throw new Error("permission denied") },
    }
    const uc = new ExecuteToolCalls(failFs, mockShell)
    const results = await uc.execute([
      makeToolCall("file_read", { path: "secret.ts" }),
      makeToolCall("shell_run", { command: "echo ok" }),
    ])

    expect(results[0].success).toBe(false)
    expect(results[0].error).toContain("permission denied")
    expect(results[1].success).toBe(true)
  })
})
