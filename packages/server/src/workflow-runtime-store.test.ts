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
})
