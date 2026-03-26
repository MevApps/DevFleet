import { NodeWorktreeManager } from "../../src/adapters/worktree/NodeWorktreeManager"
import { NodeShellExecutor } from "../../src/adapters/shell/NodeShellExecutor"
import { mkdtempSync, writeFileSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { execSync } from "node:child_process"

describe("NodeWorktreeManager", () => {
  let repoDir: string
  let mgr: NodeWorktreeManager

  beforeEach(() => {
    repoDir = mkdtempSync(join(tmpdir(), "devfleet-test-"))
    execSync(
      'git init && git config user.email "test@test.com" && git config user.name "Test" && git commit --allow-empty -m init',
      { cwd: repoDir },
    )
    const shell = new NodeShellExecutor(repoDir)
    mgr = new NodeWorktreeManager(shell, repoDir)
  })

  it("creates a worktree and reports it exists", async () => {
    const path = await mgr.create("test-branch")
    expect(path).toContain("test-branch")
    expect(await mgr.exists("test-branch")).toBe(true)
  })

  it("deletes a worktree", async () => {
    await mgr.create("del-branch")
    await mgr.delete("del-branch")
    expect(await mgr.exists("del-branch")).toBe(false)
  })

  it("merges a worktree branch", async () => {
    const path = await mgr.create("merge-branch")
    writeFileSync(join(path, "test.txt"), "hello")
    execSync(
      'git config user.email "test@test.com" && git config user.name "Test" && git add . && git commit -m "add test"',
      { cwd: path },
    )

    const result = await mgr.merge("merge-branch")
    expect(result.success).toBe(true)
  })
})
