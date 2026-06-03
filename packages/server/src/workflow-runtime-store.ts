import { existsSync, readFileSync } from "node:fs"
import { createHash, randomUUID } from "node:crypto"
import path from "node:path"
import { createClient } from "@supabase/supabase-js"
import type { AgentProvider, TranscriptEntry, WorkflowArtifactImpact, WorkflowArtifactRef, WorkflowCheckpoint, WorkflowDefinitionSummary, WorkflowMarketplaceMetadata, WorkflowNode, WorkflowNodeStatus, WorkflowRunProjection, WorkflowPack, ProjectFlowEdge, FlowEdgeProvenance, FlowEdgeStatus, WorkflowLock, WorkflowLockConflict, WorkflowSubAgentJob } from "@kanna/shared/types"
import type { WorkflowManifest, WorkflowNodeDefinition } from "@kanna/shared/workflow-schema"
import { createCurriculumWorkflowSeed, type WorkflowSeedNodeRow } from "./workflow-platform/curriculum-seed"

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
  subscribeToProjectWorkflow?(projectId: string, callback: () => void): () => void
  listDefinitions?(projectId?: string): Promise<WorkflowDefinitionSummary[]>
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
  publishManifest?(args: { projectId?: string; manifest: WorkflowManifest; sourceMarkdown?: string }): Promise<WorkflowDefinitionSummary>
  deleteDefinition?(args: { projectId: string; workflowDefinitionId: string }): Promise<void>
  updateArtifactImpact?(args: {
    projectId: string
    runId?: string
    sourceArtifactId: string
    impactedArtifactId?: string
    status: WorkflowArtifactImpact["status"]
    reason?: string
  }): Promise<WorkflowArtifactImpact[]>
  markArtifact?(args: {
    projectId: string
    artifactId: string
    action: "invalidate" | "accept_source_of_truth"
    reason?: string
  }): Promise<WorkflowArtifactRef[]>
  startRun?(args: { projectId: string; workflowDefinitionId: string; chatId?: string; input?: Record<string, unknown> }): Promise<WorkflowRunProjection>
  appendEvent?(event: Omit<WorkflowEventRecord, "id" | "sequence" | "createdAt">): Promise<WorkflowEventRecord>
  recordTranscriptEntry?(args: {
    projectId: string
    chatId: string
    provider: AgentProvider
    entry: TranscriptEntry
  }): Promise<void>
  registerWorkflow?(args: {
    projectId: string
    workflowDefinitionId: string
    versionId?: string
    isDefaultEntrypoint?: boolean
  }): Promise<void>
  unregisterWorkflow?(args: {
    projectId: string
    workflowDefinitionId: string
  }): Promise<void>
  updateWorkflowRegistration?(args: {
    projectId: string
    workflowDefinitionId: string
    patch: {
      versionId?: string
      enabled?: boolean
      isDefaultEntrypoint?: boolean
      settings?: Record<string, any>
    }
  }): Promise<void>
  listPacks?(): Promise<WorkflowPack[]>
  registerPack?(args: { projectId: string; packId: string }): Promise<void>
  addFlowEdge?(args: { projectId: string; sourceWorkflowDefinitionId: string; targetWorkflowDefinitionId: string; provenance: FlowEdgeProvenance }): Promise<ProjectFlowEdge>
  removeFlowEdge?(args: { projectId: string; sourceWorkflowDefinitionId: string; targetWorkflowDefinitionId: string; provenance: FlowEdgeProvenance }): Promise<void>
  approveFlowEdge?(args: { projectId: string; edgeId: string }): Promise<void>
  rejectFlowEdge?(args: { projectId: string; edgeId: string }): Promise<void>
  recoverLock?(args: { projectId: string; lockId: string }): Promise<void>
  inspectResumePlan?(args: { projectId: string; runId: string }): Promise<any>
  resumeRun?(args: { projectId: string; runId: string }): Promise<WorkflowRunProjection>
  restartRun?(args: { projectId: string; runId: string }): Promise<WorkflowRunProjection>
  archiveRun?(args: { projectId: string; runId: string }): Promise<WorkflowRunProjection>
  spawnParallelJob?(args: { projectId: string; parentRunId: string; workflowDefinitionId: string }): Promise<WorkflowSubAgentJob>
  mergeParallelJob?(args: { projectId: string; jobId: string }): Promise<WorkflowRunProjection>
  discardParallelJob?(args: { projectId: string; jobId: string }): Promise<WorkflowSubAgentJob>
  shareWorkflow?(args: { projectId: string; definitionId: string }): Promise<string>
  importWorkflowById?(args: { projectId: string; shareId: string }): Promise<WorkflowDefinitionSummary>
  publishGlobalRequest?(args: { projectId: string; definitionId: string; metadata: WorkflowMarketplaceMetadata }): Promise<void>
  approveGlobalPublish?(args: { projectId: string; definitionId: string }): Promise<void>
  rejectGlobalPublish?(args: { projectId: string; definitionId: string }): Promise<void>
}

function checkScopeOverlap(scopeA: string, scopeB: string): boolean {
  const [typeA, valA] = scopeA.split(":")
  const [typeB, valB] = scopeB.split(":")
  if (!valA || !valB) return false

  const normalize = (value: string) => value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/, "")
  const pathA = normalize(valA)
  const pathB = normalize(valB)
  const containsPath = (directory: string, filePath: string) => filePath === directory || filePath.startsWith(`${directory}/`)

  if (typeA === "file" && typeB === "file") {
    return pathA === pathB
  }
  if (typeA === "directory" && typeB === "file") {
    return containsPath(pathA, pathB)
  }
  if (typeA === "file" && typeB === "directory") {
    return containsPath(pathB, pathA)
  }
  if (typeA === "directory" && typeB === "directory") {
    return containsPath(pathA, pathB) || containsPath(pathB, pathA)
  }
  if (typeA === "glob" || typeB === "glob") {
    const globValue = typeA === "glob" ? pathA : pathB
    const otherValue = typeA === "glob" ? pathB : pathA
    const prefix = globValue.split("*")[0]?.replace(/\/+$/, "")
    return Boolean(prefix && containsPath(prefix, otherValue)) || globValue === otherValue
  }
  return false
}

function inferArtifactFlowEdges(
  definitions: WorkflowDefinitionSummary[],
  manifests: Map<string, WorkflowManifest>
): ProjectFlowEdge[] {
  const edges: ProjectFlowEdge[] = []
  const producers = new Map<string, string[]>()
  const consumers = new Map<string, string[]>()
  
  for (const def of definitions) {
    const manifest = manifests.get(def.id) || (def as any).manifest
    if (!manifest) continue
    
    const outputs: string[] = []
    if (manifest.outputs) {
      for (const out of manifest.outputs) {
        if (out.path) outputs.push(out.path.toLowerCase())
      }
    }
    if (manifest.artifacts) {
      for (const art of manifest.artifacts) {
        if (art.id) outputs.push(art.id.toLowerCase())
        if (art.kind) outputs.push(art.kind.toLowerCase())
        if (art.pattern) outputs.push(art.pattern.toLowerCase())
      }
    }
    
    for (const out of outputs) {
      const list = producers.get(out) || []
      if (!list.includes(def.id)) {
        list.push(def.id)
        producers.set(out, list)
      }
    }
    
    const inputs: string[] = []
    if (manifest.inputs) {
      for (const inp of manifest.inputs) {
        if (inp.path) inputs.push(inp.path.toLowerCase())
      }
    }
    if (manifest.nodes) {
      const traverseNodes = (nodes: any[]) => {
        for (const n of nodes) {
          if (n.consumes) {
            for (const c of n.consumes) inputs.push(c.toLowerCase())
          }
          if (n.children) traverseNodes(n.children)
        }
      }
      traverseNodes(manifest.nodes)
    }
    
    for (const inp of inputs) {
      const list = consumers.get(inp) || []
      if (!list.includes(def.id)) {
        list.push(def.id)
        consumers.set(inp, list)
      }
    }
  }
  
  for (const [item, prodIds] of producers.entries()) {
    const consIds = consumers.get(item)
    if (!consIds) continue
    
    for (const prodId of prodIds) {
      for (const consId of consIds) {
        if (prodId === consId) continue
        
        const exists = edges.some(e => e.sourceWorkflowDefinitionId === prodId && e.targetWorkflowDefinitionId === consId)
        if (!exists) {
          edges.push({
            id: `inferred_${prodId}_to_${consId}`,
            projectId: "",
            sourceWorkflowDefinitionId: prodId,
            targetWorkflowDefinitionId: consId,
            provenance: "artifact_io_inferred",
            status: "approved"
          })
        }
      }
    }
  }
  
  return edges
}

function resolveFlowEdges(
  projectId: string,
  inferredEdges: ProjectFlowEdge[],
  storedEdges: ProjectFlowEdge[]
): ProjectFlowEdge[] {
  const allCandidates = [...inferredEdges, ...storedEdges]
  const grouped = new Map<string, ProjectFlowEdge[]>()
  
  for (const edge of allCandidates) {
    const key = `${edge.sourceWorkflowDefinitionId}->${edge.targetWorkflowDefinitionId}`
    const list = grouped.get(key) || []
    list.push(edge)
    grouped.set(key, list)
  }
  
  const resolved: ProjectFlowEdge[] = []
  const provenanceRank: Record<FlowEdgeProvenance, number> = {
    explicit_user: 4,
    explicit_pack: 3,
    artifact_io_inferred: 2,
    ai_suggested: 1
  }
  
  for (const [key, candidates] of grouped.entries()) {
    candidates.sort((a, b) => provenanceRank[b.provenance] - provenanceRank[a.provenance])
    const canonical = candidates[0]
    
    if (canonical.provenance === "explicit_user" && canonical.status === "rejected") {
      continue
    }
    
    const reverseKey = `${canonical.targetWorkflowDefinitionId}->${canonical.sourceWorkflowDefinitionId}`
    const reverseCandidates = grouped.get(reverseKey) || []
    const hasReverseInferred = reverseCandidates.some(c => c.provenance === "artifact_io_inferred")
    const isExplicit = canonical.provenance === "explicit_user" || canonical.provenance === "explicit_pack"
    
    let conflicted = false
    let conflictReason = ""
    
    if (isExplicit && hasReverseInferred) {
      conflicted = true
      conflictReason = "Explicit edge conflicts with reverse inferred artifact IO dependency."
    }
    
    resolved.push({
      ...canonical,
      projectId,
      conflicted,
      conflictReason: conflicted ? conflictReason : undefined
    })
  }
  
  return resolved
}

export class InMemoryWorkflowRuntimeStore implements WorkflowRuntimeStore {
  private readonly projectionsByProjectId = new Map<string, WorkflowRunProjection>()
  private readonly runsById = new Map<string, WorkflowRunProjection>()
  private readonly eventsByRunId = new Map<string, WorkflowEventRecord[]>()
  private readonly definitionsById = new Map<string, WorkflowDefinitionSummary & { manifest?: WorkflowManifest }>()
  private readonly registrationsByProjectId = new Map<string, Map<string, {
    workflowVersionId?: string
    enabled: boolean
    isDefaultEntrypoint: boolean
    settings?: Record<string, any>
    packId?: string
  }>>()
  private readonly packs = new Map<string, WorkflowPack>()
  private readonly projectEdges = new Map<string, Map<string, ProjectFlowEdge>>()
  private readonly locksByProjectId = new Map<string, WorkflowLock[]>()

  private seedIfNeeded() {
    if (this.definitionsById.size > 0) return

    // 1. Seed workflows
    const seed = createCurriculumWorkflowSeed("catalog")
    this.definitionsById.set(seed.slug, {
      id: seed.slug,
      slug: seed.slug,
      name: seed.name,
      description: seed.description,
      currentVersion: seed.version,
      currentVersionId: seed.version,
      workflowType: "create-course",
      manifest: seed.manifest as any,
    })

    const w1Manifest: WorkflowManifest = {
      version: "1.0.0",
      name: "Analysis Workflow",
      description: "Analyzes learner profiles and project briefs",
      entrypoint: true,
      artifacts: [
        { id: "learner_profile", name: "Learner Profile", pattern: "LEARNER_PROFILE.md" },
        { id: "project_brief", name: "Project Brief", pattern: "PROJECT_BRIEF.md" }
      ],
      inputs: [],
      outputs: [
        { path: "LEARNER_PROFILE.md", type: "file" },
        { path: "PROJECT_BRIEF.md", type: "file" }
      ]
    }
    this.definitionsById.set("curriculum-analysis", {
      id: "curriculum-analysis",
      slug: "curriculum-analysis",
      name: w1Manifest.name,
      description: w1Manifest.description,
      currentVersion: w1Manifest.version,
      currentVersionId: w1Manifest.version,
      workflowType: "analysis",
      manifest: w1Manifest
    })

    const w2Manifest: WorkflowManifest = {
      version: "1.0.0",
      name: "Design Workflow",
      description: "Creates the curriculum framework from profile and brief",
      artifacts: [
        { id: "curriculum_framework", name: "Curriculum Framework", pattern: "CURRICULUM_FRAMEWORK.md" }
      ],
      inputs: [
        { path: "LEARNER_PROFILE.md", type: "file" },
        { path: "PROJECT_BRIEF.md", type: "file" }
      ],
      outputs: [
        { path: "CURRICULUM_FRAMEWORK.md", type: "file" }
      ]
    }
    this.definitionsById.set("curriculum-design", {
      id: "curriculum-design",
      slug: "curriculum-design",
      name: w2Manifest.name,
      description: w2Manifest.description,
      currentVersion: w2Manifest.version,
      currentVersionId: w2Manifest.version,
      workflowType: "design",
      manifest: w2Manifest
    })

    const w3Manifest: WorkflowManifest = {
      version: "1.0.0",
      name: "Lesson Production Workflow",
      description: "Generates lessons, quizzes, and slides",
      artifacts: [
        { id: "lesson", name: "Lesson", pattern: "LESSON_U01_L01.md" }
      ],
      inputs: [
        { path: "CURRICULUM_FRAMEWORK.md", type: "file" }
      ],
      outputs: [
        { path: "units/U01/lessons/L01/LESSON_U01_L01.md", type: "file" }
      ]
    }
    this.definitionsById.set("lesson-production", {
      id: "lesson-production",
      slug: "lesson-production",
      name: w3Manifest.name,
      description: w3Manifest.description,
      currentVersion: w3Manifest.version,
      currentVersionId: w3Manifest.version,
      workflowType: "production",
      manifest: w3Manifest
    })

    // 2. Seed packs
    const pack: WorkflowPack = {
      id: "curriculum-pack-uuid",
      slug: "curriculum-pack",
      name: "Curriculum Pack",
      description: "Core curriculum development workflows (Analysis -> Design -> Production)",
      workflowDefinitions: [
        { workflowDefinitionId: "curriculum-analysis", versionId: "1.0.0", isDefaultEntrypoint: true },
        { workflowDefinitionId: "curriculum-design", versionId: "1.0.0" },
        { workflowDefinitionId: "lesson-production", versionId: "1.0.0" }
      ]
    }
    this.packs.set(pack.slug, pack)
    this.packs.set(pack.id, pack)
  }

