import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { WorkspaceIsolator, WorkspaceHandle } from "../../use-cases/ports/WorkspaceIsolator"
import type { ShellExecutorFactory } from "../../use-cases/ports/ShellExecutor"

export class GitCloneIsolator implements WorkspaceIsolator {
  private readonly paths = new Map<string, string>()

  constructor(private readonly shellFactory: ShellExecutorFactory) {}

  async create(repoUrl: string): Promise<WorkspaceHandle> {
    const clonePath = mkdtempSync(join(tmpdir(), "devfleet-workspace-"))
    const handle: WorkspaceHandle = { id: `ws-${Date.now().toString(36)}` }
    const parentShell = this.shellFactory(join(clonePath, ".."))
    await parentShell.execute("git", ["clone", repoUrl, clonePath])
    this.paths.set(handle.id, clonePath)
    return handle
  }

  async createBranch(handle: WorkspaceHandle, branchName: string): Promise<void> {
    const dir = this.getWorkspaceDir(handle)
    const shell = this.shellFactory(dir)
    console.log(`[GitCloneIsolator] creating branch "${branchName}" in ${dir}`)
    const result = await shell.execute("git", ["checkout", "-b", branchName])
    if (result.exitCode !== 0) {
      throw new Error(`git checkout -b failed: ${result.stderr}`)
    }
    console.log("[GitCloneIsolator] branch created successfully")
  }

  async detectDefaultBranch(handle: WorkspaceHandle): Promise<string> {
    const dir = this.getWorkspaceDir(handle)
    const shell = this.shellFactory(dir)
    const result = await shell.execute("git", ["rev-parse", "--abbrev-ref", "origin/HEAD"])
    if (result.exitCode === 0) {
      const branch = result.stdout.trim().replace("origin/", "")
      if (branch && branch !== "HEAD") return branch
    }
    // Fallback: check for master or main
    const branches = await shell.execute("git", ["branch", "-r"])
    if (branches.stdout.includes("origin/main")) return "main"
    return "master"
  }

  async installDependencies(handle: WorkspaceHandle, installCommand: string): Promise<void> {
    const dir = this.getWorkspaceDir(handle)
    if (!installCommand) return
    const scopedShell = this.shellFactory(dir)
    const parts = installCommand.split(/\s+/)
    const command = parts[0]!
    const args = parts.slice(1)
    console.log(`[GitCloneIsolator] running "${installCommand}" in ${dir}`)
    let result = await scopedShell.execute(command, args, 180_000)
    if (result.exitCode !== 0 && command === "npm" && args[0] === "install") {
      // Retry with --legacy-peer-deps for projects with peer dependency conflicts
      console.log("[GitCloneIsolator] retrying with --legacy-peer-deps")
      result = await scopedShell.execute(command, [...args, "--legacy-peer-deps"], 180_000)
    }
    if (result.exitCode !== 0) {
      console.error(`[GitCloneIsolator] install failed (exit ${result.exitCode}):`, result.stderr.slice(0, 500))
    } else {
      console.log("[GitCloneIsolator] install succeeded")
    }
  }

  getWorkspaceDir(handle: WorkspaceHandle): string {
    const path = this.paths.get(handle.id)
    if (!path) throw new Error(`Unknown workspace handle: ${handle.id}`)
    return path
  }

  async cleanup(handle: WorkspaceHandle): Promise<void> {
    const path = this.paths.get(handle.id)
    if (path) {
      rmSync(path, { recursive: true, force: true })
      this.paths.delete(handle.id)
    }
  }
}
