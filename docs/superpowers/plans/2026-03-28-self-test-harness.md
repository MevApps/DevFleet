# Self-Test Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable DevFleet to run against its own codebase with real AI, producing real code changes in an isolated clone.

**Architecture:** Three layers (A: infrastructure honesty, B: project detection, C: self-test harness), each a separate PR with its own tests. Layer A fixes dead-code wiring and shell safety. Layer B adds project-aware configuration. Layer C is the actual self-test.

**Tech Stack:** TypeScript, Jest, Node.js child_process (execFile), git worktrees

**Spec:** `docs/superpowers/specs/2026-03-28-self-test-harness-design.md`

---

## File Map

### Layer A — Infrastructure Honesty

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/use-cases/ports/ShellExecutor.ts` | Change `execute` signature to array-based args |
| Modify | `src/adapters/shell/NodeShellExecutor.ts` | Switch from `exec` to `execFile` |
| Modify | `src/infrastructure/config/composition-root.ts` | Wire `NodeWorktreeManager` when not mock; add `cleanupAll` to stop; remove mock shell string API |
| Modify | `src/adapters/worktree/NodeWorktreeManager.ts` | Update all `execute` calls to array args; add `cleanupAll` |
| Modify | `src/use-cases/ports/WorktreeManager.ts` | Add `cleanupAll()` to port |
| Modify | `src/adapters/storage/InMemoryWorktreeManager.ts` | Implement `cleanupAll` (no-op) |
| Modify | `src/use-cases/ExecuteToolCalls.ts` | Update `shell_run` case to split command into args |
| Modify | `src/adapters/plugins/agents/DeveloperPlugin.ts` | Make `bus`, `worktreeManager`, `scopedExecutorFactory` required |
| Modify | `tests/adapters/DeveloperPlugin.test.ts` | Provide explicit test doubles for now-required deps |
| Modify | `tests/adapters/NodeWorktreeManager.test.ts` | Update `shell.execute` calls for new signature |

### Layer B — Project Detection

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/entities/ProjectConfig.ts` | `ProjectConfig` value object + `createProjectConfig` factory |
| Create | `src/use-cases/DetectProjectConfig.ts` | Scans filesystem for marker files, returns `ProjectConfig` |
| Modify | `src/entities/Message.ts` | Add `ProjectDetectedMessage` to union |
| Modify | `src/adapters/plugins/agents/SupervisorPlugin.ts` | Call `DetectProjectConfig` on `goal.created`, emit `project.detected` |
| Modify | `src/infrastructure/config/composition-root.ts` | Wire `DetectProjectConfig` use case, inject into Supervisor |
| Create | `tests/use-cases/DetectProjectConfig.test.ts` | Unit tests with mock FS |
| Create | `tests/integration/detect-project-config.test.ts` | Integration test against DevFleet's own repo |

### Layer C — Self-Test Harness

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `tests/integration/self-test.test.ts` | Jest-based self-test harness |
| Create | `scripts/self-test.sh` | Convenience wrapper script |

---

## Layer A: Infrastructure Honesty

### Task 1: Structured ShellExecutor Port

**Files:**
- Modify: `src/use-cases/ports/ShellExecutor.ts`
- Modify: `src/adapters/shell/NodeShellExecutor.ts`
- Test: `tests/adapters/NodeShellExecutor.test.ts` (create)

- [ ] **Step 1: Write failing test for array-based execute**

Create `tests/adapters/NodeShellExecutor.test.ts`:

```typescript
import { NodeShellExecutor } from "../../src/adapters/shell/NodeShellExecutor"

describe("NodeShellExecutor", () => {
  const shell = new NodeShellExecutor(process.cwd())

  it("executes a command with array args", async () => {
    const result = await shell.execute("echo", ["hello", "world"])
    expect(result.stdout.trim()).toBe("hello world")
    expect(result.exitCode).toBe(0)
  })

  it("returns non-zero exit code on failure", async () => {
    const result = await shell.execute("node", ["-e", "process.exit(42)"])
    expect(result.exitCode).toBe(42)
  })

  it("respects timeout", async () => {
    const result = await shell.execute("sleep", ["10"], 100)
    expect(result.exitCode).not.toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/adapters/NodeShellExecutor.test.ts -v`
Expected: FAIL — `execute` currently takes `(command: string, timeout?: number)`, not `(command, args, timeout)`

- [ ] **Step 3: Update ShellExecutor port**

In `src/use-cases/ports/ShellExecutor.ts`:

```typescript
export interface ShellResult {
  readonly stdout: string
  readonly stderr: string
  readonly exitCode: number
}

export interface ShellExecutor {
  execute(command: string, args: readonly string[], timeout?: number): Promise<ShellResult>
}

export type ShellExecutorFactory = (rootPath: string) => ShellExecutor
```

- [ ] **Step 4: Update NodeShellExecutor implementation**

In `src/adapters/shell/NodeShellExecutor.ts`:

```typescript
import { execFile } from "node:child_process"
import { promisify } from "node:util"
import type { ShellExecutor, ShellResult } from "../../use-cases/ports/ShellExecutor"

const execFileAsync = promisify(execFile)

const DEFAULT_TIMEOUT_MS = 30_000

export class NodeShellExecutor implements ShellExecutor {
  constructor(private readonly cwd: string = process.cwd()) {}

  async execute(command: string, args: readonly string[], timeout?: number): Promise<ShellResult> {
    try {
      const { stdout, stderr } = await execFileAsync(command, [...args], {
        cwd: this.cwd,
        timeout: timeout ?? DEFAULT_TIMEOUT_MS,
      })
      return { stdout, stderr, exitCode: 0 }
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string; code?: number }
      return {
        stdout: error.stdout ?? "",
        stderr: error.stderr ?? String(err),
        exitCode: error.code ?? 1,
      }
    }
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/adapters/NodeShellExecutor.test.ts -v`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/use-cases/ports/ShellExecutor.ts src/adapters/shell/NodeShellExecutor.ts tests/adapters/NodeShellExecutor.test.ts
git commit -m "refactor: change ShellExecutor port to array-based args"
```

---

### Task 2: Update All ShellExecutor Callers

**Files:**
- Modify: `src/adapters/worktree/NodeWorktreeManager.ts`
- Modify: `src/use-cases/ExecuteToolCalls.ts`
- Modify: `src/infrastructure/config/composition-root.ts` (MockShell + DeterministicProvider wiring)

- [ ] **Step 1: Update NodeWorktreeManager**

In `src/adapters/worktree/NodeWorktreeManager.ts`, replace all `shell.execute(string)` calls:

```typescript
import type { WorktreeManager, WorktreePath, MergeResult } from "../../use-cases/ports/WorktreeManager"
import type { ShellExecutor } from "../../use-cases/ports/ShellExecutor"
import { join } from "node:path"

const WORKTREES_DIR = ".worktrees"

export class NodeWorktreeManager implements WorktreeManager {
  constructor(
    private readonly shell: ShellExecutor,
    private readonly projectRoot: string,
  ) {}

  async create(branch: string, baseBranch?: string): Promise<WorktreePath> {
    const worktreePath = this.worktreePath(branch)
    const base = baseBranch ?? "HEAD"
    await this.shell.execute("git", ["worktree", "add", "-b", branch, worktreePath, base])
    return worktreePath
  }

  async delete(branch: string): Promise<void> {
    const worktreePath = this.worktreePath(branch)
    await this.shell.execute("git", ["worktree", "remove", worktreePath, "--force"])
    await this.shell.execute("git", ["branch", "-D", branch])
  }

  async merge(branch: string, _targetBranch?: string): Promise<MergeResult> {
    try {
      await this.shell.execute("git", ["merge", branch, "--no-edit"])
      const commitResult = await this.shell.execute("git", ["rev-parse", "HEAD"])
      const commit = commitResult.stdout.trim()

      const worktreePath = this.worktreePath(branch)
      await this.shell.execute("git", ["worktree", "remove", worktreePath, "--force"]).catch(() => {})
      await this.shell.execute("git", ["branch", "-D", branch]).catch(() => {})

      return { success: true, commit }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      return { success: false, error: msg }
    }
  }

  async exists(branch: string): Promise<boolean> {
    try {
      const result = await this.shell.execute("git", ["worktree", "list", "--porcelain"])
      return result.stdout.includes(branch)
    } catch {
      return false
    }
  }

  async cleanupAll(): Promise<void> {
    try {
      const result = await this.shell.execute("git", ["worktree", "list", "--porcelain"])
      const worktreePaths = result.stdout
        .split("\n")
        .filter(line => line.startsWith("worktree "))
        .map(line => line.replace("worktree ", ""))
        .filter(p => p.includes(WORKTREES_DIR))

      for (const wt of worktreePaths) {
        await this.shell.execute("git", ["worktree", "remove", wt, "--force"]).catch(() => {})
      }
    } catch {
      // Best-effort cleanup
    }
  }

  private worktreePath(branch: string): WorktreePath {
    return join(this.projectRoot, WORKTREES_DIR, branch)
  }
}
```

- [ ] **Step 2: Update ExecuteToolCalls shell_run case**

In `src/use-cases/ExecuteToolCalls.ts`, change the `shell_run` case to parse the command string into command + args. The AI agents emit `shell_run` tool calls with a single `command` string (e.g. `"npm test"`), so we need to split it:

```typescript
      case "shell_run": {
        const rawCommand = call.input["command"] as string
        const timeout = call.input["timeout"] as number | undefined
        const parts = rawCommand.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [rawCommand]
        const command = parts[0]!
        const args = parts.slice(1).map(p => p.replace(/^"|"$/g, ""))
        const result = await this.shell.execute(command, args, timeout)
        return result.stdout + (result.stderr ? `\nSTDERR: ${result.stderr}` : "")
      }