  private computeLocksAndConflicts(projectId: string): { locks: WorkflowLock[]; lockConflicts: WorkflowLockConflict[] } {
    const locks: WorkflowLock[] = this.locksByProjectId.get(projectId) ?? []
    const lockConflicts: WorkflowLockConflict[] = []

    // 1. Update run statuses/locks
    const activeProjection = this.projectionsByProjectId.get(projectId)
    if (activeProjection) {
      const runStatus = activeProjection.status
      for (const lock of locks) {
        if (lock.workflowId === activeProjection.id) {
          if (runStatus === "failed") {
            lock.status = "recoverable"
          } else if (runStatus === "running") {
            lock.status = "active"
          }
        }
      }
    }

    // 2. Sibling output conflicts
    const registrations = this.registrationsByProjectId.get(projectId) ?? new Map()
    const registeredWorkflows = Array.from(registrations.keys())

    const outputsByWorkflow = new Map<string, Array<{ path: string; type: string; ownershipClass: string }>>()
    for (const defId of registeredWorkflows) {
      const definition = this.definitionsById.get(defId)
      if (definition?.manifest?.outputs) {
        const outputs = definition.manifest.outputs.map((out: any) => ({
          path: out.path,
          type: out.type,
          ownershipClass: out.ownershipClass ?? "canonical"
        }))
        outputsByWorkflow.set(defId, outputs)
      }
    }

    const workflowIds = Array.from(outputsByWorkflow.keys())
    for (let i = 0; i < workflowIds.length; i++) {
      for (let j = i + 1; j < workflowIds.length; j++) {
        const wIdA = workflowIds[i]
        const wIdB = workflowIds[j]
        const outsA = outputsByWorkflow.get(wIdA) ?? []
        const outsB = outputsByWorkflow.get(wIdB) ?? []

        for (const outA of outsA) {
          for (const outB of outsB) {
            const scopeA = `${outA.type}:${outA.path}`
            const scopeB = `${outB.type}:${outB.path}`
            if (checkScopeOverlap(scopeA, scopeB)) {
              if (outA.ownershipClass === "shared" && outB.ownershipClass === "shared") {
                continue
              }
              lockConflicts.push({
                id: `conflict-${wIdA}-${wIdB}-${outA.path}`,
                scope: scopeA,
                blockingWorkflowId: wIdA,
                requestingWorkflowId: wIdB,
                type: outA.path === outB.path && (outA.ownershipClass === "canonical" || outB.ownershipClass === "canonical") ? "ownership" : "scope_overlap",
                artifactPath: outA.path
              })
            }
          }
        }
      }
    }

    // 3. Overlapping active locks vs requesting sibling outputs
    for (const lock of locks) {
      if (lock.status === "active") {
        for (const [wId, outs] of outputsByWorkflow.entries()) {
          if (lock.workflowId !== wId) {
            for (const out of outs) {
              const scopeB = `${out.type}:${out.path}`
              if (checkScopeOverlap(lock.scope, scopeB)) {
                if (out.ownershipClass !== "shared") {
                  lockConflicts.push({
                    id: `conflict-active-${lock.id}-${wId}`,
                    scope: lock.scope,
                    blockingWorkflowId: lock.workflowId,
                    requestingWorkflowId: wId,
                    type: "scope_overlap",
                    artifactPath: out.path
                  })
                }
              }
            }
          }
        }
      }
    }

    return { locks, lockConflicts }
  }

  async getProjectProjection(projectId: string): Promise<WorkflowRunProjection | null> {
    this.seedIfNeeded()
    
    // We should compute the flow graph from registered workflows and edges
    const definitions = await this.listDefinitions(projectId)
    const registeredSummaries = definitions.filter((definition) => definition.isRegistered && definition.isEnabled)
    const manifests = new Map<string, WorkflowManifest>()
    for (const summary of registeredSummaries) {
      const def = this.definitionsById.get(summary.id)
      if (def?.manifest) {
        manifests.set(summary.id, def.manifest)
      }
    }
    
    const inferredEdges = inferArtifactFlowEdges(registeredSummaries, manifests)
    const storedEdgesMap = this.projectEdges.get(projectId)
    const storedEdges = storedEdgesMap ? Array.from(storedEdgesMap.values()) : []
    const resolvedEdges = resolveFlowEdges(projectId, inferredEdges, storedEdges)
    
    const packsList = await this.listPacks()
    
    const flowGraph = {
      nodes: registeredSummaries,
      edges: resolvedEdges,
      packs: packsList
    }

    const { locks, lockConflicts } = this.computeLocksAndConflicts(projectId)

    const existing = this.projectionsByProjectId.get(projectId)
    if (existing) {
      if (existing.status === "done") {
        const activeLocks = (this.locksByProjectId.get(projectId) ?? []).filter(
          (l) => l.workflowId !== existing.id && l.workflowId !== existing.workflowType
        )
        this.locksByProjectId.set(projectId, activeLocks)
      }
      return {
        ...existing,
        flowGraph,
        locks: this.locksByProjectId.get(projectId) ?? [],
        lockConflicts
      }
    }

    // Return a stub projection so the client always has access to the flow graph even if no runs have started
    return {
      id: `project_workflow_stub_${projectId}`,
      projectId,
      workflowType: "project_overview",
      title: "Project Workflows",
      status: "horizon",
      root: {
        id: "root",
        name: "Project Root",
        nodeType: "workflow",
        status: "horizon",
        source: "imported",
        order: 0,
        children: []
      },
      latestArtifacts: [],
      impacts: [],
      flowGraph,
      locks,
      lockConflicts
    }
  }

  subscribeToProjectWorkflow(projectId: string, callback: () => void): () => void {
    return () => {}
  }

  async listRuns(projectId: string): Promise<Array<{
    id: string
    projectId: string
    workflowType: string
    status: WorkflowRunProjection["status"]
    startedAt?: string
  }>> {
    const projection = await this.getProjectProjection(projectId)
    if (!projection) return []
    return [cleanOptional({
      id: projection.id,
      projectId,
      workflowType: projection.workflowType,
      status: projection.status,
      startedAt: projection.startedAt,
    })]
  }

  async listDefinitions(projectId?: string): Promise<WorkflowDefinitionSummary[]> {
    this.seedIfNeeded()
    const registrations = projectId ? this.registrationsByProjectId.get(projectId) : undefined
    return [...this.definitionsById.values()]
      .filter((def) => {
        if (!projectId) return true
        if (!def.ownerId) return true
        if (def.ownerId === projectId) return true
        if (def.isOfficialGlobal) return true
        if (registrations?.has(def.id)) return true
        return false
      })
      .map(({ manifest: _manifest, ...definition }) => {
        const registration = registrations?.get(definition.id)
        return {
          ...definition,
          isRegistered: Boolean(registration),
          pinnedVersionId: registration?.workflowVersionId,
          isEnabled: registration?.enabled ?? false,
          isDefaultEntrypoint: registration?.isDefaultEntrypoint ?? false,
          readiness: registration?.enabled ? "ready" : undefined,
          settings: registration?.settings,
          manifest: _manifest,
          sourceFiles: _manifest ? workflowManifestSourceFiles(_manifest as any) : undefined,
        }
      })
  }

  async publishManifest(args: { projectId?: string; manifest: WorkflowManifest }): Promise<WorkflowDefinitionSummary> {
    const manifestName = workflowManifestName(args.manifest)
    const slug = slugifyWorkflowName(manifestName)
    const definition = {
      id: slug,
      slug,
      name: manifestName,
      description: args.manifest.description,
      currentVersion: args.manifest.version,
      currentVersionId: args.manifest.version,
      workflowType: manifestName,
      manifest: args.manifest,
      ownerId: args.projectId,
    }
    this.definitionsById.set(slug, definition)
    return definition
  }

  async deleteDefinition(args: { projectId: string; workflowDefinitionId: string }): Promise<void> {
    const definition = this.definitionsById.get(args.workflowDefinitionId)
    if (!definition) {
      throw new Error("Workflow definition not found")
    }
    if (definition.isOfficialGlobal || (definition.ownerId && definition.ownerId !== args.projectId)) {
      throw new Error("Only project or custom workflows can be deleted.")
    }

    this.definitionsById.delete(args.workflowDefinitionId)
    for (const registrations of this.registrationsByProjectId.values()) {
      registrations.delete(args.workflowDefinitionId)
    }
    for (const projectEdges of this.projectEdges.values()) {
      for (const [key, edge] of projectEdges.entries()) {
        if (
          edge.sourceWorkflowDefinitionId === args.workflowDefinitionId ||
          edge.targetWorkflowDefinitionId === args.workflowDefinitionId
        ) {
          projectEdges.delete(key)
        }
      }
    }
  }

  async startRun(args: { projectId: string; workflowDefinitionId: string; chatId?: string; input?: Record<string, unknown> }): Promise<WorkflowRunProjection> {
    const registration = this.registrationsByProjectId.get(args.projectId)?.get(args.workflowDefinitionId)
    if (!registration || !registration.enabled) {
      throw new Error(`Workflow definition ${args.workflowDefinitionId} is not registered for project ${args.projectId}`)
    }
    const definition = this.definitionsById.get(args.workflowDefinitionId)
    const manifest = definition?.manifest
    const { lockConflicts } = this.computeLocksAndConflicts(args.projectId)
    const blockingConflict = lockConflicts.find(
      (conflict) => conflict.requestingWorkflowId === args.workflowDefinitionId || conflict.blockingWorkflowId === args.workflowDefinitionId
    )
    if (blockingConflict) {
      throw new Error(`Workflow definition ${args.workflowDefinitionId} is blocked by ${blockingConflict.type} conflict on ${blockingConflict.artifactPath ?? blockingConflict.scope}`)
    }
    const projection = manifest
      ? {
          ...createSeedWorkflowProjection(args.projectId),
          id: randomUUID(),
          projectId: args.projectId,
          chatId: args.chatId,
          workflowType: workflowManifestName(manifest, definition?.name),
          title: workflowManifestName(manifest, definition?.name),
          workflowDefinitionId: args.workflowDefinitionId,
          definitionVersion: manifest.version,
          status: "running" as const,
          root: buildNodeTree(buildManifestNodeRows(manifest).map((node) => ({
            id: node.id,
            parent_id: node.parent_id,
            node_type: node.node_type,
            name: node.name,
            status: node.status,
            source: node.source,
            order_index: node.order_index,
            agent: node.agent ?? null,
            agent_run_id: null,
            spawned_by_node_id: null,
            tokens: node.tokens ?? null,
            duration_ms: node.duration_ms ?? null,
            condition: node.condition ?? null,
            sealed: node.sealed ?? null,
            children_sealed: node.children_sealed ?? null,
            log_summary: node.log_summary ?? null,
          })), createSeedWorkflowProjection(args.projectId).root),
          latestArtifacts: buildManifestArtifacts(args.projectId, manifest),
          impacts: [],
        }
      : createSeedWorkflowProjection(args.projectId)

    // Acquire output locks
    const locks = this.locksByProjectId.get(args.projectId) ?? []
    if (manifest?.outputs) {
      for (const out of manifest.outputs) {
        locks.push({
          id: randomUUID(),
          scope: `${out.type}:${out.path}`,
          workflowId: projection.id,
          status: "active",
          acquiredAt: new Date().toISOString()
        })
      }
    }
    this.locksByProjectId.set(args.projectId, locks)

    this.projectionsByProjectId.set(args.projectId, projection)
    this.runsById.set(projection.id, projection)
    return projection
  }

  async updateArtifactImpact(): Promise<WorkflowArtifactImpact[]> {
    return []
  }

  async markArtifact(args: { projectId: string; artifactId: string; action: "invalidate" | "accept_source_of_truth" }): Promise<WorkflowArtifactRef[]> {
    const projection = await this.getProjectProjection(args.projectId)
    if (!projection) return []
    const changed = args.action === "invalidate"
    const latestArtifacts = projection.latestArtifacts ?? []
    projection.latestArtifacts = latestArtifacts.map((artifact) => artifact.id === args.artifactId
      ? { ...artifact, changed }
      : artifact)
    this.projectionsByProjectId.set(args.projectId, projection)
    return projection.latestArtifacts
  }

