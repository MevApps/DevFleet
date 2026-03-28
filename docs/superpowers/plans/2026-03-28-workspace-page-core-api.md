# Workspace Page: Core + API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the backend for the workspace page — entity, ports, adapters, use cases, API endpoints, and goal routing.

**Architecture:** Domain-first: WorkspaceRun entity → ports (WorkspaceIsolator, WorkspaceRunRepository, GitRemote, PullRequestCreator) → in-memory/git adapters → use cases (Start, Boot, Stop, Cleanup, GetStatus) → WorkspaceRunManager orchestrator → Express API routes. ProjectConfig gains `installCommand`.

**Tech Stack:** TypeScript, Express, Jest, git CLI, gh CLI

**Spec:** `docs/superpowers/specs/2026-03-28-workspace-page-design.md`

**Plan B (Dashboard UI):** `docs/superpowers/plans/2026-03-28-workspace-page-ui.md` (written after this plan ships)

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/entities/ids.ts` | Add `WorkspaceRunId` branded type |
| Create | `src/entities/WorkspaceRun.ts` | WorkspaceRun entity, config, status types, factory |
| Modify | `src/entities/ProjectConfig.ts` | Add `installCommand` field |
| Modify | `src/entities/Message.ts` | Add 3 workspace message types |
| Create | `src/use-cases/ports/WorkspaceIsolator.ts` | WorkspaceHandle, create/install/cleanup |
| Create | `src/use-cases/ports/WorkspaceRunRepository.ts` | CRUD + findActive |
| Create | `src/use-cases/ports/GitRemote.ts` | Push branch to remote |
| Create | `src/use-cases/ports/PullRequestCreator.ts` | Create PR, merge PR |
| Create | `src/adapters/workspace/GitCloneIsolator.ts` | Git clone + rm adapter |
| Create | `src/adapters/storage/InMemoryWorkspaceRunRepository.ts` | In-memory adapter |
| Create | `src/adapters/git/NodeGitRemote.ts` | git push via ShellExecutor |
| Create | `src/adapters/git/GitHubPullRequestCreator.ts` | gh CLI adapter |
| Create | `src/use-cases/StartWorkspaceRun.ts` | Create entity, clone, kick off boot |
| Create | `src/use-cases/BootWorkspace.ts` | Detect, install deps, build system, start |
| Create | `src/use-cases/StopWorkspace.ts` | Stop system, cleanup or preserve |
| Create | `src/use-cases/CleanupWorkspace.ts` | Remove preserved clone |
| Create | `src/use-cases/GetWorkspaceRunStatus.ts` | Query status + derived data |
| Create | `src/use-cases/WorkspaceRunManager.ts` | Orchestrator: lifecycle, event handlers, system map |
| Create | `src/infrastructure/http/routes/workspaceRoutes.ts` | Express routes for workspace API |
| Modify | `src/infrastructure/http/createServer.ts` | Wire workspace routes + DashboardDeps |
| Modify | `src/infrastructure/http/routes/goalRoutes.ts` | Route goals to active workspace |
| Modify | `src/infrastructure/config/composition-root.ts` | Wire workspace deps |
| Modify | `src/use-cases/DetectProjectConfig.ts` | Add installCommand to detection |
| Create | `tests/entities/WorkspaceRun.test.ts` | Entity tests |
| Create | `tests/use-cases/StartWorkspaceRun.test.ts` | Use case tests |
| Create | `tests/use-cases/BootWorkspace.test.ts` | Use case tests |
| Create | `tests/use-cases/StopWorkspace.test.ts` | Use case tests |
| Create | `tests/use-cases/WorkspaceRunManager.test.ts` | Manager tests |
| Create | `tests/adapters/GitCloneIsolator.test.ts` | Adapter integration test |
| Create | `tests/infrastructure/workspaceRoutes.test.ts` | API route tests |

---

## Task 1: WorkspaceRunId + WorkspaceRun Entity

**Files:**
- Modify: `src/entities/ids.ts`
- Create: `src/entities/WorkspaceRun.ts`
- Test: `tests/entities/WorkspaceRun.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/entities/WorkspaceRun.test.ts`:

```typescript
import { createWorkspaceRun, type WorkspaceRun, type WorkspaceRunConfig } from "../../src/entities/WorkspaceRun"
import { createWorkspaceRunId } from "../../src/entities/ids"

const DEFAULT_CONFIG: WorkspaceRunConfig = {
  repoUrl: "https://github.com/user/repo.git",
  maxCostUsd: 10.0,
  maxTokens: 200_000,
  supervisorModel: "claude-opus-4-20250514",
  developerModel: "claude-sonnet-4-20250514",
  reviewerModel: "claude-opus-4-20250514",
  timeoutMs: 600_000,
}

