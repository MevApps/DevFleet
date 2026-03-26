import type { Message, MessageFilter } from "../../entities/Message"

export type HealthStatus = "healthy" | "degraded" | "unhealthy"

export interface PluginIdentity {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly description: string
}

export interface Lifecycle {
  start(): Promise<void>
  stop(): Promise<void>
  healthCheck(): Promise<HealthStatus>
}

export interface PluginMessageHandler {
  subscriptions(): ReadonlyArray<MessageFilter>
  handle(message: Message): Promise<void>
}

export interface DashboardContributor {
  widgets(): ReadonlyArray<DashboardWidget>
}

export interface DashboardWidget {
  readonly id: string
  readonly title: string
  readonly component: string
  readonly data: Record<string, unknown>
}

export interface RegisteredPlugin {
  readonly identity: PluginIdentity
  readonly lifecycle: Lifecycle
  readonly messageHandler?: PluginMessageHandler
}
