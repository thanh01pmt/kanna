import React, { useState, useEffect, useRef } from "react"
import { 
  ChevronDown, 
  ChevronRight, 
  Check, 
  Loader2, 
  Circle, 
  GitBranch, 
  Folder, 
  GitCommit, 
  ArrowUpRight, 
  FileText,
  GitCompare,
  SlidersHorizontal,
  X
} from "lucide-react"
import { cn } from "../../lib/utils"
import type { TodoItem, ChatDiffSnapshot } from "@kanna/shared/types"

interface AgentProgressPopoverProps {
  todos: TodoItem[]
  sources: string[]
  diffs: ChatDiffSnapshot | null
  projectName: string
  branchName: string
  onClose: () => void
  onToggleGitPanel: () => void
  onCheckoutBranch?: () => void
}

export function AgentProgressPopover({
  todos = [],
  sources = [],
  diffs,
  projectName,
  branchName,
  onClose,
  onToggleGitPanel,
  onCheckoutBranch
}: AgentProgressPopoverProps) {
  const [progressExpanded, setProgressExpanded] = useState(true)
  const [sourcesExpanded, setSourcesExpanded] = useState(true)
  const popoverRef = useRef<HTMLDivElement>(null)

  const fileChangesCount = diffs?.files?.length ?? 0
  const additions = diffs?.files?.reduce((acc, f) => acc + (f.additions ?? 0), 0) ?? 0
  const deletions = diffs?.files?.reduce((acc, f) => acc + (f.deletions ?? 0), 0) ?? 0

  return (
    <div 
      ref={popoverRef}
      className={cn(
        "absolute right-2 top-11 z-50 w-80 rounded-2xl border border-border/60 shadow-2xl p-4",
        "bg-background/80 backdrop-blur-xl text-foreground max-h-[580px] overflow-y-auto flex flex-col gap-4 select-none animate-in fade-in slide-in-from-top-2 duration-150"
      )}
    >
      {/* Title & Close Header */}
      <div className="flex items-center justify-between pb-1 border-b border-border/40">
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Agent Console</span>
        </div>
        <button 
          onClick={onClose}
          className="p-1 hover:bg-accent/40 rounded-lg text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress Section */}
      <div className="flex flex-col gap-1.5">
        <button 
          onClick={() => setProgressExpanded(!progressExpanded)}
          className="flex items-center justify-between text-sm font-medium hover:text-foreground/80 text-foreground transition-colors w-full text-left py-0.5"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[13px]">Progress</span>
            {todos.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-accent/40 rounded-full font-medium text-muted-foreground">
                {todos.filter(t => t.status === "completed").length}/{todos.length}
              </span>
            )}
          </div>
          {progressExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>

        {progressExpanded && (
          <div className="flex flex-col gap-2 mt-1 pl-1">
            {todos.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-1 pl-1">
                No active tasks planned.
              </div>
            ) : (
              todos.map((todo, idx) => (
                <div key={idx} className="flex items-start gap-2.5 text-xs py-0.5">
                  <div className="mt-0.5 flex-shrink-0">
                    {todo.status === "completed" ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500 stroke-[3]" />
                    ) : todo.status === "in_progress" ? (
                      <Loader2 className="h-3.5 w-3.5 text-sky-500 animate-spin" />
                    ) : (
                      <Circle className="h-3.5 w-3.5 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <span 
                      className={cn(
                        "font-medium leading-relaxed break-words pr-2",
                        todo.status === "completed" ? "line-through text-muted-foreground/75" : "text-foreground",
                        todo.status === "in_progress" && "text-sky-500 font-semibold"
                      )}
                    >
                      {todo.content}
                    </span>
                    {todo.status === "in_progress" && todo.activeForm && (
                      <span className="text-[10px] text-muted-foreground bg-accent/30 rounded px-1.5 py-0.5 w-fit mt-0.5 font-mono">
                        {todo.activeForm}
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40" />

      {/* Environment Section */}
      <div className="flex flex-col gap-2">
        <div className="text-[13px] font-semibold text-foreground py-0.5">Environment</div>
        
        <div className="flex flex-col gap-1.5 pl-1">
          {/* Changes item */}
          <button 
            onClick={onToggleGitPanel}
            className="flex items-center justify-between text-xs hover:bg-accent/40 rounded-lg p-2 transition-all w-full text-left"
          >
            <div className="flex items-center gap-2">
              <GitCompare className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Changes</span>
            </div>
            {fileChangesCount > 0 ? (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20">
                {fileChangesCount} files (+{additions} -{deletions})
              </span>
            ) : (
              <span className="text-[10px] text-muted-foreground font-mono">clean</span>
            )}
          </button>

          {/* Local project item */}
          <div className="flex items-center justify-between text-xs hover:bg-accent/40 rounded-lg p-2 transition-all w-full text-left">
            <div className="flex items-center gap-2">
              <Folder className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Local</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-default">
              <span className="font-mono">{projectName}</span>
              <ChevronDown className="h-3 w-3" />
            </div>
          </div>

          {/* Git Branch item */}
          <button 
            onClick={onCheckoutBranch || onToggleGitPanel}
            className="flex items-center justify-between text-xs hover:bg-accent/40 rounded-lg p-2 transition-all w-full text-left"
          >
            <div className="flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Branch</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors">
              <span className="font-mono truncate max-w-[120px]">{branchName || "detached"}</span>
              <ChevronDown className="h-3 w-3" />
            </div>
          </button>

          {/* Commit or push item */}
          <button 
            onClick={onToggleGitPanel}
            className="flex items-center justify-between text-xs hover:bg-accent/40 rounded-lg p-2 transition-all w-full text-left"
          >
            <div className="flex items-center gap-2">
              <GitCommit className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-medium">Commit or push</span>
            </div>
            <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/40" />

      {/* Sources Section */}
      <div className="flex flex-col gap-1.5">
        <button 
          onClick={() => setSourcesExpanded(!sourcesExpanded)}
          className="flex items-center justify-between text-sm font-medium hover:text-foreground/80 text-foreground transition-colors w-full text-left py-0.5"
        >
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-[13px]">Sources</span>
            {sources.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 bg-accent/40 rounded-full font-medium text-muted-foreground">
                {sources.length}
              </span>
            )}
          </div>
          {sourcesExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>

        {sourcesExpanded && (
          <div className="flex flex-col gap-1.5 mt-1 pl-1 max-h-36 overflow-y-auto">
            {sources.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-1 pl-1">
                No sources yet.
              </div>
            ) : (
              sources.map((source, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs py-0.5 text-muted-foreground hover:text-foreground transition-colors">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                  <span className="truncate pr-2 font-mono" title={source}>{source}</span>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  )
}
