import type { NotificationPort, CeoAlert } from "./ports/NotificationPort"
import type { AlertPreferencesStore } from "./ports/AlertPreferencesStore"
import type { MessagePort } from "./ports/MessagePort"
import type { Message, MessageType } from "../entities/Message"
import { severityRank } from "../entities/AlertPreferences"
import { createMessageId } from "../entities/ids"

export interface AlertRule {
  readonly trigger: MessageType
  readonly severity: "info" | "warning" | "urgent"
  readonly evaluate: (message: Message) => CeoAlert | null
}

export class EvaluateAlert {
  constructor(
    private readonly notificationPort: NotificationPort,
    private readonly alertPreferencesStore: AlertPreferencesStore,
    private readonly bus: MessagePort,
    private readonly rules: ReadonlyArray<AlertRule>,
  ) {}

  async execute(message: Message): Promise<void> {
    const prefs = await this.alertPreferencesStore.read()

    for (const rule of this.rules) {
      if (rule.trigger !== message.type) continue
      const alert = rule.evaluate(message)
      if (!alert) continue
      if (severityRank(alert.severity) < severityRank(prefs.minSeverity)) continue
      if (prefs.mutedTriggers.includes(rule.trigger)) continue

      await this.bus.emit({
        id: createMessageId(),
        type: "ceo.alert",
        severity: alert.severity,
        title: alert.title,
        body: alert.body,
        goalId: alert.goalId,
        taskId: alert.taskId,
        insightId: alert.insightId as string | undefined,
        timestamp: new Date(),
      })

      await this.notificationPort.notify(alert)
    }
  }
}
