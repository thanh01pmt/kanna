/**
 * Pi App Server Manager
 *
 * Integrates the Pi CLI (`pi`) as a Kanna AgentProvider.
 * Architecture mirrors AntigravityAppServerManager — the CLI is spawned as a child
 * process and communicates via newline-delimited JSON on stdin/stdout.
 */

import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import { createInterface } from "node:readline"
import type { Readable, Writable } from "node:stream"
import type { NormalizedToolCall, PiReasoningEffort, TranscriptEntry } from "@kanna/shared/types"
import { normalizeToolCall } from "@kanna/shared/tools"
import type { HarnessEvent, HarnessToolRequest, HarnessTurn } from "./harness-types"

// ─── Child-process abstraction (injectable for tests) ───────────────────────

interface PiProcess {
  stdin: Writable
  stdout: Readable
  stderr: Readable
  killed?: boolean
  kill(signal?: NodeJS.Signals | number): void
  on(event: "close", listener: (code: number | null) => void): this
  on(event: "error", listener: (error: Error) => void): this
}

type SpawnPi = (cwd: string, args: string[]) => PiProcess

// ─── Internal state ──────────────────────────────────────────────────────────

interface ActiveSession {
  chatId: string
  cwd: string
  child: PiProcess | null
  model: string
  effort?: PiReasoningEffort
  sessionToken: string | null
  pendingTurn: PendingPiTurn | null
  stderrLines: string[]
  rawLines: string[]
  closed: boolean
}

interface PendingPiTurn {
  queue: AsyncQueue<HarnessEvent>
  resolved: boolean
  permissionInFlight: boolean
  onToolRequest?: (request: HarnessToolRequest) => Promise<unknown>
}

// ─── Async queue ────────────────────────────────────────────────────────────

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
      const resolver = this.resolvers.shift()
      resolver?.({ value: undefined as T, done: true })
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function piSystemInitEntry(model: string): TranscriptEntry {
  return timestamped({
    kind: "system_init",
    provider: "pi",
    model,
    tools: ["Bash", "Read", "Write", "Edit", "WebSearch", "WebFetch", "Glob", "Grep", "TodoWrite"],
    agents: [],
    slashCommands: [],
    mcpServers: [],
  })
}

function parseJsonLine(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null
    return parsed as Record<string, unknown>
  } catch {
    return null
  }
}

function stripAnsi(value: string) {
  return value.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, "")
}

function detectPermissionRequest(
  provider: "antigravity" | "pi",
  rawLines: string[]
): { provider: "antigravity" | "pi"; command: string; prompt: string; options: Array<{ value: string; label: string }> } | null {
  const lines = rawLines.map(stripAnsi)
  const commandLine = [...lines].reverse().find((candidate) =>
    /requesting permission for:/i.test(candidate)
  )
  const hasPrompt = lines.some((candidate) => /do you want to proceed\?/i.test(candidate))
  if (!commandLine || !hasPrompt) return null

  const command = commandLine.replace(/^.*?requesting permission for:\s*/i, "").trim()
  const parsedOptions = lines
    .map((candidate) => candidate.match(/^\s*>?\s*(\d+)\.\s+(.+?)\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ value: match[1], label: match[2].trim() }))

  const options = parsedOptions.length > 0
    ? parsedOptions
    : [
        { value: "1", label: "Yes" },
        { value: "2", label: "Yes, and always allow in this conversation" },
        { value: "3", label: "Yes, and always allow for matching commands" },
        { value: "4", label: "No" },
      ]

  return {
    provider,
    command,
    prompt: lines.join("\n"),
    options,
  }
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface StartPiSessionArgs {
  chatId: string
  cwd: string
  model: string
  effort?: PiReasoningEffort
  sessionToken: string | null
}

export interface StartPiTurnArgs {
  chatId: string
  model: string
  effort?: PiReasoningEffort
  content: string
  onToolRequest?: (request: HarnessToolRequest) => Promise<unknown>
}

// ─── Manager ─────────────────────────────────────────────────────────────────

export class PiAppServerManager {
  private readonly sessions = new Map<string, ActiveSession>()
  private readonly spawnProcess: SpawnPi