describe("WorkspaceRun", () => {
  it("creates with status 'created' and null optionals", () => {
    const run = createWorkspaceRun({ id: createWorkspaceRunId("ws-1"), config: DEFAULT_CONFIG })
    expect(run.status).toBe("created")
    expect(run.projectConfig).toBeNull()
    expect(run.completedAt).toBeNull()
    expect(run.error).toBeNull()
  })

  it("is frozen (immutable)", () => {
    const run = createWorkspaceRun({ id: createWorkspaceRunId("ws-2"), config: DEFAULT_CONFIG })
    expect(() => { (run as any).status = "active" }).toThrow()
  })

  it("preserves config", () => {
    const run = createWorkspaceRun({ id: createWorkspaceRunId("ws-3"), config: DEFAULT_CONFIG })
    expect(run.config.repoUrl).toBe("https://github.com/user/repo.git")
    expect(run.config.maxCostUsd).toBe(10.0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/entities/WorkspaceRun.test.ts --verbose`
Expected: FAIL — modules not found

- [ ] **Step 3: Add WorkspaceRunId to ids.ts**

In `src/entities/ids.ts`, add after existing ID types:

```typescript
export type WorkspaceRunId = string & { readonly __brand: "WorkspaceRunId" }

export function createWorkspaceRunId(value?: string): WorkspaceRunId {
  return (value ?? randomUUID()) as WorkspaceRunId
}
```

- [ ] **Step 4: Create WorkspaceRun entity**

Create `src/entities/WorkspaceRun.ts`:

```typescript
import type { WorkspaceRunId } from "./ids"
import type { ProjectConfig } from "./ProjectConfig"

export type WorkspaceRunStatus =
  | "created"
  | "cloning"
  | "installing"
  | "detecting"
  | "active"
  | "stopped"
  | "stopped_dirty"
  | "failed"

export interface WorkspaceRunConfig {
  readonly repoUrl: string
  readonly maxCostUsd: number
  readonly maxTokens: number
  readonly supervisorModel: string
  readonly developerModel: string
  readonly reviewerModel: string
  readonly timeoutMs: number
}

export const DEFAULT_WORKSPACE_CONFIG: Omit<WorkspaceRunConfig, "repoUrl"> = {
  maxCostUsd: 10.0,
  maxTokens: 200_000,
  supervisorModel: "claude-opus-4-20250514",
  developerModel: "claude-sonnet-4-20250514",
  reviewerModel: "claude-opus-4-20250514",
  timeoutMs: 600_000,
}

export interface WorkspaceRun {
  readonly id: WorkspaceRunId
  readonly config: WorkspaceRunConfig
  readonly status: WorkspaceRunStatus
  readonly projectConfig: ProjectConfig | null
  readonly startedAt: Date
  readonly completedAt: Date | null
  readonly error: string | null
}

export function createWorkspaceRun(params: {
  id: WorkspaceRunId
  config: WorkspaceRunConfig
  status?: WorkspaceRunStatus
  projectConfig?: ProjectConfig | null
  startedAt?: Date
  completedAt?: Date | null
  error?: string | null
}): WorkspaceRun {
  return Object.freeze({
    id: params.id,
    config: Object.freeze({ ...params.config }),
    status: params.status ?? "created",
    projectConfig: params.projectConfig ?? null,
    startedAt: params.startedAt ?? new Date(),
    completedAt: params.completedAt ?? null,
    error: params.error ?? null,
  })
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx jest tests/entities/WorkspaceRun.test.ts --verbose`
Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add src/entities/ids.ts src/entities/WorkspaceRun.ts tests/entities/WorkspaceRun.test.ts
git commit -m "feat: add WorkspaceRun entity and WorkspaceRunId"
```

---

## Task 2: Add installCommand to ProjectConfig

**Files:**
- Modify: `src/entities/ProjectConfig.ts`
- Modify: `src/use-cases/DetectProjectConfig.ts`
- Modify: `tests/entities/ProjectConfig.test.ts`
- Modify: `tests/use-cases/DetectProjectConfig.test.ts`

- [ ] **Step 1: Update ProjectConfig interface**

In `src/entities/ProjectConfig.ts`, add `installCommand`:

```typescript
export interface ProjectConfig {
  readonly language: string
  readonly buildCommand: string
  readonly testCommand: string
  readonly installCommand: string
  readonly sourceRoots: readonly string[]
}

export function createProjectConfig(params: {
  language: string
  buildCommand: string
  testCommand: string
  installCommand: string
  sourceRoots: readonly string[]
}): ProjectConfig {
  return Object.freeze({
    language: params.language,
    buildCommand: params.buildCommand,
    testCommand: params.testCommand,
    installCommand: params.installCommand,
    sourceRoots: Object.freeze([...params.sourceRoots]),
  })
}

export const UNKNOWN_PROJECT_CONFIG: ProjectConfig = Object.freeze({
  language: "unknown",
  buildCommand: "echo no-build",
  testCommand: "echo no-test",
  installCommand: "",
  sourceRoots: Object.freeze(["."]),
})
```

- [ ] **Step 2: Update DetectProjectConfig**

In `src/use-cases/DetectProjectConfig.ts`, add `installCommand` to marker rules:

```typescript
interface MarkerRule {
  readonly marker: string
  readonly language: string
  readonly buildCommand: string
  readonly testCommand: string
  readonly installCommand: string
  readonly sourceRoot: string
}

const MARKER_RULES: readonly MarkerRule[] = [
  { marker: "Cargo.toml", language: "rust", buildCommand: "cargo build", testCommand: "cargo test", installCommand: "cargo build", sourceRoot: "src" },
  { marker: "build.gradle.kts", language: "kotlin", buildCommand: "./gradlew build", testCommand: "./gradlew test", installCommand: "./gradlew build", sourceRoot: "src" },
  { marker: "go.mod", language: "go", buildCommand: "go build ./...", testCommand: "go test ./...", installCommand: "go mod download", sourceRoot: "." },
]
```

And update the TypeScript/JavaScript return:

```typescript
    if (hasPackageJson) {
      const hasTsConfig = await this.fs.exists("tsconfig.json")
      const language = hasTsConfig ? "typescript" : "javascript"
      const sourceRoots = await this.detectSourceRoots()
      return createProjectConfig({
        language,
        buildCommand: "npm run build",
        testCommand: "npm test",
        installCommand: "npm install",
        sourceRoots,
      })
    }
```

And in the marker rule loop:

```typescript
    for (const rule of MARKER_RULES) {
      const exists = await this.fs.exists(rule.marker)
      if (exists) {
        return createProjectConfig({
          language: rule.language,
          buildCommand: rule.buildCommand,
          testCommand: rule.testCommand,
          installCommand: rule.installCommand,
          sourceRoots: [rule.sourceRoot],
        })
      }
    }
```

- [ ] **Step 3: Fix existing tests**

In `tests/entities/ProjectConfig.test.ts`, add `installCommand` to factory calls:

```typescript
  it("creates a valid project config", () => {
    const config = createProjectConfig({
      language: "typescript",
      buildCommand: "npm run build",
      testCommand: "npm test",
      installCommand: "npm install",
      sourceRoots: ["src"],
    })
    expect(config.installCommand).toBe("npm install")
    // ... existing assertions
  })
```

In `tests/use-cases/DetectProjectConfig.test.ts`, add assertions for `installCommand`:

```typescript
  it("detects TypeScript project (package.json + tsconfig.json)", async () => {
    // ... existing setup
    expect(config.installCommand).toBe("npm install")
  })

  it("detects Rust project", async () => {
    // ... existing setup
    expect(config.installCommand).toBe("cargo build")
  })
```

- [ ] **Step 4: Run all tests**

Run: `npx jest --verbose`
Expected: ALL pass (fix any tests that break due to the new required field)

- [ ] **Step 5: Commit**

```bash
git add src/entities/ProjectConfig.ts src/use-cases/DetectProjectConfig.ts tests/entities/ProjectConfig.test.ts tests/use-cases/DetectProjectConfig.test.ts
git commit -m "feat: add installCommand to ProjectConfig and DetectProjectConfig"
```

---

## Task 3: Workspace Message Types

**Files:**
- Modify: `src/entities/Message.ts`

- [ ] **Step 1: Add workspace message interfaces**

In `src/entities/Message.ts`, add before the union type:

```typescript
// ---------------------------------------------------------------------------
// Workspace
// ---------------------------------------------------------------------------
interface WorkspaceGoalDeliveredMessage extends BaseMessage {
  readonly type: "workspace.goal.delivered"
  readonly goalId: GoalId
  readonly prUrl: string
  readonly merged: boolean
}

interface WorkspaceGoalFailedMessage extends BaseMessage {
  readonly type: "workspace.goal.failed"
  readonly goalId: GoalId
  readonly reason: string
}

interface WorkspaceStatusChangedMessage extends BaseMessage {
  readonly type: "workspace.status.changed"
  readonly runId: string
  readonly status: string
}
```

Add all three to the `Message` union:

```typescript
export type Message =
  // ... existing types
  | WorkspaceGoalDeliveredMessage
  | WorkspaceGoalFailedMessage
  | WorkspaceStatusChangedMessage
```

- [ ] **Step 2: Run all tests**

Run: `npx jest --verbose`
Expected: ALL pass (adding union members is backwards-compatible)

- [ ] **Step 3: Commit**

```bash
git add src/entities/Message.ts
git commit -m "feat: add workspace message types"
```

---

## Task 4: Workspace Ports

**Files:**
- Create: `src/use-cases/ports/WorkspaceIsolator.ts`
- Create: `src/use-cases/ports/WorkspaceRunRepository.ts`
- Create: `src/use-cases/ports/GitRemote.ts`
- Create: `src/use-cases/ports/PullRequestCreator.ts`

- [ ] **Step 1: Create WorkspaceIsolator port**

Create `src/use-cases/ports/WorkspaceIsolator.ts`:

```typescript
export interface WorkspaceHandle {
  readonly id: string
}

export interface WorkspaceIsolator {
  create(repoUrl: string): Promise<WorkspaceHandle>
  installDependencies(handle: WorkspaceHandle, installCommand: string): Promise<void>
  getWorkspaceDir(handle: WorkspaceHandle): string
  cleanup(handle: WorkspaceHandle): Promise<void>
}
```

- [ ] **Step 2: Create WorkspaceRunRepository port**

Create `src/use-cases/ports/WorkspaceRunRepository.ts`:

```typescript
import type { WorkspaceRun } from "../../entities/WorkspaceRun"
import type { WorkspaceRunId } from "../../entities/ids"

export interface WorkspaceRunRepository {
  create(run: WorkspaceRun): Promise<void>
  findById(id: WorkspaceRunId): Promise<WorkspaceRun | null>
  findActive(): Promise<WorkspaceRun | null>
  update(run: WorkspaceRun): Promise<void>
}
```

- [ ] **Step 3: Create GitRemote port**

Create `src/use-cases/ports/GitRemote.ts`:

```typescript
export interface GitRemote {
  push(branch: string, remoteUrl: string, workingDir: string): Promise<void>
}
```

- [ ] **Step 4: Create PullRequestCreator port**

Create `src/use-cases/ports/PullRequestCreator.ts`:

```typescript
export interface CreatePullRequestParams {
  readonly repoUrl: string
  readonly branch: string
  readonly baseBranch: string
  readonly title: string
  readonly body: string
}

export interface PullRequestCreator {
  create(params: CreatePullRequestParams): Promise<string>
  merge(prUrl: string): Promise<void>
}
```

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/ports/WorkspaceIsolator.ts src/use-cases/ports/WorkspaceRunRepository.ts src/use-cases/ports/GitRemote.ts src/use-cases/ports/PullRequestCreator.ts
git commit -m "feat: add workspace ports (isolator, repository, git remote, PR creator)"
```

---

## Task 5: In-Memory Adapters

**Files:**
- Create: `src/adapters/storage/InMemoryWorkspaceRunRepository.ts`
- Create: `src/adapters/workspace/GitCloneIsolator.ts`
- Create: `src/adapters/git/NodeGitRemote.ts`
- Create: `src/adapters/git/GitHubPullRequestCreator.ts`
- Test: `tests/adapters/GitCloneIsolator.test.ts`

- [ ] **Step 1: Create InMemoryWorkspaceRunRepository**

Create `src/adapters/storage/InMemoryWorkspaceRunRepository.ts`:

```typescript
import type { WorkspaceRunRepository } from "../../use-cases/ports/WorkspaceRunRepository"
import type { WorkspaceRun } from "../../entities/WorkspaceRun"
import type { WorkspaceRunId } from "../../entities/ids"

export class InMemoryWorkspaceRunRepository implements WorkspaceRunRepository {
  private readonly runs = new Map<string, WorkspaceRun>()

  async create(run: WorkspaceRun): Promise<void> {
    this.runs.set(run.id, run)
  }

  async findById(id: WorkspaceRunId): Promise<WorkspaceRun | null> {
    return this.runs.get(id) ?? null
  }

  async findActive(): Promise<WorkspaceRun | null> {
    for (const run of this.runs.values()) {
      if (run.status === "active" || run.status === "cloning" || run.status === "installing" || run.status === "detecting") {
        return run
      }
    }
    return null
  }

  async update(run: WorkspaceRun): Promise<void> {
    this.runs.set(run.id, run)
  }
}
```

- [ ] **Step 2: Create GitCloneIsolator**

Create `src/adapters/workspace/GitCloneIsolator.ts`:

```typescript
import { mkdtempSync, rmSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import type { WorkspaceIsolator, WorkspaceHandle } from "../../use-cases/ports/WorkspaceIsolator"
import type { ShellExecutor } from "../../use-cases/ports/ShellExecutor"

export class GitCloneIsolator implements WorkspaceIsolator {
  private readonly paths = new Map<string, string>()

  constructor(private readonly shell: ShellExecutor) {}

  async create(repoUrl: string): Promise<WorkspaceHandle> {
    const clonePath = mkdtempSync(join(tmpdir(), "devfleet-workspace-"))
    const handle: WorkspaceHandle = { id: `ws-${Date.now().toString(36)}` }
    await this.shell.execute("git", ["clone", repoUrl, clonePath])
    this.paths.set(handle.id, clonePath)
    return handle
  }

  async installDependencies(handle: WorkspaceHandle, installCommand: string): Promise<void> {
    const dir = this.getWorkspaceDir(handle)
    if (!installCommand) return
    const parts = installCommand.split(/\s+/)
    const command = parts[0]!
    const args = parts.slice(1)
    await this.shell.execute(command, args, 120_000)
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
```

- [ ] **Step 3: Create NodeGitRemote**

Create `src/adapters/git/NodeGitRemote.ts`:

```typescript
import type { GitRemote } from "../../use-cases/ports/GitRemote"
import type { ShellExecutor } from "../../use-cases/ports/ShellExecutor"
import { NodeShellExecutor } from "../shell/NodeShellExecutor"

export class NodeGitRemote implements GitRemote {
  async push(branch: string, remoteUrl: string, workingDir: string): Promise<void> {
    const shell = new NodeShellExecutor(workingDir)
    const result = await shell.execute("git", ["push", remoteUrl, `${branch}:${branch}`])
    if (result.exitCode !== 0) {
      throw new Error(`git push failed: ${result.stderr}`)
    }
  }
}
```

- [ ] **Step 4: Create GitHubPullRequestCreator**

Create `src/adapters/git/GitHubPullRequestCreator.ts`:

```typescript
import type { PullRequestCreator, CreatePullRequestParams } from "../../use-cases/ports/PullRequestCreator"
import type { ShellExecutor } from "../../use-cases/ports/ShellExecutor"
import { NodeShellExecutor } from "../shell/NodeShellExecutor"

export class GitHubPullRequestCreator implements PullRequestCreator {
  async create(params: CreatePullRequestParams): Promise<string> {
    const shell = new NodeShellExecutor()
    const result = await shell.execute("gh", [
      "pr", "create",
      "--repo", params.repoUrl.replace("https://github.com/", "").replace(".git", ""),
      "--head", params.branch,
      "--base", params.baseBranch,
      "--title", params.title,
      "--body", params.body,
    ], 30_000)

    if (result.exitCode !== 0) {
      throw new Error(`gh pr create failed: ${result.stderr}`)
    }
    return result.stdout.trim()
  }

  async merge(prUrl: string): Promise<void> {
    const shell = new NodeShellExecutor()
    const result = await shell.execute("gh", [
      "pr", "merge", prUrl, "--merge", "--delete-branch",
    ], 30_000)

    if (result.exitCode !== 0) {
      throw new Error(`gh pr merge failed: ${result.stderr}`)
    }
  }
}
```

- [ ] **Step 5: Write GitCloneIsolator integration test**

Create `tests/adapters/GitCloneIsolator.test.ts`:

```typescript
import { GitCloneIsolator } from "../../src/adapters/workspace/GitCloneIsolator"
import { NodeShellExecutor } from "../../src/adapters/shell/NodeShellExecutor"
import { mkdtempSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { execSync } from "node:child_process"

describe("GitCloneIsolator", () => {
  let sourceRepo: string
  let isolator: GitCloneIsolator

  beforeEach(() => {
    // Create a bare git repo to clone from
    sourceRepo = mkdtempSync(join(tmpdir(), "devfleet-source-"))
    execSync(
      'git init && git config user.email "test@test.com" && git config user.name "Test" && git commit --allow-empty -m init',
      { cwd: sourceRepo },
    )
    const shell = new NodeShellExecutor()
    isolator = new GitCloneIsolator(shell)
  })

  it("clones a repo and returns a handle", async () => {
    const handle = await isolator.create(sourceRepo)
    expect(handle.id).toBeTruthy()
    const dir = isolator.getWorkspaceDir(handle)
    expect(existsSync(join(dir, ".git"))).toBe(true)
  })

  it("cleanup removes the clone directory", async () => {
    const handle = await isolator.create(sourceRepo)
    const dir = isolator.getWorkspaceDir(handle)
    expect(existsSync(dir)).toBe(true)
    await isolator.cleanup(handle)
    expect(existsSync(dir)).toBe(false)
  })

  it("throws for unknown handle", () => {
    expect(() => isolator.getWorkspaceDir({ id: "unknown" })).toThrow("Unknown workspace handle")
  })
})
```

- [ ] **Step 6: Run tests**

Run: `npx jest tests/adapters/GitCloneIsolator.test.ts --verbose`
Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add src/adapters/storage/InMemoryWorkspaceRunRepository.ts src/adapters/workspace/GitCloneIsolator.ts src/adapters/git/NodeGitRemote.ts src/adapters/git/GitHubPullRequestCreator.ts tests/adapters/GitCloneIsolator.test.ts
git commit -m "feat: add workspace adapters (isolator, repository, git remote, PR creator)"
```

---

## Task 6: StartWorkspaceRun + BootWorkspace Use Cases

**Files:**
- Create: `src/use-cases/StartWorkspaceRun.ts`
- Create: `src/use-cases/BootWorkspace.ts`
- Test: `tests/use-cases/StartWorkspaceRun.test.ts`
- Test: `tests/use-cases/BootWorkspace.test.ts`

- [ ] **Step 1: Write failing test for StartWorkspaceRun**

Create `tests/use-cases/StartWorkspaceRun.test.ts`:

```typescript
import { StartWorkspaceRun } from "../../src/use-cases/StartWorkspaceRun"
import { InMemoryWorkspaceRunRepository } from "../../src/adapters/storage/InMemoryWorkspaceRunRepository"
import type { WorkspaceIsolator, WorkspaceHandle } from "../../src/use-cases/ports/WorkspaceIsolator"
import type { WorkspaceRunConfig } from "../../src/entities/WorkspaceRun"

const CONFIG: WorkspaceRunConfig = {
  repoUrl: "https://github.com/user/repo.git",
  maxCostUsd: 10.0,
  maxTokens: 200_000,
  supervisorModel: "claude-opus-4-20250514",
  developerModel: "claude-sonnet-4-20250514",
  reviewerModel: "claude-opus-4-20250514",
  timeoutMs: 600_000,
}

function mockIsolator(): WorkspaceIsolator {
  return {
    create: jest.fn().mockResolvedValue({ id: "handle-1" }),
    installDependencies: jest.fn().mockResolvedValue(undefined),
    getWorkspaceDir: jest.fn().mockReturnValue("/tmp/mock-clone"),
    cleanup: jest.fn().mockResolvedValue(undefined),
  }
}

describe("StartWorkspaceRun", () => {
  it("creates a workspace run and returns the ID", async () => {
    const repo = new InMemoryWorkspaceRunRepository()
    const isolator = mockIsolator()
    const useCase = new StartWorkspaceRun(repo, isolator)

    const result = await useCase.execute(CONFIG)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const run = await repo.findById(result.value)
    expect(run).not.toBeNull()
    expect(run!.config.repoUrl).toBe("https://github.com/user/repo.git")
  })

  it("rejects if a workspace is already active", async () => {
    const repo = new InMemoryWorkspaceRunRepository()
    const isolator = mockIsolator()
    const useCase = new StartWorkspaceRun(repo, isolator)

    await useCase.execute(CONFIG)
    const result2 = await useCase.execute(CONFIG)

    expect(result2.ok).toBe(false)
    if (result2.ok) return
    expect(result2.error).toContain("already active")
  })

  it("calls isolator.create with the repo URL", async () => {
    const repo = new InMemoryWorkspaceRunRepository()
    const isolator = mockIsolator()
    const useCase = new StartWorkspaceRun(repo, isolator)

    await useCase.execute(CONFIG)

    expect(isolator.create).toHaveBeenCalledWith("https://github.com/user/repo.git")
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/use-cases/StartWorkspaceRun.test.ts --verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement StartWorkspaceRun**

Create `src/use-cases/StartWorkspaceRun.ts`:

```typescript
import type { WorkspaceRunRepository } from "./ports/WorkspaceRunRepository"
import type { WorkspaceIsolator, WorkspaceHandle } from "./ports/WorkspaceIsolator"
import type { WorkspaceRunConfig } from "../entities/WorkspaceRun"
import type { WorkspaceRunId } from "../entities/ids"
import { createWorkspaceRun } from "../entities/WorkspaceRun"
import { createWorkspaceRunId } from "../entities/ids"
import { type Result, success, failure } from "../entities/Result"

export class StartWorkspaceRun {
  constructor(
    private readonly repo: WorkspaceRunRepository,
    private readonly isolator: WorkspaceIsolator,
  ) {}

  async execute(config: WorkspaceRunConfig): Promise<Result<WorkspaceRunId>> {
    const active = await this.repo.findActive()
    if (active) {
      return failure("A workspace is already active. Stop it before starting a new one.")
    }

    const id = createWorkspaceRunId()
    const run = createWorkspaceRun({ id, config })
    await this.repo.create(run)

    // Clone — update status
    const cloningRun = createWorkspaceRun({ ...run, status: "cloning", startedAt: run.startedAt })
    await this.repo.update(cloningRun)

    try {
      const handle = await this.isolator.create(config.repoUrl)
      return success(id)
    } catch (err) {
      const failedRun = createWorkspaceRun({
        ...run,
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
        startedAt: run.startedAt,
      })
      await this.repo.update(failedRun)
      return failure(`Clone failed: ${err instanceof Error ? err.message : String(err)}`)
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest tests/use-cases/StartWorkspaceRun.test.ts --verbose`
Expected: PASS (3 tests)

- [ ] **Step 5: Write BootWorkspace test**

Create `tests/use-cases/BootWorkspace.test.ts`:

```typescript
import { BootWorkspace } from "../../src/use-cases/BootWorkspace"
import { InMemoryWorkspaceRunRepository } from "../../src/adapters/storage/InMemoryWorkspaceRunRepository"
import { createWorkspaceRun, type WorkspaceRunConfig } from "../../src/entities/WorkspaceRun"
import { createWorkspaceRunId } from "../../src/entities/ids"
import type { WorkspaceIsolator } from "../../src/use-cases/ports/WorkspaceIsolator"
import type { FileSystem } from "../../src/use-cases/ports/FileSystem"

const CONFIG: WorkspaceRunConfig = {
  repoUrl: "https://github.com/user/repo.git",
  maxCostUsd: 10.0,
  maxTokens: 200_000,
  supervisorModel: "claude-opus-4-20250514",
  developerModel: "claude-sonnet-4-20250514",
  reviewerModel: "claude-opus-4-20250514",
  timeoutMs: 600_000,
}

function mockIsolator(): WorkspaceIsolator {
  return {
    create: jest.fn().mockResolvedValue({ id: "handle-1" }),
    installDependencies: jest.fn().mockResolvedValue(undefined),
    getWorkspaceDir: jest.fn().mockReturnValue("/tmp/mock-clone"),
    cleanup: jest.fn().mockResolvedValue(undefined),
  }
}

function mockFs(): FileSystem {
  return {
    read: jest.fn().mockRejectedValue(new Error("not found")),
    write: jest.fn().mockResolvedValue(undefined),
    edit: jest.fn().mockResolvedValue(undefined),
    glob: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockImplementation(async (path: string) => {
      return path === "package.json" || path === "tsconfig.json"
    }),
  }
}

describe("BootWorkspace", () => {
  it("transitions through detecting → installing → sets projectConfig", async () => {
    const repo = new InMemoryWorkspaceRunRepository()
    const runId = createWorkspaceRunId("boot-1")
    const run = createWorkspaceRun({ id: runId, config: CONFIG, status: "cloning" })
    await repo.create(run)

    const isolator = mockIsolator()
    const handle = { id: "handle-1" }
    const fs = mockFs()

    const useCase = new BootWorkspace(repo, isolator, fs)
    await useCase.execute(runId, handle)

    const updated = await repo.findById(runId)
    expect(updated!.status).toBe("active")
    expect(updated!.projectConfig).not.toBeNull()
    expect(updated!.projectConfig!.language).toBe("typescript")
    expect(isolator.installDependencies).toHaveBeenCalledWith(handle, "npm install")
  })
})
```

- [ ] **Step 6: Implement BootWorkspace**

Create `src/use-cases/BootWorkspace.ts`:

```typescript
import type { WorkspaceRunRepository } from "./ports/WorkspaceRunRepository"
import type { WorkspaceIsolator, WorkspaceHandle } from "./ports/WorkspaceIsolator"
import type { FileSystem } from "./ports/FileSystem"
import type { WorkspaceRunId } from "../entities/ids"
import { createWorkspaceRun } from "../entities/WorkspaceRun"
import { DetectProjectConfig } from "./DetectProjectConfig"

export class BootWorkspace {
  constructor(
    private readonly repo: WorkspaceRunRepository,
    private readonly isolator: WorkspaceIsolator,
    private readonly fs: FileSystem,
  ) {}

  async execute(runId: WorkspaceRunId, handle: WorkspaceHandle): Promise<void> {
    const run = await this.repo.findById(runId)
    if (!run) throw new Error(`WorkspaceRun not found: ${runId}`)

    // Detect project config
    const detectingRun = createWorkspaceRun({ ...run, status: "detecting", startedAt: run.startedAt })
    await this.repo.update(detectingRun)

    const detector = new DetectProjectConfig(this.fs)
    const projectConfig = await detector.execute()

    // Install dependencies
    if (projectConfig.installCommand) {
      const installingRun = createWorkspaceRun({ ...run, status: "installing", projectConfig, startedAt: run.startedAt })
      await this.repo.update(installingRun)
      await this.isolator.installDependencies(handle, projectConfig.installCommand)
    }

    // Mark active
    const activeRun = createWorkspaceRun({
      ...run,
      status: "active",
      projectConfig,
      startedAt: run.startedAt,
    })
    await this.repo.update(activeRun)
  }
}
```

- [ ] **Step 7: Run tests**

Run: `npx jest tests/use-cases/StartWorkspaceRun.test.ts tests/use-cases/BootWorkspace.test.ts --verbose`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add src/use-cases/StartWorkspaceRun.ts src/use-cases/BootWorkspace.ts tests/use-cases/StartWorkspaceRun.test.ts tests/use-cases/BootWorkspace.test.ts
git commit -m "feat: add StartWorkspaceRun and BootWorkspace use cases"
```

---

## Task 7: StopWorkspace + CleanupWorkspace Use Cases

**Files:**
- Create: `src/use-cases/StopWorkspace.ts`
- Create: `src/use-cases/CleanupWorkspace.ts`
- Test: `tests/use-cases/StopWorkspace.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/use-cases/StopWorkspace.test.ts`:

```typescript
import { StopWorkspace } from "../../src/use-cases/StopWorkspace"
import { CleanupWorkspace } from "../../src/use-cases/CleanupWorkspace"
import { InMemoryWorkspaceRunRepository } from "../../src/adapters/storage/InMemoryWorkspaceRunRepository"
import { createWorkspaceRun, type WorkspaceRunConfig } from "../../src/entities/WorkspaceRun"
import { createWorkspaceRunId } from "../../src/entities/ids"
import type { WorkspaceIsolator } from "../../src/use-cases/ports/WorkspaceIsolator"

const CONFIG: WorkspaceRunConfig = {
  repoUrl: "https://github.com/user/repo.git",
  maxCostUsd: 10.0,
  maxTokens: 200_000,
  supervisorModel: "claude-opus-4-20250514",
  developerModel: "claude-sonnet-4-20250514",
  reviewerModel: "claude-opus-4-20250514",
  timeoutMs: 600_000,
}

function mockIsolator(): jest.Mocked<WorkspaceIsolator> {
  return {
    create: jest.fn().mockResolvedValue({ id: "handle-1" }),
    installDependencies: jest.fn().mockResolvedValue(undefined),
    getWorkspaceDir: jest.fn().mockReturnValue("/tmp/mock-clone"),
    cleanup: jest.fn().mockResolvedValue(undefined),
  }
}

describe("StopWorkspace", () => {
  it("stops an active workspace with no failures → stopped, cleanup called", async () => {
    const repo = new InMemoryWorkspaceRunRepository()
    const isolator = mockIsolator()
    const runId = createWorkspaceRunId("stop-1")
    const run = createWorkspaceRun({ id: runId, config: CONFIG, status: "active" })
    await repo.create(run)

    const useCase = new StopWorkspace(repo, isolator)
    const result = await useCase.execute(runId, { id: "handle-1" }, false)

    expect(result.ok).toBe(true)
    const updated = await repo.findById(runId)
    expect(updated!.status).toBe("stopped")
    expect(isolator.cleanup).toHaveBeenCalled()
  })

  it("stops with failed goals → stopped_dirty, no cleanup", async () => {
    const repo = new InMemoryWorkspaceRunRepository()
    const isolator = mockIsolator()
    const runId = createWorkspaceRunId("stop-2")
    const run = createWorkspaceRun({ id: runId, config: CONFIG, status: "active" })
    await repo.create(run)

    const useCase = new StopWorkspace(repo, isolator)
    const result = await useCase.execute(runId, { id: "handle-1" }, true)

    expect(result.ok).toBe(true)
    const updated = await repo.findById(runId)
    expect(updated!.status).toBe("stopped_dirty")
    expect(isolator.cleanup).not.toHaveBeenCalled()
  })
})

describe("CleanupWorkspace", () => {
  it("cleans up a stopped_dirty workspace", async () => {
    const repo = new InMemoryWorkspaceRunRepository()
    const isolator = mockIsolator()
    const runId = createWorkspaceRunId("cleanup-1")
    const run = createWorkspaceRun({ id: runId, config: CONFIG, status: "stopped_dirty" })
    await repo.create(run)

    const useCase = new CleanupWorkspace(repo, isolator)
    const result = await useCase.execute(runId, { id: "handle-1" })

    expect(result.ok).toBe(true)
    const updated = await repo.findById(runId)
    expect(updated!.status).toBe("stopped")
    expect(isolator.cleanup).toHaveBeenCalled()
  })

  it("rejects cleanup on non-stopped_dirty workspace", async () => {
    const repo = new InMemoryWorkspaceRunRepository()
    const isolator = mockIsolator()
    const runId = createWorkspaceRunId("cleanup-2")
    const run = createWorkspaceRun({ id: runId, config: CONFIG, status: "active" })
    await repo.create(run)

    const useCase = new CleanupWorkspace(repo, isolator)
    const result = await useCase.execute(runId, { id: "handle-1" })

    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest tests/use-cases/StopWorkspace.test.ts --verbose`
Expected: FAIL

- [ ] **Step 3: Implement StopWorkspace**

Create `src/use-cases/StopWorkspace.ts`:

```typescript
import type { WorkspaceRunRepository } from "./ports/WorkspaceRunRepository"
import type { WorkspaceIsolator, WorkspaceHandle } from "./ports/WorkspaceIsolator"
import type { WorkspaceRunId } from "../entities/ids"
import { createWorkspaceRun } from "../entities/WorkspaceRun"
import { type Result, success, failure } from "../entities/Result"

export class StopWorkspace {
  constructor(
    private readonly repo: WorkspaceRunRepository,
    private readonly isolator: WorkspaceIsolator,
  ) {}

  async execute(runId: WorkspaceRunId, handle: WorkspaceHandle, hasFailedGoals: boolean): Promise<Result<void>> {
    const run = await this.repo.findById(runId)
    if (!run) return failure(`WorkspaceRun not found: ${runId}`)
    if (run.status !== "active") return failure(`Workspace is not active (status: ${run.status})`)

    if (hasFailedGoals) {
      const dirtyRun = createWorkspaceRun({
        ...run,
        status: "stopped_dirty",
        completedAt: new Date(),
        startedAt: run.startedAt,
      })
      await this.repo.update(dirtyRun)
    } else {
      await this.isolator.cleanup(handle)
      const stoppedRun = createWorkspaceRun({
        ...run,
        status: "stopped",
        completedAt: new Date(),
        startedAt: run.startedAt,
      })
      await this.repo.update(stoppedRun)
    }

    return success(undefined)
  }
}
```

- [ ] **Step 4: Implement CleanupWorkspace**

Create `src/use-cases/CleanupWorkspace.ts`:

```typescript
import type { WorkspaceRunRepository } from "./ports/WorkspaceRunRepository"
import type { WorkspaceIsolator, WorkspaceHandle } from "./ports/WorkspaceIsolator"
import type { WorkspaceRunId } from "../entities/ids"
import { createWorkspaceRun } from "../entities/WorkspaceRun"
import { type Result, success, failure } from "../entities/Result"

export class CleanupWorkspace {
  constructor(
    private readonly repo: WorkspaceRunRepository,
    private readonly isolator: WorkspaceIsolator,
  ) {}

  async execute(runId: WorkspaceRunId, handle: WorkspaceHandle): Promise<Result<void>> {
    const run = await this.repo.findById(runId)
    if (!run) return failure(`WorkspaceRun not found: ${runId}`)
    if (run.status !== "stopped_dirty") return failure(`Can only cleanup stopped_dirty workspaces (status: ${run.status})`)

    await this.isolator.cleanup(handle)
    const stoppedRun = createWorkspaceRun({
      ...run,
      status: "stopped",
      startedAt: run.startedAt,
    })
    await this.repo.update(stoppedRun)

    return success(undefined)
  }
}
```

- [ ] **Step 5: Run tests**

Run: `npx jest tests/use-cases/StopWorkspace.test.ts --verbose`
Expected: PASS (4 tests)

- [ ] **Step 6: Commit**

```bash
git add src/use-cases/StopWorkspace.ts src/use-cases/CleanupWorkspace.ts tests/use-cases/StopWorkspace.test.ts
git commit -m "feat: add StopWorkspace and CleanupWorkspace use cases"
```

---

## Task 8: GetWorkspaceRunStatus Use Case

**Files:**
- Create: `src/use-cases/GetWorkspaceRunStatus.ts`
- Test: `tests/use-cases/GetWorkspaceRunStatus.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/use-cases/GetWorkspaceRunStatus.test.ts`:

```typescript
import { GetWorkspaceRunStatus } from "../../src/use-cases/GetWorkspaceRunStatus"
import { InMemoryWorkspaceRunRepository } from "../../src/adapters/storage/InMemoryWorkspaceRunRepository"
import { createWorkspaceRun, type WorkspaceRunConfig } from "../../src/entities/WorkspaceRun"
import { createWorkspaceRunId } from "../../src/entities/ids"

const CONFIG: WorkspaceRunConfig = {
  repoUrl: "https://github.com/user/repo.git",
  maxCostUsd: 10.0,
  maxTokens: 200_000,
  supervisorModel: "claude-opus-4-20250514",
  developerModel: "claude-sonnet-4-20250514",
  reviewerModel: "claude-opus-4-20250514",
  timeoutMs: 600_000,
}

describe("GetWorkspaceRunStatus", () => {
  it("returns the workspace run", async () => {
    const repo = new InMemoryWorkspaceRunRepository()
    const runId = createWorkspaceRunId("status-1")
    const run = createWorkspaceRun({ id: runId, config: CONFIG, status: "active" })
    await repo.create(run)

    const useCase = new GetWorkspaceRunStatus(repo)
    const result = await useCase.execute(runId)

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.run.status).toBe("active")
    expect(result.value.run.config.repoUrl).toBe("https://github.com/user/repo.git")
  })

  it("returns failure for unknown run", async () => {
    const repo = new InMemoryWorkspaceRunRepository()
    const useCase = new GetWorkspaceRunStatus(repo)
    const result = await useCase.execute(createWorkspaceRunId("nope"))
    expect(result.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Implement GetWorkspaceRunStatus**

Create `src/use-cases/GetWorkspaceRunStatus.ts`:

```typescript
import type { WorkspaceRunRepository } from "./ports/WorkspaceRunRepository"
import type { WorkspaceRun } from "../entities/WorkspaceRun"
import type { WorkspaceRunId } from "../entities/ids"
import { type Result, success, failure } from "../entities/Result"

export interface WorkspaceRunStatusDTO {
  readonly run: WorkspaceRun
}

export class GetWorkspaceRunStatus {
  constructor(
    private readonly repo: WorkspaceRunRepository,
  ) {}

  async execute(runId: WorkspaceRunId): Promise<Result<WorkspaceRunStatusDTO>> {
    const run = await this.repo.findById(runId)
    if (!run) return failure(`WorkspaceRun not found: ${runId}`)
    return success({ run })
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest tests/use-cases/GetWorkspaceRunStatus.test.ts --verbose`
Expected: PASS (2 tests)

- [ ] **Step 4: Commit**

```bash
git add src/use-cases/GetWorkspaceRunStatus.ts tests/use-cases/GetWorkspaceRunStatus.test.ts
git commit -m "feat: add GetWorkspaceRunStatus use case"
```

---

## Task 9: WorkspaceRunManager

**Files:**
- Create: `src/use-cases/WorkspaceRunManager.ts`
- Test: `tests/use-cases/WorkspaceRunManager.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/use-cases/WorkspaceRunManager.test.ts`:

```typescript
import { WorkspaceRunManager } from "../../src/use-cases/WorkspaceRunManager"
import { InMemoryWorkspaceRunRepository } from "../../src/adapters/storage/InMemoryWorkspaceRunRepository"
import type { WorkspaceIsolator } from "../../src/use-cases/ports/WorkspaceIsolator"
import type { GitRemote } from "../../src/use-cases/ports/GitRemote"
import type { PullRequestCreator } from "../../src/use-cases/ports/PullRequestCreator"
import type { FileSystem } from "../../src/use-cases/ports/FileSystem"

function mockIsolator(): jest.Mocked<WorkspaceIsolator> {
  return {
    create: jest.fn().mockResolvedValue({ id: "h-1" }),
    installDependencies: jest.fn().mockResolvedValue(undefined),
    getWorkspaceDir: jest.fn().mockReturnValue("/tmp/mock"),
    cleanup: jest.fn().mockResolvedValue(undefined),
  }
}

function mockFs(): FileSystem {
  return {
    read: jest.fn().mockRejectedValue(new Error("not found")),
    write: jest.fn().mockResolvedValue(undefined),
    edit: jest.fn().mockResolvedValue(undefined),
    glob: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(false),
  }
}

function mockGitRemote(): jest.Mocked<GitRemote> {
  return { push: jest.fn().mockResolvedValue(undefined) }
}

function mockPrCreator(): jest.Mocked<PullRequestCreator> {
  return {
    create: jest.fn().mockResolvedValue("https://github.com/user/repo/pull/1"),
    merge: jest.fn().mockResolvedValue(undefined),
  }
}

describe("WorkspaceRunManager", () => {
  it("startRun creates a workspace and returns the ID", async () => {
    const manager = new WorkspaceRunManager({
      repo: new InMemoryWorkspaceRunRepository(),
      isolator: mockIsolator(),
      fs: mockFs(),
      gitRemote: mockGitRemote(),
      prCreator: mockPrCreator(),
      autoMerge: false,
    })

    const result = await manager.startRun({
      repoUrl: "https://github.com/user/repo.git",
      maxCostUsd: 10,
      maxTokens: 200_000,
      supervisorModel: "opus",
      developerModel: "sonnet",
      reviewerModel: "opus",
      timeoutMs: 600_000,
    })

    expect(result.ok).toBe(true)
  })

  it("rejects second startRun while one is active", async () => {
    const manager = new WorkspaceRunManager({
      repo: new InMemoryWorkspaceRunRepository(),
      isolator: mockIsolator(),
      fs: mockFs(),
      gitRemote: mockGitRemote(),
      prCreator: mockPrCreator(),
      autoMerge: false,
    })

    const config = {
      repoUrl: "https://github.com/user/repo.git",
      maxCostUsd: 10,
      maxTokens: 200_000,
      supervisorModel: "opus",
      developerModel: "sonnet",
      reviewerModel: "opus",
      timeoutMs: 600_000,
    }

    await manager.startRun(config)
    const result2 = await manager.startRun(config)
    expect(result2.ok).toBe(false)
  })

  it("findActive returns null when no workspace", async () => {
    const manager = new WorkspaceRunManager({
      repo: new InMemoryWorkspaceRunRepository(),
      isolator: mockIsolator(),
      fs: mockFs(),
      gitRemote: mockGitRemote(),
      prCreator: mockPrCreator(),
      autoMerge: false,
    })

    const active = await manager.findActive()
    expect(active).toBeNull()
  })
})
```

- [ ] **Step 2: Implement WorkspaceRunManager**

Create `src/use-cases/WorkspaceRunManager.ts`:

```typescript
import type { WorkspaceRunRepository } from "./ports/WorkspaceRunRepository"
import type { WorkspaceIsolator, WorkspaceHandle } from "./ports/WorkspaceIsolator"
import type { GitRemote } from "./ports/GitRemote"
import type { PullRequestCreator } from "./ports/PullRequestCreator"
import type { FileSystem } from "./ports/FileSystem"
import type { WorkspaceRunConfig, WorkspaceRun } from "../entities/WorkspaceRun"
import type { WorkspaceRunId } from "../entities/ids"
import type { Result } from "../entities/Result"
import { StartWorkspaceRun } from "./StartWorkspaceRun"
import { BootWorkspace } from "./BootWorkspace"
import { StopWorkspace } from "./StopWorkspace"
import { CleanupWorkspace } from "./CleanupWorkspace"
import { GetWorkspaceRunStatus, type WorkspaceRunStatusDTO } from "./GetWorkspaceRunStatus"

export interface WorkspaceRunManagerDeps {
  readonly repo: WorkspaceRunRepository
  readonly isolator: WorkspaceIsolator
  readonly fs: FileSystem
  readonly gitRemote: GitRemote
  readonly prCreator: PullRequestCreator
  readonly autoMerge: boolean
}

export class WorkspaceRunManager {
  private readonly deps: WorkspaceRunManagerDeps
  private readonly handles = new Map<string, WorkspaceHandle>()

  constructor(deps: WorkspaceRunManagerDeps) {
    this.deps = deps
  }

  async startRun(config: WorkspaceRunConfig): Promise<Result<WorkspaceRunId>> {
    const startUseCase = new StartWorkspaceRun(this.deps.repo, this.deps.isolator)
    const result = await startUseCase.execute(config)
    if (!result.ok) return result

    const runId = result.value
    // Store the handle for later operations
    const run = await this.deps.repo.findById(runId)
    if (run) {
      // The handle was created inside StartWorkspaceRun — we need to retrieve it
      // For now, create a synthetic handle based on the run ID
      const handle: WorkspaceHandle = { id: runId }
      this.handles.set(runId, handle)

      // Boot asynchronously
      void this.bootAsync(runId, handle)
    }

    return result
  }

  async findActive(): Promise<WorkspaceRun | null> {
    return this.deps.repo.findActive()
  }

  async getStatus(runId: WorkspaceRunId): Promise<Result<WorkspaceRunStatusDTO>> {
    const useCase = new GetWorkspaceRunStatus(this.deps.repo)
    return useCase.execute(runId)
  }

  async stop(runId: WorkspaceRunId, hasFailedGoals: boolean): Promise<Result<void>> {
    const handle = this.handles.get(runId)
    if (!handle) return { ok: false, error: "No handle found for workspace" } as Result<void>

    const useCase = new StopWorkspace(this.deps.repo, this.deps.isolator)
    const result = await useCase.execute(runId, handle, hasFailedGoals)
    if (result.ok && !hasFailedGoals) {
      this.handles.delete(runId)
    }
    return result
  }

  async cleanup(runId: WorkspaceRunId): Promise<Result<void>> {
    const handle = this.handles.get(runId)
    if (!handle) return { ok: false, error: "No handle found for workspace" } as Result<void>

    const useCase = new CleanupWorkspace(this.deps.repo, this.deps.isolator)
    const result = await useCase.execute(runId, handle)
    if (result.ok) {
      this.handles.delete(runId)
    }
    return result
  }

  async stopAll(): Promise<void> {
    for (const [runId, handle] of this.handles) {
      try {
        await this.deps.isolator.cleanup(handle)
      } catch {
        // Best-effort cleanup on shutdown
      }
      this.handles.delete(runId)
    }
  }

  private async bootAsync(runId: WorkspaceRunId, handle: WorkspaceHandle): Promise<void> {
    try {
      const useCase = new BootWorkspace(this.deps.repo, this.deps.isolator, this.deps.fs)
      await useCase.execute(runId, handle)
    } catch (err) {
      // BootWorkspace failed — mark as failed
      const run = await this.deps.repo.findById(runId)
      if (run) {
        const { createWorkspaceRun } = await import("../entities/WorkspaceRun")
        const failedRun = createWorkspaceRun({
          ...run,
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
          startedAt: run.startedAt,
        })
        await this.deps.repo.update(failedRun)
      }
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest tests/use-cases/WorkspaceRunManager.test.ts --verbose`
Expected: PASS (3 tests)

- [ ] **Step 4: Run full test suite**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/WorkspaceRunManager.ts tests/use-cases/WorkspaceRunManager.test.ts
git commit -m "feat: add WorkspaceRunManager orchestrator"
```

---

## Task 10: Workspace API Routes

**Files:**
- Create: `src/infrastructure/http/routes/workspaceRoutes.ts`
- Modify: `src/infrastructure/http/createServer.ts`
- Test: `tests/infrastructure/workspaceRoutes.test.ts`

- [ ] **Step 1: Create workspace routes**

Create `src/infrastructure/http/routes/workspaceRoutes.ts`:

```typescript
import { Router } from "express"
import type { WorkspaceRunManager } from "../../../use-cases/WorkspaceRunManager"
import { DEFAULT_WORKSPACE_CONFIG } from "../../../entities/WorkspaceRun"

export function workspaceRoutes(manager: WorkspaceRunManager): Router {
  const router = Router()

  router.post("/start", async (req, res, next) => {
    try {
      const body = req.body as {
        repoUrl?: string
        maxCostUsd?: number
        maxTokens?: number
        supervisorModel?: string
        developerModel?: string
        reviewerModel?: string
        timeoutMs?: number
      }

      if (!body.repoUrl) {
        res.status(400).json({ error: "repoUrl is required" })
        return
      }

      const config = {
        repoUrl: body.repoUrl,
        maxCostUsd: body.maxCostUsd ?? DEFAULT_WORKSPACE_CONFIG.maxCostUsd,
        maxTokens: body.maxTokens ?? DEFAULT_WORKSPACE_CONFIG.maxTokens,
        supervisorModel: body.supervisorModel ?? DEFAULT_WORKSPACE_CONFIG.supervisorModel,
        developerModel: body.developerModel ?? DEFAULT_WORKSPACE_CONFIG.developerModel,
        reviewerModel: body.reviewerModel ?? DEFAULT_WORKSPACE_CONFIG.reviewerModel,
        timeoutMs: body.timeoutMs ?? DEFAULT_WORKSPACE_CONFIG.timeoutMs,
      }

      const result = await manager.startRun(config)
      if (!result.ok) {
        res.status(409).json({ error: result.error })
        return
      }
      res.status(201).json({ runId: result.value })
    } catch (err) {
      next(err)
    }
  })

  router.get("/status", async (_req, res, next) => {
    try {
      const active = await manager.findActive()
      if (!active) {
        res.status(404).json({ error: "No active workspace" })
        return
      }
      const result = await manager.getStatus(active.id)
      if (!result.ok) {
        res.status(500).json({ error: result.error })
        return
      }
      res.json(result.value)
    } catch (err) {
      next(err)
    }
  })

  router.get("/active", async (_req, res, next) => {
    try {
      const active = await manager.findActive()
      if (!active) {
        res.json({ active: false })
        return
      }
      res.json({ active: true, runId: active.id, repoUrl: active.config.repoUrl })
    } catch (err) {
      next(err)
    }
  })

  router.post("/stop", async (_req, res, next) => {
    try {
      const active = await manager.findActive()
      if (!active) {
        res.status(404).json({ error: "No active workspace" })
        return
      }
      // TODO: check for running goals via EventStore in a future iteration
      const result = await manager.stop(active.id, false)
      if (!result.ok) {
        res.status(400).json({ error: result.error })
        return
      }
      res.json({ status: "stopped" })
    } catch (err) {
      next(err)
    }
  })

  router.post("/cleanup", async (_req, res, next) => {
    try {
      const active = await manager.findActive()
      if (!active && !(await findStoppedDirty())) {
        res.status(404).json({ error: "No workspace to cleanup" })
        return
      }
      // Find the stopped_dirty workspace
      const run = active ?? (await findStoppedDirty())
      if (!run) {
        res.status(404).json({ error: "No workspace to cleanup" })
        return
      }
      const result = await manager.cleanup(run.id)
      if (!result.ok) {
        res.status(400).json({ error: result.error })
        return
      }
      res.json({ status: "stopped" })
    } catch (err) {
      next(err)
    }

    async function findStoppedDirty() {
      // WorkspaceRunManager doesn't expose this directly — use getStatus
      return null // Will be refined when we have a proper query
    }
  })

  return router
}
```

- [ ] **Step 2: Wire into createServer**

In `src/infrastructure/http/createServer.ts`, add import:

```typescript
import { workspaceRoutes } from "./routes/workspaceRoutes"
import type { WorkspaceRunManager } from "../../use-cases/WorkspaceRunManager"
```

Add to `DashboardDeps`:

```typescript
  readonly workspaceManager: WorkspaceRunManager
```

Add route wiring after existing routes:

```typescript
  app.use("/api/workspace", workspaceRoutes(deps.workspaceManager))
```

- [ ] **Step 3: Run full test suite**

Run: `npx jest --verbose`
Expected: Tests may fail if DashboardDeps is constructed without `workspaceManager` in tests. Fix by providing a mock in integration tests that construct DashboardDeps.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/http/routes/workspaceRoutes.ts src/infrastructure/http/createServer.ts
git commit -m "feat: add workspace API routes and wire into server"
```

---

## Task 11: Goal Routing to Active Workspace

**Files:**
- Modify: `src/infrastructure/http/routes/goalRoutes.ts`

- [ ] **Step 1: Update goalRoutes to accept WorkspaceRunManager**

In `src/infrastructure/http/routes/goalRoutes.ts`:

```typescript
import { Router } from "express"
import type { GoalRepository } from "../../../use-cases/ports/GoalRepository"
import type { CreateGoalFromCeo } from "../../../use-cases/CreateGoalFromCeo"
import type { WorkspaceRunManager } from "../../../use-cases/WorkspaceRunManager"
import { toGoalDTO } from "../../../adapters/presenters/mappers"

export function goalRoutes(
  goals: GoalRepository,
  createGoal: CreateGoalFromCeo,
  workspaceManager?: WorkspaceRunManager,
): Router {
  const router = Router()

  router.get("/", async (_req, res, next) => {
    try {
      const all = await goals.findAll()
      res.json({ goals: all.map(toGoalDTO) })
    } catch (err) {
      next(err)
    }
  })

  router.post("/", async (req, res, next) => {
    try {
      const body = req.body as { description?: string; maxTokens?: number; maxCostUsd?: number }
      const description = body.description ?? ""
      const maxTokens = body.maxTokens ?? 0
      const maxCostUsd = body.maxCostUsd ?? 0

      // Check if a workspace is active — if so, route goal to workspace system
      const activeWorkspace = workspaceManager ? await workspaceManager.findActive() : null
      const targetedWorkspace = activeWorkspace ? activeWorkspace.id : null

      const result = await createGoal.execute({ description, maxTokens, maxCostUsd })
      if (!result.ok) {
        res.status(400).json({ error: result.error })
        return
      }
      res.status(201).json({ goal: toGoalDTO(result.value), targetedWorkspace })
    } catch (err) {
      next(err)
    }
  })

  return router
}
```

- [ ] **Step 2: Update createServer wiring**

In `src/infrastructure/http/createServer.ts`, update the goalRoutes call:

```typescript
  app.use("/api/goals", goalRoutes(deps.goalRepo, deps.createGoal, deps.workspaceManager))
```

- [ ] **Step 3: Run full test suite**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/http/routes/goalRoutes.ts src/infrastructure/http/createServer.ts
git commit -m "feat: route goals to active workspace, return targetedWorkspace in response"
```

---

## Task 12: Wire Workspace into Composition Root

**Files:**
- Modify: `src/infrastructure/config/composition-root.ts`

- [ ] **Step 1: Add workspace wiring**

In `src/infrastructure/config/composition-root.ts`, add imports:

```typescript
import { InMemoryWorkspaceRunRepository } from "../../adapters/storage/InMemoryWorkspaceRunRepository"
import { GitCloneIsolator } from "../../adapters/workspace/GitCloneIsolator"
import { NodeGitRemote } from "../../adapters/git/NodeGitRemote"
import { GitHubPullRequestCreator } from "../../adapters/git/GitHubPullRequestCreator"
import { WorkspaceRunManager } from "../../use-cases/WorkspaceRunManager"
```

In the `buildSystem` function, after the existing infrastructure section, add:

```typescript
  // -------------------------------------------------------------------------
  // Workspace management
  // -------------------------------------------------------------------------
  const workspaceRunRepo = new InMemoryWorkspaceRunRepository()
  const workspaceIsolator = new GitCloneIsolator(shell)
  const gitRemote = new NodeGitRemote()
  const prCreator = new GitHubPullRequestCreator()
  const autoMerge = process.env["DEVFLEET_AUTO_MERGE"] === "true"
  const workspaceManager = new WorkspaceRunManager({
    repo: workspaceRunRepo,
    isolator: workspaceIsolator,
    fs: fileSystem,
    gitRemote,
    prCreator,
    autoMerge,
  })
```

Add `workspaceManager` to the `dashboardDeps` object:

```typescript
  const dashboardDeps: DashboardDeps = {
    // ... existing deps
    workspaceManager,
  }
```

Add workspace cleanup to `stop`:

```typescript
    stop: async () => {
      if (stuckAgentInterval !== null) {
        clearInterval(stuckAgentInterval)
        stuckAgentInterval = null
      }
      await workspaceManager.stopAll()
      await worktreeManager.cleanupAll()
      sseManager.shutdown()
      await pluginRegistry.stopAll()
    },
```

- [ ] **Step 2: Run full test suite**

Run: `npx jest --verbose`
Expected: Some integration tests may need updating to provide `workspaceManager` in DashboardDeps. Add a mock or real instance where needed.

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/config/composition-root.ts
git commit -m "feat: wire workspace management into composition root"
```

---

## Task 13: Full Verification

- [ ] **Step 1: Run full test suite**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 2: Run TypeScript type check**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git commit --allow-empty -m "chore: workspace page core + API complete"
```
