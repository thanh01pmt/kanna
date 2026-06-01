import React, { useState, useEffect, useCallback, useMemo } from "react"
import type { KannaSocket } from "../../app/socket"
import { SlideViewer } from "@kanna/slide-viewer"
import { FileTree } from "@kanna/tree-view"
import { useTheme } from "../../hooks/useTheme"
import { Button } from "../ui/button"
import { FileText, Loader2, RefreshCw, X, Play, Sidebar, SidebarClose } from "lucide-react"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "../ui/resizable"

// Import workspace styles
import "@kanna/slide-viewer/styles"
import "@kanna/tree-view/styles"

interface MarkdownSlideViewerProps {
  projectId: string
  socket: KannaSocket
  onClose: () => void
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
}: MarkdownSlideViewerProps) {
  const { resolvedTheme } = useTheme()
  const [files, setFiles] = useState<string[]>([])
  const [selectedFile, setSelectedFile] = useState<string | null>(null)
  const [markdownContent, setMarkdownContent] = useState<string>("")
  const [savedMarkdownContent, setSavedMarkdownContent] = useState<string>("")
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [isSavingContent, setIsSavingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showTree, setShowTree] = useState(true)
  const hasUnsavedChanges = selectedFile !== null && markdownContent !== savedMarkdownContent
  const preferredViewMode = useMemo(
    () => getMarkdownPreferredViewMode(markdownContent),
    [markdownContent],
  )

  // Fetch all markdown files in active project
  const loadFiles = useCallback(async () => {
    setIsLoadingFiles(true)
    setError(null)
    try {
      const result = await socket.command<string[]>({
        type: "project.listMarkdownFiles",
        projectId,
      })
      const mdFiles = result || []
      setFiles(mdFiles)
      
      // Auto-select first file if none currently selected or selected file is no longer available
      if (mdFiles.length > 0) {
        if (!selectedFile || !mdFiles.includes(selectedFile)) {
          setSelectedFile(mdFiles[0])
        }
      } else {
        setSelectedFile(null)
      }
    } catch (err: any) {
      setError(err.message || "Failed to scan markdown files")
    } finally {
      setIsLoadingFiles(false)
    }
  }, [projectId, socket, selectedFile])

  // Fetch selected file content
  const loadContent = useCallback(async (filePath: string) => {
    setIsLoadingContent(true)
    setError(null)
    try {
      const content = await socket.command<string>({
        type: "project.readMarkdownFile",
        projectId,
        relativePath: filePath,
      })
      setMarkdownContent(content || "")
      setSavedMarkdownContent(content || "")
    } catch (err: any) {
      setError(err.message || "Failed to read markdown file")
    } finally {
      setIsLoadingContent(false)
    }
  }, [projectId, socket])

  // Trigger file list load on project mount/change
  useEffect(() => {
    loadFiles()
  }, [projectId])

  // Reload content when selection changes
  useEffect(() => {
    if (selectedFile) {
      loadContent(selectedFile)
    } else {
      setMarkdownContent("")
      setSavedMarkdownContent("")
    }
  }, [selectedFile, loadContent])

  const handleSelectFile = useCallback((filePath: string) => {
    if (filePath === selectedFile) {
      return
    }

    if (hasUnsavedChanges) {
      const shouldDiscard = window.confirm("You have unsaved Raw edits. Switch files and discard them?")
      if (!shouldDiscard) {
        return
      }
    }

    setIsLoadingContent(true)
    setMarkdownContent("")
    setSavedMarkdownContent("")
    setSelectedFile(filePath)
  }, [hasUnsavedChanges, selectedFile])

  const handleSaveMarkdown = useCallback(async () => {
    if (!selectedFile || !hasUnsavedChanges || isSavingContent) {
      return
    }

    setIsSavingContent(true)
    setError(null)
    try {
      await socket.command({
        type: "project.writeMarkdownFile",
        projectId,
        relativePath: selectedFile,
        content: markdownContent,
      })
      setSavedMarkdownContent(markdownContent)
    } catch (err: any) {
      setError(err.message || "Failed to save markdown file")
    } finally {
      setIsSavingContent(false)
    }
  }, [hasUnsavedChanges, isSavingContent, markdownContent, projectId, selectedFile, socket])

  const renderContentArea = () => {
    if (isLoadingContent) {
      return (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
          <Loader2 className="h-6 w-6 animate-spin text-logo" />
          <p className="text-xs">Reading slide content...</p>
        </div>
      )
    }

    if (selectedFile) {
      return (
        <SlideViewer
          markdown={markdownContent}
          kannaTheme={resolvedTheme}
          preferredViewMode={preferredViewMode}
          contentIdentity={`${selectedFile}:${savedMarkdownContent}`}
          rawFileName={selectedFile}
          hasUnsavedChanges={hasUnsavedChanges}
          isSavingMarkdown={isSavingContent}
          onMarkdownChange={setMarkdownContent}
          onSaveMarkdown={handleSaveMarkdown}
        />
      )
    }

    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
        <Play className="h-10 w-10 mb-2 opacity-40 animate-pulse text-logo" />
        <p className="text-sm font-medium">Ready to Present</p>
        <p className="text-xs opacity-75 mt-1 max-w-xs">
          Select any Markdown or Marp slide deck from the file tree to start presenting.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background border-l border-border/80">
      {/* Toolbar header */}
      <div className="flex items-center justify-between p-3 border-b border-border/80 bg-card/60 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowTree(prev => !prev)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            title={showTree ? "Hide File Tree" : "Show File Tree"}
          >
            {showTree ? <SidebarClose className="h-4 w-4" /> : <Sidebar className="h-4 w-4" />}
          </Button>

          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {isLoadingFiles ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin text-logo" />
                Scanning project...
              </>
            ) : (
              <>
                <FileText className="h-3.5 w-3.5" />
                <span className="font-medium truncate max-w-[180px]">
                  {selectedFile ? selectedFile.split("/").pop() : "Presentation Viewer"}
                </span>
              </>
            )}
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={loadFiles}
            className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
            title="Scan for Markdown files"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0 rounded-full"
          title="Close Slides Panel"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Main split-pane / content view */}
      <div className="flex-1 min-h-0 relative">
        {error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-destructive bg-background/50 backdrop-blur-sm z-10">
            <p className="text-sm font-medium">Error Occurred</p>
            <p className="text-xs opacity-80 mt-1 max-w-md">{error}</p>
            <Button variant="outline" size="sm" onClick={loadFiles} className="mt-4">
              Retry Scan
            </Button>
          </div>
        )}

        {showTree ? (
          <div className="absolute inset-0">
            <ResizablePanelGroup orientation="horizontal" className="min-h-0 min-w-0">
              <ResizablePanel id="slide-viewer-tree" defaultSize="35%" minSize="15%" maxSize="80%" className="min-h-0 min-w-0">
                <div className="h-full min-h-0 min-w-0">
                  <FileTree
                    files={files}
                    selectedPath={selectedFile}
                    onSelectFile={handleSelectFile}
                    kannaTheme={resolvedTheme}
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle orientation="horizontal" withHandle />
              <ResizablePanel id="slide-viewer-content" defaultSize="65%" className="min-h-0 min-w-0">
                <div className="h-full relative bg-card/10">
                  {renderContentArea()}
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        ) : (
          <div className="absolute inset-0">
            {renderContentArea()}
          </div>
        )}
      </div>
    </div>
  )
}
