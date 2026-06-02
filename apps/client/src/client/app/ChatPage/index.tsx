import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ComponentProps, type CSSProperties, type DragEvent, type ReactNode, type RefObject } from "react"
import { type LegendListRef } from "@legendapp/list/react"
import { WorkflowTrackerPanel } from "@kanna/workflow-tracker"
import type { WorkflowArtifactImpact, WorkflowArtifactRef, WorkflowDefinitionSummary, WorkflowRunProjection, WorkflowNode } from "@kanna/shared/types"
import type { GroupImperativeHandle } from "react-resizable-panels"
import { useOutletContext } from "react-router-dom"
import type { ChatInputHandle } from "../../components/chat-ui/ChatInput"
import { ChatNavbar } from "../../components/chat-ui/ChatNavbar"
import { BrowserPanel } from "../../components/chat-ui/BrowserPanel"
import { MarkdownSlideViewer } from "../../components/chat-ui/MarkdownSlideViewer"
import { GitPanel } from "../../components/chat-ui/GitPanel"
import { useAppDialog } from "../../components/ui/app-dialog"
import { Card, CardContent } from "../../components/ui/card"
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "../../components/ui/resizable"
import { actionMatchesEvent, getResolvedKeybindings } from "../../lib/keybindings"
import { deriveLatestContextWindowSnapshot } from "../../lib/contextWindow"
import { cn } from "../../lib/utils"
import {
  DEFAULT_RIGHT_SIDEBAR_SIZE,
  DEFAULT_RIGHT_SIDEBAR_VISIBILITY_STATE,
  RIGHT_SIDEBAR_MIN_WIDTH_PX,
  useRightSidebarStore,
} from "../../stores/rightSidebarStore"
import { DEFAULT_PROJECT_TERMINAL_LAYOUT, useTerminalLayoutStore } from "../../stores/terminalLayoutStore"
import { useTerminalPreferencesStore } from "../../stores/terminalPreferencesStore"
import { shouldCloseTerminalPane } from "../terminalLayoutResize"
import { TERMINAL_TOGGLE_ANIMATION_DURATION_MS } from "../terminalToggleAnimation"
import { useRightSidebarToggleAnimation } from "../useRightSidebarToggleAnimation"
import { useStickyChatFocus } from "../useStickyChatFocus"
import { useTerminalToggleAnimation } from "../useTerminalToggleAnimation"
import type { KannaState } from "../useKannaState"
import { getNextMeasuredInputHeight, getTranscriptPaddingBottom } from "../useKannaState"
import { ChatInputDock } from "./ChatInputDock"
import { ChatTranscriptViewport } from "./ChatTranscriptViewport"
import { TerminalWorkspaceShell } from "./TerminalWorkspaceShell"
import { useChatPageSidebarActions, EMPTY_DIFF_SNAPSHOT } from "./useChatPageSidebarActions"
import {
  EMPTY_STATE_TEXT,
  EMPTY_STATE_TYPING_INTERVAL_MS,
  hasFileDragTypes,
  sameContextWindowSnapshot,
} from "./utils"

export {
  getIgnoreFolderEntryFromDiffPath,
  hasFileDragTypes,
  shouldAutoFollowTranscriptResize,
} from "./utils"

function useEmptyStateTyping(showEmptyState: boolean, activeChatId: string | null) {
  const [typedEmptyStateText, setTypedEmptyStateText] = useState("")
  const [isEmptyStateTypingComplete, setIsEmptyStateTypingComplete] = useState(false)

  useEffect(() => {
    if (!showEmptyState) return

    setTypedEmptyStateText("")
    setIsEmptyStateTypingComplete(false)

    let characterIndex = 0
    const interval = window.setInterval(() => {
      characterIndex += 1
      setTypedEmptyStateText(EMPTY_STATE_TEXT.slice(0, characterIndex))

      if (characterIndex >= EMPTY_STATE_TEXT.length) {
        window.clearInterval(interval)
        setIsEmptyStateTypingComplete(true)
      }
    }, EMPTY_STATE_TYPING_INTERVAL_MS)

    return () => window.clearInterval(interval)
  }, [showEmptyState, activeChatId])

  return { typedEmptyStateText, isEmptyStateTypingComplete }
}

function usePageFileDrop(args: {
  hasSelectedProject: boolean
  onFilesDropped: (files: File[]) => void
}) {
  const [isPageFileDragActive, setIsPageFileDragActive] = useState(false)
  const pageFileDragDepthRef = useRef(0)

  const hasDraggedFiles = useCallback((event: DragEvent) => hasFileDragTypes(event.dataTransfer?.types ?? []), [])

  const handleTranscriptDragEnter = useCallback((event: DragEvent) => {
    if (!hasDraggedFiles(event) || !args.hasSelectedProject) return
    event.preventDefault()
    pageFileDragDepthRef.current += 1
    setIsPageFileDragActive(true)
  }, [args.hasSelectedProject, hasDraggedFiles])

  const handleTranscriptDragOver = useCallback((event: DragEvent) => {
    if (!hasDraggedFiles(event) || !args.hasSelectedProject) return
    event.preventDefault()
    event.dataTransfer.dropEffect = "copy"
    if (!isPageFileDragActive) {
      setIsPageFileDragActive(true)
    }
  }, [args.hasSelectedProject, hasDraggedFiles, isPageFileDragActive])

  const handleTranscriptDragLeave = useCallback((event: DragEvent) => {
    if (!hasDraggedFiles(event) || !args.hasSelectedProject) return
    event.preventDefault()
    pageFileDragDepthRef.current = Math.max(0, pageFileDragDepthRef.current - 1)
    if (pageFileDragDepthRef.current === 0) {
      setIsPageFileDragActive(false)
    }
  }, [args.hasSelectedProject, hasDraggedFiles])

  const handleTranscriptDrop = useCallback((event: DragEvent) => {
    if (!hasDraggedFiles(event) || !args.hasSelectedProject) return
    event.preventDefault()
    pageFileDragDepthRef.current = 0
    setIsPageFileDragActive(false)
    args.onFilesDropped([...event.dataTransfer.files])
  }, [args, hasDraggedFiles])

  return {
    isPageFileDragActive,
    handleTranscriptDragEnter,
    handleTranscriptDragOver,
    handleTranscriptDragLeave,
    handleTranscriptDrop,
  }
}

function useLayoutWidth(ref: RefObject<HTMLDivElement | null>) {
  const [layoutWidth, setLayoutWidth] = useState(0)

  useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const updateWidth = () => {
      const nextWidth = element.clientWidth
      setLayoutWidth((current) => (Math.abs(current - nextWidth) < 1 ? current : nextWidth))
    }

    const observer = new ResizeObserver(updateWidth)
    observer.observe(element)
    updateWidth()

    return () => observer.disconnect()
  }, [ref])

  return layoutWidth
}

function useTranscriptPaddingBottom() {
  const inputRef = useRef<HTMLDivElement>(null)
  const [inputHeight, setInputHeight] = useState(148)

  const syncInputHeight = useCallback(() => {
    const element = inputRef.current
    if (!element) return
    const measuredHeight = element.getBoundingClientRect().height
    setInputHeight((current) => getNextMeasuredInputHeight(current, measuredHeight))
  }, [])

  useLayoutEffect(() => {
    const element = inputRef.current
    if (!element) return

    const observer = new ResizeObserver(() => {
      syncInputHeight()
    })
    observer.observe(element)
    syncInputHeight()
    return () => observer.disconnect()
  }, [syncInputHeight])

  return {
    inputRef,
    syncInputHeight,
    transcriptPaddingBottom: getTranscriptPaddingBottom(inputHeight),
  }
}