  async recoverLock(args: { projectId: string; lockId: string }): Promise<void> {
    const locks = this.locksByProjectId.get(args.projectId) ?? []
    const updated = locks.filter((l) => l.id !== args.lockId)
    this.locksByProjectId.set(args.projectId, updated)
  }

  async registerWorkflow(args: {
    projectId: string
    workflowDefinitionId: string
    versionId?: string
    isDefaultEntrypoint?: boolean
  }): Promise<void> {
    const registrations = this.registrationsByProjectId.get(args.projectId) ?? new Map()
    if (args.isDefaultEntrypoint) {
      for (const [definitionId, registration] of registrations.entries()) {
        registrations.set(definitionId, { ...registration, isDefaultEntrypoint: false })
      }
    }
    registrations.set(args.workflowDefinitionId, {
      workflowVersionId: args.versionId,
      enabled: true,
      isDefaultEntrypoint: Boolean(args.isDefaultEntrypoint),
    })
    this.registrationsByProjectId.set(args.projectId, registrations)
  }

  async unregisterWorkflow(args: {
    projectId: string
    workflowDefinitionId: string
  }): Promise<void> {
    this.registrationsByProjectId.get(args.projectId)?.delete(args.workflowDefinitionId)
  }

  async updateWorkflowRegistration(args: {
    projectId: string
    workflowDefinitionId: string
    patch: {
      versionId?: string
      enabled?: boolean
      isDefaultEntrypoint?: boolean
      settings?: Record<string, any>
    }
  }): Promise<void> {
    const registrations = this.registrationsByProjectId.get(args.projectId) ?? new Map()
    const existing = registrations.get(args.workflowDefinitionId)
    if (!existing) return
    if (args.patch.isDefaultEntrypoint) {
      for (const [definitionId, registration] of registrations.entries()) {
        registrations.set(definitionId, { ...registration, isDefaultEntrypoint: false })
      }
    }
    registrations.set(args.workflowDefinitionId, {
      workflowVersionId: args.patch.versionId ?? existing.workflowVersionId,
      enabled: args.patch.enabled ?? existing.enabled,
      isDefaultEntrypoint: args.patch.isDefaultEntrypoint ?? existing.isDefaultEntrypoint,
      settings: args.patch.settings ?? existing.settings,
    })
    this.registrationsByProjectId.set(args.projectId, registrations)
  }

  async listPacks(): Promise<WorkflowPack[]> {
    this.seedIfNeeded()
    return Array.from(new Set(this.packs.values()))
  }

  async registerPack(args: { projectId: string; packId: string }): Promise<void> {
    this.seedIfNeeded()
    const pack = this.packs.get(args.packId)
    if (!pack) throw new Error(`Workflow pack not found: ${args.packId}`)
    
    if (pack.workflowDefinitions) {
      for (const wdef of pack.workflowDefinitions) {
        await this.registerWorkflow({
          projectId: args.projectId,
          workflowDefinitionId: wdef.workflowDefinitionId,
          versionId: wdef.versionId,
          isDefaultEntrypoint: wdef.isDefaultEntrypoint
        })
        const reg = this.registrationsByProjectId.get(args.projectId)?.get(wdef.workflowDefinitionId)
        if (reg) {
          reg.packId = pack.id
        }
      }
    }
  }

  async addFlowEdge(args: {
    projectId: string
    sourceWorkflowDefinitionId: string
    targetWorkflowDefinitionId: string
    provenance: FlowEdgeProvenance
  }): Promise<ProjectFlowEdge> {
    this.seedIfNeeded()
    let projectEdgesMap = this.projectEdges.get(args.projectId)
    if (!projectEdgesMap) {
      projectEdgesMap = new Map()
      this.projectEdges.set(args.projectId, projectEdgesMap)
    }
    const key = `${args.sourceWorkflowDefinitionId}->${args.targetWorkflowDefinitionId}`
    const edge: ProjectFlowEdge = {
      id: `${args.projectId}_edge_${randomUUID()}`,
      projectId: args.projectId,
      sourceWorkflowDefinitionId: args.sourceWorkflowDefinitionId,
      targetWorkflowDefinitionId: args.targetWorkflowDefinitionId,
      provenance: args.provenance,
      status: args.provenance === "ai_suggested" ? "pending_approval" : "approved"
    }
    projectEdgesMap.set(key, edge)
    return edge
  }

  async removeFlowEdge(args: {
    projectId: string
    sourceWorkflowDefinitionId: string
    targetWorkflowDefinitionId: string
    provenance: FlowEdgeProvenance
  }): Promise<void> {
    this.seedIfNeeded()
    const projectEdgesMap = this.projectEdges.get(args.projectId)
    if (!projectEdgesMap) return
    const key = `${args.sourceWorkflowDefinitionId}->${args.targetWorkflowDefinitionId}`
    const existing = projectEdgesMap.get(key)
    if (existing) {
      if (existing.provenance === "artifact_io_inferred" || existing.provenance === "explicit_pack") {
        projectEdgesMap.set(key, {
          ...existing,
          provenance: "explicit_user",
          status: "rejected"
        })
      } else {
        projectEdgesMap.delete(key)
      }
    } else {
      projectEdgesMap.set(key, {
        id: `${args.projectId}_edge_${randomUUID()}`,
        projectId: args.projectId,
        sourceWorkflowDefinitionId: args.sourceWorkflowDefinitionId,
        targetWorkflowDefinitionId: args.targetWorkflowDefinitionId,
        provenance: "explicit_user",
        status: "rejected"
      })
    }
  }

  async approveFlowEdge(args: { projectId: string; edgeId: string }): Promise<void> {
    this.seedIfNeeded()
    const projectEdgesMap = this.projectEdges.get(args.projectId)
    if (!projectEdgesMap) return
    for (const [key, edge] of projectEdgesMap.entries()) {
      if (edge.id === args.edgeId) {
        projectEdgesMap.set(key, {
          ...edge,
          status: "approved"
        })
        return
      }
    }
  }

  async rejectFlowEdge(args: { projectId: string; edgeId: string }): Promise<void> {
    this.seedIfNeeded()
    const projectEdgesMap = this.projectEdges.get(args.projectId)
    if (!projectEdgesMap) return
    for (const [key, edge] of projectEdgesMap.entries()) {
      if (edge.id === args.edgeId) {
        projectEdgesMap.set(key, {
          ...edge,
          status: "rejected"
        })
        return
      }
    }
  }

  async appendEvent(event: Omit<WorkflowEventRecord, "id" | "sequence" | "createdAt">): Promise<WorkflowEventRecord> {
    const list = this.eventsByRunId.get(event.runId) ?? []
    const newEvent: WorkflowEventRecord = {
      id: randomUUID(),
      sequence: list.length + 1,
      createdAt: new Date().toISOString(),
      ...event,
    }
    list.push(newEvent)
    this.eventsByRunId.set(event.runId, list)
    return newEvent
  }

  async listEvents(runId: string, limit?: number): Promise<WorkflowEventRecord[]> {
    const events = this.eventsByRunId.get(runId) ?? []
    return limit ? events.slice(0, limit) : events
  }

  async recordTranscriptEntry(args: {
    projectId: string
    chatId: string
    provider: AgentProvider
    entry: TranscriptEntry
  }): Promise<void> {
    const projection = this.projectionsByProjectId.get(args.projectId)
    if (!projection) return

    const payload = workflowPayloadFromTranscriptEntry(args)
    if (!payload) return

    await this.appendEvent({
      runId: projection.id,
      type: payload.eventType,
      payload: payload.payload,
      actorType: payload.actorType,
      actorId: payload.actorId,
    })

    if (args.entry.kind === "system_init") {
      projection.root = ensureRuntimeActivityNode(projection.root, {
        chatId: args.chatId,
        provider: args.provider,
        status: "running",
        logSummary: `Pi bridge smoke flow is observing ${args.provider} runtime activity.`,
      })
      this.projectionsByProjectId.set(args.projectId, projection)
      this.runsById.set(projection.id, projection)
      return
    }

    if (args.entry.kind === "tool_call") {
      projection.root = ensureRuntimeActivityNode(projection.root, {
        chatId: args.chatId,
        provider: args.provider,
        status: "running",
      })
      projection.root = upsertRuntimeToolNode(projection.root, {
        toolId: args.entry.tool.toolId,
        provider: args.provider,
        chatId: args.chatId,
        name: payload.nodeName,
        status: "running",
        logSummary: payload.nodeSummary,
      })

      const artifact = artifactFromTranscriptToolCall(args.entry.tool.toolKind, args.entry.tool.input)
      if (artifact && artifact.action !== "read") {
        projection.latestArtifacts = upsertProjectionArtifact({
          projectId: args.projectId,
          artifacts: projection.latestArtifacts ?? [],
          toolId: args.entry.tool.toolId,
          artifact,
        })
      }
    }

    if (args.entry.kind === "tool_result") {
      projection.root = upsertRuntimeToolNode(projection.root, {
        toolId: args.entry.toolId,
        provider: args.provider,
        chatId: args.chatId,
        name: "Tool result",
        status: args.entry.isError ? "failed" : "done",
        logSummary: args.entry.isError ? "Tool result returned an error." : "Tool completed.",
      })
    }

    if (args.entry.kind === "result") {
      projection.root = ensureRuntimeActivityNode(projection.root, {
        chatId: args.chatId,
        provider: args.provider,
        status: args.entry.isError ? "failed" : "done",
        durationMs: args.entry.durationMs,
        logSummary: args.entry.isError ? args.entry.result.slice(0, 240) : "Agent turn finished.",
      })
      projection.status = args.entry.isError ? "failed" : "running"
    }

    this.projectionsByProjectId.set(args.projectId, projection)
    this.runsById.set(projection.id, projection)
  }

  async inspectResumePlan(args: { projectId: string; runId: string }): Promise<any> {
    const run = this.runsById.get(args.runId)
    if (!run) throw new Error("Workflow run not found")

    let lastCompletedNodeId: string | undefined
    let activeInterruptedNodeId: string | undefined

    const traverse = (node: WorkflowNode) => {
      if (node.status === "done") {
        lastCompletedNodeId = node.id
      }
      if (
        node.status === "running" ||
        node.status === "failed" ||
        node.status === "waiting" ||
        node.status === "interrupted"
      ) {
        activeInterruptedNodeId = node.id
      }
      if (node.children) {
        for (const child of node.children) {
          traverse(child)
        }
      }
    }
    traverse(run.root)

    const staleArtifacts: string[] = []
    const reasons: string[] = []
    const warnings: string[] = []
    let blocked = false
    let recommendedAction: "resume" | "restart" | "archive" | "review_impacts" | "recover_locks" = "resume"

    const checkpoint = run.checkpoint || (activeInterruptedNodeId ? this.findNodeCheckpoint(run.root, activeInterruptedNodeId) : undefined)
    if (checkpoint) {
      if (checkpoint.inputs) {
        for (const inp of checkpoint.inputs) {
          const current = run.latestArtifacts?.find((a) => a.path === inp.path)
          if (current) {
            if (current.changed || current.checksum !== inp.checksum || current.version !== inp.version) {
              staleArtifacts.push(inp.path)
              blocked = true
              if (!reasons.includes("Input artifacts changed since checkpoint.")) {
                reasons.push("Input artifacts changed since checkpoint.")
              }
              recommendedAction = "review_impacts"
            }
          }
        }
      }
      if (checkpoint.outputs) {
        for (const out of checkpoint.outputs) {
          const current = run.latestArtifacts?.find((a) => a.path === out.path)
          if (current) {
            if (current.changed || current.checksum !== out.checksum || current.version !== out.version) {
              blocked = true
              if (!reasons.includes("Output artifacts edited manually.")) {
                reasons.push("Output artifacts edited manually.")
              }
              recommendedAction = "review_impacts"
            }
          }
        }
      }
    }

    const locks = this.locksByProjectId.get(args.projectId) ?? []
    const heldLocks = locks.filter((l) => l.workflowId !== args.runId).map((l) => l.scope)
    const hasConflicts = (run.lockConflicts && run.lockConflicts.length > 0) || heldLocks.length > 0
    if (hasConflicts) {
      blocked = true
      reasons.push("Locks are still held by another run/node.")
      recommendedAction = "recover_locks"
    }

    if (run.workflowDefinitionId) {
      const reg = this.registrationsByProjectId.get(args.projectId)?.get(run.workflowDefinitionId)
      if (reg && reg.workflowVersionId !== run.definitionVersion) {
        warnings.push("The run version no longer matches the project registered version.")
      }
    }

    return {
      lastCompletedNodeId,
      activeInterruptedNodeId,
      staleArtifacts,
      heldLocks,
      recommendedAction,
      blocked,
      reasons,
      warnings,
    }
  }

  private findNodeCheckpoint(node: WorkflowNode, targetId: string): WorkflowCheckpoint | undefined {
    if (node.id === targetId) return node.checkpoint
    if (node.children) {
      for (const child of node.children) {
        const found = this.findNodeCheckpoint(child, targetId)
        if (found) return found
      }
    }
    return undefined
  }

