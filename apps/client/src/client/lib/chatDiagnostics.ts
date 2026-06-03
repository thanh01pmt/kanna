import type { ContextWindowUsageSnapshot } from "@kanna/shared/types"

export type ChatDiagnosticStepKind =
  | "user_input"
  | "assistant_response"
  | "tool_call"
  | "tool_result"
  | "token_usage"
  | "result"
  | "status"
  | "compaction"
  | "system"
  | "unknown"

export interface ChatDiagnosticTokenTotals {
  totalKnown: number
  inputKnown: number
  cachedInputKnown: number
  outputKnown: number
  reasoningOutputKnown: number
  toolEstimated: number
  source: "context_window" | "estimated_tool_payload" | "none" | "estimated"
}

export interface ChatDiagnosticStep {
  id: string
  index: number
  kind: ChatDiagnosticStepKind
  label: string
  timestamp: string
  messageId?: string
  toolId?: string
  toolKind?: string
  isError?: boolean
  durationMs?: number
  costUsd?: number
  tokenEstimate?: number
  usage?: ContextWindowUsageSnapshot
  preview?: string
  detail?: string
}

export interface ChatDiagnosticTip {
  kind: "ok" | "warning" | "info"
  title: string
  detail: string
}

export interface ChatDiagnostics {
  summary: {
    entryCount: number
    userPromptCount: number
    assistantResponseCount: number
    toolCallCount: number
    resultCount: number
    latestStatus: string | null
    totalDurationMs: number
    totalCostUsd: number
  }
  tokens: ChatDiagnosticTokenTotals
  steps: ChatDiagnosticStep[]
  topResourceSteps: ChatDiagnosticStep[]
  tips: ChatDiagnosticTip[]
}

const TOOL_ESTIMATE_CHARS_PER_TOKEN = 4
const STEP_PREVIEW_MAX_LENGTH = 180

function createdAtToIso(createdAt: number | string | Date | undefined | null): string {
  if (!createdAt) return new Date().toISOString()
  if (typeof createdAt === "string") return createdAt
  return new Date(createdAt).toISOString()
}

function asPreview(value: unknown, maxLength = STEP_PREVIEW_MAX_LENGTH): string | undefined {
  let text: string
  if (typeof value === "string") {
    text = value
  } else if (value === undefined || value === null) {
    return undefined
  } else {
    try {
      text = JSON.stringify(value)
    } catch {
      text = String(value)
    }
  }

  const normalized = text.replace(/\s+/g, " ").trim()
  if (!normalized) return undefined
  if (normalized.length <= maxLength) return normalized
  return `${normalized.slice(0, maxLength - 1).trimEnd()}...`
}

function asDetail(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed || undefined
  }
  if (value === undefined || value === null) {
    return undefined
  }
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function estimateTokensFromPayload(value: unknown): number {
  const preview = asPreview(value, Number.MAX_SAFE_INTEGER)
  if (!preview) return 0
  return Math.max(1, Math.ceil(preview.length / TOOL_ESTIMATE_CHARS_PER_TOKEN))
}

function getStringField(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null
  const candidate = (value as Record<string, unknown>)[key]
  return typeof candidate === "string" && candidate.trim() ? candidate.trim() : null
}

function getKnownUsageTotal(usage: ContextWindowUsageSnapshot): number {
  return Math.max(usage.totalProcessedTokens ?? 0, usage.usedTokens)
}

function getLatestUsage(entries: readonly any[]) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (entry?.kind === "context_window_updated" && entry.usage?.usedTokens > 0) {
      return entry.usage
    }
  }
  return null
}

