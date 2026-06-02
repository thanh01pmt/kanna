import { readFile } from "node:fs/promises"
import path from "node:path"

export type ProjectMcpToolConfig = {
  tools?: Record<string, Record<string, boolean>>
  capabilities?: {
    skills?: boolean
    workflow?: boolean
    mcp?: boolean
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null
}

export async function readProjectMcpToolConfig(localPath: string): Promise<ProjectMcpToolConfig> {
  try {
    const raw = await readFile(path.join(localPath, ".mcp.json"), "utf8")
    const parsed = asRecord(JSON.parse(raw))
    if (!parsed) return {}
    const tools = asRecord(parsed.tools)
      ? parsed.tools as ProjectMcpToolConfig["tools"]
      : undefined
    const capabilities = asRecord(parsed.capabilities)
      ? parsed.capabilities as ProjectMcpToolConfig["capabilities"]
      : undefined
    return {
      ...(tools ? { tools } : {}),
      ...(capabilities ? { capabilities } : {}),
    }
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

export function isProjectCapabilityEnabled(config: ProjectMcpToolConfig, capability: "skills" | "workflow" | "mcp") {
  return config.capabilities?.[capability] !== false
}

export function getDisabledClaudeToolNames(config: ProjectMcpToolConfig): string[] {
  const disabled = getDisabledMcpToolNames(config)
  if (!isProjectCapabilityEnabled(config, "skills")) {
    disabled.push("Skill")
  }
  return disabled.sort()
}

export function mcpToolConfigKey(config: ProjectMcpToolConfig | readonly string[]) {
  if (Array.isArray(config)) {
    return [...config].sort().join("\n")
  }
  const projectConfig = config as ProjectMcpToolConfig
  return JSON.stringify({
    capabilities: {
      skills: isProjectCapabilityEnabled(projectConfig, "skills"),
      workflow: isProjectCapabilityEnabled(projectConfig, "workflow"),
      mcp: isProjectCapabilityEnabled(projectConfig, "mcp"),
    },
    disabledTools: getDisabledMcpToolNames(projectConfig),
  })
}
