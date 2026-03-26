import { InMemoryWorktreeManager } from "../../src/adapters/storage/InMemoryWorktreeManager"

describe("InMemoryWorktreeManager", () => {
  let mgr: InMemoryWorktreeManager

  beforeEach(() => { mgr = new InMemoryWorktreeManager() })

  it("creates and checks existence", async () => {
    const path = await mgr.create("feat/foo")
    expect(path).toContain("feat/foo")
    expect(await mgr.exists("feat/foo")).toBe(true)
  })

  it("deletes worktree", async () => {
    await mgr.create("feat/bar")
    await mgr.delete("feat/bar")
    expect(await mgr.exists("feat/bar")).toBe(false)
  })

  it("merge succeeds with fake commit", async () => {
    await mgr.create("feat/baz")
    const result = await mgr.merge("feat/baz")
    expect(result.success).toBe(true)
    if (result.success) expect(result.commit).toBeDefined()
  })

  it("merge fails for non-existent branch", async () => {
    const result = await mgr.merge("nope")
    expect(result.success).toBe(false)
  })
})