function deriveTokenTotals(entries: readonly any[], toolEstimated: number): ChatDiagnosticTokenTotals {
  const latestUsage = getLatestUsage(entries)
  if (latestUsage) {
    return {
      totalKnown: getKnownUsageTotal(latestUsage),
      inputKnown: latestUsage.inputTokens ?? latestUsage.lastInputTokens ?? 0,
      cachedInputKnown: latestUsage.cachedInputTokens ?? latestUsage.lastCachedInputTokens ?? 0,
      outputKnown: latestUsage.outputTokens ?? latestUsage.lastOutputTokens ?? 0,
      reasoningOutputKnown: latestUsage.reasoningOutputTokens ?? latestUsage.lastReasoningOutputTokens ?? 0,
      toolEstimated,
      source: "context_window",
    }
  }

  let estInput = 0
  let estOutput = 0
  for (const entry of entries) {
    if (entry?.kind === "user_prompt" && typeof entry.content === "string") {
      estInput += Math.ceil(entry.content.length / 4)
    } else if (entry?.kind === "assistant_text" && typeof entry.text === "string") {
      estOutput += Math.ceil(entry.text.length / 4)
    }
  }

  const estTotal = estInput + estOutput

  return {
    totalKnown: estTotal,
    inputKnown: estInput,
    cachedInputKnown: 0,
    outputKnown: estOutput,
    reasoningOutputKnown: 0,
    toolEstimated,
    source: estTotal > 0 ? "estimated" : (toolEstimated > 0 ? "estimated_tool_payload" : "none"),
  }
}

function labelForTool(entry: any) {
  const input = entry.tool?.input || entry.input
  const toolKind = entry.tool?.toolKind || entry.toolKind
  const toolName = entry.tool?.toolName || entry.toolName

  switch (toolKind) {
    case "bash":
      return getStringField(input, "command") ?? toolName
    case "grep":
      return getStringField(input, "pattern") ? `Find ${getStringField(input, "pattern")}` : toolName
    case "glob":
      return getStringField(input, "pattern") ? `Search ${getStringField(input, "pattern")}` : toolName
    case "read_file":
      return getStringField(input, "filePath") ? `Read ${getStringField(input, "filePath")}` : toolName
    case "write_file":
      return getStringField(input, "filePath") ? `Write ${getStringField(input, "filePath")}` : toolName
    case "edit_file":
      return getStringField(input, "filePath") ? `Edit ${getStringField(input, "filePath")}` : toolName
    case "delete_file":
      return getStringField(input, "filePath") ? `Delete ${getStringField(input, "filePath")}` : toolName
    case "web_search":
      return getStringField(input, "query") ? `Search web for ${getStringField(input, "query")}` : toolName
    case "mcp_generic":
      return getStringField(input, "server") && getStringField(input, "tool")
        ? `${getStringField(input, "server")}:${getStringField(input, "tool")}`
        : toolName
    case "subagent_task":
      return getStringField(input, "subagentType") ?? toolName
    default:
      return toolName
  }
}

