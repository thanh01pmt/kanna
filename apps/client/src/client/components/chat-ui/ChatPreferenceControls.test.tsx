import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import { PROVIDERS, type ProviderCatalogEntry } from "@kanna/shared/types"
import { ChatPreferenceControls } from "./ChatPreferenceControls"

describe("ChatPreferenceControls", () => {
  test("renders codex-specific controls and can omit plan mode", () => {
    const html = renderToStaticMarkup(
      <ChatPreferenceControls
        availableProviders={PROVIDERS}
        selectedProvider="codex"
        model="gpt-5.3-codex"
        modelOptions={{ reasoningEffort: "xhigh", fastMode: true }}
        onProviderChange={() => {}}
        onModelChange={() => {}}
        onModelOptionChange={() => {}}
        includePlanMode={false}
      />
    )

    expect(html).toContain("Codex")
    expect(html).toContain("GPT-5.3 Codex")
    expect(html).toContain("xhigh")
    expect(html).toContain("Fast Mode")
    expect(html).not.toContain("Plan Mode")
  })

  test("renders claude plan mode controls when enabled", () => {
    const html = renderToStaticMarkup(
      <ChatPreferenceControls
        availableProviders={PROVIDERS}
        selectedProvider="claude"
        model="claude-opus-4-7"
        modelOptions={{ reasoningEffort: "max", contextWindow: "1m" }}
        onProviderChange={() => {}}
        onModelChange={() => {}}
        onModelOptionChange={() => {}}
        planMode
        onPlanModeChange={() => {}}
        includePlanMode
      />
    )

    expect(html).toContain("Claude")
    expect(html).toContain("Opus 4.7")
    expect(html).toContain("Max")
    expect(html).toContain("1M")
    expect(html).toContain("Plan Mode")
  })

  test("renders Pi provider and model separately", () => {
    const piCatalog: ProviderCatalogEntry = {
      ...PROVIDERS.find((provider) => provider.id === "pi")!,
      models: [
        {
          id: "9router/gemini-3-flash",
          label: "gemini-3-flash",
          providerId: "9router",
          providerLabel: "9router",
          supportsEffort: true,
        },
      ],
    }
    const html = renderToStaticMarkup(
      <ChatPreferenceControls
        availableProviders={PROVIDERS.map((provider) => provider.id === "pi" ? piCatalog : provider)}
        selectedProvider="pi"
        model="9router/gemini-3-flash"
        modelOptions={{ reasoningEffort: "high" }}
        onProviderChange={() => {}}
        onModelChange={() => {}}
        onModelOptionChange={() => {}}
      />
    )

    expect(html).toContain("9router")
    expect(html).toContain("gemini-3-flash")
  })
})
