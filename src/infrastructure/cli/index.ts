#!/usr/bin/env node
import * as http from "node:http"
import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import { buildSystem } from "../config/composition-root"
import { createServer } from "../http/createServer"
import type { Message } from "../../entities/Message"

const WORKSPACE_DIR = process.env["WORKSPACE_DIR"] ?? process.cwd()
const MOCK_MODE = process.env["DEVFLEET_MOCK"] === "true"

function formatTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false })
}

function logProgress(icon: string, message: string): void {
  console.log(`  [${formatTimestamp()}] ${icon} ${message}`)
}

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
  const app = createServer(system.dashboardDeps)
  const server = http.createServer(app)
  server.listen(apiPort)

  // Start the Next.js dashboard
  const dashboardDir = findDashboardDir()
  let dashboardProcess: ChildProcess | null = null

  if (dashboardDir) {
    dashboardProcess = spawn("npx", ["next", "start", "-p", String(dashboardPort)], {
      cwd: dashboardDir,
      stdio: "ignore",
      env: { ...process.env, PORT: String(dashboardPort) },
    })

    dashboardProcess.on("error", (err) => {
      console.error(`  Dashboard failed to start: ${err.message}`)
      console.log(`  API still running at http://localhost:${apiPort}`)
    })

    console.log(`\n  Dashboard: http://localhost:${dashboardPort}\n`)
  } else {
    console.log(`\n  API: http://localhost:${apiPort}`)
    console.log(`  (Dashboard not found — run 'npm run dev' in dashboard/ separately)\n`)
  }

  // ---------------------------------------------------------------------------
  // Subscribe to key messages and print progress
  // ---------------------------------------------------------------------------
  const progressTypes = [
    "goal.created", "goal.completed", "goal.abandoned",
    "task.created", "task.assigned", "task.completed", "task.failed",
    "code.completed",
    "review.approved", "review.rejected",
    "branch.merged", "branch.discarded",
    "build.passed", "build.failed",
    "agent.stuck",
  ] as const

  system.bus.subscribe({ types: [...progressTypes] }, async (msg: Message) => {
    switch (msg.type) {
      case "goal.created":
        logProgress("*", `Goal created: ${msg.goalId}`)
        break
      case "task.created":
        logProgress("+", `Task created: ${msg.taskId} — ${msg.description}`)
        break
      case "task.assigned":
        logProgress(">", `Task assigned: ${msg.taskId} -> ${msg.agentId}`)
        break
      case "task.completed":
        logProgress("v", `Task completed: ${msg.taskId}`)
        break
      case "task.failed":
        logProgress("!", `Task FAILED: ${msg.taskId} — ${msg.reason}`)
        break
      case "code.completed":
        logProgress("v", `Code completed: ${msg.taskId} (branch: ${msg.branch})`)
        break
      case "build.passed":
        logProgress("v", `Build passed: ${msg.taskId} (${msg.durationMs}ms)`)
        break
      case "build.failed":
        logProgress("!", `Build FAILED: ${msg.taskId}`)
        break
      case "review.approved":
        logProgress("v", `Review APPROVED: ${msg.taskId}`)
        break
      case "review.rejected":
        logProgress("x", `Review REJECTED: ${msg.taskId} — ${msg.reasons.join("; ")}`)
        break
      case "branch.merged":
        logProgress("v", `Branch merged: ${msg.branch} (${msg.commit})`)
        break
      case "branch.discarded":
        logProgress("x", `Branch discarded: ${msg.branch} — ${msg.reason}`)
        break
      case "goal.completed":
        logProgress("*", `Goal COMPLETED: ${msg.goalId} (cost: $${msg.costUsd.toFixed(2)})`)
        break
      case "goal.abandoned":
        logProgress("!", `Goal ABANDONED: ${msg.goalId} — ${msg.reason}`)
        break
      case "agent.stuck":
        logProgress("!", `Agent STUCK: ${msg.agentId} on ${msg.taskId}`)
        break
    }
  })

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------
  const shutdown = async () => {
    console.log("\nShutting down...")
    if (dashboardProcess) dashboardProcess.kill()
    server.close()
    await system.stop()
    process.exit(0)
  }

  process.on("SIGINT", shutdown)
  process.on("SIGTERM", shutdown)
}

function findDashboardDir(): string | null {
  // Check relative to the DevFleet package (works whether run via npm link or directly)
  const candidates = [
    join(__dirname, "..", "..", "..", "dashboard"),        // from dist/infrastructure/cli/
    join(process.cwd(), "dashboard"),                      // from project root
  ]
  for (const dir of candidates) {
    const resolved = resolve(dir)
    if (existsSync(join(resolved, ".next"))) return resolved
  }
  return null
}

main().catch(err => {
  console.error("Fatal error:", err)
  process.exit(1)
})