```

- [ ] **Step 3: Update MockShell in composition-root.ts**

In `src/infrastructure/config/composition-root.ts`, update `createMockShell`:

```typescript
function createMockShell(): ShellExecutor {
  return {
    async execute(_command: string, _args: readonly string[], _timeout?: number) {
      return { stdout: "10 passed, 0 failed", stderr: "", exitCode: 0 }
    },
  }
}
```

- [ ] **Step 4: Update DeterministicProvider tool calls**

In `src/infrastructure/config/composition-root.ts`, the `opsProvider` wiring passes shell commands as `{ name: "shell_run", input: { command: "npm run build" } }`. These are tool-call inputs, not direct shell calls — no change needed. The splitting happens in `ExecuteToolCalls`.

Verify this is correct — no changes needed to DeterministicProvider or its wiring.

- [ ] **Step 5: Run full test suite**

Run: `npx jest --verbose`
Expected: Many tests will fail due to callers still using old signature. That's expected — we fix those in the next step.

- [ ] **Step 6: Update NodeWorktreeManager test**

In `tests/adapters/NodeWorktreeManager.test.ts`, the test directly uses `NodeShellExecutor` which now has the new signature. The test itself doesn't call `shell.execute` directly — it uses `NodeWorktreeManager` methods which we already updated. Verify:

Run: `npx jest tests/adapters/NodeWorktreeManager.test.ts -v`
Expected: PASS

- [ ] **Step 7: Run full test suite again**

Run: `npx jest --verbose`
Expected: All 276+ tests pass. If any fail, fix the callers.

- [ ] **Step 8: Commit**

```bash
git add src/adapters/worktree/NodeWorktreeManager.ts src/use-cases/ExecuteToolCalls.ts src/infrastructure/config/composition-root.ts tests/adapters/NodeWorktreeManager.test.ts
git commit -m "refactor: update all ShellExecutor callers to array-based args"
```

---

### Task 3: WorktreeManager cleanupAll + Port Update

**Files:**
- Modify: `src/use-cases/ports/WorktreeManager.ts`
- Modify: `src/adapters/storage/InMemoryWorktreeManager.ts`
- Test: `tests/adapters/NodeWorktreeManager.test.ts` (add cleanupAll test)

- [ ] **Step 1: Write failing test for cleanupAll**

Add to `tests/adapters/NodeWorktreeManager.test.ts`:

```typescript
  it("cleanupAll removes all worktrees in .worktrees dir", async () => {
    await mgr.create("cleanup-a")
    await mgr.create("cleanup-b")
    expect(await mgr.exists("cleanup-a")).toBe(true)
    expect(await mgr.exists("cleanup-b")).toBe(true)

    await mgr.cleanupAll()

    expect(await mgr.exists("cleanup-a")).toBe(false)
    expect(await mgr.exists("cleanup-b")).toBe(false)
  })
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/adapters/NodeWorktreeManager.test.ts -v -t "cleanupAll"`
Expected: FAIL — `cleanupAll` is not on the `WorktreeManager` interface yet

- [ ] **Step 3: Add cleanupAll to WorktreeManager port**

In `src/use-cases/ports/WorktreeManager.ts`:

```typescript
export type WorktreePath = string

export type MergeResult =
  | { readonly success: true; readonly commit: string }
  | { readonly success: false; readonly error: string }

export interface WorktreeManager {
  create(branch: string, baseBranch?: string): Promise<WorktreePath>
  delete(branch: string): Promise<void>
  merge(branch: string, targetBranch?: string): Promise<MergeResult>
  exists(branch: string): Promise<boolean>
  cleanupAll(): Promise<void>
}
```

- [ ] **Step 4: Implement cleanupAll in InMemoryWorktreeManager**

In `src/adapters/storage/InMemoryWorktreeManager.ts`:

```typescript
  async cleanupAll(): Promise<void> {
    this.branches.clear()
  }
```

- [ ] **Step 5: Run test to verify it passes**

`NodeWorktreeManager` already has `cleanupAll` from Task 2.

Run: `npx jest tests/adapters/NodeWorktreeManager.test.ts -v`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/use-cases/ports/WorktreeManager.ts src/adapters/storage/InMemoryWorktreeManager.ts tests/adapters/NodeWorktreeManager.test.ts
git commit -m "feat: add cleanupAll to WorktreeManager port"
```

---

### Task 4: Wire NodeWorktreeManager + cleanupAll in Composition Root

**Files:**
- Modify: `src/infrastructure/config/composition-root.ts`

- [ ] **Step 1: Update composition root to conditionally wire NodeWorktreeManager**

In `src/infrastructure/config/composition-root.ts`, add import:

```typescript
import { NodeWorktreeManager } from "../../adapters/worktree/NodeWorktreeManager"
```

Replace line 277 (`const worktreeManager = new InMemoryWorktreeManager()`):

```typescript
  const worktreeManager = useMock
    ? new InMemoryWorktreeManager()
    : new NodeWorktreeManager(shell as NodeShellExecutor, config.workspaceDir)
```

Note: `shell` is already declared as `ShellExecutor` — `NodeWorktreeManager` takes `ShellExecutor`, so the cast is not needed. Just:

```typescript
  const worktreeManager = useMock
    ? new InMemoryWorktreeManager()
    : new NodeWorktreeManager(shell, config.workspaceDir)
```

- [ ] **Step 2: Add cleanupAll to system.stop()**

In the `stop` function of the returned system object, add worktree cleanup before stopping plugins:

```typescript
    stop: async () => {
      if (stuckAgentInterval !== null) {
        clearInterval(stuckAgentInterval)
        stuckAgentInterval = null
      }
      await worktreeManager.cleanupAll()
      sseManager.shutdown()
      await pluginRegistry.stopAll()
    },
```

- [ ] **Step 3: Run full test suite**

