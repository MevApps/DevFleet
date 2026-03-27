import { readFile, writeFile, readdir } from "node:fs/promises"
import { join } from "node:path"
import type { SkillStore } from "../../use-cases/ports/SkillStore"

export class FileSystemSkillStore implements SkillStore {
  constructor(private readonly dir: string) {}

  async read(skillName: string): Promise<string> {
    return readFile(join(this.dir, `${skillName}.md`), "utf-8")
  }

  async update(skillName: string, content: string, _reason: string): Promise<void> {
    await writeFile(join(this.dir, `${skillName}.md`), content, "utf-8")
  }

  async list(): Promise<ReadonlyArray<string>> {
    const files = await readdir(this.dir)
    return files.filter(f => f.endsWith(".md")).map(f => f.replace(/\.md$/, ""))
  }
}
