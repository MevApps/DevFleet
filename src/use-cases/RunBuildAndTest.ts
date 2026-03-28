import type { TaskId } from "../entities/ids"
import type { ShellExecutor } from "./ports/ShellExecutor"
import type { TaskRepository } from "./ports/TaskRepository"
import type { RecordTurnMetrics } from "./RecordTurnMetrics"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"
import { createMessageId } from "../entities/ids"

export interface BuildAndTestResult {
  readonly buildOutput: string
  readonly testOutput: string
}

export class RunBuildAndTest {
  constructor(
    private readonly shell: ShellExecutor,
    private readonly tasks: TaskRepository,
    private readonly recordTurnMetrics: RecordTurnMetrics,
    private readonly bus: MessagePort,
  ) {}

  async execute(taskId: TaskId, buildCommand: string, testCommand: string): Promise<Result<BuildAndTestResult>> {
    const task = await this.tasks.findById(taskId)
    if (!task) return failure(`Task ${taskId} not found`)

    if (task.assignedTo) {
      await this.bus.emit({
        id: createMessageId(),
        type: "agent.active",
        agentId: task.assignedTo,
        taskId,
        timestamp: new Date(),
      })
    }

    // Run build
    const buildStart = Date.now()
    const buildParts = this.parseCommand(buildCommand)
    const buildResult = await this.shell.execute(buildParts.command, buildParts.args)
    const buildDurationMs = Date.now() - buildStart

    await this.recordTurnMetrics.execute(taskId, { tokensIn: 0, tokensOut: 0, durationMs: buildDurationMs })

    if (buildResult.exitCode !== 0) {
      await this.bus.emit({
        id: createMessageId(),
        type: "build.failed",
        taskId,
        error: buildResult.stderr || buildResult.stdout,
        timestamp: new Date(),
      })
      return failure(`Build failed: ${buildResult.stderr || buildResult.stdout}`)
    }

    await this.bus.emit({
      id: createMessageId(),
      type: "build.passed",
      taskId,
      durationMs: buildDurationMs,
      timestamp: new Date(),
    })

    // Run tests
    const testStart = Date.now()
    const testParts = this.parseCommand(testCommand)
    const testResult = await this.shell.execute(testParts.command, testParts.args)
    const testDurationMs = Date.now() - testStart

    await this.recordTurnMetrics.execute(taskId, { tokensIn: 0, tokensOut: 0, durationMs: testDurationMs })

    if (testResult.exitCode !== 0) {
      await this.bus.emit({
        id: createMessageId(),
        type: "test.failed",
        taskId,
        error: testResult.stderr || testResult.stdout,
        timestamp: new Date(),
      })
      return failure(`Tests failed: ${testResult.stderr || testResult.stdout}`)
    }

    await this.bus.emit({
      id: createMessageId(),
      type: "test.passed",
      taskId,
      durationMs: testDurationMs,
      timestamp: new Date(),
    })

    return success({
      buildOutput: buildResult.stdout,
      testOutput: testResult.stdout,
    })
  }

  private parseCommand(raw: string): { command: string; args: readonly string[] } {
    const parts = raw.match(/(?:[^\s"]+|"[^"]*")+/g) ?? [raw]
    return {
      command: parts[0]!,
      args: parts.slice(1).map(p => p.replace(/^"|"$/g, "")),
    }
  }
}