Run: `npx jest --verbose`
Expected: PASS — mock mode still uses `InMemoryWorktreeManager`, so existing tests are unaffected.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/config/composition-root.ts
git commit -m "feat: wire NodeWorktreeManager in production mode, cleanupAll on stop"
```

---

### Task 5: Honest DeveloperPluginDeps

**Files:**
- Modify: `src/adapters/plugins/agents/DeveloperPlugin.ts`
- Modify: `tests/adapters/DeveloperPlugin.test.ts`

- [ ] **Step 1: Make deps required in DeveloperPlugin**

In `src/adapters/plugins/agents/DeveloperPlugin.ts`, update the `DeveloperPluginDeps` interface:

```typescript
export interface DeveloperPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly executor: AgentExecutor
  readonly taskRepo: TaskRepository
  readonly systemPrompt: string
  readonly model: string
  readonly bus: MessagePort
  readonly worktreeManager: WorktreeManager
  readonly scopedExecutorFactory: ScopedExecutorFactory
}
```

Remove the `?` from `bus`, `worktreeManager`, and `scopedExecutorFactory`.

Update the `handle` method — remove the optional chaining:

```typescript
  async handle(message: Message): Promise<void> {
    if (message.type !== "task.assigned") return
    if (message.agentId !== this.deps.agentId) return

    const task = await this.deps.taskRepo.findById(message.taskId)
    if (!task) return

    // Create worktree isolation
    const branchName = `devfleet/task-${task.id}`
    const worktreePath = await this.deps.worktreeManager.create(branchName)
    const updatedTask = { ...task, branch: branchName, version: task.version + 1 }
    await this.deps.taskRepo.update(updatedTask)

    // Use scoped executor for the worktree path
    const executor = this.deps.scopedExecutorFactory(worktreePath)

    const config = {
      role: ROLES.DEVELOPER,
      systemPrompt: this.deps.systemPrompt,
      tools: DEVELOPER_TOOLS,
      model: this.deps.model,
      budget: task.budget,
    }

    for await (const event of executor.run(this.deps.agentId, config, task, this.deps.projectId)) {
      if (event.type === "task_completed") {
        await this.deps.bus.emit({
          id: createMessageId(),
          type: "code.completed",
          taskId: message.taskId,
          artifactId: createArtifactId(),
          branch: branchName,
          filesChanged: 0,
          testsWritten: 0,
          timestamp: new Date(),
        })
      }
    }
  }
```

Remove the unused imports: `FileSystemFactory`, `ShellExecutorFactory`.

- [ ] **Step 2: Update DeveloperPlugin tests to provide required deps**

In `tests/adapters/DeveloperPlugin.test.ts`, update the `beforeEach` to provide all required deps:

```typescript
  const bus = new InMemoryBus()
  const mockWorktree = {
    create: jest.fn().mockResolvedValue("/tmp/mock-worktree"),
    delete: jest.fn().mockResolvedValue(undefined),
    merge: jest.fn().mockResolvedValue({ success: true, commit: "abc" }),
    exists: jest.fn().mockResolvedValue(false),
    cleanupAll: jest.fn().mockResolvedValue(undefined),
  }
  const mockScopedFactory = jest.fn().mockReturnValue(mockExecutor)

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo()

    async function* emptyGen(): AsyncIterable<AgentEvent> {}
    mockExecutor = {
      run: jest.fn().mockReturnValue(emptyGen()),
    }

    mockScopedFactory.mockReturnValue(mockExecutor)

    plugin = new DeveloperPlugin({
      agentId,
      projectId,
      executor: mockExecutor,
      taskRepo,
      systemPrompt: "You are a developer",
      model: "claude-3-5-sonnet-20241022",
      bus,
      worktreeManager: mockWorktree,
      scopedExecutorFactory: mockScopedFactory,
    })
  })
```

Update the "bus emission" test and "worktree isolation" test to match the new always-creates-worktree behavior. The bus test no longer needs a separate `pluginWithBus` — the main `plugin` already has a bus. The worktree test now verifies that every handle call creates a worktree.

- [ ] **Step 3: Run DeveloperPlugin tests**

Run: `npx jest tests/adapters/DeveloperPlugin.test.ts -v`
Expected: PASS

- [ ] **Step 4: Run full test suite**

Run: `npx jest --verbose`
Expected: PASS — composition root already provides all deps to DeveloperPlugin.

- [ ] **Step 5: Commit**

```bash
git add src/adapters/plugins/agents/DeveloperPlugin.ts tests/adapters/DeveloperPlugin.test.ts
git commit -m "refactor: make DeveloperPlugin deps required, no silent degradation"
```

---

### Task 6: Layer A Verification

- [ ] **Step 1: Run full test suite**

Run: `npx jest --verbose`
Expected: All tests pass (276+)

- [ ] **Step 2: Run NodeWorktreeManager integration test**

Run: `npx jest tests/adapters/NodeWorktreeManager.test.ts -v`
Expected: PASS (4 tests: create, delete, merge, cleanupAll)

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit and tag as Layer A complete**

```bash
git commit --allow-empty -m "chore: Layer A (infrastructure honesty) complete"
```

---

## Layer B: Project Detection

### Task 7: ProjectConfig Value Object

**Files:**
- Create: `src/entities/ProjectConfig.ts`
- Test: `tests/entities/ProjectConfig.test.ts` (create)

- [ ] **Step 1: Write failing test**

Create `tests/entities/ProjectConfig.test.ts`:

```typescript
import { createProjectConfig, type ProjectConfig } from "../../src/entities/ProjectConfig"

