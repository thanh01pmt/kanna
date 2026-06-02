import { describe, expect, test } from "bun:test"
import { InMemoryWorkflowRuntimeStore } from "./workflow-runtime-store"

describe("InMemoryWorkflowRuntimeStore project workflow registration", () => {
  test("does not materialize a live workflow tree for a new project until a workflow starts", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const projection = await store.getProjectProjection("project-a")

    expect(projection?.title).toBe("Project Workflows")
    expect(projection?.root.children ?? []).toEqual([])
    expect(projection?.latestArtifacts ?? []).toEqual([])
    expect(projection?.flowGraph?.nodes.every((node) => node.isRegistered === false)).toBe(true)
  })

  test("lists catalog workflows as unregistered for a new project", async () => {
    const store = new InMemoryWorkflowRuntimeStore()

    const definitions = await store.listDefinitions("project-a")

    expect(definitions.length).toBeGreaterThan(0)
    expect(definitions.every((definition) => definition.isRegistered === false)).toBe(true)
    expect(definitions.every((definition) => definition.readiness === undefined)).toBe(true)
  })

  test("requires project registration before starting a workflow", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const [definition] = await store.listDefinitions("project-a")

    await expect(store.startRun({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
    })).rejects.toThrow("is not registered")

    await store.registerWorkflow({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
      versionId: definition.currentVersionId,
      isDefaultEntrypoint: true,
    })

    const [registered] = await store.listDefinitions("project-a")
    expect(registered.isRegistered).toBe(true)
    expect(registered.isDefaultEntrypoint).toBe(true)

    const projection = await store.startRun({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
    })
    expect(projection.projectId).toBe("project-a")
  })

  test("registers workflow packs and exposes only registered workflows in the project flow graph", async () => {
    const store = new InMemoryWorkflowRuntimeStore()

    const initialProjection = await store.getProjectProjection("project-a")
    expect(initialProjection?.flowGraph?.nodes).toHaveLength(0)

    await store.registerPack({ projectId: "project-a", packId: "curriculum-pack" })

    const definitions = await store.listDefinitions("project-a")
    const registered = definitions.filter((definition) => definition.isRegistered)
    expect(registered.map((definition) => definition.id).sort()).toEqual([
      "curriculum-analysis",
      "curriculum-design",
      "lesson-production",
    ])
    expect(registered.find((definition) => definition.id === "curriculum-analysis")?.isDefaultEntrypoint).toBe(true)

    const projection = await store.getProjectProjection("project-a")
    expect(projection?.flowGraph?.nodes.map((node) => node.id).sort()).toEqual([
      "curriculum-analysis",
      "curriculum-design",
      "lesson-production",
    ])
  })

  test("infers artifact IO flow edges between registered workflows", async () => {
    const store = new InMemoryWorkflowRuntimeStore()

    await store.registerWorkflow({
      projectId: "project-a",
      workflowDefinitionId: "curriculum-analysis",
      versionId: "1.0.0",
      isDefaultEntrypoint: true,
    })
    await store.registerWorkflow({
      projectId: "project-a",
      workflowDefinitionId: "curriculum-design",
      versionId: "1.0.0",
    })

    const projection = await store.getProjectProjection("project-a")

    expect(projection?.flowGraph?.edges).toContainEqual(expect.objectContaining({
      sourceWorkflowDefinitionId: "curriculum-analysis",
      targetWorkflowDefinitionId: "curriculum-design",
      provenance: "artifact_io_inferred",
      status: "approved",
    }))
  })

  test("blocks workflow starts when registered workflows declare overlapping non-shared output scopes", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const first = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Writer One",
        artifacts: [{ id: "report", name: "Report", pattern: "reports/one.md" }],
        outputs: [{ path: "reports", type: "directory" }],
      },
    })
    const second = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Writer Two",
        artifacts: [{ id: "report", name: "Report", pattern: "reports/two.md" }],
        outputs: [{ path: "reports/two.md", type: "file", ownershipClass: "derived" }],
      },
    })

    await store.registerWorkflow({ projectId: "project-a", workflowDefinitionId: first.id })
    await store.registerWorkflow({ projectId: "project-a", workflowDefinitionId: second.id })

    await expect(store.startRun({
      projectId: "project-a",
      workflowDefinitionId: second.id,
    })).rejects.toThrow("scope_overlap conflict")

    const projection = await store.getProjectProjection("project-a")
    expect(projection?.lockConflicts).toContainEqual(expect.objectContaining({
      blockingWorkflowId: first.id,
      requestingWorkflowId: second.id,
      type: "scope_overlap",
    }))
  })

  test("allows overlapping output scopes when both workflows declare shared outputs", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const first = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Shared Writer One",
        artifacts: [{ id: "progress", name: "Progress", pattern: "progress.md" }],
        outputs: [{ path: "progress.md", type: "file", ownershipClass: "shared" }],
      },
    })
    const second = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Shared Writer Two",
        artifacts: [{ id: "progress", name: "Progress", pattern: "progress.md" }],
        outputs: [{ path: "progress.md", type: "file", ownershipClass: "shared" }],
      },
    })

    await store.registerWorkflow({ projectId: "project-a", workflowDefinitionId: first.id })
    await store.registerWorkflow({ projectId: "project-a", workflowDefinitionId: second.id })

    await expect(store.startRun({
      projectId: "project-a",
      workflowDefinitionId: first.id,
    })).resolves.toMatchObject({ projectId: "project-a" })
  })
})

