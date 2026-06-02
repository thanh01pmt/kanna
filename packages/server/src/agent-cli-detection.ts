import { execFileSync } from "node:child_process"
import type { AgentCliDetection, AgentCliDetectionSnapshot, AgentProvider, CustomAgentConfig, CustomAgentConnectionTestResult } from "@kanna/shared/types"
import { getServerProviderCatalog } from "./provider-catalog"

interface AgentCliProbe {
  provider: AgentProvider
  commands: string[]
  builtIn?: boolean
}

export const AGENT_CLI_PROBES: AgentCliProbe[] = [
  { provider: "claude", commands: ["claude"] },
  { provider: "codex", commands: ["codex"] },
  { provider: "antigravity", commands: ["agy", "antigravity"] },
  { provider: "pi", commands: ["pi", "pi-agent"] },
]

function shellQuote(value: string) {
  return `'${value.replaceAll("'", "'\\''")}'`
}

function resolveCommandPath(command: string, options?: { shell?: string; env?: NodeJS.ProcessEnv }) {
  try {
    const shell = options?.shell ?? process.env.SHELL ?? "/bin/zsh"
    const output = execFileSync(shell, ["-lc", `command -v ${shellQuote(command)}`], {
      encoding: "utf8",
      env: options?.env ?? process.env,
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 2_000,
    })
    const [firstLine] = output.trim().split("\n")
    return firstLine || null
  } catch {
    return null
  }
}

function customAgentEnv(env: CustomAgentConfig["env"]) {
  return {
    ...process.env,
    ...Object.fromEntries(env.map((item) => [item.key, item.value])),
  }
}

export function testCustomAgentConnection(
  agent: Pick<CustomAgentConfig, "command" | "args" | "env">,
  options?: { resolver?: (command: string) => string | null }
): CustomAgentConnectionTestResult {
  const command = agent.command.trim()
  if (!command) {
    return { ok: false, commandPath: null, message: "Command is required." }
  }

  const resolver = options?.resolver ?? ((candidate: string) => resolveCommandPath(candidate, { env: customAgentEnv(agent.env) }))
  const commandPath = command.includes("/") ? command : resolver(command)
  if (!commandPath) {
    return {
      ok: false,
      commandPath: null,
      message: `Command not found: ${command}`,
    }
  }

  return {
    ok: true,
    commandPath,
    message: `Command resolved to ${commandPath}.`,
  }
}

export function detectAgentCli(
  probe: AgentCliProbe,
  options?: { now?: Date; shell?: string; env?: NodeJS.ProcessEnv; resolver?: (command: string) => string | null }
): AgentCliDetection {
  const catalog = getServerProviderCatalog(probe.provider)
  const resolver = options?.resolver ?? ((command: string) => resolveCommandPath(command, options))
  let detectedCommand = probe.commands[0] ?? probe.provider
  let detectedPath: string | null = null

  if (!probe.builtIn) {
    for (const command of probe.commands) {
      const commandPath = resolver(command)
      if (!commandPath) continue
      detectedCommand = command
      detectedPath = commandPath
      break
    }
  }

  return {
    provider: probe.provider,
    label: catalog.label,
    status: probe.builtIn ? "built_in" : detectedPath ? "detected" : "missing",
    command: detectedCommand,
    commandPath: detectedPath,
    candidateCommands: [...probe.commands],
    detectedAt: (options?.now ?? new Date()).toISOString(),
  }
}

export function detectAgentClis(options?: {
  now?: Date
  probes?: AgentCliProbe[]
  shell?: string
  env?: NodeJS.ProcessEnv
  resolver?: (command: string) => string | null
}): AgentCliDetectionSnapshot {
  return {
    agents: (options?.probes ?? AGENT_CLI_PROBES).map((probe) => detectAgentCli(probe, options)),
  }
}
