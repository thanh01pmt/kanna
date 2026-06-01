import { TreeNode } from "../types"

export interface TreeEntry {
  path: string;
  type: "file" | "directory";
}

export function buildTree(paths: string[] | TreeEntry[]): TreeNode[] {
  const root: TreeNode[] = []

  for (const item of paths) {
    const entry = typeof item === "string" ? { path: item, type: "file" as const } : item
    if (!entry.path) continue
    const parts = entry.path.split("/")
    let currentLevel = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const currentPath = parts.slice(0, i + 1).join("/")
      const type = isLast ? entry.type : "directory"

      // Check if this part already exists in current level
      let existingNode = currentLevel.find((node) => node.name === part)

      if (!existingNode) {
        existingNode = {
          name: part,
          path: currentPath,
          type,
        }
        if (type === "directory") {
          existingNode.children = []
        }
        currentLevel.push(existingNode)
      }

      if (!isLast && existingNode.type === "directory" && existingNode.children) {
        currentLevel = existingNode.children
      }
    }
  }

  // Sort: directories first, then files alphabetically
  const sortNodes = (nodes: TreeNode[]): TreeNode[] => {
    return nodes
      .map((node) => {
        if (node.children) {
          node.children = sortNodes(node.children)
        }
        return node
      })
      .sort((a, b) => {
        if (a.type !== b.type) {
          return a.type === "directory" ? -1 : 1
        }
        return a.name.localeCompare(b.name, undefined, { sensitivity: "base", numeric: true })
      })
  }

  return sortNodes(root)
}
