import { EvaluateAlert, type AlertRule } from "@use-cases/EvaluateAlert"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryAlertPreferencesStore } from "@adapters/storage/InMemoryAlertPreferencesStore"
import { NoOpNotificationAdapter } from "@adapters/notifications/NoOpNotificationAdapter"
import { createMessageId, createGoalId } from "@entities/ids"
import type { Message } from "@entities/Message"

describe("EvaluateAlert", () => {
  const rule: AlertRule = { trigger: "goal.completed", severity: "info", evaluate: () => ({ severity: "info", title: "Goal done", body: "completed" }) }

  it("emits ceo.alert when rule matches", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({ types: ["ceo.alert"] }, async (m) => { emitted.push(m) })
    const uc = new EvaluateAlert(new NoOpNotificationAdapter(), new InMemoryAlertPreferencesStore(), bus, [rule])
    await uc.execute({ id: createMessageId(), type: "goal.completed", goalId: createGoalId(), costUsd: 0, timestamp: new Date() })
    expect(emitted).toHaveLength(1)
    expect(emitted[0]?.type).toBe("ceo.alert")
  })

  it("respects minSeverity preference", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({ types: ["ceo.alert"] }, async (m) => { emitted.push(m) })
    const prefsStore = new InMemoryAlertPreferencesStore()
    await prefsStore.update({ minSeverity: "warning", mutedTriggers: [] })
    const uc = new EvaluateAlert(new NoOpNotificationAdapter(), prefsStore, bus, [rule])
    await uc.execute({ id: createMessageId(), type: "goal.completed", goalId: createGoalId(), costUsd: 0, timestamp: new Date() })
    expect(emitted).toHaveLength(0)
  })

  it("does not emit for non-matching message types", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({ types: ["ceo.alert"] }, async (m) => { emitted.push(m) })
    const uc = new EvaluateAlert(new NoOpNotificationAdapter(), new InMemoryAlertPreferencesStore(), bus, [rule])
    await uc.execute({ id: createMessageId(), type: "task.created", taskId: createGoalId() as any, goalId: createGoalId(), description: "x", timestamp: new Date() })
    expect(emitted).toHaveLength(0)
  })
})
