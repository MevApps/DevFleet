import * as readline from "node:readline"
import { buildSystem } from "../config/composition-root"
import { createGoal } from "../../entities/Goal"
import { createGoalId, createTaskId, createAgentId, createMessageId } from "../../entities/ids"
import { createBudget } from "../../entities/Budget"
import { createTask } from "../../entities/Task"
import { ROLES } from "../../entities/AgentRole"

const WORKSPACE_DIR = process.env["WORKSPACE_DIR"] ?? process.cwd()
const API_KEY = process.env["ANTHROPIC_API_KEY"]

async function main(): Promise<void> {
  console.log("DevFleet CLI — Phase 1 MVP")
  console.log("==========================")

  const system = await buildSystem({
    workspaceDir: WORKSPACE_DIR,
    anthropicApiKey: API_KEY,
    developerModel: process.env["DEVELOPER_MODEL"] ?? "claude-3-5-sonnet-20241022",
  })

  await system.start()

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  const question = (prompt: string): Promise<string> =>
    new Promise(resolve => rl.question(prompt, resolve))

  try {
    const goalDescription = await question("\nEnter your goal: ")
    if (!goalDescription.trim()) {
      console.log("No goal entered. Exiting.")
      return
    }

    // Create goal
    const goalId = createGoalId()
    const goal = createGoal({
      id: goalId,
      description: goalDescription.trim(),
      totalBudget: createBudget({ maxTokens: 100_000, maxCostUsd: 10.0 }),
    })
    await system.goalRepo.create(goal)

    console.log(`\nGoal created: ${goalId}`)
    console.log("Decomposing goal into tasks...")

    // Simple decomposition: create one task from the goal
    const taskId = createTaskId()
    const agentId = createAgentId("developer-1")
    const task = createTask({
      id: taskId,
      goalId,
      description: goalDescription.trim(),
      phase: "implementation",
      budget: createBudget({ maxTokens: 50_000, maxCostUsd: 5.0 }),
      status: "in_progress",
      assignedTo: agentId,
      version: 1,
    })
    await system.taskRepo.create(task)

    console.log(`Task created: ${taskId}`)
    console.log(`Assigning to developer agent: ${agentId}`)

    // Emit task.assigned to trigger the DeveloperPlugin
    await system.bus.emit({
      id: createMessageId(),
      type: "task.assigned",
      taskId,
      agentId,
      timestamp: new Date(),
    })

    // Wait for async processing
    await new Promise<void>(resolve => setTimeout(resolve, 500))

    // Check agent registry for available agents
    const available = await system.agentRegistry.findAvailable(ROLES.DEVELOPER)
    if (available) {
      console.log(`\nDeveloper agent ${available.id} is ${available.status}`)
    }

    console.log("\nTask dispatched. Monitor logs above for execution progress.")
  } finally {
    rl.close()
    await system.stop()
  }
}

main().catch(err => {
  console.error("Fatal error:", err)
  process.exit(1)
})