const MOBILE_RIGHT_SIDEBAR_BREAKPOINT_PX = 768
const RIGHT_SIDEBAR_MIN_WORKSPACE_SIZE_PERCENT = 20
const RIGHT_SIDEBAR_MAX_SIZE_PERCENT = 100 - RIGHT_SIDEBAR_MIN_WORKSPACE_SIZE_PERCENT

export function shouldUseMobileRightSidebarOverlay(viewportWidth: number) {
  return viewportWidth > 0 && viewportWidth < MOBILE_RIGHT_SIDEBAR_BREAKPOINT_PX
}

export function getRightSidebarSizePercent(sizePx: number, layoutWidth: number) {
  if (!Number.isFinite(sizePx) || !Number.isFinite(layoutWidth) || layoutWidth <= 0) {
    return 0
  }

  const minSizePercent = (RIGHT_SIDEBAR_MIN_WIDTH_PX / layoutWidth) * 100
  const requestedSizePercent = (Math.max(RIGHT_SIDEBAR_MIN_WIDTH_PX, sizePx) / layoutWidth) * 100
  return Math.min(RIGHT_SIDEBAR_MAX_SIZE_PERCENT, Math.max(minSizePercent, requestedSizePercent))
}

export function getRightSidebarSizePx(sizePercent: number, layoutWidth: number) {
  if (!Number.isFinite(sizePercent) || !Number.isFinite(layoutWidth) || layoutWidth <= 0) {
    return DEFAULT_RIGHT_SIDEBAR_SIZE
  }

  return Math.max(RIGHT_SIDEBAR_MIN_WIDTH_PX, layoutWidth * (sizePercent / 100))
}

function useMobileRightSidebarOverlayEnabled() {
  const [viewportWidth, setViewportWidth] = useState(() => (typeof window === "undefined" ? 0 : window.innerWidth))

  useEffect(() => {
    if (typeof window === "undefined") return

    const updateViewportWidth = () => setViewportWidth(window.innerWidth)
    updateViewportWidth()
    window.addEventListener("resize", updateViewportWidth)
    return () => window.removeEventListener("resize", updateViewportWidth)
  }, [])

  return shouldUseMobileRightSidebarOverlay(viewportWidth)
}

function useFixedTerminalHeight(args: {
  layoutRootRef: RefObject<HTMLDivElement | null>
  shouldRenderTerminalLayout: boolean
  terminalMainSizes: [number, number]
}) {
  const [fixedTerminalHeight, setFixedTerminalHeight] = useState(0)

  useEffect(() => {
    const element = args.layoutRootRef.current
    if (!element) return

    const updateHeight = () => {
      const containerHeight = element.getBoundingClientRect().height

      if (!args.shouldRenderTerminalLayout) {
        return
      }

      if (containerHeight <= 0) return
      const nextHeight = containerHeight * (args.terminalMainSizes[1] / 100)
      if (nextHeight <= 0) return
      setFixedTerminalHeight((current) => (Math.abs(current - nextHeight) < 1 ? current : nextHeight))
    }

    const observer = new ResizeObserver(updateHeight)
    observer.observe(element)
    updateHeight()

    return () => observer.disconnect()
  }, [args.layoutRootRef, args.shouldRenderTerminalLayout, args.terminalMainSizes])

  return fixedTerminalHeight
}

interface ChatWorkspaceProps {
  chatCard: ReactNode
  projectId: string
  shouldRenderTerminalLayout: boolean
  showTerminalPane: boolean
  terminalLayout: ReturnType<typeof useTerminalLayoutStore.getState>["projects"][string]
  mainPanelGroupRef: RefObject<GroupImperativeHandle | null>
  terminalPanelRef: RefObject<HTMLDivElement | null>
  terminalVisualRef: RefObject<HTMLDivElement | null>
  fixedTerminalHeight: number
  terminalFocusRequestVersion: number
  addTerminal: ReturnType<typeof useTerminalLayoutStore.getState>["addTerminal"]
  socket: KannaState["socket"]
  connectionStatus: KannaState["connectionStatus"]
  scrollback: number
  minColumnWidth: number
  splitTerminalShortcut?: string[]
  pendingCommandsByTerminalId?: Record<string, string>
  onTerminalCommandSent?: () => void
  onInitialTerminalCommandSent?: (terminalId: string) => void
  onRemoveTerminal: (projectId: string, terminalId: string) => void
  onTerminalLayout: ReturnType<typeof useTerminalLayoutStore.getState>["setTerminalSizes"]
  onLayoutChanged: (layout: Record<string, number>) => void
}

type ChatSidebarContentProps = ComponentProps<typeof GitPanel>

const ChatSidebarContent = memo(function ChatSidebarContent(props: ChatSidebarContentProps) {
  return (
    <GitPanel
      {...props}
      diffs={props.diffs ?? EMPTY_DIFF_SNAPSHOT}
    />
  )
})

export function getTerminalPanelDefaultSizes(showTerminalPane: boolean, mainSizes: [number, number]): [number, number] {
  return showTerminalPane ? mainSizes : [100, 0]
}

interface DesktopSidebarPaneProps {
  showRightSidebar: boolean
  sizePercent: number
  sidebarPanelRef: RefObject<HTMLDivElement | null>
  sidebarVisualRef: RefObject<HTMLDivElement | null>
  content: ReactNode
}

const DesktopSidebarPane = memo(function DesktopSidebarPane({
  showRightSidebar,
  sizePercent,
  sidebarPanelRef,
  sidebarVisualRef,
  content,
}: DesktopSidebarPaneProps) {
  return (
    <ResizablePanel
      id="rightSidebar"
      defaultSize={`${sizePercent}%`}
      className="min-h-0 min-w-0"
      elementRef={sidebarPanelRef}
      groupResizeBehavior="preserve-pixel-size"
    >
      <div
        ref={sidebarVisualRef}
        className="h-full min-h-0 overflow-hidden"
        data-right-sidebar-open={showRightSidebar ? "true" : "false"}
        data-right-sidebar-animated="false"
        data-right-sidebar-visual
        style={{
          "--terminal-toggle-duration": `${TERMINAL_TOGGLE_ANIMATION_DURATION_MS}ms`,
        } as CSSProperties}
      >
        {content}
      </div>
    </ResizablePanel>
  )
})

interface MobileSidebarPaneProps {
  projectId: string | null
  showRightSidebar: boolean
  sidebarVisualRef: RefObject<HTMLDivElement | null>
  onClose: () => void
  content: ReactNode
}

