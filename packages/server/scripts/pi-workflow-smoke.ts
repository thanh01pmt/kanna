import { mkdir, readFile } from "node:fs/promises"
import path from "node:path"
import { InMemoryWorkflowRuntimeStore } from "../src/workflow-runtime-store"
import { PiSdkAppServerManager } from "../src/pi-sdk-app-server"

interface SmokeOptions {
  cwd: string
  model: string
  effort: "off" | "minimal" | "low" | "medium" | "high" | "xhigh"
  permissionChoice: string
  testCommand: string
}

function parseArgs(argv: string[]): SmokeOptions {
  const options: SmokeOptions = {
    cwd: process.cwd(),
    model: "gpt-5.5",
    effort: "high",
    permissionChoice: "1",
    testCommand: "pnpm --filter @kanna/server check",
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    const next = argv[index + 1]
    if (arg === "--cwd" && next) {
      options.cwd = path.resolve(next)
      index += 1
    } else if (arg === "--model" && next) {
      options.model = next
      index += 1
    } else if (arg === "--effort" && next) {
      options.effort = next as SmokeOptions["effort"]
      index += 1
    } else if (arg === "--permission-choice" && next) {
      options.permissionChoice = next
      index += 1
    } else if (arg === "--test-command" && next) {
      options.testCommand = next
      index += 1
    }
  }

  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const projectId = `pi-smoke-${Date.now()}`
  const chatId = `${projectId}-chat`
  const artifactPath = "smoke/pi-workflow-smoke.md"
  const absoluteArtifactPath = path.join(options.cwd, artifactPath)

  await mkdir(path.dirname(absoluteArtifactPath), { recursive: true })

  const workflowStore = new InMemoryWorkflowRuntimeStore()
  const definition = await workflowStore.publishManifest({
    projectId,
    manifest: {
      version: "1.0.0",
      name: "Pi Bridge Smoke Workflow",
      description: "Verifies that Kanna can start a workflow, execute Pi, mirror tool activity, and observe a smoke artifact.",
      artifacts: [
        {
          id: "pi_smoke_report",
          name: "Pi smoke report",
          pattern: artifactPath,
        },
      ],
      outputs: [
        {
          path: artifactPath,
          type: "file",
        },
      ],
      nodes: [
        {
          id: "pi-smoke-root",
          name: "Pi bridge smoke",
          nodeType: "workflow",
          status: "running",
          children: [
            {
              id: "create-smoke-artifact",
              name: "Create smoke artifact",
              nodeType: "step",
              status: "running",
              agent: "pi",
              produces: ["pi_smoke_report"],
            },
            {
              id: "run-smoke-test",
              name: "Run smoke test",
              nodeType: "step",
              status: "known",
              agent: "pi",
            },
          ],
        },
      ],
    },
  })
  await workflowStore.registerWorkflow({
    projectId,
    workflowDefinitionId: definition.id,
    versionId: definition.currentVersionId,
    isDefaultEntrypoint: true,
  })
  const run = await workflowStore.startRun({
    projectId,
    workflowDefinitionId: definition.id,
    chatId,
    input: {
      cwd: options.cwd,
      testCommand: options.testCommand,
    },
  })

  const manager = new PiSdkAppServerManager()
  await manager.startSession({
    chatId,
    cwd: options.cwd,
    model: options.model,
    effort: options.effort,
    sessionToken: null,
  })

  const prompt = [
    "Run this Kanna Pi bridge smoke workflow.",
    "",
    `1. Use the Write tool to create ${artifactPath}.`,
    "2. The file must mention that Pi executed the Kanna workflow smoke flow.",
    `3. Run this verification command exactly: ${options.testCommand}`,
    "4. Reply with a concise pass/fail summary.",
  ].join("\n")

  const turn = await manager.startTurn({
    chatId,
    model: options.model,
    effort: options.effort,
    content: prompt,
    onToolRequest: async (request) => {
      const command = request.tool.toolKind === "cli_permission_request"
        ? request.tool.input.command
        : request.tool.toolName
      console.log(`[pi permission] ${command}`)
      return { choice: options.permissionChoice }
    },
  })

  for await (const event of turn.stream) {
    if (event.type !== "transcript" || !event.entry) continue
    const { entry } = event
    await workflowStore.recordTranscriptEntry?.({
      projectId,
      chatId,
      provider: "pi",
      entry,
    })
    if (entry.kind === "assistant_text") {
      console.log(`[pi] ${entry.text}`)
    }
    if (entry.kind === "tool_call") {
      console.log(`[pi tool] ${entry.tool.toolName}`)
    }
    if (entry.kind === "result") {
      console.log(`[pi result] ${entry.subtype}: ${entry.result}`)
    }
  }

  const projection = await workflowStore.getProjectProjection(projectId)
  const events = await workflowStore.listEvents(run.id)
  const artifact = projection?.latestArtifacts?.find((entry) => entry.path === artifactPath)
  const fileContent = await readFile(absoluteArtifactPath, "utf8").catch(() => "")

  console.log("")
  console.log("Kanna + Pi bridge smoke summary")
  console.log(`- project: ${projectId}`)
  console.log(`- workflow: ${definition.name} (${definition.id})`)
  console.log(`- run: ${run.id}`)
  console.log(`- mirrored events: ${events.length}`)
  console.log(`- artifact tracked: ${artifact ? `${artifact.path} (${artifact.workflowStatus ?? "unknown"})` : "no"}`)
  console.log(`- artifact exists: ${fileContent ? "yes" : "no"}`)

  if (!artifact || !fileContent) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
