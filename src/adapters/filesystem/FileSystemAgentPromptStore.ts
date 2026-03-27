import { readFile, writeFile } from "node:fs/promises"
import { join } from "node:path"
import type { AgentPromptStore } from "../../use-cases/ports/AgentPromptStore"

export class FileSystemAgentPromptStore implements AgentPromptStore {
  constructor(private readonly dir: string) {}

  async read(role: string): Promise<string> {
    return readFile(join(this.dir, `${role}.md`), "utf-8")
  }

  async update(role: string, content: string, _reason: string): Promise<void> {
    await writeFile(join(this.dir, `${role}.md`), content, "utf-8")
  }
}
