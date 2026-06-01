import type { WorkflowArtifactRef, WorkflowNode, WorkflowRunProjection } from "@kanna/shared/types"

const WORKFLOW_SOURCE_DIR = "/Users/tonypham/MEGA/my-agents/packages/the-ultimate-curriculum-agent-os/.agents/workflows"

export interface WorkflowSeedNodeRow {
  id: string
  parent_id: string | null
  node_type: WorkflowNode["nodeType"]
  name: string
  status: WorkflowNode["status"]
  source: WorkflowNode["source"]
  order_index: number
  agent?: string
  tokens?: number
  duration_ms?: number
  condition?: string
  sealed?: boolean
  children_sealed?: boolean
  log_summary?: string
}

export interface CurriculumWorkflowSeed {
  slug: string
  name: string
  version: string
  description: string
  sourceFiles: string[]
  manifest: Record<string, unknown>
  projection: WorkflowRunProjection
  nodes: WorkflowSeedNodeRow[]
  artifacts: WorkflowArtifactRef[]
}

function workflowPath(fileName: string) {
  return `${WORKFLOW_SOURCE_DIR}/${fileName}`
}

function flattenNodes(node: WorkflowNode, parentId: string | null = null): WorkflowSeedNodeRow[] {
  const rows: WorkflowSeedNodeRow[] = [{
    id: node.id,
    parent_id: parentId,
    node_type: node.nodeType,
    name: node.name,
    status: node.status,
    source: node.source,
    order_index: node.order,
    agent: node.agent,
    tokens: node.tokens,
    duration_ms: node.durationMs,
    condition: node.condition,
    sealed: node.sealed,
    children_sealed: node.childrenSealed,
    log_summary: node.logSummary,
  }]

  for (const child of node.children ?? []) {
    rows.push(...flattenNodes(child, node.id))
  }

  return rows
}

