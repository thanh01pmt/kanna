import type { ReactNode } from "react"
import { FileText, Folder, GitBranch, GitCompare, ListTodo, MessagesSquare } from "lucide-react"
import type { ChatDiffSnapshot, TodoItem } from "@kanna/shared/types"
import { Button } from "../ui/button"
import { cn } from "../../lib/utils"
import { formatContextWindowTokens, type ContextWindowSnapshot } from "../../lib/contextWindow"

interface ChatStatusStripProps {
  projectName: string
  branchName: string
  todos: TodoItem[]
  sources: string[]
  diffs: ChatDiffSnapshot | null
  contextWindowSnapshot: ContextWindowSnapshot | null
  progressPopoverOpen: boolean
  onToggleProgressPopover: () => void
  onToggleGitPanel: () => void
}

function StatusChip({
  icon,
  label,
  value,
  onClick,
  active,
}: {
  icon: ReactNode
  label: string
  value: string
  onClick?: () => void
  active?: boolean
}) {
  const className = cn(
    "inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 py-1 text-xs",
    "text-muted-foreground transition-colors",
    onClick && "hover:border-border hover:bg-accent/40 hover:text-foreground",
    active && "border-primary/40 text-foreground bg-primary/10",
  )

  if (!onClick) {
    return (
      <span className={className} title={`${label}: ${value}`}>
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
      title={`${label}: ${value}`}
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
  progressPopoverOpen,
  onToggleProgressPopover,
  onToggleGitPanel,
}: ChatStatusStripProps) {
  const completedTodos = todos.filter((todo) => todo.status === "completed").length
  const totalTodos = todos.length
  const fileChangesCount = diffs?.files?.length ?? 0
  const additions = diffs?.files?.reduce((acc, file) => acc + (file.additions ?? 0), 0) ?? 0
  const deletions = diffs?.files?.reduce((acc, file) => acc + (file.deletions ?? 0), 0) ?? 0
  const tokenUsage = contextWindowSnapshot
    ? `${formatContextWindowTokens(contextWindowSnapshot.usage.usedTokens)}${contextWindowSnapshot.maxTokens ? ` / ${formatContextWindowTokens(contextWindowSnapshot.maxTokens)}` : ""}`
    : "no token data"

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
        />
      </div>
    </div>
  )
}