  constructor(args: { spawnProcess?: SpawnPi } = {}) {
    this.spawnProcess = args.spawnProcess ?? ((cwd, cliArgs) =>
      spawn("pi", cliArgs, {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
      }) as unknown as PiProcess
    )
  }

  // ── Session lifecycle ─────────────────────────────────────────────────────

  async startSession(args: StartPiSessionArgs): Promise<void> {
    const existing = this.sessions.get(args.chatId)
    if (existing && !existing.closed && existing.cwd === args.cwd) {
      return
    }
    if (existing) {
      this.stopSession(args.chatId)
    }

    const session: ActiveSession = {
      chatId: args.chatId,
      cwd: args.cwd,
      child: null,
      model: args.model,
      effort: args.effort,
      sessionToken: args.sessionToken,
      pendingTurn: null,
      stderrLines: [],
      rawLines: [],
      closed: false,
    }
    this.sessions.set(args.chatId, session)
  }

  // ── Turn ─────────────────────────────────────────────────────────────────

  async startTurn(args: StartPiTurnArgs): Promise<HarnessTurn> {
    const session = this.requireSession(args.chatId)

    if (session.pendingTurn) {
      throw new Error("Pi turn is already running")
    }

    const queue = new AsyncQueue<HarnessEvent>()
    queue.push({ type: "transcript", entry: piSystemInitEntry(args.model) })

    const pendingTurn: PendingPiTurn = { queue, resolved: false, permissionInFlight: false, onToolRequest: args.onToolRequest }
    session.pendingTurn = pendingTurn

    const cliArgs = [
      "--mode", "json",
      "--print",
      "--no-session",
      "--model", session.model,
    ]
    if (session.effort) {
      cliArgs.push("--thinking", session.effort)
    }
    if (session.sessionToken) {
      cliArgs.push("--session-id", session.sessionToken)
    }
    cliArgs.push(args.content)

    session.child = this.spawnProcess(session.cwd, cliArgs)
    this.attachListeners(session)

    return {
      provider: "pi",
      stream: queue,
      interrupt: async () => {
        if (!session.pendingTurn) return
        session.pendingTurn.resolved = true
        session.pendingTurn.queue.finish()
        session.pendingTurn = null
        try {
          session.child?.kill("SIGINT")
        } catch {
          // ignore
        }
      },
      close: () => {},
    }
  }

  stopSession(chatId: string) {
    const session = this.sessions.get(chatId)
    if (!session) return
    session.closed = true
    session.pendingTurn?.queue.finish()
    this.sessions.delete(chatId)
    try {
      session.child?.kill("SIGKILL")
    } catch {
      // ignore
    }
  }

  stopAll() {
    for (const chatId of this.sessions.keys()) {
      this.stopSession(chatId)
    }
  }

  // ── Private ───────────────────────────────────────────────────────────────

  private requireSession(chatId: string): ActiveSession {
    const session = this.sessions.get(chatId)
    if (!session || session.closed) {
      throw new Error("Pi session not started")
    }
    return session
  }

  private attachListeners(session: ActiveSession) {
    const child = session.child
    if (!child) return
    const lines = createInterface({ input: child.stdout })

    void (async () => {
      for await (const line of lines) {
        const record = parseJsonLine(line)
        if (!record) {
          void this.handleRawLine(session, line)
          continue
        }
        this.handleLine(session, record)
      }
    })()

    const stderr = createInterface({ input: child.stderr })
    void (async () => {
      for await (const line of stderr) {
        if (line.trim()) {
          session.stderrLines.push(line.trim())
          void this.handleRawLine(session, line)
        }
      }
    })()

    child.on("error", (error) => {
      this.failSession(session, error.message)
    })

    child.on("close", (code) => {
      if (session.closed) return
      queueMicrotask(() => {
        if (session.closed) return
        if (code === 0) {
          this.finishSession(session)
          return
        }
        const message = session.stderrLines.at(-1) || session.rawLines.join("\n") || `pi exited with code ${code ?? 1}`
        this.failSession(session, message)
      })
    })
  }

