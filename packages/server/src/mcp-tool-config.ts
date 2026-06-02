import { readFile } from "node:fs/promises"
import path from "node:path"

export type ProjectMcpToolConfig = {
  tools?: Record<string, Record<string, boolean>>
}

export async function readProjectMcpToolConfig(localPath: string): Promise<ProjectMcpToolConfig> {
  try {
    const raw = await readFile(path.join(localPath, ".mcp.json"), "utf8")
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
    const tools = (parsed as ProjectMcpToolConfig).tools
    if (!tools || typeof tools !== "object" || Array.isArray(tools)) return {}
    return { tools }
  } catch {
    return {}
  }
}

export function getDisabledMcpToolNames(config: ProjectMcpToolConfig): string[] {
  const disabled: string[] = []
  for (const [serverName, tools] of Object.entries(config.tools ?? {})) {
    if (!tools || typeof tools !== "object" || Array.isArray(tools)) continue
    for (const [toolName, enabled] of Object.entries(tools)) {
      if (enabled === false) {
        disabled.push(`mcp__${serverName}__${toolName}`)
      }
    }
  }
  return disabled.sort()
}

export async function readDisabledMcpToolNames(localPath: string): Promise<string[]> {
  return getDisabledMcpToolNames(await readProjectMcpToolConfig(localPath))
}

export function mcpToolConfigKey(disabledToolNames: readonly string[]) {
  return [...disabledToolNames].sort().join("\n")
}
