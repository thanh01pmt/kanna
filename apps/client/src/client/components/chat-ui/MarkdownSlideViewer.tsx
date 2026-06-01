import React, { useState, useEffect, useCallback } from "react"
import type { KannaSocket } from "../../app/socket"
import { SlideViewer } from "@kanna/slide-viewer"
import { useTheme } from "../../hooks/useTheme"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { Button } from "../ui/button"
import { FileText, Loader2, RefreshCw, X, Play } from "lucide-react"

interface MarkdownSlideViewerProps {
  projectId: string
  socket: KannaSocket
  onClose: () => void
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
  const [isLoadingFiles, setIsLoadingFiles] = useState(false)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
    }
  }, [selectedFile, loadContent])

  return (
    <div className="flex flex-col h-full bg-background border-l border-border/80">
      {/* Toolbar header */}
      <div className="flex items-center gap-2 p-3 border-b border-border/80 bg-card/60 shrink-0">
        <div className="flex-1 flex items-center gap-2 min-w-0">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          
          {isLoadingFiles ? (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin text-logo" />
              Scanning project...
            </div>
          ) : files.length > 0 ? (
            <Select
              value={selectedFile || undefined}
              onValueChange={setSelectedFile}
            >
              <SelectTrigger className="h-8 py-0 px-2.5 text-xs w-full max-w-[220px]">
                <SelectValue placeholder="Select Markdown File" />
              </SelectTrigger>
              <SelectContent>
                {files.map((file) => (
                  <SelectItem key={file} value={file} className="text-xs">
                    {file}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-xs text-muted-foreground truncate">
              No markdown files found
            </span>
          )}

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

      {/* Main View Area */}
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

        {isLoadingContent ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-logo" />
            <p className="text-xs">Reading slide content...</p>
          </div>
        ) : selectedFile ? (
          <SlideViewer markdown={markdownContent} kannaTheme={resolvedTheme} />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center text-muted-foreground">
            <Play className="h-10 w-10 mb-2 opacity-40 animate-pulse text-logo" />
            <p className="text-sm font-medium">Ready to Present</p>
            <p className="text-xs opacity-75 mt-1 max-w-xs">
              Select any Markdown or Marp slide deck from the dropdown to start presenting.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
