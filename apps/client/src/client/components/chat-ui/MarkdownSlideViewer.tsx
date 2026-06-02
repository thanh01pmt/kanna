import React, { useState, useEffect, useCallback, useMemo } from "react"
import type { KannaSocket } from "../../app/socket"
import type { ProjectFileEntry } from "@kanna/shared/protocol"
import { SlideViewer } from "@kanna/slide-viewer"
import { FileTree } from "@kanna/tree-view"
import { useTheme } from "../../hooks/useTheme"
import { Button } from "../ui/button"
import { FileText, Loader2, RefreshCw, X, Play, Sidebar, SidebarClose, Plus, FolderClosed } from "lucide-react"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "../ui/resizable"
import { cn } from "../../lib/utils"

// Import workspace styles
import "@kanna/slide-viewer/styles"
import "@kanna/tree-view/styles"

interface MarkdownSlideViewerProps {
  projectId: string
  socket: KannaSocket
  onClose: () => void
  activeTab: string | null
  openTabs: string[]
  onSelectTab: (tabId: string) => void
  onCloseTab: (tabId: string, e: React.MouseEvent) => void
}

function isMarkdownFile(filePath: string | null): boolean {
  return /\.(md|markdown)$/i.test(filePath || "")
}

function getPreferredViewMode(filePath: string | null, content: string): "slides" | "document" | "raw" {
  if (!isMarkdownFile(filePath)) {
    return "raw"
  }

  return getMarkdownPreferredViewMode(content)
}