function buildStep(entry: any, index: number): ChatDiagnosticStep {
  const base = {
    id: entry._id || entry.id || `step-${index}`,
    index,
    timestamp: createdAtToIso(entry.createdAt || entry.timestamp),
    messageId: entry.messageId,
  }

  switch (entry.kind) {
    case "user_prompt":
      return {
        ...base,
        kind: "user_input",
        label: "User input",
        tokenEstimate: estimateTokensFromPayload(entry.content),
        preview: asPreview(entry.content),
        detail: asDetail(entry.content),
      }
    case "assistant_text":
      return {
        ...base,
        kind: "assistant_response",
        label: "Assistant response",
        tokenEstimate: estimateTokensFromPayload(entry.text),
        preview: asPreview(entry.text),
        detail: asDetail(entry.text),
      }
    case "tool_call":
      return {
        ...base,
        kind: "tool_call",
        label: labelForTool(entry),
        toolId: entry.tool?.toolId,
        toolKind: entry.tool?.toolKind,
        tokenEstimate: estimateTokensFromPayload(entry.tool?.input),
        preview: asPreview(entry.tool?.input),
        detail: asDetail(entry.tool?.input),
      }
    case "tool_result":
      return {
        ...base,
        kind: "tool_result",
        label: entry.isError ? "Tool result error" : "Tool result",
        toolId: entry.toolId,
        isError: entry.isError,
        tokenEstimate: estimateTokensFromPayload(entry.content),
        preview: asPreview(entry.content),
        detail: asDetail(entry.content),
      }
    case "tool":
      return {
        ...base,
        kind: "tool_call",
        label: labelForTool(entry),
        toolId: entry.toolId,
        toolKind: entry.toolKind,
        isError: entry.isError,
        tokenEstimate: estimateTokensFromPayload(entry.input) + estimateTokensFromPayload(entry.result || entry.rawResult),
        preview: asPreview(entry.input),
        detail: asDetail({ input: entry.input, result: entry.result || entry.rawResult }),
      }
    case "context_window_updated":
      return {
        ...base,
        kind: "token_usage",
        label: "Token usage",
        usage: entry.usage,
        tokenEstimate: getKnownUsageTotal(entry.usage),
        preview: `${getKnownUsageTotal(entry.usage).toLocaleString()} known tokens`,
        detail: asDetail(entry.usage),
      }
    case "result":
      return {
        ...base,
        kind: "result",
        label: entry.isError ? "Turn failed" : entry.subtype === "cancelled" ? "Turn cancelled" : "Turn finished",
        isError: entry.isError,
        durationMs: entry.durationMs,
        costUsd: entry.costUsd,
        preview: asPreview(entry.result),
        detail: asDetail(entry.result),
      }
    case "status":
      return {
        ...base,
        kind: "status",
        label: entry.status,
        preview: entry.status,
        detail: entry.status,
      }
    case "compact_boundary":
      return {
        ...base,
        kind: "compaction",
        label: "Context compacted",
      }
    case "compact_summary":
      return {
        ...base,
        kind: "compaction",
        label: "Compact summary",
        tokenEstimate: estimateTokensFromPayload(entry.summary),
        preview: asPreview(entry.summary),
        detail: asDetail(entry.summary),
      }
    case "context_cleared":
      return {
        ...base,
        kind: "compaction",
        label: "Context cleared",
      }
    case "system_init":
      return {
        ...base,
        kind: "system",
        label: `${entry.provider} ${entry.model}`,
        preview: asPreview({ tools: entry.tools?.length || 0, agents: entry.agents?.length || 0, mcpServers: entry.mcpServers?.length || 0 }),
        detail: asDetail({
          provider: entry.provider,
          model: entry.model,
          tools: entry.tools,
          agents: entry.agents,
          slashCommands: entry.slashCommands,
          mcpServers: entry.mcpServers,
        }),
      }
    case "interrupted":
      return {
        ...base,
        kind: "result",
        label: "Interrupted",
        isError: true,
      }
    default:
      return {
        ...base,
        kind: "unknown",
        label: "Unknown entry",
        preview: asPreview(entry),
        detail: asDetail(entry),
      }
  }
}

function deriveTips(args: {
  steps: readonly ChatDiagnosticStep[]
  tokens: ChatDiagnosticTokenTotals
  summary: ChatDiagnostics["summary"]
}): ChatDiagnosticTip[] {
  const tips: ChatDiagnosticTip[] = []
  const estimatedToolPct = args.tokens.totalKnown > 0
    ? (args.tokens.toolEstimated / args.tokens.totalKnown) * 100
    : 0

  if (estimatedToolPct > 50) {
    tips.push({
      kind: "warning",
      title: `High tool payload (${estimatedToolPct.toFixed(0)}%)`,
      detail: "Tool inputs/results are large relative to known context usage. Narrow file reads, command output, or search scope when possible.",
    })
  }

  if (args.tokens.inputKnown > 50_000 && args.tokens.outputKnown > 0) {
    const inputPct = (args.tokens.inputKnown / Math.max(1, args.tokens.inputKnown + args.tokens.outputKnown)) * 100
    if (inputPct > 80) {
      tips.push({
        kind: "info",
        title: `Large input context (${inputPct.toFixed(0)}%)`,
        detail: "Most known model tokens are input context. Consider starting a fresh chat after the current task is complete.",
      })
    }
  }

  if (args.steps.length > 25) {
    tips.push({
      kind: "info",
      title: `Long trajectory (${args.steps.length} steps)`,
      detail: "This chat has a long action chain. A focused follow-up prompt can reduce repeated exploration.",
    })
  }

  if (args.summary.totalCostUsd > 0.01) {
    tips.push({
      kind: "info",
      title: "Cost observed",
      detail: `Known provider-reported cost is $${args.summary.totalCostUsd.toFixed(4)} for this chat.`,
    })
  }

  if (tips.length === 0) {
    tips.push({
      kind: "ok",
      title: "Diagnostics look balanced",
      detail: "No obvious token or trajectory hotspot was detected from the available transcript data.",
    })
  }

  return tips
}

