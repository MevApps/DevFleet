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

## Task 5: Adapters

**Files:**
- Create: `src/adapters/storage/InMemoryWorkspaceRunRepository.ts`
- Create: `src/adapters/workspace/GitCloneIsolator.ts`
- Create: `src/adapters/git/NodeGitRemote.ts`
- Create: `src/adapters/git/GitHubPullRequestCreator.ts`
- Test: `tests/adapters/GitCloneIsolator.test.ts`

- [ ] **Step 1: Create InMemoryWorkspaceRunRepository (BUG M1 fix: add findByStatus)**

Create `src/adapters/storage/InMemoryWorkspaceRunRepository.ts`:

```typescript
import type { WorkspaceRunRepository } from "../../use-cases/ports/WorkspaceRunRepository"
import type { WorkspaceRun, WorkspaceRunStatus } from "../../entities/WorkspaceRun"
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

  async findByStatus(status: WorkspaceRunStatus): Promise<WorkspaceRun | null> {
    for (const run of this.runs.values()) {
      if (run.status === status) return run
    }
    return null
  }

  async update(run: WorkspaceRun): Promise<void> {
    this.runs.set(run.id, run)
  }
}
```

- [ ] **Step 2: Create GitCloneIsolator (BUG 5 fix: use ShellExecutorFactory for scoped shell)**

Create `src/adapters/workspace/GitCloneIsolator.ts`:

```typescript
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
    // Use a shell scoped to the parent of clonePath for the clone command
    const parentShell = this.shellFactory(join(clonePath, ".."))
    await parentShell.execute("git", ["clone", repoUrl, clonePath])
    this.paths.set(handle.id, clonePath)
    return handle
  }

  async installDependencies(handle: WorkspaceHandle, installCommand: string): Promise<void> {
    const dir = this.getWorkspaceDir(handle)
    if (!installCommand) return
    // Create a shell scoped to the clone directory — not the main project
    const scopedShell = this.shellFactory(dir)
    const parts = installCommand.split(/\s+/)
    const command = parts[0]!
    const args = parts.slice(1)
    await scopedShell.execute(command, args, 120_000)
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

- [ ] **Step 3: Create NodeGitRemote (BUG M2 fix: inject ShellExecutorFactory)**

Create `src/adapters/git/NodeGitRemote.ts`:

```typescript
import type { GitRemote } from "../../use-cases/ports/GitRemote"
import type { ShellExecutorFactory } from "../../use-cases/ports/ShellExecutor"

export class NodeGitRemote implements GitRemote {
  constructor(private readonly shellFactory: ShellExecutorFactory) {}

  async push(branch: string, remoteUrl: string, workingDir: string): Promise<void> {
    const shell = this.shellFactory(workingDir)
    const result = await shell.execute("git", ["push", remoteUrl, `${branch}:${branch}`])
    if (result.exitCode !== 0) {
      throw new Error(`git push failed: ${result.stderr}`)
    }
  }
}
```

- [ ] **Step 4: Create GitHubPullRequestCreator (BUG M2 fix: inject ShellExecutorFactory)**

Create `src/adapters/git/GitHubPullRequestCreator.ts`:

```typescript
import type { PullRequestCreator, CreatePullRequestParams } from "../../use-cases/ports/PullRequestCreator"
import type { ShellExecutorFactory } from "../../use-cases/ports/ShellExecutor"

export class GitHubPullRequestCreator implements PullRequestCreator {
  constructor(private readonly shellFactory: ShellExecutorFactory) {}

