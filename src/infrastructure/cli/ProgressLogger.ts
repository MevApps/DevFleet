import type { MessagePort } from "../../use-cases/ports/MessagePort"
import type { MessageType } from "../../entities/Message"

function formatTimestamp(): string {
  return new Date().toLocaleTimeString("en-US", { hour12: false })
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
