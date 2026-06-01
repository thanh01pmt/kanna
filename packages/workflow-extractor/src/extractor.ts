import matter from "gray-matter"
import {
  WorkflowManifest,
  ArtifactDefinition,
  ArtifactDependencyRule,
} from "@kanna/shared/workflow-schema"

/**
 * Extracts workflow metadata, artifacts, and dependency rules from a Markdown document.
 */
export function extractWorkflowFromMarkdown(markdownContent: string): WorkflowManifest {
  const parsed = matter(markdownContent)
  const data = parsed.data
  const body = parsed.content

  const name = data.name || "unnamed-workflow"
  const version = data.version || "v1.0"
  const description = data.description || ""

  const artifacts: ArtifactDefinition[] = []

  // Helper to add or update artifact definitions
  const addArtifact = (id: string, name: string, pattern: string) => {
    if (!artifacts.some((a) => a.id === id)) {
      artifacts.push({
        id,
        name,
        pattern,
        dependencies: [],
      })
    }
  }

  // Helper to add dependencies to an artifact
  const addDependency = (artifactId: string, sourcePattern: string, relationship: string) => {
    const artifact = artifacts.find((a) => a.id === artifactId)
    if (artifact) {
      if (!artifact.dependencies) {
        artifact.dependencies = []
      }
      if (!artifact.dependencies.some((d: ArtifactDependencyRule) => d.sourcePattern === sourcePattern)) {
        artifact.dependencies.push({
          sourcePattern,
          relationship,
        })
      }
    }
  }

  // 1. Scan for artifact files mentioned in the workflow (e.g. LESSON_*.md, ACT_*.md, WKS_*.md, etc.)
  const lines = body.split("\n")

  // Check for common workflow patterns and extract artifacts
  // Rule A: Scan for scaffold/write commands or comments detailing file creations
  // e.g. "LESSON_*.md" or "ACT_UXX_MXX_LXX.md"
  const fileRegex = /([a-zA-Z0-9_\-\*\/]+\.(?:md|json|csv))/g
  const scaffoldRegex = /--artifact_type\s+["']?([A-Z_]+)["']?/

  for (const line of lines) {

    // Match file names/patterns (e.g., LESSON_*.md)
    let match
    while ((match = fileRegex.exec(line)) !== null) {
      const filePattern = match[1]

      // Skip templates, rules, and scripts
      if (
        filePattern.startsWith("_templates/") ||
        filePattern.startsWith(".agents/") ||
        filePattern.includes("package.json") ||
        filePattern.includes("node_modules") ||
        filePattern.endsWith(".sh") ||
        filePattern.endsWith(".py") ||
        filePattern.endsWith(".ts") ||
        filePattern.endsWith(".js")
      ) {
        continue
      }

      // Determine ID from filename (e.g. LESSON_*.md -> lesson, LEARNER_PROFILE.md -> learner_profile)
      const baseName = filePattern.split("/").pop() || filePattern
      const id = baseName.replace(/_\*|_UXX.*|\.md|\.json|\.csv/gi, "").toLowerCase()

      if (id && id.length > 2) {
        addArtifact(id, id.toUpperCase().replace(/_/g, " "), filePattern)
      }
    }

    // Check for nested sub-workflows (dependencies)
    // e.g., "// run workflow: create-act [LESSON_ID]"
    const runWorkflowRegex = /\/\/\s*run workflow:\s*([a-zA-Z0-9\-_]+)/
    const workflowMatch = runWorkflowRegex.exec(line)
    if (workflowMatch) {
      const subWorkflow = workflowMatch[1]
      // Determine what artifact type this sub-workflow creates based on standard naming
      // create-act -> act, create-slides -> slide, create-quiz -> quiz
      const subArtifactId = subWorkflow.replace("create-", "")
      
      // If we are currently in a workflow like create-lesson, and it spawns create-act,
      // then "act" depends on "lesson" (which is the source of truth).
      // Let's declare this dependency.
      if (name === "create-lesson") {
        addArtifact(subArtifactId, subArtifactId.toUpperCase(), `${subArtifactId.toUpperCase()}_*.md`)
        addDependency(subArtifactId, "LESSON_*.md", "derives_from")
      } else if (name === "create-course") {
        // create-course spawns create-unit
        addArtifact("unit", "UNIT", "UNIT_*.md")
        addDependency("unit", "CURRICULUM_FRAMEWORK.md", "derives_from")
      } else if (name === "create-unit") {
        // create-unit spawns create-lesson
        addArtifact("lesson", "LESSON", "LESSON_*.md")
        addDependency("lesson", "UNIT_*.md", "derives_from")
      }
    }

    // Explicitly scan scaffold flags in shell commands
    const scaffoldMatch = scaffoldRegex.exec(line)
    if (scaffoldMatch) {
      const type = scaffoldMatch[1].toLowerCase()
      addArtifact(type, type.toUpperCase(), `${type.toUpperCase()}_*.md`)
    }
  }

  // 2. Set default dependencies based on standard curriculum structure if not parsed
  // LESSON is the canonical source for ACT, GUIDE, SLIDE, HANDOUT, WKS, QUIZ, EXT, etc.
  const satelliteArtifacts = ["act", "guide", "slide", "handout", "wks", "quiz", "ext", "media_script", "code_lab"]
  if (name === "create-lesson") {
    // Ensure lesson artifact exists
    addArtifact("lesson", "LESSON", "LESSON_*.md")
    
    for (const sat of satelliteArtifacts) {
      if (artifacts.some((a) => a.id === sat)) {
        addDependency(sat, "LESSON_*.md", "derives_from")
      }
    }
  }

  return {
    name,
    version,
    description,
    artifacts,
  }
}
