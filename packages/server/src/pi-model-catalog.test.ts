import { describe, expect, test } from "bun:test"
import { mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { readPiProviderCatalog } from "./pi-model-catalog"

describe("readPiProviderCatalog", () => {
  test("reads custom Pi providers and stores model ids as provider/model", async () => {
    const agentDir = await mkdtemp(join(tmpdir(), "kanna-pi-models-"))
    await writeFile(join(agentDir, "models.json"), JSON.stringify({
      providers: {
        "9router": {
          baseUrl: "http://localhost:20128/v1",
          apiKey: "test-key",
          api: "openai-completions",
          models: [
            {
              id: "gemini-3-flash",
              name: "Gemini 3 Flash",
              reasoning: true,
              input: ["text"],
              contextWindow: 1048576,
              maxTokens: 65536,
            },
          ],
        },
      },
    }))

    const catalog = readPiProviderCatalog(agentDir)

    expect(catalog.models[0]).toMatchObject({
      id: "9router/gemini-3-flash",
      label: "Gemini 3 Flash",
      providerId: "9router",
      providerLabel: "9router",
      supportsEffort: true,
    })
  })
})
