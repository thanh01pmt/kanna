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
    const fakeModel = {
      provider: "openai-codex",
      id: "gpt-5.5",
      name: "GPT-5.5",
    }
    const createCalls: any[] = []
    const manager = new PiSdkAppServerManager({
      modelRegistry: {
        refresh: () => {},
        getAll: () => [fakeModel],
        find: (provider: string, modelId: string) =>
          provider === fakeModel.provider && modelId === fakeModel.id ? fakeModel : undefined,
      } as never,
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
      model: fakeModel,
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
      modelRegistry: {
        refresh: () => {},
        getAll: () => [],
        find: () => undefined,
      } as never,
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

  test("applies skillsOverride and extensionsOverride based on .mcp.json", async () => {
    const { mkdtemp, writeFile, rm } = await import("node:fs/promises")
    const { tmpdir } = await import("node:os")
    const { join } = await import("node:path")

    // Case 1: skills disabled, specific mcp tool disabled
    const tempDir1 = await mkdtemp(join(tmpdir(), "kanna-pi-test-1-"))
    try {
      const mcpConfig = {
        tools: {
          "researcher-mcp": {
            "research_source": false,
          },
        },
        capabilities: {
          skills: false,
          mcp: true,
        },
      }
      await writeFile(join(tempDir1, ".mcp.json"), JSON.stringify(mcpConfig))

      const createCalls: any[] = []
      const manager = new PiSdkAppServerManager({
        modelRegistry: {
          refresh: () => {},
          getAll: () => [],
          find: () => undefined,
        } as never,
        createSession: async (options) => {
          createCalls.push(options)
          return {
            session: new FakePiSdkSession() as never,
            extensionsResult: {} as never,
          }
        },
      })

      await manager.startSession({
        chatId: "chat-test-mcp-1",
        cwd: tempDir1,
        model: "gpt-5.5",
        sessionToken: null,
      })

      expect(createCalls.length).toBe(1)
      const loader = createCalls[0].resourceLoader
      expect(loader).toBeDefined()

      // Test skillsOverride when skills are disabled
      const mockSkillsBase = {
        skills: [{ filePath: "skills/test.js" }],
        diagnostics: [],
      }
      const overriddenSkills = loader.skillsOverride(mockSkillsBase)
      expect(overriddenSkills.skills).toEqual([])

      // Test extensionsOverride when specific tool is disabled
      const mockExtensionsBase = {
        extensions: [
          {
            path: "node_modules/pi-mcp-adapter",
            resolvedPath: "node_modules/pi-mcp-adapter",
            tools: new Map([
              ["researcher_mcp_research_source", {} as any],
              ["researcher_mcp_research_evidence", {} as any],
            ]),
          },
        ],
        errors: [],
        runtime: {} as any,
      }
      const overriddenExtensions = loader.extensionsOverride(mockExtensionsBase)
      const toolsMap = overriddenExtensions.extensions[0].tools
      expect(toolsMap.has("researcher_mcp_research_source")).toBe(false)
      expect(toolsMap.has("researcher_mcp_research_evidence")).toBe(true)
    } finally {
      await rm(tempDir1, { recursive: true, force: true })
    }

    // Case 2: mcp disabled entirely
    const tempDir2 = await mkdtemp(join(tmpdir(), "kanna-pi-test-2-"))
    try {
      const mcpConfig = {
        capabilities: {
          skills: true,
          mcp: false,
        },
      }
      await writeFile(join(tempDir2, ".mcp.json"), JSON.stringify(mcpConfig))

      const createCalls: any[] = []
      const manager = new PiSdkAppServerManager({
        modelRegistry: {
          refresh: () => {},
          getAll: () => [],
          find: () => undefined,
        } as never,
        createSession: async (options) => {
          createCalls.push(options)
          return {
            session: new FakePiSdkSession() as never,
            extensionsResult: {} as never,
          }
        },
      })

      await manager.startSession({
        chatId: "chat-test-mcp-2",
        cwd: tempDir2,
        model: "gpt-5.5",
        sessionToken: null,
      })

      expect(createCalls.length).toBe(1)
      const loader = createCalls[0].resourceLoader

      // Test skillsOverride when skills are enabled
      const mockSkillsBase = {
        skills: [{ filePath: "skills/test.js" }],
        diagnostics: [],
      }
      const overriddenSkills = loader.skillsOverride(mockSkillsBase)
      expect(overriddenSkills.skills.length).toBe(1)

      // Test extensionsOverride when mcp is disabled entirely
      const mockExtensionsBase = {
        extensions: [
          {
            path: "node_modules/pi-mcp-adapter",
            resolvedPath: "node_modules/pi-mcp-adapter",
            tools: new Map([
              ["researcher_mcp_research_source", {} as any],
            ]),
          },
        ],
        errors: [],
        runtime: {} as any,
      }
      const overriddenExtensions = loader.extensionsOverride(mockExtensionsBase)
      const toolsMap = overriddenExtensions.extensions[0].tools
      expect(toolsMap.size).toBe(0)
    } finally {
      await rm(tempDir2, { recursive: true, force: true })
    }
  })
})
