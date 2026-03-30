# CLI Cleanup — Single Responsibility

**Date:** 2026-03-31
**Status:** Approved design

## Problem

`index.ts` is a 160-line `main()` doing five things: build system, start API, spawn dashboard, subscribe logger, set up shutdown. The progress logger is a 50-line switch. The dashboard spawns with no health check. The last commit included 7 unrelated HTML files.

## Design

### File Structure

| File | Responsibility |
|------|---------------|
| `src/infrastructure/cli/index.ts` | ~20-line `main()` — orchestrates startup and shutdown |
| `src/infrastructure/cli/DashboardProcess.ts` | Spawns Next.js, polls until ready, reports URL, kills on shutdown |
| `src/infrastructure/cli/ProgressLogger.ts` | Subscribes to bus events, formats for terminal via lookup table |

### DashboardProcess

Encapsulates the Next.js child process lifecycle. Static factory discovers the dashboard directory — returns instance if found, null if not.

```typescript
class DashboardProcess {
  readonly url: string

  static async discover(port: number): Promise<DashboardProcess | null>
  stop(): void
}
```

**`discover(port)`:**
1. Searches for dashboard directory (relative to `__dirname` or `process.cwd()`)
2. If not found (no `.next/` build), returns `null`
3. If found, spawns `npx next start -p {port}` as child process
4. Polls `http://localhost:{port}` every 500ms, up to 10 seconds
5. When it responds, returns `DashboardProcess` instance with `url` set
6. If timeout, logs warning ("Dashboard slow to start — try opening manually"), returns instance anyway (don't crash)

**`stop()`:** Kills child process.

**Why poll:** Next.js output format changes between versions. TCP check is universal.

### ProgressLogger

Replaces the 50-line switch with a format lookup table. One line per message type.

```typescript
function subscribeProgressLogger(bus: MessagePort): void
```

Internally:

```typescript
const FORMATS: Partial<Record<MessageType, (msg: any) => string>> = {
  "goal.created":     (m) => `* Goal created: ${m.goalId}`,
  "task.created":     (m) => `+ Task created: ${m.taskId} — ${m.description}`,
  "task.assigned":    (m) => `> Task assigned: ${m.taskId} -> ${m.agentId}`,
  "task.completed":   (m) => `v Task completed: ${m.taskId}`,
  "task.failed":      (m) => `! Task FAILED: ${m.taskId} — ${m.reason}`,
  "code.completed":   (m) => `v Code completed: ${m.taskId} (branch: ${m.branch})`,
  "build.passed":     (m) => `v Build passed: ${m.taskId} (${m.durationMs}ms)`,
  "build.failed":     (m) => `! Build FAILED: ${m.taskId}`,
  "review.approved":  (m) => `v Review APPROVED: ${m.taskId}`,
  "review.rejected":  (m) => `x Review REJECTED: ${m.taskId} — ${m.reasons.join("; ")}`,
  "branch.merged":    (m) => `v Branch merged: ${m.branch} (${m.commit})`,
  "branch.discarded": (m) => `x Branch discarded: ${m.branch} — ${m.reason}`,
  "goal.completed":   (m) => `* Goal COMPLETED: ${m.goalId} (cost: $${m.costUsd.toFixed(2)})`,
  "goal.abandoned":   (m) => `! Goal ABANDONED: ${m.goalId} — ${m.reason}`,
  "agent.stuck":      (m) => `! Agent STUCK: ${m.agentId} on ${m.taskId}`,
}
```

The subscriber becomes:

```typescript
bus.subscribe({ types: Object.keys(FORMATS) as MessageType[] }, async (msg) => {
  const format = FORMATS[msg.type]
  if (format) logProgress(format(msg))
})
```

Three lines.

### index.ts becomes

```typescript
async function main() {
  console.log("DevFleet — Visual Claude Code")
  console.log("=============================")

  const system = await buildSystem({ ... })
  await system.start()

  const server = http.createServer(createServer(system.dashboardDeps))
  server.listen(apiPort)

  const dashboard = await DashboardProcess.discover(dashboardPort)
  if (dashboard) {
    console.log(`\n  Dashboard: ${dashboard.url}\n`)
  } else {
    console.log(`\n  API: http://localhost:${apiPort}`)
    console.log(`  (Dashboard not found — run 'npm run dev' in dashboard/ separately)\n`)
  }

  subscribeProgressLogger(system.bus)

  const shutdown = async () => {
    console.log("\nShutting down...")
    dashboard?.stop()
    server.close()
    await system.stop()
    process.exit(0)
  }
  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}
```

### Fix stray commit

Remove the 7 HTML files from git tracking. Add `*.html` to root `.gitignore` (they're UX mockups, not source code).

## What Changes

| Action | File |
|--------|------|
| Rewrite | `src/infrastructure/cli/index.ts` |
| Create | `src/infrastructure/cli/DashboardProcess.ts` |
| Create | `src/infrastructure/cli/ProgressLogger.ts` |
| Modify | `.gitignore` |
| Remove from git | 7 `ux-*.html` files |
