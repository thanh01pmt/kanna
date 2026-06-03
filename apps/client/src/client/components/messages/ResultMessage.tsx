import { useMemo } from "react"
import type { ChatDiffSnapshot, HydratedTranscriptMessage } from "@kanna/shared/types"
import type { ProcessedResultMessage } from "./types"
import { GitCommitHorizontal, FileText, ArrowRight, Cpu, Clock, Wrench } from "lucide-react"
import { Button } from "../ui/button"
import { deriveChatDiagnostics } from "../../lib/chatDiagnostics"


interface Props {
  message: ProcessedResultMessage
  messages: HydratedTranscriptMessage[]
  chatDiffSnapshot?: ChatDiffSnapshot | null
}

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`
  const totalSeconds = Math.floor(ms / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours}h${minutes > 0 ? ` ${minutes}m` : ""}`
  if (minutes > 0) return `${minutes}m${seconds > 0 ? ` ${seconds}s` : ""}`
  return `${seconds}s`
}

function formatCompactNumber(value: number) {
  return value.toLocaleString()
}

export function ResultMessage({ message, messages, chatDiffSnapshot }: Props) {
  const turnMessages = useMemo(() => {
    if (!messages) return []
    const resultIdx = messages.findIndex((m) => m.id === message.id)
    if (resultIdx === -1) return []
    let startIdx = resultIdx
    while (startIdx > 0) {
      if (messages[startIdx - 1].kind === "user_prompt") {
        startIdx = startIdx - 1
        break
      }
      startIdx--
    }
    return messages.slice(startIdx, resultIdx + 1)
  }, [messages, message.id])

  const turnDiagnostics = useMemo(() => {
    if (turnMessages.length === 0) return null
    return deriveChatDiagnostics(turnMessages)
  }, [turnMessages])

  const computedDurationMs = useMemo(() => {
    if (turnMessages.length < 2) return message.durationMs || 0
    const firstTime = new Date(turnMessages[0].timestamp).getTime()
    const lastTime = new Date(turnMessages[turnMessages.length - 1].timestamp).getTime()
    const diff = lastTime - firstTime
    return Math.max(message.durationMs || 0, diff > 0 ? diff : 0)
  }, [turnMessages, message.durationMs])

  const diagnosticsFooter = turnDiagnostics ? (
    <div className="flex flex-wrap items-center gap-2 px-0.5 py-1 text-[11px] text-muted-foreground select-none">
      {/* Steps */}
      <div className="flex items-center gap-1.5 bg-accent/30 rounded-md px-2 py-0.5 border border-border/40">
        <Wrench className="h-3 w-3 text-muted-foreground/75" />
        <span>{turnDiagnostics.summary.toolCallCount} step{turnDiagnostics.summary.toolCallCount !== 1 ? "s" : ""}</span>
      </div>

      {/* Duration */}
      <div className="flex items-center gap-1.5 bg-accent/30 rounded-md px-2 py-0.5 border border-border/40">
        <Clock className="h-3 w-3 text-muted-foreground/75" />
        <span>{formatDuration(computedDurationMs)}</span>
      </div>

      {/* Tokens Pill */}
      {turnDiagnostics.tokens.totalKnown > 0 && (
        <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/15 rounded-md px-2 py-0.5 font-mono text-[11px]">
          <Cpu className="h-3.5 w-3.5 shrink-0" />
          <span>
            {turnDiagnostics.tokens.totalKnown.toLocaleString()} tokens {turnDiagnostics.tokens.source === "estimated" ? "(est.) " : ""}(In: {turnDiagnostics.tokens.inputKnown.toLocaleString()} | Out: {turnDiagnostics.tokens.outputKnown.toLocaleString()} | Tool: {turnDiagnostics.tokens.toolEstimated.toLocaleString()})
          </span>
        </div>
      )}
    </div>
  ) : null

  if (!message.success) {
    return (
      <div className="mx-2 my-1 flex flex-col gap-2">
        <div className="px-4 py-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {message.result || "An unknown error occurred."}
        </div>
        {diagnosticsFooter}
      </div>
    )
  }

  return (
    <div className="mx-2 my-1 flex flex-col gap-2">
      {chatDiffSnapshot && chatDiffSnapshot.status === "ready" && chatDiffSnapshot.files.length > 0 ? (
        <div className="rounded-xl border border-border/70 bg-card/55 px-4 py-3 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <GitCommitHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">
                  Edited {chatDiffSnapshot.files.length} files
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatCompactNumber(chatDiffSnapshot.files.reduce((total, file) => total + file.additions, 0))} additions
                  {" "}
                  {formatCompactNumber(chatDiffSnapshot.files.reduce((total, file) => total + file.deletions, 0))} deletions
                </div>
              </div>
            </div>
            <Button variant="outline" size="sm" className="h-8 gap-1.5 rounded-md px-3 text-xs">
              Review
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="mt-3 space-y-1.5">
            {chatDiffSnapshot.files.slice(0, 4).map((file) => (
              <div key={file.path} className="flex items-center justify-between gap-3 rounded-md border border-border/60 bg-background/45 px-3 py-2">
                <div className="flex min-w-0 items-center gap-2">
                  <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/80" />
                  <span className="truncate text-sm text-foreground">{file.path}</span>
                </div>
                <div className="shrink-0 text-xs tabular-nums">
                  {file.additions > 0 ? <span className="text-emerald-500">+{file.additions}</span> : null}
                  {file.additions > 0 && file.deletions > 0 ? <span className="text-muted-foreground"> </span> : null}
                  {file.deletions > 0 ? <span className="text-red-500">-{file.deletions}</span> : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {diagnosticsFooter}
    </div>
  )
}
