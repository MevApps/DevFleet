# Workspace Page Design

> A dashboard page for configuring and running DevFleet against any repository,
> with automated push, PR creation, and optional auto-merge.

## Motivation

Running DevFleet against a repo currently requires terminal commands, env vars, and
manual cleanup. The workspace page makes this accessible to team members who don't
know the internals — one form to set up, existing goal form to give it work, and
fully automated delivery of results to the remote repo.

## Success Criteria

1. Team member can start a workspace from the dashboard in under 30 seconds
2. Goals created from Live Floor target the active workspace
3. Completed goals auto-push and create PRs on the remote repo
4. Auto-merge is available behind a feature flag (default: off)
5. Workspace cleanup is automatic on stop, with failed goals preserved for debugging

## Constraints

- **API keys:** Server env vars (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`) — no keys in the UI
- **Auto-merge:** Feature flag `DEVFLEET_AUTO_MERGE` (default: false)
- **Storage:** In-memory for v1 — workspace state lost on server restart
- **Concurrency:** One active workspace at a time for v1

---

## Layer 1: Entities

### WorkspaceRun

```typescript
interface WorkspaceRun {
  readonly id: WorkspaceRunId
  readonly config: WorkspaceRunConfig
  readonly status: WorkspaceRunStatus
  readonly projectConfig: ProjectConfig | null
  readonly startedAt: Date
  readonly completedAt: Date | null
  readonly error: string | null
}

type WorkspaceRunStatus =
  | "created"
  | "cloning"
  | "installing"     // dependency installation in progress
  | "detecting"
  | "active"
  | "stopped"
  | "stopped_dirty"  // failed goals exist, clone preserved for debugging
  | "failed"

interface WorkspaceRunConfig {
  readonly repoUrl: string
  readonly maxCostUsd: number       // default: 10.0
  readonly maxTokens: number        // default: 200_000
  readonly supervisorModel: string  // default: "claude-opus-4-20250514"
  readonly developerModel: string   // default: "claude-sonnet-4-20250514"
  readonly reviewerModel: string    // default: "claude-opus-4-20250514"
  readonly timeoutMs: number        // default: 600_000
}
```

**Design decisions:**
- No `clonePath` on entity — managed by `WorkspaceIsolator` adapter
- No `costUsd` on entity — derived on demand from `MetricRecorder`/`EventStore`
- No `messageTrace` on entity — queried from `EventStore`
- No `goalId` on entity — a workspace is a session that receives multiple goals via the existing goal creation flow; goals are tracked in `GoalRepository`
- `WorkspaceRunId` — branded string type, defined in `src/entities/ids.ts`
- Status lifecycle: `created → cloning → detecting → active → stopped/stopped_dirty/failed`
- `stopped`: clean shutdown, clone removed
- `stopped_dirty`: shutdown with failed goals, clone preserved for debugging
- `failed`: workspace boot itself failed (clone error, detection error)
- A workspace is a **session** that can receive multiple goals while active

---

## Layer 2: Use Cases

### StartWorkspaceRun

```
Input:  WorkspaceRunConfig
Output: WorkspaceRunId | Error

1. Guard: check WorkspaceRunRepository.findActive() — if active, return error
2. Create WorkspaceRun entity (status: created)
3. Clone repo via WorkspaceIsolator.create(repoUrl) (status: cloning)
4. Return WorkspaceRunId immediately
5. Kick off BootWorkspace asynchronously
```

Returns the ID synchronously. Clone + boot happens async. Caller watches
progress via SSE. Returns error if a workspace is already active (v1
supports one workspace at a time).

### BootWorkspace

```
Input:  WorkspaceRunId
Output: void (async, updates status via events)

1. Run DetectProjectConfig against clone (status: detecting)
2. Install dependencies via WorkspaceIsolator.installDependencies(handle, projectConfig.installCommand) (status: installing)
3. Build a fresh DevFleetSystem for the clone directory
4. Start the system (status: active)
5. Subscribe to goal lifecycle events for auto-push/PR
```

Separated from `StartWorkspaceRun` so clone errors are synchronous and
pipeline errors are async — different error paths, different handlers.

Dependency installation is critical — without it, the clone has no
`node_modules` (or equivalent) and the Ops agent's test command will fail.

**Note:** `ProjectConfig` gains an `installCommand` field:

| Language | installCommand |
|----------|---------------|
| typescript/javascript | `npm install` |
| rust | `cargo build` |
| kotlin | `./gradlew build` |
| go | `go mod download` |
| unknown | (skip) |

### StopWorkspace

```
Input:  WorkspaceRunId
Output: void

1. Guard: if goals are currently running, return error (wait for completion or timeout)
2. Stop the DevFleetSystem
3. Check if any goals failed (goal.abandoned in EventStore)
4. If all goals succeeded:
   a. Cleanup clone via WorkspaceIsolator.cleanup()
   b. Set status: stopped
5. If any goals failed:
   a. Keep clone intact for debugging
   b. Set status: stopped_dirty
   c. Return clone path in response (for manual inspection)
```

### CleanupWorkspace

```
Input:  WorkspaceRunId
Output: void

1. Only valid when status is "stopped_dirty"
2. Cleanup clone via WorkspaceIsolator.cleanup()
3. Set status: stopped
```

The manual cleanup for failed workspaces — called from a "Cleanup" button
on the workspace page after the user has inspected the clone.

### GetWorkspaceRunStatus

```
Input:  WorkspaceRunId
Output: {
  run: WorkspaceRun,
  events: Message[],
  costUsd: number,
  goalSummaries: GoalSummary[]
}
```

All derived data — queries EventStore, MetricRecorder, GoalRepository.
`GoalSummary` includes: goalId, description, status, costUsd, duration, prUrl.

### WorkspaceRunManager

Orchestrator that owns the lifecycle of active workspace runs.

```
startRun(config) → runId | error   // guards: no active workspace
getStatus(runId) → status DTO
stop(runId) → void | error          // guards: no running goals
cleanup(runId) → void               // only from stopped_dirty
findActive() → WorkspaceRun | null
getEventStream(runId) → MessagePort (for SSE)
stopAll() → called on server shutdown
```

Internally holds `Map<WorkspaceRunId, DevFleetSystem>`. Encapsulated — the
HTTP layer and use cases interact through the manager, not the map directly.

Responsibilities:
- Track active systems
- Handle goal.completed/goal.abandoned event subscriptions
- Ensure system.stop() called exactly once per run
- Auto-push + PR creation on goal completion
- Auto-merge when feature flag is enabled

---

## Layer 2: Event-Driven — Goal Completion Flow

When a goal completes inside an active workspace:

```
goal.completed
  → GitRemote.push(branch, remoteUrl)
  → PullRequestCreator.create(repoUrl, branch, title, body) → prUrl
  → if DEVFLEET_AUTO_MERGE=true:
      → PullRequestCreator.merge(prUrl)
  → emit workspace.goal.delivered { goalId, prUrl, merged: boolean }
```

**PR content** assembled from pipeline artifacts:

```markdown
## Goal
<goal description>

## What was done
<spec artifact content>

## Implementation Plan
<plan artifact content>

## Test Results
<test report: X passed, 0 failed>

---
Generated by DevFleet
```

When a goal is abandoned:

```
goal.abandoned
  → Log failure reason
  → Clone preserved (not cleaned up)
  → emit workspace.goal.failed { goalId, reason }
```

---

## New Ports

### WorkspaceIsolator

```typescript
interface WorkspaceHandle {
  readonly id: string
}

interface WorkspaceIsolator {
  create(repoUrl: string): Promise<WorkspaceHandle>
  installDependencies(handle: WorkspaceHandle, installCommand: string): Promise<void>
  getWorkspaceDir(handle: WorkspaceHandle): string  // adapter-layer only, not called from use cases
  cleanup(handle: WorkspaceHandle): Promise<void>
}
```

Adapter: `GitCloneIsolator` — uses `git clone` to temp dir, runs install
command via `ShellExecutor`, `rm -rf` for cleanup. The `WorkspaceHandle`
wraps the temp dir path internally.

`getWorkspaceDir` is called only from the adapter/composition layer when
building a `DevFleetSystem` — use cases never see the filesystem path.

### WorkspaceRunRepository

```typescript
interface WorkspaceRunRepository {
  create(run: WorkspaceRun): Promise<void>
  findById(id: WorkspaceRunId): Promise<WorkspaceRun | null>
  findActive(): Promise<WorkspaceRun | null>
  update(run: WorkspaceRun): Promise<void>
}
```

Adapter: `InMemoryWorkspaceRunRepository` for v1.

### GitRemote

```typescript
interface GitRemote {
  push(branch: string, remoteUrl: string, clonePath: string): Promise<void>
}
```

Adapter: `NodeGitRemote` — uses `git push` via `ShellExecutor`.

### PullRequestCreator

```typescript
interface PullRequestCreator {
  create(params: {
    repoUrl: string
    branch: string
    title: string
    body: string
  }): Promise<string>  // returns PR URL

  merge(prUrl: string): Promise<void>
}
```

Adapter: `GitHubPullRequestCreator` — uses `gh` CLI or GitHub REST API.
`merge` only called when `DEVFLEET_AUTO_MERGE=true`.

---

## Layer 3: API Endpoints

### `POST /api/workspace/start`

```
Body: { repoUrl, maxCostUsd?, maxTokens?, supervisorModel?, developerModel?, reviewerModel?, timeoutMs? }
Response: { runId: string }
```

Calls `WorkspaceRunManager.startRun()`.

### `GET /api/workspace/status`

```
Response: {
  run: { id, config, status, projectConfig, startedAt, completedAt, error },
  costUsd: number,
  goalSummaries: [{ goalId, description, status, costUsd, durationMs, prUrl }],
  events: Message[]
}
```

Returns the active workspace status. 404 if no active workspace.

### `POST /api/workspace/stop`

```
Response: { status: "stopped" }
```

Calls `WorkspaceRunManager.stop()`. Returns error if goals are currently running.
Returns `{ status: "stopped", clonePath?: string }` — `clonePath` present only
when status is `stopped_dirty` (failed goals, clone preserved).

### `POST /api/workspace/cleanup`

```
Response: { status: "stopped" }
```

Calls `WorkspaceRunManager.cleanup()`. Only valid when status is `stopped_dirty`.
Removes the preserved clone and transitions to `stopped`.

### `GET /api/workspace/events`

SSE stream scoped to the active workspace. Streams all bus events from
the workspace's `DevFleetSystem`.

### Existing endpoint change: `POST /api/goals`

When a workspace is active, goal creation targets the workspace's system
instead of the main system. The goal route handler checks
`WorkspaceRunManager.findActive()` — if an active workspace exists, it uses
that workspace's `DevFleetSystem` (goalRepo, bus) to create the goal and
emit `goal.created`. If no workspace is active, it falls back to the main
system (existing behavior).

**Visibility requirement:** The response includes `{ targetedWorkspace: runId | null }`
so the UI always knows where the goal went. See Layer 4 for the workspace
banner on Live Floor.

### `GET /api/workspace/active`

```
Response: { active: boolean, runId?: string, repoUrl?: string }
```

Lightweight check for the Live Floor to show/hide the workspace banner.
Polled or derived from SSE events.

---

## Layer 4: UI — Workspace Page

### Route: `/workspace`

### State 1: No active workspace

- Simple form: Repository URL (required) + "Start Workspace" button
- Collapsed "Advanced settings": budget, models, timeout
- "Last config" button restores from localStorage

### State 2: Workspace active

- **Info bar:** Repo name, detected project config (language, commands), "Stop Workspace" button
- **Stats row:** Goals run, active goals, total cost, uptime
- **Activity log:** Goal history with status, cost, duration, PR link
- **Guidance note:** "Create goals from the Live Floor page"

### State 3: Stopped dirty (failed goals, clone preserved)

- **Warning banner:** "Workspace stopped with failed goals. Clone preserved for debugging."
- **Clone path** displayed for manual inspection
- **"Cleanup" button** — calls `CleanupWorkspace`, removes clone, transitions to State 1
- **Activity log** still visible with failure details

### State transitions

- "Start Workspace" → shows cloning/installing/detecting progress → transitions to active state
- "Stop Workspace" (all goals succeeded) → auto-cleanup → transitions to State 1
- "Stop Workspace" (some goals failed) → transitions to State 3 (stopped_dirty)
- "Cleanup" (from State 3) → removes clone → transitions to State 1
- On server restart → resets to State 1 (in-memory storage)

### Navigation

Add "Workspace" to sidebar under the "Workflow" section, between "Pipeline" and "Goals".

### Live Floor: Workspace Banner

When a workspace is active, the Live Floor shows a prominent banner at
the top of the page:

```
[blue banner] Workspace active: user/repo — goals target this workspace
                                                    [View Workspace →]
```

This prevents silent goal routing — every team member sees that a workspace
is active before creating goals. The banner links to the workspace page.
When no workspace is active, the banner is hidden.

---

## New Message Types

```typescript
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
  readonly status: WorkspaceRunStatus
}
```

---

## Auto-Merge Feature Flag

```
DEVFLEET_AUTO_MERGE=true|false (default: false)
```

When `false`: PR is created but not merged. Human reviews and merges.
When `true`: PR is created and immediately merged. Human reviews features
in the running app, not in the code.

The flag is read at event-handling time — can be toggled without restart
by updating the env var (or via a future settings API).

**Rationale for default off:** The Reviewer agent has zero track record on
real code. Build trust through data — review the first 10-50 PRs manually.
When confidence is high, flip the flag.

---

## Known Limitations

1. **One workspace at a time** — v1 supports a single active workspace.
   Multi-workspace requires run isolation and UI routing.

2. **In-memory storage** — Workspace state lost on server restart.
   PostgreSQL adapter is not in scope.

3. **No per-user API keys** — Server env vars only. Per-user keys
   require user identity, which doesn't exist yet.

4. **GitHub only** — `PullRequestCreator` adapter targets GitHub.
   GitLab/Bitbucket adapters can be added later behind the same port.

5. **No run history** — v1 shows only the current/last workspace.
   Run history requires persistent storage.

6. **Auto-merge trust** — The Reviewer agent's judgment is unvalidated.
   Auto-merge should remain off until sufficient confidence is built.

---

## Out of Scope

- PostgreSQL storage
- Multi-workspace concurrency
- Per-user API keys / authentication
- GitLab/Bitbucket adapters
- Run history
- WebSocket for bidirectional control
- Settings page for feature flags (env vars for v1)
