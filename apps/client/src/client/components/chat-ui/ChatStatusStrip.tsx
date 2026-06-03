import { useState, type ReactNode } from "react"
import { FileText, Folder, GitBranch, GitCompare, ListTodo, MessagesSquare, ChevronLeft, ChevronRight } from "lucide-react"
import type { ChatDiffSnapshot, TodoItem } from "@kanna/shared/types"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"
import { formatContextWindowTokens, type ContextWindowSnapshot } from "../../lib/contextWindow"
import { type SessionTokenTotals } from "../../lib/chatDiagnostics"

interface ChatStatusStripProps {
  projectName: string
  branchName: string
  todos: TodoItem[]
  sources: string[]
  diffs: ChatDiffSnapshot | null
  contextWindowSnapshot: ContextWindowSnapshot | null
  sessionTokenTotals: SessionTokenTotals | null
  progressPopoverOpen: boolean
  diagnosticsPanelOpen: boolean
  onToggleProgressPopover: () => void
  onToggleGitPanel: () => void
  onToggleDiagnosticsPanel: () => void
}

function StatusChip({
  icon,
  label,
  value,
  onClick,
  active,
  title,
}: {
  icon: ReactNode
  label: string
  value: string
  onClick?: () => void
  active?: boolean
  title?: string
}) {
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/80 px-2.5 py-1 text-xs",
    "text-foreground/80 transition-colors",
    onClick && "hover:border-foreground/30 hover:bg-accent hover:text-foreground cursor-pointer",
    active && "border-primary/60 text-foreground bg-primary/15",
  )

  const tooltip = title || `${label}: ${value}`

  if (!onClick) {
    return (
      <span className={className} title={tooltip}>
        {icon}
        <span className="font-medium">{label}</span>
        <span className="font-mono truncate">{value}</span>
      </span>
    )
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="none"
      onClick={onClick}
      title={tooltip}
      className={className}
    >
      {icon}
      <span className="font-medium">{label}</span>
      <span className="font-mono truncate">{value}</span>
    </Button>
  )
}

export function ChatStatusStrip({
  projectName,
  branchName,
  todos,
  sources,
  diffs,
  contextWindowSnapshot,
  sessionTokenTotals,
  progressPopoverOpen,
  diagnosticsPanelOpen,
  onToggleProgressPopover,
  onToggleGitPanel,
  onToggleDiagnosticsPanel,
}: ChatStatusStripProps) {
  const [expanded, setExpanded] = useState(false)
  const completedTodos = (todos || []).filter((todo) => todo.status === "completed").length
  const totalTodos = (todos || []).length
  const fileChangesCount = diffs?.files?.length ?? 0
  const additions = diffs?.files?.reduce((acc, file) => acc + (file.additions ?? 0), 0) ?? 0
  const deletions = diffs?.files?.reduce((acc, file) => acc + (file.deletions ?? 0), 0) ?? 0

  let tokenUsage = "no token data"
  let tokenTooltip = "Tokens: no token data"

  if (sessionTokenTotals && sessionTokenTotals.total > 0) {
    const totalStr = `${formatContextWindowTokens(sessionTokenTotals.total)}${sessionTokenTotals.hasEstimates ? " (est.)" : ""}`
    const contextStr = contextWindowSnapshot
      ? `(context: ${formatContextWindowTokens(contextWindowSnapshot.usedTokens)}${contextWindowSnapshot.maxTokens ? `/${formatContextWindowTokens(contextWindowSnapshot.maxTokens)}` : ""})`
      : ""
    tokenUsage = `${totalStr} total ${contextStr}`.trim()

    const breakdownParts = [
      `In: ${sessionTokenTotals.input.toLocaleString()}`,
      `Out: ${sessionTokenTotals.output.toLocaleString()}`,
    ]
    if (sessionTokenTotals.cachedInput > 0) {
      breakdownParts.push(`Cached: ${sessionTokenTotals.cachedInput.toLocaleString()}`)
    }
    if (sessionTokenTotals.toolEstimated > 0) {
      breakdownParts.push(`Tool est: ${sessionTokenTotals.toolEstimated.toLocaleString()}`)
    }

    const contextDetails = contextWindowSnapshot
      ? `\nActive Context: ${contextWindowSnapshot.usedTokens.toLocaleString()}${contextWindowSnapshot.maxTokens ? ` / ${contextWindowSnapshot.maxTokens.toLocaleString()}` : ""}`
      : ""

    tokenTooltip = `Tokens Session Total: ${sessionTokenTotals.total.toLocaleString()}${sessionTokenTotals.hasEstimates ? " (estimated)" : ""}\nBreakdown: ${breakdownParts.join(" | ")}${contextDetails}`
  } else if (contextWindowSnapshot) {
    tokenUsage = `${formatContextWindowTokens(contextWindowSnapshot.usedTokens)}${contextWindowSnapshot.maxTokens ? ` / ${formatContextWindowTokens(contextWindowSnapshot.maxTokens)}` : ""}`
    tokenTooltip = `Tokens Context Window: ${contextWindowSnapshot.usedTokens.toLocaleString()}${contextWindowSnapshot.maxTokens ? ` / ${contextWindowSnapshot.maxTokens.toLocaleString()}` : ""}`
  }

  return (
    <div className="flex items-center gap-1.5 flex-shrink-0">
      <div className="w-[1px] h-4 bg-border/60 flex-shrink-0 mr-1.5" />
      <Button
        type="button"
        variant="ghost"
        size="none"
        onClick={() => setExpanded(!expanded)}
        title={expanded ? "Show less" : "Show project status"}
        className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors cursor-pointer flex-shrink-0"
      >
        {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </Button>

      {expanded && (
        <>
          {projectName && (
            <StatusChip
              icon={<Folder className="h-3.5 w-3.5" />}
              label="Local"
              value={projectName}
            />
          )}
          <StatusChip
            icon={<GitBranch className="h-3.5 w-3.5" />}
            label="Branch"
            value={branchName || "detached"}
            onClick={onToggleGitPanel}
          />
          <StatusChip
            icon={<GitCompare className="h-3.5 w-3.5" />}
            label="Changes"
            value={fileChangesCount > 0 ? `${fileChangesCount} files +${additions} -${deletions}` : "clean"}
            onClick={onToggleGitPanel}
          />
          <StatusChip
            icon={<ListTodo className="h-3.5 w-3.5" />}
            label="Progress"
            value={totalTodos > 0 ? `${completedTodos}/${totalTodos}` : "idle"}
            onClick={onToggleProgressPopover}
            active={progressPopoverOpen}
          />
          <StatusChip
            icon={<MessagesSquare className="h-3.5 w-3.5" />}
            label="Sources"
            value={(sources || []).length > 0 ? `${sources.length}` : "none"}
          />
        </>
      )}

      <StatusChip
        icon={<FileText className="h-3.5 w-3.5" />}
        label="Tokens"
        value={tokenUsage}
        title={tokenTooltip}
        onClick={onToggleDiagnosticsPanel}
        active={diagnosticsPanelOpen}
      />
    </div>
  )
}