describe("ProjectConfig", () => {
  it("creates a valid project config", () => {
    const config = createProjectConfig({
      language: "typescript",
      buildCommand: "npm run build",
      testCommand: "npm test",
      sourceRoots: ["src"],
    })

    expect(config.language).toBe("typescript")
    expect(config.buildCommand).toBe("npm run build")
    expect(config.testCommand).toBe("npm test")
    expect(config.sourceRoots).toEqual(["src"])
  })

  it("freezes the returned object", () => {
    const config = createProjectConfig({
      language: "rust",
      buildCommand: "cargo build",
      testCommand: "cargo test",
      sourceRoots: ["src"],
    })

    expect(() => { (config as any).language = "go" }).toThrow()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/entities/ProjectConfig.test.ts -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement ProjectConfig**

Create `src/entities/ProjectConfig.ts`:

```typescript
export interface ProjectConfig {
  readonly language: string
  readonly buildCommand: string
  readonly testCommand: string
  readonly sourceRoots: readonly string[]
}

export function createProjectConfig(params: {
  language: string
  buildCommand: string
  testCommand: string
  sourceRoots: readonly string[]
}): ProjectConfig {
  return Object.freeze({
    language: params.language,
    buildCommand: params.buildCommand,
    testCommand: params.testCommand,
    sourceRoots: Object.freeze([...params.sourceRoots]),
  })
}

export const UNKNOWN_PROJECT_CONFIG: ProjectConfig = Object.freeze({
  language: "unknown",
  buildCommand: "echo no-build",
  testCommand: "echo no-test",
  sourceRoots: Object.freeze(["."]),
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/entities/ProjectConfig.test.ts -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/entities/ProjectConfig.ts tests/entities/ProjectConfig.test.ts
git commit -m "feat: add ProjectConfig value object"
```

---

### Task 8: DetectProjectConfig Use Case

**Files:**
- Create: `src/use-cases/DetectProjectConfig.ts`
- Test: `tests/use-cases/DetectProjectConfig.test.ts` (create)

- [ ] **Step 1: Write failing tests**

Create `tests/use-cases/DetectProjectConfig.test.ts`:

```typescript
import { DetectProjectConfig } from "../../src/use-cases/DetectProjectConfig"
import type { FileSystem } from "../../src/use-cases/ports/FileSystem"

function mockFs(files: Record<string, string>): FileSystem {
  return {
    async read(path: string) {
      if (files[path] !== undefined) return files[path]!
      throw new Error(`File not found: ${path}`)
    },
    async write() {},
    async edit() {},
    async glob() { return Object.keys(files) },
    async exists(path: string) { return files[path] !== undefined },
  }
}

describe("DetectProjectConfig", () => {
  it("detects TypeScript project (package.json + tsconfig.json)", async () => {
    const fs = mockFs({
      "package.json": '{"name":"test"}',
      "tsconfig.json": '{}',
    })
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()

    expect(config.language).toBe("typescript")
    expect(config.buildCommand).toBe("npm run build")
    expect(config.testCommand).toBe("npm test")
  })

  it("detects JavaScript project (package.json only)", async () => {
    const fs = mockFs({ "package.json": '{"name":"test"}' })
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()

    expect(config.language).toBe("javascript")
  })

  it("detects Rust project", async () => {
    const fs = mockFs({ "Cargo.toml": "" })
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()

    expect(config.language).toBe("rust")
    expect(config.buildCommand).toBe("cargo build")
    expect(config.testCommand).toBe("cargo test")
  })

  it("detects Kotlin project", async () => {
    const fs = mockFs({ "build.gradle.kts": "" })
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()

    expect(config.language).toBe("kotlin")
    expect(config.buildCommand).toBe("./gradlew build")
    expect(config.testCommand).toBe("./gradlew test")
  })

  it("detects Go project", async () => {
    const fs = mockFs({ "go.mod": "" })
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()

    expect(config.language).toBe("go")
    expect(config.buildCommand).toBe("go build ./...")
    expect(config.testCommand).toBe("go test ./...")
  })

  it("returns unknown config for empty directory", async () => {
    const fs = mockFs({})
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()

    expect(config.language).toBe("unknown")
  })

  it("detects sourceRoots for TypeScript (src/ exists)", async () => {
    const fs = mockFs({
      "package.json": '{}',
      "tsconfig.json": '{}',
      "src/index.ts": "",
    })
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()

    expect(config.sourceRoots).toContain("src")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/use-cases/DetectProjectConfig.test.ts -v`
Expected: FAIL — module not found

- [ ] **Step 3: Implement DetectProjectConfig**

Create `src/use-cases/DetectProjectConfig.ts`:

```typescript
import type { FileSystem } from "./ports/FileSystem"
import { createProjectConfig, UNKNOWN_PROJECT_CONFIG, type ProjectConfig } from "../entities/ProjectConfig"

interface MarkerRule {
  readonly marker: string
  readonly language: string
  readonly buildCommand: string
  readonly testCommand: string
  readonly sourceRoot: string
}

const MARKER_RULES: readonly MarkerRule[] = [
  { marker: "Cargo.toml", language: "rust", buildCommand: "cargo build", testCommand: "cargo test", sourceRoot: "src" },
  { marker: "build.gradle.kts", language: "kotlin", buildCommand: "./gradlew build", testCommand: "./gradlew test", sourceRoot: "src" },
  { marker: "go.mod", language: "go", buildCommand: "go build ./...", testCommand: "go test ./...", sourceRoot: "." },
]

export class DetectProjectConfig {
  constructor(private readonly fs: FileSystem) {}

  async execute(): Promise<ProjectConfig> {
    // Check TypeScript/JavaScript (most common in this project)
    const hasPackageJson = await this.fs.exists("package.json")
    if (hasPackageJson) {
      const hasTsConfig = await this.fs.exists("tsconfig.json")
      const language = hasTsConfig ? "typescript" : "javascript"
      const sourceRoots = await this.detectSourceRoots()
      return createProjectConfig({
        language,
        buildCommand: "npm run build",
        testCommand: "npm test",
        sourceRoots,
      })
    }

    // Check other markers
    for (const rule of MARKER_RULES) {
      const exists = await this.fs.exists(rule.marker)
      if (exists) {
        return createProjectConfig({
          language: rule.language,
          buildCommand: rule.buildCommand,
          testCommand: rule.testCommand,
          sourceRoots: [rule.sourceRoot],
        })
      }
    }

    return UNKNOWN_PROJECT_CONFIG
  }

  private async detectSourceRoots(): Promise<string[]> {
    const candidates = ["src", "lib", "app"]
    const roots: string[] = []
    for (const candidate of candidates) {
      const exists = await this.fs.exists(candidate)
      if (exists) roots.push(candidate)
    }
    return roots.length > 0 ? roots : ["."]
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/use-cases/DetectProjectConfig.test.ts -v`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/DetectProjectConfig.ts tests/use-cases/DetectProjectConfig.test.ts
git commit -m "feat: add DetectProjectConfig use case"
```

---

### Task 9: Integration Test — Detect DevFleet's Own Config

**Files:**
- Create: `tests/integration/detect-project-config.test.ts`

- [ ] **Step 1: Write integration test**

Create `tests/integration/detect-project-config.test.ts`:

```typescript
import { DetectProjectConfig } from "../../src/use-cases/DetectProjectConfig"
import { NodeFileSystem } from "../../src/adapters/filesystem/NodeFileSystem"

describe("DetectProjectConfig — integration", () => {
  it("detects DevFleet as a TypeScript project", async () => {
    const fs = new NodeFileSystem(process.cwd())
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()

    expect(config.language).toBe("typescript")
    expect(config.buildCommand).toBe("npm run build")
    expect(config.testCommand).toBe("npm test")
    expect(config.sourceRoots).toContain("src")
  })
})
```

- [ ] **Step 2: Run test**

Run: `npx jest tests/integration/detect-project-config.test.ts -v`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add tests/integration/detect-project-config.test.ts
git commit -m "test: integration test for project config detection on DevFleet repo"
```

---

### Task 10: ProjectDetectedMessage + Supervisor Integration

**Files:**
- Modify: `src/entities/Message.ts`
- Modify: `src/adapters/plugins/agents/SupervisorPlugin.ts`
- Modify: `src/infrastructure/config/composition-root.ts`

- [ ] **Step 1: Add ProjectDetectedMessage to Message.ts**

In `src/entities/Message.ts`, add after the `GoalAbandonedMessage` interface (in the Goal lifecycle section):

```typescript
interface ProjectDetectedMessage extends BaseMessage {
  readonly type: "project.detected"
  readonly projectId: string
  readonly config: import("./ProjectConfig").ProjectConfig
}
```

Add `ProjectDetectedMessage` to the `Message` union type:

```typescript
export type Message =
  | GoalCreatedMessage
  | GoalCompletedMessage
  | GoalAbandonedMessage
  | ProjectDetectedMessage
  // ... rest of existing types
```

- [ ] **Step 2: Update SupervisorPluginDeps to accept DetectProjectConfig**

In `src/adapters/plugins/agents/SupervisorPlugin.ts`, add import and dep:

```typescript
import type { DetectProjectConfig } from "../../../use-cases/DetectProjectConfig"
```

Add to `SupervisorPluginDeps`:

```typescript
  readonly detectProjectConfig?: DetectProjectConfig
```

This is intentionally optional — existing tests don't need it, and Supervisor worked without it before.

- [ ] **Step 3: Call DetectProjectConfig in handleGoalCreated**

In `SupervisorPlugin.handleGoalCreated`, add project detection before decomposition:

```typescript
  private async handleGoalCreated(goalId: GoalId, description: string): Promise<void> {
    // Detect project configuration if available
    if (this.deps.detectProjectConfig) {
      const config = await this.deps.detectProjectConfig.execute()
      await this.deps.bus.emit({
        id: createMessageId(),
        type: "project.detected",
        projectId: this.deps.projectId,
        config,
        timestamp: new Date(),
      })
    }

    // Use AI to decompose the goal into tasks (existing code follows)
    // ...
```

- [ ] **Step 4: Wire DetectProjectConfig in composition root**

In `src/infrastructure/config/composition-root.ts`, add:

```typescript
import { DetectProjectConfig } from "../../use-cases/DetectProjectConfig"
```

Create the use case after the filesystem is wired:

```typescript
  const detectProjectConfig = new DetectProjectConfig(fileSystem)
```

Pass it to SupervisorPlugin:

```typescript
  const supervisorPlugin = new SupervisorPlugin({
    // ... existing deps
    detectProjectConfig,
  })
```

- [ ] **Step 5: Run full test suite**

Run: `npx jest --verbose`
Expected: PASS — `detectProjectConfig` is optional on SupervisorPluginDeps, so existing tests don't break.

- [ ] **Step 6: Commit**

```bash
git add src/entities/Message.ts src/adapters/plugins/agents/SupervisorPlugin.ts src/infrastructure/config/composition-root.ts
git commit -m "feat: Supervisor emits project.detected on goal creation"
```

---

### Task 11: Layer B Verification

No changes to OpsPlugin needed. The composition root already accepts `buildCommand` and `testCommand` via `DevFleetConfig`. The self-test harness calls `DetectProjectConfig` before `buildSystem` and passes the detected commands in — simple composition-time injection.

The `project.detected` message is available on the bus for agents that need runtime context (Architect, Developer can subscribe in the future).

- [ ] **Step 1: Run full test suite**

Run: `npx jest --verbose`
Expected: PASS

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: Layer B (project detection) complete"
```

---

## Layer C: Self-Test Harness

### Task 12: Self-Test Integration Test

**Files:**
- Create: `tests/integration/self-test.test.ts`

- [ ] **Step 1: Create the self-test harness**

Create `tests/integration/self-test.test.ts`:

```typescript
import { execSync } from "node:child_process"
import { mkdtempSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { buildSystem, type DevFleetSystem } from "../../src/infrastructure/config/composition-root"
import { DetectProjectConfig } from "../../src/use-cases/DetectProjectConfig"
import { NodeFileSystem } from "../../src/adapters/filesystem/NodeFileSystem"
import { createGoal } from "../../src/entities/Goal"
import { createGoalId, createMessageId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import type { Message } from "../../src/entities/Message"

const RUN_SELF_TEST = process.env.RUN_SELF_TEST === "true"
const maybe = RUN_SELF_TEST ? describe : describe.skip

const SELF_TEST_GOAL = process.env.SELF_TEST_GOAL
  ?? "Add spec.created and plan.created message emission from ProductPlugin and ArchitectPlugin"

const BUDGET_CIRCUIT_BREAKER_USD = 15.0

// Rough cost estimation: $15/M input + $75/M output for Opus, $3/M input + $15/M output for Sonnet
function estimateCostUsd(tokensIn: number, tokensOut: number, model: string): number {
  const isOpus = model.includes("opus")
  const inRate = isOpus ? 15 / 1_000_000 : 3 / 1_000_000
  const outRate = isOpus ? 75 / 1_000_000 : 15 / 1_000_000
  return tokensIn * inRate + tokensOut * outRate
}

maybe("Self-Test: DevFleet on DevFleet", () => {
  let clonePath: string
  let system: DevFleetSystem

  beforeAll(() => {
    // Clone DevFleet to temp directory
    const repoRoot = process.cwd()
    clonePath = mkdtempSync(join(tmpdir(), "devfleet-selftest-"))
    console.log(`\n  Cloning DevFleet to: ${clonePath}`)
    execSync(`git clone "${repoRoot}" "${clonePath}"`, { stdio: "inherit" })

    // Install dependencies in clone
    console.log("  Installing dependencies in clone...")
    execSync("npm install", { cwd: clonePath, stdio: "inherit" })
  }, 120_000) // 2 min for clone + install

  afterAll(async () => {
    if (system) await system.stop()
    console.log(`\n  Clone preserved at: ${clonePath}`)
    console.log("  Review with:")
    console.log(`    cd ${clonePath}`)
    console.log("    git log --oneline")
    console.log("    git diff HEAD~1")
  })

  it("runs the full pipeline and produces a completed goal", async () => {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY required for self-test")

    // Detect project config from clone
    const fs = new NodeFileSystem(clonePath)
    const detected = await new DetectProjectConfig(fs).execute()
    console.log(`  Detected project: ${detected.language} (build: ${detected.buildCommand}, test: ${detected.testCommand})`)

    // Build system pointing at clone
    system = await buildSystem({
      workspaceDir: clonePath,
      anthropicApiKey: apiKey,
      supervisorModel: "claude-opus-4-20250514",
      reviewerModel: "claude-opus-4-20250514",
      developerModel: "claude-sonnet-4-20250514",
      pipelineTimeoutMs: 600_000,
      maxRetries: 2,
      buildCommand: detected.buildCommand,
      testCommand: detected.testCommand,
    })

    await system.start()

    // Collect all messages
    const messages: Message[] = []
    const supervisorDecisions: string[] = []
    let cumulativeCostUsd = 0

    system.bus.subscribe({}, async (msg) => {
      messages.push(msg)

      // Track supervisor decisions
      if (msg.type === "task.created") {
        supervisorDecisions.push(`DECOMPOSE: ${msg.description}`)
      }
      if (msg.type === "task.assigned") {
        supervisorDecisions.push(`ASSIGN: task ${msg.taskId} → agent ${msg.agentId}`)
      }
      if (msg.type === "branch.merged") {
        supervisorDecisions.push(`MERGE: ${msg.branch} → ${msg.commit}`)
      }
      if (msg.type === "branch.discarded") {
        supervisorDecisions.push(`DISCARD: ${msg.branch} — ${msg.reason}`)
      }
    })

    // Budget circuit breaker
    let goalAbandoned = false
    system.bus.subscribe({ types: ["task.completed"] }, async (msg) => {
      // Estimate costs from event store (rough tracking)
      if ("tokensIn" in msg && "tokensOut" in msg) {
        const m = msg as any
        cumulativeCostUsd += estimateCostUsd(m.tokensIn, m.tokensOut, m.model ?? "sonnet")
      }
      if (cumulativeCostUsd > BUDGET_CIRCUIT_BREAKER_USD && !goalAbandoned) {
        goalAbandoned = true
        console.log(`  CIRCUIT BREAKER: $${cumulativeCostUsd.toFixed(2)} exceeds $${BUDGET_CIRCUIT_BREAKER_USD} limit`)
        await system.bus.emit({
          id: createMessageId(),
          type: "goal.abandoned",
          goalId: goalId,
          reason: `Budget circuit breaker: $${cumulativeCostUsd.toFixed(2)} exceeded $${BUDGET_CIRCUIT_BREAKER_USD} limit`,
          timestamp: new Date(),
        })
      }
    })

    // Create goal
    const goalId = createGoalId()
    const goal = createGoal({
      id: goalId,
      description: SELF_TEST_GOAL,
      totalBudget: createBudget({ maxTokens: 200_000, maxCostUsd: 10.0 }),
      status: "active",
    })
    await system.goalRepo.create(goal)

    // Set up completion waiter
    const done = new Promise<Message>((resolve) => {
      system.bus.subscribe({ types: ["goal.completed", "goal.abandoned"] }, async (msg) => {
        if ("goalId" in msg && (msg as any).goalId === goalId) {
          resolve(msg)
        }
      })
    })

    // Kick off pipeline
    console.log(`\n  Goal: ${SELF_TEST_GOAL}`)
    console.log("  Pipeline started...\n")

    await system.bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId,
      description: goal.description,
      timestamp: new Date(),
    })

    // Wait for completion
    const result = await done

    // --- Diagnostics ---
    console.log("\n  === SUPERVISOR AUDIT TRAIL ===")
    for (const decision of supervisorDecisions) {
      console.log(`    ${decision}`)
    }

    console.log("\n  === MESSAGE TRACE ===")
    const typeCounts = new Map<string, number>()
    for (const msg of messages) {
      typeCounts.set(msg.type, (typeCounts.get(msg.type) ?? 0) + 1)
    }
    for (const [type, count] of typeCounts) {
      console.log(`    ${type}: ${count}`)
    }

    // Git log of clone
    console.log("\n  === GIT LOG ===")
    try {
      const gitLog = execSync("git log --oneline -20", { cwd: clonePath }).toString()
      console.log(gitLog.split("\n").map(l => `    ${l}`).join("\n"))
    } catch { /* clone may not have new commits */ }

    // Git diff
    console.log("\n  === GIT DIFF (summary) ===")
    try {
      const gitDiff = execSync("git diff --stat HEAD~1", { cwd: clonePath }).toString()
      console.log(gitDiff.split("\n").map(l => `    ${l}`).join("\n"))
    } catch { /* no diff if no commits */ }

    console.log(`\n  Clone at: ${clonePath}`)

    // --- Assertions ---
    expect(result.type).toBe("goal.completed")

    const types = messages.map(m => m.type)
    expect(types).toContain("task.created")
    expect(types).toContain("task.assigned")
    expect(types).toContain("code.completed")
    expect(types).toContain("build.passed")
    expect(types).toContain("review.approved")
    expect(types).toContain("branch.merged")

    // Verify Ops artifact has passing tests
    const testReportMsg = messages.find(m => m.type === "test.report.created")
    if (testReportMsg && "artifactId" in testReportMsg) {
      const artifact = await system.artifactRepo.findById((testReportMsg as any).artifactId)
      if (artifact && artifact.kind === "test_report") {
        const report = JSON.parse(artifact.content) as { passed: number; failed: number }
        console.log(`\n  Test report: ${report.passed} passed, ${report.failed} failed`)
        expect(report.failed).toBe(0)
      }
    }
  }, 660_000) // 11 min timeout (slightly longer than pipeline timeout)
})
```

- [ ] **Step 2: Verify test is skipped by default**

Run: `npx jest tests/integration/self-test.test.ts -v`
Expected: PASS (1 test skipped)

- [ ] **Step 3: Commit**

```bash
git add tests/integration/self-test.test.ts
git commit -m "feat: add self-test harness — DevFleet tests itself"
```

---

### Task 13: Convenience Script

**Files:**
- Create: `scripts/self-test.sh`

- [ ] **Step 1: Create the script**

Create `scripts/self-test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

: "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY to run the self-test}"

GOAL="${1:-Add spec.created and plan.created message emission from ProductPlugin and ArchitectPlugin}"

echo "DevFleet Self-Test"
echo "=================="
echo "Goal: $GOAL"
echo ""

export RUN_SELF_TEST=true
export SELF_TEST_GOAL="$GOAL"

npx jest tests/integration/self-test.test.ts --testTimeout=660000 --verbose
```

- [ ] **Step 2: Make executable**

```bash
chmod +x scripts/self-test.sh
```

- [ ] **Step 3: Commit**

```bash
git add scripts/self-test.sh
git commit -m "feat: add self-test convenience script"
```

---

### Task 14: Layer C Verification

- [ ] **Step 1: Verify self-test is skipped in normal test runs**

Run: `npx jest --verbose`
Expected: All tests pass, self-test shows as skipped

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit final**

```bash
git commit --allow-empty -m "chore: Layer C (self-test harness) complete"
```

- [ ] **Step 4: Run the actual self-test (manual, costs real money)**

```bash
ANTHROPIC_API_KEY=sk-ant-... ./scripts/self-test.sh
```

Expected: Pipeline runs, you see the audit trail, and the clone is left for your review.
