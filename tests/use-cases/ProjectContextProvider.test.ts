import { describe, it, expect } from "vitest"
import { NodeProjectContextProvider } from "../../src/adapters/context/NodeProjectContextProvider"
import { tmpdir } from "node:os"
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs"
import { join } from "node:path"

describe("NodeProjectContextProvider", () => {
  it("reads CLAUDE.md when present", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"))
    writeFileSync(join(dir, "CLAUDE.md"), "# Project Rules\nUse TypeScript.")
    writeFileSync(join(dir, "package.json"), "{}")
    mkdirSync(join(dir, "src"))
    writeFileSync(join(dir, "src", "index.ts"), "export {}")

    const provider = new NodeProjectContextProvider(dir)
    const ctx = await provider.getContext()

    expect(ctx.claudeMd).toContain("Project Rules")
    expect(ctx.projectConfig.language).toBe("typescript")
    expect(ctx.fileTree).toContain("src")
  })

  it("returns empty claudeMd when no CLAUDE.md exists", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"))
    writeFileSync(join(dir, "package.json"), "{}")

    const provider = new NodeProjectContextProvider(dir)
    const ctx = await provider.getContext()

    expect(ctx.claudeMd).toBe("")
  })

  it("caches result on second call", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ctx-test-"))
    writeFileSync(join(dir, "package.json"), "{}")

    const provider = new NodeProjectContextProvider(dir)
    const ctx1 = await provider.getContext()
    const ctx2 = await provider.getContext()

    expect(ctx1).toBe(ctx2) // same reference — cached
  })
})
