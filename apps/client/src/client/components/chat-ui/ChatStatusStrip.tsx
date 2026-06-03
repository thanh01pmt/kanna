import type { ReactNode } from "react"
import { FileText, Folder, GitBranch, GitCompare, ListTodo, MessagesSquare } from "lucide-react"
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
    "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs",
    "text-muted-foreground transition-colors",
    onClick && "hover:border-border hover:bg-accent/40 hover:text-foreground",
    active && "border-primary/40 text-foreground bg-primary/10",
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
  const completedTodos = todos.filter((todo) => todo.status === "completed").length
  const totalTodos = todos.length
  const fileChangesCount = diffs?.files?.length ?? 0
  const additions = diffs?.files?.reduce((acc, file) => acc + (file.additions ?? 0), 0) ?? 0
  const deletions = diffs?.files?.reduce((acc, file) => acc + (file.deletions ?? 0), 0) ?? 0

  let tokenUsage = "no token data"
  let tokenTooltip = "Tokens: no token data"

  if (sessionTokenTotals && sessionTokenTotals.total > 0) {
    const totalStr = `${formatContextWindowTokens(sessionTokenTotals.total)}${sessionTokenTotals.hasEstimates ? " (est.)" : ""}`
    const contextStr = contextWindowSnapshot
      ? `(context: ${formatContextWindowTokens(contextWindowSnapshot.usage.usedTokens)}${contextWindowSnapshot.maxTokens ? `/${formatContextWindowTokens(contextWindowSnapshot.maxTokens)}` : ""})`
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
      ? `\nActive Context: ${contextWindowSnapshot.usage.usedTokens.toLocaleString()}${contextWindowSnapshot.maxTokens ? ` / ${contextWindowSnapshot.maxTokens.toLocaleString()}` : ""}`
      : ""

    tokenTooltip = `Tokens Session Total: ${sessionTokenTotals.total.toLocaleString()}${sessionTokenTotals.hasEstimates ? " (estimated)" : ""}\nBreakdown: ${breakdownParts.join(" | ")}${contextDetails}`
  } else if (contextWindowSnapshot) {
    tokenUsage = `${formatContextWindowTokens(contextWindowSnapshot.usage.usedTokens)}${contextWindowSnapshot.maxTokens ? ` / ${formatContextWindowTokens(contextWindowSnapshot.maxTokens)}` : ""}`
    tokenTooltip = `Tokens Context Window: ${contextWindowSnapshot.usage.usedTokens.toLocaleString()}${contextWindowSnapshot.maxTokens ? ` / ${contextWindowSnapshot.maxTokens.toLocaleString()}` : ""}`
  }

  return (
    <div className="shrink-0 border-b border-border/50 bg-background/45 px-3 py-2 backdrop-blur-md">
      <div className="flex flex-wrap items-center gap-2">
        <StatusChip
          icon={<Folder className="h-3.5 w-3.5" />}
          label="Local"
          value={projectName}
        />
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
          value={sources.length > 0 ? `${sources.length}` : "none"}
        />
        <StatusChip
          icon={<FileText className="h-3.5 w-3.5" />}
          label="Tokens"
          value={tokenUsage}
          title={tokenTooltip}
          onClick={onToggleDiagnosticsPanel}
          active={diagnosticsPanelOpen}
        />
      </div>
    </div>
  )
}

