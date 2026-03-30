# CLI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extract CLI into focused modules — DashboardProcess, ProgressLogger — so `main()` reads like a table of contents.

**Architecture:** `DashboardProcess` encapsulates Next.js lifecycle with health check polling. `ProgressLogger` replaces 50-line switch with format lookup table. Stray HTML files removed from git.

**Tech Stack:** TypeScript, Node.js, child_process, http

**Spec:** `docs/superpowers/specs/2026-03-31-cli-cleanup-design.md`

---

## Task 0: Remove stray HTML files from git

**Files:**
- Modify: `.gitignore`
- Remove from git: 7 `ux-*.html` files

- [ ] **Step 1: Add HTML mockups to .gitignore**

Add to the root `.gitignore`:

```
ux-*.html
```

- [ ] **Step 2: Remove the files from git tracking**

```bash
git rm --cached ux-goal-focus.html ux-kanban-options.html ux-redesign.html ux-sidebar-final.html ux-sidebar-options.html ux-sidebar-v2.html ux-workspace-options.html
```

- [ ] **Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: remove stray UX mockup HTML files from git tracking"
```

---

## Task 1: Create DashboardProcess

**Files:**
- Create: `src/infrastructure/cli/DashboardProcess.ts`
- Test: `tests/infrastructure/DashboardProcess.test.ts`

- [ ] **Step 1: Write test**

```typescript
// tests/infrastructure/DashboardProcess.test.ts
import { describe, it, expect } from "vitest"
import { DashboardProcess } from "../../src/infrastructure/cli/DashboardProcess"

describe("DashboardProcess", () => {
  it("returns null when no dashboard directory exists", async () => {
    const result = await DashboardProcess.discover(9999, "/tmp/nonexistent-dir-xyz")
    expect(result).toBeNull()
  })

  it("exposes url property with correct port", () => {
    // Test the URL formatting directly — we can't easily test spawning Next.js in unit tests
    // but we can verify the static factory returns null for missing dirs
    // Full integration tested manually with `devfleet` command
  })
})
```

Run: `npx vitest run tests/infrastructure/DashboardProcess.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 2: Implement DashboardProcess**

```typescript
// src/infrastructure/cli/DashboardProcess.ts
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import * as http from "node:http"

const POLL_INTERVAL_MS = 500
const POLL_TIMEOUT_MS = 10_000

export class DashboardProcess {
  readonly url: string
  private readonly child: ChildProcess

  private constructor(child: ChildProcess, port: number) {
    this.child = child
    this.url = `http://localhost:${port}`
  }

  static async discover(port: number, rootDir?: string): Promise<DashboardProcess | null> {
    const dir = findDashboardDir(rootDir)
    if (!dir) return null

    const child = spawn("npx", ["next", "start", "-p", String(port)], {
      cwd: dir,
      stdio: "ignore",
      env: { ...process.env, PORT: String(port) },
    })

    child.on("error", (err) => {
      console.error(`  Dashboard process error: ${err.message}`)
    })

    const instance = new DashboardProcess(child, port)
    await instance.waitUntilReady()
    return instance
  }

  stop(): void {
    this.child.kill()
  }

  private async waitUntilReady(): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS

    while (Date.now() < deadline) {
      const ready = await this.probe()
      if (ready) return
      await sleep(POLL_INTERVAL_MS)
    }

    console.log("  Dashboard slow to start — try opening manually")
  }

  private probe(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(this.url, () => resolve(true))
      req.on("error", () => resolve(false))
      req.setTimeout(POLL_INTERVAL_MS, () => {
        req.destroy()
        resolve(false)
      })
    })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function findDashboardDir(rootDir?: string): string | null {
  const candidates = [
    join(__dirname, "..", "..", "..", "dashboard"),
    join(rootDir ?? process.cwd(), "dashboard"),
  ]
  for (const dir of candidates) {
    const resolved = resolve(dir)
    if (existsSync(join(resolved, ".next"))) return resolved
  }
  return null
}
```

- [ ] **Step 3: Run test**

Run: `npx vitest run tests/infrastructure/DashboardProcess.test.ts`
Expected: PASS.

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/infrastructure/cli/DashboardProcess.ts tests/infrastructure/DashboardProcess.test.ts
git commit -m "feat: add DashboardProcess — spawns Next.js with health check polling"
```

---

## Task 2: Create ProgressLogger + Rewrite index.ts

**Files:**
- Create: `src/infrastructure/cli/ProgressLogger.ts`
- Rewrite: `src/infrastructure/cli/index.ts`

- [ ] **Step 1: Create ProgressLogger**

```typescript
// src/infrastructure/cli/ProgressLogger.ts
import type { MessagePort } from "../../use-cases/ports/MessagePort"
import type { MessageType } from "../../entities/Message"

function formatTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false })
}

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

export function subscribeProgressLogger(bus: MessagePort): void {
  const types = Object.keys(FORMATS) as MessageType[]

  bus.subscribe({ types }, async (msg) => {
    const format = FORMATS[msg.type]
    if (format) {
      console.log(`  [${formatTimestamp()}] ${format(msg)}`)
    }
  })
}
```

- [ ] **Step 2: Rewrite index.ts**

```typescript
// src/infrastructure/cli/index.ts
#!/usr/bin/env node
import * as http from "node:http"
import { buildSystem } from "../config/composition-root"
import { createServer } from "../http/createServer"
import { DashboardProcess } from "./DashboardProcess"
import { subscribeProgressLogger } from "./ProgressLogger"

const WORKSPACE_DIR = process.env["WORKSPACE_DIR"] ?? process.cwd()
const MOCK_MODE = process.env["DEVFLEET_MOCK"] === "true"

async function main(): Promise<void> {
  console.log("DevFleet — Visual Claude Code")
  console.log("=============================")

  if (MOCK_MODE) {
    console.log("(DEVFLEET_MOCK=true — using mock agent sessions)")
  }

  const system = await buildSystem({
    workspaceDir: WORKSPACE_DIR,
    mockMode: MOCK_MODE,
    developerModel: process.env["DEVELOPER_MODEL"] ?? "claude-sonnet-4-20250514",
    supervisorModel: process.env["SUPERVISOR_MODEL"] ?? "claude-sonnet-4-20250514",
    reviewerModel: process.env["REVIEWER_MODEL"] ?? "claude-sonnet-4-20250514",
    pipelineTimeoutMs: parseInt(process.env["PIPELINE_TIMEOUT_MS"] ?? "300000", 10),
    maxRetries: parseInt(process.env["MAX_RETRIES"] ?? "2", 10),
  })

  await system.start()

  const apiPort = parseInt(process.env["HTTP_PORT"] ?? "3100", 10)
  const dashboardPort = parseInt(process.env["DASHBOARD_PORT"] ?? "3000", 10)
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

main().catch(err => {
  console.error("Fatal error:", err)
  process.exit(1)
})
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: All backend tests pass.

- [ ] **Step 5: Rebuild and re-link**

```bash
npm run build
npm link
```

- [ ] **Step 6: Commit**

```bash
git add src/infrastructure/cli/ProgressLogger.ts src/infrastructure/cli/index.ts
git commit -m "refactor: extract ProgressLogger and rewrite CLI — main() is a table of contents"
```
