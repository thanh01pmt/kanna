/**
 * Antigravity App Server Manager
 *
 * Integrates Antigravity as a Kanna AgentProvider.
 *
 * Default transport is the Antigravity CLI (`agy --print`), which returns raw
 * text and may print interactive permission prompts. Set
 * `KANNA_ANTIGRAVITY_TRANSPORT=sdk` to route turns through the Python SDK
 * bridge, which normalizes SDK streaming into the same newline-delimited JSON
 * records consumed below.
 *
 * Normalized streaming output format (one JSON object per line):
 *   { type: "text",       text: string }              → assistant_text
 *   { type: "thought",    text: string }              → (internal, skipped)
 *   { type: "tool_call",  name: string, id: string, input: object } → tool_call
 *   { type: "tool_result",tool_use_id: string, content: unknown }   → tool_result
 *   { type: "result",     subtype: "success"|"error", text: string, duration_ms: number }
 *   { type: "error",      message: string }
 */

import { spawn } from "node:child_process"
import { randomUUID } from "node:crypto"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { createInterface } from "node:readline"
import type { Readable, Writable } from "node:stream"
import type { AntigravityReasoningEffort, NormalizedToolCall, TranscriptEntry } from "@kanna/shared/types"
import { normalizeToolCall } from "@kanna/shared/tools"
import type { HarnessEvent, HarnessToolRequest, HarnessTurn } from "./harness-types"

// ─── Child-process abstraction (injectable for tests) ───────────────────────

interface AntigravityProcess {
  stdin: Writable
  stdout: Readable
  stderr: Readable
  killed?: boolean
  kill(signal?: NodeJS.Signals | number): void
  on(event: "close", listener: (code: number | null) => void): this
  on(event: "error", listener: (error: Error) => void): this
}

type SpawnAntigravity = (cwd: string, args: string[]) => AntigravityProcess

const MODULE_DIR = path.dirname(fileURLToPath(import.meta.url))
const SDK_BRIDGE_PATH = path.join(MODULE_DIR, "antigravity-sdk-bridge.py")

// ─── Internal state ──────────────────────────────────────────────────────────

interface ActiveSession {
  chatId: string
  cwd: string
  child: AntigravityProcess | null
  model: string
  effort?: AntigravityReasoningEffort
  sessionToken: string | null
  geminiApiKey?: string
  pendingTurn: PendingAgyTurn | null
  stderrLines: string[]
  rawLines: string[]
  rawText: string
  hardTimeoutTimer: NodeJS.Timeout | null
  closed: boolean
}

interface PendingAgyTurn {
  queue: AsyncQueue<HarnessEvent>
  resolved: boolean
  permissionInFlight: boolean
  onToolRequest?: (request: HarnessToolRequest) => Promise<unknown>
}

// ─── Async queue (same pattern as Codex adapter) ────────────────────────────

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

