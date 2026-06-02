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