  async resumeRun(args: { projectId: string; runId: string }): Promise<WorkflowRunProjection> {
    const run = this.runsById.get(args.runId)
    if (!run) throw new Error("Workflow run not found")

    run.status = "running"
    const plan = await this.inspectResumePlan({ projectId: args.projectId, runId: args.runId })
    if (plan.activeInterruptedNodeId) {
      this.updateNodeStatus(run.root, plan.activeInterruptedNodeId, "running")
    }

    await this.appendEvent({
      runId: run.id,
      type: "workflow_resumed" as any,
      actorType: "user",
      payload: {
        projectId: args.projectId,
        nodeId: plan.activeInterruptedNodeId,
      },
    })

    this.projectionsByProjectId.set(args.projectId, run)
    return run
  }

  private updateNodeStatus(node: WorkflowNode, targetId: string, status: WorkflowNodeStatus): boolean {
    if (node.id === targetId) {
      node.status = status
      return true
    }
    if (node.children) {
      for (const child of node.children) {
        if (this.updateNodeStatus(child, targetId, status)) {
          return true
        }
      }
    }
    return false
  }

  async archiveRun(args: { projectId: string; runId: string }): Promise<WorkflowRunProjection> {
    const run = this.runsById.get(args.runId)
    if (!run) throw new Error("Workflow run not found")

    run.status = "archived"
    
    // Release locks
    const locks = this.locksByProjectId.get(args.projectId) ?? []
    const remaining = locks.filter((l) => l.workflowId !== args.runId)
    this.locksByProjectId.set(args.projectId, remaining)

    await this.appendEvent({
      runId: run.id,
      type: "workflow_archived" as any,
      actorType: "user",
      payload: {
        projectId: args.projectId,
      },
    })

    const active = this.projectionsByProjectId.get(args.projectId)
    if (active && active.id === args.runId) {
      this.projectionsByProjectId.delete(args.projectId)
    }

    return run
  }

  async restartRun(args: { projectId: string; runId: string }): Promise<WorkflowRunProjection> {
    const oldRun = this.runsById.get(args.runId)
    if (!oldRun) throw new Error("Workflow run not found")

    await this.archiveRun({ projectId: args.projectId, runId: args.runId })

    if (!oldRun.workflowDefinitionId) {
      throw new Error("Original workflow definition ID not found on run")
    }

    const newRun = await this.startRun({
      projectId: args.projectId,
      workflowDefinitionId: oldRun.workflowDefinitionId,
      chatId: oldRun.chatId,
    })

    return newRun
  }

  async spawnParallelJob(args: { projectId: string; parentRunId: string; workflowDefinitionId: string }): Promise<WorkflowSubAgentJob> {
    const parentRun = this.runsById.get(args.parentRunId)
    if (!parentRun) throw new Error("Parent run not found")

    const definitions = await this.listDefinitions(args.projectId)
    const definition = definitions.find((d) => d.id === args.workflowDefinitionId)
    const versionId = definition?.currentVersionId ?? "1.0.0"

    const jobId = `job-${Math.random().toString(36).substring(2, 9)}`
    const branchName = `subagent-${args.workflowDefinitionId}-${jobId}`
    const worktreePath = `worktrees/subagent-${args.workflowDefinitionId}-${jobId}`

    const job: WorkflowSubAgentJob = {
      id: jobId,
      projectId: args.projectId,
      parentRunId: args.parentRunId,
      workflowDefinitionId: args.workflowDefinitionId,
      versionId,
      status: "running",
      worktreePath,
      branchName,
      producedArtifacts: [],
      startedAt: new Date().toISOString(),
    }

    if (!parentRun.jobs) {
      parentRun.jobs = []
    }
    parentRun.jobs.push(job)

    await this.appendEvent({
      runId: parentRun.id,
      type: "subagent_job_spawned" as any,
      actorType: "user",
      payload: {
        jobId,
        workflowDefinitionId: args.workflowDefinitionId,
        branchName,
      },
    })

    return job
  }

  async mergeParallelJob(args: { projectId: string; jobId: string }): Promise<WorkflowRunProjection> {
    let targetJob: WorkflowSubAgentJob | undefined
    let parentRun: WorkflowRunProjection | undefined

    for (const run of this.runsById.values()) {
      if (run.jobs) {
        const found = run.jobs.find((j) => j.id === args.jobId)
        if (found) {
          targetJob = found
          parentRun = run
          break
        }
      }
    }

    if (!targetJob || !parentRun) {
      throw new Error("Job not found")
    }

    let stale = false
    const reasons: string[] = []

    const locks = this.locksByProjectId.get(args.projectId) ?? []
    let hasLockConflict = false

    for (const artifact of targetJob.producedArtifacts) {
      const artifactScope = `file:${artifact.path}`
      const conflictingLock = locks.find(
        (l) => l.workflowId !== parentRun!.id && checkScopeOverlap(l.scope, artifactScope)
      )
      if (conflictingLock) {
        hasLockConflict = true
        reasons.push(`Artifact ownership conflict: ${artifact.path} is locked by run ${conflictingLock.workflowId}`)
      }
    }

    if (targetJob.mergeStatus === "stale_inputs") {
      stale = true
      reasons.push("Input artifacts changed in main workspace since job started.")
    }

    if (hasLockConflict) {
      targetJob.mergeStatus = "conflicts"
      targetJob.reasons = reasons
      throw new Error(`Cannot merge job due to lock conflicts: ${reasons.join("; ")}`)
    }

    if (stale) {
      targetJob.mergeStatus = "stale_inputs"
      targetJob.reasons = reasons
      throw new Error("Cannot merge job due to stale inputs. Please rebase or request repair.")
    }

    targetJob.status = "merged"
    targetJob.mergeStatus = "clean"
    targetJob.completedAt = new Date().toISOString()

    if (!parentRun.latestArtifacts) {
      parentRun.latestArtifacts = []
    }

    for (const artifact of targetJob.producedArtifacts) {
      const updatedArtifact = {
        ...artifact,
        changed: true,
        workflowStatus: "needs_review" as const
      }
      
      const existingIdx = parentRun.latestArtifacts.findIndex((a) => a.path === artifact.path)
      if (existingIdx !== -1) {
        parentRun.latestArtifacts[existingIdx] = updatedArtifact
      } else {
        parentRun.latestArtifacts.push(updatedArtifact)
      }
    }

    await this.appendEvent({
      runId: parentRun.id,
      type: "subagent_job_merged" as any,
      actorType: "user",
      payload: {
        jobId: targetJob.id,
        producedArtifacts: targetJob.producedArtifacts.map((a) => a.path),
      },
    })

    return parentRun
  }

  async discardParallelJob(args: { projectId: string; jobId: string }): Promise<WorkflowSubAgentJob> {
    let targetJob: WorkflowSubAgentJob | undefined
    let parentRun: WorkflowRunProjection | undefined

    for (const run of this.runsById.values()) {
      if (run.jobs) {
        const found = run.jobs.find((j) => j.id === args.jobId)
        if (found) {
          targetJob = found
          parentRun = run
          break
        }
      }
    }

    if (!targetJob || !parentRun) {
      throw new Error("Job not found")
    }

    targetJob.status = "discarded"
    targetJob.completedAt = new Date().toISOString()

    await this.appendEvent({
      runId: parentRun.id,
      type: "subagent_job_discarded" as any,
      actorType: "user",
      payload: {
        jobId: targetJob.id,
      },
    })

    return targetJob
  }

  async shareWorkflow(args: { projectId: string; definitionId: string }): Promise<string> {
    const def = this.definitionsById.get(args.definitionId)
    if (!def) {
      throw new Error("Workflow not found")
    }
    const token = `share-${Math.random().toString(36).substring(2, 11)}`
    def.shareToken = token
    this.definitionsById.set(args.definitionId, def)
    return token
  }

  async importWorkflowById(args: { projectId: string; shareId: string }): Promise<WorkflowDefinitionSummary> {
    let sourceDef: (WorkflowDefinitionSummary & { manifest?: WorkflowManifest }) | undefined
    for (const def of this.definitionsById.values()) {
      if (def.shareToken === args.shareId) {
        sourceDef = def
        break
      }
    }

    if (!sourceDef) {
      throw new Error("Invalid or revoked share ID")
    }

    // Create imported copy
    const importedId = `${sourceDef.id}-imported-${args.projectId}`
    const importedDef = {
      ...sourceDef,
      id: importedId,
      ownerId: args.projectId,
      isOfficialGlobal: false,
      shareToken: undefined,
      importLineage: {
        sourceWorkflowId: sourceDef.id,
        sourceVersionId: sourceDef.currentVersionId || "1.0.0",
        sourceVersion: sourceDef.currentVersion || "1.0.0",
        sourceOwner: sourceDef.ownerId || "external-author",
        importedAt: new Date().toISOString(),
        updateAvailable: false,
      },
    }

    this.definitionsById.set(importedId, importedDef)

    // Register imported workflow for this project automatically
    let projectRegs = this.registrationsByProjectId.get(args.projectId)
    if (!projectRegs) {
      projectRegs = new Map()
      this.registrationsByProjectId.set(args.projectId, projectRegs)
    }
    projectRegs.set(importedId, {
      workflowVersionId: importedDef.currentVersionId || "1.0.0",
      enabled: true,
      isDefaultEntrypoint: false,
    })

    return importedDef
  }

  async publishGlobalRequest(args: { projectId: string; definitionId: string; metadata: WorkflowMarketplaceMetadata }): Promise<void> {
    const def = this.definitionsById.get(args.definitionId)
    if (!def) {
      throw new Error("Workflow not found")
    }
    def.marketplaceMetadata = {
      ...args.metadata,
      publishStatus: "pending",
      publishRequestedAt: new Date().toISOString(),
    }
    this.definitionsById.set(args.definitionId, def)
  }

  async approveGlobalPublish(args: { projectId: string; definitionId: string }): Promise<void> {
    const def = this.definitionsById.get(args.definitionId)
    if (!def) {
      throw new Error("Workflow not found")
    }
    def.isOfficialGlobal = true
    def.marketplaceMetadata = {
      ...def.marketplaceMetadata,
      publishStatus: "approved",
      approvedAt: new Date().toISOString(),
      approvedByUserId: "reviewer-1",
    }
    this.definitionsById.set(args.definitionId, def)
  }

  async rejectGlobalPublish(args: { projectId: string; definitionId: string }): Promise<void> {
    const def = this.definitionsById.get(args.definitionId)
    if (!def) {
      throw new Error("Workflow not found")
    }
    def.marketplaceMetadata = {
      ...def.marketplaceMetadata,
      publishStatus: "rejected",
    }
    this.definitionsById.set(args.definitionId, def)
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
  status: string
  manifest_jsonb: Record<string, unknown> | null
}

interface WorkflowImpactEventRow {
  id: string
  payload_jsonb: Record<string, unknown> | null
  created_at: string | null
}

interface ArtifactImpactRow {
  id: string
  source_artifact_id: string
  impacted_artifact_id: string
  status: WorkflowArtifactImpact["status"]
  relationship: "direct" | "transitive"
  reason: string | null
}

interface RuntimeArtifactRef {
  path: string
  kind: string
  action: "read" | "write" | "edit" | "delete" | "observe"
  contentSnapshot?: string
}

function readEnvFile() {
  let directory = process.cwd()
  let envPath = path.resolve(directory, ".env.local")
  while (!existsSync(envPath)) {
    const parent = path.dirname(directory)
    if (parent === directory) break
    directory = parent
    envPath = path.resolve(directory, ".env.local")
  }
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

function slugifyWorkflowName(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workflow"
}

function workflowManifestName(manifest: WorkflowManifest, fallback = "Workflow") {
  return typeof manifest.name === "string" && manifest.name.trim() ? manifest.name : fallback
}

function workflowManifestArtifacts(manifest: WorkflowManifest) {
  return Array.isArray(manifest.artifacts) ? manifest.artifacts : []
}

function workflowManifestSourceFiles(manifest: Record<string, unknown>, sourceMarkdown?: string | null): string[] {
  const fromManifest = Array.isArray(manifest.sourceFiles)
    ? manifest.sourceFiles.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    : []
  if (fromManifest.length > 0) return [...new Set(fromManifest)]

  const sourceLines = typeof sourceMarkdown === "string"
    ? sourceMarkdown.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
    : []
  const pathLikeLines = sourceLines.filter((line) => {
    if (line.includes("{") || line.includes("---") || /\s/.test(line)) return false
    return /\.(?:md|markdown|json)$/i.test(line)
  })
  return pathLikeLines.length === sourceLines.length ? [...new Set(pathLikeLines)] : []
}

function artifactKindFromManifestId(id: string) {
  return id.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "artifact"
}

function patternToExamplePath(pattern: string, kind: string) {
  const normalized = pattern.trim().replaceAll("\\", "/")
  if (!normalized) return `${kind.toUpperCase()}_*.md`
  return normalized
}

function looksLikeUuid(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))
}

function buildManifestNodeDefinitionRows(
  nodes: WorkflowNodeDefinition[],
  parentId: string | null = null,
  orderOffset = 0
): WorkflowSeedNodeRow[] {
  return nodes.flatMap((node, index) => {
    const row: WorkflowSeedNodeRow = {
      id: node.id,
      parent_id: parentId,
      node_type: node.nodeType,
      name: node.name,
      status: node.status ?? (parentId ? "known" : "running"),
      source: node.source ?? "imported",
      order_index: orderOffset + index,
      agent: node.agent,
      condition: node.condition,
      sealed: false,
      children_sealed: node.children ? false : true,
      log_summary: node.produces?.length ? `Produces: ${node.produces.join(", ")}` : undefined,
    }
    return [row, ...buildManifestNodeDefinitionRows(node.children ?? [], node.id)]
  })
}