function antigravitySystemInitEntry(model: string): TranscriptEntry {
  return timestamped({
    kind: "system_init",
    provider: "antigravity",
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

function parseDurationMs(value: string | undefined, fallbackMs: number): number {
  if (!value) return fallbackMs
  const match = value.trim().match(/^(\d+)(ms|s|m|h)?$/i)
  if (!match) return fallbackMs
  const amount = Number(match[1])
  if (!Number.isFinite(amount)) return fallbackMs
  const unit = (match[2] ?? "s").toLowerCase()
  if (unit === "ms") return amount
  if (unit === "m") return amount * 60_000
  if (unit === "h") return amount * 60 * 60_000
  return amount * 1000
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface StartAntigravitySessionArgs {
  chatId: string
  cwd: string
  model: string
  effort?: AntigravityReasoningEffort
  sessionToken: string | null
  geminiApiKey?: string
}

export interface StartAntigravityTurnArgs {
  chatId: string
  model: string
  effort?: AntigravityReasoningEffort
  content: string
  onToolRequest?: (request: HarnessToolRequest) => Promise<unknown>
}

// ─── Manager ─────────────────────────────────────────────────────────────────

export class AntigravityAppServerManager {
  private readonly sessions = new Map<string, ActiveSession>()
  private readonly spawnProcess: SpawnAntigravity

  constructor(args: { spawnProcess?: SpawnAntigravity } = {}) {
    this.spawnProcess = args.spawnProcess ?? ((cwd, cliArgs) => {
      const useSdkBridge = process.env.KANNA_ANTIGRAVITY_TRANSPORT === "sdk"
      const command = useSdkBridge ? (process.env.KANNA_ANTIGRAVITY_PYTHON ?? "python3") : "agy"
      const args = useSdkBridge ? [SDK_BRIDGE_PATH, ...cliArgs] : cliArgs
      return spawn(command, args, {
        cwd,
        stdio: ["pipe", "pipe", "pipe"],
        env: process.env,
      }) as unknown as AntigravityProcess
    })
  }

  // ── Session lifecycle ─────────────────────────────────────────────────────

  async startSession(args: StartAntigravitySessionArgs): Promise<void> {
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
      geminiApiKey: args.geminiApiKey,
      pendingTurn: null,
      stderrLines: [],
      rawLines: [],
      rawText: "",
      hardTimeoutTimer: null,
      closed: false,
    }
    this.sessions.set(args.chatId, session)
  }

  // ── Turn ─────────────────────────────────────────────────────────────────

  async startTurn(args: StartAntigravityTurnArgs): Promise<HarnessTurn> {
    const session = this.requireSession(args.chatId)

    if (session.pendingTurn) {
      throw new Error("Antigravity turn is already running")
    }

    const queue = new AsyncQueue<HarnessEvent>()
    queue.push({ type: "transcript", entry: antigravitySystemInitEntry(args.model) })

    const pendingTurn: PendingAgyTurn = { queue, resolved: false, permissionInFlight: false, onToolRequest: args.onToolRequest }
    session.pendingTurn = pendingTurn

    const cliArgs = process.env.KANNA_ANTIGRAVITY_TRANSPORT === "sdk"
      ? [
          "--model", args.model,
          "--prompt", args.content,
        ]
      : [
          "--print",
          "--print-timeout", process.env.KANNA_ANTIGRAVITY_PRINT_TIMEOUT ?? "5m",
        ]
    if (
      process.env.KANNA_ANTIGRAVITY_TRANSPORT !== "sdk"
      && process.env.KANNA_ANTIGRAVITY_SKIP_PERMISSIONS === "1"
    ) {
      cliArgs.push("--dangerously-skip-permissions")
    }
    if (process.env.KANNA_ANTIGRAVITY_TRANSPORT === "sdk" && args.effort) {
      cliArgs.push("--effort", args.effort)
    }
    if (session.sessionToken && process.env.KANNA_ANTIGRAVITY_TRANSPORT !== "sdk") {
      cliArgs.push("--conversation", session.sessionToken)
    }
    if (process.env.KANNA_ANTIGRAVITY_TRANSPORT !== "sdk") {
      cliArgs.push(args.content)
    }

    session.child = this.spawnProcess(session.cwd, cliArgs)
    this.attachListeners(session)
    this.scheduleHardTimeout(session)

    return {
      provider: "antigravity",
      stream: queue,
      interrupt: async () => {
        if (!session.pendingTurn) return
        session.pendingTurn.resolved = true
        session.pendingTurn.queue.finish()
        session.pendingTurn = null
        // Send SIGINT to the agy process to cancel the current turn gracefully
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
    this.clearHardTimeoutTimer(session)
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
      throw new Error("Antigravity session not started")
    }
    return session
  }

  private attachListeners(session: ActiveSession) {
    const child = session.child
    if (!child) return
    let stdoutBuffer = ""
    child.stdout.on("data", (chunk: Buffer | string) => {
      stdoutBuffer += chunk.toString()
      stdoutBuffer = this.handleRawChunkBuffer(session, stdoutBuffer, "stdout")
    })

    const stderr = createInterface({ input: child.stderr })
    void (async () => {
      for await (const line of stderr) {
        if (line.trim()) {
          session.stderrLines.push(line.trim())
          void this.handleRawOutput(session, line, "stderr")
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
        const trailing = stdoutBuffer.trim()
        if (trailing) {
          const record = parseJsonLine(trailing)
          if (record) {
            this.handleLine(session, record)
          } else {
            this.handleRawOutput(session, trailing, "stdout")
          }
        }
        if (code === 0) {
          this.finishSession(session)
          return
        }
        const message = session.stderrLines.at(-1) || session.rawLines.join("\n") || `agy exited with code ${code ?? 1}`
        this.failSession(session, message)
      })
    })
  }

  private handleLine(session: ActiveSession, record: Record<string, unknown>) {
    const pendingTurn = session.pendingTurn
    if (!pendingTurn || pendingTurn.resolved) return

    const type = record.type

    // ── Text delta ──────────────────────────────────────────────────────────
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

    // ── Tool call ───────────────────────────────────────────────────────────
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

    // ── Tool result ─────────────────────────────────────────────────────────
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

    // ── Final result ────────────────────────────────────────────────────────
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

    // ── Error line ──────────────────────────────────────────────────────────
    if (type === "error") {
      const message = typeof record.message === "string" ? record.message : "Antigravity error"
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

  private handleRawChunkBuffer(session: ActiveSession, buffer: string, source: "stdout" | "stderr") {
    const parts = buffer.split(/\r?\n|\r/g)
    const trailing = parts.pop() ?? ""
    for (const part of parts) {
      const record = parseJsonLine(part)
      if (record) {
        this.handleLine(session, record)
      } else {
        this.handleRawOutput(session, part, source)
      }
    }
    return trailing
  }

  private async handleRawOutput(session: ActiveSession, line: string, source: "stdout" | "stderr") {
    const pendingTurn = session.pendingTurn
    if (!pendingTurn || pendingTurn.resolved || pendingTurn.permissionInFlight) return

    const trimmed = line.trim()
    if (!trimmed) return
    session.rawLines.push(trimmed)
    session.rawLines = session.rawLines.slice(-24)
    if (source === "stdout") {
      const text = stripAnsi(trimmed)
      session.rawText = session.rawText ? `${session.rawText}\n${text}` : text
      pendingTurn.queue.push({
        type: "transcript",
        entry: timestamped({
          kind: "assistant_text",
          text: `${text}\n`,
        }),
      })
    }

    const permission = detectPermissionRequest("antigravity", session.rawLines)
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

  private scheduleHardTimeout(session: ActiveSession) {
    this.clearHardTimeoutTimer(session)
    const timeoutMs = process.env.KANNA_ANTIGRAVITY_TRANSPORT === "sdk"
      ? 5 * 60_000
      : parseDurationMs(process.env.KANNA_ANTIGRAVITY_PRINT_TIMEOUT ?? "5m", 5 * 60_000) + 15_000
    session.hardTimeoutTimer = setTimeout(() => {
      const pendingTurn = session.pendingTurn
      if (!pendingTurn || pendingTurn.resolved) return
      const text = session.rawText.trim() || session.rawLines.join("\n").trim()
      if (text) {
        this.failSession(session, "Antigravity CLI timed out before returning a final result.", { terminateChild: true })
        return
      }
      this.failSession(session, "Antigravity CLI did not return output before Kanna's timeout.", { terminateChild: true })
    }, timeoutMs)
  }

  private clearHardTimeoutTimer(session: ActiveSession) {
    if (!session.hardTimeoutTimer) return
    clearTimeout(session.hardTimeoutTimer)
    session.hardTimeoutTimer = null
  }

  private finishSession(session: ActiveSession, options: { terminateChild?: boolean } = {}) {
    this.clearHardTimeoutTimer(session)
    const pendingTurn = session.pendingTurn
    if (pendingTurn && !pendingTurn.resolved) {
      const text = session.rawText.trim() || session.rawLines.join("\n").trim()
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
    if (options.terminateChild) {
      try {
        session.child?.kill("SIGINT")
      } catch {
        // ignore
      }
    }
  }

  private failSession(session: ActiveSession, message: string, options: { terminateChild?: boolean } = {}) {
    this.clearHardTimeoutTimer(session)
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
    if (options.terminateChild) {
      try {
        session.child?.kill("SIGINT")
      } catch {
        // ignore
      }
    }
  }
}