describe("InMemoryWorkflowRuntimeStore resume orchestration", () => {
  test("inspects resume plan and resumes an interrupted run successfully", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const definition = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Writer",
        inputs: [{ path: "input.json", type: "file" }],
        outputs: [{ path: "output.json", type: "file" }],
        nodes: [{ id: "step-1", name: "Step One", parent_id: null, node_type: "agent", status: "interrupted" }],
      },
    })

    await store.registerWorkflow({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
      versionId: "1.0.0",
    })

    const run = await store.startRun({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
    })

    // Setup interrupted state & checkpoint
    run.status = "interrupted"
    run.root.status = "interrupted"
    run.checkpoint = {
      nodeId: "step-1",
      versionId: "1.0.0",
      inputs: [{ path: "input.json", checksum: "abc", version: "1.0" }],
      outputs: [{ path: "output.json", checksum: "def", version: "1.0" }],
      events: [],
    }
    run.latestArtifacts = [
      { id: "input", name: "Input", path: "input.json", kind: "other", checksum: "abc", version: "1.0", changed: false },
      { id: "output", name: "Output", path: "output.json", kind: "other", checksum: "def", version: "1.0", changed: false },
    ]

    const plan = await store.inspectResumePlan({ projectId: "project-a", runId: run.id })
    expect(plan.blocked).toBe(false)
    expect(plan.activeInterruptedNodeId).toBe("step-1")
    expect(plan.recommendedAction).toBe("resume")

    const resumed = await store.resumeRun({ projectId: "project-a", runId: run.id })
    expect(resumed.status).toBe("running")
    expect(resumed.root.status).toBe("running")
  })

  test("blocks resumption and recommends review when input artifact checksum has changed", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const definition = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Writer",
        inputs: [{ path: "input.json", type: "file" }],
        nodes: [{ id: "step-1", name: "Step One", parent_id: null, node_type: "agent", status: "interrupted" }],
      },
    })

    await store.registerWorkflow({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
      versionId: "1.0.0",
    })

    const run = await store.startRun({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
    })

    run.status = "interrupted"
    run.checkpoint = {
      nodeId: "step-1",
      versionId: "1.0.0",
      inputs: [{ path: "input.json", checksum: "abc", version: "1.0" }],
      events: [],
    }
    run.latestArtifacts = [
      { id: "input", name: "Input", path: "input.json", kind: "other", checksum: "xyz", version: "1.1", changed: true },
    ]

    const plan = await store.inspectResumePlan({ projectId: "project-a", runId: run.id })
    expect(plan.blocked).toBe(true)
    expect(plan.reasons).toContain("Input artifacts changed since checkpoint.")
    expect(plan.recommendedAction).toBe("review_impacts")
  })

  test("flags a version warning if the registered version changed", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const definition = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Writer",
        nodes: [{ id: "step-1", name: "Step One", parent_id: null, node_type: "agent", status: "interrupted" }],
      },
    })

    await store.registerWorkflow({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
      versionId: "2.0.0", // Registered under a new version
    })

    const run = await store.startRun({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
    })

    // Simulated old run has version "1.0.0"
    run.definitionVersion = "1.0.0"
    run.status = "interrupted"

    const plan = await store.inspectResumePlan({ projectId: "project-a", runId: run.id })
    expect(plan.warnings).toContain("The run version no longer matches the project registered version.")
  })

  test("can restart an interrupted run (archiving the old and starting a new one)", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const definition = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Writer",
        nodes: [{ id: "step-1", name: "Step One", parent_id: null, node_type: "agent" }],
      },
    })

    await store.registerWorkflow({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
      versionId: "1.0.0",
    })

    const run = await store.startRun({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
    })

    run.status = "interrupted"

    const newRun = await store.restartRun({ projectId: "project-a", runId: run.id })
    expect(newRun.id).not.toBe(run.id)
    expect(newRun.status).toBe("running")

    expect(run.status).toBe("archived")
  })

  test("can archive a run directly", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const definition = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Writer",
        nodes: [{ id: "step-1", name: "Step One", parent_id: null, node_type: "agent" }],
      },
    })

    await store.registerWorkflow({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
      versionId: "1.0.0",
    })

    const run = await store.startRun({
      projectId: "project-a",
      workflowDefinitionId: definition.id,
    })

    const archived = await store.archiveRun({ projectId: "project-a", runId: run.id })
    expect(archived.status).toBe("archived")
  })
})