const MobileSidebarPane = memo(function MobileSidebarPane({
  projectId,
  showRightSidebar,
  sidebarVisualRef,
  onClose,
  content,
}: MobileSidebarPaneProps) {
  if (!projectId) {
    return null
  }

  return (
    <div
      className={cn(
        "absolute inset-0 z-40 transition-opacity duration-300 ease-out",
        showRightSidebar ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      aria-hidden={showRightSidebar ? undefined : true}
      data-mobile-right-sidebar-overlay
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/45 backdrop-blur-[1px]"
        aria-label="Close changes sidebar"
        onClick={onClose}
      />
      <div
        ref={sidebarVisualRef}
        className={cn(
          "absolute inset-y-0 right-0 flex w-[min(92vw,30rem)] max-w-full min-h-0 flex-col overflow-hidden border-l border-border bg-background shadow-2xl transition-transform duration-300 ease-out",
          "pt-[max(env(safe-area-inset-top),0px)] pb-[max(env(safe-area-inset-bottom),0px)]",
          showRightSidebar ? "translate-x-0" : "translate-x-full",
        )}
        data-right-sidebar-open={showRightSidebar ? "true" : "false"}
        data-right-sidebar-animated="false"
        data-right-sidebar-visual
      >
        {content}
      </div>
    </div>
  )
})

function ChatWorkspace({
  chatCard,
  projectId,
  shouldRenderTerminalLayout,
  showTerminalPane,
  terminalLayout,
  mainPanelGroupRef,
  terminalPanelRef,
  terminalVisualRef,
  fixedTerminalHeight,
  terminalFocusRequestVersion,
  addTerminal,
  socket,
  connectionStatus,
  scrollback,
  minColumnWidth,
  splitTerminalShortcut,
  pendingCommandsByTerminalId,
  onTerminalCommandSent,
  onInitialTerminalCommandSent,
  onRemoveTerminal,
  onTerminalLayout,
  onLayoutChanged,
}: ChatWorkspaceProps) {
  if (!shouldRenderTerminalLayout) {
    return <>{chatCard}</>
  }

  const terminalPanelDefaultSizes = getTerminalPanelDefaultSizes(showTerminalPane, terminalLayout.mainSizes)

  return (
    <ResizablePanelGroup
      key={projectId}
      groupRef={mainPanelGroupRef}
      orientation="vertical"
      className="flex-1 min-h-0"
      onLayoutChanged={onLayoutChanged}
    >
      <ResizablePanel id="chat" defaultSize={`${terminalPanelDefaultSizes[0]}%`} minSize="25%" className="min-h-0">
        {chatCard}
      </ResizablePanel>
      <ResizableHandle
        withHandle
        orientation="vertical"
        disabled={!showTerminalPane}
        className={cn(!showTerminalPane && "pointer-events-none opacity-0")}
      />
      <ResizablePanel
        id="terminal"
        defaultSize={`${terminalPanelDefaultSizes[1]}%`}
        minSize="0%"
        className="min-h-0"
        elementRef={terminalPanelRef}
      >
        <div
          ref={terminalVisualRef}
          className="h-full min-h-0 overflow-hidden relative"
          data-terminal-open={showTerminalPane ? "true" : "false"}
          data-terminal-animated="false"
          data-terminal-visual
          style={{
            "--terminal-toggle-duration": `${TERMINAL_TOGGLE_ANIMATION_DURATION_MS}ms`,
          } as CSSProperties}
        >
          <TerminalWorkspaceShell
            projectId={projectId}
            fixedTerminalHeight={fixedTerminalHeight}
            terminalLayout={terminalLayout}
            addTerminal={addTerminal}
            socket={socket}
            connectionStatus={connectionStatus}
            scrollback={scrollback}
            minColumnWidth={minColumnWidth}
            splitTerminalShortcut={splitTerminalShortcut}
            pendingCommandsByTerminalId={pendingCommandsByTerminalId}
            focusRequestVersion={terminalFocusRequestVersion}
            onTerminalCommandSent={onTerminalCommandSent}
            onInitialTerminalCommandSent={onInitialTerminalCommandSent}
            onRemoveTerminal={onRemoveTerminal}
            onTerminalLayout={onTerminalLayout}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

export function ChatPage() {
  const state = useOutletContext<KannaState>()
  const dialog = useAppDialog()
  const layoutRootRef = useRef<HTMLDivElement>(null)
  const transcriptListRef = useRef<LegendListRef | null>(null)
  const isAtEndRef = useRef(true)
  const showScrollTimeoutRef = useRef<number | null>(null)
  const chatCardRef = useRef<HTMLDivElement>(null)
  const chatInputElementRef = useRef<HTMLTextAreaElement>(null)
  const chatInputRef = useRef<ChatInputHandle | null>(null)
  const { inputRef, syncInputHeight, transcriptPaddingBottom } = useTranscriptPaddingBottom()
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const [pendingTerminalCommands, setPendingTerminalCommands] = useState<Record<string, string>>({})
  const [workflowProjection, setWorkflowProjection] = useState<WorkflowRunProjection | null>(null)
  const [workflowDefinitions, setWorkflowDefinitions] = useState<WorkflowDefinitionSummary[]>([])
  const [proposedManifest, setProposedManifest] = useState<import("@kanna/shared/workflow-schema").WorkflowManifest | null>(null)
  const [isStartingWorkflow, setIsStartingWorkflow] = useState(false)
  const showEmptyState = state.messages.length === 0 && state.runtime?.title === "New Chat"
  const projectId = state.activeProjectId
  const projectTerminalLayout = useTerminalLayoutStore((store) => (projectId ? store.projects[projectId] : undefined))
  const terminalLayout = projectTerminalLayout ?? DEFAULT_PROJECT_TERMINAL_LAYOUT
  const projectRightSidebarVisibility = useRightSidebarStore((store) => (projectId ? store.projects[projectId] : undefined))
  const rightSidebarVisibility = projectRightSidebarVisibility ?? DEFAULT_RIGHT_SIDEBAR_VISIBILITY_STATE
  const globalRightSidebarSize = useRightSidebarStore((store) => store.size)
  const addTerminal = useTerminalLayoutStore((store) => store.addTerminal)
  const removeTerminal = useTerminalLayoutStore((store) => store.removeTerminal)
  const toggleVisibility = useTerminalLayoutStore((store) => store.toggleVisibility)
  const resetMainSizes = useTerminalLayoutStore((store) => store.resetMainSizes)
  const setMainSizes = useTerminalLayoutStore((store) => store.setMainSizes)
  const setTerminalSizes = useTerminalLayoutStore((store) => store.setTerminalSizes)

  // Demo listener for mock proposed manifest
  useEffect(() => {
    const handleMockManifest = () => {
      setProposedManifest({
        version: "v3.0",
        name: "create-lesson",
        description: "Sản xuất LESSON canonical gồm PLAN + LESSON FLOW.",
        artifacts: [
          { id: "lesson", name: "LESSON", pattern: "LESSON_*.md", dependencies: [] },
          { id: "act", name: "ACT", pattern: "ACT_*.md", dependencies: [{ sourcePattern: "LESSON_*.md", relationship: "derives_from" }] },
        ]
      })
    }
    document.addEventListener("kanna:mock_proposed_manifest", handleMockManifest)
    return () => document.removeEventListener("kanna:mock_proposed_manifest", handleMockManifest)
  }, [])

  const toggleRightPanel = useRightSidebarStore((store) => store.togglePanel)
  const hideRightPanel = useRightSidebarStore((store) => store.hidePanel)
  const setRightSidebarSize = useRightSidebarStore((store) => store.setSize)
  const projectUiState = useRightSidebarStore((store) => (projectId ? store.projectUi[projectId] : undefined))
  const setWorkflowDensityMode = useRightSidebarStore((store) => store.setWorkflowDensityMode)
  const scrollback = useTerminalPreferencesStore((store) => store.scrollbackLines)
  const minColumnWidth = useTerminalPreferencesStore((store) => store.minColumnWidth)
  const editorPreset = useTerminalPreferencesStore((store) => store.editorPreset)
  const editorCommandTemplate = useTerminalPreferencesStore((store) => store.editorCommandTemplate)
  const resolvedKeybindings = useMemo(() => getResolvedKeybindings(state.keybindings), [state.keybindings])
  const baseContextWindowSnapshotRef = useRef<ReturnType<typeof deriveLatestContextWindowSnapshot>>(null)
  useEffect(() => {
    if (!projectId) {
      setWorkflowProjection(null)
      setWorkflowDefinitions([])
      return
    }

    let disposed = false
    void state.socket.command<WorkflowDefinitionSummary[]>({ type: "workflow.listDefinitions", projectId })
      .then((definitions) => {
        if (!disposed) setWorkflowDefinitions(definitions)
      })
      .catch(() => {
        if (!disposed) setWorkflowDefinitions([])
      })

    const unsubscribe = state.socket.subscribe<WorkflowRunProjection | null>(
      { type: "project-workflow", projectId },
      setWorkflowProjection
    )

    return () => {
      disposed = true
      unsubscribe()
    }
  }, [projectId, state.socket])

  const handleStartWorkflow = useCallback(async (definition: WorkflowDefinitionSummary) => {
    if (!projectId) return
    setIsStartingWorkflow(true)
    try {
      const projection = await state.socket.command<WorkflowRunProjection>({
        type: "workflow.startRun",
        projectId,
        workflowDefinitionId: definition.id,
        chatId: state.activeChatId ?? undefined,
        input: {
          startedFrom: "workflow-sidebar",
        },
      })
      setWorkflowProjection(projection)
      toggleRightPanel(projectId, "workflow")
      await state.socket.command({
        type: "chat.send",
        chatId: state.activeChatId ?? undefined,
        projectId: state.activeChatId ? undefined : projectId,
        content: [
          `Run workflow: ${definition.name} (${definition.workflowType}).`,
          "",
          "Use the imported workflow definition as the source of truth.",
          "Keep chat updates focused on what the agent is doing now.",
          "Emit progress naturally through file/tool activity so the workflow sidebar can track nodes, artifacts, and downstream impact.",
        ].join("\n"),
        provider: state.runtime?.provider ?? undefined,
        planMode: state.runtime?.planMode ?? undefined,
      })
    } finally {
      setIsStartingWorkflow(false)
    }
  }, [projectId, state.activeChatId, state.runtime?.planMode, state.runtime?.provider, state.socket, toggleRightPanel])

  const sendWorkflowAgentRequest = useCallback(async (content: string) => {
    if (!projectId) return
    await state.socket.command({
      type: "chat.send",
      chatId: state.activeChatId ?? undefined,
      projectId: state.activeChatId ? undefined : projectId,
      content,
      provider: state.runtime?.provider ?? undefined,
      planMode: state.runtime?.planMode ?? undefined,
    })
  }, [projectId, state.activeChatId, state.runtime?.planMode, state.runtime?.provider, state.socket])

  const handleReviewDownstream = useCallback((artifact: WorkflowArtifactRef) => {
    if (projectId) {
      void state.socket.command({
        type: "workflow.updateArtifactImpact",
        projectId,
        runId: workflowProjection?.id,
        sourceArtifactId: artifact.id,
        status: "needs_review",
        reason: `User requested downstream review for ${artifact.path}.`,
      })
    }
    void sendWorkflowAgentRequest([
      `Review downstream artifacts impacted by ${artifact.path}.`,
      "",
      "Use the workflow artifact dependency semantics:",
      "- Identify direct and transitive downstream artifacts.",
      "- Mark each as reviewed_ok, needs_repair, or maybe_impacted.",
      "- Repair only when necessary and explain what changed.",
    ].join("\n"))
  }, [projectId, sendWorkflowAgentRequest, state.socket, workflowProjection?.id])

  const handleRerunNode = useCallback((node: WorkflowNode) => {
    void sendWorkflowAgentRequest(`Rerun the workflow node: ${node.name}.`)
  }, [sendWorkflowAgentRequest])

  const handleRerunArtifact = useCallback((artifact: WorkflowArtifactRef) => {
    if (projectId) {
      void state.socket.command({
        type: "workflow.markArtifact",
        projectId,
        artifactId: artifact.id,
        action: "invalidate",
        reason: `User requested rerun for ${artifact.path}.`,
      })
    }
    void sendWorkflowAgentRequest(`Rerun the steps to produce the artifact: ${artifact.path}.`)
  }, [projectId, sendWorkflowAgentRequest, state.socket])

  const handleViewArtifact = useCallback((artifact: WorkflowArtifactRef) => {
    if (!projectId) return
    const activeProjectPath = state.sidebarData.projectGroups
      .flatMap((group) => [group, ...[]])
      .find((group) => group.groupKey === projectId || group.chats.some((chat) => chat.chatId === state.activeChatId) || group.previewChats.some((chat) => chat.chatId === state.activeChatId))
      ?.localPath
    const localPath = artifact.path.startsWith("/")
      ? artifact.path
      : activeProjectPath
        ? `${activeProjectPath}/${artifact.path}`
        : ""
    if (!localPath || localPath === `/${artifact.path}`) {
      void dialog.alert({
        title: "Artifact path unavailable",
        description: `Cannot resolve ${artifact.path} to a local file yet.`,
      })
      return
    }
    void state.socket.command({
      type: "system.openExternal",
      localPath,
      action: "open_editor",
    }).catch((error) => {
      void dialog.alert({
        title: "Cannot open artifact",
        description: error instanceof Error ? error.message : String(error),
      })
    })
  }, [dialog, projectId, state.activeChatId, state.sidebarData.projectGroups, state.socket])

  const handleRegenerateArtifact = useCallback((artifact: WorkflowArtifactRef) => {
    if (projectId) {
      void state.socket.command({
        type: "workflow.markArtifact",
        projectId,
        artifactId: artifact.id,
        action: "invalidate",
        reason: `User requested regeneration for ${artifact.path}.`,
      })
    }
    void sendWorkflowAgentRequest(`Regenerate the artifact: ${artifact.path}.`)
  }, [projectId, sendWorkflowAgentRequest, state.socket])

  const handleInvalidateArtifact = useCallback((artifact: WorkflowArtifactRef) => {
    if (projectId) {
      void state.socket.command({
        type: "workflow.markArtifact",
        projectId,
        artifactId: artifact.id,
        action: "invalidate",
        reason: `User invalidated ${artifact.path}.`,
      })
    }
    void sendWorkflowAgentRequest(`Invalidate the artifact: ${artifact.path}. Mark it as dirty or out-of-date, and check if any downstream artifacts need to be reviewed.`)
  }, [projectId, sendWorkflowAgentRequest, state.socket])

  const handleAcceptArtifact = useCallback((artifact: WorkflowArtifactRef) => {
    if (projectId) {
      void state.socket.command({
        type: "workflow.markArtifact",
        projectId,
        artifactId: artifact.id,
        action: "accept_source_of_truth",
        reason: `User accepted ${artifact.path} as source of truth.`,
      })
    }
    void sendWorkflowAgentRequest(`Accept the artifact: ${artifact.path} as the current source of truth. Mark it as reviewed and ok.`)
  }, [projectId, sendWorkflowAgentRequest, state.socket])

  const handleRepairDownstream = useCallback((artifact: WorkflowArtifactRef, impacted: WorkflowArtifactRef[]) => {
    if (projectId) {
      for (const impactedArtifact of impacted) {
        void state.socket.command({
          type: "workflow.updateArtifactImpact",
          projectId,
          runId: workflowProjection?.id,
          sourceArtifactId: artifact.id,
          impactedArtifactId: impactedArtifact.id,
          status: "needs_repair",
          reason: `User requested repair because ${impactedArtifact.path} depends on ${artifact.path}.`,
        })
      }
    }
    const list = impacted.map((art) => `- ${art.path}`).join("\n")
    void sendWorkflowAgentRequest([
      `Repair the downstream artifacts impacted by ${artifact.path}.`,
      "",
      "The following downstream artifacts must be repaired:",
      list || "- (No downstream artifacts calculated)",
      "",
      "Re-evaluate and rebuild these artifacts to ensure correctness and alignment.",
    ].join("\n"))
  }, [projectId, sendWorkflowAgentRequest, state.socket, workflowProjection?.id])

  const handlePublishWorkflow = useCallback(async (manifest: import("@kanna/shared/workflow-schema").WorkflowManifest) => {
    if (!projectId) return
    try {
      const published = await state.socket.command<WorkflowDefinitionSummary>({
        type: "workflow.publishManifest",
        projectId,
        manifest,
        sourceMarkdown: JSON.stringify(manifest, null, 2),
      })
      setWorkflowDefinitions((definitions) => {
        const rest = definitions.filter((definition) => definition.id !== published.id)
        return [...rest, published]
      })
      setProposedManifest(null)
      toggleRightPanel(projectId, "workflow")
    } catch (err) {
      console.error("Failed to publish workflow manifest:", err)
    }
  }, [projectId, state.socket, toggleRightPanel])

  const handleRejectWorkflow = useCallback(() => {
    console.log("Reject proposed manifest")
    setProposedManifest(null)
  }, [])

  const handleRecoverLock = useCallback((lockId: string) => {
    if (projectId) {
      void state.socket.command({
        type: "workflow.recoverLock",
        projectId,
        lockId,
      })
    }
  }, [projectId, state.socket])

  const handleRegisterPack = useCallback(async (packId: string) => {
    if (!projectId) return
    try {
      await state.socket.command({
        type: "project.registerPack",
        projectId,
        packId,
      })
      const definitions = await state.socket.command<WorkflowDefinitionSummary[]>({ type: "workflow.listDefinitions", projectId })
      setWorkflowDefinitions(definitions)
      if (workflowProjection) {
        const projection = await state.socket.command<WorkflowRunProjection>({ type: "workflow.getProjection", projectId })
        if (projection) setWorkflowProjection(projection)
      }
    } catch (err) {
      console.error("Failed to register pack:", err)
    }
  }, [projectId, state.socket, workflowProjection])

  const handleAddFlowEdge = useCallback(async (sourceId: string, targetId: string) => {
    if (!projectId) return
    try {
      await state.socket.command({
        type: "project.addFlowEdge",
        projectId,
        sourceWorkflowDefinitionId: sourceId,
        targetWorkflowDefinitionId: targetId,
        provenance: "explicit_user",
      })
    } catch (err) {
      console.error("Failed to add flow edge:", err)
    }
  }, [projectId, state.socket])

  const handleRemoveFlowEdge = useCallback(async (sourceId: string, targetId: string) => {
    if (!projectId) return
    try {
      await state.socket.command({
        type: "project.removeFlowEdge",
        projectId,
        sourceWorkflowDefinitionId: sourceId,
        targetWorkflowDefinitionId: targetId,
        provenance: "explicit_user",
      })
    } catch (err) {
      console.error("Failed to remove flow edge:", err)
    }
  }, [projectId, state.socket])

  const handleApproveFlowEdge = useCallback(async (edgeId: string) => {
    if (!projectId) return
    try {
      await state.socket.command({
        type: "project.approveFlowEdge",
        projectId,
        edgeId,
      })
    } catch (err) {
      console.error("Failed to approve flow edge:", err)
    }
  }, [projectId, state.socket])

  const handleRejectFlowEdge = useCallback(async (edgeId: string) => {
    if (!projectId) return
    try {
      await state.socket.command({
        type: "project.rejectFlowEdge",
        projectId,
        edgeId,
      })
    } catch (err) {
      console.error("Failed to reject flow edge:", err)
    }
  }, [projectId, state.socket])

  const contextWindowSnapshot = useMemo(() => {
    const derivedSnapshot = deriveLatestContextWindowSnapshot(state.chatSnapshot?.messages ?? [])
    const previousSnapshot = baseContextWindowSnapshotRef.current
    if (sameContextWindowSnapshot(previousSnapshot, derivedSnapshot)) {
      return previousSnapshot
    }
    baseContextWindowSnapshotRef.current = derivedSnapshot
    return derivedSnapshot
  }, [state.chatSnapshot?.messages])

  const hasTerminals = terminalLayout.terminals.length > 0
  const showTerminalPane = Boolean(projectId && terminalLayout.isVisible && hasTerminals)
  const shouldRenderTerminalLayout = Boolean(projectId && hasTerminals)
  const activeRightPanel = projectId ? rightSidebarVisibility.rightPanel : "hidden"
  const showRightSidebar = Boolean(projectId && activeRightPanel !== "hidden")
  const showGitPanel = Boolean(projectId && activeRightPanel === "git")
  const shouldRenderRightSidebarLayout = Boolean(projectId)
  const isMobileRightSidebarOverlay = useMobileRightSidebarOverlayEnabled()
  const shouldRenderDesktopRightSidebarLayout = shouldRenderRightSidebarLayout && !isMobileRightSidebarOverlay
  const layoutWidth = useLayoutWidth(layoutRootRef)
  const effectiveRightSidebarSize = getRightSidebarSizePercent(
    globalRightSidebarSize ?? DEFAULT_RIGHT_SIDEBAR_SIZE,
    layoutWidth,
  )
  const fixedTerminalHeight = useFixedTerminalHeight({
    layoutRootRef,
    shouldRenderTerminalLayout,
    terminalMainSizes: terminalLayout.mainSizes,
  })

  const {
    isAnimating: isTerminalAnimating,
    mainPanelGroupRef,
    terminalFocusRequestVersion,
    terminalPanelRef,
    terminalVisualRef,
  } = useTerminalToggleAnimation({
    showTerminalPane,
    shouldRenderTerminalLayout,
    projectId,
    terminalLayout,
    chatInputRef: chatInputElementRef,
  })
  const {
    isAnimating: isRightSidebarAnimating,
    panelGroupRef: rightSidebarPanelGroupRef,
    sidebarPanelRef,
    sidebarVisualRef,
  } = useRightSidebarToggleAnimation({
    projectId,
    shouldRenderRightSidebarLayout: shouldRenderDesktopRightSidebarLayout,
    showRightSidebar,
    rightSidebarSizePercent: effectiveRightSidebarSize,
  })

  const {
    diffRenderMode,
    wrapDiffLines,
    setDiffRenderMode,
    setWrapDiffLines,
    scheduleTerminalDiffRefresh,
    handleOpenDiffFile,
    handleCopyDiffFilePath,
    handleCopyDiffRelativePath,
    handleLoadDiffPatch,
    handleDiscardDiffFile,
    handleIgnoreDiffFile,
    handleIgnoreDiffFolder,
    handleOpenDiffInFinder,
    handleCommitDiffs,
    handleSyncBranch,
    handleGenerateCommitMessage,
    handleInitializeGit,
    handleGetGitHubPublishInfo,
    handleCheckGitHubRepoAvailability,
    handleSetupGitHub,
    handleListBranches,
    handleCheckoutBranch,
    handlePreviewMergeBranch,
    handleMergeBranch,
    handleCreateBranch,
  } = useChatPageSidebarActions({
    state,
    projectId,
    showRightSidebar: showGitPanel,
  })

  const { typedEmptyStateText, isEmptyStateTypingComplete } = useEmptyStateTyping(showEmptyState, state.activeChatId)

  useStickyChatFocus({
    rootRef: chatCardRef,
    fallbackRef: chatInputElementRef,
    enabled: state.hasSelectedProject,
    canCancel: state.canCancel,
  })

  const enqueueDroppedFiles = useCallback((files: File[]) => {
    if (!state.hasSelectedProject || files.length === 0) {
      return
    }
    chatInputRef.current?.enqueueFiles(files)
  }, [state.hasSelectedProject])

  const {
    isPageFileDragActive,
    handleTranscriptDragEnter,
    handleTranscriptDragOver,
    handleTranscriptDragLeave,
    handleTranscriptDrop,
  } = usePageFileDrop({
    hasSelectedProject: state.hasSelectedProject,
    onFilesDropped: enqueueDroppedFiles,
  })

  const handleToggleEmbeddedTerminal = useCallback(() => {
    if (!projectId) return
    if (hasTerminals) {
      toggleVisibility(projectId)
      return
    }

    addTerminal(projectId)
  }, [addTerminal, hasTerminals, projectId, toggleVisibility])

  const handleTerminalResize = useCallback((layout: Record<string, number>) => {
    if (!projectId || !showTerminalPane || isTerminalAnimating.current) {
      return
    }

    const chatSize = layout.chat
    const terminalSize = layout.terminal
    if (!Number.isFinite(chatSize) || !Number.isFinite(terminalSize)) {
      return
    }

    const containerHeight = layoutRootRef.current?.getBoundingClientRect().height ?? 0
    if (shouldCloseTerminalPane(containerHeight, terminalSize)) {
      resetMainSizes(projectId)
      toggleVisibility(projectId)
      return
    }

    setMainSizes(projectId, [chatSize, terminalSize])
  }, [isTerminalAnimating, projectId, resetMainSizes, setMainSizes, showTerminalPane, toggleVisibility])

  const handleCloseRightSidebar = useCallback(() => {
    if (!projectId) return
    hideRightPanel(projectId)
  }, [hideRightPanel, projectId])

  const handleToggleGitPanel = useCallback(() => {
    if (!projectId) return

    if (activeRightPanel === "git") {
      hideRightPanel(projectId)
      return
    }

    if (state.chatDiffSnapshot?.status === "no_repo") {
      void (async () => {
        const confirmed = await dialog.confirm({
          title: "Initialize Git?",
          description: "Initialize a local git repository in this project?",
          confirmLabel: "Init Git",
          cancelLabel: "Cancel",
        })
        if (!confirmed) return

        const result = await handleInitializeGit()
        if (result?.ok) {
          toggleRightPanel(projectId, "git")
        }
      })()
      return
    }

    toggleRightPanel(projectId, "git")
  }, [activeRightPanel, dialog, handleInitializeGit, hideRightPanel, projectId, state.chatDiffSnapshot?.status, toggleRightPanel])

  const handleToggleBrowserPanel = useCallback(() => {
    if (!projectId) return
    toggleRightPanel(projectId, "browser")
  }, [projectId, toggleRightPanel])

  const handleToggleSlidesPanel = useCallback(() => {
    if (!projectId) return
    toggleRightPanel(projectId, "slides")
  }, [projectId, toggleRightPanel])

  const handleToggleWorkflowPanel = useCallback(() => {
    if (!projectId) return
    toggleRightPanel(projectId, "workflow")
  }, [projectId, toggleRightPanel])

  const handleRunQuickAction = useCallback((command: string) => {
    if (!projectId) return
    const terminalId = addTerminal(projectId)
    setPendingTerminalCommands((current) => ({
      ...current,
      [terminalId]: command,
    }))
  }, [addTerminal, projectId])

  const handleInitialTerminalCommandSent = useCallback((terminalId: string) => {
    setPendingTerminalCommands((current) => {
      if (!(terminalId in current)) return current
      const { [terminalId]: _sent, ...rest } = current
      return rest
    })
  }, [])

  const handleCancel = useCallback(() => {
    void state.handleCancel()
  }, [state.handleCancel])

  const handleOpenExternal = useCallback<NonNullable<ComponentProps<typeof ChatNavbar>["onOpenExternal"]>>((action, editor) => {
    void state.handleOpenExternal(action, editor)
  }, [state.handleOpenExternal])

  const handleRemoveTerminal = useCallback((currentProjectId: string, terminalId: string) => {
    void state.socket.command({ type: "terminal.close", terminalId }).catch(() => {})
    removeTerminal(currentProjectId, terminalId)
  }, [removeTerminal, state.socket])

  const clearShowScrollTimeout = useCallback(() => {
    if (showScrollTimeoutRef.current !== null) {
      window.clearTimeout(showScrollTimeoutRef.current)
      showScrollTimeoutRef.current = null
    }
  }, [])

  const onIsAtEndChange = useCallback((isAtEnd: boolean) => {
    if (isAtEndRef.current === isAtEnd) return
    isAtEndRef.current = isAtEnd
    if (isAtEnd) {
      clearShowScrollTimeout()
      setShowScrollToBottom(false)
      return
    }

    clearShowScrollTimeout()
    showScrollTimeoutRef.current = window.setTimeout(() => {
      setShowScrollToBottom(true)
      showScrollTimeoutRef.current = null
    }, 150)
  }, [clearShowScrollTimeout])

  const syncIsAtEndFromList = useCallback(() => {
    const state = transcriptListRef.current?.getState?.()
    if (state) {
      onIsAtEndChange(state.isAtEnd)
    }
  }, [onIsAtEndChange])

  const scrollToTranscriptEnd = useCallback(async (animated = true) => {
    isAtEndRef.current = true
    clearShowScrollTimeout()
    setShowScrollToBottom(false)
    await transcriptListRef.current?.scrollToEnd?.({ animated })
  }, [clearShowScrollTimeout])

  const handleChatSubmit = useCallback(async (
    content: string,
    options?: Parameters<typeof state.handleSend>[1],
  ) => {
    await scrollToTranscriptEnd(false)
    await state.handleSend(content, options)
  }, [scrollToTranscriptEnd, state])

  useEffect(() => {
    return () => clearShowScrollTimeout()
  }, [clearShowScrollTimeout])

  useEffect(() => {
    isAtEndRef.current = true
    clearShowScrollTimeout()
    setShowScrollToBottom(false)
  }, [clearShowScrollTimeout, state.activeChatId])

  useEffect(() => {
    function handleGlobalKeydown(event: KeyboardEvent) {
      if (!projectId) return
      if (actionMatchesEvent(resolvedKeybindings, "toggleEmbeddedTerminal", event)) {
        event.preventDefault()
        handleToggleEmbeddedTerminal()
        return
      }

      if (actionMatchesEvent(resolvedKeybindings, "toggleRightSidebar", event)) {
        event.preventDefault()
        handleToggleGitPanel()
        return
      }

      if (actionMatchesEvent(resolvedKeybindings, "openInFinder", event)) {
        event.preventDefault()
        void state.handleOpenExternal("open_finder")
        return
      }

      if (actionMatchesEvent(resolvedKeybindings, "openInEditor", event)) {
        event.preventDefault()
        void state.handleOpenExternal("open_editor")
        return
      }

      if (actionMatchesEvent(resolvedKeybindings, "addSplitTerminal", event)) {
        event.preventDefault()
        addTerminal(projectId)
      }
    }

    window.addEventListener("keydown", handleGlobalKeydown)
    return () => window.removeEventListener("keydown", handleGlobalKeydown)
  }, [addTerminal, handleToggleEmbeddedTerminal, handleToggleGitPanel, projectId, resolvedKeybindings, state.handleOpenExternal])

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      syncIsAtEndFromList()
    })
    const timeoutId = window.setTimeout(() => {
      syncIsAtEndFromList()
    }, TERMINAL_TOGGLE_ANIMATION_DURATION_MS)

    return () => {
      window.cancelAnimationFrame(frameId)
      window.clearTimeout(timeoutId)
    }
  }, [shouldRenderTerminalLayout, showTerminalPane, syncIsAtEndFromList])

  useEffect(() => {
    function handleResize() {
      syncIsAtEndFromList()
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [syncIsAtEndFromList])

  useEffect(() => {
    if (!showRightSidebar || !isMobileRightSidebarOverlay) return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [isMobileRightSidebarOverlay, showRightSidebar])

  useEffect(() => {
    if (!showRightSidebar || !isMobileRightSidebarOverlay) return

    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape") return
      event.preventDefault()
      handleCloseRightSidebar()
    }

    window.addEventListener("keydown", handleEscape)
    return () => window.removeEventListener("keydown", handleEscape)
  }, [handleCloseRightSidebar, isMobileRightSidebarOverlay, showRightSidebar])

  useEffect(() => {
    if (!isAtEndRef.current) {
      return
    }

    let secondFrame: number | null = null
    const firstFrame = window.requestAnimationFrame(() => {
      void transcriptListRef.current?.scrollToEnd?.({ animated: false })
      secondFrame = window.requestAnimationFrame(() => {
        void transcriptListRef.current?.scrollToEnd?.({ animated: false })
      })
    })

    return () => {
      window.cancelAnimationFrame(firstFrame)
      if (secondFrame !== null) {
        window.cancelAnimationFrame(secondFrame)
      }
    }
  }, [
    state.commandError,
    state.isDraining,
    state.isProcessing,
    state.messages.length,
    state.queuedMessages.length,
    state.runtimeStatus,
  ])

  useLayoutEffect(() => {
    if (!showRightSidebar || isMobileRightSidebarOverlay || layoutWidth <= 0 || isRightSidebarAnimating.current) {
      return
    }

    const clampedRightSidebarSize = getRightSidebarSizePercent(globalRightSidebarSize, layoutWidth)
    const currentLayout = rightSidebarPanelGroupRef.current?.getLayout()
    if (!currentLayout) return
    if (Math.abs((currentLayout.rightSidebar ?? 0) - clampedRightSidebarSize) < 0.1) {
      return
    }

    rightSidebarPanelGroupRef.current?.setLayout({
      workspace: 100 - clampedRightSidebarSize,
      rightSidebar: clampedRightSidebarSize,
    })
  }, [
    globalRightSidebarSize,
    isRightSidebarAnimating,
    layoutWidth,
    rightSidebarPanelGroupRef,
    showRightSidebar,
    isMobileRightSidebarOverlay,
  ])

  const chatCard = (
    <Card
      ref={chatCardRef}
      className="bg-background h-full flex flex-col overflow-hidden border-0 rounded-none relative"
      onDragEnter={handleTranscriptDragEnter}
      onDragOver={handleTranscriptDragOver}
      onDragLeave={handleTranscriptDragLeave}
      onDrop={handleTranscriptDrop}
    >
      <CardContent className="flex flex-1 min-h-0 flex-col overflow-hidden p-0 relative">
        <ChatNavbar
          sidebarCollapsed={state.sidebarCollapsed}
          onOpenSidebar={state.openSidebar}
          onExpandSidebar={state.expandSidebar}
          onNewChat={state.handleCompose}
          localPath={state.navbarLocalPath}
          embeddedTerminalVisible={showTerminalPane}
          onToggleEmbeddedTerminal={projectId ? handleToggleEmbeddedTerminal : undefined}
          rightPanel={activeRightPanel}
          onToggleGitPanel={projectId ? handleToggleGitPanel : undefined}
          onToggleBrowserPanel={projectId ? handleToggleBrowserPanel : undefined}
          onToggleSlidesPanel={projectId ? handleToggleSlidesPanel : undefined}
          onToggleWorkflowPanel={projectId ? handleToggleWorkflowPanel : undefined}
          onOpenExternal={handleOpenExternal}
          onExportTranscript={state.activeChatId ? () => void state.handleShareChat(state.activeChatId) : undefined}
          canExportTranscript={Boolean(state.activeChatId) && !state.isExportingStandalone}
          isExportingTranscript={state.isExportingStandalone}
          exportTranscriptComplete={state.standaloneShareComplete}
          editorPreset={editorPreset}
          editorCommandTemplate={editorCommandTemplate}
          platform={state.localProjects?.machine.platform}
          finderShortcut={resolvedKeybindings.bindings.openInFinder}
          editorShortcut={resolvedKeybindings.bindings.openInEditor}
          terminalShortcut={resolvedKeybindings.bindings.toggleEmbeddedTerminal}
          rightSidebarShortcut={resolvedKeybindings.bindings.toggleRightSidebar}
          branchName={state.chatDiffSnapshot?.branchName}
          hasGitRepo={state.chatDiffSnapshot?.status !== "no_repo"}
          gitStatus={state.chatDiffSnapshot?.status}
        />
        <ChatTranscriptViewport
          activeChatId={state.activeChatId}
          listRef={transcriptListRef}
          messages={state.messages}
          queuedMessages={state.queuedMessages}
          transcriptPaddingBottom={transcriptPaddingBottom}
          localPath={state.runtime?.localPath}
          latestToolIds={state.latestToolIds}
          isHistoryLoading={state.isHistoryLoading}
          hasOlderHistory={state.hasOlderHistory}
          isProcessing={state.isProcessing}
          runtimeStatus={state.runtimeStatus}
          isDraining={state.isDraining}
          commandError={state.commandError}
          loadOlderHistory={state.loadOlderHistory}
          onStopDraining={state.handleStopDraining}
          onSteerQueuedMessage={state.handleSteerQueuedMessage}
          onRemoveQueuedMessage={state.handleRemoveQueuedMessage}
          onOpenLocalLink={state.handleOpenLocalLink}
          editorPreset={editorPreset}
          editorCommandTemplate={editorCommandTemplate}
          platform={state.localProjects?.machine.platform}
          onAskUserQuestionSubmit={state.handleAskUserQuestion}
          onExitPlanModeConfirm={state.handleExitPlanMode}
          onCliPermissionRespond={state.handleCliPermission}
          showScrollButton={showScrollToBottom && state.messages.length > 0}
          onIsAtEndChange={onIsAtEndChange}
          scrollToBottom={() => scrollToTranscriptEnd(true)}
          typedEmptyStateText={typedEmptyStateText}
          isEmptyStateTypingComplete={isEmptyStateTypingComplete}
          isPageFileDragActive={isPageFileDragActive}
          showEmptyState={showEmptyState}
        />
      </CardContent>

      <ChatInputDock
        inputRef={inputRef}
        onLayoutChange={syncInputHeight}
        chatInputRef={chatInputRef}
        chatInputElementRef={chatInputElementRef}
        activeChatId={state.activeChatId}
        previousPrompt={state.previousPrompt}
        hasSelectedProject={state.hasSelectedProject}
        runtimeStatus={state.runtimeStatus}
        canCancel={state.canCancel}
        projectId={projectId}
        activeProvider={state.runtime?.provider ?? null}
        availableProviders={state.availableProviders}
        contextWindowSnapshot={contextWindowSnapshot}
        onSubmit={handleChatSubmit}
        onCancel={handleCancel}
      />
    </Card>
  )

  const workspace = projectId ? (
    <ChatWorkspace
      chatCard={chatCard}
      projectId={projectId}
      shouldRenderTerminalLayout={shouldRenderTerminalLayout}
      showTerminalPane={showTerminalPane}
      terminalLayout={terminalLayout}
      mainPanelGroupRef={mainPanelGroupRef}
      terminalPanelRef={terminalPanelRef}
      terminalVisualRef={terminalVisualRef}
      fixedTerminalHeight={fixedTerminalHeight}
      terminalFocusRequestVersion={terminalFocusRequestVersion}
      addTerminal={addTerminal}
      socket={state.socket}
      connectionStatus={state.connectionStatus}
      scrollback={scrollback}
      minColumnWidth={minColumnWidth}
      splitTerminalShortcut={resolvedKeybindings.bindings.addSplitTerminal}
      pendingCommandsByTerminalId={pendingTerminalCommands}
      onTerminalCommandSent={scheduleTerminalDiffRefresh}
      onInitialTerminalCommandSent={handleInitialTerminalCommandSent}
      onRemoveTerminal={handleRemoveTerminal}
      onTerminalLayout={setTerminalSizes}
      onLayoutChanged={handleTerminalResize}
    />
  ) : (
    chatCard
  )

  const gitPanelContentProps = useMemo<ComponentProps<typeof ChatSidebarContent> | null>(() => {
    if (!projectId) {
      return null
    }

    return {
      projectId,
      diffs: state.chatDiffSnapshot ?? EMPTY_DIFF_SNAPSHOT,
      editorLabel: state.editorLabel,
      diffRenderMode,
      wrapLines: wrapDiffLines,
      onOpenFile: handleOpenDiffFile,
      onOpenInFinder: handleOpenDiffInFinder,
      onDiscardFile: handleDiscardDiffFile,
      onIgnoreFile: handleIgnoreDiffFile,
      onIgnoreFolder: handleIgnoreDiffFolder,
      onCopyFilePath: handleCopyDiffFilePath,
      onCopyRelativePath: handleCopyDiffRelativePath,
      onLoadPatch: handleLoadDiffPatch,
      onListBranches: handleListBranches,
      onPreviewMergeBranch: handlePreviewMergeBranch,
      onMergeBranch: handleMergeBranch,
      onCheckoutBranch: handleCheckoutBranch,
      onCreateBranch: handleCreateBranch,
      onGenerateCommitMessage: handleGenerateCommitMessage,
      onInitializeGit: handleInitializeGit,
      onGetGitHubPublishInfo: handleGetGitHubPublishInfo,
      onCheckGitHubRepoAvailability: handleCheckGitHubRepoAvailability,
      onSetupGitHub: handleSetupGitHub,
      onCommit: handleCommitDiffs,
      onSyncWithRemote: handleSyncBranch,
      onDiffRenderModeChange: setDiffRenderMode,
      onWrapLinesChange: setWrapDiffLines,
      onClose: handleCloseRightSidebar,
    }
  }, [
    diffRenderMode,
    handleCheckGitHubRepoAvailability,
    handleCheckoutBranch,
    handleCloseRightSidebar,
    handleCommitDiffs,
    handleCopyDiffFilePath,
    handleCopyDiffRelativePath,
    handleCreateBranch,
    handleDiscardDiffFile,
    handleGenerateCommitMessage,
    handleGetGitHubPublishInfo,
    handleIgnoreDiffFile,
    handleIgnoreDiffFolder,
    handleInitializeGit,
    handleListBranches,
    handleLoadDiffPatch,
    handleMergeBranch,
    handleOpenDiffFile,
    handleOpenDiffInFinder,
    handlePreviewMergeBranch,
    handleSetupGitHub,
    handleSyncBranch,
    projectId,
    setDiffRenderMode,
    setWrapDiffLines,
    state.chatDiffSnapshot,
    state.editorLabel,
    wrapDiffLines,
  ])
  const rightPanelContent = activeRightPanel === "browser" && projectId
    ? <BrowserPanel projectId={projectId} socket={state.socket} onClose={handleCloseRightSidebar} onRunQuickAction={handleRunQuickAction} />
    : activeRightPanel === "slides" && projectId
      ? <MarkdownSlideViewer projectId={projectId} socket={state.socket} onClose={handleCloseRightSidebar} />
      : activeRightPanel === "workflow" && projectId
        ? (
          <WorkflowTrackerPanel
            run={workflowProjection}
            workflowDefinitions={workflowDefinitions}
            isStartingWorkflow={isStartingWorkflow}
            onStartWorkflow={handleStartWorkflow}
            proposedManifest={proposedManifest || undefined}
            onPublishWorkflow={handlePublishWorkflow}
            onRejectWorkflow={handleRejectWorkflow}
            onReviewDownstream={handleReviewDownstream}
            onRepairDownstream={handleRepairDownstream}
            onRerunArtifact={handleRerunArtifact}
            onViewArtifact={handleViewArtifact}
            onRegenerateArtifact={handleRegenerateArtifact}
            onInvalidateArtifact={handleInvalidateArtifact}
            onAcceptArtifact={handleAcceptArtifact}
            onRerunNode={handleRerunNode}
            onRegisterPack={handleRegisterPack}
            onAddFlowEdge={handleAddFlowEdge}
            onRemoveFlowEdge={handleRemoveFlowEdge}
            onApproveFlowEdge={handleApproveFlowEdge}
            onRejectFlowEdge={handleRejectFlowEdge}
            onRecoverLock={handleRecoverLock}
            densityMode={projectUiState?.workflowDensityMode ?? "normal"}
            onDensityModeChange={(mode) => projectId && setWorkflowDensityMode(projectId, mode)}
            onClose={handleCloseRightSidebar}
          />
        )
        : gitPanelContentProps
          ? <ChatSidebarContent {...gitPanelContentProps} />
          : null

  return (
    <div ref={layoutRootRef} className="flex-1 flex flex-col min-w-0 relative">
      {shouldRenderDesktopRightSidebarLayout && projectId ? (
        <ResizablePanelGroup
          key={`${projectId}-right-sidebar`}
          groupRef={rightSidebarPanelGroupRef}
          orientation="horizontal"
          className="flex-1 min-h-0"
          onLayoutChange={(layout) => {
            if (!showRightSidebar || isRightSidebarAnimating.current) {
              return
            }

            const clampedRightSidebarSize = getRightSidebarSizePercent(
              getRightSidebarSizePx(layout.rightSidebar, layoutWidth),
              layoutWidth,
            )
            if (Math.abs(clampedRightSidebarSize - layout.rightSidebar) < 0.1) {
              return
            }

            rightSidebarPanelGroupRef.current?.setLayout({
              workspace: 100 - clampedRightSidebarSize,
              rightSidebar: clampedRightSidebarSize,
            })
          }}
          onLayoutChanged={(layout) => {
            if (!showRightSidebar || isRightSidebarAnimating.current) {
              return
            }

            setRightSidebarSize(getRightSidebarSizePx(layout.rightSidebar, layoutWidth))
          }}
        >
          <ResizablePanel
            id="workspace"
            defaultSize={`${100 - effectiveRightSidebarSize}%`}
            minSize="20%"
            className="min-h-0 min-w-0"
            groupResizeBehavior="preserve-relative-size"
          >
            {workspace}
          </ResizablePanel>
          <ResizableHandle
            withHandle={false}
            orientation="horizontal"
            disabled={!showRightSidebar}
            className={cn(!showRightSidebar && "pointer-events-none opacity-0")}
          />
          <DesktopSidebarPane
            showRightSidebar={showRightSidebar}
            sizePercent={effectiveRightSidebarSize}
            sidebarPanelRef={sidebarPanelRef}
            sidebarVisualRef={sidebarVisualRef}
            content={rightPanelContent}
          />
        </ResizablePanelGroup>
      ) : (
        workspace
      )}
      {isMobileRightSidebarOverlay ? (
        <MobileSidebarPane
          projectId={projectId}
          showRightSidebar={showRightSidebar}
          sidebarVisualRef={sidebarVisualRef}
          onClose={handleCloseRightSidebar}
          content={rightPanelContent}
        />
      ) : null}
    </div>
  )
}
