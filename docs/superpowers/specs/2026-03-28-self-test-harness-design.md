# DevFleet Self-Test Harness Design

> DevFleet runs against its own codebase with real AI, producing real code changes.

## Motivation

DevFleet has 276 tests proving message routing works, but the full pipeline has never
run against a real codebase with real AI. The mock providers return canned responses —
the Reviewer always approves, the Developer always succeeds, the build always passes.
The self-test eliminates this gap by pointing DevFleet at itself.

## Success Criteria

1. Pipeline completes: `goal.completed` received
2. Tests pass inside the pipeline (Ops agent's `build.passed` artifact shows green)
3. Human approves the output (manual review of the clone's diff)

## Constraints

- **Budget:** ~200K tokens, ~$10 ceiling
- **Models:** Opus for Supervisor + Reviewer, Sonnet for Developer/Product/Architect
- **Isolation:** Separate clone in `/tmp` — working repo untouched
- **Timeout:** 10 minutes
- **Max retries:** 2

## First Goal

A real backlog item from Phase 2: "Add `spec.created` and `plan.created` message
emission from ProductPlugin and ArchitectPlugin."

This is real work — it touches the message type union, two plugin files, and requires
tests. It validates that the agents can reason about DevFleet's own architecture.

If this proves too ambitious on the first run, fallback goal: "Add a `GET /health`
endpoint to the HTTP API that returns `{ status: 'ok', uptime: process.uptime() }`."

---

## Architecture: Three Layers, Three PRs

### Layer A: Infrastructure Honesty (PR 1)

Fixes the gap between what the system claims to do and what it actually does.

#### A1. Wire real `NodeWorktreeManager`

The composition root currently hardcodes `InMemoryWorktreeManager` even in production
mode. `NodeWorktreeManager` exists in `src/adapters/worktree/` but is dead code.

Fix: conditional wiring in `composition-root.ts`:

```
useMock === true  → InMemoryWorktreeManager (existing behavior)
useMock === false → NodeWorktreeManager(shell, workspaceDir)
```

Same pattern already used for `FileSystem` and `ShellExecutor`.

#### A2. Structured shell commands

Change the `ShellExecutor` port from string-based to array-based:

```typescript
// Before
execute(command: string, timeout?: number): Promise<ShellResult>

// After
execute(command: string, args: readonly string[], timeout?: number): Promise<ShellResult>
```

`NodeShellExecutor` switches from `child_process.exec` to `child_process.execFile`.
Array-based arguments eliminate shell injection at the port level — no sanitizer
decorator needed.

All callers update: `NodeWorktreeManager`, `OpsPlugin`, `ExecuteToolCalls`.

#### A3. Honest `DeveloperPluginDeps`

Remove `?` from three dependencies that are not optional:

```typescript
// Before
readonly bus?: MessagePort
readonly worktreeManager?: WorktreeManager
readonly scopedExecutorFactory?: ScopedExecutorFactory

// After
readonly bus: MessagePort
readonly worktreeManager: WorktreeManager
readonly scopedExecutorFactory: ScopedExecutorFactory
```

Unit tests that need a lightweight Developer provide explicit test doubles — they
don't silently skip real behavior.

#### A4. Worktree cleanup on stop

Add a `cleanupAll()` method to `WorktreeManager` port. `NodeWorktreeManager` lists
and removes any remaining worktrees. Called during `system.stop()` to prevent leaks
when the pipeline crashes mid-run.

#### A5. Layer A Tests

| Test | Type | Proves |
|---|---|---|
| `NodeWorktreeManager` create/merge/delete on temp git repo | Integration | Real git worktrees work |
| Structured `ShellExecutor` with array args | Unit | `execFile` receives correct args |
| `DeveloperPlugin` with required deps (test doubles) | Unit | Plugin doesn't silently degrade |
| Existing 276 tests still pass | Regression | Nothing broke |

---

### Layer B: Project Detection (PR 2)

Gives agents awareness of what they're working on.

#### B1. `ProjectConfig` value object

```typescript
interface ProjectConfig {
  readonly language: string        // "typescript", "rust", "kotlin", etc.
  readonly buildCommand: string    // "npm run build"
  readonly testCommand: string     // "npm test"
  readonly sourceRoots: string[]   // ["src"]
}
```

Lives in `src/entities/` — it's a domain concept.

#### B2. `DetectProjectConfig` use case

Takes a `FileSystem` port. Scans for marker files:

| File | Language | Build | Test |
|---|---|---|---|
| `package.json` + `tsconfig.json` | typescript | `npm run build` | `npm test` |
| `package.json` (no tsconfig) | javascript | `npm run build` | `npm test` |
| `Cargo.toml` | rust | `cargo build` | `cargo test` |
| `build.gradle.kts` | kotlin | `./gradlew build` | `./gradlew test` |
| `go.mod` | go | `go build ./...` | `go test ./...` |

Returns `ProjectConfig`. Falls back to `{ language: "unknown", buildCommand: "echo no-build", testCommand: "echo no-test", sourceRoots: ["."] }`.

#### B3. Pipeline integration via message bus

Supervisor calls `DetectProjectConfig` when it receives `goal.created`, before
decomposing the goal. Emits a `project.detected` message:

```typescript
{
  type: "project.detected",
  projectId: string,
  config: ProjectConfig,
  timestamp: Date,
}
```

Agents that need project context subscribe to `project.detected`. The Ops agent
uses `config.buildCommand` and `config.testCommand` instead of the hardcoded
`npm run build && npm test`. The Architect and Developer receive language and
source roots in their task context.

This is consistent with how everything else communicates — event-driven, through
the bus, no shared mutable state.

#### B4. Layer B Tests

| Test | Type | Proves |
|---|---|---|
| `DetectProjectConfig` against DevFleet's own repo | Integration | Detects TypeScript correctly |
| `DetectProjectConfig` against mock FS with `Cargo.toml` | Unit | Rust detection works |
| `DetectProjectConfig` against empty directory | Unit | Returns defaults, doesn't crash |
| Supervisor emits `project.detected` on `goal.created` | Unit | Config flows through pipeline |
| Ops uses detected `testCommand` instead of hardcoded | Unit | Dynamic commands work |

---

### Layer C: Self-Test Harness (PR 3)

The actual self-test — DevFleet runs against its own clone with real AI.

#### C1. Location and gating

`tests/integration/self-test.test.ts` — a real Jest test:

```typescript
const RUN_SELF_TEST = process.env.RUN_SELF_TEST === "true"
const maybe = RUN_SELF_TEST ? describe : describe.skip
```

Skipped by default in CI. Run manually with `RUN_SELF_TEST=true`.

#### C2. Test flow

```
 1. git clone DevFleet → /tmp/devfleet-selftest-<timestamp>
 2. buildSystem({
      workspaceDir: clonePath,
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      supervisorModel: "claude-opus-4-20250514",
      reviewerModel: "claude-opus-4-20250514",
      developerModel: "claude-sonnet-4-20250514",
      pipelineTimeoutMs: 600_000,  // 10 min
      maxRetries: 2,
    })
 3. system.start()
 4. Subscribe to all messages — collect into array for trace
 5. Create goal with budget: { maxTokens: 200_000, maxCostUsd: 10.0 }
 6. Wait for goal.completed OR goal.abandoned (timeout: 10 min)
 7. Assert: goal.completed received
 8. Assert: message trace includes task.created, task.assigned,
    code.completed, build.passed, review.approved, branch.merged
 9. Assert: Ops artifact contains passing test output
10. Log: full message trace, Supervisor decisions, git log, git diff
11. system.stop()
12. Print clone path for manual review
```

#### C3. Budget circuit breaker

Subscribe to `turn.completed` messages and track cumulative token spend. If
cumulative cost exceeds $15 (1.5x the intended $10 budget), force-abandon the
goal immediately. This prevents retry bugs from burning unbounded API spend.

#### C4. Supervisor audit trail

The harness logs every Supervisor decision prominently in the output:
- Goal decomposition (what tasks were created)
- Task assignments (which agent got what)
- Keep/discard evaluations (and the reasoning)
- Retry decisions

The self-test has no automated watchdog over Supervisor quality — that's Phase 4
(DevBrain) territory. For now, the audit trail enables manual review of Supervisor
behavior alongside the code diff.

#### C5. What the harness does NOT do

- Does not re-run `npm test` outside the pipeline (trusts Ops, inspects artifact)
- Does not auto-delete the clone (left for manual review)
- Does not assert code quality (that's your judgment — success criterion #3)
- Does not push to remote (clone is local only)

#### C6. Convenience script

`scripts/self-test.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
: "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY to run the self-test}"
GOAL="${1:-Add spec.created and plan.created message emission from ProductPlugin and ArchitectPlugin}"
export RUN_SELF_TEST=true
export SELF_TEST_GOAL="$GOAL"
npx jest tests/integration/self-test.test.ts --testTimeout=600000
```

---

## Error Handling

| Scenario | What happens | Harness behavior |
|---|---|---|
| Clone fails | Test fails immediately | Clear error, no cleanup needed |
| AI rate limit / network error | Agent throws → `task.failed` → Supervisor retries | Retry up to `maxRetries`, then `goal.abandoned` |
| Pipeline timeout (10 min) | Harness dumps message trace + agent state | Fails with "timed out after phase X" |
| Tests fail inside pipeline | Ops emits `build.failed` → Supervisor evaluates keep/discard | Likely discards; harness captures reason |
| Reviewer rejects | Supervisor retries Developer (up to `maxRetries`) | If exhausted, discards; harness captures rejection reasons |
| Worktree left behind | Clone is disposable | `cleanupAll()` in `system.stop()` as best-effort |
| Git merge conflict | `NodeWorktreeManager.merge()` returns `{ success: false }` | Supervisor discards; no special handling needed |
| Budget exhaustion | `CheckBudget` rejects turns → `budget.exceeded` | Goal abandoned; cost data logged |
| Budget circuit breaker (>$15) | Harness force-abandons goal | Prevents runaway retry loops |

---

## Known Limitations

1. **No Supervisor watchdog** — Supervisor decisions are audited but not automatically
   validated. A bad decomposition or wrong retry decision won't be caught until
   manual review. This is Phase 4 (DevBrain) scope.

2. **In-memory storage** — If the process crashes, all pipeline state is lost.
   PostgreSQL EventStore adapter is not in scope.

3. **Single goal at a time** — The harness runs one goal per invocation. Concurrent
   goals are not tested.

4. **No project config caching** — `DetectProjectConfig` runs fresh each time.
   Fine for a self-test, not ideal for repeated runs.

---

## Out of Scope

- PostgreSQL EventStore adapter
- Chat with agents (WebSocket)
- Full Learner intelligence / DevBrain
- Dashboard changes
- CI integration (self-test is manual-only for now)
- Concurrent goal execution
