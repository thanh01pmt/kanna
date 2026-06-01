import { z } from "zod"

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
 * The full manifest extracted from markdown files representing an immutable workflow version.
 */
export const WorkflowManifestSchema = z.object({
  /** Version identifier */
  version: z.string(),
  /** Name of the workflow */
  name: z.string(),
  /** Description of the workflow's purpose */
  description: z.string().optional(),
  /** List of all artifact definitions in this workflow */
  artifacts: z.array(ArtifactDefinitionSchema),
})
export type WorkflowManifest = z.infer<typeof WorkflowManifestSchema>
