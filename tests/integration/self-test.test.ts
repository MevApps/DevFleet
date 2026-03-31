import { execSync } from "node:child_process"
import { mkdtempSync } from "node:fs"
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
    const repoRoot = process.cwd()
    clonePath = mkdtempSync(join(tmpdir(), "devfleet-selftest-"))
    console.log(`\n  Cloning DevFleet to: ${clonePath}`)
    execSync(`git clone "${repoRoot}" "${clonePath}"`, { stdio: "inherit" })
    console.log("  Installing dependencies in clone...")
    execSync("npm install --legacy-peer-deps", { cwd: clonePath, stdio: "inherit" })
  }, 120_000)

  afterAll(async () => {
    if (system) await system.stop()
    console.log(`\n  Clone preserved at: ${clonePath}`)
    console.log("  Review with:")
    console.log(`    cd ${clonePath}`)
    console.log("    git log --oneline")
    console.log("    git diff HEAD~1")
  })

  it("runs the full pipeline and produces a completed goal", async () => {
    const fs = new NodeFileSystem(clonePath)
    const detected = await new DetectProjectConfig(fs).execute()
    console.log(`  Detected project: ${detected.language} (build: ${detected.buildCommand}, test: ${detected.testCommand})`)

    system = await buildSystem({
      projectDir: clonePath,
      supervisorModel: "claude-opus-4-20250514",
      reviewerModel: "claude-opus-4-20250514",
      developerModel: "claude-sonnet-4-20250514",
      pipelineTimeoutMs: 600_000,
      maxRetries: 2,
      buildCommand: detected.buildCommand,
      testCommand: detected.testCommand,
    })

    await system.start()

    const messages: Message[] = []
    const supervisorDecisions: string[] = []
    let cumulativeCostUsd = 0

    system.bus.subscribe({}, async (msg) => {
      messages.push(msg)

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

    const goalId = createGoalId()
    let goalAbandoned = false

    // Budget circuit breaker — track cost from any message with token fields
    system.bus.subscribe({}, async (msg) => {
      const m = msg as unknown as Record<string, unknown>
      if (typeof m.tokensIn === "number" && typeof m.tokensOut === "number") {
        const model = typeof m.model === "string" ? m.model : "sonnet"
        cumulativeCostUsd += estimateCostUsd(m.tokensIn as number, m.tokensOut as number, model)
      }
      if (cumulativeCostUsd > BUDGET_CIRCUIT_BREAKER_USD && !goalAbandoned) {
        goalAbandoned = true
        console.log(`  CIRCUIT BREAKER: $${cumulativeCostUsd.toFixed(2)} exceeds $${BUDGET_CIRCUIT_BREAKER_USD} limit`)
        await system.bus.emit({
          id: createMessageId(),
          type: "goal.abandoned",
          goalId,
          reason: `Budget circuit breaker: $${cumulativeCostUsd.toFixed(2)} exceeded $${BUDGET_CIRCUIT_BREAKER_USD} limit`,
          timestamp: new Date(),
        })
      }
    })

    const goal = createGoal({
      id: goalId,
      description: SELF_TEST_GOAL,
      totalBudget: createBudget({ maxTokens: 200_000, maxCostUsd: 10.0 }),
      status: "active",
    })
    await system.goalRepo.create(goal)

    const done = new Promise<Message>((resolve) => {
      system.bus.subscribe({ types: ["goal.completed", "goal.abandoned"] }, async (msg) => {
        if ("goalId" in msg && (msg as any).goalId === goalId) {
          resolve(msg)
        }
      })
    })

    console.log(`\n  Goal: ${SELF_TEST_GOAL}`)
    console.log("  Pipeline started...\n")

    await system.bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId,
      description: goal.description,
      timestamp: new Date(),
    })

    const result = await done

    // Diagnostics
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

    console.log("\n  === GIT LOG ===")
    try {
      const gitLog = execSync("git log --oneline -20", { cwd: clonePath }).toString()
      console.log(gitLog.split("\n").map(l => `    ${l}`).join("\n"))
    } catch { /* no new commits */ }

    console.log("\n  === GIT DIFF (summary) ===")
    try {
      const gitDiff = execSync("git diff --stat HEAD~1", { cwd: clonePath }).toString()
      console.log(gitDiff.split("\n").map(l => `    ${l}`).join("\n"))
    } catch { /* no diff */ }

    console.log(`\n  Clone at: ${clonePath}`)

    // Assertions
    expect(result.type).toBe("goal.completed")

    const types = messages.map(m => m.type)
    expect(types).toContain("task.created")
    expect(types).toContain("task.assigned")
    expect(types).toContain("code.completed")
    expect(types).toContain("build.passed")
    expect(types).toContain("review.approved")
    expect(types).toContain("branch.merged")

    const testReportMsg = messages.find(m => m.type === "test.report.created")
    if (testReportMsg && "artifactId" in testReportMsg) {
      const artifact = await system.artifactRepo.findById((testReportMsg as any).artifactId)
      if (artifact && artifact.kind === "test_report") {
        const report = JSON.parse(artifact.content) as { passed: number; failed: number }
        console.log(`\n  Test report: ${report.passed} passed, ${report.failed} failed`)
        expect(report.failed).toBe(0)
      }
    }
  }, 660_000)
})
