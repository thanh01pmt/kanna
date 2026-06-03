import { useState } from "react"
import { Brain, ChevronDown, ChevronRight } from "lucide-react"
import type { ProcessedThinkingMessage } from "./types"

interface Props {
  message: ProcessedThinkingMessage
}

export function ThinkingMessage({ message }: Props) {
  const [expanded, setExpanded] = useState(true)

  return (
    <div className="flex flex-col gap-1.5 w-full text-xs text-muted-foreground border-l border-muted-foreground/30 pl-3.5 my-1.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1.5 hover:text-foreground/80 transition-colors w-fit select-none font-medium"
      >
        <Brain className="h-3.5 w-3.5 text-purple-400 dark:text-purple-300" />
        <span>Thought Process</span>
        {expanded ? (
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
        )}
      </button>
      {expanded && (
        <div className="whitespace-pre-wrap font-sans leading-relaxed text-muted-foreground/80 pl-0.5 mt-1 max-w-full overflow-hidden italic select-text">
          {message.thinking}
        </div>
      )}
    </div>
  )
}
