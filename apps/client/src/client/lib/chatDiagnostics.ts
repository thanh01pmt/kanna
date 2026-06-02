import type { ContextWindowUsageSnapshot, TranscriptEntry } from "@kanna/shared/types"

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
  source: "context_window" | "estimated_tool_payload" | "none"
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

function createdAtToIso(createdAt: number) {
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

function getLatestUsage(entries: readonly TranscriptEntry[]) {
  for (let index = entries.length - 1; index >= 0; index -= 1) {
    const entry = entries[index]
    if (entry?.kind === "context_window_updated" && entry.usage.usedTokens > 0) {
      return entry.usage
    }
  }
  return null
}

function deriveTokenTotals(entries: readonly TranscriptEntry[], toolEstimated: number): ChatDiagnosticTokenTotals {
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

  return {
    totalKnown: 0,
    inputKnown: 0,
    cachedInputKnown: 0,
    outputKnown: 0,
    reasoningOutputKnown: 0,
    toolEstimated,
    source: toolEstimated > 0 ? "estimated_tool_payload" : "none",
  }
}

function labelForTool(entry: Extract<TranscriptEntry, { kind: "tool_call" }>) {
  const input = entry.tool.input
  switch (entry.tool.toolKind) {
    case "bash":
      return getStringField(input, "command") ?? entry.tool.toolName
    case "grep":
      return getStringField(input, "pattern") ? `Find ${getStringField(input, "pattern")}` : entry.tool.toolName
    case "glob":
      return getStringField(input, "pattern") ? `Search ${getStringField(input, "pattern")}` : entry.tool.toolName
    case "read_file":
      return getStringField(input, "filePath") ? `Read ${getStringField(input, "filePath")}` : entry.tool.toolName
    case "write_file":
      return getStringField(input, "filePath") ? `Write ${getStringField(input, "filePath")}` : entry.tool.toolName
    case "edit_file":
      return getStringField(input, "filePath") ? `Edit ${getStringField(input, "filePath")}` : entry.tool.toolName
    case "delete_file":
      return getStringField(input, "filePath") ? `Delete ${getStringField(input, "filePath")}` : entry.tool.toolName
    case "web_search":
      return getStringField(input, "query") ? `Search web for ${getStringField(input, "query")}` : entry.tool.toolName
    case "mcp_generic":
      return getStringField(input, "server") && getStringField(input, "tool")
        ? `${getStringField(input, "server")}:${getStringField(input, "tool")}`
        : entry.tool.toolName
    case "subagent_task":
      return getStringField(input, "subagentType") ?? entry.tool.toolName
    default:
      return entry.tool.toolName
  }
}

function buildStep(entry: TranscriptEntry, index: number): ChatDiagnosticStep {
  const base = {
    id: entry._id,
    index,
    timestamp: createdAtToIso(entry.createdAt),
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
        toolId: entry.tool.toolId,
        toolKind: entry.tool.toolKind,
        tokenEstimate: estimateTokensFromPayload(entry.tool.input),
        preview: asPreview(entry.tool.input),
        detail: asDetail(entry.tool.input),
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
        preview: asPreview({ tools: entry.tools.length, agents: entry.agents.length, mcpServers: entry.mcpServers.length }),
        detail: asDetail({
          provider: entry.provider,
          model: entry.model,
          tools: entry.tools,
          agents: entry.agents,
          slashCommands: entry.slashCommands,
          mcpServers: entry.mcpServers,
        }),
      }
    case "account_info":
      return {
        ...base,
        kind: "system",
        label: "Account info",
        preview: asPreview(entry.accountInfo),
        detail: asDetail(entry.accountInfo),
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

export function deriveChatDiagnostics(entries: readonly TranscriptEntry[]): ChatDiagnostics {
  const visibleEntries = entries.filter((entry) => !entry.hidden)
  const steps = visibleEntries.map((entry, index) => buildStep(entry, index))
  const toolEstimated = steps
    .filter((step) => step.kind === "tool_call" || step.kind === "tool_result")
    .reduce((total, step) => total + (step.tokenEstimate ?? 0), 0)

  const summary: ChatDiagnostics["summary"] = {
    entryCount: visibleEntries.length,
    userPromptCount: visibleEntries.filter((entry) => entry.kind === "user_prompt").length,
    assistantResponseCount: visibleEntries.filter((entry) => entry.kind === "assistant_text").length,
    toolCallCount: visibleEntries.filter((entry) => entry.kind === "tool_call").length,
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
