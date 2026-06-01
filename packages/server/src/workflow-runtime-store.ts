import { existsSync, readFileSync } from "node:fs"
import { createHash, randomUUID } from "node:crypto"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import type { AgentProvider, TranscriptEntry, WorkflowArtifactImpact, WorkflowArtifactRef, WorkflowDefinitionSummary, WorkflowNode, WorkflowRunProjection } from "@kanna/shared/types"
import { createCurriculumWorkflowSeed } from "./workflow-platform/curriculum-seed"

type SupabaseRuntimeClient = ReturnType<typeof createClient<any>>

export type WorkflowEventPayload = Record<string, unknown>

export interface WorkflowEventRecord {
  id: string
  runId: string
  sequence: number
  type: string
  payload: WorkflowEventPayload
  actorType: "user" | "agent" | "system"
  actorId?: string
  createdAt: string
}

export interface WorkflowRuntimeStore {
  getProjectProjection(projectId: string): Promise<WorkflowRunProjection | null>
  listDefinitions?(projectId: string): Promise<WorkflowDefinitionSummary[]>
  listRuns?(projectId: string, limit?: number): Promise<Array<{
    id: string
    projectId: string
    chatId?: string
    workflowType: string
    status: WorkflowRunProjection["status"]
    startedAt?: string
  }>>
  listEvents?(runId: string, limit?: number): Promise<WorkflowEventRecord[]>
  listArtifacts?(args: {
    projectId: string
    kind?: string
    query?: string
    limit?: number
  }): Promise<WorkflowArtifactRef[]>
  startRun?(args: { projectId: string; workflowDefinitionId: string; chatId?: string; input?: Record<string, unknown> }): Promise<WorkflowRunProjection>
  appendEvent?(event: Omit<WorkflowEventRecord, "id" | "sequence" | "createdAt">): Promise<WorkflowEventRecord>
  recordTranscriptEntry?(args: {
    projectId: string
    chatId: string
    provider: AgentProvider
    entry: TranscriptEntry
  }): Promise<void>
}

export class InMemoryWorkflowRuntimeStore implements WorkflowRuntimeStore {
  private readonly projectionsByProjectId = new Map<string, WorkflowRunProjection>()

  async getProjectProjection(projectId: string): Promise<WorkflowRunProjection> {
    const existing = this.projectionsByProjectId.get(projectId)
    if (existing) return existing

    const projection = createSeedWorkflowProjection(projectId)
    this.projectionsByProjectId.set(projectId, projection)
    return projection
  }

  async listRuns(projectId: string): Promise<Array<{
    id: string
    projectId: string
    workflowType: string
    status: WorkflowRunProjection["status"]
    startedAt?: string
  }>> {
    const projection = await this.getProjectProjection(projectId)
    return [cleanOptional({
      id: projection.id,
      projectId,
      workflowType: projection.workflowType,
      status: projection.status,
      startedAt: projection.startedAt,
    })]
  }
}

interface WorkflowRunRow {
  id: string
  project_id: string
  chat_id: string | null
  workflow_type: string
  status: WorkflowRunProjection["status"]
  started_at: string | null
}

interface WorkflowNodeRow {
  id: string
  parent_id: string | null
  node_type: WorkflowNode["nodeType"]
  name: string
  status: WorkflowNode["status"]
  source: WorkflowNode["source"]
  order_index: number
  agent: string | null
  agent_run_id: string | null
  spawned_by_node_id: string | null
  tokens: number | null
  duration_ms: number | null
  condition: string | null
  sealed: boolean | null
  children_sealed: boolean | null
  log_summary: string | null
}

interface WorkflowEventRow {
  sequence: number
}

interface WorkflowArtifactRow {
  id: string
  logical_path: string
  kind: string
  metadata_jsonb: Record<string, unknown> | null
  updated_at: string | null
}

interface WorkflowDefinitionRow {
  id: string
  slug: string
  name: string
  description: string | null
  current_published_version_id: string | null
}

interface WorkflowVersionRow {
  id: string
  version: string
  manifest_jsonb: Record<string, unknown> | null
}

interface WorkflowImpactEventRow {
  id: string
  payload_jsonb: Record<string, unknown> | null
  created_at: string | null
}

interface RuntimeArtifactRef {
  path: string
  kind: string
  action: "read" | "write" | "edit" | "delete" | "observe"
  contentSnapshot?: string
}

function readEnvFile() {
  const envPath = path.resolve(process.cwd(), ".env.local")
  if (!existsSync(envPath)) return new Map<string, string>()

  const values = new Map<string, string>()
  for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const separator = trimmed.indexOf("=")
    if (separator <= 0) continue
    values.set(trimmed.slice(0, separator), trimmed.slice(separator + 1))
  }
  return values
}

function getEnvValue(key: string, envFile = readEnvFile()) {
  return process.env[key] || envFile.get(key) || ""
}

function stringFromWorkflowPayload(value: unknown) {
  if (typeof value === "string") return value
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function asRuntimeRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function cleanOptional<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined)) as T
}

function normalizeArtifactPath(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed || trimmed.includes("\0")) return null
  return trimmed.replaceAll("\\", "/").replace(/^\.\/+/, "")
}