function getMarkdownPreferredViewMode(markdown: string): "slides" | "document" {
  const frontmatterMatch = markdown.match(/^---\s*\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)
  if (!frontmatterMatch) {
    return "document"
  }

  const marpLine = frontmatterMatch[1]
    .split(/\r?\n/)
    .find(line => /^\s*marp\s*:/i.test(line))

  if (!marpLine) {
    return "document"
  }

  const rawValue = marpLine.split(":").slice(1).join(":").trim().replace(/^["']|["']$/g, "")
  return rawValue.toLowerCase() === "true" ? "slides" : "document"
}

export function MarkdownSlideViewer({
  projectId,
  socket,
  onClose,
  activeTab,
  openTabs,
  onSelectTab,
  onCloseTab,
}: MarkdownSlideViewerProps) {
  const { resolvedTheme } = useTheme()

  // File lists
  const [files, setFiles] = useState<ProjectFileEntry[]>([])
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [isSavingContent, setIsSavingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTree, setShowTree] = useState(true)

  // Tab draft content tracking to keep unsaved drafts separate
  const [tabContents, setTabContents] = useState<Record<string, string>>({})
  const [savedTabContents, setSavedTabContents] = useState<Record<string, string>>({})

  const activeContent = activeTab ? tabContents[activeTab] || "" : ""
  const activeSavedContent = activeTab ? savedTabContents[activeTab] || "" : ""
  const hasUnsavedChanges = activeTab !== null && !activeTab.startsWith("tool:") && activeContent !== activeSavedContent

  const preferredViewMode = useMemo(
    () => getPreferredViewMode(activeTab, activeContent),
    [activeContent, activeTab],
  )

  // Fetch the complete project file tree.
  const loadFiles = useCallback(async () => {
    setIsLoadingFiles(true)
    setError(null)
    try {
      const result = await socket.command<ProjectFileEntry[]>({
        type: "project.listFiles",
        projectId,
      })
      setFiles(result || [])
    } catch (err: any) {
      setError(err.message || "Failed to scan project files")
    } finally {
      setIsLoadingFiles(false)
    }
  }, [projectId, socket])

  // Fetch selected file content
  const loadContent = useCallback(async (filePath: string) => {
    setIsLoadingContent(true)
    setError(null)
    try {
      const content = await socket.command<string>({
        type: "project.readFile",
        projectId,
        relativePath: filePath,
      })
      setTabContents(prev => ({ ...prev, [filePath]: content || "" }))
      setSavedTabContents(prev => ({ ...prev, [filePath]: content || "" }))
    } catch (err: any) {
      setError(err.message || `Failed to read file: ${filePath}`)
    } finally {
      setIsLoadingContent(false)
    }
  }, [projectId, socket])

  // Trigger file list load on project mount/change
  useEffect(() => {
    loadFiles()
  }, [projectId, loadFiles])

  // Load content for active tab if not loaded yet
  useEffect(() => {
    if (activeTab && !activeTab.startsWith("tool:") && tabContents[activeTab] === undefined) {
      loadContent(activeTab)
    }
  }, [activeTab, loadContent, tabContents])

  const handleSelectFile = useCallback((filePath: string) => {
    onSelectTab(filePath)
  }, [onSelectTab])

  const handleCloseTab = useCallback((filePath: string, e: React.MouseEvent) => {
    e.stopPropagation()

    // Unsaved changes check
    const hasChanges = tabContents[filePath] !== savedTabContents[filePath]
    if (hasChanges) {
      const confirmDiscard = window.confirm(`Discard unsaved edits in ${filePath.split("/").pop()}?`)
      if (!confirmDiscard) {
        return
      }
    }

    onCloseTab(filePath, e)

    // Clean up states
    setTabContents(prev => {
      const next = { ...prev }
      delete next[filePath]
      return next
    })
    setSavedTabContents(prev => {
      const next = { ...prev }
      delete next[filePath]
      return next
    })
  }, [onCloseTab, tabContents, savedTabContents])

  const handleSaveMarkdown = useCallback(async () => {
    if (!activeTab || activeTab.startsWith("tool:") || isSavingContent) {
      return
    }

    const currentVal = tabContents[activeTab] || ""
    const savedVal = savedTabContents[activeTab] || ""
    if (currentVal === savedVal) return

    setIsSavingContent(true)
    setError(null)
    try {
      await socket.command({
        type: "project.writeFile",
        projectId,
        relativePath: activeTab,
        content: currentVal,
      })
      setSavedTabContents(prev => ({ ...prev, [activeTab]: currentVal }))
    } catch (err: any) {
      setError(err.message || "Failed to save file")
    } finally {
      setIsSavingContent(false)
    }
  }, [activeTab, isSavingContent, tabContents, savedTabContents, projectId, socket])

  const handleContentChange = useCallback((newContent: string) => {
    if (!activeTab || activeTab.startsWith("tool:")) return
    setTabContents(prev => ({ ...prev, [activeTab]: newContent }))
  }, [activeTab])

  const renderContentArea = () => {
    if (isLoadingContent) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-logo" />
          <p className="text-xs">Reading file content...</p>
        </div>
      )
    }

    if (activeTab && !activeTab.startsWith("tool:")) {
      return (
        <SlideViewer
          markdown={activeContent}
          kannaTheme={resolvedTheme}
          preferredViewMode={preferredViewMode}
          contentIdentity={`${activeTab}:${activeSavedContent}`}
          rawFileName={activeTab}
          hasUnsavedChanges={hasUnsavedChanges}
          isSavingMarkdown={isSavingContent}
          onMarkdownChange={handleContentChange}
          onSaveMarkdown={handleSaveMarkdown}
        />
      )
    }

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-muted-foreground bg-background">
        <Play className="h-10 w-10 mb-2 opacity-40 animate-pulse text-logo" />
        <p className="text-sm font-medium">Ready to Browse</p>
        <p className="text-xs opacity-75 mt-1 max-w-xs">
          Select any file from the tree. Markdown can render as slides or document; other text files open in Raw.
        </p>
      </div>
    )
  }

  // Determine if showing standard FileTree explorer or Editor
  const isFilesExplorerTab = !activeTab || activeTab === "tool:files"

  const renderEditorWorkspace = () => (
    <div className="flex flex-col h-full bg-background min-h-0 min-w-0">
      {/* Breadcrumbs Trail & Toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 text-[10px] text-muted-foreground/75 bg-card/45 shrink-0 select-none min-w-0 gap-2">
        <div className="flex items-center gap-1.5 truncate">
          {activeTab?.split("/").map((part, idx, arr) => (
            <React.Fragment key={idx}>
              {idx > 0 && <span className="text-muted-foreground/30 font-mono">/</span>}
              <span className={idx === arr.length - 1 ? "text-foreground/80 font-medium truncate" : "truncate"}>
                {part}
              </span>
            </React.Fragment>
          ))}
        </div>

        {/* Toggle File Explorer Button */}
        <button
          onClick={() => setShowTree(prev => !prev)}
          title={showTree ? "Collapse File Explorer" : "Expand File Explorer"}
          className="text-muted-foreground/60 hover:text-foreground transition-colors p-[3px] shrink-0 rounded hover:bg-muted"
        >
          {showTree ? <SidebarClose className="h-3.5 w-3.5" /> : <Sidebar className="h-3.5 w-3.5" />}
        </button>
      </div>

      {/* Content Area */}
      <div className="flex-1 min-h-0 relative bg-card/10">
        {renderContentArea()}
      </div>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-background border-l border-border/80 relative">
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-destructive bg-background/50 backdrop-blur-sm z-10">
          <p className="text-sm font-medium">Error Occurred</p>
          <p className="text-xs opacity-80 mt-1 max-w-md">{error}</p>
          <Button variant="outline" size="sm" onClick={loadFiles} className="mt-4">
            Retry Scan
          </Button>
        </div>
      )}

      {isFilesExplorerTab ? (
        <div className="flex flex-col h-full bg-background min-h-0 min-w-0">
          {/* Header */}
          <div className="flex items-center justify-between p-3.5 border-b border-border/80 bg-card/60 shrink-0 select-none">
            <div className="flex items-center gap-2 min-w-0">
              <FolderClosed className="h-4 w-4 text-logo shrink-0" />
              <span className="text-xs font-semibold text-foreground truncate">File Explorer</span>
              {isLoadingFiles ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-logo shrink-0" />
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={loadFiles}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
                  title="Refresh file list"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0 rounded-md"
              title="Close Files Panel"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Tree View */}
          <div className="flex-1 min-h-0 overflow-y-auto p-2">
            <FileTree
              files={files}
              selectedPath={null}
              onSelectFile={handleSelectFile}
              kannaTheme={resolvedTheme}
            />
          </div>
        </div>
      ) : (
        showTree ? (
          <div className="absolute inset-0">
            <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0">
              <ResizablePanel
                id="slide-viewer-tree"
                defaultSize="35%"
                minSize="15%"
                maxSize="85%"
                collapsible={true}
                className="min-h-0 min-w-0"
              >
                <div className="h-full min-h-0 min-w-0 border-r border-border/60">
                  <FileTree
                    files={files}
                    selectedPath={activeTab}
                    onSelectFile={handleSelectFile}
                    kannaTheme={resolvedTheme}
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle orientation="horizontal" withHandle />
              <ResizablePanel id="slide-viewer-content" defaultSize="65%" className="min-h-0 min-w-0">
                {renderEditorWorkspace()}
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        ) : (
          renderEditorWorkspace()
        )
      )}
    </div>
  )
}


