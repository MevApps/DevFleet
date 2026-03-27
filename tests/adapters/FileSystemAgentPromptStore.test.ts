import { FileSystemAgentPromptStore } from "@adapters/filesystem/FileSystemAgentPromptStore"
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"

describe("FileSystemAgentPromptStore", () => {
  let dir: string
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), "prompt-test-")); writeFileSync(join(dir, "developer.md"), "You are a developer.") })
  afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

  it("reads a prompt file", async () => {
    const store = new FileSystemAgentPromptStore(dir)
    const content = await store.read("developer")
    expect(content).toBe("You are a developer.")
  })

  it("updates a prompt file", async () => {
    const store = new FileSystemAgentPromptStore(dir)
    await store.update("developer", "You are a senior developer.", "improve quality")
    const raw = readFileSync(join(dir, "developer.md"), "utf-8")
    expect(raw).toBe("You are a senior developer.")
  })
})