function classifyArtifactKind(filePath: string): string {
  const baseName = path.posix.basename(filePath).toUpperCase()

  if (baseName === "CURRICULUM_FRAMEWORK.MD") return "curriculum_framework"
  if (baseName === "ART_DIRECTION.MD") return "art_direction"
  if (baseName === "CONTENT_STYLE_GUIDE.MD") return "content_style_guide"
  if (baseName === "PROJECT_BRIEF.MD") return "project_brief"
  if (baseName === "LEARNER_PROFILE.MD") return "learner_profile"
  if (baseName.startsWith("LESSON_") && baseName.endsWith(".MD")) return "lesson"
  if (baseName.startsWith("QUIZ_") && baseName.endsWith(".MD")) return "quiz"
  if (baseName.startsWith("SLIDES_") && baseName.endsWith(".MD")) return "slides"
  if (baseName.startsWith("ACT_") && baseName.endsWith(".MD")) return "activity"
  if (baseName.startsWith("GUIDE_") && baseName.endsWith(".MD")) return "guide"
  if (baseName.startsWith("HANDOUT_") && baseName.endsWith(".MD")) return "handout"
  if (baseName.startsWith("WKS_") && baseName.endsWith(".MD")) return "worksheet"
  if (baseName.startsWith("EXT_") && baseName.endsWith(".MD")) return "extension"
  if (baseName.startsWith("MEDIA_SCRIPT_") && baseName.endsWith(".MD")) return "media_script"
  if (baseName.includes("REFERENCE_REGISTRY") && baseName.endsWith(".JSON")) return "reference_registry"
  if (baseName === "REFERENCE_PACK.MD") return "reference_pack"
  if (baseName.endsWith(".MD")) return "markdown_artifact"
  if (baseName.endsWith(".JSON")) return "json_artifact"
  return "file_artifact"
}

function checksumForContent(content: string) {
  return createHash("sha256").update(content).digest("hex")
}

function toWorkflowNode(row: WorkflowNodeRow): WorkflowNode {
  return {
    id: row.id,
    name: row.name,
    nodeType: row.node_type,
    status: row.status,
    source: row.source,
    order: row.order_index,
    agent: row.agent ?? undefined,
    agentRunId: row.agent_run_id ?? undefined,
    spawnedByNodeId: row.spawned_by_node_id ?? undefined,
    tokens: row.tokens ?? undefined,
    durationMs: row.duration_ms ?? undefined,
    condition: row.condition ?? undefined,
    sealed: row.sealed ?? undefined,
    childrenSealed: row.children_sealed ?? undefined,
    logSummary: row.log_summary ?? undefined,
  }
}

function buildNodeTree(rows: WorkflowNodeRow[], fallbackRoot: WorkflowNode): WorkflowNode {
  if (rows.length === 0) return fallbackRoot

  const nodes = new Map<string, WorkflowNode>()
  for (const row of rows) {
    nodes.set(row.id, toWorkflowNode(row))
  }

  let root: WorkflowNode | null = null
  for (const row of rows) {
    const node = nodes.get(row.id)
    if (!node) continue
    if (!row.parent_id) {
      root = node
      continue
    }
    const parent = nodes.get(row.parent_id)
    if (!parent) continue
    parent.children = [...(parent.children ?? []), node]
  }

  for (const node of nodes.values()) {
    node.children?.sort((left, right) => left.order - right.order)
  }

  return root ?? fallbackRoot
}

export class SupabaseWorkflowRuntimeStore implements WorkflowRuntimeStore {
  private warned = false

  constructor(private readonly client: SupabaseRuntimeClient) {}