export function createCurriculumWorkflowSeed(projectId: string): CurriculumWorkflowSeed {
  const artifacts: WorkflowArtifactRef[] = [
    { id: "learner_profile", path: "LEARNER_PROFILE.md", kind: "learner_profile", producedByNodeId: "course_analysis" },
    { id: "project_brief", path: "PROJECT_BRIEF.md", kind: "project_brief", producedByNodeId: "course_analysis" },
    { id: "reference_registry", path: "REFERENCE_REGISTRY.json", kind: "reference_registry", producedByNodeId: "course_harvest" },
    { id: "reference_pack", path: "REFERENCE_PACK.md", kind: "reference_pack", producedByNodeId: "course_harvest" },
    { id: "curriculum_framework", path: "CURRICULUM_FRAMEWORK.md", kind: "curriculum_framework", producedByNodeId: "course_framework", changed: true },
    { id: "art_direction", path: "ART_DIRECTION.md", kind: "art_direction", producedByNodeId: "course_art_direction" },
    { id: "content_style_guide", path: "CONTENT_STYLE_GUIDE.md", kind: "content_style_guide", producedByNodeId: "course_style_guide" },
    { id: "lesson", path: "units/U01/lessons/L01/LESSON_U01_L01.md", kind: "lesson", producedByNodeId: "lesson_canonical" },
    { id: "quiz", path: "units/U01/lessons/L01/QUIZ_U01_L01.md", kind: "quiz", producedByNodeId: "lesson_quiz" },
    { id: "slides", path: "units/U01/lessons/L01/SLIDES_U01_L01.md", kind: "slides", producedByNodeId: "lesson_slides" },
  ]

  const root: WorkflowNode = {
    id: "wf_create_course",
    name: "create-course",
    nodeType: "workflow",
    status: "running",
    source: "imported",
    order: 0,
    childrenSealed: false,
    children: [
      {
        id: "course_idempotent_check",
        name: "Idempotent check",
        nodeType: "step",
        status: "done",
        source: "imported",
        order: 0,
        agent: "orchestrator",
        sealed: true,
        durationMs: 22_000,
        logSummary: "Detect existing artifacts and decide whether to resume, repair, or continue.",
      },
      {
        id: "course_setup",
        name: "Init project structure",
        nodeType: "task",
        status: "done",
        source: "imported",
        order: 1,
        agent: "orchestrator",
        sealed: true,
        childrenSealed: true,
        logSummary: "Create the canonical course directory and workflow state scaffolding.",
      },
      {
        id: "course_research",
        name: "Analysis & collection",
        nodeType: "workflow",
        status: "done",
        source: "imported",
        order: 2,
        agent: "analyst",
        sealed: true,
        childrenSealed: true,
        artifacts: artifacts.slice(0, 4),
        children: [
          {
            id: "course_analysis",
            name: "Create learner profile and project brief",
            nodeType: "step",
            status: "done",
            source: "imported",
            order: 0,
            agent: "analyst",
            tokens: 2140,
            durationMs: 2 * 60_000 + 34_000,
          },
          {
            id: "course_harvest",
            name: "Run harvest-resources",
            nodeType: "workflow",
            status: "done",
            source: "imported",
            order: 1,
            agent: "researcher",
            tokens: 6420,
            durationMs: 7 * 60_000 + 8_000,
            childrenSealed: true,
            logSummary: "Discovery, source proposal, human approval, reference pack, and NotebookLM sync.",
          },
          {
            id: "gate_1",
            name: "Gate 1 approval",
            nodeType: "gate",
            status: "done",
            source: "imported",
            order: 2,
            agent: "human",
            sealed: true,
          },
        ],
      },
      {
        id: "course_design",
        name: "Framework, art direction, style guide",
        nodeType: "task",
        status: "running",
        source: "imported",
        order: 3,
        agent: "designer",
        childrenSealed: false,
        artifacts: artifacts.slice(4, 7),
        children: [
          {
            id: "course_framework",
            name: "Generate CURRICULUM_FRAMEWORK.md",
            nodeType: "step",
            status: "done",
            source: "imported",
            order: 0,
            agent: "designer",
            tokens: 3890,
            durationMs: 4 * 60_000 + 12_000,
          },
          {
            id: "course_art_direction",
            name: "Generate ART_DIRECTION.md",
            nodeType: "step",
            status: "running",
            source: "imported",
            order: 1,
            agent: "designer",
            tokens: 1830,
            durationMs: 104_000,
            logSummary: "Writing visual constraints before unit production opens.",
          },
          {
            id: "course_style_guide",
            name: "Generate CONTENT_STYLE_GUIDE.md",
            nodeType: "step",
            status: "known",
            source: "imported",
            order: 2,
            agent: "designer",
          },
          {
            id: "gate_2",
            name: "Gate 2 approval",
            nodeType: "gate",
            status: "waiting",
            source: "imported",
            order: 3,
            agent: "human",
            condition: "after framework, art direction, and style guide are reviewed",
          },
        ],
      },
      {
        id: "wf_create_unit",
        name: "create-unit",
        nodeType: "workflow",
        status: "horizon",
        source: "conditional",
        order: 4,
        agent: "orchestrator",
        condition: "materializes once CURRICULUM_FRAMEWORK.md defines concrete UNIT_ID values",
        childrenSealed: false,
        children: [
          { id: "unit_scaffold", name: "Scaffold unit and JIT lesson files", nodeType: "step", status: "known", source: "imported", order: 0, agent: "orchestrator" },
          { id: "unit_harvest", name: "Unit R&D and reference coverage", nodeType: "workflow", status: "known", source: "imported", order: 1, agent: "researcher" },
          { id: "unit_micro_gate", name: "Micro-gate approve unit framework", nodeType: "gate", status: "known", source: "imported", order: 2, agent: "human" },
          {
            id: "wf_create_lesson",
            name: "create-lesson",
            nodeType: "workflow",
            status: "horizon",
            source: "conditional",
            order: 3,
            agent: "orchestrator",
            condition: "repeats for each lesson after unit framework is approved",
            childrenSealed: false,
            children: [
              { id: "lesson_canonical", name: "Write canonical LESSON", nodeType: "step", status: "known", source: "imported", order: 0, agent: "writer" },
              { id: "lesson_verify", name: "Technical verification", nodeType: "artifact_check", status: "known", source: "imported", order: 1, agent: "researcher" },
              {
                id: "lesson_satellites",
                name: "Satellite artifacts from LESSON",
                nodeType: "workflow",
                status: "horizon",
                source: "conditional",
                order: 2,
                condition: "expands only for artifacts included in Artifact Scope",
                childrenSealed: false,
                children: [
                  { id: "lesson_slides", name: "create-slides", nodeType: "workflow", status: "horizon", source: "conditional", order: 0, agent: "slides-agent" },
                  { id: "lesson_quiz", name: "create-quiz", nodeType: "workflow", status: "horizon", source: "conditional", order: 1, agent: "assessment-agent" },
                  { id: "lesson_act", name: "create-act / guide / handout / wks / ext", nodeType: "workflow", status: "horizon", source: "conditional", order: 2, condition: "one branch per requested artifact kind" },
                ],
              },
              { id: "lesson_quality", name: "Quality gates and continuity sync", nodeType: "artifact_check", status: "known", source: "imported", order: 3, agent: "qa" },
            ],
          },
          { id: "unit_audit", name: "audit-quality UNIT_ID", nodeType: "workflow", status: "known", source: "imported", order: 4, agent: "qa" },
        ],
      },
      {
        id: "course_final_qa",
        name: "audit-quality --all",
        nodeType: "workflow",
        status: "horizon",
        source: "conditional",
        order: 5,
        agent: "qa",
        condition: "runs after all materialized unit/lesson artifacts complete",
      },
    ],
  }

  const projection: WorkflowRunProjection = {
    id: `seed_${projectId}`,
    projectId,
    workflowType: "create-course",
    title: "Create Course",
    status: "running",
    elapsedMs: 18 * 60_000 + 42_000,
    tokenTotalKnown: 24_280,
    definitionVersion: "curriculum-agent-os-v3.1",
    root,
    latestArtifacts: artifacts.slice(0, 7),
    impacts: [
      {
        id: "impact_curriculum_to_units",
        sourceArtifactId: "curriculum_framework",
        impactedArtifactId: "unit_framework",
        impactedPath: "units/U01/UNIT_FRAMEWORK.md",
        impactedKind: "unit_framework",
        status: "needs_review",
        relationship: "direct",
        reason: "Unit production depends on accepted course objectives and unit list.",
      },
      {
        id: "impact_lesson_satellites",
        sourceArtifactId: "lesson",
        impactedArtifactId: "quiz",
        impactedPath: "units/U01/lessons/L01/QUIZ_U01_L01.md",
        impactedKind: "quiz",
        status: "maybe_impacted",
        relationship: "transitive",
        reason: "Satellite artifacts are derived from canonical LESSON content.",
      },
    ],
  }

  const sourceFiles = [
    workflowPath("create-course.md"),
    workflowPath("create-unit.md"),
    workflowPath("create-lesson.md"),
    workflowPath("create-slides.md"),
    workflowPath("create-quiz.md"),
    workflowPath("harvest-resources.md"),
    workflowPath("audit-quality.md"),
  ]

  return {
    slug: "curriculum-create-course",
    name: "Create Course",
    version: "curriculum-agent-os-v3.1",
    description: "Imported curriculum workflow with recursive unit, lesson, satellite artifact, and QA sub-workflows.",
    sourceFiles,
    manifest: {
      importedFrom: WORKFLOW_SOURCE_DIR,
      entryWorkflow: "create-course",
      supportsRecursiveWorkflows: true,
      totalStepsKnownUpFront: false,
      artifactKinds: Array.from(new Set(artifacts.map((artifact) => artifact.kind))).sort(),
      sourceFiles,
      notes: [
        "Known counts are local to the currently materialized subtree.",
        "Conditional satellite artifacts stay horizon until LESSON Artifact Scope is known.",
        "Artifact edits should trigger downstream review and repair through artifact dependencies.",
      ],
    },
    projection,
    nodes: flattenNodes(root),
    artifacts,
  }
}
