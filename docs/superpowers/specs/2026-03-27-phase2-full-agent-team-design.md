# Phase 2: Full Agent Team + Communication — Design Spec

**Date:** 2026-03-27
**Depends on:** Phase 1 (Core + Single Agent MVP) — merged to master 2026-03-26
**Source spec:** `docs/specs/2026-03-26-agentic-dev-platform-design.md`, Section 14

## Exit Criteria

> Can type a high-level goal, agents autonomously produce merged code.

Specifically: CEO types a goal → Supervisor decomposes into phased tasks → Product writes spec → Architect writes plan → Developer codes in isolated worktree → Ops runs build/tests → Reviewer approves/rejects → Supervisor merges or discards branch → goal completes.

## Decisions Made During Design

1. **Approach:** Four batches, capability-grouped, each internally respecting L1 → L2 → L3 → L4 layer ordering (Option D — Uncle Bob's recommendation).
2. **Phase 1 fixes:** Prerequisite (Batch 1 Step 0), not inline.
3. **Agent AI depth:** All 6 get real plugin contracts and message wiring. Supervisor and Reviewer get full AI. Product and Architect get lightweight AI (simple prompt, no tools, via universal executor). Ops gets deterministic execution (via `DeterministicProvider`). Learner gets structured event logging. Nothing is stubbed — everything is real at its appropriate complexity.
4. **Shared channel:** Entity and port defined (Layer 1/2), wired through bus, but agents don't actively use it in Phase 2. Deferring agent conversation behaviors, not the contract.
5. **Universal executor:** All agents that do work (produce artifacts, write code) delegate to `AgentExecutor` (`RunAgentLoop`). No second execution path. Supervisor uses `PromptAgent` directly for single-turn routing decisions (it doesn't produce artifacts or use tools).
6. **OpsPlugin:** Uses `DeterministicProvider` implementing `AICompletionProvider` — returns pre-configured tool calls instead of calling Claude. Liskov holds. Uniform observability.

## Architecture Guardrails

These principles prevent erosion during implementation:

1. **Supervisor is a dispatcher, not an orchestrator.** Each message handler in `SupervisorPlugin` calls one use case (or a small composed sequence like `DecomposeGoal` → `AssignTask` where the second call depends on the first's output). If a handler grows past ~30 lines or accumulates branching logic, that orchestration belongs in a new Layer 2 use case.
2. **Phase advancement is a Supervisor decision.** No mechanical `AdvanceTaskPhase` use case. The Supervisor's AI decides the next step, validates via `canAdvancePhase()` (Layer 1), then calls `AssignTask`. The decision is in the AI prompt. The validation is in the entity.
3. **Plugins subscribe by agentId, not by phase.** `MessageFilter` is a message-level concern. The Supervisor decides role-to-phase mapping using `PipelineConfig.roleMapping`. Plugins don't know or care what phase they're in.
4. **Construction stays in Layer 4.** Plugins receive factories (`FileSystemFactory`, `ShellExecutorFactory`), not concrete adapter classes. The composition root owns instantiation.
5. **Ops is deterministic.** It runs commands and parses output. It doesn't reason, doesn't have a conversation, doesn't need an AI prompt. `DeterministicProvider` satisfies the executor contract without AI.

---

## Batch 1: Phase 1 Fixes + Domain Completion

**Goal:** Fix known defects, complete the domain model, and define all ports/use cases that Batches 2-4 depend on. Pure Layer 1 and Layer 2. Everything testable with in-memory mocks.

### 1A. Phase 1 Fixes

**Fix `matchesFilter`** — Currently only matches on `types`. Must also filter by `agentId`, `taskId`, and `goalId` when those fields are present in both the filter and the message. Multi-agent routing requires this.

**Enrich `Message` variant fields** — Align all 26 message types with the design spec. Key gaps:
- `task.completed` / `task.failed` missing `agentId`
- `code.completed` missing `branch`, `filesChanged`, `testsWritten`
- `branch.merged` missing `commit`
- `review.approved` / `review.rejected` missing `reviewerId`
- Audit all 26 types against the spec's `Message` union and fill gaps

### 1B. New/Updated Entities (Layer 1)

**`ChannelMessage`** — Agent-to-agent discussion entity:
```typescript
interface ChannelMessage {
  readonly id: MessageId
  readonly taskId: TaskId | null
  readonly from: AgentId
  readonly to: AgentId | "all"
  readonly content: string
  readonly replyTo: MessageId | null
  readonly timestamp: Date
}
```
Pure data type, no behavior. Helper: `createChannelMessage()`.

**Add `retryCount: number` to `Task` entity.** `EvaluateKeepDiscard` checks retry count against a configurable max. The entity must model this state.

**Add `branch: string | null` to `Task` entity.** Developer sets this when creating the worktree. `MergeBranch` and `DiscardBranch` read it from the task — the Supervisor passes only `taskId`, and the use case resolves the branch internally. This avoids storing branch state in adapters.

**Add `lastActiveAt: Date` to `Agent` entity.** Updated in the message emit path (when a message with an `agentId` field is emitted). `DetectStuckAgent` queries `AgentRegistry` and compares timestamps. Stateless use case, state on the entity where it belongs.

**`KeepDiscardRecord`** — Structured data for Phase 4 Learner queries:
```typescript
interface KeepDiscardRecord {
  readonly taskId: TaskId
  readonly agentId: AgentId
  readonly phase: string
  readonly durationMs: number
  readonly tokensUsed: number
  readonly verdict: "approved" | "rejected"
  readonly reasons: readonly string[]
  readonly artifactIds: readonly ArtifactId[]
  readonly commitHash: string | null
  readonly recordedAt: Date
}
```

**Extend `PipelineConfig` with `roleMapping`:**
```typescript
readonly roleMapping: ReadonlyArray<{ phase: string; role: AgentRole }>
```
Default: spec→Product, plan→Architect, code→Developer, review→Reviewer, test→Ops. Adding a new phase/role = one config change, zero code changes. OCP.

**Tighten `Artifact` metadata** — Remove `[key: string]: unknown` index signatures. Discriminated unions must be precise:
- `SpecMetadata`: `{ requirementCount: number; hasSuccessCriteria: boolean }`
- `PlanMetadata`: `{ stepCount: number; estimatedTokens: number }`
- `DiffMetadata`: `{ filesChanged: number; linesAdded: number; linesRemoved: number }`
- `ReviewMetadata`: `{ verdict: "approved" | "rejected"; issueCount: number }`
- `TestReportMetadata`: `{ passed: number; failed: number; coverageDelta: number }`
- `MetricReportMetadata`: `{ metricCount: number; periodStart: number; periodEnd: number }`

### 1C. New Ports (Layer 2)

**`ArtifactRepository`:**
```typescript
interface ArtifactRepository {
  findById(id: ArtifactId): Promise<Artifact | null>
  findByTaskId(taskId: TaskId): Promise<ReadonlyArray<Artifact>>
  create(artifact: Artifact): Promise<void>
}
```

**`WorktreeManager`:**
```typescript
interface WorktreeManager {
  create(branch: string, baseBranch?: string): Promise<WorktreePath>
  delete(branch: string): Promise<void>
  merge(branch: string, targetBranch?: string): Promise<MergeResult>
  exists(branch: string): Promise<boolean>
}

type WorktreePath = string
type MergeResult =
  | { success: true; commit: string }
  | { success: false; error: string }
```

**`FileSystemFactory` and `ShellExecutorFactory`:**
```typescript
type FileSystemFactory = (rootPath: string) => FileSystem
type ShellExecutorFactory = (rootPath: string) => ShellExecutor
```
Construction logic stays in Layer 4. Plugins call the factory when they have a worktree path.

### 1D. New Use Cases (Layer 2)

**`EvaluateKeepDiscard`** — Returns a decision, does not execute it (SRP):
- Input: `taskId`, `verdict` ("approved" | "rejected"), `maxRetries` (from config, not hardcoded)
- Output: `"keep"` | `"discard"` | `"retry"`
- Logic: if approved → "keep". If rejected and `retryCount < maxRetries` → increment `retryCount`, save task, return "retry". If rejected and retries exhausted → "discard".
- Owns the `retryCount` write: the decision and state update are one atomic operation. Callers don't need to increment separately.
- Dependencies: `TaskRepository`

**`MergeBranch`** — Executes a keep decision:
- Input: `taskId`
- Reads `task.branch` from `TaskRepository`, calls `WorktreeManager.merge()`, transitions task to "approved", emits `branch.merged`
- Dependencies: `TaskRepository`, `WorktreeManager`, `MessagePort`

**`DiscardBranch`** — Executes a discard decision:
- Input: `taskId`, `reason`
- Reads `task.branch` from `TaskRepository`, calls `WorktreeManager.delete()`, transitions task to "discarded", emits `branch.discarded`
- Dependencies: `TaskRepository`, `WorktreeManager`, `MessagePort`

**`SendChannelMessage`** — Validate and emit a channel message:
- Input: `ChannelMessage`
- Validates `from` agent exists, emits through bus
- Dependencies: `AgentRegistry`, `MessagePort`

**`CreateArtifact`** — Store an artifact and link it to a task:
- Input: `Artifact`
- Creates artifact in `ArtifactRepository`, appends ID to task's `artifacts` array
- Does NOT emit messages — that's the caller's responsibility, because the caller knows the semantic meaning of the artifact (e.g., ProductPlugin emits `spec.created`, ReviewerPlugin emits `review.approved`). Consistent pattern: storage is separated from notification.
- Dependencies: `ArtifactRepository`, `TaskRepository`

**`DetectStuckAgent`** — Runs on a configurable interval:
- Checks each in-progress agent: if time since last emitted message exceeds `agentTimeoutMs` (configurable, default: 60 seconds), emits `agent.stuck`
- Supervisor handles `agent.stuck` — decides extend, retry, or discard
- Dependencies: `AgentRegistry`, `MessagePort`, clock (injectable for testing)

### 1E. In-Memory Adapters

- `InMemoryArtifactRepo` — implements `ArtifactRepository`
- `InMemoryWorktreeManager` — implements `WorktreeManager` (stores branches as a Set, merge always succeeds with a fake commit hash)

### 1F. New Adapter: `DeterministicProvider`

- Implements `AICompletionProvider`
- Accepts a command sequence at construction: `new DeterministicProvider([{ tool: "shell_run", args: { command: "npm run build" } }, ...])`
- Returns pre-configured tool calls instead of calling Claude
- Satisfies the `AgentExecutor` contract without AI. `RunAgentLoop` doesn't know or care.

### 1G. Test Infrastructure

**`waitForMessage` helper:**
```typescript
waitForMessage(bus: MessagePort, type: MessageType, predicate?: (msg: Message) => boolean, timeoutMs?: number): Promise<Message>
```
Returns a promise that resolves when a matching message is emitted, rejects on timeout. Every integration test in Batches 2-4 uses this. When a test fails, the timeout identifies exactly which step hung.

### 1H. Tests

- Unit tests for fixed `matchesFilter` (agentId, taskId, goalId filtering)
- Unit tests for enriched `Message` types (verify new fields compile and round-trip)
- Unit tests for `ChannelMessage`, `KeepDiscardRecord` creation helpers
- Unit tests for `PipelineConfig.roleMapping` lookup
- Unit tests for tightened `Artifact` metadata (verify index signatures removed, type narrowing works)
- Unit tests for Task `branch` and `retryCount` fields, Agent `lastActiveAt` field
- Unit tests for `EvaluateKeepDiscard` (approved→keep, rejected+retries→retry with retryCount incremented, rejected+exhausted→discard)
- Unit tests for `MergeBranch`, `DiscardBranch` (mock `WorktreeManager`, verify state transitions and messages)
- Unit tests for `CreateArtifact` (verify artifact stored, task.artifacts updated, no message emitted — caller's responsibility)
- Unit tests for `SendChannelMessage` (valid agent, invalid agent)
- Unit tests for `DetectStuckAgent` (inject mock clock, verify `agent.stuck` emitted at threshold)
- Unit tests for `DeterministicProvider` (returns configured tool calls, satisfies `AICompletionProvider` contract)
- Unit tests for `InMemoryArtifactRepo`, `InMemoryWorktreeManager`
- Unit test for `waitForMessage` helper (resolves on match, rejects on timeout)

---

## Batch 2: Supervisor + Pipeline Flow

**Goal:** A typed goal flows through the full pipeline — Supervisor decomposes it, assigns tasks to agents by phase, and Product/Architect produce artifacts via the universal executor. Exit criteria: type a goal → tasks created, assigned, and flowing through pipeline phases.

**Decoupling note:** Batch 2 and Batch 3 are decoupled via the message bus. Batch 3 can be tested entirely by emitting `code.completed` messages — Batch 2 need not exist.

### 2A. Enhanced Use Cases (Layer 2)

**Enhance `DecomposeGoal`** — Currently creates tasks from a flat array. Needs to:
- Accept AI-generated decomposition (Supervisor calls Claude to plan the breakdown)
- Create tasks with correct `phase` values matching `PipelineConfig`
- Link tasks with implicit ordering (phases follow pipeline sequence)
- Respect `PipelineConfig.skipAllowed` (bug fix skips "spec" and "design")

**Enhance `AssignTask`** — Currently assigns to a role. Needs to:
- Support Supervisor re-assignment on failure (task returns to "queued")
- No phase-awareness needed — Supervisor decides role via `PipelineConfig.roleMapping`, `AssignTask` finds an available agent of that role

### 2B. Agent Plugins (Layer 3)

All plugins delegate to `AgentExecutor` (`RunAgentLoop`). No plugin hand-rolls a prompt → artifact → emit pipeline. Uniform budget checking, metrics recording, outcome evaluation, and turn events for every agent.

**`SupervisorPlugin`** — Full AI, thin dispatcher.
- Subscribes to: `goal.created`, `task.completed`, `task.failed`, `review.approved`, `review.rejected`, `budget.exceeded`, `agent.stuck`
- Each message type maps to exactly one use case call:
  - `goal.created` → `DecomposeGoal` + `AssignTask` for first phase
  - `task.completed` → AI decides next phase (via `PromptAgent`), validates via `canAdvancePhase()`, calls `AssignTask`
  - `review.approved` → `EvaluateKeepDiscard` → `MergeBranch(taskId)`
  - `review.rejected` → `EvaluateKeepDiscard` → retry (`AssignTask` back to Developer) or `DiscardBranch(taskId, reason)`
  - `budget.exceeded` / `agent.stuck` → AI decides extend or discard
- Supervisor uses `PromptAgent` directly for single-turn AI decisions (routing, not artifact production). This is correct: agents that do work go through the executor; agents that make decisions call `PromptAgent`.
- Model: Opus (orchestration quality is worth the cost)

**`ProductPlugin`** — Lightweight AI via universal executor.
- Subscribes to: `task.assigned` filtered by its own `agentId`
- Configures `AgentExecutor` with no tools, system prompt ("write a requirements spec for this goal"), MAX_TURNS=1
- Post-execution: wraps output as spec `Artifact`, calls `CreateArtifact`
- Model: Sonnet

**`ArchitectPlugin`** — Lightweight AI via universal executor.
- Subscribes to: `task.assigned` filtered by its own `agentId`
- Reads spec artifact via `ArtifactRepository`, configures executor with no tools, system prompt ("design an implementation plan for this spec"), MAX_TURNS=1
- Post-execution: wraps output as plan `Artifact`, calls `CreateArtifact`
- Model: Sonnet

### 2C. Composition Root Updates

- Wire `SupervisorPlugin`, `ProductPlugin`, `ArchitectPlugin` into `PluginRegistry`
- Register agents in `AgentRegistry` (Supervisor, Product, Architect — all idle)
- Wire `ArtifactRepository` (in-memory) into plugins that need it
- Provide `PipelineConfig` with default `roleMapping`

### 2D. Tests

- Unit tests for enhanced `DecomposeGoal`, `AssignTask`
- Unit tests for `SupervisorPlugin` — mock bus, mock use cases, verify correct use case called per message type (7 handlers, 7 focused tests)
- Unit tests for `ProductPlugin`, `ArchitectPlugin` — mock executor, verify artifact creation
- Integration test: emit `goal.created` → `waitForMessage` for tasks created across phases with correct role assignments

---

## Batch 3: Code Review Loop

**Goal:** Developer works in an isolated worktree, Reviewer evaluates the output, Ops runs builds/tests, and the keep/discard loop merges or deletes branches. Exit criteria: `code.completed` → review → branch merges or discards.

**Decoupling reminder:** This batch is testable in isolation. Emit `task.assigned` (for Developer with a code-phase task) or `code.completed` (for Reviewer) manually via the bus. No dependency on Batch 2's Supervisor.

### 3A. Infrastructure Adapters (Layer 3)

**`NodeWorktreeManager`** — Real git worktree operations, implements `WorktreeManager` port:
- `create(branch, baseBranch?)` → runs `git worktree add` + `git checkout -b`, returns worktree path
- `delete(branch)` → runs `git worktree remove` + `git branch -D`
- `merge(branch, targetBranch?)` → runs `git checkout target && git merge branch`, returns commit hash or error
- `exists(branch)` → runs `git worktree list`, checks for branch
- Delegates to `ShellExecutor` **scoped to the project root** — not to any worktree. Worktree management commands must run from the main repo. This is a separate `ShellExecutor` instance from what DeveloperPlugin receives per task.
- Worktree paths: `.worktrees/<branch-name>/` (already in `.gitignore`)

### 3B. Enhanced DeveloperPlugin

- Receives `WorktreeManager`, `FileSystemFactory`, `ShellExecutorFactory` via constructor injection
- On `task.assigned`: calls `WorktreeManager.create()` to get an isolated worktree path, then calls factories to get scoped `FileSystem` and `ShellExecutor` instances
- Configures `AgentExecutor` with the scoped instances
- On completion: emits `code.completed` with branch name. Does NOT merge — that's the Supervisor's decision after review.
- Branch naming: `devfleet/task-<taskId>-<short-description>`

### 3C. Agent Plugins (Layer 3)

**`ReviewerPlugin`** — Full AI via universal executor.
- Subscribes to: `task.assigned` filtered by its own `agentId`
- Reads all task artifacts (spec, plan, diff) via `ArtifactRepository`
- Configures executor with tools: `file_read`, `shell_run` (run tests), `file_glob` (explore the diff)
- System prompt: "Review this code against the spec and plan. Run tests. Emit approved or rejected with specific reasons."
- Post-execution: wraps output as review `Artifact` with `verdict`, calls `CreateArtifact`
- Emits `review.approved` or `review.rejected`
- Model: Opus (review quality directly controls keep/discard ratio)

**`OpsPlugin`** — Deterministic via universal executor with `DeterministicProvider`.
- Subscribes to: `task.assigned` filtered by its own `agentId`
- Uses `AgentExecutor` configured with `DeterministicProvider` (pre-configured command sequence: build, then test), tools: `shell_run` only, MAX_TURNS=1 per command
- Uniform observability: build duration, failure rate, test pass rate captured through the same pipeline as every other agent
- Creates `test_report` artifact with pass/fail counts and coverage delta
- Emits `build.passed` or `build.failed`, `test.report.created`
- Model: none (DeterministicProvider)

**`LearnerPlugin`** — Structured event logger, no AI.
- Subscribes to: `review.rejected`, `review.approved`, `goal.completed`, `budget.exceeded`, `insight.generated`, `ceo.override`
- On `review.approved` / `review.rejected`: creates a typed `KeepDiscardRecord` with full context
- On other events: records `SystemEvent` to `EventStore` with typed payloads
- No AI, no analysis — that's Phase 4. Structured data collection starts now so Phase 4 has history to query.
- Real work at its appropriate complexity level — not a stub.

### 3D. Composition Root Updates

- Wire `NodeWorktreeManager` (real git, scoped to project root) in production, `InMemoryWorktreeManager` in tests
- Provide `FileSystemFactory` and `ShellExecutorFactory` — composition root owns construction: `(path) => new NodeFileSystem(path)` and `(path) => new NodeShellExecutor(path)`
- Wire `DeterministicProvider` for OpsPlugin with project-configured build/test commands
- Wire `ReviewerPlugin`, `OpsPlugin`, `LearnerPlugin` into `PluginRegistry`
- Register agents in `AgentRegistry` (Reviewer, Ops, Learner — all idle)
- Reconfigure `DeveloperPlugin` — inject `WorktreeManager`, `FileSystemFactory`, `ShellExecutorFactory`

### 3E. Tests

- Unit tests for `NodeWorktreeManager` — test against a temp git repo (not mocks — this adapter wraps git, mocks prove nothing)
- Unit tests for `ReviewerPlugin` — mock executor, mock artifact repo, verify review artifact and correct message emission
- Unit tests for `OpsPlugin` — mock executor with `DeterministicProvider`, verify commands and report artifact
- Unit tests for `LearnerPlugin` — mock event store, verify `KeepDiscardRecord` fields on review events
- Unit tests for enhanced `DeveloperPlugin` — verify worktree creation via factories, scoped executor, branch naming
- Integration test: emit `task.assigned` (code phase) → `waitForMessage` through Developer → `code.completed` → Reviewer → `review.approved`

---

## Batch 4: Integration + End-to-End

**Goal:** Wire all 6 agents into a single system, update the CLI, and prove the full pipeline end-to-end.

### 4A. Composition Root (Layer 4)

Complete rewire of `buildSystem()` for the full agent team.

**Instantiation order** (respects DI):
1. Shared infrastructure: `InMemoryBus`, `InMemoryTaskRepo`, `InMemoryGoalRepo`, `InMemoryArtifactRepo`, `InMemoryAgentRegistry`, `InMemoryEventStore`, `InMemoryMetricRecorder`
2. AI providers: `ClaudeProvider` (Opus for Supervisor/Reviewer, Sonnet for Product/Architect/Developer), `DeterministicProvider` (for Ops)
3. Filesystem factories: `FileSystemFactory`, `ShellExecutorFactory`
4. Git: `NodeWorktreeManager` (production) or `InMemoryWorktreeManager` (test)
5. Use cases: all from Batch 1 + enhanced versions from Batches 2-3
6. Agent executors: **one `RunAgentLoop` per agent** — each agent's AI provider, tool set, and budget config differ. The executor is the configured execution context for a specific role, not a shared service.
7. Plugins: all 7 (`SupervisorPlugin`, `ProductPlugin`, `ArchitectPlugin`, `DeveloperPlugin`, `ReviewerPlugin`, `OpsPlugin`, `LearnerPlugin`)
8. `PluginRegistry` — register all 7, start lifecycle
9. Start `DetectStuckAgent` on interval

**Configuration:**
- `DevFleetConfig` gains: `pipelineConfig` (with `roleMapping`), per-agent model overrides, build/test commands (for Ops), max retry count, `pipelineTimeoutMs` (default: 300_000), `agentTimeoutMs` (default: 60_000)
- Environment variables: `ANTHROPIC_API_KEY`, `WORKSPACE_DIR`, `DEVELOPER_MODEL`, `SUPERVISOR_MODEL`, `REVIEWER_MODEL` (others default to Sonnet)

### 4B. CLI Updates (Layer 4)

- User types a goal description
- CLI creates `Goal`, emits `goal.created`
- CLI starts **pipeline timer** (`pipelineTimeoutMs`). On timeout: emits `goal.abandoned` with reason "pipeline timeout", exits with error code
- System is autonomous from here: Supervisor → Product → Architect → Developer → Ops → Reviewer → Supervisor merge/discard
- CLI displays progress via bus subscription: `goal.created`, `task.created`, `task.assigned`, `code.completed`, `review.approved`, `review.rejected`, `branch.merged`, `branch.discarded`, `goal.completed`, `agent.stuck`
- Waits for `goal.completed` or `goal.abandoned` before exiting
- Text-based progress output — dashboard is Phase 3

### 4C. End-to-End Integration Test

**Setup:**
- Full system wired via `buildSystem()` with test config
- `InMemoryWorktreeManager` (no real git in CI)
- Each agent's executor receives **its own mock `ClaudeProvider` instance** with role-specific canned responses. No shared mocks, no role dispatching. Same wiring pattern as production.
- `DeterministicProvider` for Ops
- Real bus, real use cases, real plugins — only AI is mocked
- All assertions use `waitForMessage` — deterministic, fast, debuggable

**Happy path:**
1. Emit `goal.created` ("Add a hello world endpoint")
2. `waitForMessage("task.created")` — Supervisor decomposes
3. `waitForMessage("task.assigned")` — Product receives spec task
4. `waitForMessage("spec.created")` — spec artifact created
5. `waitForMessage("plan.created")` — Architect creates plan
6. `waitForMessage("code.completed")` — Developer writes files in worktree
7. `waitForMessage("build.passed")` — Ops runs build/tests
8. `waitForMessage("review.approved")` — Reviewer approves
9. `waitForMessage("branch.merged")` — Supervisor merges
10. `waitForMessage("goal.completed")` — pipeline complete
11. Assert: `KeepDiscardRecord` with verdict "approved"

Each `waitForMessage` has a timeout (default 5_000ms). Failure identifies exactly which message never arrived.

**Retry path:**
- Reviewer mock returns "rejected" first, "approved" second
- Assert: `review.rejected` → `task.assigned` (back to Developer) → `code.completed` → `review.approved` → `branch.merged`
- `KeepDiscardRecord` shows retry history

**Budget exceeded path:**
- Task with very low token budget
- Assert: `budget.exceeded` → Supervisor discards → `branch.discarded`

**Stuck agent path:**
- Developer mock never responds
- Assert: `agent.stuck` emitted within `agentTimeoutMs` → Supervisor discards task

### 4D. Tests

- Integration test for composition root: `buildSystem()` succeeds, all plugins start, health checks pass
- The four end-to-end scenarios (happy, retry, budget, stuck)
- Smoke test for CLI: spawn process, provide goal via stdin, verify exit code and output contains key events
