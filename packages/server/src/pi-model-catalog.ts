import { AuthStorage, getAgentDir, ModelRegistry } from "@earendil-works/pi-coding-agent"
import { join } from "node:path"
import type { ProviderCatalogEntry, ProviderModelOption } from "@kanna/shared/types"
import { getServerProviderCatalog } from "./provider-catalog"

const DEFAULT_PI_PROVIDER_PREFERENCE = [
  "9router",
  "openai-codex",
  "openai",
  "github-copilot",
  "opencode",
  "cloudflare-gemini",
  "azure-openai-responses",
  "cloudflare-ai-gateway",
]

function providerDisplayName(providerId: string, registry: ModelRegistry) {
  const displayName = registry.getProviderDisplayName(providerId)
  return displayName && displayName !== providerId ? displayName : providerId
}

function sortPiModels(models: ProviderModelOption[]) {
  const providerRank = new Map(DEFAULT_PI_PROVIDER_PREFERENCE.map((provider, index) => [provider, index]))
  return [...models].sort((left, right) => {
    const leftRank = providerRank.get(left.providerId ?? "") ?? DEFAULT_PI_PROVIDER_PREFERENCE.length
    const rightRank = providerRank.get(right.providerId ?? "") ?? DEFAULT_PI_PROVIDER_PREFERENCE.length
    if (leftRank !== rightRank) return leftRank - rightRank
    const providerCompare = (left.providerLabel ?? left.providerId ?? "").localeCompare(
      right.providerLabel ?? right.providerId ?? "",
      undefined,
      { sensitivity: "base", numeric: true }
    )
    if (providerCompare !== 0) return providerCompare
    return left.label.localeCompare(right.label, undefined, { sensitivity: "base", numeric: true })
  })
}

export function readPiProviderCatalog(agentDir = getAgentDir()): ProviderCatalogEntry {
  const authStorage = AuthStorage.create(join(agentDir, "auth.json"))
  const registry = ModelRegistry.create(authStorage, join(agentDir, "models.json"))
  const baseCatalog = getServerProviderCatalog("pi")
  const models = registry.getAll().map((model): ProviderModelOption => {
    const providerLabel = providerDisplayName(model.provider, registry)
    return {
      id: `${model.provider}/${model.id}`,
      label: model.name || model.id,
      providerId: model.provider,
      providerLabel,
      supportsEffort: Boolean(model.reasoning),
    }
  })

  if (models.length === 0) {
    return baseCatalog
  }

  const sortedModels = sortPiModels(models)
  return {
    ...baseCatalog,
    defaultModel: sortedModels[0]?.id ?? baseCatalog.defaultModel,
    models: sortedModels,
  }
}
