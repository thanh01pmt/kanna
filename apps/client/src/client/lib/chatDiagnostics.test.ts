import { describe, expect, test } from "bun:test"
import type { TranscriptEntry } from "@kanna/shared/types"
import { deriveChatDiagnostics } from "./chatDiagnostics"

function entry(partial: Partial<TranscriptEntry>, createdAt = Date.now()): TranscriptEntry {
  return {
    _id: crypto.randomUUID(),
    createdAt,
    ...partial,
  } as TranscriptEntry
}

describe("deriveChatDiagnostics", () => {
  test("derives summary, known tokens, and trajectory steps from transcript entries", () => {
    const diagnostics = deriveChatDiagnostics([
      entry({ kind: "user_prompt", content: "Inspect the debug flow." }, 1),
      entry({
        kind: "tool_call",
        tool: {
          kind: "tool",
          toolKind: "read_file",
          toolName: "Read",
          toolId: "tool-1",
          input: { filePath: "/tmp/project/server.ts" },
        },
      }, 2),
      entry({
        kind: "tool_result",
        toolId: "tool-1",
        content: "x".repeat(400),
      }, 3),
      entry({
        kind: "assistant_text",
        text: "The debug path starts in the server.",
      }, 4),
      entry({
        kind: "context_window_updated",
        usage: {
          usedTokens: 600,
          totalProcessedTokens: 1200,
          inputTokens: 500,
          cachedInputTokens: 100,
          outputTokens: 80,
          reasoningOutputTokens: 20,
          compactsAutomatically: false,
        },
      }, 5),
      entry({
        kind: "result",
        subtype: "success",
        isError: false,
        durationMs: 1500,
        result: "done",
        costUsd: 0.0025,
      }, 6),
    ])

    expect(diagnostics.summary.entryCount).toBe(6)
    expect(diagnostics.summary.userPromptCount).toBe(1)
    expect(diagnostics.summary.assistantResponseCount).toBe(1)
    expect(diagnostics.summary.toolCallCount).toBe(1)
    expect(diagnostics.summary.resultCount).toBe(1)
    expect(diagnostics.summary.totalDurationMs).toBe(1500)
    expect(diagnostics.summary.totalCostUsd).toBe(0.0025)

    expect(diagnostics.tokens.source).toBe("context_window")
    expect(diagnostics.tokens.totalKnown).toBe(1200)
    expect(diagnostics.tokens.inputKnown).toBe(500)
    expect(diagnostics.tokens.cachedInputKnown).toBe(100)
    expect(diagnostics.tokens.outputKnown).toBe(80)
    expect(diagnostics.tokens.reasoningOutputKnown).toBe(20)
    expect(diagnostics.tokens.toolEstimated).toBeGreaterThan(100)

    expect(diagnostics.steps.map((step) => step.kind)).toEqual([
      "user_input",
      "tool_call",
      "tool_result",
      "assistant_response",
      "token_usage",
      "result",
    ])
    expect(diagnostics.steps[1]?.label).toContain("server.ts")
    expect(diagnostics.topResourceSteps[0]?.kind).toBe("token_usage")
  })

  test("uses tool payload estimates when context usage is unavailable", () => {
    const diagnostics = deriveChatDiagnostics([
      entry({
        kind: "tool_call",
        tool: {
          kind: "tool",
          toolKind: "bash",
          toolName: "Bash",
          toolId: "tool-1",
          input: { command: "pnpm test" },
        },
      }, 1),
      entry({
        kind: "tool_result",
        toolId: "tool-1",
        content: "passing output",
      }, 2),
    ])

    expect(diagnostics.tokens.source).toBe("estimated_tool_payload")
    expect(diagnostics.tokens.totalKnown).toBe(0)
    expect(diagnostics.tokens.toolEstimated).toBeGreaterThan(0)
    expect(diagnostics.tips[0]?.kind).toBe("ok")
  })

  test("ignores hidden entries and surfaces latest status", () => {
    const diagnostics = deriveChatDiagnostics([
      entry({ kind: "status", status: "running" }, 1),
      entry({ kind: "user_prompt", content: "secret", hidden: true }, 2),
      entry({ kind: "status", status: "done" }, 3),
    ])

    expect(diagnostics.summary.entryCount).toBe(2)
    expect(diagnostics.summary.userPromptCount).toBe(0)
    expect(diagnostics.summary.latestStatus).toBe("done")
    expect(diagnostics.steps).toHaveLength(2)
  })
})