export function deriveChatDiagnostics(entries: readonly any[]): ChatDiagnostics {
  const visibleEntries = entries.filter((entry) => !entry.hidden)
  const steps = visibleEntries.map((entry, index) => buildStep(entry, index))
  const toolEstimated = steps
    .filter((step) => step.kind === "tool_call" || step.kind === "tool_result")
    .reduce((total, step) => total + (step.tokenEstimate ?? 0), 0)

  const summary: ChatDiagnostics["summary"] = {
    entryCount: visibleEntries.length,
    userPromptCount: visibleEntries.filter((entry) => entry.kind === "user_prompt").length,
    assistantResponseCount: visibleEntries.filter((entry) => entry.kind === "assistant_text").length,
    toolCallCount: visibleEntries.filter((entry) => entry.kind === "tool_call" || entry.kind === "tool").length,
    resultCount: visibleEntries.filter((entry) => entry.kind === "result" || entry.kind === "interrupted").length,
    latestStatus: [...visibleEntries].reverse().find((entry) => entry.kind === "status")?.status ?? null,
    totalDurationMs: visibleEntries.reduce((total, entry) => total + (entry.kind === "result" ? entry.durationMs : 0), 0),
    totalCostUsd: visibleEntries.reduce((total, entry) => total + (entry.kind === "result" ? entry.costUsd ?? 0 : 0), 0),
  }

  const tokens = deriveTokenTotals(visibleEntries, toolEstimated)
  const topResourceSteps = [...steps]
    .filter((step) => (step.tokenEstimate ?? 0) > 0)
    .sort((left, right) => (right.tokenEstimate ?? 0) - (left.tokenEstimate ?? 0))
    .slice(0, 5)

  return {
    summary,
    tokens,
    steps,
    topResourceSteps,
    tips: deriveTips({ steps, tokens, summary }),
  }
}

export function splitTranscriptIntoTurns(entries: readonly any[]): any[][] {
  const turns: any[][] = []
  let currentTurn: any[] = []

  for (const entry of entries) {
    if (entry?.kind === "user_prompt") {
      if (currentTurn.length > 0) {
        turns.push(currentTurn)
      }
      currentTurn = [entry]
    } else {
      currentTurn.push(entry)
    }
  }

  if (currentTurn.length > 0) {
    turns.push(currentTurn)
  }

  return turns
}

export interface SessionTokenTotals {
  total: number
  input: number
  output: number
  cachedInput: number
  reasoningOutput: number
  toolEstimated: number
  hasEstimates: boolean
}

export function deriveSessionTokenTotals(messages: ReadonlyArray<any>): SessionTokenTotals {
  const turns = splitTranscriptIntoTurns(messages)
  let total = 0
  let input = 0
  let output = 0
  let cachedInput = 0
  let reasoningOutput = 0
  let toolEstimated = 0
  let hasEstimates = false

  for (const turn of turns) {
    const diagnostics = deriveChatDiagnostics(turn)
    total += diagnostics.tokens.totalKnown
    input += diagnostics.tokens.inputKnown
    output += diagnostics.tokens.outputKnown
    cachedInput += diagnostics.tokens.cachedInputKnown
    reasoningOutput += diagnostics.tokens.reasoningOutputKnown
    toolEstimated += diagnostics.tokens.toolEstimated
    if (diagnostics.tokens.source === "estimated") {
      hasEstimates = true
    }
  }

  return {
    total,
    input,
    output,
    cachedInput,
    reasoningOutput,
    toolEstimated,
    hasEstimates,
  }
}

