import { describe, expect, test } from "bun:test"
import { renderToStaticMarkup } from "react-dom/server"
import React from "react"
import { WorkflowTrackerPanel } from "../WorkflowTrackerPanel"
import type { WorkflowRunProjection, WorkflowNode } from "../../types"

const mockRootNode: WorkflowNode = {
  id: "root-1",
  name: "Root",
  nodeType: "step",
  status: "running",
  source: "engine",
  order: 0,
  children: [
    {
      id: "parent-node-1",
      name: "Parent Node 1",
      nodeType: "step",
      status: "running",
      source: "engine",
      order: 1,
      children: [
        {
          id: "child-node-1",
          name: "Child Node 1",
          nodeType: "step",
          status: "running",
          source: "engine",
          order: 1,
          artifacts: [
            {
              id: "artifact-1",
              path: "dist/bundle.js",
              checksum: "hash123",
              nodeId: "child-node-1",
              status: "ready",
              changed: false,
            }
          ]
        }
      ]
    }
  ]
}

const mockRun: WorkflowRunProjection = {
  id: "run-123",
  status: "running",
  root: mockRootNode,
  latestArtifacts: [
    {
      id: "artifact-1",
      path: "dist/bundle.js",
      checksum: "hash123",
      nodeId: "child-node-1",
      status: "ready",
      changed: false,
    }
  ],
  impacts: [],
}

describe("WorkflowTrackerPanel - Nested Views", () => {
  test("renders top-level nodes in progress tree by default", () => {
    const html = renderToStaticMarkup(
      <WorkflowTrackerPanel
        run={mockRun}
        densityMode="normal"
      />
    )
    expect(html).toContain("Parent Node 1")
    expect(html).toContain("Progress Tree")
  })

  test("can render nested detail subflow inspect icon", () => {
    const html = renderToStaticMarkup(
      <WorkflowTrackerPanel
        run={mockRun}
        densityMode="normal"
      />
    )
    // Inspect sub-flow button title should be present
    expect(html).toContain("Inspect sub-flow")
  })
})
