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
