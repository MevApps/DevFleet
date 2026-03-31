import { spawn, type ChildProcess } from "node:child_process"
import { existsSync } from "node:fs"
import { join, resolve } from "node:path"
import * as http from "node:http"

const POLL_INTERVAL_MS = 500
const POLL_TIMEOUT_MS = 10_000

export class DashboardProcess {
  readonly url: string
  private readonly child: ChildProcess

  private constructor(child: ChildProcess, port: number) {
    this.child = child
    this.url = `http://localhost:${port}`
  }

  static async discover(port: number, rootDir?: string): Promise<DashboardProcess | null> {
    const dir = findDashboardDir(rootDir)
    if (!dir) return null

    const child = spawn("npx", ["next", "dev", "-p", String(port)], {
      cwd: dir,
      stdio: "ignore",
      env: { ...process.env, PORT: String(port) },
    })

    child.on("error", (err) => {
      console.error(`  Dashboard process error: ${err.message}`)
    })

    const instance = new DashboardProcess(child, port)
    await instance.waitUntilReady()
    return instance
  }

  stop(): void {
    this.child.kill()
  }

  private async waitUntilReady(): Promise<void> {
    const deadline = Date.now() + POLL_TIMEOUT_MS

    while (Date.now() < deadline) {
      const ready = await this.probe()
      if (ready) return
      await sleep(POLL_INTERVAL_MS)
    }

    console.log("  Dashboard slow to start — try opening manually")
  }

  private probe(): Promise<boolean> {
    return new Promise((resolve) => {
      const req = http.get(this.url, () => resolve(true))
      req.on("error", () => resolve(false))
      req.setTimeout(POLL_INTERVAL_MS, () => {
        req.destroy()
        resolve(false)
      })
    })
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function findDashboardDir(rootDir?: string): string | null {
  const candidates = rootDir
    ? [join(rootDir, "dashboard")]
    : [
        join(__dirname, "..", "..", "..", "dashboard"),
        join(process.cwd(), "dashboard"),
      ]
  for (const dir of candidates) {
    const resolved = resolve(dir)
    if (existsSync(join(resolved, "package.json"))) return resolved
  }
  return null
}
