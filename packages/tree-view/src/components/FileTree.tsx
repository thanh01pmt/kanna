import React, { useState, useEffect, useMemo } from "react"
import { TreeNode } from "../types"
import { buildTree, TreeEntry } from "../utils/treeBuilder"
import { Folder, FolderOpen, FileText, ChevronRight, ChevronDown, Search, FolderClosed, FolderMinus } from "lucide-react"

interface FileTreeProps {
  files: string[] | TreeEntry[];
  selectedPath: string | null;
  onSelectFile: (path: string) => void;
  kannaTheme?: "light" | "dark";
}

export const FileTree: React.FC<FileTreeProps> = ({
  files,
  selectedPath,
  onSelectFile,
  kannaTheme = "dark",
}) => {
  const [searchTerm, setSearchTerm] = useState("")
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({})

  // Build the complete tree hierarchy
  const fullTree = useMemo(() => buildTree(files), [files])

  // Filter tree based on search term
  const filteredTree = useMemo(() => {
    if (!searchTerm.trim()) return fullTree
    const trimmed = searchTerm.trim()
    const regexMatch = trimmed.match(/^\/(.+)\/([a-z]*)$/i)
    const regex = regexMatch
      ? (() => {
          try {
            return new RegExp(regexMatch[1], regexMatch[2])
          } catch {
            return null
          }
        })()
      : null
    const term = trimmed.toLowerCase()
    const matches = (node: TreeNode) => {
      const target = `${node.path}\n${node.name}`
      return regex ? regex.test(target) : node.name.toLowerCase().includes(term) || node.path.toLowerCase().includes(term)
    }

    const filterNode = (nodes: TreeNode[]): TreeNode[] => {
      return nodes
        .map((node) => {
          if (node.type === "file") {
            return matches(node) ? node : null
          }

          const childMatches = node.children ? filterNode(node.children) : []
          if (childMatches.length > 0 || matches(node)) {
            return {
              ...node,
              children: childMatches.length > 0 ? childMatches : node.children,
            }
          }
          return null
        })
        .filter((node): node is TreeNode => node !== null)
    }

    return filterNode(fullTree)
  }, [fullTree, searchTerm])

  // Automatically expand all directories when filtering is active
  useEffect(() => {
    if (searchTerm.trim()) {
      const autoExpand = (nodes: TreeNode[]) => {
        const expanded: Record<string, boolean> = {}
        const walk = (items: TreeNode[]) => {
          for (const item of items) {
            if (item.type === "directory" && item.children && item.children.length > 0) {
              expanded[item.path] = true
              walk(item.children)
            }
          }
        }
        walk(nodes)
        setExpandedNodes((prev) => ({ ...prev, ...expanded }))
      }
      autoExpand(filteredTree)
    }
  }, [filteredTree, searchTerm])

  // Automatically expand directories leading to the selected file on mount or path change
  useEffect(() => {
    if (selectedPath) {
      const parts = selectedPath.split("/")
      const newExpanded = { ...expandedNodes }
      let currentPath = ""
      for (let i = 0; i < parts.length - 1; i++) {
        currentPath = currentPath ? `${currentPath}/${parts[i]}` : parts[i]
        newExpanded[currentPath] = true
      }
      setExpandedNodes(newExpanded)
    }
  }, [selectedPath])

  const toggleExpand = (path: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedNodes((prev) => ({
      ...prev,
      [path]: !prev[path],
    }))
  }

  const renderNode = (node: TreeNode, depth = 0) => {
    const isExpanded = !!expandedNodes[node.path]
    const isSelected = selectedPath === node.path
    const hasChildren = node.children && node.children.length > 0

    const itemClasses = `
      flex items-center gap-1.5 py-1 px-2 rounded-md cursor-pointer select-none text-xs transition-colors duration-150 group
      ${isSelected 
        ? "bg-logo/15 dark:bg-logo/20 text-logo font-medium border-l-2 border-logo rounded-l-none pl-[7px]" 
        : "text-foreground/80 hover:bg-muted/65 hover:text-foreground"
      }
    `

    return (
      <div key={node.path} className="flex flex-col">
        {node.type === "directory" ? (
          /* Directory Node */
          <div>
            <div
              onClick={(e) => toggleExpand(node.path, e)}
              className={itemClasses}
              style={{ paddingLeft: `${depth * 12 + 8}px` }}
            >
              <span className="text-muted-foreground/60 group-hover:text-muted-foreground transition-colors">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 shrink-0" />
                )}
              </span>
              <span className="text-muted-foreground shrink-0">
                {isExpanded ? (
                  <FolderOpen className="h-3.5 w-3.5 fill-muted-foreground/10" />
                ) : (
                  <Folder className="h-3.5 w-3.5 fill-muted-foreground/10" />
                )}
              </span>
              <span className="truncate">{node.name}</span>
            </div>
            {isExpanded && node.children && (
              <div className="flex flex-col mt-0.5">
                {node.children.map((child) => renderNode(child, depth + 1))}
              </div>
            )}
          </div>
        ) : (
          /* File Node */
          <div
            onClick={() => onSelectFile(node.path)}
            className={itemClasses}
            style={{ 
              paddingLeft: isSelected 
                ? `${depth * 12 + 23}px` // Account for border-l-2 padding offset
                : `${depth * 12 + 24}px` 
            }}
          >
            <FileText className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "text-logo" : "text-muted-foreground/80"}`} />
            <span className="truncate">{node.name}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background border-r border-border/80">
      {/* Search Header */}
      <div className="p-3 border-b border-border/60 flex items-center gap-2">
        <div className="relative flex-1 flex items-center">
          <Search 
            className="absolute h-3.5 w-3.5 text-muted-foreground/75 pointer-events-none" 
            style={{ left: "0.625rem" }} 
          />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Filter files... or /regex/"
            className="w-full pr-3 py-1.5 text-xs rounded-md bg-muted/40 border border-border/60 placeholder:text-muted-foreground/60 text-foreground outline-none focus:border-logo/60 transition-colors"
            style={{ paddingLeft: "2rem" }}
          />
        </div>
        <button
          onClick={() => setExpandedNodes({})}
          title="Collapse all folders"
          className="p-1.5 rounded-md hover:bg-muted text-muted-foreground/80 hover:text-foreground transition-colors shrink-0 border border-border/40 bg-muted/20"
        >
          <FolderMinus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tree list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {filteredTree.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground/75">
            <span className="text-xs">No files found</span>
          </div>
        ) : (
          filteredTree.map((node) => renderNode(node, 0))
        )}
      </div>
    </div>
  )
}
