import { GitCloneIsolator } from "../../src/adapters/workspace/GitCloneIsolator"
import { NodeShellExecutor } from "../../src/adapters/shell/NodeShellExecutor"
import type { ShellExecutorFactory } from "../../src/use-cases/ports/ShellExecutor"
import { mkdtempSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { execSync } from "node:child_process"

describe("GitCloneIsolator", () => {
  let sourceRepo: string
  let isolator: GitCloneIsolator
  const shellFactory: ShellExecutorFactory = (rootPath: string) => new NodeShellExecutor(rootPath)

  beforeEach(() => {
    sourceRepo = mkdtempSync(join(tmpdir(), "devfleet-source-"))
    execSync(
      'git init && git config user.email "test@test.com" && git config user.name "Test" && git commit --allow-empty -m init',
      { cwd: sourceRepo },
    )
    isolator = new GitCloneIsolator(shellFactory)
  })

  it("clones a repo and returns a handle", async () => {
    const handle = await isolator.create(sourceRepo)
    expect(handle.id).toBeTruthy()
    const dir = isolator.getWorkspaceDir(handle)
    expect(existsSync(join(dir, ".git"))).toBe(true)
  })

  it("cleanup removes the clone directory", async () => {
    const handle = await isolator.create(sourceRepo)
    const dir = isolator.getWorkspaceDir(handle)
    expect(existsSync(dir)).toBe(true)
    await isolator.cleanup(handle)
    expect(existsSync(dir)).toBe(false)
  })

  it("throws for unknown handle", () => {
    expect(() => isolator.getWorkspaceDir({ id: "unknown" })).toThrow("Unknown workspace handle")
  })
})