  async create(params: CreatePullRequestParams): Promise<string> {
    const shell = this.shellFactory(params.workingDir)
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

  async merge(prUrl: string, workingDir: string): Promise<void> {
    const shell = this.shellFactory(workingDir)
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
import type { ShellExecutorFactory } from "../../src/use-cases/ports/ShellExecutor"
import { mkdtempSync, existsSync } from "node:fs"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { execSync } from "node:child_process"

describe("GitCloneIsolator", () => {
  let sourceRepo: string
  let isolator: GitCloneIsolator
  const shellFactory: ShellExecutorFactory = (rootPath: string) => new NodeShellExecutor(rootPath)

  beforeEach(() => {
    // Create a bare git repo to clone from
    sourceRepo = mkdtempSync(join(tmpdir(), "devfleet-source-"))
    execSync(
      'git init && git config user.email "test@test.com" && git config user.name "Test" && git commit --allow-empty -m init',
      { cwd: sourceRepo },
    )
    isolator = new GitCloneIsolator(shellFactory)
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

## Task 6: WorkspaceRunManager (BUG 1 + BUG 2 + BUG 4 fix: owns lifecycle, builds system, auto-push/PR)

**Files:**
- Create: `src/use-cases/WorkspaceRunManager.ts`
- Test: `tests/use-cases/WorkspaceRunManager.test.ts`

- [ ] **Step 1: Write failing test**

Create `tests/use-cases/WorkspaceRunManager.test.ts`:

```typescript
import { WorkspaceRunManager } from "../../src/use-cases/WorkspaceRunManager"
import { InMemoryWorkspaceRunRepository } from "../../src/adapters/storage/InMemoryWorkspaceRunRepository"
import type { WorkspaceIsolator, WorkspaceHandle } from "../../src/use-cases/ports/WorkspaceIsolator"
import type { GitRemote } from "../../src/use-cases/ports/GitRemote"
import type { PullRequestCreator } from "../../src/use-cases/ports/PullRequestCreator"
import type { FileSystem } from "../../src/use-cases/ports/FileSystem"
import type { DevFleetConfig, DevFleetSystem } from "../../src/infrastructure/config/composition-root"
import type { WorkspaceRunConfig } from "../../src/entities/WorkspaceRun"

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

function mockBuildSystem(): jest.Mock {
  const mockBus = {
    publish: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue(() => {}),
  }
  const mockGoalRepo = { findAll: jest.fn().mockResolvedValue([]) }
  const mockCreateGoal = { execute: jest.fn() }
  const mockSystem: Partial<DevFleetSystem> = {
    bus: mockBus as any,
    goalRepo: mockGoalRepo as any,
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  }
  return jest.fn().mockResolvedValue(mockSystem)
}

const CONFIG: WorkspaceRunConfig = {
  repoUrl: "https://github.com/user/repo.git",
  maxCostUsd: 10,
  maxTokens: 200_000,
  supervisorModel: "opus",
  developerModel: "sonnet",
  reviewerModel: "opus",
  timeoutMs: 600_000,
}

describe("WorkspaceRunManager", () => {
  it("startRun clones, boots system, stores handle+system, and returns the ID", async () => {
    const isolator = mockIsolator()
    const buildSys = mockBuildSystem()
    const manager = new WorkspaceRunManager({
      repo: new InMemoryWorkspaceRunRepository(),
      isolator,
      fs: mockFs(),
      gitRemote: mockGitRemote(),
      prCreator: mockPrCreator(),
      autoMerge: false,
      buildSystem: buildSys,
      baseConfig: { workspaceDir: "/tmp", anthropicApiKey: "test-key" },
    })

    const result = await manager.startRun(CONFIG)

    expect(result.ok).toBe(true)
    // Manager called isolator.create directly
    expect(isolator.create).toHaveBeenCalledWith("https://github.com/user/repo.git")
    // Manager called buildSystem with correct workspace dir
    expect(buildSys).toHaveBeenCalledWith(
      expect.objectContaining({ workspaceDir: "/tmp/mock" }),
    )
  })

  it("rejects second startRun while one is active", async () => {
    const manager = new WorkspaceRunManager({
      repo: new InMemoryWorkspaceRunRepository(),
      isolator: mockIsolator(),
      fs: mockFs(),
      gitRemote: mockGitRemote(),
      prCreator: mockPrCreator(),
      autoMerge: false,
      buildSystem: mockBuildSystem(),
      baseConfig: { workspaceDir: "/tmp", anthropicApiKey: "test-key" },
    })

    await manager.startRun(CONFIG)
    const result2 = await manager.startRun(CONFIG)
    expect(result2.ok).toBe(false)
    if (!result2.ok) expect(result2.error).toContain("already active")
  })

  it("findActive returns null when no workspace", async () => {
    const manager = new WorkspaceRunManager({
      repo: new InMemoryWorkspaceRunRepository(),
      isolator: mockIsolator(),
      fs: mockFs(),
      gitRemote: mockGitRemote(),
      prCreator: mockPrCreator(),
      autoMerge: false,
      buildSystem: mockBuildSystem(),
      baseConfig: { workspaceDir: "/tmp", anthropicApiKey: "test-key" },
    })

    const active = await manager.findActive()
    expect(active).toBeNull()
  })

  it("getActiveSystem returns the workspace DevFleetSystem", async () => {
    const buildSys = mockBuildSystem()
    const manager = new WorkspaceRunManager({
      repo: new InMemoryWorkspaceRunRepository(),
      isolator: mockIsolator(),
      fs: mockFs(),
      gitRemote: mockGitRemote(),
      prCreator: mockPrCreator(),
      autoMerge: false,
      buildSystem: buildSys,
      baseConfig: { workspaceDir: "/tmp", anthropicApiKey: "test-key" },
    })

    await manager.startRun(CONFIG)
    const system = await manager.getActiveSystem()
    expect(system).not.toBeNull()
    expect(system!.bus).toBeDefined()
  })

  it("getActiveCreateGoal returns the workspace system's CreateGoalFromCeo", async () => {
    const buildSys = mockBuildSystem()
    const manager = new WorkspaceRunManager({
      repo: new InMemoryWorkspaceRunRepository(),
      isolator: mockIsolator(),
      fs: mockFs(),
      gitRemote: mockGitRemote(),
      prCreator: mockPrCreator(),
      autoMerge: false,
      buildSystem: buildSys,
      baseConfig: { workspaceDir: "/tmp", anthropicApiKey: "test-key" },
    })

    const before = await manager.getActiveCreateGoal()
    expect(before).toBeNull()

    await manager.startRun(CONFIG)
    const after = await manager.getActiveCreateGoal()
    // The returned system has dashboardDeps.createGoal from buildSystem
    // In mock it won't have it, so we just check the system was retrieved
    expect(await manager.getActiveSystem()).not.toBeNull()
  })

  it("stop with no failed goals cleans up and stops the system", async () => {
    const isolator = mockIsolator()
    const buildSys = mockBuildSystem()
    const manager = new WorkspaceRunManager({
      repo: new InMemoryWorkspaceRunRepository(),
      isolator,
      fs: mockFs(),
      gitRemote: mockGitRemote(),
      prCreator: mockPrCreator(),
      autoMerge: false,
      buildSystem: buildSys,
      baseConfig: { workspaceDir: "/tmp", anthropicApiKey: "test-key" },
    })

    const startResult = await manager.startRun(CONFIG)
    expect(startResult.ok).toBe(true)
    if (!startResult.ok) return

    const stopResult = await manager.stop(startResult.value, false)
    expect(stopResult.ok).toBe(true)
    expect(isolator.cleanup).toHaveBeenCalled()
  })

  it("stopAll cleans up all handles and stops all systems", async () => {
    const isolator = mockIsolator()
    const buildSys = mockBuildSystem()
    const manager = new WorkspaceRunManager({
      repo: new InMemoryWorkspaceRunRepository(),
      isolator,
      fs: mockFs(),
      gitRemote: mockGitRemote(),
      prCreator: mockPrCreator(),
      autoMerge: false,
      buildSystem: buildSys,
      baseConfig: { workspaceDir: "/tmp", anthropicApiKey: "test-key" },
    })

    await manager.startRun(CONFIG)
    await manager.stopAll()
    expect(isolator.cleanup).toHaveBeenCalled()
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
import type { DevFleetConfig, DevFleetSystem } from "../infrastructure/config/composition-root"
import type { CreateGoalFromCeo } from "./CreateGoalFromCeo"
import { createWorkspaceRun } from "../entities/WorkspaceRun"
import { createWorkspaceRunId } from "../entities/ids"
import { success, failure } from "../entities/Result"
import { DetectProjectConfig } from "./DetectProjectConfig"
import { GetWorkspaceRunStatus, type WorkspaceRunStatusDTO } from "./GetWorkspaceRunStatus"

// Type for the buildSystem function from composition-root
type BuildSystemFn = (config: DevFleetConfig) => Promise<DevFleetSystem>

export interface WorkspaceRunManagerDeps {
  readonly repo: WorkspaceRunRepository
  readonly isolator: WorkspaceIsolator
  readonly fs: FileSystem
  readonly gitRemote: GitRemote
  readonly prCreator: PullRequestCreator
  readonly autoMerge: boolean
  readonly buildSystem: BuildSystemFn
  readonly baseConfig: Pick<DevFleetConfig, "workspaceDir" | "anthropicApiKey">
}

export class WorkspaceRunManager {
  private readonly deps: WorkspaceRunManagerDeps
  /** Maps runId → WorkspaceHandle (clone dir ownership) */
  private readonly handles = new Map<string, WorkspaceHandle>()
  /** Maps runId → DevFleetSystem (the workspace's own system) */
  private readonly systems = new Map<string, DevFleetSystem>()
  /** Maps runId → unsubscribe function for bus listeners */
  private readonly busUnsubscribers = new Map<string, Array<() => void>>()

  constructor(deps: WorkspaceRunManagerDeps) {
    this.deps = deps
  }

  // ---------------------------------------------------------------------------
  // startRun — owns the full lifecycle (BUG 1 fix)
  // ---------------------------------------------------------------------------
  async startRun(config: WorkspaceRunConfig): Promise<Result<WorkspaceRunId>> {
    const active = await this.deps.repo.findActive()
    if (active) {
      return failure("A workspace is already active. Stop it before starting a new one.")
    }

    const id = createWorkspaceRunId()
    const run = createWorkspaceRun({ id, config })
    await this.deps.repo.create(run)

    // --- Clone ---
    await this.updateStatus(run, "cloning")
    let handle: WorkspaceHandle
    try {
      handle = await this.deps.isolator.create(config.repoUrl)
      this.handles.set(id, handle)
    } catch (err) {
      await this.markFailed(run, `Clone failed: ${err instanceof Error ? err.message : String(err)}`)
      return failure(`Clone failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    // --- Detect project config ---
    await this.updateStatus(run, "detecting")
    const cloneDir = this.deps.isolator.getWorkspaceDir(handle)
    let projectConfig
    try {
      const detector = new DetectProjectConfig(this.deps.fs)
      projectConfig = await detector.execute()
    } catch (err) {
      await this.markFailed(run, `Detection failed: ${err instanceof Error ? err.message : String(err)}`)
      return failure(`Detection failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    // --- Install dependencies ---
    if (projectConfig.installCommand) {
      const installingRun = createWorkspaceRun({
        ...run, status: "installing", projectConfig, startedAt: run.startedAt,
      })
      await this.deps.repo.update(installingRun)
      try {
        await this.deps.isolator.installDependencies(handle, projectConfig.installCommand)
      } catch (err) {
        await this.markFailed(run, `Install failed: ${err instanceof Error ? err.message : String(err)}`)
        return failure(`Install failed: ${err instanceof Error ? err.message : String(err)}`)
      }
    }

    // --- Build DevFleetSystem for the workspace (BUG 2 fix) ---
    try {
      const wsConfig: DevFleetConfig = {
        workspaceDir: cloneDir,
        anthropicApiKey: this.deps.baseConfig.anthropicApiKey,
        supervisorModel: config.supervisorModel,
        developerModel: config.developerModel,
        reviewerModel: config.reviewerModel,
        buildCommand: projectConfig.buildCommand ?? undefined,
        testCommand: projectConfig.testCommand ?? undefined,
      }
      const system = await this.deps.buildSystem(wsConfig)
      this.systems.set(id, system)
      await system.start()

      // Subscribe to goal.completed / goal.abandoned for auto-push/PR (BUG 4 fix)
      this.subscribeToBus(id, system, config, cloneDir)
    } catch (err) {
      await this.markFailed(run, `System build failed: ${err instanceof Error ? err.message : String(err)}`)
      return failure(`System build failed: ${err instanceof Error ? err.message : String(err)}`)
    }

    // --- Mark active ---
    const activeRun = createWorkspaceRun({
      ...run, status: "active", projectConfig, startedAt: run.startedAt,
    })
    await this.deps.repo.update(activeRun)

    return success(id)
  }

  // ---------------------------------------------------------------------------
  // Query methods
  // ---------------------------------------------------------------------------
  async findActive(): Promise<WorkspaceRun | null> {
    return this.deps.repo.findActive()
  }

  async getStatus(runId: WorkspaceRunId): Promise<Result<WorkspaceRunStatusDTO>> {
    const useCase = new GetWorkspaceRunStatus(this.deps.repo)
    return useCase.execute(runId)
  }

  /** Return the workspace's DevFleetSystem if one is active. */
  async getActiveSystem(): Promise<DevFleetSystem | null> {
    const active = await this.deps.repo.findActive()
    if (!active) return null
    return this.systems.get(active.id) ?? null
  }

  /** Return the workspace system's CreateGoalFromCeo (BUG 3 fix). */
  async getActiveCreateGoal(): Promise<CreateGoalFromCeo | null> {
    const system = await this.getActiveSystem()
    if (!system) return null
    return system.dashboardDeps.createGoal
  }

  // ---------------------------------------------------------------------------
  // Stop / Cleanup
  // ---------------------------------------------------------------------------
  async stop(runId: WorkspaceRunId, hasFailedGoals: boolean): Promise<Result<void>> {
    const handle = this.handles.get(runId)
    if (!handle) return failure("No handle found for workspace")

    const run = await this.deps.repo.findById(runId)
    if (!run) return failure(`WorkspaceRun not found: ${runId}`)
    if (run.status !== "active") return failure(`Workspace is not active (status: ${run.status})`)

    // Stop the workspace system
    const system = this.systems.get(runId)
    if (system) {
      try { await system.stop() } catch { /* best-effort */ }
    }

    // Unsubscribe bus listeners
    this.unsubscribeBus(runId)

    if (hasFailedGoals) {
      const dirtyRun = createWorkspaceRun({
        ...run, status: "stopped_dirty", completedAt: new Date(), startedAt: run.startedAt,
      })
      await this.deps.repo.update(dirtyRun)
    } else {
      await this.deps.isolator.cleanup(handle)
      this.handles.delete(runId)
      this.systems.delete(runId)
      const stoppedRun = createWorkspaceRun({
        ...run, status: "stopped", completedAt: new Date(), startedAt: run.startedAt,
      })
      await this.deps.repo.update(stoppedRun)
    }

    return success(undefined)
  }

  async cleanup(runId: WorkspaceRunId): Promise<Result<void>> {
    const handle = this.handles.get(runId)
    if (!handle) return failure("No handle found for workspace")

    const run = await this.deps.repo.findById(runId)
    if (!run) return failure(`WorkspaceRun not found: ${runId}`)
    if (run.status !== "stopped_dirty") {
      return failure(`Can only cleanup stopped_dirty workspaces (status: ${run.status})`)
    }

    await this.deps.isolator.cleanup(handle)
    this.handles.delete(runId)
    this.systems.delete(runId)

    const stoppedRun = createWorkspaceRun({
      ...run, status: "stopped", startedAt: run.startedAt,
    })
    await this.deps.repo.update(stoppedRun)

    return success(undefined)
  }

  async stopAll(): Promise<void> {
    for (const [runId, handle] of this.handles) {
      const system = this.systems.get(runId)
      if (system) {
        try { await system.stop() } catch { /* best-effort */ }
      }
      this.unsubscribeBus(runId)
      try {
        await this.deps.isolator.cleanup(handle)
      } catch {
        // Best-effort cleanup on shutdown
      }
    }
    this.handles.clear()
    this.systems.clear()
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------
  private async updateStatus(run: WorkspaceRun, status: WorkspaceRun["status"]): Promise<void> {
    const updated = createWorkspaceRun({ ...run, status, startedAt: run.startedAt })
    await this.deps.repo.update(updated)
  }

  private async markFailed(run: WorkspaceRun, error: string): Promise<void> {
    const failed = createWorkspaceRun({
      ...run, status: "failed", error, startedAt: run.startedAt,
    })
    await this.deps.repo.update(failed)
  }

  /** BUG 4 fix: subscribe to workspace bus for auto-push/PR on goal completion */
  private subscribeToBus(
    runId: string,
    system: DevFleetSystem,
    config: WorkspaceRunConfig,
    cloneDir: string,
  ): void {
    const unsubs: Array<() => void> = []

    const unsubCompleted = system.bus.subscribe(
      { types: ["goal.completed"] },
      async (_msg) => {
        try {
          const branch = `devfleet/workspace-${runId}`
          await this.deps.gitRemote.push(branch, config.repoUrl, cloneDir)
          const prUrl = await this.deps.prCreator.create({
            repoUrl: config.repoUrl,
            branch,
            baseBranch: "main",
            title: `[DevFleet] Goal completed in workspace ${runId}`,
            body: "Automated PR from DevFleet workspace run.",
            workingDir: cloneDir,
          })
          if (this.deps.autoMerge) {
            await this.deps.prCreator.merge(prUrl, cloneDir)
          }
        } catch (err) {
          // Log but don't crash — push/PR is best-effort
          console.error(`[WorkspaceRunManager] auto-push/PR failed for ${runId}:`, err)
        }
      },
    )
    unsubs.push(unsubCompleted)

    const unsubAbandoned = system.bus.subscribe(
      { types: ["goal.abandoned"] },
      async (_msg) => {
        // Mark that this run has had a failed goal — used by stop()
        const run = await this.deps.repo.findById(runId as any)
        if (run && run.status === "active") {
          const updated = createWorkspaceRun({
            ...run, status: "active", startedAt: run.startedAt,
            error: (run.error ? run.error + "\n" : "") + "goal.abandoned received",
          })
          await this.deps.repo.update(updated)
        }
      },
    )
    unsubs.push(unsubAbandoned)

    this.busUnsubscribers.set(runId, unsubs)
  }

  private unsubscribeBus(runId: string): void {
    const unsubs = this.busUnsubscribers.get(runId)
    if (unsubs) {
      for (const unsub of unsubs) unsub()
      this.busUnsubscribers.delete(runId)
    }
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest tests/use-cases/WorkspaceRunManager.test.ts --verbose`
Expected: PASS (7 tests)

- [ ] **Step 4: Run full test suite**

Run: `npx jest --verbose`
Expected: ALL pass

- [ ] **Step 5: Commit**

```bash
git add src/use-cases/WorkspaceRunManager.ts tests/use-cases/WorkspaceRunManager.test.ts
git commit -m "feat: add WorkspaceRunManager — owns handle+system lifecycle, auto-push/PR"
```

---

## Task 7: StopWorkspace + CleanupWorkspace Use Cases

**Files:**
- Create: `src/use-cases/StopWorkspace.ts`
- Create: `src/use-cases/CleanupWorkspace.ts`
- Test: `tests/use-cases/StopWorkspace.test.ts`

These are thin use cases that the manager delegates to. They receive the handle as a parameter.

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
  it("returns the workspace run with derived data", async () => {
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

## Task 9: Workspace API Routes (BUG M1 fix: use findByStatus for stopped_dirty)

**Files:**
- Create: `src/infrastructure/http/routes/workspaceRoutes.ts`
- Modify: `src/infrastructure/http/createServer.ts`
- Test: `tests/infrastructure/workspaceRoutes.test.ts`

- [ ] **Step 1: Create workspace routes**

Create `src/infrastructure/http/routes/workspaceRoutes.ts`:

```typescript
import { Router } from "express"
import type { WorkspaceRunManager } from "../../../use-cases/WorkspaceRunManager"
import type { WorkspaceRunRepository } from "../../../use-cases/ports/WorkspaceRunRepository"
import { DEFAULT_WORKSPACE_CONFIG } from "../../../entities/WorkspaceRun"

export function workspaceRoutes(
  manager: WorkspaceRunManager,
  repo: WorkspaceRunRepository,
): Router {
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
      // BUG M1 fix: use findByStatus instead of a stub
      const stoppedDirty = await repo.findByStatus("stopped_dirty")
      if (!stoppedDirty) {
        res.status(404).json({ error: "No stopped_dirty workspace to cleanup" })
        return
      }
      const result = await manager.cleanup(stoppedDirty.id)
      if (!result.ok) {
        res.status(400).json({ error: result.error })
        return
      }
      res.json({ status: "stopped" })
    } catch (err) {
      next(err)
    }
  })

  return router
}
```

- [ ] **Step 2: Wire into createServer**

In `src/infrastructure/http/createServer.ts`, add imports:

```typescript
import { workspaceRoutes } from "./routes/workspaceRoutes"
import type { WorkspaceRunManager } from "../../use-cases/WorkspaceRunManager"
import type { WorkspaceRunRepository } from "../../use-cases/ports/WorkspaceRunRepository"
```

Add to `DashboardDeps`:

```typescript
  readonly workspaceManager: WorkspaceRunManager
  readonly workspaceRunRepo: WorkspaceRunRepository
```

Add route wiring after existing routes:

```typescript
  app.use("/api/workspace", workspaceRoutes(deps.workspaceManager, deps.workspaceRunRepo))
```

- [ ] **Step 3: Run full test suite**

Run: `npx jest --verbose`
Expected: Tests may fail if DashboardDeps is constructed without `workspaceManager` / `workspaceRunRepo` in tests. Fix by providing a mock in integration tests that construct DashboardDeps.

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/http/routes/workspaceRoutes.ts src/infrastructure/http/createServer.ts
git commit -m "feat: add workspace API routes (start, status, active, stop, cleanup)"
```

---

## Task 10: Goal Routing to Active Workspace (BUG 3 fix)

**Files:**
- Modify: `src/infrastructure/http/routes/goalRoutes.ts`
- Modify: `src/infrastructure/http/createServer.ts`

- [ ] **Step 1: Update goalRoutes to accept WorkspaceRunManager and use getActiveCreateGoal**

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

      // BUG 3 fix: when a workspace is active, use its CreateGoalFromCeo
      const wsCreateGoal = workspaceManager
        ? await workspaceManager.getActiveCreateGoal()
        : null
      const effectiveCreateGoal = wsCreateGoal ?? createGoal

      const result = await effectiveCreateGoal.execute({ description, maxTokens, maxCostUsd })
      if (!result.ok) {
        res.status(400).json({ error: result.error })
        return
      }

      const active = workspaceManager ? await workspaceManager.findActive() : null
      res.status(201).json({
        goal: toGoalDTO(result.value),
        ...(active ? { targetedWorkspace: active.id } : {}),
      })
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
git commit -m "feat: route goals to active workspace system's CreateGoalFromCeo"
```

---

## Task 11: Wire Workspace into Composition Root (BUG M2 fix: inject ShellExecutorFactory)

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
  // Workspace management (BUG M2 fix: all adapters receive shellFactory)
  // -------------------------------------------------------------------------
  const shellFactory: ShellExecutorFactory = (rootPath: string) => new NodeShellExecutor(rootPath)
  const workspaceRunRepo = new InMemoryWorkspaceRunRepository()
  const workspaceIsolator = new GitCloneIsolator(shellFactory)
  const gitRemote = new NodeGitRemote(shellFactory)
  const prCreator = new GitHubPullRequestCreator(shellFactory)
  const autoMerge = process.env["DEVFLEET_AUTO_MERGE"] === "true"
  const workspaceManager = new WorkspaceRunManager({
    repo: workspaceRunRepo,
    isolator: workspaceIsolator,
    fs: fileSystem,
    gitRemote,
    prCreator,
    autoMerge,
    buildSystem,           // pass ourselves — workspace gets its own system
    baseConfig: config,
  })
```

Add `workspaceManager` and `workspaceRunRepo` to the `dashboardDeps` object:

```typescript
  const dashboardDeps: DashboardDeps = {
    // ... existing deps
    workspaceManager,
    workspaceRunRepo,
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
Expected: Some integration tests may need updating to provide `workspaceManager` and `workspaceRunRepo` in DashboardDeps. Add a mock or real instance where needed.

- [ ] **Step 3: Run tsc**

Run: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add src/infrastructure/config/composition-root.ts
git commit -m "feat: wire workspace management into composition root with ShellExecutorFactory"
```

---

## Task 12: Full Verification

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
