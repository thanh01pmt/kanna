/**
 * Pi SDK App Server Manager
 *
 * SDK-first Pi provider for Kanna. This mirrors the HarnessTurn surface used by
 * the CLI bridge, but talks to @earendil-works/pi-coding-agent directly so Kanna
 * is not coupled to Pi's interactive terminal/CLI mode behavior.
 */

import {
  AuthStorage,
  createAgentSession,
  getAgentDir,
  ModelRegistry,
  SessionManager,
  type AgentSession,
  type AgentSessionEvent,
  type CreateAgentSessionOptions,
  type CreateAgentSessionResult,
} from "@earendil-works/pi-coding-agent"
import { randomUUID } from "node:crypto"
import { join } from "node:path"
import type { NormalizedToolCall, PiReasoningEffort, TranscriptEntry } from "@kanna/shared/types"
import { normalizeToolCall } from "@kanna/shared/tools"
import type { HarnessEvent, HarnessToolRequest, HarnessTurn } from "./harness-types"

type CreatePiAgentSession = (options?: CreateAgentSessionOptions) => Promise<CreateAgentSessionResult>
type PiSdkModel = NonNullable<CreateAgentSessionOptions["model"]>

interface ActiveSdkSession {
  chatId: string
  cwd: string
  mcpToolConfigKey: string
  requestedModel: string
  model: string
  effort?: PiReasoningEffort
  session: AgentSession
  unsubscribe: (() => void) | null
  pendingTurn: PendingSdkTurn | null
  closed: boolean
}

interface PendingSdkTurn {
  queue: AsyncQueue<HarnessEvent>
  resolved: boolean
  resultEmitted: boolean
  toolInputs: Map<string, { toolName: string; input: Record<string, unknown> }>
  onToolRequest?: (request: HarnessToolRequest) => Promise<unknown>
}

class AsyncQueue<T> implements AsyncIterable<T> {
  private values: T[] = []
  private resolvers: Array<(value: IteratorResult<T>) => void> = []
  private done = false

  push(value: T) {
    if (this.done) return
    const resolver = this.resolvers.shift()
    if (resolver) {
      resolver({ value, done: false })
      return
    }
    this.values.push(value)
  }

  finish() {
    if (this.done) return
    this.done = true
    while (this.resolvers.length > 0) {
      this.resolvers.shift()?.({ value: undefined as T, done: true })
    }
  }

  [Symbol.asyncIterator](): AsyncIterator<T> {
    return {
      next: () => {
        if (this.values.length > 0) {
          return Promise.resolve({ value: this.values.shift() as T, done: false })
        }
        if (this.done) {
          return Promise.resolve({ value: undefined as T, done: true })
        }
        return new Promise<IteratorResult<T>>((resolve) => {
          this.resolvers.push(resolve)
        })
      },
    }
  }
}