function buildManifestNodeRows(manifest: WorkflowManifest): WorkflowSeedNodeRow[] {
  if (manifest.nodes?.length) {
    return buildManifestNodeDefinitionRows(manifest.nodes)
  }

  const manifestName = workflowManifestName(manifest)
  const workflowSlug = slugifyWorkflowName(manifestName)
  const rootId = `wf_${workflowSlug.replaceAll("-", "_")}`
  const rows: WorkflowSeedNodeRow[] = [{
    id: rootId,
    parent_id: null,
    node_type: "workflow",
    name: manifestName,
    status: "running",
    source: "imported",
    order_index: 0,
    children_sealed: true,
    log_summary: manifest.description ?? "Imported workflow manifest.",
  }]

  const artifacts = workflowManifestArtifacts(manifest)
  artifacts.forEach((artifact, index) => {
    const artifactKind = artifactKindFromManifestId(artifact.id)
    rows.push({
      id: `artifact_${artifactKind}`,
      parent_id: rootId,
      node_type: "artifact_check",
      name: `Produce ${artifact.name}`,
      status: index === 0 ? "running" : "known",
      source: "imported",
      order_index: index,
      condition: artifact.dependencies?.length
        ? artifact.dependencies.map((dependency) => `${dependency.relationship}:${dependency.sourcePattern}`).join(", ")
        : undefined,
      sealed: false,
      children_sealed: true,
      log_summary: artifact.description ?? `Tracks ${artifact.pattern}.`,
    })
  })

  if (artifacts.length === 0) {
    rows[0] = { ...rows[0], children_sealed: false, log_summary: "No artifact definitions were extracted yet; horizon remains open." }
  }

  return rows
}

