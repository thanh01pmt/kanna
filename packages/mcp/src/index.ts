import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { createDefaultWorkflowRuntimeStore, type WorkflowRuntimeStore } from "@kanna/server/workflow-runtime-store"

const server = new McpServer({
  name: "kanna-workflow",
  version: "0.41.5",
})

const store = createDefaultWorkflowRuntimeStore()

function jsonText(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function result<T extends Record<string, unknown>>(structuredContent: T) {
  return {
    structuredContent,
    content: [{ type: "text" as const, text: jsonText(structuredContent) }],
  }
}

function requireCapability<K extends keyof WorkflowRuntimeStore>(name: K): NonNullable<WorkflowRuntimeStore[K]> {
  const capability = store[name]
  if (!capability) {
    throw new Error(`Kanna workflow store does not support ${String(name)}. Check Supabase env vars or runtime configuration.`)
  }
  return capability as NonNullable<WorkflowRuntimeStore[K]>
}

const ProjectIdSchema = z.string().min(1).describe("Kanna project id, e.g. the project selected in the left sidebar.")
const RunIdSchema = z.string().min(1).describe("Workflow run id returned by workflow_start_run or workflow_list_runs.")
const LimitSchema = z.number().int().min(1).max(200).optional().describe("Maximum number of rows to return.")
const JsonObjectSchema = z.record(z.string(), z.unknown())

server.registerTool(
  "workflow_list_definitions",
  {
    title: "List Workflow Definitions",
    description: "List workflow definitions available to a Kanna project. Use this before starting a workflow run.",
    inputSchema: { projectId: ProjectIdSchema },
    outputSchema: { definitions: z.array(z.unknown()) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ projectId }) => {
    const listDefinitions = requireCapability("listDefinitions")
    const definitions = await listDefinitions.call(store, projectId)
    return result({ definitions })
  },
)

server.registerTool(
  "workflow_start_run",
  {
    title: "Start Workflow Run",
    description: "Start a new workflow run for a project. Total step count may grow dynamically as nested workflows are discovered.",
    inputSchema: {
      projectId: ProjectIdSchema,
      workflowDefinitionId: z.string().min(1),
      chatId: z.string().min(1).optional(),
      input: JsonObjectSchema.optional(),
    },
    outputSchema: { projection: z.unknown() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ projectId, workflowDefinitionId, chatId, input }) => {
    const startRun = requireCapability("startRun")
    const projection = await startRun.call(store, { projectId, workflowDefinitionId, chatId, input })
    return result({ projection })
  },
)

server.registerTool(
  "workflow_get_projection",
  {
    title: "Get Workflow Projection",
    description: "Return the latest projected workflow state for a project, including the nested node tree, latest artifacts, and impact estimates.",
    inputSchema: { projectId: ProjectIdSchema },
    outputSchema: { projection: z.unknown().nullable() },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ projectId }) => {
    const projection = await store.getProjectProjection(projectId)
    return result({ projection })
  },
)

server.registerTool(
  "workflow_list_runs",
  {
    title: "List Workflow Runs",
    description: "List recent workflow runs for a project, newest first.",
    inputSchema: { projectId: ProjectIdSchema, limit: LimitSchema },
    outputSchema: { runs: z.array(z.unknown()) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ projectId, limit }) => {
    const listRuns = requireCapability("listRuns")
    const runs = await listRuns.call(store, projectId, limit)
    return result({ runs })
  },
)

server.registerTool(
  "workflow_list_events",
  {
    title: "List Workflow Events",
    description: "List append-only event-store rows for a workflow run. Use this for auditing or reconstructing state.",
    inputSchema: { runId: RunIdSchema, limit: LimitSchema },
    outputSchema: { events: z.array(z.unknown()) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ runId, limit }) => {
    const listEvents = requireCapability("listEvents")
    const events = await listEvents.call(store, runId, limit)
    return result({ events })
  },
)

server.registerTool(
  "workflow_append_event",
  {
    title: "Append Workflow Event",
    description: "Append a typed event to a workflow run. Prefer specialized workflow tools when available; use this for integration events.",
    inputSchema: {
      runId: RunIdSchema,
      type: z.string().min(1).describe("Event type, e.g. external_review_requested."),
      payload: JsonObjectSchema.default({}),
      actorType: z.enum(["user", "agent", "system"]).default("system"),
      actorId: z.string().min(1).optional(),
    },
    outputSchema: { event: z.unknown() },
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
  },
  async ({ runId, type, payload, actorType, actorId }) => {
    const appendEvent = requireCapability("appendEvent")
    const event = await appendEvent.call(store, { runId, type, payload, actorType, actorId })
    return result({ event })
  },
)

server.registerTool(
  "artifact_list",
  {
    title: "List Artifacts",
    description: "List classified artifacts for a project. Filter by kind or logical path text when looking for reusable generated work.",
    inputSchema: {
      projectId: ProjectIdSchema,
      kind: z.string().min(1).optional().describe("Artifact kind such as lesson, quiz, slides, curriculum_framework."),
      query: z.string().min(1).optional().describe("Case-insensitive substring match against logical path."),
      limit: LimitSchema,
    },
    outputSchema: { artifacts: z.array(z.unknown()) },
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
  },
  async ({ projectId, kind, query, limit }) => {
    const listArtifacts = requireCapability("listArtifacts")
    const artifacts = await listArtifacts.call(store, { projectId, kind, query, limit })
    return result({ artifacts })
  },
)

async function main() {
  await server.connect(new StdioServerTransport())
}

main().catch((error) => {
  console.error("[kanna-mcp]", error instanceof Error ? error.stack ?? error.message : String(error))
  process.exit(1)
})
