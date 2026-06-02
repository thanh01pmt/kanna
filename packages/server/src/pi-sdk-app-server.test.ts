import { describe, expect, test } from "bun:test"
import { PiSdkAppServerManager } from "./pi-sdk-app-server"

class FakePiSdkSession {
  private listeners: Array<(event: any) => void> = []
  readonly prompts: string[] = []
  aborted = false
  disposed = false

  subscribe(listener: (event: any) => void) {
    this.listeners.push(listener)
    return () => {
      this.listeners = this.listeners.filter((entry) => entry !== listener)
    }
  }

  async prompt(text: string) {
    this.prompts.push(text)
    this.emit({
      type: "message_update",
      assistantMessageEvent: {
        type: "text_delta",
        delta: "Creating smoke artifact.",
      },
    })
    this.emit({
      type: "tool_execution_start",
      toolName: "write",
      toolCallId: "sdk-write-1",
      args: {
        path: "smoke/pi-workflow-smoke.md",
        content: "# SDK smoke\n",
      },
    })
    this.emit({
      type: "tool_execution_end",
      toolCallId: "sdk-write-1",
      result: "ok",
      isError: false,
    })
    this.emit({
      type: "agent_end",
      messages: [{
        role: "assistant",
        content: [{ type: "text", text: "Done." }],
      }],
    })
  }

  async abort() {
    this.aborted = true
  }

  dispose() {
    this.disposed = true
  }

  private emit(event: any) {
    for (const listener of this.listeners) {
      listener(event)
    }
  }
}

async function collectStream(stream: AsyncIterable<any>) {
  const items: any[] = []
  for await (const item of stream) {
    items.push(item)
  }
  return items
}

describe("PiSdkAppServerManager", () => {
  test("maps SDK events into Kanna harness transcript entries", async () => {
    const fakeSession = new FakePiSdkSession()
    const createCalls: any[] = []
    const manager = new PiSdkAppServerManager({
      createSession: async (options) => {
        createCalls.push(options)
        return {
          session: fakeSession as never,
          extensionsResult: {} as never,
        }
      },
    })

    await manager.startSession({
      chatId: "chat-1",
      cwd: "/tmp/project",
      model: "gpt-5.5",
      effort: "high",
      sessionToken: null,
    })
    const turn = await manager.startTurn({
      chatId: "chat-1",
      model: "gpt-5.5",
      effort: "high",
      content: "Run SDK smoke.",
    })

    const events = await collectStream(turn.stream)
    expect(createCalls[0]).toMatchObject({
      cwd: "/tmp/project",
      thinkingLevel: "high",
    })
    expect(fakeSession.prompts).toEqual(["Run SDK smoke."])
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
    expect(result.subtype).toBe("success")
  })

  test("interrupt aborts the SDK session and closes the active stream", async () => {
    const fakeSession = new FakePiSdkSession()
    fakeSession.prompt = async (text: string) => {
      fakeSession.prompts.push(text)
    }
    const manager = new PiSdkAppServerManager({
      createSession: async () => ({
        session: fakeSession as never,
        extensionsResult: {} as never,
      }),
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
      content: "Wait.",
    })

    const collected = collectStream(turn.stream)
    await turn.interrupt()
    const events = await collected

    expect(fakeSession.aborted).toBe(true)
    expect(events.map((event) => event.entry?.kind)).toEqual(["system_init", "interrupted"])
  })
})