describe("InMemoryWorkflowRuntimeStore parallel subagent worktrees", () => {
  test("creates parallel sub-agent jobs in isolated worktrees", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const first = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Main",
        nodes: [{ id: "step-1", name: "Step One", parent_id: null, node_type: "agent" }],
      },
    })
    const second = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Sub",
        nodes: [{ id: "step-2", name: "Step Two", parent_id: null, node_type: "agent" }],
      },
    })

    await store.registerWorkflow({ projectId: "project-a", workflowDefinitionId: first.id })
    await store.registerWorkflow({ projectId: "project-a", workflowDefinitionId: second.id })

    const parentRun = await store.startRun({
      projectId: "project-a",
      workflowDefinitionId: first.id,
    })

    const job = await store.spawnParallelJob!({
      projectId: "project-a",
      parentRunId: parentRun.id,
      workflowDefinitionId: second.id,
    })

    expect(job.status).toBe("running")
    expect(job.branchName).toContain(`subagent-${second.id}`)
    expect(job.worktreePath).toContain(`worktrees/subagent-${second.id}`)
    expect(parentRun.jobs).toContainEqual(job)
  })

  test("flags stale inputs and locks conflicts on merge", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const first = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Main",
        nodes: [{ id: "step-1", name: "Step One", parent_id: null, node_type: "agent" }],
      },
    })
    const second = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Sub",
        nodes: [{ id: "step-2", name: "Step Two", parent_id: null, node_type: "agent" }],
      },
    })

    await store.registerWorkflow({ projectId: "project-a", workflowDefinitionId: first.id })
    await store.registerWorkflow({ projectId: "project-a", workflowDefinitionId: second.id })

    const parentRun = await store.startRun({
      projectId: "project-a",
      workflowDefinitionId: first.id,
    })

    const job = await store.spawnParallelJob!({
      projectId: "project-a",
      parentRunId: parentRun.id,
      workflowDefinitionId: second.id,
    })

    // Simulate stale inputs
    job.mergeStatus = "stale_inputs"
    await expect(store.mergeParallelJob!({
      projectId: "project-a",
      jobId: job.id,
    })).rejects.toThrow("Cannot merge job due to stale inputs")

    // Reset and simulate a lock conflict
    job.mergeStatus = "clean"
    job.producedArtifacts = [{ id: "doc", name: "Doc", path: "reports/doc.md", kind: "other", checksum: "123", version: "1.0", changed: true }]
    
    // Acquire conflicting lock for another run
    const locks = store.locksByProjectId.get("project-a") ?? []
    locks.push({
      id: "lock-conflict",
      scope: "file:reports/doc.md",
      workflowId: "another-run-id",
      status: "active",
      acquiredAt: new Date().toISOString(),
    })
    store.locksByProjectId.set("project-a", locks)

    await expect(store.mergeParallelJob!({
      projectId: "project-a",
      jobId: job.id,
    })).rejects.toThrow("Cannot merge job due to lock conflicts")
  })

  test("cleanly merges parallel job and adds artifacts as needs_review", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const first = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Main",
        nodes: [{ id: "step-1", name: "Step One", parent_id: null, node_type: "agent" }],
      },
    })
    const second = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Sub",
        nodes: [{ id: "step-2", name: "Step Two", parent_id: null, node_type: "agent" }],
      },
    })

    await store.registerWorkflow({ projectId: "project-a", workflowDefinitionId: first.id })
    await store.registerWorkflow({ projectId: "project-a", workflowDefinitionId: second.id })

    const parentRun = await store.startRun({
      projectId: "project-a",
      workflowDefinitionId: first.id,
    })

    const job = await store.spawnParallelJob!({
      projectId: "project-a",
      parentRunId: parentRun.id,
      workflowDefinitionId: second.id,
    })

    job.producedArtifacts = [{ id: "output", name: "Output", path: "out.json", kind: "other", checksum: "789", version: "2.0", changed: true }]

    const mergedRun = await store.mergeParallelJob!({
      projectId: "project-a",
      jobId: job.id,
    })

    expect(job.status).toBe("merged")
    expect(job.mergeStatus).toBe("clean")
    expect(mergedRun.latestArtifacts).toContainEqual(expect.objectContaining({
      path: "out.json",
      approvalStatus: "needs_review",
    }))
  })

  test("discarded parallel jobs do not modify main workspace", async () => {
    const store = new InMemoryWorkflowRuntimeStore()
    const first = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Main",
        nodes: [{ id: "step-1", name: "Step One", parent_id: null, node_type: "agent" }],
      },
    })
    const second = await store.publishManifest({
      manifest: {
        version: "1.0.0",
        name: "Sub",
        nodes: [{ id: "step-2", name: "Step Two", parent_id: null, node_type: "agent" }],
      },
    })

    await store.registerWorkflow({ projectId: "project-a", workflowDefinitionId: first.id })
    await store.registerWorkflow({ projectId: "project-a", workflowDefinitionId: second.id })

    const parentRun = await store.startRun({
      projectId: "project-a",
      workflowDefinitionId: first.id,
    })

    const job = await store.spawnParallelJob!({
      projectId: "project-a",
      parentRunId: parentRun.id,
      workflowDefinitionId: second.id,
    })

    job.producedArtifacts = [{ id: "secret", name: "Secret", path: "secret.json", kind: "other", checksum: "000", version: "1.0", changed: true }]

    const discardedJob = await store.discardParallelJob!({
      projectId: "project-a",
      jobId: job.id,
    })

    expect(discardedJob.status).toBe("discarded")
    expect(parentRun.latestArtifacts ?? []).not.toContainEqual(expect.objectContaining({
      path: "secret.json",
    }))
  })
})


