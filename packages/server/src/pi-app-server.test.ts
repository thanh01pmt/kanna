import { describe, expect, test } from "bun:test"
import { EventEmitter } from "node:events"
import { PassThrough } from "node:stream"
import { PiAppServerManager } from "./pi-app-server"

class FakePiProcess extends EventEmitter {
  readonly stdin = new PassThrough()
  readonly stdout = new PassThrough()
  readonly stderr = new PassThrough()
  readonly stdinLines: string[] = []
  killed = false

  constructor() {
    super()
    let buffer = ""
    this.stdin.on("data", (chunk) => {
      buffer += chunk.toString()
      const lines = buffer.split("\n")
      buffer = lines.pop() ?? ""
      for (const line of lines) {
        this.stdinLines.push(line)
      }
    })
  }

  kill() {
    this.killed = true
    this.emit("close", 0)
  }

  writeJsonLine(message: unknown) {
    this.stdout.write(`${JSON.stringify(message)}\n`)
  }

  writeRawLine(message: string, stream: "stdout" | "stderr" = "stdout") {
    this[stream].write(`${message}\n`)
  }

  closeWithCode(code: number) {
    this.emit("close", code)
  }
}

async function collectStream(stream: AsyncIterable<any>) {
  const items: any[] = []
  for await (const item of stream) {
    items.push(item)
  }
  return items
}

describe("PiAppServerManager", () => {
  test("streams Pi JSONL tool calls and results into Kanna transcript events", async () => {
    const process = new FakePiProcess()
    let spawnedCwd = ""
    let spawnedArgs: string[] = []
    const manager = new PiAppServerManager({
      spawnProcess: (cwd, args) => {
        spawnedCwd = cwd
        spawnedArgs = args
        return process as never
      },
    })

    await manager.startSession({
      chatId: "chat-1",
      cwd: "/tmp/project",
      model: "gpt-5.5",
      effort: "high",
      sessionToken: "pi-session-1",
    })
    const turn = await manager.startTurn({
      chatId: "chat-1",
      model: "gpt-5.5",
      effort: "high",
      content: "Run the smoke workflow.",
    })
    const collected = collectStream(turn.stream)

    process.writeJsonLine({ type: "text", text: "Creating the smoke artifact." })
    process.writeJsonLine({
      type: "tool_call",
      id: "tool-write-1",
      name: "Write",
      input: {
        file_path: "smoke/pi-workflow-smoke.md",
        content: "# Pi smoke\n",
      },
    })
    process.writeJsonLine({
      type: "tool_result",
      tool_use_id: "tool-write-1",
      content: "ok",
      is_error: false,
    })
    await new Promise((resolve) => setTimeout(resolve, 20))
    process.writeJsonLine({
      type: "result",
      subtype: "success",
      duration_ms: 42,
      text: "Smoke workflow complete.",
      cost_usd: 0.01,
    })
    process.closeWithCode(0)

    const events = await collected
    expect(spawnedCwd).toBe("/tmp/project")
    expect(spawnedArgs).toEqual([
      "--mode",
      "json",
      "--print",
      "--no-session",
      "--model",
      "gpt-5.5",
      "--thinking",
      "high",
      "--session-id",
      "pi-session-1",
      "Run the smoke workflow.",
    ])
    expect(events.map((event) => event.entry?.kind)).toEqual([
      "system_init",
      "assistant_text",
      "tool_call",
      "tool_result",
      "result",
    ])
    const toolCall = events.find((event) => event.entry?.kind === "tool_call")?.entry
    expect(toolCall.tool.toolKind).toBe("write_file")
    expect(toolCall.tool.input.filePath).toBe("smoke/pi-workflow-smoke.md")
    const result = events.at(-1)?.entry
    expect(result.result).toBe("Smoke workflow complete.")
    expect(result.costUsd).toBe(0.01)
  })

  test("turns raw Pi permission prompts into a cli permission tool request", async () => {
    const process = new FakePiProcess()
    const manager = new PiAppServerManager({
      spawnProcess: () => process as never,
    })

    await manager.startSession({
      chatId: "chat-1",
      cwd: "/tmp/project",
      model: "gpt-5.5",
      sessionToken: null,
    })
    const turn = await manager.startTurn({
      chatId: "chat-1",
      model: "gpt-5.5",
      content: "Run tests.",
      onToolRequest: async (request) => {
        expect(request.tool.toolKind).toBe("cli_permission_request")
        if (request.tool.toolKind !== "cli_permission_request") {
          throw new Error("unexpected tool request")
        }
        expect(request.tool.input.provider).toBe("pi")
        expect(request.tool.input.command).toBe("pnpm test")
        return { choice: "1" }
      },
    })
    const collected = collectStream(turn.stream)

    process.writeRawLine("requesting permission for: pnpm test", "stderr")
    process.writeRawLine("Do you want to proceed?", "stderr")
    process.writeRawLine("> 1. Yes", "stderr")
    await new Promise((resolve) => setTimeout(resolve, 20))
    process.writeJsonLine({
      type: "result",
      subtype: "success",
      duration_ms: 1,
      text: "Tests passed.",
    })
    process.closeWithCode(0)

    const events = await collected
    expect(process.stdinLines).toContain("1")
    const permission = events.find((event) => event.entry?.kind === "tool_call")?.entry
    expect(permission.tool.toolKind).toBe("cli_permission_request")
  })
})
