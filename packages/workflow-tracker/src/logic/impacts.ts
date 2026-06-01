import type { WorkflowArtifactImpact, WorkflowArtifactRef } from "../types"

/**
 * Calculates the recursive downstream impact tree for a given source artifact.
 * Finds all artifacts that have a transitive or direct impact from this artifact.
 */
export function calculateDownstreamImpacts(
  sourceArtifactId: string,
  impacts: WorkflowArtifactImpact[],
  artifacts: WorkflowArtifactRef[]
): WorkflowArtifactRef[] {
  const impactedArtifactIds = new Set<string>()
  const queue = [sourceArtifactId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const directImpacts = impacts.filter(
      (impact) =>
        impact.sourceArtifactId === currentId &&
        impact.status !== "reviewed_ok" &&
        impact.status !== "repaired" &&
        impact.status !== "not_impacted"
    )

    for (const impact of directImpacts) {
      if (!impactedArtifactIds.has(impact.impactedArtifactId)) {
        impactedArtifactIds.add(impact.impactedArtifactId)
        queue.push(impact.impactedArtifactId)
      }
    }
  }

  // Find all artifacts that are in the set
  return artifacts.filter((artifact) => impactedArtifactIds.has(artifact.id))
}