  private handleLine(session: ActiveSession, record: Record<string, unknown>) {
    const pendingTurn = session.pendingTurn
    if (!pendingTurn || pendingTurn.resolved) return

    const type = record.type

    if (type === "text" && typeof record.text === "string") {
      pendingTurn.queue.push({
        type: "transcript",
        entry: timestamped({
          kind: "assistant_text",
          text: record.text,
        }),
      })
      return
    }

    if (type === "tool_call") {
      const toolName = typeof record.name === "string" ? record.name : "UnknownTool"
      const toolId = typeof record.id === "string" ? record.id : randomUUID()
      const rawInput = (record.input && typeof record.input === "object" && !Array.isArray(record.input))
        ? record.input as Record<string, unknown>
        : {}

      const tool = normalizeToolCall({ toolName, toolId, input: rawInput })
      pendingTurn.queue.push({
        type: "transcript",
        entry: timestamped({ kind: "tool_call", tool }),
      })
      return
    }

    if (type === "tool_result") {
      const toolId = typeof record.tool_use_id === "string" ? record.tool_use_id : randomUUID()
      const isError = Boolean(record.is_error)
      pendingTurn.queue.push({
        type: "transcript",
        entry: timestamped({
          kind: "tool_result",
          toolId,
          content: record.content ?? "",
          isError,
        }),
      })
      return
    }

    if (type === "result") {
      const subtype = record.subtype === "error" ? "error" : "success"
      const durationMs = typeof record.duration_ms === "number" ? record.duration_ms : 0
      const resultText = typeof record.text === "string" ? record.text : ""
      const costUsd = typeof record.cost_usd === "number" ? record.cost_usd : undefined

      pendingTurn.queue.push({
        type: "transcript",
        entry: timestamped({
          kind: "result",
          subtype,
          isError: subtype === "error",
          durationMs,
          result: resultText,
          costUsd,
        }),
      })

      pendingTurn.resolved = true
      pendingTurn.queue.finish()
      session.pendingTurn = null
      return
    }

    if (type === "error") {
      const message = typeof record.message === "string" ? record.message : "Pi error"
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

  private async handleRawLine(session: ActiveSession, line: string) {
    const pendingTurn = session.pendingTurn
    if (!pendingTurn || pendingTurn.resolved || pendingTurn.permissionInFlight) return

    const trimmed = line.trim()
    if (!trimmed) return
    session.rawLines.push(trimmed)
    session.rawLines = session.rawLines.slice(-24)

    const permission = detectPermissionRequest("pi", session.rawLines)
    if (!permission || !pendingTurn.onToolRequest) return

    pendingTurn.permissionInFlight = true
    const tool = normalizeToolCall({
      toolName: "CliPermissionRequest",
      toolId: randomUUID(),
      input: permission,
    }) as NormalizedToolCall & { toolKind: "cli_permission_request" }

    pendingTurn.queue.push({
      type: "transcript",
      entry: timestamped({ kind: "tool_call", tool }),
    })

    try {
      const result = await pendingTurn.onToolRequest({ tool })
      const record = result && typeof result === "object" && !Array.isArray(result)
        ? result as Record<string, unknown>
        : {}
      const choice = typeof record.choice === "string" ? record.choice : "4"
      session.child?.stdin.write(`${choice}\n`)
    } catch {
      session.child?.stdin.write("4\n")
    } finally {
      session.rawLines = []
      pendingTurn.permissionInFlight = false
    }
  }

  private finishSession(session: ActiveSession) {
    const pendingTurn = session.pendingTurn
    if (pendingTurn && !pendingTurn.resolved) {
      const text = session.rawLines.join("\n").trim()
      if (text) {
        pendingTurn.queue.push({
          type: "transcript",
          entry: timestamped({
            kind: "assistant_text",
            text,
          }),
        })
      }
      pendingTurn.queue.push({
        type: "transcript",
        entry: timestamped({
          kind: "result",
          subtype: "success",
          isError: false,
          durationMs: 0,
          result: text,
        }),
      })
      pendingTurn.resolved = true
      pendingTurn.queue.finish()
    }
    session.pendingTurn = null
    session.closed = true
    this.sessions.delete(session.chatId)
  }

  private failSession(session: ActiveSession, message: string) {
    const pendingTurn = session.pendingTurn
    if (pendingTurn && !pendingTurn.resolved) {
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
    }
    session.pendingTurn = null
    session.closed = true
    this.sessions.delete(session.chatId)
  }
}
