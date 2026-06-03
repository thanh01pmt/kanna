import { memo, type RefObject } from "react"
import type { AgentProvider, ChatDiffSnapshot, TodoItem } from "@kanna/shared/types"
import { ChatInput, type ChatInputHandle } from "../../components/chat-ui/ChatInput"
import type { ContextWindowSnapshot } from "../../lib/contextWindow"
import type { KannaState } from "../useKannaState"
import type { SessionTokenTotals } from "../../lib/chatDiagnostics"

interface ChatInputDockProps {
  inputRef: RefObject<HTMLDivElement | null>
  onLayoutChange: () => void
  chatInputRef: RefObject<ChatInputHandle | null>
  chatInputElementRef: RefObject<HTMLTextAreaElement | null>
  activeChatId: string | null
  previousPrompt: string | null
  hasSelectedProject: boolean
  runtimeStatus: string | null
  canCancel: boolean
  projectId: string | null
  activeProvider: AgentProvider | null
  availableProviders: KannaState["availableProviders"]
  contextWindowSnapshot: ContextWindowSnapshot | null
  onSubmit: KannaState["handleSend"]
  onCancel: () => void

  // Status Metrics
  projectName?: string | null
  branchName?: string
  todos?: TodoItem[]
  sources?: string[]
  diffs?: ChatDiffSnapshot | null
  sessionTokenTotals?: SessionTokenTotals | null
  progressPopoverOpen?: boolean
  diagnosticsPanelOpen?: boolean
  onToggleProgressPopover?: () => void
  onToggleGitPanel?: () => void
  onToggleDiagnosticsPanel?: () => void
}

export const ChatInputDock = memo(function ChatInputDock({
  inputRef,
  onLayoutChange,
  chatInputRef,
  chatInputElementRef,
  activeChatId,
  previousPrompt,
  hasSelectedProject,
  runtimeStatus,
  canCancel,
  projectId,
  activeProvider,
  availableProviders,
  contextWindowSnapshot,
  onSubmit,
  onCancel,

  projectName,
  branchName,
  todos,
  sources,
  diffs,
  sessionTokenTotals,
  progressPopoverOpen,
  diagnosticsPanelOpen,
  onToggleProgressPopover,
  onToggleGitPanel,
  onToggleDiagnosticsPanel,
}: ChatInputDockProps) {
  return (
    <div className="absolute bottom-0 left-0 right-0 z-20 pointer-events-none">
      <div className="bg-gradient-to-t from-background via-background pointer-events-auto" ref={inputRef}>
        <ChatInput
          ref={chatInputRef}
          inputElementRef={chatInputElementRef}
          onLayoutChange={onLayoutChange}
          key={activeChatId ?? "new-chat"}
          onSubmit={onSubmit}
          onCancel={onCancel}
          disabled={!hasSelectedProject}
          canCancel={canCancel}
          chatId={activeChatId}
          projectId={projectId}
          activeProvider={activeProvider}
          availableProviders={availableProviders}
          contextWindowSnapshot={contextWindowSnapshot}
          previousPrompt={previousPrompt}

          projectName={projectName}
          branchName={branchName}
          todos={todos}
          sources={sources}
          diffs={diffs}
          sessionTokenTotals={sessionTokenTotals}
          progressPopoverOpen={progressPopoverOpen}
          diagnosticsPanelOpen={diagnosticsPanelOpen}
          onToggleProgressPopover={onToggleProgressPopover}
          onToggleGitPanel={onToggleGitPanel}
          onToggleDiagnosticsPanel={onToggleDiagnosticsPanel}
        />
      </div>
    </div>
  )
})
