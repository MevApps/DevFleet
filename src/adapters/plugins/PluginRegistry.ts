import type { PluginIdentity, Lifecycle, PluginMessageHandler, RegisteredPlugin } from "../../use-cases/ports/PluginInterfaces"
import type { MessagePort, Unsubscribe } from "../../use-cases/ports/MessagePort"

interface FullPlugin {
  readonly identity: PluginIdentity
  readonly lifecycle: Lifecycle
  readonly messageHandler?: PluginMessageHandler
  readonly unsubscribes: Unsubscribe[]
}

export class PluginRegistry {
  private readonly plugins = new Map<string, FullPlugin>()

  constructor(private readonly bus: MessagePort) {}

  register(plugin: RegisteredPlugin): void {
    const { identity, lifecycle, messageHandler } = plugin

    const unsubscribes: Unsubscribe[] = []

    if (messageHandler) {
      for (const filter of messageHandler.subscriptions()) {
        const unsub = this.bus.subscribe(filter, msg => messageHandler.handle(msg))
        unsubscribes.push(unsub)
      }
    }

    this.plugins.set(identity.id, { identity, lifecycle, messageHandler, unsubscribes })
  }

  deregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId)
    if (!plugin) return

    for (const unsub of plugin.unsubscribes) {
      unsub()
    }
    void plugin.lifecycle.stop()
    this.plugins.delete(pluginId)
  }

  discover(): ReadonlyArray<RegisteredPlugin> {
    return Array.from(this.plugins.values()).map(p => ({
      identity: p.identity,
      lifecycle: p.lifecycle,
      messageHandler: p.messageHandler,
    }))
  }

  async startAll(): Promise<void> {
    await Promise.all(
      Array.from(this.plugins.values()).map(p => p.lifecycle.start()),
    )
  }

  async stopAll(): Promise<void> {
    await Promise.all(
      Array.from(this.plugins.values()).map(p => p.lifecycle.stop()),
    )
  }
}
