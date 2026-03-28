import { NodeShellExecutor } from "@adapters/shell/NodeShellExecutor"

describe("NodeShellExecutor", () => {
  const executor = new NodeShellExecutor(process.cwd())

  it("runs a command with array args and captures stdout", async () => {
    const result = await executor.execute("echo", ["hello", "world"])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe("hello world")
    expect(result.stderr).toBe("")
  })

  it("captures stderr from a command", async () => {
    const result = await executor.execute("sh", ["-c", "echo error-output >&2"])
    expect(result.exitCode).toBe(0)
    expect(result.stderr.trim()).toBe("error-output")
  })

  it("returns non-zero exitCode when command fails", async () => {
    const result = await executor.execute("sh", ["-c", "exit 42"])
    expect(result.exitCode).toBe(42)
  })

  it("returns stdout and stderr on failure", async () => {
    const result = await executor.execute("sh", [
      "-c",
      "echo out-on-fail; echo err-on-fail >&2; exit 1",
    ])
    expect(result.exitCode).toBe(1)
    expect(result.stdout.trim()).toBe("out-on-fail")
    expect(result.stderr.trim()).toBe("err-on-fail")
  })

  it("accepts an optional timeout parameter", async () => {
    const result = await executor.execute("echo", ["timeout-test"], 5_000)
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe("timeout-test")
  })

  it("does not interpret shell metacharacters in args", async () => {
    // With execFile these are passed as literal args, not interpreted by a shell
    const result = await executor.execute("echo", ["$HOME", ";", "rm"])
    expect(result.exitCode).toBe(0)
    expect(result.stdout.trim()).toBe("$HOME ; rm")
  })
})