  async listDefinitions(projectId: string): Promise<WorkflowDefinitionSummary[]> {
    await this.ensureWorkflowDefinition(projectId)

    const { data: definitions, error } = await this.client
      .from("workflow_definitions")
      .select("id, slug, name, description, current_published_version_id")
      .order("created_at", { ascending: true })

    if (error) throw new Error(error.message)
    const rows = Array.isArray(definitions) ? definitions as WorkflowDefinitionRow[] : []

    const summaries: WorkflowDefinitionSummary[] = []
    for (const row of rows) {
      let version: WorkflowVersionRow | null = null
      if (row.current_published_version_id) {
        const { data: versionData, error: versionError } = await this.client
          .from("workflow_versions")
          .select("id, version, manifest_jsonb")
          .eq("id", row.current_published_version_id)
          .limit(1)

        if (versionError) throw new Error(versionError.message)
        version = Array.isArray(versionData) ? versionData[0] as WorkflowVersionRow | undefined ?? null : null
      }

      const manifest = asRuntimeRecord(version?.manifest_jsonb)
      summaries.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description ?? undefined,
        currentVersionId: row.current_published_version_id ?? undefined,
        currentVersion: version?.version,
        workflowType: typeof manifest.entryWorkflow === "string" ? manifest.entryWorkflow : row.slug,
      })
    }

    return summaries
  }

  async startRun(args: {
    projectId: string
    workflowDefinitionId: string
    chatId?: string
    input?: Record<string, unknown>
  }): Promise<WorkflowRunProjection> {
    const definition = await this.getWorkflowDefinition(args.workflowDefinitionId)
    const workflowVersionId = definition.current_published_version_id ?? await this.ensureWorkflowDefinition(args.projectId)
    const seed = createCurriculumWorkflowSeed(args.projectId)
    const runId = randomUUID()

    const { error: runError } = await this.client
      .from("workflow_runs")
      .insert({
        id: runId,
        project_id: args.projectId,
        chat_id: args.chatId ?? null,
        workflow_version_id: workflowVersionId,
        workflow_type: seed.projection.workflowType,
        status: "running",
        input_jsonb: args.input ?? {},
      })

    if (runError) throw new Error(runError.message)
    await this.insertSeedNodesArtifactsAndDiscoveryEvents(args.projectId, runId, seed)
    await this.appendEvent({
      runId,
      type: "workflow_run_started",
      actorType: "user",
      payload: {
        projectId: args.projectId,
        chatId: args.chatId,
        workflowDefinitionId: args.workflowDefinitionId,
        workflowVersionId,
        input: args.input ?? {},
      },
    })

    return await this.getProjectProjection(args.projectId)
  }

  async appendEvent(event: Omit<WorkflowEventRecord, "id" | "sequence" | "createdAt">): Promise<WorkflowEventRecord> {
    const { data: lastEvents, error: lastEventError } = await this.client
      .from("workflow_events")
      .select("sequence")
      .eq("run_id", event.runId)
      .order("sequence", { ascending: false })
      .limit(1)

    if (lastEventError) throw new Error(lastEventError.message)
    const lastSequence = Array.isArray(lastEvents) && (lastEvents[0] as WorkflowEventRow | undefined)?.sequence
      ? Number((lastEvents[0] as WorkflowEventRow).sequence)
      : 0
    const sequence = lastSequence + 1
    const id = randomUUID()

    const { data, error } = await this.client
      .from("workflow_events")
      .insert({
        id,
        run_id: event.runId,
        sequence,
        type: event.type,
        payload_jsonb: event.payload,
        actor_type: event.actorType,
        actor_id: event.actorId ?? null,
      })
      .select("id, run_id, sequence, type, payload_jsonb, actor_type, actor_id, created_at")
      .single()

    if (error) throw new Error(error.message)

    return {
      id: data.id,
      runId: data.run_id,
      sequence: Number(data.sequence),
      type: data.type,
      payload: data.payload_jsonb,
      actorType: data.actor_type,
      actorId: data.actor_id ?? undefined,
      createdAt: data.created_at,
    }
  }

  async listRuns(projectId: string, limit = 20): Promise<Array<{
    id: string
    projectId: string
    chatId?: string
    workflowType: string
    status: WorkflowRunProjection["status"]
    startedAt?: string
  }>> {
    const boundedLimit = Math.max(1, Math.min(100, Math.floor(limit)))
    const { data, error } = await this.client
      .from("workflow_runs")
      .select("id, project_id, chat_id, workflow_type, status, started_at")
      .eq("project_id", projectId)
      .order("started_at", { ascending: false })
      .limit(boundedLimit)

    if (error) throw new Error(error.message)
    const rows = Array.isArray(data) ? data as WorkflowRunRow[] : []
    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      chatId: row.chat_id ?? undefined,
      workflowType: row.workflow_type,
      status: row.status,
      startedAt: row.started_at ?? undefined,
    }))
  }

  async listEvents(runId: string, limit = 50): Promise<WorkflowEventRecord[]> {
    const boundedLimit = Math.max(1, Math.min(200, Math.floor(limit)))
    const { data, error } = await this.client
      .from("workflow_events")
      .select("id, run_id, sequence, type, payload_jsonb, actor_type, actor_id, created_at")
      .eq("run_id", runId)
      .order("sequence", { ascending: false })
      .limit(boundedLimit)

    if (error) throw new Error(error.message)
    const rows = Array.isArray(data) ? data : []
    return rows.map((row: any) => ({
      id: row.id,
      runId: row.run_id,
      sequence: Number(row.sequence),
      type: row.type,
      payload: asRuntimeRecord(row.payload_jsonb),
      actorType: row.actor_type,
      actorId: row.actor_id ?? undefined,
      createdAt: row.created_at,
    })).reverse()
  }

  async listArtifacts(args: {
    projectId: string
    kind?: string
    query?: string
    limit?: number
  }): Promise<WorkflowArtifactRef[]> {
    let query = this.client
      .from("artifacts")
      .select("id, logical_path, kind, metadata_jsonb, updated_at")
      .eq("project_id", args.projectId)
      .order("updated_at", { ascending: false })
      .limit(Math.max(1, Math.min(100, Math.floor(args.limit ?? 24))))

    if (args.kind) {
      query = query.eq("kind", args.kind)
    }
    if (args.query) {
      query = query.ilike("logical_path", `%${args.query}%`)
    }

    const { data, error } = await query
    if (error) throw new Error(error.message)
    return this.artifactRowsToRefs(Array.isArray(data) ? data as WorkflowArtifactRow[] : [])
  }

  async getProjectProjection(projectId: string): Promise<WorkflowRunProjection> {
    const seed = createSeedWorkflowProjection(projectId)

    try {
      const { data: runs, error: runError } = await this.client
        .from("workflow_runs")
        .select("id, project_id, chat_id, workflow_type, status, started_at")
        .eq("project_id", projectId)
        .order("started_at", { ascending: false })
        .limit(1)

      if (runError) throw new Error(runError.message)
      const run = Array.isArray(runs) ? runs[0] as WorkflowRunRow | undefined : undefined
      if (!run) {
        await this.seedProjectRun(projectId)
        return this.getProjectProjection(projectId)
      }

      const { data: nodes, error: nodeError } = await this.client
        .from("workflow_nodes")
        .select("id, parent_id, node_type, name, status, source, order_index, agent, agent_run_id, spawned_by_node_id, tokens, duration_ms, condition, sealed, children_sealed, log_summary")
        .eq("run_id", run.id)
        .order("order_index", { ascending: true })
        .limit(1000)

      if (nodeError) throw new Error(nodeError.message)
      const nodeRows = Array.isArray(nodes) ? nodes as WorkflowNodeRow[] : []
      const latestArtifacts = await this.getLatestArtifacts(run.project_id)
      const impacts = await this.getImpactEstimates(run.id, latestArtifacts)

      return {
        ...seed,
        id: run.id,
        projectId: run.project_id,
        chatId: run.chat_id ?? undefined,
        workflowType: run.workflow_type,
        title: run.workflow_type,
        status: run.status,
        startedAt: run.started_at ?? undefined,
        root: buildNodeTree(nodeRows, seed.root),
        latestArtifacts: latestArtifacts.length > 0 ? latestArtifacts : seed.latestArtifacts,
        impacts: impacts.length > 0 ? impacts : seed.impacts,
      }
    } catch (error) {
      if (!this.warned) {
        this.warned = true
        console.warn("[workflow-runtime] Falling back to seed workflow projection:", error instanceof Error ? error.message : String(error))
      }
      return seed
    }
  }

  private async getLatestArtifacts(projectId: string): Promise<WorkflowArtifactRef[]> {
    const { data, error } = await this.client
      .from("artifacts")
      .select("id, logical_path, kind, metadata_jsonb, updated_at")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(24)

    if (error) throw new Error(error.message)
    const rows = Array.isArray(data) ? data as WorkflowArtifactRow[] : []

    return this.artifactRowsToRefs(rows)
  }

  private artifactRowsToRefs(rows: WorkflowArtifactRow[]): WorkflowArtifactRef[] {
    return rows.map((row) => {
      const metadata = asRuntimeRecord(row.metadata_jsonb)
      return {
        id: row.id,
        path: row.logical_path,
        kind: row.kind,
        changed: metadata.lastObservedAction === "write"
          || metadata.lastObservedAction === "edit"
          || metadata.lastObservedAction === "delete"
          || metadata.changed === true,
        producedByNodeId: typeof metadata.producedByNodeId === "string"
          ? metadata.producedByNodeId
          : typeof metadata.lastObservedToolId === "string"
            ? `tool_${metadata.lastObservedToolId}`
            : undefined,
      }
    })
  }

  private async getImpactEstimates(runId: string, artifacts: WorkflowArtifactRef[]): Promise<WorkflowArtifactImpact[]> {
    const artifactByPath = new Map(artifacts.map((artifact) => [artifact.path, artifact]))
    const latestSourceIdByKind = new Map<string, string>()
    for (const artifact of artifacts) {
      if (!latestSourceIdByKind.has(artifact.kind)) {
        latestSourceIdByKind.set(artifact.kind, artifact.id)
      }
    }

    const { data, error } = await this.client
      .from("workflow_events")
      .select("id, payload_jsonb, created_at")
      .eq("run_id", runId)
      .eq("type", "artifact_downstream_review_estimated")
      .order("sequence", { ascending: false })
      .limit(50)

    if (error) throw new Error(error.message)
    const rows = Array.isArray(data) ? data as WorkflowImpactEventRow[] : []
    const impacts: WorkflowArtifactImpact[] = []
    const seen = new Set<string>()

    for (const row of rows) {
      const payload = asRuntimeRecord(row.payload_jsonb)
      const sourcePath = typeof payload.sourcePath === "string" ? payload.sourcePath : ""
      const sourceKind = typeof payload.sourceKind === "string" ? payload.sourceKind : ""
      const sourceArtifactId = artifactByPath.get(sourcePath)?.id ?? latestSourceIdByKind.get(sourceKind) ?? sourcePath
      const impactedItems = Array.isArray(payload.impacted) ? payload.impacted : []

      for (const item of impactedItems) {
        const record = asRuntimeRecord(item)
        const impactedKind = typeof record.impactedKind === "string" ? record.impactedKind : "artifact"
        const relationship = record.relationship === "transitive" ? "transitive" : "direct"
        const reason = typeof record.reason === "string" ? record.reason : undefined
        const key = `${sourceArtifactId}:${impactedKind}:${relationship}:${reason ?? ""}`
        if (seen.has(key)) continue
        seen.add(key)

        impacts.push({
          id: `${row.id}_${impacts.length}`,
          sourceArtifactId,
          impactedArtifactId: `${sourceArtifactId}_${impactedKind}`,
          impactedPath: this.describeImpactedPath(sourcePath, impactedKind),
          impactedKind,
          status: relationship === "direct" ? "needs_review" : "maybe_impacted",
          relationship,
          reason,
        })
      }
    }

    return impacts
  }

  private describeImpactedPath(sourcePath: string, impactedKind: string) {
    const directory = sourcePath.includes("/") ? sourcePath.split("/").slice(0, -1).join("/") : ""
    if (directory && (impactedKind === "quiz" || impactedKind === "slides" || impactedKind === "activity")) {
      return `${directory}/${impactedKind.toUpperCase()}_*`
    }
    return impactedKind
  }

  async recordTranscriptEntry(args: {
    projectId: string
    chatId: string
    provider: AgentProvider
    entry: TranscriptEntry
  }): Promise<void> {
    const run = await this.ensureProjectRun(args.projectId, args.chatId)
    const payload = this.workflowPayloadFromTranscriptEntry(args)
    if (!payload) return

    await this.appendEvent({
      runId: run.id,
      type: payload.eventType,
      payload: payload.payload,
      actorType: payload.actorType,
      actorId: payload.actorId,
    })

    if (args.entry.kind === "tool_call") {
      const artifact = this.artifactFromToolCall(args.entry.tool.toolKind, args.entry.tool.input)
      if (artifact) {
        await this.recordArtifactToolCall({
          runId: run.id,
          projectId: args.projectId,
          chatId: args.chatId,
          provider: args.provider,
          toolId: args.entry.tool.toolId,
          artifact,
        })
      }
    }

    if (args.entry.kind === "tool_call") {
      await this.ensureRuntimeActivityParent(run.id)
      await this.upsertWorkflowNode(run.id, {
        id: `tool_${args.entry.tool.toolId}`,
        parent_id: "runtime_agent_activity",
        node_type: "step",
        name: payload.nodeName,
        status: "running",
        source: "dynamic",
        order_index: Math.floor(Date.now() / 1000),
        agent: args.provider,
        agent_run_id: args.chatId,
        spawned_by_node_id: "runtime_agent_activity",
        tokens: null,
        duration_ms: null,
        condition: null,
        sealed: false,
        children_sealed: true,
        log_summary: payload.nodeSummary ?? null,
      })
    }

    if (args.entry.kind === "tool_result") {
      await this.updateWorkflowNode(run.id, `tool_${args.entry.toolId}`, {
        status: args.entry.isError ? "failed" : "done",
        sealed: true,
        log_summary: args.entry.isError ? "Tool result returned an error." : "Tool completed.",
      })
    }

    if (args.entry.kind === "context_window_updated") {
      await this.updateWorkflowNode(run.id, "runtime_agent_activity", {
        tokens: args.entry.usage.usedTokens,
        log_summary: `Observed ${args.entry.usage.usedTokens.toLocaleString()} context tokens in the active turn.`,
      })
    }

    if (args.entry.kind === "result") {
      await this.updateWorkflowNode(run.id, "runtime_agent_activity", {
        status: args.entry.isError ? "failed" : "done",
        duration_ms: args.entry.durationMs,
        sealed: true,
        log_summary: args.entry.isError ? args.entry.result.slice(0, 240) : "Agent turn finished.",
      })
    }
  }

  private workflowPayloadFromTranscriptEntry(args: {
    projectId: string
    chatId: string
    provider: AgentProvider
    entry: TranscriptEntry
  }): null | {
    eventType: string
    actorType: WorkflowEventRecord["actorType"]
    actorId?: string
    nodeName: string
    nodeSummary?: string
    payload: WorkflowEventPayload
  } {
    const basePayload = {
      projectId: args.projectId,
      chatId: args.chatId,
      provider: args.provider,
      transcriptEntryId: args.entry._id,
      transcriptKind: args.entry.kind,
    }

    switch (args.entry.kind) {
      case "user_prompt":
        return {
          eventType: "chat_prompt_received",
          actorType: "user",
          nodeName: "User prompt",
          payload: {
            ...basePayload,
            attachmentCount: args.entry.attachments?.length ?? 0,
            steered: Boolean(args.entry.steered),
          },
        }
      case "system_init":
        return {
          eventType: "agent_session_started",
          actorType: "agent",
          actorId: args.provider,
          nodeName: "Agent session started",
          payload: {
            ...basePayload,
            model: args.entry.model,
            tools: args.entry.tools,
            agents: args.entry.agents,
          },
        }
      case "assistant_text":
        return {
          eventType: "agent_message",
          actorType: "agent",
          actorId: args.provider,
          nodeName: "Agent message",
          payload: {
            ...basePayload,
            textPreview: args.entry.text.slice(0, 400),
          },
        }
      case "tool_call": {
        const tool = args.entry.tool
        return {
          eventType: "agent_tool_started",
          actorType: "agent",
          actorId: args.provider,
          nodeName: tool.toolKind.replaceAll("_", " "),
          nodeSummary: tool.toolName,
          payload: {
            ...basePayload,
            toolId: tool.toolId,
            toolKind: tool.toolKind,
            toolName: tool.toolName,
            input: tool.input,
          },
        }
      }
      case "tool_result":
        return {
          eventType: "agent_tool_finished",
          actorType: "agent",
          actorId: args.provider,
          nodeName: "Tool result",
          payload: {
            ...basePayload,
            toolId: args.entry.toolId,
            isError: Boolean(args.entry.isError),
            resultPreview: stringFromWorkflowPayload(args.entry.content).slice(0, 800),
          },
        }
      case "context_window_updated":
        return {
          eventType: "token_usage_observed",
          actorType: "system",
          nodeName: "Token usage",
          payload: {
            ...basePayload,
            usage: args.entry.usage,
          },
        }
      case "result":
        return {
          eventType: "agent_turn_finished",
          actorType: "agent",
          actorId: args.provider,
          nodeName: "Agent turn finished",
          payload: {
            ...basePayload,
            subtype: args.entry.subtype,
            isError: args.entry.isError,
            durationMs: args.entry.durationMs,
            resultPreview: args.entry.result.slice(0, 800),
          },
        }
      case "interrupted":
        return {
          eventType: "agent_turn_interrupted",
          actorType: "system",
          nodeName: "Agent interrupted",
          payload: basePayload,
        }
      default:
        return null
    }
  }

  private artifactFromToolCall(toolKind: string, input: unknown): RuntimeArtifactRef | null {
    const record = asRuntimeRecord(input)
    const filePath = normalizeArtifactPath(record.filePath ?? record.path)
    if (!filePath) return null

    if (toolKind === "read_file") {
      return { path: filePath, kind: classifyArtifactKind(filePath), action: "read" }
    }
    if (toolKind === "write_file") {
      return {
        path: filePath,
        kind: classifyArtifactKind(filePath),
        action: "write",
        contentSnapshot: typeof record.content === "string" ? record.content : undefined,
      }
    }
    if (toolKind === "edit_file") {
      const contentSnapshot = [
        typeof record.oldString === "string" ? record.oldString : "",
        typeof record.newString === "string" ? record.newString : "",
      ].join("\n---kanna-edit---\n")
      return { path: filePath, kind: classifyArtifactKind(filePath), action: "edit", contentSnapshot }
    }
    if (toolKind === "delete_file") {
      return { path: filePath, kind: classifyArtifactKind(filePath), action: "delete", contentSnapshot: "" }
    }

    return null
  }

  private async recordArtifactToolCall(args: {
    runId: string
    projectId: string
    chatId: string
    provider: AgentProvider
    toolId: string
    artifact: RuntimeArtifactRef
  }): Promise<void> {
    const artifactId = await this.upsertArtifact({
      projectId: args.projectId,
      artifact: args.artifact,
      metadata: {
        lastObservedRunId: args.runId,
        lastObservedChatId: args.chatId,
        lastObservedToolId: args.toolId,
        lastObservedProvider: args.provider,
        lastObservedAction: args.artifact.action,
      },
    })

    if (args.artifact.action !== "read") {
      await this.recordArtifactVersion({
        artifactId,
        runId: args.runId,
        nodeId: `tool_${args.toolId}`,
        artifact: args.artifact,
      })
    }

    await this.appendEvent({
      runId: args.runId,
      type: args.artifact.action === "read" ? "artifact_observed" : "artifact_write_started",
      actorType: "agent",
      actorId: args.provider,
      payload: {
        projectId: args.projectId,
        chatId: args.chatId,
        toolId: args.toolId,
        path: args.artifact.path,
        kind: args.artifact.kind,
        action: args.artifact.action,
      },
    })

    if (args.artifact.action !== "read") {
      await this.createArtifactImpactEstimates(args)
    }
  }

  private async upsertArtifact(args: {
    projectId: string
    artifact: RuntimeArtifactRef
    metadata: Record<string, unknown>
  }): Promise<string> {
    const { data: existingArtifacts, error: lookupError } = await this.client
      .from("artifacts")
      .select("id")
      .eq("project_id", args.projectId)
      .eq("logical_path", args.artifact.path)
      .limit(1)

    if (lookupError) throw new Error(lookupError.message)
    const existingId = Array.isArray(existingArtifacts) ? existingArtifacts[0]?.id as string | undefined : undefined

    if (existingId) {
      const { error } = await this.client
        .from("artifacts")
        .update({
          kind: args.artifact.kind,
          reuse_scope: "project",
          metadata_jsonb: {
            ...args.metadata,
            classifier: "kanna-runtime-path-v1",
            updatedByRuntimeAt: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingId)

      if (error) throw new Error(error.message)
      return existingId
    }

    const id = randomUUID()
    const { error } = await this.client
      .from("artifacts")
      .insert({
        id,
        project_id: args.projectId,
        logical_path: args.artifact.path,
        kind: args.artifact.kind,
        reuse_scope: "project",
        metadata_jsonb: {
          ...args.metadata,
          classifier: "kanna-runtime-path-v1",
          updatedByRuntimeAt: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      })

    if (error) throw new Error(error.message)
    return id
  }

  private async recordArtifactVersion(args: {
    artifactId: string
    runId: string
    nodeId: string
    artifact: RuntimeArtifactRef
  }): Promise<void> {
    const versionId = randomUUID()
    const content = args.artifact.contentSnapshot ?? `${args.artifact.action}:${args.artifact.path}`
    const checksum = checksumForContent(content)
    const storageKey = `workflow-artifacts/${args.runId}/${versionId}/${args.artifact.path}`

    const { error: insertError } = await this.client
      .from("artifact_versions")
      .insert({
        id: versionId,
        artifact_id: args.artifactId,
        storage_key: storageKey,
        checksum,
        content_type: args.artifact.path.endsWith(".json") ? "application/json" : "text/markdown",
        size_bytes: Buffer.byteLength(content, "utf8"),
        produced_by_run_id: args.runId,
        produced_by_node_id: args.nodeId,
        metadata_jsonb: {
          action: args.artifact.action,
          logicalPath: args.artifact.path,
          storageMode: "metadata-only-mvp",
        },
      })

    if (insertError) throw new Error(insertError.message)

    const { error: updateError } = await this.client
      .from("artifacts")
      .update({
        current_version_id: versionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", args.artifactId)

    if (updateError) throw new Error(updateError.message)
  }

  private async createArtifactImpactEstimates(args: {
    runId: string
    projectId: string
    chatId: string
    provider: AgentProvider
    toolId: string
    artifact: RuntimeArtifactRef
  }): Promise<void> {
    const impacted = this.estimateImpactedArtifacts(args.artifact)
    if (impacted.length === 0) return

    await this.appendEvent({
      runId: args.runId,
      type: "artifact_downstream_review_estimated",
      actorType: "system",
      payload: {
        projectId: args.projectId,
        chatId: args.chatId,
        sourcePath: args.artifact.path,
        sourceKind: args.artifact.kind,
        toolId: args.toolId,
        impacted,
      },
    })
  }

  private estimateImpactedArtifacts(artifact: RuntimeArtifactRef): Array<{
    impactedKind: string
    relationship: "direct" | "transitive"
    reason: string
  }> {
    if (artifact.kind === "curriculum_framework") {
      return [
        {
          impactedKind: "unit_framework",
          relationship: "direct",
          reason: "Units derive scope and sequencing from the curriculum framework.",
        },
        {
          impactedKind: "lesson",
          relationship: "transitive",
          reason: "Lessons inherit objectives and unit ordering from the framework.",
        },
      ]
    }

    if (artifact.kind === "lesson") {
      return [
        {
          impactedKind: "quiz",
          relationship: "direct",
          reason: "Quiz content is generated from canonical lesson content.",
        },
        {
          impactedKind: "slides",
          relationship: "direct",
          reason: "Slides are generated from canonical lesson content and art direction.",
        },
        {
          impactedKind: "activity",
          relationship: "transitive",
          reason: "Satellite classroom artifacts should be reviewed after lesson edits.",
        },
      ]
    }

    if (artifact.kind === "art_direction") {
      return [
        {
          impactedKind: "slides",
          relationship: "direct",
          reason: "Slide visuals and layout rules depend on art direction.",
        },
        {
          impactedKind: "media_script",
          relationship: "transitive",
          reason: "Media script tone and visual callouts may depend on art direction.",
        },
      ]
    }

    return []
  }

  private async ensureProjectRun(projectId: string, chatId?: string): Promise<WorkflowRunRow> {
    const { data: runs, error } = await this.client
      .from("workflow_runs")
      .select("id, project_id, chat_id, workflow_type, status, started_at")
      .eq("project_id", projectId)
      .order("started_at", { ascending: false })
      .limit(1)

    if (error) throw new Error(error.message)
    const existing = Array.isArray(runs) ? runs[0] as WorkflowRunRow | undefined : undefined
    if (existing) {
      if (!existing.chat_id && chatId) {
        await this.client.from("workflow_runs").update({ chat_id: chatId }).eq("id", existing.id)
        return { ...existing, chat_id: chatId }
      }
      return existing
    }

    await this.seedProjectRun(projectId)
    return await this.ensureProjectRun(projectId, chatId)
  }

  private async ensureRuntimeActivityParent(runId: string): Promise<void> {
    await this.upsertWorkflowNode(runId, {
      id: "runtime_agent_activity",
      parent_id: "wf_create_course",
      node_type: "workflow",
      name: "Agent activity",
      status: "running",
      source: "dynamic",
      order_index: 10_000,
      agent: "runtime",
      agent_run_id: null,
      spawned_by_node_id: null,
      tokens: null,
      duration_ms: null,
      condition: "live transcript events mirrored from the chat area",
      sealed: false,
      children_sealed: false,
      log_summary: "Live agent/tool activity stays in chat and is summarized here for workflow progress.",
    })
  }

  private async upsertWorkflowNode(runId: string, node: {
    id: string
    parent_id: string | null
    node_type: WorkflowNode["nodeType"]
    name: string
    status: WorkflowNode["status"]
    source: WorkflowNode["source"]
    order_index: number
    agent: string | null
    agent_run_id: string | null
    spawned_by_node_id: string | null
    tokens: number | null
    duration_ms: number | null
    condition: string | null
    sealed: boolean
    children_sealed: boolean
    log_summary: string | null
  }): Promise<void> {
    const { error } = await this.client
      .from("workflow_nodes")
      .upsert({
        ...node,
        run_id: runId,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: "run_id,id",
      })

    if (error) throw new Error(error.message)
  }

  private async updateWorkflowNode(runId: string, id: string, patch: Partial<{
    status: WorkflowNode["status"]
    tokens: number
    duration_ms: number
    sealed: boolean
    log_summary: string
  }>): Promise<void> {
    const { error } = await this.client
      .from("workflow_nodes")
      .update({
        ...patch,
        updated_at: new Date().toISOString(),
      })
      .eq("run_id", runId)
      .eq("id", id)

    if (error) throw new Error(error.message)
  }

  private async ensureWorkflowDefinition(projectId: string): Promise<string> {
    const seed = createCurriculumWorkflowSeed(projectId)
    const definitionId = randomUUID()
    const versionId = randomUUID()

    const { data: existingDefinitions, error: definitionLookupError } = await this.client
      .from("workflow_definitions")
      .select("id, current_published_version_id")
      .eq("slug", seed.slug)
      .limit(1)

    if (definitionLookupError) throw new Error(definitionLookupError.message)
    const existingDefinition = Array.isArray(existingDefinitions)
      ? existingDefinitions[0] as Pick<WorkflowDefinitionRow, "id" | "current_published_version_id"> | undefined
      : undefined

    const workflowDefinitionId = existingDefinition?.id ?? definitionId

    if (!existingDefinition) {
      const { error } = await this.client
        .from("workflow_definitions")
        .insert({
          id: workflowDefinitionId,
          slug: seed.slug,
          name: seed.name,
          description: seed.description,
          owner_project_id: projectId,
        })

      if (error) throw new Error(error.message)
    }

    const { data: existingVersions, error: versionLookupError } = await this.client
      .from("workflow_versions")
      .select("id")
      .eq("workflow_definition_id", workflowDefinitionId)
      .eq("version", seed.version)
      .limit(1)

    if (versionLookupError) throw new Error(versionLookupError.message)
    const existingVersionId = Array.isArray(existingVersions) ? existingVersions[0]?.id as string | undefined : undefined
    const workflowVersionId = existingVersionId ?? versionId

    if (!existingVersionId) {
      const { error } = await this.client
        .from("workflow_versions")
        .insert({
          id: workflowVersionId,
          workflow_definition_id: workflowDefinitionId,
          version: seed.version,
          status: "published",
          source_markdown: seed.sourceFiles.join("\n"),
          manifest_jsonb: seed.manifest,
          created_by: "kanna-seed",
          published_at: new Date().toISOString(),
        })

      if (error) throw new Error(error.message)
    }

    if (existingDefinition?.current_published_version_id !== workflowVersionId) {
      const { error: updateDefinitionError } = await this.client
        .from("workflow_definitions")
        .update({ current_published_version_id: workflowVersionId })
        .eq("id", workflowDefinitionId)

      if (updateDefinitionError) throw new Error(updateDefinitionError.message)
    }

    return workflowVersionId
  }

  private async getWorkflowDefinition(definitionId: string): Promise<WorkflowDefinitionRow> {
    const { data, error } = await this.client
      .from("workflow_definitions")
      .select("id, slug, name, description, current_published_version_id")
      .eq("id", definitionId)
      .limit(1)

    if (error) throw new Error(error.message)
    const definition = Array.isArray(data) ? data[0] as WorkflowDefinitionRow | undefined : undefined
    if (!definition) throw new Error("Workflow definition not found")
    return definition
  }

  private async insertSeedNodesArtifactsAndDiscoveryEvents(
    projectId: string,
    runId: string,
    seed = createCurriculumWorkflowSeed(projectId)
  ): Promise<void> {
    const { error: nodeError } = await this.client
      .from("workflow_nodes")
      .insert(seed.nodes.map((node) => ({
        ...node,
        run_id: runId,
        agent: node.agent ?? null,
        tokens: node.tokens ?? null,
        duration_ms: node.duration_ms ?? null,
        condition: node.condition ?? null,
        sealed: node.sealed ?? false,
        children_sealed: node.children_sealed ?? false,
        log_summary: node.log_summary ?? null,
      })))

    if (nodeError) throw new Error(nodeError.message)

    const { error: artifactError } = await this.client
      .from("artifacts")
      .upsert(seed.artifacts.map((artifact) => ({
        id: randomUUID(),
        project_id: projectId,
        logical_path: artifact.path,
        kind: artifact.kind,
        reuse_scope: "project",
        metadata_jsonb: {
          seededFrom: "curriculum-workflow-markdown",
          producedByNodeId: artifact.producedByNodeId,
          changed: artifact.changed ?? false,
        },
      })), {
        onConflict: "project_id,logical_path",
        ignoreDuplicates: true,
      })

    if (artifactError) throw new Error(artifactError.message)

    const eventRows = seed.nodes.map((node, index) => ({
      id: randomUUID(),
      run_id: runId,
      sequence: index + 1,
      type: index === 0 ? "workflow_started" : "node_discovered",
      payload_jsonb: {
        nodeId: node.id,
        parentId: node.parent_id,
        nodeType: node.node_type,
        name: node.name,
        status: node.status,
        source: node.source,
        order: node.order_index,
      },
      actor_type: "system",
      actor_id: "kanna-seed",
    }))

    const { error: eventError } = await this.client
      .from("workflow_events")
      .insert(eventRows)

    if (eventError) throw new Error(eventError.message)
  }

  private async seedProjectRun(projectId: string): Promise<void> {
    const seed = createCurriculumWorkflowSeed(projectId)
    const runId = randomUUID()
    const workflowVersionId = await this.ensureWorkflowDefinition(projectId)

    const { error: runError } = await this.client
      .from("workflow_runs")
      .insert({
        id: runId,
        project_id: projectId,
        workflow_version_id: workflowVersionId,
        workflow_type: seed.projection.workflowType,
        status: seed.projection.status,
        input_jsonb: {
          seededFrom: "curriculum-workflow-markdown",
          title: seed.projection.title,
        },
      })

    if (runError) throw new Error(runError.message)

    await this.insertSeedNodesArtifactsAndDiscoveryEvents(projectId, runId, seed)
  }
}

export function createDefaultWorkflowRuntimeStore(): WorkflowRuntimeStore {
  const envFile = readEnvFile()
  const supabaseUrl = getEnvValue("SUPABASE_URL", envFile)
  const serviceRoleKey = getEnvValue("SUPABASE_SERVICE_ROLE_KEY", envFile) || getEnvValue("SUPABASE_SECRET_KEY", envFile)

  if (!supabaseUrl || !serviceRoleKey) {
    return new InMemoryWorkflowRuntimeStore()
  }

  return new SupabaseWorkflowRuntimeStore(createClient<any>(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }))
}

export function createSeedWorkflowProjection(projectId: string): WorkflowRunProjection {
  return createCurriculumWorkflowSeed(projectId).projection
}
