import { readFile, writeFile, access, readdir } from "node:fs/promises"
import { resolve, relative } from "node:path"
import type { FileSystem } from "../../use-cases/ports/FileSystem"

export class NodeFileSystem implements FileSystem {
  constructor(private readonly rootDir: string) {}

  private resolveSafe(filePath: string): string {
    const resolved = resolve(this.rootDir, filePath)
    const rel = relative(this.rootDir, resolved)
    if (rel.startsWith("..")) {
      throw new Error(`Path traversal detected: ${filePath}`)
    }
    return resolved
  }

  async read(filePath: string): Promise<string> {
    const safe = this.resolveSafe(filePath)
    return readFile(safe, "utf-8")
  }

  async write(filePath: string, content: string): Promise<void> {
    const safe = this.resolveSafe(filePath)
    await writeFile(safe, content, "utf-8")
  }

  async edit(filePath: string, oldContent: string, newContent: string): Promise<void> {
    const safe = this.resolveSafe(filePath)
    const existing = await readFile(safe, "utf-8")
    if (!existing.includes(oldContent)) {
      throw new Error(`Old content not found in ${filePath}`)
    }
    const updated = existing.replace(oldContent, newContent)
    await writeFile(safe, updated, "utf-8")
  }

  async glob(_pattern: string): Promise<ReadonlyArray<string>> {
    try {
      const entries = await readdir(this.rootDir, { recursive: true })
      return entries.filter((e): e is string => typeof e === "string")
    } catch {
      return []
    }
  }

  async exists(filePath: string): Promise<boolean> {
    try {
      const safe = this.resolveSafe(filePath)
      await access(safe)
      return true
    } catch {
      return false
    }
  }
}
