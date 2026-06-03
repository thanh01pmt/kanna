import type { ChatDiffSnapshot } from "@kanna/shared/types"
import type { ProcessedResultMessage } from "./types"
import { MetaRow, MetaLabel } from "./shared"
import { cn } from "../../lib/utils"
import { GitCommitHorizontal, FileText, ArrowRight } from "lucide-react"
import { Button } from "../ui/button"

interface Props {
  message: ProcessedResultMessage
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

export function ResultMessage({ message, chatDiffSnapshot }: Props) {
  if (!message.success) {
    return (
      <div className="px-4 py-3 mx-2 my-1 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
        {message.result || "An unknown error occurred."}
      </div>
    )
  }

  return (
    <div className="mx-2 my-1 flex flex-col gap-2">
      <MetaRow className={cn("px-0.5 text-xs tracking-wide", message.durationMs > 60000 ? "" : "hidden")}>
        <div className="h-px w-full bg-border" />
        <MetaLabel className="flex-shrink-0 whitespace-nowrap text-[11px] uppercase tracking-widest text-muted-foreground/60">
          Worked for {formatDuration(message.durationMs)}
        </MetaLabel>
        <div className="h-px w-full bg-border" />
      </MetaRow>

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
    </div>
  )
}
