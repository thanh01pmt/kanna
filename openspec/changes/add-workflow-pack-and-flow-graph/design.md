## Overview

Workflow packs are curated groups of workflow definitions. A project flow graph is the set of relationships between registered workflows in a project. The graph can come from explicit declarations, artifact IO inference, and AI suggestions.

## Workflow Packs

A pack can define:

- `name`, `version`, `description`
- included workflow definitions and recommended versions
- default entrypoint recommendation
- optional explicit flow edges
- optional pack-level settings

Registering a pack should create or update project workflow registrations while preserving pinned versions.

## Flow Edge Sources

Graph edge precedence:

```text
explicit edges > artifact IO inferred edges > AI suggested edges
```

Edge provenance should be retained:

- `explicit_pack`
- `explicit_user`
- `artifact_io_inferred`
- `ai_suggested`
- `ai_approved`

AI suggestions must not become canonical edges until user approval.

## Project Flow Graph

Store project-level edges between registered workflow records. Edges may represent:

- `produces_input_for`
- `must_run_before`
- `recommended_before`
- `parallel_peer`

The graph should support:

- main flow ordering
- blocker explanations
- optional parallel branches

## Inference

Artifact IO inference compares workflow outputs and inputs:

- If workflow A outputs artifact X and workflow B requires artifact X, infer A -> B.
- If multiple workflows output the same canonical artifact, this should be passed to conflict resolution rather than silently choosing an edge.

## Non-Goals

- Full scheduler/orchestration is not included.
- Nested workflow detail UI is covered by `add-nested-workflow-detail-views`.
- Locks and conflict enforcement are covered by `add-workflow-locks-and-conflict-resolution`.
