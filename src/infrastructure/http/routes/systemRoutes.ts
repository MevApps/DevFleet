import { Router } from "express"
import type { PluginRegistry } from "../../../adapters/plugins/PluginRegistry"

export function systemRoutes(pluginRegistry: PluginRegistry): Router {
  const router = Router()

  router.get("/health", async (_req, res, next) => {
    try {
      const plugins = pluginRegistry.discover()
      const results = await Promise.all(
        plugins.map(async (p) => ({
          name: p.identity.name,
          status: await p.lifecycle.healthCheck(),
        })),
      )
      res.json(results)
    } catch (err) { next(err) }
  })

  return router
}