function timestamped<T extends Omit<TranscriptEntry, "_id" | "createdAt">>(
  entry: T,
  createdAt = Date.now()
): TranscriptEntry {
  return {
    _id: randomUUID(),
    createdAt,
    ...entry,
  } as TranscriptEntry
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function piSystemInitEntry(model: string): TranscriptEntry {
  return timestamped({
    kind: "system_init",
    provider: "pi",
    model,
    tools: ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebSearch", "WebFetch", "TodoWrite"],
    agents: [],
    slashCommands: [],
    mcpServers: [],
  })
}

function stringFromUnknown(value: unknown) {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function normalizeSdkToolName(toolName: string) {
  const normalized = toolName.trim()
  const builtIns: Record<string, string> = {
    read: "Read",
    write: "Write",
    edit: "Edit",
    bash: "Bash",
    grep: "Grep",
    glob: "Glob",
    find: "Glob",
    ls: "Glob",
  }
  return builtIns[normalized.toLowerCase()] ?? normalized
}

function normalizeSdkToolInput(toolName: string, input: Record<string, unknown>): Record<string, unknown> {
  const name = normalizeSdkToolName(toolName)
  if (name === "Read" && typeof input.path === "string" && typeof input.file_path !== "string") {
    return { ...input, file_path: input.path }
  }
  if ((name === "Write" || name === "Edit") && typeof input.path === "string" && typeof input.file_path !== "string") {
    return { ...input, file_path: input.path }
  }
  return input
}

export interface StartPiSdkSessionArgs {
  chatId: string
  cwd: string
  model: string
  effort?: PiReasoningEffort
  mcpToolConfigKey?: string
  sessionToken: string | null
}

export interface StartPiSdkTurnArgs {
  chatId: string
  model: string
  effort?: PiReasoningEffort
  content: string
  onToolRequest?: (request: HarnessToolRequest) => Promise<unknown>
}

export class PiSdkAppServerManager {
  private readonly sessions = new Map<string, ActiveSdkSession>()
  private readonly createSession: CreatePiAgentSession
  private readonly agentDir: string
  private readonly authStorage?: AuthStorage
  private modelRegistry?: ModelRegistry

  constructor(args: {
    createSession?: CreatePiAgentSession
    agentDir?: string
    authStorage?: AuthStorage
    modelRegistry?: ModelRegistry
  } = {}) {
    this.createSession = args.createSession ?? createAgentSession
    this.agentDir = args.agentDir ?? getAgentDir()
    this.authStorage = args.authStorage
    this.modelRegistry = args.modelRegistry
  }

  async startSession(args: StartPiSdkSessionArgs): Promise<void> {
    const existing = this.sessions.get(args.chatId)
    const nextMcpToolConfigKey = args.mcpToolConfigKey ?? ""
    if (existing && !existing.closed && existing.cwd === args.cwd && existing.requestedModel === args.model && existing.effort === args.effort && existing.mcpToolConfigKey === nextMcpToolConfigKey) {
      return
    }
    if (existing) {
      this.stopSession(args.chatId)
    }

    const modelRegistry = this.getModelRegistry()
    const resolvedModel = this.resolveModel(args.model, modelRegistry)
    const result = await this.createSession({
      cwd: args.cwd,
      agentDir: this.agentDir,
      modelRegistry,
      ...(resolvedModel ? { model: resolvedModel } : {}),
      sessionManager: args.sessionToken
        ? SessionManager.open(args.sessionToken)
        : SessionManager.create(args.cwd),
      thinkingLevel: args.effort,
    })
    const active: ActiveSdkSession = {
      chatId: args.chatId,
      cwd: args.cwd,
      mcpToolConfigKey: nextMcpToolConfigKey,
      requestedModel: args.model,
      model: resolvedModel ? `${resolvedModel.provider}/${resolvedModel.id}` : args.model,
      effort: args.effort,
      session: result.session,
      unsubscribe: null,
      pendingTurn: null,
      closed: false,
    }
    active.unsubscribe = result.session.subscribe((event) => this.handleEvent(active, event))
    this.sessions.set(args.chatId, active)
  }

  async startTurn(args: StartPiSdkTurnArgs): Promise<HarnessTurn> {
    const session = this.requireSession(args.chatId)
    if (session.pendingTurn) {
      throw new Error("Pi SDK turn is already running")
    }

    const queue = new AsyncQueue<HarnessEvent>()
    queue.push({ type: "transcript", entry: piSystemInitEntry(session.model) })
    const pendingTurn: PendingSdkTurn = {
      queue,
      resolved: false,
      resultEmitted: false,
      toolInputs: new Map(),
      onToolRequest: args.onToolRequest,
    }
    session.pendingTurn = pendingTurn

    try {
      await session.session.prompt(args.content, { source: "interactive" })
    } catch (error) {
      this.failTurn(session, error instanceof Error ? error.message : String(error))
    }

    return {
      provider: "pi",
      stream: queue,
      interrupt: async () => {
        await this.interruptTurn(session)
      },
      close: () => {},
    }
  }

  stopSession(chatId: string) {
    const session = this.sessions.get(chatId)
    if (!session) return
    session.closed = true
    session.unsubscribe?.()
    session.unsubscribe = null
    session.pendingTurn?.queue.finish()
    session.pendingTurn = null
    this.sessions.delete(chatId)
    try {
      session.session.dispose()
    } catch {
      // ignore
    }
  }

  stopAll() {
    for (const chatId of this.sessions.keys()) {
      this.stopSession(chatId)
    }
  }

  private requireSession(chatId: string): ActiveSdkSession {
    const session = this.sessions.get(chatId)
    if (!session || session.closed) {
      throw new Error("Pi SDK session not started")
    }
    return session
  }

  private getModelRegistry() {
    if (!this.modelRegistry) {
      const authStorage = this.authStorage ?? AuthStorage.create(join(this.agentDir, "auth.json"))
      this.modelRegistry = ModelRegistry.create(authStorage, join(this.agentDir, "models.json"))
    } else {
      this.modelRegistry.refresh()
    }
    return this.modelRegistry
  }

  private resolveModel(modelId: string, modelRegistry: ModelRegistry): PiSdkModel | undefined {
    const requested = modelId.trim()
    if (!requested) return undefined

    const slashIndex = requested.indexOf("/")
    if (slashIndex > 0) {
      const provider = requested.slice(0, slashIndex)
      const id = requested.slice(slashIndex + 1)
      const exactProviderModel = modelRegistry.find(provider, id)
      if (exactProviderModel) return exactProviderModel
    }

    const allModels = modelRegistry.getAll()
    const exactMatches = allModels.filter((candidate) => candidate.id === requested || `${candidate.provider}/${candidate.id}` === requested)
    if (exactMatches.length === 1) return exactMatches[0]
    if (exactMatches.length > 1) {
      const preferredProviders = [
        "openai-codex",
        "openai",
        "github-copilot",
        "opencode",
        "azure-openai-responses",
        "cloudflare-ai-gateway",
      ]
      for (const provider of preferredProviders) {
        const preferred = exactMatches.find((candidate) => candidate.provider === provider)
        if (preferred) return preferred
      }
      return exactMatches[0]
    }

    const lower = requested.toLowerCase()
    const fuzzyMatches = allModels.filter((candidate) =>
      candidate.id.toLowerCase().includes(lower)
      || candidate.name.toLowerCase().includes(lower)
      || `${candidate.provider}/${candidate.id}`.toLowerCase().includes(lower)
    )
    return fuzzyMatches[0]
  }

  private handleEvent(session: ActiveSdkSession, event: AgentSessionEvent) {
    const pendingTurn = session.pendingTurn
    if (!pendingTurn || pendingTurn.resolved) return

    const record = asRecord(event)
    const type = record.type
    if (type === "message_update") {
      const assistantMessageEvent = asRecord(record.assistantMessageEvent)
      if (assistantMessageEvent.type === "text_delta" && typeof assistantMessageEvent.delta === "string") {
        pendingTurn.queue.push({
          type: "transcript",
          entry: timestamped({
            kind: "assistant_text",
            text: assistantMessageEvent.delta,
          }),
        })
      }
      return
    }

    if (type === "tool_execution_start") {
      const toolName = typeof record.toolName === "string" ? record.toolName : "UnknownTool"
      const toolId = typeof record.toolCallId === "string" ? record.toolCallId : randomUUID()
      const input = normalizeSdkToolInput(toolName, asRecord(record.args))
      pendingTurn.toolInputs.set(toolId, { toolName, input })
      const tool = normalizeToolCall({
        toolName: normalizeSdkToolName(toolName),
        toolId,
        input,
      })
      pendingTurn.queue.push({
        type: "transcript",
        entry: timestamped({ kind: "tool_call", tool }),
      })
      void this.handlePossiblePermissionRequest(pendingTurn, tool)
      return
    }

    if (type === "tool_execution_end") {
      const toolId = typeof record.toolCallId === "string" ? record.toolCallId : randomUUID()
      pendingTurn.queue.push({
        type: "transcript",
        entry: timestamped({
          kind: "tool_result",
          toolId,
          content: record.result ?? "",
          isError: Boolean(record.isError),
        }),
      })
      return
    }

    if (type === "agent_end") {
      const messages = Array.isArray(record.messages) ? record.messages : []
      const lastAssistant = [...messages].reverse().map(asRecord).find((message) => message.role === "assistant")
      const stopReason = typeof lastAssistant?.stopReason === "string" ? lastAssistant.stopReason : undefined
      const isError = stopReason === "error" || stopReason === "aborted"
      const result = typeof lastAssistant?.errorMessage === "string"
        ? lastAssistant.errorMessage
        : isError
          ? stopReason ?? "Pi SDK run failed"
          : "Pi SDK run finished."
      pendingTurn.queue.push({
        type: "transcript",
        entry: timestamped({
          kind: "result",
          subtype: isError ? "error" : "success",
          isError,
          durationMs: 0,
          result,
        }),
      })
      pendingTurn.resultEmitted = true
      this.finishTurn(session)
    }
  }

  private async handlePossiblePermissionRequest(
    pendingTurn: PendingSdkTurn,
    tool: NormalizedToolCall
  ) {
    if (!pendingTurn.onToolRequest || tool.toolKind !== "cli_permission_request") return
    try {
      await pendingTurn.onToolRequest({ tool: tool as NormalizedToolCall & { toolKind: "cli_permission_request" } })
    } catch {
      // Pi SDK tool execution owns the actual approval path. Kanna only mirrors
      // requests that surface as tool calls here.
    }
  }

  private async interruptTurn(session: ActiveSdkSession) {
    const pendingTurn = session.pendingTurn
    if (!pendingTurn || pendingTurn.resolved) return
    pendingTurn.queue.push({
      type: "transcript",
      entry: timestamped({ kind: "interrupted" }),
    })
    pendingTurn.resolved = true
    pendingTurn.queue.finish()
    session.pendingTurn = null
    try {
      await session.session.abort()
    } catch {
      // ignore
    }
  }

  private finishTurn(session: ActiveSdkSession) {
    const pendingTurn = session.pendingTurn
    if (!pendingTurn || pendingTurn.resolved) return
    if (!pendingTurn.resultEmitted) {
      pendingTurn.queue.push({
        type: "transcript",
        entry: timestamped({
          kind: "result",
          subtype: "success",
          isError: false,
          durationMs: 0,
          result: "Pi SDK run finished.",
        }),
      })
    }
    pendingTurn.resolved = true
    pendingTurn.queue.finish()
    session.pendingTurn = null
  }

  private failTurn(session: ActiveSdkSession, message: string) {
    const pendingTurn = session.pendingTurn
    if (!pendingTurn || pendingTurn.resolved) return
    pendingTurn.queue.push({
      type: "transcript",
      entry: timestamped({
        kind: "result",
        subtype: "error",
        isError: true,
        durationMs: 0,
        result: message,
      }),
    })
    pendingTurn.resolved = true
    pendingTurn.queue.finish()
    session.pendingTurn = null
  }
}
