import type { CeoAlert, NotificationPort } from "../../use-cases/ports/NotificationPort"

export class NoOpNotificationAdapter implements NotificationPort {
  async notify(_alert: CeoAlert): Promise<void> {
    // V1: alerts delivered via bus → SSE path
  }
}
