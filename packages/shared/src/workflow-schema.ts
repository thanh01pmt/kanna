import { z } from "zod"
import type { WorkflowNodeSource, WorkflowNodeStatus, WorkflowNodeType } from "./types"

/**
 * Defines a rule for how one artifact depends on another.
 * Used during static extraction to build the dependency graph.
 */
export const ArtifactDependencyRuleSchema = z.object({
  /** The path pattern or ID of the upstream source artifact */
  sourcePattern: z.string(),
  /** The type of relationship, e.g. "includes", "derives_from", "references" */
  relationship: z.string(),
  /** Optional regex or logic condition for when this dependency applies */
  condition: z.string().optional(),
})
export type ArtifactDependencyRule = z.infer<typeof ArtifactDependencyRuleSchema>

/**
 * Defines the shape and expectation of a generated or tracked artifact.
 */
export const ArtifactDefinitionSchema = z.object({
  /** Unique identifier for the artifact kind, e.g., "lesson_plan" */
  id: z.string(),
  /** Human-readable name */
  name: z.string(),
  /** Description of what this artifact contains */
  description: z.string().optional(),
  /** Regex pattern to identify matching files, e.g., "^LESSON_.*\\.md$" */
  pattern: z.string(),
  /** Upstream dependencies for this artifact */
  dependencies: z.array(ArtifactDependencyRuleSchema).optional(),
})
export type ArtifactDefinition = z.infer<typeof ArtifactDefinitionSchema>

/**
 * Defines a workflow/task/step tree. This is intentionally separate from
 * runtime nodes so imported workflows can be immutable while runs evolve.
 */
export const WorkflowNodeDefinitionSchema: z.ZodType<{
  id: string
  name: string
  nodeType: WorkflowNodeType
  source?: WorkflowNodeSource
  status?: WorkflowNodeStatus
  agent?: string
  condition?: string
  produces?: string[]
  consumes?: string[]
  children?: Array<z.infer<typeof WorkflowNodeDefinitionSchema>>
}> = z.lazy(() => z.object({
  id: z.string(),
  name: z.string(),
  nodeType: z.enum(["workflow", "task", "step", "gate", "artifact_check"]),
  source: z.enum(["imported", "discovered", "dynamic", "conditional", "spawned"]).optional(),
  status: z.enum(["horizon", "known", "running", "done", "failed", "waiting", "skipped"]).optional(),
  agent: z.string().optional(),
  condition: z.string().optional(),
  produces: z.array(z.string()).optional(),
  consumes: z.array(z.string()).optional(),
  children: z.array(WorkflowNodeDefinitionSchema).optional(),
}))
export type WorkflowNodeDefinition = z.infer<typeof WorkflowNodeDefinitionSchema>

/**
 * The full manifest extracted from markdown files representing an immutable workflow version.
 */
export const WorkflowManifestSchema = z.object({
  /** Version identifier */
  version: z.string(),
  /** Name of the workflow */
  name: z.string(),
  /** Description of the workflow's purpose */
  description: z.string().optional(),
  /** Whether this workflow can be used as an initial project entrypoint */
  entrypoint: z.boolean().optional(),
  /** Workflow role, e.g. initial, normal, utility, or subworkflow */
  role: z.string().optional(),
  /** List of all artifact definitions in this workflow */
  artifacts: z.array(ArtifactDefinitionSchema),
  /** Optional inputs required for the workflow to run */
  inputs: z.array(z.object({
    path: z.string(),
    type: z.enum(["file", "directory", "glob"]),
    description: z.string().optional(),
  })).optional(),
  /** Optional outputs produced by the workflow */
  outputs: z.array(z.object({
    path: z.string(),
    type: z.enum(["file", "directory", "glob"]),
    description: z.string().optional(),
    ownershipClass: z.enum(["canonical", "derived", "shared"]).optional(),
  })).optional(),
  /** Optional nested workflow/task/step graph. If absent, Kanna derives artifact_check nodes from artifacts. */
  nodes: z.array(WorkflowNodeDefinitionSchema).optional(),
  /** Optional project or pack flow metadata */
  flow: z.record(z.string(), z.unknown()).optional(),
  /** Optional execution policy hints */
  execution: z.record(z.string(), z.unknown()).optional(),
})
export type WorkflowManifest = z.infer<typeof WorkflowManifestSchema>
