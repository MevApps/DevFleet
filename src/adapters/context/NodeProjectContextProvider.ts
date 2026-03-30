import { readFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import type { ProjectContext, ProjectContextProvider } from "../../use-cases/ports/ProjectContextProvider"
import { DetectProjectConfig } from "../../use-cases/DetectProjectConfig"
import { NodeFileSystem } from "../filesystem/NodeFileSystem"

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", ".next", "build", "coverage", ".worktrees"])
const MAX_DEPTH = 3

export class NodeProjectContextProvider implements ProjectContextProvider {
  private cached: ProjectContext | null = null

  constructor(private readonly rootDir: string) {}

  async getContext(): Promise<ProjectContext> {
    if (this.cached) return this.cached

    const claudeMd = await this.readClaudeMd()
    const fs = new NodeFileSystem(this.rootDir)
    const detector = new DetectProjectConfig(fs)
    const projectConfig = await detector.execute()
    const fileTree = await this.buildFileTree()

    this.cached = { claudeMd, projectConfig, fileTree }
    return this.cached
  }

  private async readClaudeMd(): Promise<string> {
    try {
      return await readFile(join(this.rootDir, "CLAUDE.md"), "utf-8")
    } catch {
      return ""
    }
  }

  private async buildFileTree(dir?: string, depth: number = 0): Promise<string> {
    if (depth >= MAX_DEPTH) return ""
    const currentDir = dir ?? this.rootDir
    const lines: string[] = []

    try {
      const entries = await readdir(currentDir, { withFileTypes: true })
      const sorted = entries
        .filter(e => !IGNORED_DIRS.has(e.name) && !e.name.startsWith("."))
        .sort((a, b) => {
          if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1
          return a.name.localeCompare(b.name)
        })

      for (const entry of sorted) {
        const indent = "  ".repeat(depth)
        if (entry.isDirectory()) {
          lines.push(`${indent}${entry.name}/`)
          const subtree = await this.buildFileTree(join(currentDir, entry.name), depth + 1)
          if (subtree) lines.push(subtree)
        } else {
          lines.push(`${indent}${entry.name}`)
        }
      }
    } catch { /* directory not readable */ }

    return lines.join("\n")
  }
}