function buildManifestArtifacts(projectId: string, manifest: WorkflowManifest): WorkflowArtifactRef[] {
  const producerByArtifactId = new Map<string, string>()
  const visit = (nodes: WorkflowNodeDefinition[] = []) => {
    for (const node of nodes) {
      for (const artifactId of node.produces ?? []) {
        producerByArtifactId.set(artifactId, node.id)
      }
      visit(node.children)
    }
  }
  visit(manifest.nodes)

  return workflowManifestArtifacts(manifest).map((artifact) => {
    const kind = artifactKindFromManifestId(artifact.id)
    return {
      id: `${projectId}_${kind}`,
      path: patternToExamplePath(artifact.pattern, kind),
      kind,
      workflowStatus: "pending",
      expected: true,
      producedByNodeId: producerByArtifactId.get(artifact.id) ?? `artifact_${kind}`,
      dependsOn: artifact.dependencies?.map((dependency) => dependency.sourcePattern),
    }
  })
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

function workflowPayloadFromTranscriptEntry(args: {
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
    case "assistant_thinking":
      return {
        eventType: "agent_message",
        actorType: "agent",
        actorId: args.provider,
        nodeName: "Agent thinking",
        payload: {
          ...basePayload,
          textPreview: args.entry.thinking.slice(0, 400),
        },
      }
    case "tool_call":
      return {
        eventType: "agent_tool_started",
        actorType: "agent",
        actorId: args.provider,
        nodeName: args.entry.tool.toolKind.replaceAll("_", " "),
        nodeSummary: args.entry.tool.toolName,
        payload: {
          ...basePayload,
          toolId: args.entry.tool.toolId,
          toolKind: args.entry.tool.toolKind,
          toolName: args.entry.tool.toolName,
          input: args.entry.tool.input,
        },
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

function ensureRuntimeActivityNode(root: WorkflowNode, args: {
  chatId: string
  provider: AgentProvider
  status: WorkflowNodeStatus
  durationMs?: number
  logSummary?: string
}): WorkflowNode {
  const children = [...(root.children ?? [])]
  const existingIndex = children.findIndex((child) => child.id === "runtime_agent_activity")
  const existing = existingIndex >= 0 ? children[existingIndex] : undefined
  const node: WorkflowNode = {
    ...(existing ?? {
      id: "runtime_agent_activity",
      name: "Runtime agent activity",
      nodeType: "task",
      source: "dynamic",
      order: children.length + 100,
      children: [],
    }),
    status: args.status,
    agent: args.provider,
    agentRunId: args.chatId,
    durationMs: args.durationMs ?? existing?.durationMs,
    logSummary: args.logSummary ?? existing?.logSummary,
    children: existing?.children ?? [],
  }

  if (existingIndex >= 0) {
    children[existingIndex] = node
  } else {
    children.push(node)
  }

  return { ...root, children }
}

function upsertRuntimeToolNode(root: WorkflowNode, args: {
  toolId: string
  provider: AgentProvider
  chatId: string
  name: string
  status: WorkflowNodeStatus
  logSummary?: string
}): WorkflowNode {
  const nextRoot = ensureRuntimeActivityNode(root, {
    chatId: args.chatId,
    provider: args.provider,
    status: "running",
  })
  const children = [...(nextRoot.children ?? [])]
  const parentIndex = children.findIndex((child) => child.id === "runtime_agent_activity")
  if (parentIndex < 0) return nextRoot

  const parent = children[parentIndex]
  const toolChildren = [...(parent.children ?? [])]
  const nodeId = `tool_${args.toolId}`
  const existingIndex = toolChildren.findIndex((child) => child.id === nodeId)
  const existing = existingIndex >= 0 ? toolChildren[existingIndex] : undefined
  const toolNode: WorkflowNode = {
    ...(existing ?? {
      id: nodeId,
      nodeType: "step",
      source: "dynamic",
      order: toolChildren.length,
      spawnedByNodeId: "runtime_agent_activity",
    }),
    name: args.name,
    status: args.status,
    agent: args.provider,
    agentRunId: args.chatId,
    logSummary: args.logSummary ?? existing?.logSummary,
    sealed: args.status === "done" || args.status === "failed",
    childrenSealed: true,
  }

  if (existingIndex >= 0) {
    toolChildren[existingIndex] = toolNode
  } else {
    toolChildren.push(toolNode)
  }
  children[parentIndex] = { ...parent, children: toolChildren }
  return { ...nextRoot, children }
}

function artifactFromTranscriptToolCall(toolKind: string, input: unknown): RuntimeArtifactRef | null {
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

function upsertProjectionArtifact(args: {
  projectId: string
  artifacts: WorkflowArtifactRef[]
  toolId: string
  artifact: RuntimeArtifactRef
}): WorkflowArtifactRef[] {
  const updatedAt = new Date().toISOString()
  const checksum = checksumForContent(args.artifact.contentSnapshot ?? "")
  const existingIndex = args.artifacts.findIndex((artifact) => artifact.path === args.artifact.path)
  const existing = existingIndex >= 0 ? args.artifacts[existingIndex] : undefined
  const next: WorkflowArtifactRef = {
    id: existing?.id ?? `${args.projectId}_${args.artifact.kind}_${slugifyWorkflowName(args.artifact.path)}`,
    path: args.artifact.path,
    kind: args.artifact.kind,
    checksum,
    version: updatedAt,
    changed: false,
    workflowStatus: args.artifact.action === "delete" ? "invalidated" : "done",
    expected: existing?.expected ?? false,
    updatedAt,
    producedByNodeId: `tool_${args.toolId}`,
    dependsOn: existing?.dependsOn,
    ownershipClass: existing?.ownershipClass,
    ownerWorkflowId: existing?.ownerWorkflowId,
  }

  if (existingIndex >= 0) {
    const artifacts = [...args.artifacts]
    artifacts[existingIndex] = next
    return artifacts
  }
  return [...args.artifacts, next]
}

function matchPath(inputPath: string, type: "file" | "directory" | "glob", logicalPath: string): boolean {
  if (type === "file") {
    return logicalPath === inputPath
  }
  if (type === "directory") {
    const normalizedInput = inputPath.endsWith("/") ? inputPath : inputPath + "/"
    return logicalPath === inputPath || logicalPath.startsWith(normalizedInput)
  }
  if (type === "glob") {
    let regexStr = inputPath
      .replace(/[-\/\\^$*+?.()|[\]{}]/g, (char) => {
        if (char === "*") return "*"
        if (char === "?") return "?"
        return "\\" + char
      })
    regexStr = regexStr.replace(/\*\*/g, ".*")
    regexStr = regexStr.replace(/(?<!\.)\*/g, "[^/]*")
    regexStr = regexStr.replace(/\?/g, "[^/]")

    const regex = new RegExp("^" + regexStr + "$")
    return regex.test(logicalPath)
  }
  return false
}

export class SupabaseWorkflowRuntimeStore implements WorkflowRuntimeStore {
  private warned = false

  constructor(private readonly client: SupabaseRuntimeClient) {}

  subscribeToProjectWorkflow(projectId: string, callback: () => void): () => void {
    const channel = this.client
      .channel(`project-workflow-sync-${projectId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workflow_runs", filter: `project_id=eq.${projectId}` },
        () => {
          callback()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "project_workflows", filter: `project_id=eq.${projectId}` },
        () => {
          callback()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "artifacts", filter: `project_id=eq.${projectId}` },
        () => {
          callback()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workflow_nodes" },
        () => {
          callback()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "workflow_events" },
        () => {
          callback()
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "artifact_impacts" },
        () => {
          callback()
        }
      )
      .subscribe()

    return () => {
      void channel.unsubscribe()
    }
  }

  async listDefinitions(projectId?: string): Promise<WorkflowDefinitionSummary[]> {
    if (projectId) {
      await this.ensureWorkflowDefinition(projectId)
    }

    const { data: definitions, error } = await this.client
      .from("workflow_definitions")
      .select("id, slug, name, description, current_published_version_id")
      .order("created_at", { ascending: true })

    if (error) throw new Error(error.message)
    const rows = Array.isArray(definitions) ? definitions as any[] : []

    // Fetch registry records if projectId is provided
    const registrationsMap = new Map<string, any>()
    const activeRunsMap = new Map<string, any>()
    const projectArtifacts: any[] = []
    const projectImpacts: any[] = []
    const projectVersions: any[] = []
    let latestRunId: string | null = null

    if (projectId) {
      const { data: regs, error: regError } = await this.client
        .from("project_workflows")
        .select("workflow_definition_id, workflow_version_id, enabled, is_default_entrypoint, settings_jsonb")
        .eq("project_id", projectId)

      if (regError) throw new Error(regError.message)
      if (Array.isArray(regs)) {
        for (const reg of regs) {
          registrationsMap.set(reg.workflow_definition_id, reg)
        }
      }

      const { data: runs, error: runsError } = await this.client
        .from("workflow_runs")
        .select("id, workflow_version_id, status")
        .eq("project_id", projectId)
      
      if (runsError) throw new Error(runsError.message)
      if (Array.isArray(runs)) {
        for (const r of runs) {
          if (r.status === "running") {
            activeRunsMap.set(r.workflow_version_id, r)
          }
        }
        if (runs.length > 0) {
          latestRunId = runs[runs.length - 1].id
        }
      }

      const { data: arts, error: artsError } = await this.client
        .from("artifacts")
        .select("id, logical_path, kind, metadata_jsonb, current_version_id")
        .eq("project_id", projectId)
      
      if (artsError) throw new Error(artsError.message)
      if (Array.isArray(arts)) {
        projectArtifacts.push(...arts)
      }

      const versionIds = (arts || [])
        .map(a => a.current_version_id)
        .filter(Boolean) as string[]

      if (versionIds.length > 0) {
        const { data: pVers, error: pVersError } = await this.client
          .from("artifact_versions")
          .select("id, checksum, metadata_jsonb")
          .in("id", versionIds)
        if (pVersError) throw new Error(pVersError.message)
        projectVersions.push(...(pVers || []))
      }

      if (latestRunId) {
        const { data: impacts, error: impactsError } = await this.client
          .from("artifact_impacts")
          .select("id, source_artifact_id, impacted_artifact_id, status")
          .eq("run_id", latestRunId)
        
        if (impactsError) throw new Error(impactsError.message)
        if (Array.isArray(impacts)) {
          projectImpacts.push(...impacts)
        }
      }
    }

    // Collect all version IDs to batch load
    const versionIds = new Set<string>()
    for (const row of rows) {
      if (row.current_published_version_id) {
        versionIds.add(row.current_published_version_id)
      }
      const reg = registrationsMap.get(row.id)
      if (reg?.workflow_version_id) {
        versionIds.add(reg.workflow_version_id)
      }
    }

    const versionsMap = new Map<string, { version: string; manifest_jsonb: any; source_markdown?: string | null }>()
    if (versionIds.size > 0) {
      const { data: versionsData, error: versionsError } = await this.client
        .from("workflow_versions")
        .select("id, version, manifest_jsonb, source_markdown")
        .in("id", [...versionIds])

      if (versionsError) throw new Error(versionsError.message)
      if (Array.isArray(versionsData)) {
        for (const v of versionsData) {
          versionsMap.set(v.id, { version: v.version, manifest_jsonb: v.manifest_jsonb, source_markdown: v.source_markdown })
        }
      }
    }

    const summaries: WorkflowDefinitionSummary[] = []
    for (const row of rows) {
      const currentVersionInfo = row.current_published_version_id ? versionsMap.get(row.current_published_version_id) : null
      const reg = registrationsMap.get(row.id)
      const pinnedVersionId = reg?.workflow_version_id
      const pinnedVersionInfo = pinnedVersionId ? versionsMap.get(pinnedVersionId) : null
      
      const activeVersionId = pinnedVersionId ?? row.current_published_version_id
      const activeVersionInfo = activeVersionId ? versionsMap.get(activeVersionId) : null
      const activeManifest = asRuntimeRecord(activeVersionInfo?.manifest_jsonb)

      let readiness: WorkflowDefinitionSummary["readiness"] = undefined
      const unsatisfiedInputs: Array<{ path: string; type: string; status?: string }> = []
      const staleInputs: Array<{ path: string; currentChecksum: string; recordedChecksum: string }> = []

      if (projectId && reg) {
        if (activeRunsMap.has(activeVersionId)) {
          readiness = "running"
        } else if (projectImpacts.some(imp => imp.status === "needs_repair")) {
          readiness = "can_repair"
        } else if (projectImpacts.some(imp => imp.status === "needs_review" || imp.status === "maybe_impacted")) {
          readiness = "needs_review"
        } else {
          // Evaluate inputs
          const inputs = Array.isArray(activeManifest.inputs) ? activeManifest.inputs : []
          const outputs = Array.isArray(activeManifest.outputs) ? activeManifest.outputs : []

          if (inputs.length > 0) {
            for (const input of inputs) {
              const type = typeof input.type === "string" ? input.type : "file"
              const path = typeof input.path === "string" ? input.path : ""
              const matchingArts = projectArtifacts.filter(art => matchPath(path, type as any, art.logical_path))
              
              if (matchingArts.length === 0) {
                unsatisfiedInputs.push({ path, type, status: "missing" })
              } else {
                const unreviewed = matchingArts.filter(art => {
                  const metadata = asRuntimeRecord(art.metadata_jsonb)
                  const status = metadata.artifactStatus
                  return status !== "source_of_truth" && status !== "reviewed_ok"
                })
                if (unreviewed.length > 0) {
                  unsatisfiedInputs.push({
                    path,
                    type,
                    status: unreviewed[0].metadata_jsonb?.artifactStatus || "unreviewed",
                  })
                }
              }
            }
          }

          // Evaluate stale outputs relative to input versions
          let hasStale = false
          if (outputs.length > 0 && inputs.length > 0) {
            for (const output of outputs) {
              const outputPath = typeof output.path === "string" ? output.path : ""
              const outputArt = projectArtifacts.find(art => art.logical_path === outputPath)
              if (outputArt && outputArt.current_version_id) {
                const outputVer = projectVersions.find(v => v.id === outputArt.current_version_id)
                const outputMetadata = asRuntimeRecord(outputVer?.metadata_jsonb)
                const recordedChecksums = (outputMetadata.inputChecksums || {}) as Record<string, string>

                for (const input of inputs) {
                  const inputPath = typeof input.path === "string" ? input.path : ""
                  const inputType = typeof input.type === "string" ? input.type : "file"
                  const inputArtifacts = projectArtifacts.filter(art => matchPath(inputPath, inputType as any, art.logical_path))
                  for (const inputArt of inputArtifacts) {
                    if (!inputArt.current_version_id) continue
                    const inputVer = projectVersions.find(v => v.id === inputArt.current_version_id)
                    const currentChecksum = inputVer?.checksum || ""
                    const recordedChecksum = recordedChecksums[inputArt.logical_path] || ""
                    if (currentChecksum && recordedChecksum && currentChecksum !== recordedChecksum) {
                      staleInputs.push({
                        path: inputArt.logical_path,
                        currentChecksum,
                        recordedChecksum,
                      })
                      hasStale = true
                    }
                  }
                }
              }
            }
          }

          if (unsatisfiedInputs.length > 0) {
            readiness = "blocked"
          } else if (hasStale) {
            readiness = "needs_review"
          } else {
            readiness = "ready"
          }
        }
      }

      summaries.push({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description || undefined,
        currentVersionId: row.current_published_version_id || undefined,
        currentVersion: currentVersionInfo?.version || undefined,
        workflowType: typeof activeManifest.entryWorkflow === "string"
          ? activeManifest.entryWorkflow
          : typeof activeManifest.name === "string"
            ? activeManifest.name
            : row.slug,
        isRegistered: Boolean(reg),
        pinnedVersionId: pinnedVersionId || undefined,
        pinnedVersion: pinnedVersionInfo?.version || undefined,
        isEnabled: reg ? reg.enabled : false,
        isDefaultEntrypoint: reg ? reg.is_default_entrypoint : false,
        readiness,
        unsatisfiedInputs: unsatisfiedInputs.length > 0 ? unsatisfiedInputs : undefined,
        staleInputs: staleInputs.length > 0 ? staleInputs : undefined,
        settings: reg ? reg.settings_jsonb : undefined,
        manifest: activeManifest,
        sourceMarkdown: typeof activeVersionInfo?.source_markdown === "string" ? activeVersionInfo.source_markdown : undefined,
        sourceFiles: workflowManifestSourceFiles(activeManifest, activeVersionInfo?.source_markdown),
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
    let { data: regs, error: regLookupError } = await this.client
      .from("project_workflows")
      .select("workflow_version_id, enabled")
      .eq("project_id", args.projectId)
      .eq("workflow_definition_id", args.workflowDefinitionId)
      .limit(1)

    if (regLookupError) throw new Error(regLookupError.message)
    const reg = Array.isArray(regs) && regs.length > 0 ? regs[0] : null

    const definition = await this.getWorkflowDefinition(args.workflowDefinitionId)

    if (!reg) {
      throw new Error(`Workflow definition ${args.workflowDefinitionId} is not registered for project ${args.projectId}`)
    }
    if (!reg.enabled) {
      throw new Error(`Workflow registration is disabled for project ${args.projectId}`)
    }

    const workflowVersionId = reg.workflow_version_id ?? definition.current_published_version_id
    if (!workflowVersionId) {
      throw new Error(`No published version found for workflow definition ${args.workflowDefinitionId}`)
    }

    const version = await this.getWorkflowVersion(workflowVersionId)
    if (!version) {
      throw new Error(`Workflow version ${workflowVersionId} not found`)
    }
    if (version.status !== "published") {
      throw new Error(`Workflow version ${workflowVersionId} is not published (status: ${version.status})`)
    }

    const manifest = asRuntimeRecord(version.manifest_jsonb)
    const seed = definition.slug === createCurriculumWorkflowSeed(args.projectId).slug
      ? createCurriculumWorkflowSeed(args.projectId)
      : null
    const runId = randomUUID()
    const workflowType = typeof manifest.name === "string"
      ? manifest.name
      : typeof manifest.entryWorkflow === "string"
        ? manifest.entryWorkflow
        : definition.slug

    const { error: runError } = await this.client
      .from("workflow_runs")
      .insert({
        id: runId,
        project_id: args.projectId,
        chat_id: args.chatId ?? null,
        workflow_version_id: workflowVersionId,
        workflow_type: workflowType,
        status: "running",
        input_jsonb: args.input ?? {},
      })

    if (runError) throw new Error(runError.message)
    if (seed) {
      await this.insertSeedNodesArtifactsAndDiscoveryEvents(args.projectId, runId, seed)
    } else {
      await this.insertManifestNodesArtifactsAndDiscoveryEvents(args.projectId, runId, this.normalizeWorkflowManifest(manifest, definition))
    }
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

    const projection = await this.getProjectProjection(args.projectId)
    if (!projection) throw new Error("Workflow run projection was not available after starting run")
    return projection
  }

  async publishManifest(args: { projectId?: string; manifest: WorkflowManifest; sourceMarkdown?: string }): Promise<WorkflowDefinitionSummary> {
    const manifest = this.normalizeWorkflowManifest(args.manifest)
    const slug = slugifyWorkflowName(manifest.name)
    const definitionId = randomUUID()
    const versionId = randomUUID()

    const { data: existingDefinitions, error: lookupError } = await this.client
      .from("workflow_definitions")
      .select("id")
      .eq("slug", slug)
      .limit(1)

    if (lookupError) throw new Error(lookupError.message)
    const existingDefinitionId = Array.isArray(existingDefinitions) ? existingDefinitions[0]?.id as string | undefined : undefined
    const workflowDefinitionId = existingDefinitionId ?? definitionId

    if (!existingDefinitionId) {
      const { error } = await this.client
        .from("workflow_definitions")
        .insert({
          id: workflowDefinitionId,
          slug,
          name: manifest.name,
          description: manifest.description ?? null,
          owner_project_id: args.projectId ?? null,
        })

      if (error) throw new Error(error.message)
    } else {
      const { error } = await this.client
        .from("workflow_definitions")
        .update({
          name: manifest.name,
          description: manifest.description ?? null,
          owner_project_id: args.projectId ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", workflowDefinitionId)

      if (error) throw new Error(error.message)
    }

    const { data: existingVersions, error: versionLookupError } = await this.client
      .from("workflow_versions")
      .select("id")
      .eq("workflow_definition_id", workflowDefinitionId)
      .eq("version", manifest.version)
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
          version: manifest.version,
          status: "published",
          source_markdown: args.sourceMarkdown ?? null,
          manifest_jsonb: manifest,
          created_by: "kanna-ui",
          published_at: new Date().toISOString(),
        })

      if (error) throw new Error(error.message)
    }

    const { error: updateError } = await this.client
      .from("workflow_definitions")
      .update({
        current_published_version_id: workflowVersionId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", workflowDefinitionId)

    if (updateError) throw new Error(updateError.message)

    return {
      id: workflowDefinitionId,
      slug,
      name: manifest.name,
      description: manifest.description ?? undefined,
      currentVersionId: workflowVersionId,
      currentVersion: manifest.version,
      workflowType: manifest.name,
    }
  }

  async updateArtifactImpact(args: {
    projectId: string
    runId?: string
    sourceArtifactId: string
    impactedArtifactId?: string
    status: WorkflowArtifactImpact["status"]
    reason?: string
  }): Promise<WorkflowArtifactImpact[]> {
    const run = args.runId
      ? await this.getRun(args.runId)
      : await this.ensureProjectRun(args.projectId)
    if (!run || run.project_id !== args.projectId) throw new Error("Workflow run not found for project")

    const sourceArtifact = await this.getProjectArtifact(args.projectId, args.sourceArtifactId)
    const impactedArtifact = args.impactedArtifactId
      ? await this.getProjectArtifact(args.projectId, args.impactedArtifactId)
      : null

    if (sourceArtifact && impactedArtifact) {
      const { data: existing, error: lookupError } = await this.client
        .from("artifact_impacts")
        .select("id")
        .eq("run_id", run.id)
        .eq("source_artifact_id", sourceArtifact.id)
        .eq("impacted_artifact_id", impactedArtifact.id)
        .limit(1)

      if (lookupError) throw new Error(lookupError.message)
      const existingId = Array.isArray(existing) ? existing[0]?.id as string | undefined : undefined
      const row = {
        run_id: run.id,
        source_artifact_id: sourceArtifact.id,
        impacted_artifact_id: impactedArtifact.id,
        status: args.status,
        relationship: "direct",
        reason: args.reason ?? null,
        resolved_at: ["reviewed_ok", "repaired", "not_impacted"].includes(args.status) ? new Date().toISOString() : null,
      }

      const { error } = existingId
        ? await this.client.from("artifact_impacts").update(row).eq("id", existingId)
        : await this.client.from("artifact_impacts").insert({ id: randomUUID(), ...row })

      if (error) throw new Error(error.message)
    }

    await this.appendEvent({
      runId: run.id,
      type: "artifact_impact_updated",
      actorType: "user",
      payload: {
        projectId: args.projectId,
        sourceArtifactId: args.sourceArtifactId,
        impactedArtifactId: args.impactedArtifactId,
        status: args.status,
        reason: args.reason,
        persistedImpactRow: Boolean(sourceArtifact && impactedArtifact),
      },
    })

    return await this.getImpactEstimates(run.id, await this.getLatestArtifacts(args.projectId))
  }

  async markArtifact(args: {
    projectId: string
    artifactId: string
    action: "invalidate" | "accept_source_of_truth"
    reason?: string
  }): Promise<WorkflowArtifactRef[]> {
    const artifact = await this.getProjectArtifact(args.projectId, args.artifactId)
    if (!artifact) throw new Error("Artifact not found")

    const metadata = asRuntimeRecord(artifact.metadata_jsonb)
    const now = new Date().toISOString()
    const patch = args.action === "invalidate"
      ? {
          ...metadata,
          changed: true,
          artifactStatus: "invalidated",
          invalidatedAt: now,
          invalidationReason: args.reason ?? null,
        }
      : {
          ...metadata,
          changed: false,
          artifactStatus: "source_of_truth",
          acceptedAt: now,
          acceptanceReason: args.reason ?? null,
        }

    const { error } = await this.client
      .from("artifacts")
      .update({
        metadata_jsonb: patch,
        updated_at: now,
      })
      .eq("id", artifact.id)

    if (error) throw new Error(error.message)
    const run = await this.ensureProjectRun(args.projectId)
    await this.appendEvent({
      runId: run.id,
      type: "artifact_marked",
      actorType: "user",
      payload: {
        projectId: args.projectId,
        artifactId: artifact.id,
        path: artifact.logical_path,
        kind: artifact.kind,
        action: args.action,
        reason: args.reason,
      },
    })

    return await this.getLatestArtifacts(args.projectId)
  }

  async recoverLock(args: { projectId: string; lockId: string }): Promise<void> {
    // Stub/noop for Supabase configuration
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

  private async fetchProjectFlowGraph(projectId: string): Promise<any> {
    try {
      const registeredSummaries = await this.listDefinitions(projectId)
      const manifests = new Map<string, WorkflowManifest>()
      for (const summary of registeredSummaries) {
        if (summary.manifest) {
          manifests.set(summary.id, summary.manifest)
        }
      }

      const { data: edgesData, error: edgesError } = await this.client
        .from("project_flow_edges")
        .select("id, project_id, source_workflow_definition_id, target_workflow_definition_id, provenance, status")
        .eq("project_id", projectId)
      
      const storedEdges: ProjectFlowEdge[] = []
      if (!edgesError && Array.isArray(edgesData)) {
        for (const row of edgesData) {
          storedEdges.push({
            id: row.id,
            projectId: row.project_id,
            sourceWorkflowDefinitionId: row.source_workflow_definition_id,
            targetWorkflowDefinitionId: row.target_workflow_definition_id,
            provenance: row.provenance,
            status: row.status
          })
        }
      }

      const inferredEdges = inferArtifactFlowEdges(registeredSummaries, manifests)
      const resolvedEdges = resolveFlowEdges(projectId, inferredEdges, storedEdges)
      const packsList = await this.listPacks()

      return {
        nodes: registeredSummaries,
        edges: resolvedEdges,
        packs: packsList
      }
    } catch (e) {
      console.error("[workflow-runtime] Failed to fetch project flow graph:", e)
      return { nodes: [], edges: [], packs: [] }
    }
  }

  async getProjectProjection(projectId: string): Promise<WorkflowRunProjection | null> {
    const seed = createSeedWorkflowProjection(projectId)
    const flowGraph = await this.fetchProjectFlowGraph(projectId)

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
        return {
          id: `project_workflow_stub_${projectId}`,
          projectId,
          workflowType: "project_overview",
          title: "Project Workflows",
          status: "horizon",
          root: {
            id: "root",
            name: "Project Root",
            nodeType: "workflow",
            status: "horizon",
            source: "imported",
            order: 0,
            children: []
          },
          latestArtifacts: [],
          impacts: [],
          flowGraph
        }
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
        flowGraph,
      }
    } catch (error) {
      if (!this.warned) {
        this.warned = true
        console.warn("[workflow-runtime] Falling back to seed workflow projection:", error instanceof Error ? error.message : String(error))
      }
      return {
        ...seed,
        flowGraph
      }
    }
  }

  private async getLatestArtifacts(projectId: string): Promise<WorkflowArtifactRef[]> {
    const { data, error } = await this.client
      .from("artifacts")
      .select("id, logical_path, kind, metadata_jsonb, updated_at")
      .eq("project_id", projectId)
      .order("updated_at", { ascending: false })
      .limit(100)

    if (error) throw new Error(error.message)
    const rows = Array.isArray(data) ? data as WorkflowArtifactRow[] : []

    return this.artifactRowsToRefs(rows)
  }

  private artifactRowsToRefs(rows: WorkflowArtifactRow[]): WorkflowArtifactRef[] {
    return rows.flatMap((row) => {
      const metadata = asRuntimeRecord(row.metadata_jsonb)
      if (
        metadata.expected !== true &&
        metadata.artifactStatus === undefined &&
        metadata.lastObservedAction === "read" &&
        !row.updated_at
      ) {
        return []
      }
      if (
        metadata.expected !== true &&
        metadata.artifactStatus === undefined &&
        metadata.lastObservedAction === "read"
      ) {
        return []
      }
      const workflowStatus = typeof metadata.artifactStatus === "string"
        ? metadata.artifactStatus as WorkflowArtifactRef["workflowStatus"]
        : metadata.expected === true
          ? "pending"
          : "done"
      return [{
        id: row.id,
        path: row.logical_path,
        kind: row.kind,
        changed: metadata.lastObservedAction === "write"
          || metadata.lastObservedAction === "edit"
          || metadata.lastObservedAction === "delete"
          || metadata.changed === true,
        workflowStatus,
        expected: metadata.expected === true,
        updatedAt: row.updated_at ?? undefined,
        producedByNodeId: typeof metadata.producedByNodeId === "string"
          ? metadata.producedByNodeId
          : typeof metadata.lastObservedToolId === "string"
            ? `tool_${metadata.lastObservedToolId}`
            : undefined,
      }]
    })
  }

  private async getImpactEstimates(runId: string, artifacts: WorkflowArtifactRef[]): Promise<WorkflowArtifactImpact[]> {
    const artifactByPath = new Map(artifacts.map((artifact) => [artifact.path, artifact]))
    const artifactById = new Map(artifacts.map((artifact) => [artifact.id, artifact]))
    const latestSourceIdByKind = new Map<string, string>()
    for (const artifact of artifacts) {
      if (!latestSourceIdByKind.has(artifact.kind)) {
        latestSourceIdByKind.set(artifact.kind, artifact.id)
      }
    }

    const impacts: WorkflowArtifactImpact[] = []
    const seen = new Set<string>()

    const { data: persistedImpacts, error: persistedError } = await this.client
      .from("artifact_impacts")
      .select("id, source_artifact_id, impacted_artifact_id, status, relationship, reason")
      .eq("run_id", runId)
      .order("created_at", { ascending: false })
      .limit(100)

    if (persistedError) throw new Error(persistedError.message)
    for (const row of (Array.isArray(persistedImpacts) ? persistedImpacts as ArtifactImpactRow[] : [])) {
      const impactedArtifact = artifactById.get(row.impacted_artifact_id)
      const key = `${row.source_artifact_id}:${row.impacted_artifact_id}:${row.status}`
      if (seen.has(key)) continue
      seen.add(key)

      impacts.push({
        id: row.id,
        sourceArtifactId: row.source_artifact_id,
        impactedArtifactId: row.impacted_artifact_id,
        impactedPath: impactedArtifact?.path ?? row.impacted_artifact_id,
        impactedKind: impactedArtifact?.kind ?? "artifact",
        status: row.status,
        relationship: row.relationship,
        reason: row.reason ?? undefined,
      })
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
      case "assistant_thinking":
        return {
          eventType: "agent_message",
          actorType: "agent",
          actorId: args.provider,
          nodeName: "Agent thinking",
          payload: {
            ...basePayload,
            textPreview: args.entry.thinking.slice(0, 400),
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

    if (args.artifact.action === "read") {
      return
    }

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

    await this.recordArtifactVersion({
      artifactId,
      runId: args.runId,
      nodeId: `tool_${args.toolId}`,
      artifact: args.artifact,
    })

    await this.createArtifactImpactEstimates(args)
  }

  private async upsertArtifact(args: {
    projectId: string
    artifact: RuntimeArtifactRef
    metadata: Record<string, unknown>
  }): Promise<string> {
    const { data: existingArtifacts, error: lookupError } = await this.client
      .from("artifacts")
      .select("id, metadata_jsonb")
      .eq("project_id", args.projectId)
      .eq("logical_path", args.artifact.path)
      .limit(1)

    if (lookupError) throw new Error(lookupError.message)
    const existing = Array.isArray(existingArtifacts)
      ? existingArtifacts[0] as { id: string; metadata_jsonb: Record<string, unknown> | null } | undefined
      : undefined
    const existingId = existing?.id
    const existingMetadata = asRuntimeRecord(existing?.metadata_jsonb)
    const artifactStatus = args.artifact.action === "read"
      ? existingMetadata.artifactStatus ?? "done"
      : "done"

    if (existingId) {
      const { error } = await this.client
        .from("artifacts")
        .update({
          kind: args.artifact.kind,
          reuse_scope: "project",
          metadata_jsonb: {
            ...existingMetadata,
            ...args.metadata,
            classifier: "kanna-runtime-path-v1",
            expected: existingMetadata.expected === true,
            artifactStatus,
            changed: args.artifact.action === "read" ? existingMetadata.changed === true : true,
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
          artifactStatus: args.artifact.action === "read" ? "done" : "done",
          changed: args.artifact.action !== "read",
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

    const run = await this.getRun(args.runId)
    const projectId = run?.project_id
    const inputChecksums: Record<string, string> = {}

    if (projectId && args.artifact.action === "write") {
      const { data: arts } = await this.client
        .from("artifacts")
        .select("id, logical_path, current_version_id")
        .eq("project_id", projectId)
      
      const currentVersionIds = (arts || [])
        .map(a => a.current_version_id)
        .filter(Boolean) as string[]

      if (currentVersionIds.length > 0) {
        const { data: versions } = await this.client
          .from("artifact_versions")
          .select("artifact_id, checksum")
          .in("id", currentVersionIds)
        
        const versionMap = new Map((versions || []).map(v => [v.artifact_id, v.checksum]))
        for (const art of arts || []) {
          const vChecksum = versionMap.get(art.id)
          if (vChecksum) {
            inputChecksums[art.logical_path] = vChecksum
          }
        }
      }
    }

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
          inputChecksums,
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

  private normalizeWorkflowManifest(value: unknown, definition?: Pick<WorkflowDefinitionRow, "name" | "slug" | "description">): WorkflowManifest {
    const record = asRuntimeRecord(value)
    const normalizeNode = (item: unknown, index: number): WorkflowNodeDefinition => {
      const node = asRuntimeRecord(item)
      const id = typeof node.id === "string" && node.id.trim() ? node.id.trim() : `node_${index + 1}`
      return cleanOptional({
        id,
        name: typeof node.name === "string" && node.name.trim() ? node.name.trim() : id,
        nodeType: ["workflow", "task", "step", "gate", "artifact_check"].includes(String(node.nodeType))
          ? node.nodeType as WorkflowNodeDefinition["nodeType"]
          : "step",
        source: ["imported", "discovered", "dynamic", "conditional", "spawned"].includes(String(node.source))
          ? node.source as WorkflowNodeDefinition["source"]
          : undefined,
        status: ["horizon", "known", "running", "done", "failed", "waiting", "skipped"].includes(String(node.status))
          ? node.status as WorkflowNodeDefinition["status"]
          : undefined,
        agent: typeof node.agent === "string" ? node.agent : undefined,
        condition: typeof node.condition === "string" ? node.condition : undefined,
        produces: Array.isArray(node.produces) ? node.produces.filter((entry): entry is string => typeof entry === "string") : undefined,
        consumes: Array.isArray(node.consumes) ? node.consumes.filter((entry): entry is string => typeof entry === "string") : undefined,
        children: Array.isArray(node.children) ? node.children.map(normalizeNode) : undefined,
      })
    }
    const artifacts = Array.isArray(record.artifacts)
      ? record.artifacts.map((item, index) => {
          const artifact = asRuntimeRecord(item)
          const id = typeof artifact.id === "string" && artifact.id.trim()
            ? artifact.id.trim()
            : `artifact_${index + 1}`
          const dependencies = Array.isArray(artifact.dependencies)
            ? artifact.dependencies.map((dependency) => {
                const dependencyRecord = asRuntimeRecord(dependency)
                return {
                  sourcePattern: typeof dependencyRecord.sourcePattern === "string" ? dependencyRecord.sourcePattern : "",
                  relationship: typeof dependencyRecord.relationship === "string" ? dependencyRecord.relationship : "depends_on",
                  condition: typeof dependencyRecord.condition === "string" ? dependencyRecord.condition : undefined,
                }
              }).filter((dependency) => dependency.sourcePattern)
            : undefined
          return cleanOptional({
            id,
            name: typeof artifact.name === "string" && artifact.name.trim() ? artifact.name.trim() : id,
            description: typeof artifact.description === "string" ? artifact.description : undefined,
            pattern: typeof artifact.pattern === "string" && artifact.pattern.trim()
              ? artifact.pattern.trim()
              : `${artifactKindFromManifestId(id).toUpperCase()}_*`,
            dependencies,
          })
        })
      : []
    const normalizeIo = (item: unknown) => {
      const input = asRuntimeRecord(item)
      const type = ["file", "directory", "glob"].includes(String(input.type))
        ? input.type as "file" | "directory" | "glob"
        : "file"
      const path = typeof input.path === "string" && input.path.trim()
        ? input.path.trim()
        : typeof input.pattern === "string" && input.pattern.trim()
          ? input.pattern.trim()
          : ""
      return cleanOptional({
        path,
        type,
        description: typeof input.description === "string" ? input.description : undefined,
      })
    }
    const inputs = Array.isArray(record.inputs)
      ? record.inputs.map(normalizeIo).filter((input) => input.path)
      : undefined
    const outputs = Array.isArray(record.outputs)
      ? record.outputs.map(normalizeIo).filter((output) => output.path)
      : undefined

    return cleanOptional({
      version: typeof record.version === "string" && record.version.trim() ? record.version.trim() : "v1.0",
      name: typeof record.name === "string" && record.name.trim()
        ? record.name.trim()
        : definition?.name ?? definition?.slug ?? "Imported workflow",
      description: typeof record.description === "string" ? record.description : definition?.description ?? undefined,
      sourceFiles: Array.isArray(record.sourceFiles)
        ? record.sourceFiles.filter((sourceFile): sourceFile is string => typeof sourceFile === "string" && sourceFile.trim().length > 0)
        : undefined,
      entrypoint: typeof record.entrypoint === "boolean" ? record.entrypoint : undefined,
      role: typeof record.role === "string" ? record.role : undefined,
      artifacts,
      inputs,
      outputs,
      nodes: Array.isArray(record.nodes) ? record.nodes.map(normalizeNode) : undefined,
      flow: typeof record.flow === "object" && record.flow !== null ? asRuntimeRecord(record.flow) : undefined,
      execution: typeof record.execution === "object" && record.execution !== null ? asRuntimeRecord(record.execution) : undefined,
    })
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

  private async getWorkflowVersion(versionId: string): Promise<WorkflowVersionRow | null> {
    const { data, error } = await this.client
      .from("workflow_versions")
      .select("id, version, status, manifest_jsonb")
      .eq("id", versionId)
      .limit(1)

    if (error) throw new Error(error.message)
    return Array.isArray(data) ? data[0] as WorkflowVersionRow | undefined ?? null : null
  }

  private async getRun(runId: string): Promise<WorkflowRunRow | null> {
    if (!looksLikeUuid(runId)) return null
    const { data, error } = await this.client
      .from("workflow_runs")
      .select("id, project_id, chat_id, workflow_type, status, started_at")
      .eq("id", runId)
      .limit(1)

    if (error) throw new Error(error.message)
    return Array.isArray(data) ? data[0] as WorkflowRunRow | undefined ?? null : null
  }

  private async getProjectArtifact(projectId: string, artifactIdOrPath: string): Promise<WorkflowArtifactRow | null> {
    const query = this.client
      .from("artifacts")
      .select("id, logical_path, kind, metadata_jsonb, updated_at")
      .eq("project_id", projectId)
      .limit(1)

    const { data, error } = looksLikeUuid(artifactIdOrPath)
      ? await query.eq("id", artifactIdOrPath)
      : await query.eq("logical_path", artifactIdOrPath)

    if (error) throw new Error(error.message)
    return Array.isArray(data) ? data[0] as WorkflowArtifactRow | undefined ?? null : null
  }

  private async insertManifestNodesArtifactsAndDiscoveryEvents(
    projectId: string,
    runId: string,
    manifest: WorkflowManifest
  ): Promise<void> {
    const nodes = buildManifestNodeRows(manifest)
    const { error: nodeError } = await this.client
      .from("workflow_nodes")
      .insert(nodes.map((node) => ({
        ...node,
        run_id: runId,
        agent: node.agent ?? null,
        agent_run_id: null,
        spawned_by_node_id: null,
        tokens: node.tokens ?? null,
        duration_ms: node.duration_ms ?? null,
        condition: node.condition ?? null,
        sealed: node.sealed ?? false,
        children_sealed: node.children_sealed ?? false,
        log_summary: node.log_summary ?? null,
      })))

    if (nodeError) throw new Error(nodeError.message)

    const artifactRows = buildManifestArtifacts(projectId, manifest).map((artifact) => ({
      id: randomUUID(),
      project_id: projectId,
      logical_path: artifact.path,
      kind: artifact.kind,
      reuse_scope: "project",
      metadata_jsonb: {
        importedFromManifest: manifest.name,
        importedManifestVersion: manifest.version,
        expected: true,
        artifactStatus: "pending",
        producedByNodeId: artifact.producedByNodeId,
        dependencies: artifact.dependsOn ?? [],
        changed: false,
      },
    }))

    if (artifactRows.length > 0) {
      const { error: artifactError } = await this.client
        .from("artifacts")
        .upsert(artifactRows, {
          onConflict: "project_id,logical_path",
          ignoreDuplicates: true,
        })

      if (artifactError) throw new Error(artifactError.message)
    }

    const { error: eventError } = await this.client
      .from("workflow_events")
      .insert(nodes.map((node, index) => ({
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
        actor_id: "kanna-manifest",
      })))

    if (eventError) throw new Error(eventError.message)
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
          expected: true,
          artifactStatus: artifact.changed ? "invalidated" : "pending",
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

  async registerWorkflow(args: {
    projectId: string
    workflowDefinitionId: string
    versionId?: string
    isDefaultEntrypoint?: boolean
  }): Promise<void> {
    const now = new Date().toISOString()
    
    if (args.isDefaultEntrypoint) {
      await this.client
        .from("project_workflows")
        .update({ is_default_entrypoint: false, updated_at: now })
        .eq("project_id", args.projectId)
    }

    const { error } = await this.client
      .from("project_workflows")
      .insert({
        project_id: args.projectId,
        workflow_definition_id: args.workflowDefinitionId,
        workflow_version_id: args.versionId ?? null,
        is_default_entrypoint: !!args.isDefaultEntrypoint,
        enabled: true,
        created_at: now,
        updated_at: now,
      })

    if (error) throw new Error(error.message)
  }

  async unregisterWorkflow(args: {
    projectId: string
    workflowDefinitionId: string
  }): Promise<void> {
    const { error } = await this.client
      .from("project_workflows")
      .delete()
      .eq("project_id", args.projectId)
      .eq("workflow_definition_id", args.workflowDefinitionId)

    if (error) throw new Error(error.message)
  }

  async deleteDefinition(args: { projectId: string; workflowDefinitionId: string }): Promise<void> {
    throw new Error("deleteDefinition is not implemented in Supabase store yet")
  }

  async updateWorkflowRegistration(args: {
    projectId: string
    workflowDefinitionId: string
    patch: {
      versionId?: string
      enabled?: boolean
      isDefaultEntrypoint?: boolean
      settings?: Record<string, any>
    }
  }): Promise<void> {
    const now = new Date().toISOString()
    const updateData: any = {
      updated_at: now,
    }

    if (args.patch.versionId !== undefined) {
      updateData.workflow_version_id = args.patch.versionId
    }
    if (args.patch.enabled !== undefined) {
      updateData.enabled = args.patch.enabled
    }
    if (args.patch.settings !== undefined) {
      updateData.settings_jsonb = args.patch.settings
    }
    if (args.patch.isDefaultEntrypoint !== undefined) {
      updateData.is_default_entrypoint = args.patch.isDefaultEntrypoint
      
      if (args.patch.isDefaultEntrypoint) {
        await this.client
          .from("project_workflows")
          .update({ is_default_entrypoint: false, updated_at: now })
          .eq("project_id", args.projectId)
      }
    }

    const { error } = await this.client
      .from("project_workflows")
      .update(updateData)
      .eq("project_id", args.projectId)
      .eq("workflow_definition_id", args.workflowDefinitionId)

    if (error) throw new Error(error.message)
  }

  async listPacks(): Promise<WorkflowPack[]> {
    const { data: packsData, error: packsError } = await this.client
      .from("workflow_packs")
      .select("id, slug, name, description")
    if (packsError) throw new Error(packsError.message)

    const { data: defsData, error: defsError } = await this.client
      .from("workflow_pack_definitions")
      .select("workflow_pack_id, workflow_definition_id, version_id, is_default_entrypoint")
    if (defsError) throw new Error(defsError.message)

    return (packsData as any[]).map(pack => {
      const defs = (defsData as any[])
        .filter(d => d.workflow_pack_id === pack.id)
        .map(d => ({
          workflowDefinitionId: d.workflow_definition_id,
          versionId: d.version_id,
          isDefaultEntrypoint: d.is_default_entrypoint
        }))
      return {
        id: pack.id,
        slug: pack.slug,
        name: pack.name,
        description: pack.description,
        workflowDefinitions: defs
      }
    })
  }

  async registerPack(args: { projectId: string; packId: string }): Promise<void> {
    const { data: defsData, error: defsError } = await this.client
      .from("workflow_pack_definitions")
      .select("workflow_definition_id, version_id, is_default_entrypoint")
      .eq("workflow_pack_id", args.packId)
    if (defsError) throw new Error(defsError.message)

    for (const wdef of (defsData as any[])) {
      const now = new Date().toISOString()
      if (wdef.is_default_entrypoint) {
        await this.client
          .from("project_workflows")
          .update({ is_default_entrypoint: false, updated_at: now })
          .eq("project_id", args.projectId)
      }
      
      const { error: insertError } = await this.client
        .from("project_workflows")
        .insert({
          project_id: args.projectId,
          workflow_definition_id: wdef.workflow_definition_id,
          workflow_version_id: wdef.version_id,
          is_default_entrypoint: wdef.is_default_entrypoint,
          pack_id: args.packId,
          enabled: true,
          created_at: now,
          updated_at: now,
        })
      if (insertError) {
        await this.client
          .from("project_workflows")
          .update({ pack_id: args.packId, updated_at: now })
          .eq("project_id", args.projectId)
          .eq("workflow_definition_id", wdef.workflow_definition_id)
      }
    }
  }

  async addFlowEdge(args: {
    projectId: string
    sourceWorkflowDefinitionId: string
    targetWorkflowDefinitionId: string
    provenance: FlowEdgeProvenance
  }): Promise<ProjectFlowEdge> {
    const now = new Date().toISOString()
    const { data, error } = await this.client
      .from("project_flow_edges")
      .insert({
        project_id: args.projectId,
        source_workflow_definition_id: args.sourceWorkflowDefinitionId,
        target_workflow_definition_id: args.targetWorkflowDefinitionId,
        provenance: args.provenance,
        status: args.provenance === "ai_suggested" ? "pending_approval" : "approved",
        created_at: now,
        updated_at: now,
      })
      .select()
      .single()

    if (error) throw new Error(error.message)
    const row = data as any
    return {
      id: row.id,
      projectId: row.project_id,
      sourceWorkflowDefinitionId: row.source_workflow_definition_id,
      targetWorkflowDefinitionId: row.target_workflow_definition_id,
      provenance: row.provenance,
      status: row.status
    }
  }

  async removeFlowEdge(args: {
    projectId: string
    sourceWorkflowDefinitionId: string
    targetWorkflowDefinitionId: string
    provenance: FlowEdgeProvenance
  }): Promise<void> {
    const { data, error: selectError } = await this.client
      .from("project_flow_edges")
      .select("id, provenance, status")
      .eq("project_id", args.projectId)
      .eq("source_workflow_definition_id", args.sourceWorkflowDefinitionId)
      .eq("target_workflow_definition_id", args.targetWorkflowDefinitionId)
      .limit(1)

    if (selectError) throw new Error(selectError.message)
    const existing = Array.isArray(data) && data[0]

    if (existing) {
      if (existing.provenance === "artifact_io_inferred" || existing.provenance === "explicit_pack") {
        const now = new Date().toISOString()
        const { error } = await this.client
          .from("project_flow_edges")
          .update({
            provenance: "explicit_user",
            status: "rejected",
            updated_at: now
          })
          .eq("id", existing.id)
        if (error) throw new Error(error.message)
      } else {
        const { error } = await this.client
          .from("project_flow_edges")
          .delete()
          .eq("id", existing.id)
        if (error) throw new Error(error.message)
      }
    } else {
      const now = new Date().toISOString()
      const { error } = await this.client
        .from("project_flow_edges")
        .insert({
          project_id: args.projectId,
          source_workflow_definition_id: args.sourceWorkflowDefinitionId,
          target_workflow_definition_id: args.targetWorkflowDefinitionId,
          provenance: "explicit_user",
          status: "rejected",
          created_at: now,
          updated_at: now,
        })
      if (error) throw new Error(error.message)
    }
  }

  async approveFlowEdge(args: { projectId: string; edgeId: string }): Promise<void> {
    const now = new Date().toISOString()
    const { error } = await this.client
      .from("project_flow_edges")
      .update({ status: "approved", updated_at: now })
      .eq("id", args.edgeId)
    if (error) throw new Error(error.message)
  }

  async rejectFlowEdge(args: { projectId: string; edgeId: string }): Promise<void> {
    const now = new Date().toISOString()
    const { error } = await this.client
      .from("project_flow_edges")
      .update({ status: "rejected", updated_at: now })
      .eq("id", args.edgeId)
    if (error) throw new Error(error.message)
  }

  async inspectResumePlan(args: { projectId: string; runId: string }): Promise<any> {
    return {
      lastCompletedNodeId: undefined,
      activeInterruptedNodeId: undefined,
      staleArtifacts: [],
      heldLocks: [],
      recommendedAction: "resume" as const,
      blocked: false,
      reasons: [],
      warnings: [],
    }
  }

  async resumeRun(args: { projectId: string; runId: string }): Promise<WorkflowRunProjection> {
    const proj = await this.getProjectProjection(args.projectId)
    if (!proj) throw new Error("Workflow run not found")
    return proj
  }

  async restartRun(args: { projectId: string; runId: string }): Promise<WorkflowRunProjection> {
    const proj = await this.getProjectProjection(args.projectId)
    if (!proj) throw new Error("Workflow run not found")
    return proj
  }

  async archiveRun(args: { projectId: string; runId: string }): Promise<WorkflowRunProjection> {
    const proj = await this.getProjectProjection(args.projectId)
    if (!proj) throw new Error("Workflow run not found")
    return proj
  }

  async spawnParallelJob(args: { projectId: string; parentRunId: string; workflowDefinitionId: string }): Promise<import("@kanna/shared/types").WorkflowSubAgentJob> {
    throw new Error("spawnParallelJob is not implemented in Supabase store yet")
  }

  async mergeParallelJob(args: { projectId: string; jobId: string }): Promise<WorkflowRunProjection> {
    throw new Error("mergeParallelJob is not implemented in Supabase store yet")
  }

  async discardParallelJob(args: { projectId: string; jobId: string }): Promise<import("@kanna/shared/types").WorkflowSubAgentJob> {
    throw new Error("discardParallelJob is not implemented in Supabase store yet")
  }

  async shareWorkflow(args: { projectId: string; definitionId: string }): Promise<string> {
    throw new Error("shareWorkflow is not implemented in Supabase store yet")
  }

  async importWorkflowById(args: { projectId: string; shareId: string }): Promise<WorkflowDefinitionSummary> {
    throw new Error("importWorkflowById is not implemented in Supabase store yet")
  }

  async publishGlobalRequest(args: { projectId: string; definitionId: string; metadata: import("@kanna/shared/types").WorkflowMarketplaceMetadata }): Promise<void> {
    throw new Error("publishGlobalRequest is not implemented in Supabase store yet")
  }

  async approveGlobalPublish(args: { projectId: string; definitionId: string }): Promise<void> {
    throw new Error("approveGlobalPublish is not implemented in Supabase store yet")
  }

  async rejectGlobalPublish(args: { projectId: string; definitionId: string }): Promise<void> {
    throw new Error("rejectGlobalPublish is not implemented in Supabase store yet")
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
